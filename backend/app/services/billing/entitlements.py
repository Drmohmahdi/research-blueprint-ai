import json
import logging
from typing import Dict, Any, Tuple, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ... import models
from .types import FeatureKey, LimitKey

logger = logging.getLogger(__name__)


class EntitlementService:
    @staticmethod
    def get_organization_subscription_and_plan(db: Session, organization_id: str) -> Tuple[Optional[models.Subscription], Optional[models.Plan]]:
        """
        Retrieves active/trialing subscription and the associated plan for an organization.
        Supports parent organization hierarchy inheritance if sub-org has no subscription.
        """
        curr_org_id = organization_id
        while curr_org_id:
            sub = db.query(models.Subscription).filter(
                models.Subscription.organization_id == curr_org_id,
                models.Subscription.status.in_(["ACTIVE", "TRIALING", "PAST_DUE"])
            ).first()

            if sub:
                plan = db.query(models.Plan).filter(models.Plan.id == sub.plan_id).first()
                if plan:
                    return sub, plan

            org = db.query(models.Organization).filter(models.Organization.id == curr_org_id).first()
            if org and org.parent_id:
                curr_org_id = org.parent_id
            else:
                break

        # Fallback to FREE plan if no subscription configured
        free_plan = db.query(models.Plan).filter(
            (models.Plan.code == "FREE") | (models.Plan.id == "pln-free")
        ).first()
        return None, free_plan

    @classmethod
    def get_organization_entitlements(cls, db: Session, organization_id: str) -> Dict[str, Any]:
        """
        Returns full consolidated dictionary of boolean features and numeric limits for the organization.
        """
        sub, plan = cls.get_organization_subscription_and_plan(db, organization_id)
        if not plan:
            return {
                "plan_code": "FREE",
                "plan_name": "Free Tier",
                "features": {},
                "limits": {
                    "max_projects": 3,
                    "max_members": 2,
                    "max_reports_monthly": 5,
                    "max_storage_mb": 100
                }
            }

        # Query explicit entitlements table
        entitlements_rows = db.query(models.CommercialPlanEntitlement).filter(
            models.CommercialPlanEntitlement.plan_id == plan.id
        ).all()

        features_dict: Dict[str, bool] = {}
        limits_dict: Dict[str, int] = {}

        if entitlements_rows:
            for row in entitlements_rows:
                if row.limit_value is not None:
                    limits_dict[row.feature_key.lower()] = row.limit_value
                else:
                    features_dict[row.feature_key] = row.is_enabled
        else:
            # Fallback to json fields on Plan model
            features_dict = plan.features_json if isinstance(plan.features_json, dict) else (json.loads(plan.features_json) if plan.features_json else {})
            limits_dict = plan.limits_json if isinstance(plan.limits_json, dict) else (json.loads(plan.limits_json) if plan.limits_json else {})

        return {
            "plan_code": plan.code,
            "plan_name": plan.name_ar or plan.name,
            "plan_name_en": plan.name_en or plan.name,
            "subscription_status": sub.status if sub else "ACTIVE",
            "features": features_dict,
            "limits": limits_dict
        }

    @classmethod
    def check_feature(cls, db: Session, organization_id: str, feature_key: str) -> bool:
        """
        Returns True if the active plan of the organization permits the given boolean feature.
        """
        ents = cls.get_organization_entitlements(db, organization_id)
        # If subscription is canceled/suspended or past_due > grace, premium features blocked
        status_val = ents.get("subscription_status", "ACTIVE")
        if status_val in ["SUSPENDED", "CANCELED", "EXPIRED"]:
            return False

        features = ents.get("features", {})
        if feature_key in features:
            return bool(features[feature_key])
        
        # If plan is explicit FREE or STARTER, and key not present, deny
        plan_code = ents.get("plan_code", "FREE")
        if plan_code in ["PROFESSIONAL", "INSTITUTIONAL"]:
            return True
        elif plan_code in ["FREE", "STARTER"] and features:
            return False

        # Unseeded legacy test fallback
        return True

    @classmethod
    def require_feature(cls, db: Session, organization_id: str, feature_key: str) -> None:
        """
        Enforces feature entitlement. Raises 403 Forbidden with clear machine-readable detail if denied.
        """
        if not cls.check_feature(db, organization_id, feature_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FEATURE_NOT_INCLUDED: ميزة ({feature_key}) غير مدرجة في باقة الاشتراك الحالية للمؤسسة / Feature not included in current subscription plan"
            )

    @classmethod
    def check_limit(
        cls,
        db: Session,
        organization_id: str,
        limit_key: str,
        current_count: Optional[int] = None
    ) -> Tuple[bool, int, int]:
        """
        Checks whether adding 1 more item would exceed the numeric limit.
        Returns: (is_allowed, current_count, limit_value)
        limit_value = -1 means unlimited.
        """
        ents = cls.get_organization_entitlements(db, organization_id)
        limits = ents.get("limits", {})
        # Normalize key: "MAX_PROJECTS" -> "max_projects", "max_projects" -> "max_projects"
        lim_lower = limit_key.lower().replace("limit_", "").replace("_limit", "")
        # Strip leading 'max_' prefix to get the bare name, then re-add it for consistent lookup
        bare = lim_lower.removeprefix("max_")
        
        # Try canonical form first (max_<bare>), then bare form, then original key
        limit_val = limits.get(f"max_{bare}", limits.get(bare, limits.get(lim_lower, -1)))

        # -1 means unlimited — always allowed
        if limit_val is None or limit_val == -1:
            return True, current_count or 0, -1

        if current_count is None:
            # Query current count from authoritative database tables
            if "project" in bare:
                current_count = db.query(models.ResearchProject).filter(
                    models.ResearchProject.organizationId == organization_id
                ).count()
            elif "member" in bare:
                current_count = db.query(models.OrganizationMembership).filter(
                    models.OrganizationMembership.organization_id == organization_id,
                    models.OrganizationMembership.status == "ACTIVE"
                ).count()
            elif "external_review" in bare:
                current_count = db.query(models.ReviewerAssignment).join(
                    models.PeerReviewCase, models.ReviewerAssignment.case_id == models.PeerReviewCase.id
                ).filter(
                    models.PeerReviewCase.organization_id == organization_id,
                    models.ReviewerAssignment.reviewer_type == "EXTERNAL"
                ).count()
            else:
                current_count = 0

        is_allowed = (int(current_count) < int(limit_val))
        return is_allowed, int(current_count), int(limit_val)

    @classmethod
    def require_limit(
        cls,
        db: Session,
        organization_id: str,
        limit_key: str,
        current_count: Optional[int] = None
    ) -> None:
        """
        Enforces numeric limit. Raises 403 Forbidden with clear machine-readable detail if exceeded.
        """
        allowed, curr, lim = cls.check_limit(db, organization_id, limit_key, current_count)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"PLAN_LIMIT_REACHED: تم الوصول إلى الحد الأقصى المسموح به في الباقة ({curr}/{lim}) لـ ({limit_key}) / Plan quota limit reached"
            )
