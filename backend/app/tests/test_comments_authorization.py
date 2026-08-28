"""
comments.py — project-relationship authorization regression.

Discovered during the full-platform audit following the Cross-Domain IAM
Consolidation: create_comment, list_project_comments, resolve_comment and
delete_comment all checked only organizationId == caller's org — the same
"resource-scoped authority" gap already fixed for ResearchProject CRUD in
projects.py. Any authenticated member of an organization could read, post,
resolve, or delete comments on any other member's project.
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
    org_id = f"comment-authz-org-{suffix}"
    owner, org = create_tenant(db, f"cauthz_owner_{suffix}", org_id, role="OWNER")
    colleague, _ = create_tenant(db, f"cauthz_col_{suffix}", org_id, role="RESEARCHER", existing_org=org)
    admin, _ = create_tenant(db, f"cauthz_admin_{suffix}", org_id, role="ORGANIZATION_ADMIN", existing_org=org)
    pi, _ = create_tenant(db, f"cauthz_pi_{suffix}", org_id, role="RESEARCHER", existing_org=org)
    assistant, _ = create_tenant(db, f"cauthz_asst_{suffix}", org_id, role="RESEARCHER", existing_org=org)

    headers_owner = get_auth_headers(owner.username, org.id)
    headers_colleague = get_auth_headers(colleague.username, org.id)
    headers_admin = get_auth_headers(admin.username, org.id)
    headers_pi = get_auth_headers(pi.username, org.id)
    headers_assistant = get_auth_headers(assistant.username, org.id)

    project_res = client.post("/api/projects", json={
        "titleAr": "مشروع بحثي", "titleEn": "Research Project",
        "studyDesign": "quasi_experimental_pre_post", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=headers_owner)
    assert project_res.status_code == 200
    project_id = project_res.json()["id"]

    db.add(models.ResearchProjectMember(
        id=f"proj-mem-pi-{suffix}", organization_id=org.id, project_id=project_id,
        user_id=pi.id, relationship="PI", status="ACTIVE", created_at=stamp(),
    ))
    db.add(models.ResearchProjectMember(
        id=f"proj-mem-asst-{suffix}", organization_id=org.id, project_id=project_id,
        user_id=assistant.id, relationship="RESEARCH_ASSISTANT", status="ACTIVE", created_at=stamp(),
    ))
    db.commit()

    data = {
        "db": db, "org": org, "owner": owner, "colleague": colleague, "admin": admin,
        "pi": pi, "assistant": assistant,
        "headers_owner": headers_owner, "headers_colleague": headers_colleague,
        "headers_admin": headers_admin, "headers_pi": headers_pi, "headers_assistant": headers_assistant,
        "project_id": project_id,
    }
    yield data
    db.close()


def _create_comment(headers, project_id, content="تعليق تجريبي"):
    return client.post("/api/comments/", json={"projectId": project_id, "contentAr": content}, headers=headers)


def test_same_org_colleague_with_no_relationship_cannot_create_comment(tenants):
    r = _create_comment(tenants["headers_colleague"], tenants["project_id"])
    assert r.status_code == 404


def test_same_org_colleague_with_no_relationship_cannot_list_comments(tenants):
    r = client.get(f"/api/comments/project/{tenants['project_id']}", headers=tenants["headers_colleague"])
    assert r.status_code == 404


def test_organization_admin_without_relationship_cannot_create_or_view_comments(tenants):
    r_create = _create_comment(tenants["headers_admin"], tenants["project_id"])
    assert r_create.status_code == 404
    r_list = client.get(f"/api/comments/project/{tenants['project_id']}", headers=tenants["headers_admin"])
    assert r_list.status_code == 404


def test_pi_relationship_can_create_view_and_resolve_comment(tenants):
    r_create = _create_comment(tenants["headers_pi"], tenants["project_id"])
    assert r_create.status_code == 200
    comment_id = r_create.json()["id"]

    r_list = client.get(f"/api/comments/project/{tenants['project_id']}", headers=tenants["headers_pi"])
    assert r_list.status_code == 200
    assert comment_id in [c["id"] for c in r_list.json()]

    r_resolve = client.patch(f"/api/comments/{comment_id}/resolve", json={"resolved": True}, headers=tenants["headers_pi"])
    assert r_resolve.status_code == 200
    assert r_resolve.json()["resolved"] is True


def test_colleague_without_relationship_cannot_resolve_or_delete_existing_comment(tenants):
    r_create = _create_comment(tenants["headers_pi"], tenants["project_id"])
    comment_id = r_create.json()["id"]

    r_resolve = client.patch(f"/api/comments/{comment_id}/resolve", json={"resolved": True}, headers=tenants["headers_colleague"])
    assert r_resolve.status_code == 404

    r_delete = client.delete(f"/api/comments/{comment_id}", headers=tenants["headers_colleague"])
    assert r_delete.status_code == 404


def test_research_assistant_can_create_and_delete_own_comment_but_not_others(tenants):
    # Assistant has an active relationship (non edit-capable) — can comment.
    r_create = _create_comment(tenants["headers_assistant"], tenants["project_id"])
    assert r_create.status_code == 200
    own_comment_id = r_create.json()["id"]

    # Assistant may delete their own comment.
    r_delete_own = client.delete(f"/api/comments/{own_comment_id}", headers=tenants["headers_assistant"])
    assert r_delete_own.status_code == 200

    # But not the PI's comment — assistant is not edit-capable and isn't the author.
    r_pi_comment = _create_comment(tenants["headers_pi"], tenants["project_id"])
    pi_comment_id = r_pi_comment.json()["id"]
    r_delete_other = client.delete(f"/api/comments/{pi_comment_id}", headers=tenants["headers_assistant"])
    assert r_delete_other.status_code == 403


def test_owner_retains_full_crud(tenants):
    r_create = _create_comment(tenants["headers_owner"], tenants["project_id"])
    assert r_create.status_code == 200
    comment_id = r_create.json()["id"]

    r_list = client.get(f"/api/comments/project/{tenants['project_id']}", headers=tenants["headers_owner"])
    assert r_list.status_code == 200

    r_resolve = client.patch(f"/api/comments/{comment_id}/resolve", json={"resolved": True}, headers=tenants["headers_owner"])
    assert r_resolve.status_code == 200

    r_delete = client.delete(f"/api/comments/{comment_id}", headers=tenants["headers_owner"])
    assert r_delete.status_code == 200
