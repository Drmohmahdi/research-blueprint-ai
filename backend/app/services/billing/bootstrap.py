import datetime
import json
import logging
from sqlalchemy.orm import Session
from ... import models
from .types import PlanCode, BillingInterval, FeatureKey, LimitKey, DEFAULT_CURRENCY

logger = logging.getLogger(__name__)

# Standard Plan Definitions
PLANS_DEFINITION = [
    {
        "id": "pln-free",
        "code": "FREE",
        "name": "الباقة المجانية (Free Tier)",
        "name_ar": "الباقة المجانية",
        "name_en": "Free Tier",
        "description_ar": "باقة مجانية للأفراد والباحثين المستقلين مع وصول للوظائف الأساسية وإعداد الدراسات ومخططات البحث.",
        "description_en": "Free tier for individuals and independent researchers with core blueprint tools.",
        "price_minor_units": 0,
        "prices": [
            {"interval": "MONTHLY", "price_minor_units": 0},
            {"interval": "YEARLY", "price_minor_units": 0}
        ],
        "limits": {
            "max_projects": 3,
            "max_members": 2,
            "max_reports_monthly": 5,
            "max_storage_mb": 100,
            "max_external_reviews": 0,
            "ai_tokens_limit": 5000,
            "prediction_runs_limit": 3
        },
        "features": {
            FeatureKey.EXPORT_PDF.value: True,
            FeatureKey.EXPORT_DOCX.value: False,
            FeatureKey.ADVANCED_REPORTING.value: False,
            FeatureKey.PEER_REVIEW.value: False,
            FeatureKey.PROMOTION_ENGINE.value: False,
            FeatureKey.AI_ASSISTANCE.value: False,
            FeatureKey.EXTERNAL_REVIEWERS.value: False
        }
    },
    {
        "id": "pln-starter",
        "code": "STARTER",
        "name": "باقة الباحث المحترف (Starter)",
        "name_ar": "باقة الباحث المحترف",
        "name_en": "Researcher Starter",
        "description_ar": "مثالية للباحثين الأكاديميين وطلاب الدراسات العليا مع تصدير بصيغة Word وتقارير متقدمة.",
        "description_en": "Ideal for individual academic researchers and graduate students with Word export and advanced reporting.",
        "price_minor_units": 9900,  # 99.00 SAR
        "prices": [
            {"interval": "MONTHLY", "price_minor_units": 9900},
            {"interval": "YEARLY", "price_minor_units": 99000}  # 990.00 SAR (2 months free)
        ],
        "limits": {
            "max_projects": 15,
            "max_members": 10,
            "max_reports_monthly": 50,
            "max_storage_mb": 2048,
            "max_external_reviews": 0,
            "ai_tokens_limit": 50000,
            "prediction_runs_limit": 25
        },
        "features": {
            FeatureKey.EXPORT_PDF.value: True,
            FeatureKey.EXPORT_DOCX.value: True,
            FeatureKey.ADVANCED_REPORTING.value: True,
            FeatureKey.PEER_REVIEW.value: False,
            FeatureKey.PROMOTION_ENGINE.value: False,
            FeatureKey.AI_ASSISTANCE.value: True,
            FeatureKey.EXTERNAL_REVIEWERS.value: False
        }
    },
    {
        "id": "pln-pro",
        "code": "PROFESSIONAL",
        "name": "باقة الفرق والمجموعات البحثية (Professional)",
        "name_ar": "باقة الفرق والمجموعات البحثية",
        "name_en": "Research Groups & Professional",
        "description_ar": "شاملة لمنظومة التحكيم العلمي والترقيات الأكاديمية والتعاون الجماعي والمحكمين الخارجيين.",
        "description_en": "Full suite including peer review portal, promotion engine, external referee invitations, and team workspaces.",
        "price_minor_units": 29900,  # 299.00 SAR
        "prices": [
            {"interval": "MONTHLY", "price_minor_units": 29900},
            {"interval": "YEARLY", "price_minor_units": 299000}  # 2990.00 SAR
        ],
        "limits": {
            "max_projects": 100,
            "max_members": 50,
            "max_reports_monthly": 500,
            "max_storage_mb": 20480,
            "max_external_reviews": 50,
            "ai_tokens_limit": 250000,
            "prediction_runs_limit": 150
        },
        "features": {
            FeatureKey.EXPORT_PDF.value: True,
            FeatureKey.EXPORT_DOCX.value: True,
            FeatureKey.ADVANCED_REPORTING.value: True,
            FeatureKey.PEER_REVIEW.value: True,
            FeatureKey.PROMOTION_ENGINE.value: True,
            FeatureKey.AI_ASSISTANCE.value: True,
            FeatureKey.EXTERNAL_REVIEWERS.value: True
        }
    },
    {
        "id": "pln-enterprise",
        "code": "INSTITUTIONAL",
        "name": "باقة المؤسسات والجامعات (Institutional)",
        "name_ar": "باقة المؤسسات والجامعات",
        "name_en": "Institutional Enterprise",
        "description_ar": "ترخيص مؤسسي غير محدود للجامعات والمراكز البحثية والهيئات العلمية مع دعم مخصص وعزل سيادي.",
        "description_en": "Unlimited institutional license for universities, research centers, and academic councils.",
        "price_minor_units": 99900,  # 999.00 SAR
        "prices": [
            {"interval": "MONTHLY", "price_minor_units": 99900},
            {"interval": "YEARLY", "price_minor_units": 999000}
        ],
        "limits": {
            "max_projects": -1,
            "max_members": -1,
            "max_reports_monthly": -1,
            "max_storage_mb": -1,
            "max_external_reviews": -1,
            "ai_tokens_limit": -1,
            "prediction_runs_limit": -1
        },
        "features": {
            FeatureKey.EXPORT_PDF.value: True,
            FeatureKey.EXPORT_DOCX.value: True,
            FeatureKey.ADVANCED_REPORTING.value: True,
            FeatureKey.PEER_REVIEW.value: True,
            FeatureKey.PROMOTION_ENGINE.value: True,
            FeatureKey.AI_ASSISTANCE.value: True,
            FeatureKey.EXTERNAL_REVIEWERS.value: True
        }
    }
]


def ensure_plans_and_pricing_seeded(db: Session) -> None:
    """
    Idempotently seeds and aligns commercial plans, prices, and entitlements in the database.
    Preserves existing plans if already present and adds any missing prices/entitlements.
    """
    now = datetime.datetime.now(datetime.UTC).isoformat()

    for plan_data in PLANS_DEFINITION:
        plan = db.query(models.Plan).filter(
            (models.Plan.id == plan_data["id"]) | (models.Plan.code == plan_data["code"])
        ).first()

        if not plan:
            plan = models.Plan(
                id=plan_data["id"],
                code=plan_data["code"],
                name=plan_data["name"],
                name_ar=plan_data["name_ar"],
                name_en=plan_data["name_en"],
                description=plan_data["description_ar"],
                description_ar=plan_data["description_ar"],
                description_en=plan_data["description_en"],
                billing_interval="MONTHLY",
                price=plan_data["price_minor_units"] / 100.0,
                price_minor_units=plan_data["price_minor_units"],
                currency=DEFAULT_CURRENCY,
                is_active=True,
                is_public=True,
                trial_days=14 if plan_data["code"] in ["STARTER", "PROFESSIONAL"] else 0,
                limits_json=plan_data["limits"],
                features_json=plan_data["features"],
                created_at=now,
                updated_at=now
            )
            db.add(plan)
            db.flush()
        else:
            # Update all fields including code and name for proper alignment
            plan.code = plan_data["code"]
            plan.name = plan_data["name"]
            plan.name_ar = plan_data["name_ar"]
            plan.name_en = plan_data["name_en"]
            plan.description_ar = plan_data["description_ar"]
            plan.description_en = plan_data["description_en"]
            plan.price_minor_units = plan_data["price_minor_units"]
            plan.limits_json = plan_data["limits"]
            plan.features_json = plan_data["features"]
            plan.is_active = True
            db.flush()

        # Seed Plan Prices
        for p in plan_data["prices"]:
            price_row = db.query(models.CommercialPlanPrice).filter(
                models.CommercialPlanPrice.plan_id == plan.id,
                models.CommercialPlanPrice.billing_interval == p["interval"]
            ).first()

            if not price_row:
                price_row = models.CommercialPlanPrice(
                    id=f"prc-{plan.id}-{p['interval'].lower()}",
                    plan_id=plan.id,
                    billing_interval=p["interval"],
                    price_minor_units=p["price_minor_units"],
                    currency=DEFAULT_CURRENCY,
                    is_active=True,
                    created_at=now
                )
                db.add(price_row)
            else:
                price_row.price_minor_units = p["price_minor_units"]

        # Seed Plan Entitlements (Boolean features + Limits)
        for feat_key, is_enabled in plan_data["features"].items():
            ent = db.query(models.CommercialPlanEntitlement).filter(
                models.CommercialPlanEntitlement.plan_id == plan.id,
                models.CommercialPlanEntitlement.feature_key == feat_key
            ).first()
            if not ent:
                ent = models.CommercialPlanEntitlement(
                    id=f"ent-{plan.id}-{feat_key.lower()}",
                    plan_id=plan.id,
                    feature_key=feat_key,
                    is_enabled=is_enabled,
                    limit_value=None,
                    created_at=now
                )
                db.add(ent)
            else:
                ent.is_enabled = is_enabled

        for lim_key, lim_val in plan_data["limits"].items():
            ent = db.query(models.CommercialPlanEntitlement).filter(
                models.CommercialPlanEntitlement.plan_id == plan.id,
                models.CommercialPlanEntitlement.feature_key == lim_key.upper()
            ).first()
            if not ent:
                ent = models.CommercialPlanEntitlement(
                    id=f"ent-{plan.id}-{lim_key.lower()}",
                    plan_id=plan.id,
                    feature_key=lim_key.upper(),
                    is_enabled=True,
                    limit_value=lim_val,
                    created_at=now
                )
                db.add(ent)
            else:
                ent.limit_value = lim_val

    db.commit()


def ensure_organization_subscription(db: Session, organization_id: str) -> models.Subscription:
    """
    Ensures that an organization has an active Subscription record.
    If none exists, boots it to the FREE plan.
    """
    ensure_plans_and_pricing_seeded(db)

    sub = db.query(models.Subscription).filter(
        models.Subscription.organization_id == organization_id,
        models.Subscription.status.in_(["ACTIVE", "TRIALING"])
    ).first()

    if not sub:
        now = datetime.datetime.now(datetime.UTC)
        # Dynamically resolve the FREE plan ID after seeding
        free_plan = db.query(models.Plan).filter(models.Plan.code == "FREE").first()
        free_plan_id = free_plan.id if free_plan else "pln-free"
        sub = models.Subscription(
            id=f"sub-boot-{organization_id[:12]}",
            organization_id=organization_id,
            plan_id=free_plan_id,
            status="ACTIVE",
            provider="MOCK",
            currency=DEFAULT_CURRENCY,
            billing_interval="MONTHLY",
            unit_amount_minor_units=0,
            current_period_start=now.isoformat(),
            current_period_end=(now + datetime.timedelta(days=3650)).isoformat(),
            created_at=now.isoformat()
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    return sub
