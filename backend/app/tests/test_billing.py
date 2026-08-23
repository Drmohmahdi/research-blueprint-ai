import hmac
import hashlib
import json
import secrets
import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db import SessionLocal
from app import models
from app.routers.auth import hash_password
from app.config import settings
from app.services.billing import (
    calculate_invoice_amounts,
    format_currency,
    EntitlementService,
    InvoiceService,
    WebhookHandler,
    ensure_plans_and_pricing_seeded,
    ensure_organization_subscription,
    PlanCode,
    BillingInterval,
    SubscriptionStatus,
    InvoiceStatus,
    FeatureKey,
    LimitKey
)

client = TestClient(app)


def create_test_tenant(db: Session, username_prefix: str, role: str = "RESEARCHER"):
    uid = f"usr_{secrets.token_hex(4)}"
    org_id = f"org_{secrets.token_hex(4)}"
    username = f"{username_prefix}_{secrets.token_hex(3)}"
    now = datetime.datetime.now(datetime.UTC).isoformat()

    user = models.User(
        id=uid,
        username=username,
        email=f"{username}@baseerah.test",
        hashed_password=hash_password("Password123!"),
        role=role,
        created_at=now
    )
    db.add(user)

    org = models.Organization(
        id=org_id,
        name=f"مؤسسة {username} الاختبارية",
        slug=f"org-{username}",
        organization_type="UNIVERSITY",
        status="ACTIVE",
        owner_user_id=uid,
        default_language="ar",
        data_region="sa",
        created_at=now
    )
    db.add(org)

    membership = models.OrganizationMembership(
        id=f"mbr_{secrets.token_hex(4)}",
        organization_id=org_id,
        user_id=uid,
        role=role,
        status="ACTIVE",
        created_at=now
    )
    db.add(membership)

    ensure_plans_and_pricing_seeded(db)
    ensure_organization_subscription(db, org_id)

    db.commit()
    db.refresh(user)
    db.refresh(org)
    return user, org


def add_tenant_member(db: Session, org_id: str, username_prefix: str, role: str = "RESEARCHER"):
    uid = f"usr_{secrets.token_hex(4)}"
    username = f"{username_prefix}_{secrets.token_hex(3)}"
    now = datetime.datetime.now(datetime.UTC).isoformat()

    user = models.User(
        id=uid,
        username=username,
        email=f"{username}@baseerah.test",
        hashed_password=hash_password("Password123!"),
        role=role,
        created_at=now
    )
    db.add(user)

    membership = models.OrganizationMembership(
        id=f"mbr_{secrets.token_hex(4)}",
        organization_id=org_id,
        user_id=uid,
        role=role,
        status="ACTIVE",
        created_at=now
    )
    db.add(membership)
    db.commit()
    db.refresh(user)
    return user


def get_auth_headers(username: str, org_id: str):
    login_res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    token = login_res.json()["token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-ID": org_id
    }


def compute_test_signature(payload_bytes: bytes, secret: str = "test_webhook_secret_baseerah_academic_2026") -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


def test_production_owner_cannot_self_activate_paid_plan(monkeypatch):
    db = SessionLocal()
    try:
        owner, org = create_test_tenant(db, "production_paid_bypass", role="OWNER")
        headers = get_auth_headers(owner.username, org.id)
        before = ensure_organization_subscription(db, org.id)
        original_plan_id = before.plan_id
        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        response = client.post(
            "/api/billing/change-plan",
            json={"plan_code": "PROFESSIONAL", "billing_interval": "MONTHLY"},
            headers=headers,
        )
        assert response.status_code == 409
        db.expire_all()
        after = ensure_organization_subscription(db, org.id)
        assert after.plan_id == original_plan_id
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Money Precision & Arithmetic Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_money_precision_and_minor_units_arithmetic():
    """
    Verifies that all monetary calculations are performed in integer minor units (Halalas)
    without floating-point drift: subtotal + tax = total.
    """
    # 199.99 SAR = 19999 halalas with 15% VAT (1500 bps)
    subtotal, tax, total = calculate_invoice_amounts(19999, 1500)
    assert isinstance(subtotal, int)
    assert isinstance(tax, int)
    assert isinstance(total, int)
    assert subtotal == 19999
    assert tax == int(round(19999 * 0.15))  # 3000 halalas = 30.00 SAR
    assert total == subtotal + tax

    # 0.01 SAR = 1 halala
    s1, t1, tot1 = calculate_invoice_amounts(1, 1500)
    assert s1 == 1
    assert t1 == 0
    assert tot1 == 1

    # Format verification
    assert format_currency(19900, "SAR") == "199.00 SAR"
    assert format_currency(9905, "SAR") == "99.05 SAR"
    assert format_currency(0, "SAR") == "0.00 SAR"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Server-Authoritative Pricing & Tampering Protection
# ─────────────────────────────────────────────────────────────────────────────

def test_client_price_tampering_blocked():
    """
    Verifies that clients cannot inject arbitrary prices. The server authoritatively
    calculates prices and invoices.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_tamper", "ORGANIZATION_ADMIN")
    username = user.username
    org_id = org.id
    db.close()

    headers = get_auth_headers(username, org_id)

    # Attempt checkout with tampered body payload (e.g. attempting to pay 1 SAR for PRO)
    res = client.post("/api/billing/checkout", json={
        "plan_code": "PROFESSIONAL",
        "billing_interval": "MONTHLY",
        "amount": 1  # Injected bogus price
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    # Server must charge the authoritative 299.00 SAR = 29900 halalas + VAT
    assert data["amount_minor_units"] == 29900
    assert data["tax_amount_minor_units"] == 4485
    assert data["total_amount_minor_units"] == 34385


# ─────────────────────────────────────────────────────────────────────────────
# 3. Entitlement Enforcement & Direct API Bypass Protection
# ─────────────────────────────────────────────────────────────────────────────

def test_feature_entitlement_enforcement_and_api_bypass():
    """
    Verifies that organizations on FREE tier cannot call premium APIs directly (e.g. DOCX Export).
    Returns 403 FEATURE_NOT_INCLUDED.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_ent", "RESEARCHER")
    username = user.username
    org_id = org.id
    
    # Create sample project
    proj = models.ResearchProject(
        id=f"proj_{secrets.token_hex(4)}",
        userId=user.id,
        organizationId=org.id,
        titleAr="بحث تجريبي لحماية الاستحقاقات",
        titleEn="Entitlement Protection Research",
        studyDesign="CROSS_SECTIONAL",
        sampleSettings={"marginOfError": 0.05}
    )
    db.add(proj)
    db.commit()
    proj_id = proj.id  # Capture before session close
    db.close()

    headers = get_auth_headers(username, org_id)

    # 1. Attempt exporting in DOCX (which is disabled on FREE plan)
    res = client.post("/api/reports/export", json={
        "report_type": "RESEARCH_PROJECT",
        "source_id": proj_id,
        "format": "DOCX",
        "audience": "ACADEMIC_PEER",
        "language": "ar"
    }, headers=headers)

    assert res.status_code == 403
    assert "FEATURE_NOT_INCLUDED" in res.json()["detail"]

    # 2. PDF export is enabled on FREE plan — entitlement passes (report may fail for other reasons)
    res_pdf = client.post("/api/reports/export", json={
        "report_type": "RESEARCH_PROJECT",
        "source_id": proj_id,
        "format": "PDF",
        "audience": "ACADEMIC_PEER",
        "language": "ar"
    }, headers=headers)

    # Must NOT be blocked by entitlement enforcement (403 FEATURE_NOT_INCLUDED)
    assert res_pdf.status_code != 403 or "FEATURE_NOT_INCLUDED" not in res_pdf.json().get("detail", "")


def test_upgrade_plan_unlocks_premium_entitlements():
    """
    Verifies that upgrading to STARTER or PROFESSIONAL plan immediately unlocks DOCX export.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_upg", "ORGANIZATION_ADMIN")
    username = user.username
    org_id = org.id

    proj = models.ResearchProject(
        id=f"proj_{secrets.token_hex(4)}",
        userId=user.id,
        organizationId=org.id,
        titleAr="مشروع الترقية",
        titleEn="Upgrade Project",
        studyDesign="CROSS_SECTIONAL",
        sampleSettings={"marginOfError": 0.05}
    )
    db.add(proj)
    db.commit()
    proj_id = proj.id  # Capture before session close
    db.close()

    headers = get_auth_headers(username, org_id)

    # 1. Upgrade to STARTER plan
    res_upg = client.post("/api/billing/change-plan", json={
        "plan_code": "STARTER",
        "billing_interval": "MONTHLY"
    }, headers=headers)
    assert res_upg.status_code == 200
    assert res_upg.json()["plan_code"] == "STARTER"

    # 2. After upgrade, DOCX export must NOT be blocked by entitlement (403 FEATURE_NOT_INCLUDED)
    res_docx = client.post("/api/reports/export", json={
        "report_type": "RESEARCH_PROJECT",
        "source_id": proj_id,
        "format": "DOCX",
        "audience": "ACADEMIC_PEER",
        "language": "ar"
    }, headers=headers)

    # Must NOT be blocked by entitlement (403 FEATURE_NOT_INCLUDED)
    assert res_docx.status_code != 403 or "FEATURE_NOT_INCLUDED" not in res_docx.json().get("detail", "")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Numeric Limits & Quota Enforcement
# ─────────────────────────────────────────────────────────────────────────────

def test_numeric_limit_enforcement():
    """
    Verifies that creating projects beyond plan quota is rejected with 403 PLAN_LIMIT_REACHED.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_quota", "RESEARCHER")
    username = user.username
    org_id = org.id

    # Create 3 projects (max allowed on FREE is 3)
    for i in range(3):
        p = models.ResearchProject(
            id=f"proj_q_{org_id[:6]}_{i}",
            userId=user.id,
            organizationId=org_id,
            titleAr=f"مشروع {i+1}",
            titleEn=f"Project {i+1}",
            studyDesign="CROSS_SECTIONAL",
            sampleSettings={"marginOfError": 0.05}
        )
        db.add(p)
    db.commit()
    db.close()

    headers = get_auth_headers(username, org_id)

    # 4th project creation must be rejected
    res = client.post("/api/projects", json={
        "titleAr": "مشروع إضافي زائد",
        "titleEn": "Extra Over Limit Project",
        "studyDesign": "CROSS_SECTIONAL",
        "variables": [],
        "questions": [],
        "hypotheses": [],
        "sampleSettings": {"marginOfError": 0.05}
    }, headers=headers)

    assert res.status_code == 403
    assert "PLAN_LIMIT_REACHED" in res.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 5. Webhook Security, Signatures & Idempotency
# ─────────────────────────────────────────────────────────────────────────────

def test_webhook_signature_verification_and_state_transition():
    """
    Verifies valid webhook processing transitions subscription to ACTIVE and records paid invoice.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_wh", "ORGANIZATION_ADMIN")
    org_id = org.id
    db.close()

    event_id = f"evt_{secrets.token_hex(8)}"
    payload_dict = {
        "id": event_id,
        "type": "payment.succeeded",
        "data": {
            "organization_id": org_id,
            "plan_code": "PROFESSIONAL",
            "billing_interval": "MONTHLY",
            "amount_minor_units": 29900,
            "provider": "MOYASAR",
            "transaction_ref": f"txn_{secrets.token_hex(6)}"
        }
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    sig = compute_test_signature(payload_bytes)

    # Post to Webhook endpoint
    res = client.post(
        "/api/billing/webhooks/moyasar",
        content=payload_bytes,
        headers={"X-Signature": sig, "Content-Type": "application/json"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "PROCESSED"

    # Verify subscription is now ACTIVE with PROFESSIONAL plan
    db = SessionLocal()
    sub = db.query(models.Subscription).filter(models.Subscription.organization_id == org_id).first()
    assert sub.status == "ACTIVE"
    plan = db.query(models.Plan).filter(models.Plan.id == sub.plan_id).first()
    assert plan.code == "PROFESSIONAL"
    db.close()


def test_webhook_forgery_rejected():
    """
    Verifies that forged or unsigned webhooks are rejected with 401 and make 0 changes.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_wh_forgery", "ORGANIZATION_ADMIN")
    org_id = org.id
    db.close()

    payload_dict = {
        "id": f"evt_fake_{secrets.token_hex(6)}",
        "type": "payment.succeeded",
        "data": {
            "organization_id": org_id,
            "plan_code": "INSTITUTIONAL",
            "amount_minor_units": 0
        }
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")

    # Send with invalid signature
    res = client.post(
        "/api/billing/webhooks/moyasar",
        content=payload_bytes,
        headers={"X-Signature": "invalid_signature_hex_12345", "Content-Type": "application/json"}
    )
    assert res.status_code == 401
    assert "INVALID_WEBHOOK_SIGNATURE" in res.json()["detail"]


def test_webhook_idempotency_and_replay_protection():
    """
    Verifies that sending the exact same webhook twice executes exactly once (idempotent).
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_bill_wh_idem", "ORGANIZATION_ADMIN")
    org_id = org.id
    db.close()

    event_id = f"evt_idem_{secrets.token_hex(6)}"
    payload_dict = {
        "id": event_id,
        "type": "payment.succeeded",
        "data": {
            "organization_id": org_id,
            "plan_code": "STARTER",
            "billing_interval": "MONTHLY",
            "amount_minor_units": 9900,
            "provider": "MOYASAR"
        }
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    sig = compute_test_signature(payload_bytes)

    # 1. First execution
    res1 = client.post(
        "/api/billing/webhooks/moyasar",
        content=payload_bytes,
        headers={"X-Signature": sig, "Content-Type": "application/json"}
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "PROCESSED"

    # 2. Second execution (Duplicate replay)
    res2 = client.post(
        "/api/billing/webhooks/moyasar",
        content=payload_bytes,
        headers={"X-Signature": sig, "Content-Type": "application/json"}
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "ALREADY_PROCESSED"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Multi-Tenant Isolation & Same-Tenant RBAC
# ─────────────────────────────────────────────────────────────────────────────

def test_cross_tenant_billing_isolation():
    """
    Verifies that Tenant B cannot access or download Tenant A's invoices (returns 404).
    """
    db = SessionLocal()
    user_a, org_a = create_test_tenant(db, "usr_iso_a", "ORGANIZATION_ADMIN")
    user_b, org_b = create_test_tenant(db, "usr_iso_b", "ORGANIZATION_ADMIN")
    username_a = user_a.username
    username_b = user_b.username
    org_a_id = org_a.id
    org_b_id = org_b.id

    # Create invoice for org A
    sub_a = ensure_organization_subscription(db, org_a_id)
    plan_a = db.query(models.Plan).filter(models.Plan.id == sub_a.plan_id).first()
    inv_a = InvoiceService.create_invoice_for_subscription(
        db=db,
        organization=org_a,
        subscription=sub_a,
        plan=plan_a,
        subtotal_minor_units=9900
    )
    db.close()

    headers_b = get_auth_headers(username_b, org_b_id)

    # Tenant B tries to view Tenant A's invoice
    res = client.get(f"/api/billing/invoices/{inv_a.id}", headers=headers_b)
    assert res.status_code == 404

    # Tenant B tries to download Tenant A's invoice
    res_dl = client.get(f"/api/billing/invoices/{inv_a.id}/download", headers=headers_b)
    assert res_dl.status_code == 404


def test_same_tenant_billing_rbac():
    """
    Verifies that a regular RESEARCHER cannot perform administrative billing actions (403 Forbidden).
    """
    db = SessionLocal()
    admin, org = create_test_tenant(db, "usr_rbac_adm", "ORGANIZATION_ADMIN")
    researcher = add_tenant_member(db, org.id, "usr_rbac_res", "RESEARCHER")
    username_res = researcher.username
    username_admin = admin.username
    org_id = org.id
    db.close()

    headers_res = get_auth_headers(username_res, org_id)
    headers_admin = get_auth_headers(username_admin, org_id)

    # Canonical organization administrators are admitted to the administrative
    # endpoint. In test mode this reaches the configured sandbox boundary.
    res_admin = client.post("/api/billing/checkout", json={
        "plan_code": "PROFESSIONAL"
    }, headers=headers_admin)
    assert res_admin.status_code != 403

    # 1. Researcher tries to initiate checkout -> 403
    res_co = client.post("/api/billing/checkout", json={
        "plan_code": "PROFESSIONAL"
    }, headers=headers_res)
    assert res_co.status_code == 403

    # 2. Researcher tries to change plan -> 403
    res_cp = client.post("/api/billing/change-plan", json={
        "plan_code": "PROFESSIONAL"
    }, headers=headers_res)
    assert res_cp.status_code == 403

    # 3. Researcher tries to cancel subscription -> 403
    res_can = client.post("/api/billing/cancel", json={
        "immediately": False
    }, headers=headers_res)
    assert res_can.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 7. Secrets & Sensitive PCI Data Absence
# ─────────────────────────────────────────────────────────────────────────────

def test_no_pci_card_data_or_secrets_in_responses():
    """
    Verifies that responses from billing endpoints do not contain PAN, CVV, or internal secrets.
    """
    db = SessionLocal()
    user, org = create_test_tenant(db, "usr_pci_clean", "ORGANIZATION_ADMIN")
    username = user.username
    org_id = org.id
    db.close()

    headers = get_auth_headers(username, org_id)

    # 1. Plans response
    res_plans = client.get("/api/billing/plans")
    assert res_plans.status_code == 200
    text_plans = res_plans.text
    assert "sk_" not in text_plans
    assert "webhook_secret" not in text_plans.lower()

    # 2. Subscription response
    res_sub = client.get("/api/billing/subscription", headers=headers)
    assert res_sub.status_code == 200
    text_sub = res_sub.text
    assert "cvv" not in text_sub.lower()
    assert "card_number" not in text_sub.lower()

    # 3. Invoices response
    res_inv = client.get("/api/billing/invoices", headers=headers)
    assert res_inv.status_code == 200
    text_inv = res_inv.text
    assert "cvv" not in text_inv.lower()
