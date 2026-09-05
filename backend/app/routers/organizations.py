import datetime
import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from ..db import get_db
from .. import models, schemas
from ..config import settings
from ..services.tenant_context import get_tenant_context, TenantContext, get_organization_family_ids
from ..services.rbac import (
    PERM_AUDIT_VIEW,
    PERM_BILLING_MANAGE,
    PERM_BILLING_VIEW,
    PERM_INVITATIONS_VIEW,
    PERM_MEMBERS_INVITE,
    PERM_MEMBERS_MANAGE,
    PERM_MEMBERS_VIEW_PII,
    can_assign_role,
    has_permission,
    normalize_org_role,
    require_permission,
)
from ..services.sanitization import sanitize_text

router = APIRouter(prefix="/organizations", tags=["organizations"])

class OrganizationCreateBody(BaseModel):
    name: str
    slug: str
    organization_type: Optional[str] = "PERSONAL"
    parent_id: Optional[str] = None

class InviteMemberBody(BaseModel):
    email: str
    role: str

class SubscribeBody(BaseModel):
    plan_code: str

class AcceptInvitationBody(BaseModel):
    token: str

class MembershipPatchBody(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


@router.get("", response_model=List[schemas.OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Retrieve all organizations where current user has membership
    memberships = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.user_id == context.user.id,
        models.OrganizationMembership.status == "ACTIVE"
    ).all()
    
    org_ids = [m.organization_id for m in memberships]
    orgs = db.query(models.Organization).filter(models.Organization.id.in_(org_ids)).all()
    return orgs


@router.post("", response_model=schemas.OrganizationResponse)
def create_organization(
    body: OrganizationCreateBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    body.name = sanitize_text(body.name)
    body.slug = sanitize_text(body.slug)
    
    # Verify slug uniqueness
    existing_org = db.query(models.Organization).filter(models.Organization.slug == body.slug).first()
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The organization URL slug is already taken"
        )

    hierarchy_level = 0
    if body.parent_id:
        parent = db.query(models.Organization).filter(models.Organization.id == body.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent organization not found")
            
        # Verify membership in parent organization with admin/owner role
        parent_member = db.query(models.OrganizationMembership).filter(
            models.OrganizationMembership.organization_id == body.parent_id,
            models.OrganizationMembership.user_id == context.user.id,
            models.OrganizationMembership.status == "ACTIVE"
        ).first()
        
        if not parent_member or parent_member.role not in ["OWNER", "ORGANIZATION_ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have administrative privileges in the parent organization to create sub-organizations."
            )
        hierarchy_level = parent.hierarchy_level + 1
    else:
        # Check limit of memberships where role is OWNER (only for root/personal orgs)
        owner_orgs_count = db.query(models.OrganizationMembership).filter(
            models.OrganizationMembership.user_id == context.user.id,
            models.OrganizationMembership.role == "OWNER"
        ).count()

        if owner_orgs_count >= 3: # Allow up to 3 organizations max for standard users
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="لقد وصلت للحد الأقصى لمساحات العمل المتاحة لحسابك (الحد الأقصى: 3 مساحات عمل)"
            )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    org_id = f"org-{str(uuid.uuid4())[:8]}"
    
    org = models.Organization(
        id=org_id,
        name=body.name,
        slug=body.slug,
        parent_id=body.parent_id,
        hierarchy_level=hierarchy_level,
        organization_type=body.organization_type or "RESEARCH_TEAM",
        status="ACTIVE",
        owner_user_id=context.user.id,
        default_language="ar",
        data_region="sa",
        created_at=now
    )
    db.add(org)

    # Membership creation
    membership = models.OrganizationMembership(
        id=f"mbr-{str(uuid.uuid4())[:8]}",
        organization_id=org_id,
        user_id=context.user.id,
        role="OWNER",
        status="ACTIVE",
        created_at=now
    )
    db.add(membership)

    # Only create subscription for root organizations. Sub-orgs inherit subscription.
    if not body.parent_id:
        trial_plan = db.query(models.Plan).filter(models.Plan.code == "RESEARCH_TEAM").first()
        plan_id = trial_plan.id if trial_plan else "pln-free"
        
        sub = models.Subscription(
            id=f"sub-{str(uuid.uuid4())[:8]}",
            organization_id=org_id,
            plan_id=plan_id,
            status="ACTIVE",
            provider="MOCK",
            current_period_start=now,
            current_period_end=(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=14)).isoformat(), # 14 days trial
            trial_ends_at=(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=14)).isoformat(),
            created_at=now
        )
        db.add(sub)

    # Audit log
    import secrets
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=org_id,
        action="CREATE_ORGANIZATION",
        details=f"Created organization {body.name} (slug: {body.slug}, parent: {body.parent_id})",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(org)
    
    return org


@router.get("/active", response_model=schemas.OrganizationResponse)
def get_active_organization(
    context: TenantContext = Depends(get_tenant_context)
):
    return context.organization


@router.get("/members", response_model=List[schemas.OrganizationMembershipResponse])
def list_organization_members(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    memberships = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == context.organization.id,
        models.OrganizationMembership.status != "REMOVED"
    ).all()
    
    reveal_pii = has_permission(context, PERM_MEMBERS_VIEW_PII)
    result = []
    for m in memberships:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        email = user.email if user else None
        res = schemas.OrganizationMembershipResponse(
            id=m.id,
            organization_id=m.organization_id,
            user_id=m.user_id,
            role=m.role,
            status=m.status,
            joined_at=m.joined_at,
            created_at=m.created_at,
            username=user.username if user else "Unknown",
            email=email if reveal_pii else None,
        )
        result.append(res)
    return result


@router.post("/members/invite", response_model=schemas.OrganizationInvitationResponse)
def invite_member(
    body: InviteMemberBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_permission(PERM_MEMBERS_INVITE))
):
    assigned_role = normalize_org_role(body.role)
    if not assigned_role or not can_assign_role(context.role, assigned_role):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite this role. Allowed roles are below your own rank, and OWNER cannot be invited.",
        )

    # Entitlement Limit Check (max members)
    member_count = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == context.organization.id,
        models.OrganizationMembership.status == "ACTIVE"
    ).count()
    
    max_members = context.limits.get("max_members", 1)
    if member_count >= max_members:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"PLAN_LIMIT_REACHED: لقد تجاوزت الحد الأقصى للأعضاء في خطتك الحالية ({member_count}/{max_members}). يرجى الترقية لإضافة أعضاء."
        )

    token = str(uuid.uuid4())
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    
    now = datetime.datetime.now(datetime.UTC)
    expires_at = (now + datetime.timedelta(days=7)).isoformat()
    
    inv = models.OrganizationInvitation(
        id=f"inv-{str(uuid.uuid4())[:8]}",
        organization_id=context.organization.id,
        email=body.email,
        role=assigned_role,
        token_hash=token_hash,
        invited_by=context.user.id,
        expires_at=expires_at,
        created_at=now.isoformat()
    )
    db.add(inv)
    audit = models.AuditLog(
        id=f"aud-{str(uuid.uuid4())[:8]}",
        userId=context.user.id,
        organizationId=context.organization.id,
        action="INVITE_MEMBER",
        details=f"Invited {body.email} as {assigned_role}",
        timestamp=now.isoformat(),
    )
    db.add(audit)
    db.commit()
    db.refresh(inv)

    # Return invitation response (simulating sending email)
    # The token is returned so we can test invitation acceptance easily in dev mode
    res = schemas.OrganizationInvitationResponse(
        id=inv.id,
        organization_id=inv.organization_id,
        email=inv.email,
        role=inv.role,
        invited_by=context.user.username,
        expires_at=inv.expires_at,
        created_at=inv.created_at
    )
    # Set mock custom attribute for UI token display
    res_dict = res.model_dump()
    if settings.expose_dev_secrets:
        res_dict["token"] = token
    return res_dict


@router.patch("/members/{membership_id}", response_model=schemas.OrganizationMembershipResponse)
def patch_organization_member(
    membership_id: str,
    body: MembershipPatchBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_permission(PERM_MEMBERS_MANAGE)),
):
    membership = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.id == membership_id,
        models.OrganizationMembership.organization_id == context.organization.id,
        models.OrganizationMembership.status != "REMOVED",
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    if membership.user_id == context.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own membership",
        )

    before_role = membership.role
    before_status = membership.status
    now = datetime.datetime.now(datetime.UTC).isoformat()

    if body.role is not None:
        target_role = normalize_org_role(body.role)
        if not target_role or not can_assign_role(context.role, target_role):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign this role",
            )
        if normalize_org_role(membership.role) == "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ownership cannot be changed through membership patch",
            )
        membership.role = target_role

    if body.status is not None:
        next_status = body.status.upper()
        if next_status not in {"ACTIVE", "SUSPENDED", "REMOVED"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid membership status")
        if normalize_org_role(membership.role) == "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The organization owner cannot be suspended through this endpoint",
            )
        membership.status = next_status

    membership.updated_at = now
    audit = models.AuditLog(
        id=f"aud-{str(uuid.uuid4())[:8]}",
        userId=context.user.id,
        organizationId=context.organization.id,
        action="UPDATE_MEMBERSHIP",
        details=f"membership={membership.id} role {before_role}->{membership.role} status {before_status}->{membership.status}",
        before_json={"role": before_role, "status": before_status},
        after_json={"role": membership.role, "status": membership.status},
        timestamp=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(membership)
    user = db.query(models.User).filter(models.User.id == membership.user_id).first()
    return schemas.OrganizationMembershipResponse(
        id=membership.id,
        organization_id=membership.organization_id,
        user_id=membership.user_id,
        role=membership.role,
        status=membership.status,
        joined_at=membership.joined_at,
        created_at=membership.created_at,
        username=user.username if user else "Unknown",
        email=user.email if user else None,
    )


@router.get("/invitations", response_model=List[schemas.OrganizationInvitationResponse])
def list_organization_invitations(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_permission(PERM_INVITATIONS_VIEW))
):
    invitations = db.query(models.OrganizationInvitation).filter(
        models.OrganizationInvitation.organization_id == context.organization.id,
        models.OrganizationInvitation.accepted_at == None,
        models.OrganizationInvitation.revoked_at == None
    ).all()
    
    result = []
    for inv in invitations:
        inviting_user = db.query(models.User).filter(models.User.id == inv.invited_by).first()
        res = schemas.OrganizationInvitationResponse(
            id=inv.id,
            organization_id=inv.organization_id,
            email=inv.email,
            role=inv.role,
            invited_by=inviting_user.username if inviting_user else "System",
            expires_at=inv.expires_at,
            created_at=inv.created_at
        )
        result.append(res)
    return result


@router.post("/invitations/accept")
def accept_invitation(
    body: AcceptInvitationBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    token_hash = hashlib.sha256(body.token.encode('utf-8')).hexdigest()
    inv = db.query(models.OrganizationInvitation).filter(
        models.OrganizationInvitation.token_hash == token_hash,
        models.OrganizationInvitation.accepted_at == None,
        models.OrganizationInvitation.revoked_at == None
    ).first()
    
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="رمز الدعوة غير صالح أو منتهي الصلاحية أو مستخدم بالفعل"
        )
        
    # Check expiry
    expiry = datetime.datetime.fromisoformat(inv.expires_at)
    if datetime.datetime.now(datetime.UTC) > expiry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="الدعوة منتهية الصلاحية"
        )

    # Check if user email matches the invitation email
    if context.user.email.lower() != inv.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"هذه الدعوة مخصصة للبريد {inv.email}، ولكن حسابك مسجل بالبريد {context.user.email}"
        )

    assigned_role = normalize_org_role(inv.role)
    if not assigned_role or assigned_role == "OWNER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation role is not valid",
        )

    existing = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == inv.organization_id,
        models.OrganizationMembership.user_id == context.user.id,
        models.OrganizationMembership.status != "REMOVED",
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this organization",
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    
    # Accept invitation
    inv.accepted_at = now
    
    # Create membership
    membership = models.OrganizationMembership(
        id=f"mbr-{str(uuid.uuid4())[:8]}",
        organization_id=inv.organization_id,
        user_id=context.user.id,
        role=assigned_role,
        status="ACTIVE",
        joined_at=now,
        created_at=now
    )
    db.add(membership)
    
    # Audit log
    audit = models.AuditLog(
        id=f"aud-{str(uuid.uuid4())[:8]}",
        userId=context.user.id,
        organizationId=inv.organization_id,
        action="ACCEPT_INVITATION",
        details=f"Joined organization as {assigned_role}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    
    return {"ok": True, "organizationId": inv.organization_id, "role": assigned_role}


@router.get("/billing", response_model=schemas.UsageResponse)
def get_billing_and_usage(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_permission(PERM_BILLING_VIEW))
):
    current_period = datetime.datetime.now(datetime.UTC).strftime("%Y-%m")
    
    # Resolve all family organization IDs
    family_ids = get_organization_family_ids(db, context.organization.id)
    
    # Gather usage stats across all family members
    ai_usage = db.query(func.sum(models.UsageEvent.quantity)).filter(
        models.UsageEvent.organization_id.in_(family_ids),
        models.UsageEvent.event_type == "AI_REQUEST",
        models.UsageEvent.billing_period == current_period
    ).scalar() or 0.0

    prediction_runs = db.query(func.sum(models.UsageEvent.quantity)).filter(
        models.UsageEvent.organization_id.in_(family_ids),
        models.UsageEvent.event_type == "PREDICTION_RUN",
        models.UsageEvent.billing_period == current_period
    ).scalar() or 0.0

    storage_bytes = db.query(func.sum(models.UsageEvent.quantity)).filter(
        models.UsageEvent.organization_id.in_(family_ids),
        models.UsageEvent.event_type == "FILE_UPLOAD_BYTES",
        models.UsageEvent.billing_period == current_period
    ).scalar() or 0.0
    storage_mb = storage_bytes / (1024 * 1024)

    projects_count = db.query(models.ResearchProject).filter(
        models.ResearchProject.organizationId.in_(family_ids)
    ).count()

    members_count = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id.in_(family_ids),
        models.OrganizationMembership.status == "ACTIVE"
    ).count()

    quota = {
        "max_projects": context.limits.get("max_projects", 2),
        "max_members": context.limits.get("max_members", 1),
        "max_storage_mb": context.limits.get("max_storage_mb", 50),
        "ai_tokens_limit": context.limits.get("ai_tokens_limit", 10000),
        "prediction_runs_limit": context.limits.get("prediction_runs_limit", 5),
        "plan_name": context.plan.name,
        "plan_code": context.plan.code,
        "subscription_status": context.subscription.status,
        "current_period_end": context.subscription.current_period_end
    }

    usage = {
        "projects": projects_count,
        "members": members_count,
        "storage_mb": round(storage_mb, 2),
        "ai_tokens": ai_usage,
        "prediction_runs": prediction_runs
    }

    return schemas.UsageResponse(quota=quota, usage=usage)


@router.post("/billing/subscribe")
def subscribe_to_plan(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_permission(PERM_BILLING_MANAGE))
):
    target_plan = db.query(models.Plan).filter(models.Plan.code == body.plan_code).first()
    if not target_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الخطة المطلوبة غير موجودة"
        )

    if target_plan.price and target_plan.price > 0 and settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Paid plan changes in production require a verified checkout session",
        )

    now = datetime.datetime.now(datetime.UTC)
    current_sub = context.subscription
    
    # Update Subscription to the new plan
    current_sub.plan_id = target_plan.id
    current_sub.current_period_start = now.isoformat()
    current_sub.current_period_end = (now + datetime.timedelta(days=30)).isoformat()
    current_sub.status = "ACTIVE"
    current_sub.updated_at = now.isoformat()
    
    # Generate Invoice
    invoice = models.Invoice(
        id=f"inv-{str(uuid.uuid4())[:8]}",
        organization_id=context.organization.id,
        subscription_id=current_sub.id,
        invoice_number=f"INV-{now.strftime('%Y%m')}-{str(uuid.uuid4())[:4].upper()}",
        amount_subtotal=target_plan.price,
        amount_tax=target_plan.price * 0.15, # 15% VAT
        amount_total=target_plan.price * 1.15,
        currency=target_plan.currency,
        status="PAID" if target_plan.price > 0 else "DRAFT",
        issued_at=now.isoformat(),
        paid_at=now.isoformat() if target_plan.price > 0 else None
    )
    db.add(invoice)

    # Audit log
    audit = models.AuditLog(
        id=f"aud-{str(uuid.uuid4())[:8]}",
        userId=context.user.id,
        organizationId=context.organization.id,
        action="SUBSCRIBE_PLAN",
        details=f"Upgraded organization subscription to plan {target_plan.name}",
        timestamp=now.isoformat()
    )
    db.add(audit)
    
    db.commit()
    return {"ok": True, "plan": target_plan.name, "status": current_sub.status}


@router.get("/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(require_permission(PERM_AUDIT_VIEW))
):
    logs = db.query(models.AuditLog).filter(
        models.AuditLog.organizationId == context.organization.id
    ).order_by(models.AuditLog.timestamp.desc()).limit(100).all()
    return logs


@router.get("/plans", response_model=List[schemas.PlanResponse])
def list_plans(
    db: Session = Depends(get_db)
):
    plans = db.query(models.Plan).filter(models.Plan.is_active == True).all()
    return plans


