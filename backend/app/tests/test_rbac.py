import datetime
import secrets

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import OrganizationMembership, Plan, Subscription, User, UserSession
from app.services.rbac import (
    PERM_BILLING_MANAGE,
    PERM_MEMBERS_INVITE,
    PERM_PLATFORM_SETTINGS,
    PERM_PROJECTS_CREATE,
    can_assign_role,
    normalize_org_role,
    permissions_for,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def _non_production_invite_tokens(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")


def _uid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(3)}"


def _raise_member_limit(org_id: str, max_members: int = 25):
    db = SessionLocal()
    sub = db.query(Subscription).filter(Subscription.organization_id == org_id).first()
    if sub:
        plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
        if plan:
            limits = dict(plan.limits_json or {})
            limits["max_members"] = max_members
            plan.limits_json = limits
            db.commit()
    db.close()


def _auth(username: str, email: str, role: str = "Researcher"):
    client.post("/api/auth/register", json={
        "username": username,
        "password": "SecurePassword123",
        "email": email,
        "role": role,
    })
    login = client.post("/api/auth/login", json={"username": username, "password": "SecurePassword123"})
    assert login.status_code == 200, login.text
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    org = client.get("/api/organizations/active", headers=headers)
    assert org.status_code == 200, org.text
    headers["X-Organization-ID"] = org.json()["id"]
    _raise_member_limit(org.json()["id"])
    return headers, org.json()["id"], token


def _invite_and_accept(owner_headers, invitee_headers, email, role):
    invite = client.post(
        "/api/organizations/members/invite",
        json={"email": email, "role": role},
        headers=owner_headers,
    )
    assert invite.status_code == 200, invite.text
    token = invite.json().get("token")
    assert token, invite.json()
    accepted = client.post(
        "/api/organizations/invitations/accept",
        json={"token": token},
        headers=invitee_headers,
    )
    assert accepted.status_code == 200, accepted.text
    return accepted.json()["role"]


def _project_payload(title_en: str):
    return {
        "titleAr": title_en,
        "titleEn": title_en,
        "studyDesign": "quasi_experimental_pre_post",
        "variables": [],
        "questions": [],
        "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }


def test_permission_catalog_least_privilege():
    assert PERM_BILLING_MANAGE not in permissions_for("ORGANIZATION_ADMIN")
    assert PERM_BILLING_MANAGE in permissions_for("OWNER")
    assert PERM_MEMBERS_INVITE not in permissions_for("RESEARCHER")
    assert PERM_MEMBERS_INVITE not in permissions_for("VIEWER")
    assert PERM_PROJECTS_CREATE not in permissions_for("VIEWER")
    assert PERM_PLATFORM_SETTINGS in permissions_for("RESEARCHER", platform_admin=True)
    assert PERM_BILLING_MANAGE not in permissions_for("RESEARCHER", platform_admin=True)
    assert can_assign_role("OWNER", "ORGANIZATION_ADMIN")
    assert not can_assign_role("OWNER", "OWNER")
    assert not can_assign_role("ORGANIZATION_ADMIN", "ORGANIZATION_ADMIN")
    assert can_assign_role("ORGANIZATION_ADMIN", "VIEWER")
    assert normalize_org_role("MEMBER") == "RESEARCHER"
    assert normalize_org_role("ADMIN") == "ORGANIZATION_ADMIN"


def test_me_exposes_org_role_and_permissions():
    name = _uid("rbac_owner")
    headers, org_id, _ = _auth(name, f"{name}@example.com")
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    body = me.json()
    assert body["org_id"] == org_id
    assert body["org_role"] == "OWNER"
    assert body["is_global_admin"] is False
    assert PERM_BILLING_MANAGE in body["permissions"]
    assert PERM_PLATFORM_SETTINGS not in body["permissions"]


def test_viewer_cannot_invite_subscribe_or_create_project():
    owner = _uid("rbac_owner_v")
    viewer = _uid("rbac_viewer")
    owner_headers, owner_org, _ = _auth(owner, f"{owner}@example.com")
    viewer_headers, _, _ = _auth(viewer, f"{viewer}@example.com")
    assigned = _invite_and_accept(owner_headers, viewer_headers, f"{viewer}@example.com", "VIEWER")
    assert assigned == "VIEWER"

    viewer_in_org = {**viewer_headers, "X-Organization-ID": owner_org}

    assert client.post(
        "/api/organizations/members/invite",
        json={"email": f"{_uid('x')}@example.com", "role": "RESEARCHER"},
        headers=viewer_in_org,
    ).status_code == 403
    assert client.post(
        "/api/organizations/billing/subscribe",
        json={"plan_code": "PERSONAL_FREE"},
        headers=viewer_in_org,
    ).status_code == 403
    assert client.get("/api/organizations/billing", headers=viewer_in_org).status_code == 403
    assert client.get("/api/organizations/audit-logs", headers=viewer_in_org).status_code == 403
    assert client.get("/api/organizations/invitations", headers=viewer_in_org).status_code == 403
    assert client.post("/api/projects", json=_project_payload("Forbidden"), headers=viewer_in_org).status_code == 403

    members = client.get("/api/organizations/members", headers=viewer_in_org)
    assert members.status_code == 200
    for row in members.json():
        assert row.get("email") in (None, "")


def test_researcher_cannot_invite_or_hit_platform_admin():
    owner = _uid("rbac_owner_r")
    researcher = _uid("rbac_res")
    owner_headers, owner_org, _ = _auth(owner, f"{owner}@example.com")
    researcher_headers, _, _ = _auth(researcher, f"{researcher}@example.com")
    _invite_and_accept(owner_headers, researcher_headers, f"{researcher}@example.com", "RESEARCHER")
    in_org = {**researcher_headers, "X-Organization-ID": owner_org}

    assert client.post(
        "/api/organizations/members/invite",
        json={"email": f"{_uid('x')}@example.com", "role": "VIEWER"},
        headers=in_org,
    ).status_code == 403
    assert client.post("/api/projects", json=_project_payload("Researcher project"), headers=in_org).status_code == 200
    assert client.get("/api/admin/settings", headers=in_org).status_code == 403


def test_org_admin_cannot_invite_owner_or_manage_billing():
    owner = _uid("rbac_owner_a")
    admin = _uid("rbac_oa")
    owner_headers, owner_org, _ = _auth(owner, f"{owner}@example.com")
    admin_headers, _, _ = _auth(admin, f"{admin}@example.com")
    _invite_and_accept(owner_headers, admin_headers, f"{admin}@example.com", "ORGANIZATION_ADMIN")
    in_org = {**admin_headers, "X-Organization-ID": owner_org}

    assert client.post(
        "/api/organizations/members/invite",
        json={"email": f"{_uid('peer')}@example.com", "role": "OWNER"},
        headers=in_org,
    ).status_code == 400
    assert client.post(
        "/api/organizations/members/invite",
        json={"email": f"{_uid('peer_a')}@example.com", "role": "ORGANIZATION_ADMIN"},
        headers=in_org,
    ).status_code == 400
    assert client.post(
        "/api/organizations/billing/subscribe",
        json={"plan_code": "PERSONAL_FREE"},
        headers=in_org,
    ).status_code == 403
    assert client.get("/api/organizations/billing", headers=in_org).status_code == 200


def test_invite_aliases_and_owner_invite_audit():
    owner = _uid("rbac_alias")
    owner_headers, _, _ = _auth(owner, f"{owner}@example.com")
    invite = client.post(
        "/api/organizations/members/invite",
        json={"email": f"{_uid('alias')}@example.com", "role": "MEMBER"},
        headers=owner_headers,
    )
    assert invite.status_code == 200
    assert invite.json()["role"] == "RESEARCHER"
    logs = client.get("/api/organizations/audit-logs", headers=owner_headers)
    assert logs.status_code == 200
    assert "INVITE_MEMBER" in {row["action"] for row in logs.json()}


def test_cross_tenant_forbidden_even_with_stolen_org_header():
    a = _uid("rbac_iso_a")
    b = _uid("rbac_iso_b")
    a_headers, a_org, _ = _auth(a, f"{a}@example.com")
    b_headers, _, _ = _auth(b, f"{b}@example.com")
    stolen = {**b_headers, "X-Organization-ID": a_org}
    assert client.get("/api/organizations/members", headers=stolen).status_code == 403
    assert client.get("/api/admin/settings", headers=b_headers).status_code == 403


def test_suspended_membership_cannot_use_org():
    owner = _uid("rbac_owner_s")
    member = _uid("rbac_member_s")
    owner_headers, owner_org, _ = _auth(owner, f"{owner}@example.com")
    member_headers, _, _ = _auth(member, f"{member}@example.com")
    _invite_and_accept(owner_headers, member_headers, f"{member}@example.com", "RESEARCHER")

    db = SessionLocal()
    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == owner_org,
        OrganizationMembership.role == "RESEARCHER",
    ).first()
    assert membership is not None
    membership_id = membership.id
    db.close()

    patch = client.patch(
        f"/api/organizations/members/{membership_id}",
        json={"status": "SUSPENDED"},
        headers=owner_headers,
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["status"] == "SUSPENDED"
    blocked = client.get("/api/organizations/active", headers={**member_headers, "X-Organization-ID": owner_org})
    assert blocked.status_code == 403


def test_disabled_account_rejects_login_and_existing_session():
    name = _uid("rbac_disabled")
    headers, _, _ = _auth(name, f"{name}@example.com")
    user_id = client.get("/api/auth/me", headers=headers).json()["id"]

    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    user.account_status = "DISABLED"
    db.commit()
    db.close()

    assert client.get("/api/auth/me", headers=headers).status_code == 403
    assert client.post("/api/auth/login", json={"username": name, "password": "SecurePassword123"}).status_code == 403


def test_expired_session_is_rejected():
    name = _uid("rbac_expired")
    headers, _, token = _auth(name, f"{name}@example.com")
    db = SessionLocal()
    session = db.query(UserSession).filter(UserSession.token == token).first()
    session.expiresAt = (datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1)).isoformat()
    db.commit()
    db.close()
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_platform_admin_can_disable_user_and_cannot_self_disable():
    from app.routers.auth import hash_password

    plat = _uid("rbac_plat")
    target = _uid("rbac_target")
    target_headers, _, _ = _auth(target, f"{target}@example.com")
    target_id = client.get("/api/auth/me", headers=target_headers).json()["id"]

    db = SessionLocal()
    now = datetime.datetime.now(datetime.UTC).isoformat()
    admin = User(
        id=f"usr-{plat}",
        username=plat,
        email=f"{plat}@example.com",
        hashed_password=hash_password("SecurePassword123"),
        role="SystemAdmin",
        account_status="ACTIVE",
        created_at=now,
    )
    db.add(admin)
    admin_id = admin.id
    db.commit()
    db.close()

    login = client.post("/api/auth/login", json={"username": plat, "password": "SecurePassword123"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    org = client.get("/api/organizations/active", headers=headers)
    assert org.status_code == 200, org.text
    headers["X-Organization-ID"] = org.json()["id"]

    denied = client.patch(
        f"/api/admin/users/{admin_id}/status",
        json={"account_status": "DISABLED"},
        headers=headers,
    )
    assert denied.status_code == 400, denied.text

    disabled = client.patch(
        f"/api/admin/users/{target_id}/status",
        json={"account_status": "DISABLED"},
        headers=headers,
    )
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["account_status"] == "DISABLED"
    # Existing sessions are revoked, so the previous bearer token is invalid.
    assert client.get("/api/auth/me", headers=target_headers).status_code in {401, 403}
    assert client.post("/api/auth/login", json={"username": target, "password": "SecurePassword123"}).status_code == 403
