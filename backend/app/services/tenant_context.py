import datetime
import json
import uuid
from typing import Optional
from fastapi import Header, Depends, HTTPException, status, Cookie
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Organization, OrganizationMembership, Subscription, Plan, UsageEvent

# Canonical platform-wide administrative identifiers for the legacy free-text
# User.role field (see models.User.role). Must stay aligned with auth.py's
# registration blocklist and the frontend AdminGuard allowlist — those compare
# the raw value, this compares upper-cased, so keep both sets in sync.
GLOBAL_ADMIN_ROLES = {"SYSTEMADMIN", "ADMIN", "SUPERADMIN", "DEVELOPER"}


def get_organization_family_ids(db: Session, root_org_id: str) -> list[str]:
    family = [root_org_id]
    queue = [root_org_id]
    while queue:
        curr_id = queue.pop(0)
        children = db.query(Organization).filter(Organization.parent_id == curr_id).all()
        for child in children:
            if child.id not in family:
                family.append(child.id)
                queue.append(child.id)
    return family

class TenantContext:
    def __init__(self, user: User, organization: Organization, membership: OrganizationMembership, subscription: Subscription, plan: Plan, subscription_owner_id: str):
        self.user = user
        self.organization = organization
        self.membership = membership
        self.subscription = subscription
        self.plan = plan
        self.subscription_owner_id = subscription_owner_id

    @property
    def role(self) -> str:
        return self.membership.role

    @property
    def is_global_admin(self) -> bool:
        """Platform-wide administrative override, independent of organization membership."""
        return (self.user.role or "").upper() in GLOBAL_ADMIN_ROLES

    @property
    def limits(self) -> dict:
        if isinstance(self.plan.limits_json, str):
            return json.loads(self.plan.limits_json)
        return self.plan.limits_json or {}

    @property
    def features(self) -> dict:
        if isinstance(self.plan.features_json, str):
            return json.loads(self.plan.features_json)
        return self.plan.features_json or {}


def get_current_user_from_header(
    authorization: str = Header(None),
    session_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
) -> User:
    """Resolve the current user from the Authorization header when present
    (API clients), falling back to the HttpOnly session cookie set by
    auth.login for browser sessions."""
    from ..routers.auth import get_current_user
    if authorization and authorization.startswith("Bearer "):
        return get_current_user(authorization=authorization, session_token=None, db=db)
    return get_current_user(authorization=None, session_token=session_token, db=db)


def get_tenant_context(
    x_organization_id: str = Header(None),
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
) -> TenantContext:
    now = datetime.datetime.now(datetime.UTC).isoformat()

    # Ensure commercial plans are always seeded (idempotent, fast if already seeded)
    from .billing.bootstrap import ensure_plans_and_pricing_seeded
    ensure_plans_and_pricing_seeded(db)

    # 1. Resolve organization_id
    if not x_organization_id:
        # Fallback: Find the user's first active membership
        membership = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == current_user.id,
            OrganizationMembership.status == "ACTIVE"
        ).first()

        if not membership:
            # Provision a Personal Workspace automatically
            org_id = f"org-user-{current_user.id}"
            slug = f"personal-{current_user.username.lower()}"
            
            # Check if organization already exists (e.g. from previous run or backfill)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                org = Organization(
                    id=org_id,
                    name=f"مساحة {current_user.username} الشخصية",
                    slug=slug,
                    organization_type="PERSONAL",
                    status="ACTIVE",
                    owner_user_id=current_user.id,
                    default_language="ar",
                    data_region="sa",
                    created_at=now
                )
                db.add(org)
                db.commit()
                db.refresh(org)

            membership = OrganizationMembership(
                id=f"mbr-{str(uuid.uuid4())[:8]}",
                organization_id=org.id,
                user_id=current_user.id,
                role="OWNER",
                status="ACTIVE",
                created_at=now
            )
            db.add(membership)

            # Assign FREE subscription
            sub = Subscription(
                id=f"sub-{str(uuid.uuid4())[:8]}",
                organization_id=org.id,
                plan_id="pln-free",
                status="ACTIVE",
                provider="MOCK",
                current_period_start=now,
                current_period_end=(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=3650)).isoformat(),
                created_at=now
            )
            db.add(sub)
            db.commit()
            db.refresh(membership)
        
        org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
    else:
        membership = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == x_organization_id,
            OrganizationMembership.user_id == current_user.id,
            OrganizationMembership.status == "ACTIVE"
        ).first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization or membership is inactive"
            )
        
        org = db.query(Organization).filter(Organization.id == x_organization_id).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    if org.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization is currently {org.status}"
        )

    # 2. Get Subscription & Plan (supporting hierarchy inheritance)
    subscription = None
    curr_org = org
    subscription_owner_id = org.id
    while curr_org:
        subscription = db.query(Subscription).filter(
            Subscription.organization_id == curr_org.id,
            Subscription.status == "ACTIVE"
        ).first()
        if subscription:
            subscription_owner_id = curr_org.id
            break
        if not curr_org.parent_id:
            break
        curr_org = db.query(Organization).filter(Organization.id == curr_org.parent_id).first()

    if not subscription:
        # Fallback to FREE plan if no subscription — resolve plan ID dynamically
        free_plan_row = db.query(Plan).filter(Plan.code == "FREE").first()
        free_plan_id = free_plan_row.id if free_plan_row else "pln-free"
        subscription = Subscription(
            id=f"sub-{str(uuid.uuid4())[:8]}",
            organization_id=org.id,
            plan_id=free_plan_id,
            status="ACTIVE",
            provider="MOCK",
            current_period_start=now,
            current_period_end=(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=3650)).isoformat(),
            created_at=now
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        subscription_owner_id = org.id

    plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
    if not plan:
        # If plan is missing (should not happen), fallback to free plan
        plan = db.query(Plan).filter(Plan.code == "PERSONAL_FREE").first()
        
    if not plan:
        # Dynamic fallback Plan object for testing or unseeded databases
        plan = Plan(
            id="pln-free",
            code="PERSONAL_FREE",
            name="الباقة الشخصية المجانية",
            limits_json={
                "max_projects": 2,
                "max_members": 1,
                "max_storage_mb": 50,
                "ai_tokens_limit": 10000,
                "prediction_runs_limit": 5
            },
            features_json={
                "can_export": False,
                "reviewer_portal": False,
                "methodology_chat": True
            }
        )

    return TenantContext(
        user=current_user,
        organization=org,
        membership=membership,
        subscription=subscription,
        plan=plan,
        subscription_owner_id=subscription_owner_id
    )


def require_role(allowed_roles: list[str]):
    def dependency(context: TenantContext = Depends(get_tenant_context)):
        allowed = {role.upper() for role in allowed_roles}
        current = (context.role or "").upper()
        if current not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have the required role for this operation in this organization"
            )
        return context
    return dependency


def require_entitlement(feature_key: str):
    def dependency(context: TenantContext = Depends(get_tenant_context)):
        features = context.features
        if not features.get(feature_key, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"The feature '{feature_key}' is not included in your current subscription plan"
            )
        return context
    return dependency


def verify_usage_limit(event_type: str, limit_key: str):
    def dependency(context: TenantContext = Depends(get_tenant_context), db: Session = Depends(get_db)):
        limits = context.limits
        max_val = limits.get(limit_key)
        if max_val is None:
            return context

        # Resolve family organization IDs (all children under subscription owner)
        family_ids = get_organization_family_ids(db, context.subscription_owner_id)

        # Query usage in the current billing period across all family members
        current_period = datetime.datetime.now(datetime.UTC).strftime("%Y-%m")
        usage_sum = db.query(func.sum(UsageEvent.quantity)).filter(
            UsageEvent.organization_id.in_(family_ids),
            UsageEvent.event_type == event_type,
            UsageEvent.billing_period == current_period
        ).scalar() or 0.0

        if usage_sum >= max_val:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You have reached your subscription limit for {limit_key} ({usage_sum}/{max_val})"
            )
        return context
    return dependency


def record_usage_event(db: Session, org_id: str, user_id: str, event_type: str, quantity: float = 1.0, metadata: dict = None):
    now = datetime.datetime.now(datetime.UTC)
    current_period = now.strftime("%Y-%m")
    
    event = UsageEvent(
        id=f"use-{str(uuid.uuid4())[:8]}",
        organization_id=org_id,
        user_id=user_id,
        event_type=event_type,
        quantity=quantity,
        unit="count" if event_type != "FILE_UPLOAD_BYTES" else "bytes",
        metadata_json=metadata,
        occurred_at=now.isoformat(),
        billing_period=current_period
    )
    db.add(event)
    db.commit()

