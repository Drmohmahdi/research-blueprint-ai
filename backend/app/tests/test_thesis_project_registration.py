"""Project owners can register a thesis without a pre-created graduate policy."""
import secrets
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal
from app import models
from app.routers.auth import hash_password

client = TestClient(app)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _user(db, username, org_id, role="OWNER"):
    user = models.User(id=f"usr-{username}", username=username, email=f"{username}@test.invalid", hashed_password=hash_password("Password123!"), role="Researcher", created_at=_now())
    db.add(user)
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        org = models.Organization(id=org_id, name=org_id, slug=org_id, organization_type="UNIVERSITY", status="ACTIVE", owner_user_id=user.id, created_at=_now())
        db.add(org)
        plan = db.query(models.Plan).filter(models.Plan.id == "pln-free").first()
        if not plan:
            db.add(models.Plan(id="pln-free", code="FREE", name="Free", name_ar="مجاني", name_en="Free", billing_interval="MONTHLY", price=0, price_minor_units=0, currency="SAR", features_json={}, limits_json={"max_projects": 100}, created_at=_now()))
            db.flush()
        db.add(models.Subscription(id=f"sub-{org_id}", organization_id=org_id, plan_id="pln-free", status="ACTIVE", provider="MOCK", current_period_start=_now(), current_period_end="2036-01-01T00:00:00+00:00", created_at=_now()))
    db.add(models.OrganizationMembership(id=f"mbr-{username}", organization_id=org_id, user_id=user.id, role=role, status="ACTIVE", created_at=_now()))
    db.commit()
    return user


def _headers(username, org_id):
    token = client.post("/api/auth/login", json={"username": username, "password": "Password123!"}).json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Organization-ID": org_id}


def _project(db, org_id, owner_id, suffix):
    project = models.ResearchProject(id=f"proj-{suffix}", userId=owner_id, organizationId=org_id, titleAr="رسالة اختبار", titleEn="Test thesis", sampleSettings={})
    db.add(project)
    db.commit()
    return project


def test_project_owner_registers_thesis_without_prior_policy():
    db = SessionLocal()
    suffix = secrets.token_hex(4)
    org = f"org-reg-{suffix}"
    owner = _user(db, f"own_{suffix}", org, "RESEARCHER")
    stranger = _user(db, f"str_{suffix}", org, "RESEARCHER")
    other_org = f"org-reg-b-{suffix}"
    other = _user(db, f"oth_{suffix}", other_org, "OWNER")
    project = _project(db, org, owner.id, suffix)
    hown = _headers(owner.username, org)
    hstr = _headers(stranger.username, org)
    hoth = _headers(other.username, other_org)
    project_id = project.id
    db.close()

    assert client.get(f"/api/theses/projects/{project_id}", headers=hown).status_code == 404

    created = client.post(
        f"/api/theses/projects/{project_id}",
        headers=hown,
        json={"degree_type": "MASTERS", "program_name": "ماجستير التربية", "research_type": "EMPIRICAL"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["project_id"] == project_id
    assert body["degree_type"] == "MASTERS"

    center = client.get(f"/api/theses/{body['id']}/command-center", headers=hown)
    assert center.status_code == 200
    assert [chapter["key"] for chapter in center.json()["chapters"]] == [
        "INTRODUCTION",
        "LITERATURE_REVIEW",
        "METHODOLOGY",
        "RESULTS",
        "DISCUSSION",
        "CONCLUSION",
    ]

    duplicate = client.post(
        f"/api/theses/projects/{project_id}",
        headers=hown,
        json={"degree_type": "MASTERS", "program_name": "ماجستير التربية", "research_type": "EMPIRICAL"},
    )
    assert duplicate.status_code == 409

    assert client.post(
        f"/api/theses/projects/{project_id}",
        headers=hstr,
        json={"degree_type": "MASTERS", "program_name": "ماجستير التربية", "research_type": "EMPIRICAL"},
    ).status_code == 403

    assert client.post(
        f"/api/theses/projects/{project_id}",
        headers=hoth,
        json={"degree_type": "MASTERS", "program_name": "ماجستير التربية", "research_type": "EMPIRICAL"},
    ).status_code == 404


def test_admin_registers_thesis_for_project_owner():
    db = SessionLocal()
    suffix = secrets.token_hex(4)
    org = f"org-reg-adm-{suffix}"
    admin = _user(db, f"adm_{suffix}", org, "OWNER")
    student = _user(db, f"stu_{suffix}", org, "RESEARCHER")
    project = _project(db, org, student.id, suffix)
    hadmin = _headers(admin.username, org)
    hstu = _headers(student.username, org)
    project_id = project.id
    db.close()

    created = client.post(
        f"/api/theses/projects/{project_id}",
        headers=hadmin,
        json={"degree_type": "DOCTORATE", "program_name": "PhD Education", "research_type": "CONCEPTUAL"},
    )
    assert created.status_code == 201, created.text
    center = client.get(f"/api/theses/{created.json()['id']}/command-center", headers=hstu)
    assert center.status_code == 200
    keys = {chapter["key"] for chapter in center.json()["chapters"]}
    assert "CONCEPTUAL_FRAMEWORK" in keys
    assert center.json()["thesis"]["degree_type"] == "DOCTORATE"


def test_project_owner_assigns_org_colleague_as_supervisor():
    db = SessionLocal()
    suffix = secrets.token_hex(4)
    org = f"org-sup-{suffix}"
    owner = _user(db, f"own_{suffix}", org, "RESEARCHER")
    colleague = _user(db, f"col_{suffix}", org, "RESEARCHER")
    stranger = _user(db, f"str_{suffix}", org, "RESEARCHER")
    other_org = f"org-sup-b-{suffix}"
    other = _user(db, f"oth_{suffix}", other_org, "OWNER")
    project = _project(db, org, owner.id, suffix)
    hown = _headers(owner.username, org)
    hstr = _headers(stranger.username, org)
    hoth = _headers(other.username, other_org)
    project_id = project.id
    owner_id = owner.id
    colleague_id = colleague.id
    other_id = other.id
    db.close()

    created = client.post(
        f"/api/theses/projects/{project_id}",
        headers=hown,
        json={"degree_type": "MASTERS", "program_name": "ماجستير التربية", "research_type": "EMPIRICAL"},
    )
    assert created.status_code == 201, created.text
    thesis_id = created.json()["id"]

    assigned = client.post(
        f"/api/theses/{thesis_id}/assignments",
        headers=hown,
        json={"user_id": colleague_id, "role": "SUPERVISOR", "can_final_recommend": True},
    )
    assert assigned.status_code == 201, assigned.text

    self_assign = client.post(
        f"/api/theses/{thesis_id}/assignments",
        headers=hown,
        json={"user_id": owner_id, "role": "SUPERVISOR", "can_final_recommend": True},
    )
    assert self_assign.status_code == 422

    duplicate = client.post(
        f"/api/theses/{thesis_id}/assignments",
        headers=hown,
        json={"user_id": colleague_id, "role": "SUPERVISOR", "can_final_recommend": True},
    )
    assert duplicate.status_code == 409

    assert client.post(
        f"/api/theses/{thesis_id}/assignments",
        headers=hstr,
        json={"user_id": colleague_id, "role": "SUPERVISOR", "can_final_recommend": True},
    ).status_code == 404

    assert client.post(
        f"/api/theses/{thesis_id}/assignments",
        headers=hoth,
        json={"user_id": other_id, "role": "SUPERVISOR", "can_final_recommend": True},
    ).status_code == 404

    center = client.get(f"/api/theses/{thesis_id}/command-center", headers=hown)
    assert center.status_code == 200
    supervisors = center.json()["supervisors"]
    assert any(item["user_id"] == colleague_id and item["role"] == "SUPERVISOR" for item in supervisors)
