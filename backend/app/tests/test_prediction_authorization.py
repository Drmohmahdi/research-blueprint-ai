"""
prediction.py — project-relationship authorization regression.

Discovered during the full-platform audit: every project lookup in this
router checked only organizationId == caller's org (the same "resource-
scoped authority" gap already fixed for ResearchProject CRUD in projects.py),
and get_prediction_run_details / compare_observed_outcomes fetched a
PredictionRun by its id alone with no check that it belonged to the
project on the request path — a genuine cross-tenant IDOR: any
authenticated user could read (or inject a fake comparison into) another
organization's prediction run by passing their own project id plus a
foreign runId.
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


def _create_project(headers) -> str:
    res = client.post("/api/projects", json={
        "titleAr": "مشروع بحثي", "titleEn": "Research Project",
        "studyDesign": "quasi_experimental_pre_post", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
    }, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _run_prediction(headers, project_id) -> str:
    res = client.post(
        f"/api/projects/{project_id}/prediction/run",
        json={"forecastMode": "LITERATURE_BASED_FORECAST", "studies": []},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return res.json()["run"]["id"]


@pytest.fixture
def tenants():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    org_id = f"pred-authz-org-{suffix}"
    owner, org = create_tenant(db, f"pauthz_owner_{suffix}", org_id, role="OWNER")
    colleague, _ = create_tenant(db, f"pauthz_col_{suffix}", org_id, role="RESEARCHER", existing_org=org)
    admin, _ = create_tenant(db, f"pauthz_admin_{suffix}", org_id, role="ORGANIZATION_ADMIN", existing_org=org)
    pi, _ = create_tenant(db, f"pauthz_pi_{suffix}", org_id, role="RESEARCHER", existing_org=org)

    headers_owner = get_auth_headers(owner.username, org.id)
    headers_colleague = get_auth_headers(colleague.username, org.id)
    headers_admin = get_auth_headers(admin.username, org.id)
    headers_pi = get_auth_headers(pi.username, org.id)

    project_id = _create_project(headers_owner)
    db.add(models.ResearchProjectMember(
        id=f"proj-mem-{suffix}", organization_id=org.id, project_id=project_id,
        user_id=pi.id, relationship="PI", status="ACTIVE", created_at=stamp(),
    ))
    db.commit()

    run_id = _run_prediction(headers_owner, project_id)

    data = {
        "db": db, "org": org, "owner": owner, "colleague": colleague, "admin": admin, "pi": pi,
        "headers_owner": headers_owner, "headers_colleague": headers_colleague,
        "headers_admin": headers_admin, "headers_pi": headers_pi,
        "project_id": project_id, "run_id": run_id,
    }
    yield data
    db.close()


def test_same_org_colleague_with_no_relationship_cannot_validate_readiness(tenants):
    r = client.post(f"/api/projects/{tenants['project_id']}/prediction/validate-readiness", headers=tenants["headers_colleague"])
    assert r.status_code == 404


def test_same_org_colleague_with_no_relationship_cannot_run_prediction(tenants):
    r = client.post(
        f"/api/projects/{tenants['project_id']}/prediction/run",
        json={"forecastMode": "LITERATURE_BASED_FORECAST", "studies": []},
        headers=tenants["headers_colleague"],
    )
    assert r.status_code == 404


def test_same_org_colleague_with_no_relationship_cannot_list_or_view_runs(tenants):
    r_list = client.get(f"/api/projects/{tenants['project_id']}/prediction/runs", headers=tenants["headers_colleague"])
    assert r_list.status_code == 404
    r_detail = client.get(f"/api/projects/{tenants['project_id']}/prediction/runs/{tenants['run_id']}", headers=tenants["headers_colleague"])
    assert r_detail.status_code == 404


def test_organization_admin_without_relationship_cannot_view_runs(tenants):
    r = client.get(f"/api/projects/{tenants['project_id']}/prediction/runs", headers=tenants["headers_admin"])
    assert r.status_code == 404


def test_pi_relationship_can_run_and_view_predictions(tenants):
    r_readiness = client.post(f"/api/projects/{tenants['project_id']}/prediction/validate-readiness", headers=tenants["headers_pi"])
    assert r_readiness.status_code == 200

    r_list = client.get(f"/api/projects/{tenants['project_id']}/prediction/runs", headers=tenants["headers_pi"])
    assert r_list.status_code == 200
    assert tenants["run_id"] in [r["id"] for r in r_list.json()]

    r_detail = client.get(f"/api/projects/{tenants['project_id']}/prediction/runs/{tenants['run_id']}", headers=tenants["headers_pi"])
    assert r_detail.status_code == 200


def test_owner_retains_full_access(tenants):
    r_list = client.get(f"/api/projects/{tenants['project_id']}/prediction/runs", headers=tenants["headers_owner"])
    assert r_list.status_code == 200
    r_compare = client.post(
        f"/api/projects/{tenants['project_id']}/prediction/runs/{tenants['run_id']}/compare-observed",
        json={
            "observedDatasetName": "pilot-2026", "observedEffectSize": 0.4,
            "observedTreatmentMean": 15.0, "observedControlMean": 12.0, "observedAttritionRate": 0.1,
        },
        headers=tenants["headers_owner"],
    )
    assert r_compare.status_code == 200


def test_cross_tenant_run_cannot_be_read_via_a_foreign_but_owned_project_id(tenants):
    """The core cross-tenant IDOR: a completely separate org's own (legitimately
    owned) project id must not let its members read or write another
    organization's PredictionRun by supplying that run's id on the path."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    other_org_id = f"pred-authz-other-org-{suffix}"
    other_owner, other_org = create_tenant(db, f"pauthz_other_{suffix}", other_org_id, role="OWNER")
    other_owner_username, other_org_id_value = other_owner.username, other_org.id
    db.close()
    headers_other = get_auth_headers(other_owner_username, other_org_id_value)
    other_project_id = _create_project(headers_other)

    # other_owner has full legitimate access to their OWN project, but supplies
    # the FIRST tenant's run id — must be rejected as not-found, not leaked.
    r_detail = client.get(
        f"/api/projects/{other_project_id}/prediction/runs/{tenants['run_id']}",
        headers=headers_other,
    )
    assert r_detail.status_code == 404

    r_compare = client.post(
        f"/api/projects/{other_project_id}/prediction/runs/{tenants['run_id']}/compare-observed",
        json={
            "observedDatasetName": "attack", "observedEffectSize": 0.9,
            "observedTreatmentMean": 1.0, "observedControlMean": 1.0, "observedAttritionRate": 0.0,
        },
        headers=headers_other,
    )
    assert r_compare.status_code == 404


def test_prediction_runs_plan_limit_enforced():
    """prediction_runs_limit was defined on every plan but never enforced —
    verify_usage_limit is now wired into run_prediction. A finite limit
    already reached must actually block a further run."""
    from app.services.billing.bootstrap import ensure_plans_and_pricing_seeded

    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]
    ensure_plans_and_pricing_seeded(db)
    owner, org = create_tenant(db, f"predquota_{suffix}", f"pred-quota-org-{suffix}", role="OWNER")
    db.query(models.Subscription).filter(models.Subscription.organization_id == org.id).update(
        {"plan_id": "pln-starter"}
    )
    db.commit()
    owner_username, org_id = owner.username, org.id
    db.close()

    headers = get_auth_headers(owner_username, org_id)
    project_id = _create_project(headers)

    db2 = SessionLocal()
    current_period = datetime.datetime.now(datetime.UTC).strftime("%Y-%m")
    db2.add(models.UsageEvent(
        id=f"use-predquota-{suffix}", organization_id=org_id, user_id=owner.id,
        event_type="PREDICTION_RUNS", quantity=25.0, unit="count",  # pln-starter's prediction_runs_limit
        occurred_at=datetime.datetime.now(datetime.UTC).isoformat(), billing_period=current_period,
    ))
    db2.commit()
    db2.close()

    res = client.post(
        f"/api/projects/{project_id}/prediction/run",
        json={"forecastMode": "LITERATURE_BASED_FORECAST", "studies": []},
        headers=headers,
    )
    assert res.status_code == 403
    assert "prediction_runs_limit" in res.json()["detail"]
