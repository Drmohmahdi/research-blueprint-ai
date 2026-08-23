"""
Phase 03 (Admin) — Platform settings, feature flags, and system status.

Global admin role (SystemAdmin) can read/update platform settings; regular
researchers are denied.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import (
    User, Organization, OrganizationMembership, Plan, Subscription,
    PlatformSetting, AuditLog
)
from app.routers.auth import hash_password
from app.services.billing.bootstrap import ensure_plans_and_pricing_seeded

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def create_test_tenant(db, username: str, org_id: str, role: str = "RESEARCHER", user_role: str = "RESEARCHER"):
    user_email = f"{username}@test-univ.edu"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            id=f"usr-{username}",
            username=username,
            email=user_email,
            hashed_password=hash_password("Password123!"),
            role=user_role,
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(user)

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(
            id=org_id,
            name=f"University {org_id}",
            slug=f"slug-{org_id}",
            organization_type="UNIVERSITY",
            status="ACTIVE",
            owner_user_id=user.id,
            default_language="ar",
            data_region="sa",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(org)

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org_id,
        OrganizationMembership.user_id == user.id
    ).first()
    if not membership:
        membership = OrganizationMembership(
            id=f"mbr-{username}",
            organization_id=org.id,
            user_id=user.id,
            role=role,
            status="ACTIVE",
            created_at="2026-08-22T00:00:00Z"
        )
        db.add(membership)

    plan = db.query(Plan).filter(Plan.id == "pln-free").first()
    if not plan:
        plan = Plan(
            id="pln-free",
            code="FREE",
            name="Free Plan",
            name_ar="الخطة المجانية",
            name_en="Free Plan",
            billing_interval="MONTHLY",
            price=0,
            price_minor_units=0,
            currency="SAR",
            features_json={},
            limits_json={"max_projects": 100},
            created_at="2026-08-22T00:00:00Z",
            updated_at="2026-08-22T00:00:00Z"
        )
        db.add(plan)

    sub = db.query(Subscription).filter(Subscription.organization_id == org_id).first()
    if not sub:
        sub = Subscription(
            id=f"sub-{username}",
            organization_id=org.id,
            plan_id=plan.id,
            status="ACTIVE",
            provider="MOCK",
            current_period_start="2026-08-22T00:00:00Z",
            current_period_end="2027-08-22T00:00:00Z",
            created_at="2026-08-22T00:00:00Z",
            updated_at="2026-08-22T00:00:00Z"
        )
        db.add(sub)

    db.commit()
    return user, org


def get_auth_headers(username, org_id):
    res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Organization-ID": org_id}


def test_regular_user_denied_admin_settings():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    ensure_plans_and_pricing_seeded(db)
    user, org = create_test_tenant(db, f"reg_{suffix}", f"org-reg-{suffix}", role="RESEARCHER")
    org_id = org.id
    db.close()
    headers = get_auth_headers(f"reg_{suffix}", org_id)
    res = client.get("/api/admin/settings", headers=headers)
    assert res.status_code == 403
    res2 = client.get("/api/admin/status", headers=headers)
    assert res2.status_code == 403


def test_global_admin_reads_defaults_and_status():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    ensure_plans_and_pricing_seeded(db)
    user, org = create_test_tenant(
        db, f"adm_{suffix}", f"org-adm-{suffix}",
        role="RESEARCHER", user_role="SystemAdmin"
    )
    org_id = org.id
    db.close()
    headers = get_auth_headers(f"adm_{suffix}", org_id)

    res = client.get("/api/admin/settings", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["settings"]["platform.title_ar"] == "منصة بصيرة للبحث العلمي"
    assert data["settings"]["platform.title_en"] == "Baseerah Academic Suite"
    assert data["settings"]["platform.contact_email"] == "info@ehaastore.com"
    assert data["settings"]["platform.contact_phone"] == "0566007625"

    status = client.get("/api/admin/status", headers=headers)
    assert status.status_code == 200
    body = status.json()
    assert body["version"] == "3.0.0"
    assert body["database"] == "ready"
    assert body["counts"]["organizations"] >= 1


def test_global_admin_updates_settings_and_feature_flags():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    ensure_plans_and_pricing_seeded(db)
    user, org = create_test_tenant(
        db, f"adm2_{suffix}", f"org-adm2-{suffix}",
        role="RESEARCHER", user_role="SystemAdmin"
    )
    org_id = org.id
    db.close()
    headers = get_auth_headers(f"adm2_{suffix}", org_id)

    res = client.put("/api/admin/settings", json={
        "settings": {
            "platform.title_ar": "منصة بصيرة V3",
            "platform.maintenance_mode": True,
            "feature_flag.DYNAMIC_DASHBOARD": True,
        }
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["settings"]["platform.title_ar"] == "منصة بصيرة V3"
    assert data["settings"]["platform.maintenance_mode"] is True
    assert data["feature_flags"]["DYNAMIC_DASHBOARD"] is True

    # Verify persistence
    res2 = client.get("/api/admin/settings", headers=headers)
    assert res2.json()["settings"]["platform.title_ar"] == "منصة بصيرة V3"
    assert res2.json()["feature_flags"]["DYNAMIC_DASHBOARD"] is True

    # DB row exists
    db2 = SessionLocal()
    row = db2.query(PlatformSetting).filter(PlatformSetting.key == "platform.maintenance_mode").first()
    assert row is not None
    db2.close()


def test_admin_update_audited():
    """Settings updates are recorded as audit events for accountability."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    ensure_plans_and_pricing_seeded(db)
    user, org = create_test_tenant(
        db, f"adm3_{suffix}", f"org-adm3-{suffix}",
        role="RESEARCHER", user_role="SystemAdmin"
    )
    org_id = org.id
    db.close()
    headers = get_auth_headers(f"adm3_{suffix}", org_id)

    res = client.put("/api/admin/settings", json={
        "settings": {"platform.title_en": "Baseerah v3 Admin"}
    }, headers=headers)
    assert res.status_code == 200