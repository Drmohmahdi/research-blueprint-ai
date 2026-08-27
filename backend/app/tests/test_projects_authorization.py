"""
projects.py — same-tenant horizontal authorization regression.

Discovered during the Cross-Domain IAM Consolidation: get_project,
update_project, delete_project, list_projects, update_project_workflow_profile
and create_manuscript_from_project previously checked only
organizationId == caller's org — no ownership or ResearchProjectMember
relationship check at all. Any authenticated member of an organization could
view, fully overwrite, or delete any other member's research project.
"""
import datetime
import uuid

import pytest
from fastapi.testclient import TestClient

from app import models
from app.db import SessionLocal
from app.main import app
from app.routers.auth import hash_password

client = TestClient(app)


def stamp() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def create_tenant(db, username: str, org_id: str, role: str = "OWNER", existing_org=None):
    suffix = uuid.uuid4().hex[:6]
    user = models.User(
        id=f"usr-{username}-{suffix}", username=username,
        email=f"{username}-{suffix}@test-univ.edu",
        hashed_password=hash_password("Password123!"), role="Researcher", created_at=stamp(),
    )
    db.add(user)

    if existing_org:
        org = existing_org
    else:
        org = models.Organization(
            id=org_id, name=f"University {org_id}", slug=f"slug-{org_id}",
            organization_type="UNIVERSITY", status="ACTIVE", owner_user_id=user.id,
            default_language="ar", data_region="sa", created_at=stamp(),
        )
        db.add(org)
        db.flush()

    db.add(models.OrganizationMembership(
        id=f"mbr-{username}-{suffix}", organization_id=org.id, user_id=user.id,
        role=role, status="ACTIVE", created_at=stamp(),
    ))

    if not db.query(models.Plan).filter(models.Plan.id == "pln-free").first():
        db.add(models.Plan(
            id="pln-free", code="FREE", name="Free Plan", name_ar="الخطة المجانية", name_en="Free Plan",
            billing_interval="MONTHLY", price=0, price_minor_units=0, currency="SAR",
            features_json={}, limits_json={"max_projects": 100}, created_at=stamp(),
        ))
    if not db.query(models.Subscription).filter(models.Subscription.organization_id == org.id).first():
        db.add(models.Subscription(
            id=f"sub-{org.id}", organization_id=org.id, plan_id="pln-free",
            status="ACTIVE", provider="MOCK", current_period_start=stamp(),
            current_period_end="2036-08-25T00:00:00Z", created_at=stamp(),
        ))
    db.commit()
    return user, org


def get_auth_headers(username: str, org_id: str) -> dict:
    res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Organization-ID": org_id}


@pytest.fixture
def tenants():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    org_id = f"proj-authz-org-{suffix}"
    owner, org = create_tenant(db, f"authz_owner_{suffix}", org_id, role="OWNER")
    colleague, _ = create_tenant(db, f"authz_col_{suffix}", org_id, role="RESEARCHER", existing_org=org)
    admin, _ = create_tenant(db, f"authz_admin_{suffix}", org_id, role="ORGANIZATION_ADMIN", existing_org=org)
    pi, _ = create_tenant(db, f"authz_pi_{suffix}", org_id, role="RESEARCHER", existing_org=org)

    headers_owner = get_auth_headers(owner.username, org.id)
    headers_colleague = get_auth_headers(colleague.username, org.id)
    headers_admin = get_auth_headers(admin.username, org.id)
    headers_pi = get_auth_headers(pi.username, org.id)

    project_res = client.post("/api/projects", json={
        "titleAr": "مشروع بحثي", "titleEn": "Research Project",
        "studyDesign": "quasi_experimental_pre_post", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=headers_owner)
    assert project_res.status_code == 200
    project_id = project_res.json()["id"]

    db.add(models.ResearchProjectMember(
        id=f"proj-mem-{suffix}", organization_id=org.id, project_id=project_id,
        user_id=pi.id, relationship="PI", status="ACTIVE", created_at=stamp(),
    ))
    db.commit()

    data = {
        "db": db, "org": org, "owner": owner, "colleague": colleague, "admin": admin, "pi": pi,
        "headers_owner": headers_owner, "headers_colleague": headers_colleague,
        "headers_admin": headers_admin, "headers_pi": headers_pi, "project_id": project_id,
    }
    yield data
    db.close()


def test_same_org_colleague_with_no_relationship_cannot_view_project(tenants):
    r = client.get(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_colleague"])
    assert r.status_code == 404


def test_same_org_colleague_with_no_relationship_cannot_update_project(tenants):
    r = client.put(f"/api/projects/{tenants['project_id']}", json={
        "titleAr": "استيلاء", "titleEn": "Hijacked", "studyDesign": "quasi_experimental_pre_post",
        "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=tenants["headers_colleague"])
    assert r.status_code == 404


def test_same_org_colleague_with_no_relationship_cannot_delete_project(tenants):
    r = client.delete(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_colleague"])
    assert r.status_code == 404


def test_same_org_colleague_with_no_relationship_does_not_see_project_in_list(tenants):
    r = client.get("/api/projects", headers=tenants["headers_colleague"])
    assert r.status_code == 200
    assert tenants["project_id"] not in [p["id"] for p in r.json()]


def test_organization_admin_without_relationship_cannot_view_or_edit_project(tenants):
    r_get = client.get(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_admin"])
    assert r_get.status_code == 404
    r_put = client.put(f"/api/projects/{tenants['project_id']}", json={
        "titleAr": "استيلاء", "titleEn": "Hijacked", "studyDesign": "quasi_experimental_pre_post",
        "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=tenants["headers_admin"])
    assert r_put.status_code == 404


def test_organization_admin_without_relationship_cannot_create_manuscript(tenants):
    r = client.post(f"/api/projects/{tenants['project_id']}/create-manuscript", headers=tenants["headers_admin"])
    assert r.status_code == 404


def test_pi_relationship_can_view_and_update_but_not_delete(tenants):
    r_get = client.get(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_pi"])
    assert r_get.status_code == 200

    r_put = client.put(f"/api/projects/{tenants['project_id']}", json={
        "titleAr": "تحديث شرعي", "titleEn": "Legitimate Update", "studyDesign": "quasi_experimental_pre_post",
        "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=tenants["headers_pi"])
    assert r_put.status_code == 200
    assert r_put.json()["titleEn"] == "Legitimate Update"

    r_delete = client.delete(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_pi"])
    assert r_delete.status_code == 403


def test_owner_retains_full_crud(tenants):
    r_get = client.get(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_owner"])
    assert r_get.status_code == 200
    r_put = client.put(f"/api/projects/{tenants['project_id']}", json={
        "titleAr": "تحديث المالك", "titleEn": "Owner Update", "studyDesign": "quasi_experimental_pre_post",
        "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=tenants["headers_owner"])
    assert r_put.status_code == 200
    r_delete = client.delete(f"/api/projects/{tenants['project_id']}", headers=tenants["headers_owner"])
    assert r_delete.status_code == 204
