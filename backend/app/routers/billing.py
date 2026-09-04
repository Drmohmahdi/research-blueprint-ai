import os
import json
import logging
import datetime
import secrets
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..config import settings
from ..services.tenant_context import (
    TenantContext,
    get_tenant_context,
)
from ..services.rbac import PERM_BILLING_MANAGE, PERM_BILLING_VIEW, require_permission
from ..services.billing import (
    EntitlementService,
    get_payment_provider_adapter,
    InvoiceService,
    WebhookHandler,
    ensure_plans_and_pricing_seeded,
    ensure_organization_subscription,
    PlanCode,
    BillingInterval,
    SubscriptionStatus,
    InvoiceStatus,
    PaymentTransactionStatus,
    DEFAULT_CURRENCY,
    DEFAULT_TAX_RATE_BPS,
    calculate_invoice_amounts,
    format_currency
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["SaaS Billing & Commercialization"])


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PlanPriceItem(BaseModel):
    id: str
    billing_interval: str
    price_minor_units: int
    price_formatted: str
    currency: str


class CommercialPlanItem(BaseModel):
    id: str
    code: str
    name: str
    name_ar: Optional[str]
    name_en: Optional[str]
    description_ar: Optional[str]
    description_en: Optional[str]
    prices: List[PlanPriceItem]
    features: Dict[str, bool]
    limits: Dict[str, Any]
    trial_days: int


class SubscriptionDetailsResponse(BaseModel):
    id: str
    organization_id: str
    plan_id: str
    plan_code: str
    plan_name: str
    plan_name_en: Optional[str]
    status: str
    billing_interval: str
    unit_amount_minor_units: int
    unit_amount_formatted: str
    currency: str
    current_period_start: str
    current_period_end: str
    trial_ends_at: Optional[str]
    cancel_at_period_end: bool
    cancelled_at: Optional[str]


class EntitlementsResponse(BaseModel):
    plan_code: str
    plan_name: str
    plan_name_en: Optional[str]
    subscription_status: str
    features: Dict[str, bool]
    limits: Dict[str, Any]


class UsageMetricsResponse(BaseModel):
    quota: Dict[str, Any]
    usage: Dict[str, Any]
    percentages: Dict[str, float]


class CheckoutRequest(BaseModel):
    plan_code: str
    billing_interval: str = "MONTHLY"  # MONTHLY or YEARLY
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None


class ChangePlanRequest(BaseModel):
    plan_code: str
    billing_interval: str = "MONTHLY"


class CancelSubscriptionRequest(BaseModel):
    immediately: bool = False
    reason: Optional[str] = None


class InvoiceItemResponse(BaseModel):
    id: str
    invoice_number: str
    amount_subtotal_minor_units: int
    amount_tax_minor_units: int
    amount_total_minor_units: int
    amount_subtotal_formatted: str
    amount_tax_formatted: str
    amount_total_formatted: str
    currency: str
    status: str
    issued_at: str
    paid_at: Optional[str]
    seller_snapshot_json: Optional[Dict[str, Any]]
    buyer_snapshot_json: Optional[Dict[str, Any]]


# ─────────────────────────────────────────────────────────────────────────────
# 1. PLANS & PRICING APIS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/plans", response_model=List[CommercialPlanItem], summary="Get commercial plans and pricing")
def list_commercial_plans(
    db: Session = Depends(get_db)
):
    """
    Returns available commercial plans, pricing intervals, boolean features, and quota limits.
    Server is the sole authority on prices.
    """
    ensure_plans_and_pricing_seeded(db)

    plans = db.query(models.Plan).filter(models.Plan.is_active.is_(True)).all()
    result = []

    for p in plans:
        prices_list = []
        for pr in p.prices:
            if pr.is_active:
                prices_list.append(PlanPriceItem(
                    id=pr.id,
                    billing_interval=pr.billing_interval,
                    price_minor_units=pr.price_minor_units,
                    price_formatted=format_currency(pr.price_minor_units, pr.currency),
                    currency=pr.currency
                ))

        features_dict = {}
        limits_dict = {}
        for ent in p.entitlements:
            if ent.limit_value is not None:
                limits_dict[ent.feature_key.lower()] = ent.limit_value
            else:
                features_dict[ent.feature_key] = ent.is_enabled

        # Fallback to json if entitlements table empty for this plan
        if not features_dict and p.features_json:
            features_dict = p.features_json if isinstance(p.features_json, dict) else json.loads(p.features_json)
        if not limits_dict and p.limits_json:
            limits_dict = p.limits_json if isinstance(p.limits_json, dict) else json.loads(p.limits_json)

        result.append(CommercialPlanItem(
            id=p.id,
            code=p.code,
            name=p.name,
            name_ar=p.name_ar or p.name,
            name_en=p.name_en or p.name,
            description_ar=p.description_ar or p.description,
            description_en=p.description_en or p.description,
            prices=prices_list,
            features=features_dict,
            limits=limits_dict,
            trial_days=p.trial_days or 0
        ))

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 2. SUBSCRIPTION & ENTITLEMENTS APIS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionDetailsResponse, summary="Get current organization subscription")
def get_current_subscription(
    context: TenantContext = Depends(require_permission(PERM_BILLING_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Returns current organization subscription status and plan details.
    """
    sub = ensure_organization_subscription(db, context.organization.id)
    plan = db.query(models.Plan).filter(models.Plan.id == sub.plan_id).first()
    if not plan:
        plan = db.query(models.Plan).filter(models.Plan.code == "FREE").first()

    return SubscriptionDetailsResponse(
        id=sub.id,
        organization_id=sub.organization_id,
        plan_id=plan.id,
        plan_code=plan.code,
        plan_name=plan.name_ar or plan.name,
        plan_name_en=plan.name_en or plan.name,
        status=sub.status,
        billing_interval=sub.billing_interval or "MONTHLY",
        unit_amount_minor_units=sub.unit_amount_minor_units or 0,
        unit_amount_formatted=format_currency(sub.unit_amount_minor_units or 0, sub.currency or DEFAULT_CURRENCY),
        currency=sub.currency or DEFAULT_CURRENCY,
        current_period_start=sub.current_period_start,
        current_period_end=sub.current_period_end,
        trial_ends_at=sub.trial_ends_at,
        cancel_at_period_end=sub.cancel_at_period_end or False,
        cancelled_at=sub.cancelled_at
    )


@router.get("/entitlements", response_model=EntitlementsResponse, summary="Get organization entitlements and features")
def get_organization_entitlements_api(
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Returns active features and limits for current tenant.
    """
    ents = EntitlementService.get_organization_entitlements(db, context.organization.id)
    return EntitlementsResponse(
        plan_code=ents["plan_code"],
        plan_name=ents["plan_name"],
        plan_name_en=ents.get("plan_name_en"),
        subscription_status=ents["subscription_status"],
        features=ents["features"],
        limits=ents["limits"]
    )


@router.get("/usage", response_model=UsageMetricsResponse, summary="Get organization usage metrics vs quota limits")
def get_organization_usage(
    context: TenantContext = Depends(require_permission(PERM_BILLING_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Computes real server-side usage metrics and percentage against plan limits.
    """
    org_id = context.organization.id
    ents = EntitlementService.get_organization_entitlements(db, org_id)
    limits = ents.get("limits", {})

    # 1. Projects Count
    projects_count = db.query(models.ResearchProject).filter(
        models.ResearchProject.organizationId == org_id
    ).count()

    # 2. Members Count
    members_count = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == org_id,
        models.OrganizationMembership.status == "ACTIVE"
    ).count()

    # 3. External Reviews Count
    external_reviews_count = db.query(models.ReviewerAssignment).join(
        models.PeerReviewCase, models.ReviewerAssignment.case_id == models.PeerReviewCase.id
    ).filter(
        models.PeerReviewCase.organization_id == org_id,
        models.ReviewerAssignment.reviewer_type == "EXTERNAL"
    ).count()

    usage_dict = {
        "projects_count": projects_count,
        "members_count": members_count,
        "external_reviews_count": external_reviews_count,
        "reports_generated_monthly": 0,
        "storage_mb": 0.0
    }

    percentages = {}
    for k, val in usage_dict.items():
        lim_val = limits.get(f"max_{k.replace('_count', '')}", limits.get(f"max_{k}", -1))
        if lim_val == -1 or lim_val == 0:
            percentages[k] = 0.0
        else:
            percentages[k] = min(round((val / lim_val) * 100.0, 1), 100.0)

    return UsageMetricsResponse(
        quota=limits,
        usage=usage_dict,
        percentages=percentages
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. CHECKOUT & SUBSCRIPTION ACTIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/checkout", summary="Initiate checkout session with server-authoritative pricing")
def create_checkout_session(
    body: CheckoutRequest,
    context: TenantContext = Depends(require_permission(PERM_BILLING_MANAGE)),
    db: Session = Depends(get_db)
):
    """
    Creates a secure checkout session.
    Server determines exact authoritative price based on plan_code and interval.
    Client CANNOT tamper with price or tax calculations.
    """
    ensure_plans_and_pricing_seeded(db)

    # 1. Fetch Plan and Interval Price
    plan = db.query(models.Plan).filter(
        (models.Plan.code == body.plan_code.upper()) | (models.Plan.id == body.plan_code)
    ).first()

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الخطة المختارة غير موجودة / Selected plan not found"
        )

    interval_upper = body.billing_interval.upper()
    if interval_upper not in ["MONTHLY", "YEARLY"]:
        interval_upper = "MONTHLY"

    price_row = db.query(models.CommercialPlanPrice).filter(
        models.CommercialPlanPrice.plan_id == plan.id,
        models.CommercialPlanPrice.billing_interval == interval_upper
    ).first()

    subtotal_minor_units = price_row.price_minor_units if price_row else plan.price_minor_units
    subtotal, tax_amount, total = calculate_invoice_amounts(subtotal_minor_units, DEFAULT_TAX_RATE_BPS)

    # 2. Call Payment Provider Adapter
    adapter = get_payment_provider_adapter()
    try:
        session = adapter.create_checkout_session(
            organization_id=context.organization.id,
            plan_code=plan.code,
            billing_interval=interval_upper,
            amount_minor_units=subtotal,
            tax_amount_minor_units=tax_amount,
            total_minor_units=total,
            currency=DEFAULT_CURRENCY,
            return_url=body.return_url,
            cancel_url=body.cancel_url
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Live payment provider is not configured"
        )

    # Audit Log
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="BILLING_CHECKOUT_CREATED",
        details=f"Created checkout session for plan {plan.code} ({interval_upper}) total: {format_currency(total)}",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(audit)
    db.commit()

    return session


@router.post("/change-plan", summary="Change subscription plan (Admin only)")
def change_subscription_plan(
    body: ChangePlanRequest,
    context: TenantContext = Depends(require_permission(PERM_BILLING_MANAGE)),
    db: Session = Depends(get_db)
):
    """
    Direct plan change by authorized organization owner.
    """
    ensure_plans_and_pricing_seeded(db)

    target_plan = db.query(models.Plan).filter(
        (models.Plan.code == body.plan_code.upper()) | (models.Plan.id == body.plan_code)
    ).first()

    if not target_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الخطة المطلوبة غير موجودة / Plan not found"
        )

    interval_upper = body.billing_interval.upper()
    if interval_upper not in ["MONTHLY", "YEARLY"]:
        interval_upper = "MONTHLY"

    price_row = db.query(models.CommercialPlanPrice).filter(
        models.CommercialPlanPrice.plan_id == target_plan.id,
        models.CommercialPlanPrice.billing_interval == interval_upper
    ).first()

    subtotal_minor_units = price_row.price_minor_units if price_row else target_plan.price_minor_units
    subtotal, tax_amount, total = calculate_invoice_amounts(subtotal_minor_units, DEFAULT_TAX_RATE_BPS)

    if settings.ENVIRONMENT == "production" and subtotal_minor_units > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Paid plans require a verified payment-provider event"
        )

    sub = ensure_organization_subscription(db, context.organization.id)
    now = datetime.datetime.now(datetime.UTC)
    now_str = now.isoformat()
    period_days = 365 if interval_upper == "YEARLY" else 30

    sub.plan_id = target_plan.id
    sub.status = SubscriptionStatus.ACTIVE.value
    sub.billing_interval = interval_upper
    sub.unit_amount_minor_units = subtotal_minor_units
    sub.current_period_start = now_str
    sub.current_period_end = (now + datetime.timedelta(days=period_days)).isoformat()
    sub.cancel_at_period_end = False
    sub.updated_at = now_str

    # Generate Invoice
    invoice = InvoiceService.create_invoice_for_subscription(
        db=db,
        organization=context.organization,
        subscription=sub,
        plan=target_plan,
        subtotal_minor_units=subtotal_minor_units,
        status_val=InvoiceStatus.PAID.value if subtotal_minor_units > 0 else InvoiceStatus.DRAFT.value
    )

    # Audit Log
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="SUBSCRIPTION_CHANGED",
        details=f"Upgraded/Changed subscription plan to {target_plan.code} ({interval_upper})",
        timestamp=now_str
    )
    db.add(audit)
    db.commit()

    return {
        "ok": True,
        "plan_code": target_plan.code,
        "status": sub.status,
        "invoice_id": invoice.id,
        "message": "تم تحديث خطة الاشتراك بنجاح / Plan updated successfully"
    }


@router.post("/cancel", summary="Cancel organization subscription (Admin only)")
def cancel_subscription(
    body: CancelSubscriptionRequest,
    context: TenantContext = Depends(require_permission(PERM_BILLING_MANAGE)),
    db: Session = Depends(get_db)
):
    """
    Cancels subscription.
    Default: cancels at current period end (preserving access until expiry).
    Immediately: cancels immediately and downgrades to FREE.
    Never deletes research or organization records.
    """
    sub = ensure_organization_subscription(db, context.organization.id)
    now_str = datetime.datetime.now(datetime.UTC).isoformat()

    if body.immediately:
        free_plan = db.query(models.Plan).filter(models.Plan.code == "FREE").first()
        sub.status = SubscriptionStatus.CANCELED.value
        sub.cancelled_at = now_str
        sub.updated_at = now_str
    else:
        sub.cancel_at_period_end = True
        sub.cancelled_at = now_str
        sub.updated_at = now_str

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="SUBSCRIPTION_CANCELED",
        details=f"Canceled subscription (immediately={body.immediately}, reason={body.reason})",
        timestamp=now_str
    )
    db.add(audit)
    db.commit()

    return {
        "ok": True,
        "status": sub.status,
        "cancel_at_period_end": sub.cancel_at_period_end,
        "current_period_end": sub.current_period_end,
        "message": "تم تقديم طلب إلغاء الاشتراك بنجاح / Subscription cancellation recorded"
    }


@router.post("/reactivate", summary="Reactivate canceling subscription (Admin only)")
def reactivate_subscription(
    context: TenantContext = Depends(require_permission(PERM_BILLING_MANAGE)),
    db: Session = Depends(get_db)
):
    """
    Reactivates a subscription that was set to cancel at period end.
    """
    sub = ensure_organization_subscription(db, context.organization.id)
    sub.cancel_at_period_end = False
    sub.status = SubscriptionStatus.ACTIVE.value
    sub.updated_at = datetime.datetime.now(datetime.UTC).isoformat()

    db.commit()
    return {"ok": True, "message": "تم إعادة تفعيل الاشتراك بنجاح / Subscription reactivated"}


# ─────────────────────────────────────────────────────────────────────────────
# 4. INVOICES APIS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=List[InvoiceItemResponse], summary="List invoices for current organization")
def list_organization_invoices(
    context: TenantContext = Depends(require_permission(PERM_BILLING_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Returns itemized invoice history strictly scoped to the active tenant.
    Cross-tenant isolation strictly enforced.
    """
    invoices = db.query(models.Invoice).filter(
        models.Invoice.organization_id == context.organization.id
    ).order_by(models.Invoice.issued_at.desc()).all()

    result = []
    for inv in invoices:
        subtotal_min = inv.amount_subtotal_minor_units or int(round((inv.amount_subtotal or 0.0) * 100))
        tax_min = inv.amount_tax_minor_units or int(round((inv.amount_tax or 0.0) * 100))
        total_min = inv.amount_total_minor_units or int(round((inv.amount_total or 0.0) * 100))
        curr = inv.currency or DEFAULT_CURRENCY

        result.append(InvoiceItemResponse(
            id=inv.id,
            invoice_number=inv.invoice_number,
            amount_subtotal_minor_units=subtotal_min,
            amount_tax_minor_units=tax_min,
            amount_total_minor_units=total_min,
            amount_subtotal_formatted=format_currency(subtotal_min, curr),
            amount_tax_formatted=format_currency(tax_min, curr),
            amount_total_formatted=format_currency(total_min, curr),
            currency=curr,
            status=inv.status,
            issued_at=inv.issued_at,
            paid_at=inv.paid_at,
            seller_snapshot_json=inv.seller_snapshot_json,
            buyer_snapshot_json=inv.buyer_snapshot_json
        ))

    return result


@router.get("/invoices/{invoice_id}", response_model=InvoiceItemResponse, summary="Get single invoice details")
def get_invoice_details(
    invoice_id: str,
    context: TenantContext = Depends(require_permission(PERM_BILLING_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Returns single invoice details with tenant isolation checks.
    """
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv or inv.organization_id != context.organization.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الفاتورة غير موجودة / Invoice not found"
        )

    subtotal_min = inv.amount_subtotal_minor_units or int(round((inv.amount_subtotal or 0.0) * 100))
    tax_min = inv.amount_tax_minor_units or int(round((inv.amount_tax or 0.0) * 100))
    total_min = inv.amount_total_minor_units or int(round((inv.amount_total or 0.0) * 100))
    curr = inv.currency or DEFAULT_CURRENCY

    return InvoiceItemResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        amount_subtotal_minor_units=subtotal_min,
        amount_tax_minor_units=tax_min,
        amount_total_minor_units=total_min,
        amount_subtotal_formatted=format_currency(subtotal_min, curr),
        amount_tax_formatted=format_currency(tax_min, curr),
        amount_total_formatted=format_currency(total_min, curr),
        currency=curr,
        status=inv.status,
        issued_at=inv.issued_at,
        paid_at=inv.paid_at,
        seller_snapshot_json=inv.seller_snapshot_json,
        buyer_snapshot_json=inv.buyer_snapshot_json
    )


@router.get("/invoices/{invoice_id}/download", summary="Download invoice PDF or print document")
def download_invoice(
    invoice_id: str,
    context: TenantContext = Depends(require_permission(PERM_BILLING_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Returns printable / downloadable invoice data document.
    Strictly restricted to authorized members of the organization.
    """
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv or inv.organization_id != context.organization.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الفاتورة غير موجودة / Invoice not found"
        )

    subtotal_min = inv.amount_subtotal_minor_units or int(round((inv.amount_subtotal or 0.0) * 100))
    tax_min = inv.amount_tax_minor_units or int(round((inv.amount_tax or 0.0) * 100))
    total_min = inv.amount_total_minor_units or int(round((inv.amount_total or 0.0) * 100))
    curr = inv.currency or DEFAULT_CURRENCY

    return {
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "issued_at": inv.issued_at,
        "paid_at": inv.paid_at,
        "status": inv.status,
        "currency": curr,
        "subtotal_formatted": format_currency(subtotal_min, curr),
        "tax_formatted": format_currency(tax_min, curr),
        "total_formatted": format_currency(total_min, curr),
        "seller": inv.seller_snapshot_json or {
            "legal_name": "منصة بصيرة للبحث العلمي",
            "vat_number": "300000000000003"
        },
        "buyer": inv.buyer_snapshot_json or {
            "organization_name": context.organization.name
        },
        "lines": [
            {
                "description_ar": line.description_ar,
                "description_en": line.description_en,
                "quantity": line.quantity,
                "unit_amount_formatted": format_currency(line.unit_amount_minor_units, curr),
                "total_formatted": format_currency(line.line_total_minor_units, curr)
            } for line in inv.lines
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. PAYMENT GATEWAY WEBHOOK (Public, Verified by Signature)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/webhooks/{provider}", summary="Payment gateway webhook listener with HMAC signature verification")
async def payment_gateway_webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives incoming webhook events from payment gateway (e.g. Moyasar, Stripe, Sandbox).
    Authenticates strictly via HMAC signature on raw body payload.
    Does NOT use user JWT headers.
    Enforces replay protection and idempotency.
    """
    raw_payload = await request.body()
    signature_header = request.headers.get("X-Signature") or request.headers.get("Stripe-Signature") or request.headers.get("X-Moyasar-Signature")

    result = WebhookHandler.process_webhook_event(
        db=db,
        provider=provider,
        raw_payload=raw_payload,
        signature_header=signature_header
    )

    return result
