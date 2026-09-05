"""
analyzer.py — /api/analyzer/analyze-title had zero test coverage before this
file. Covers the normal success path and the newly-wired ai_tokens_limit
enforcement (previously defined on every plan but never checked anywhere).
"""
import datetime
import uuid

from fastapi.testclient import TestClient

from app import models
from app.db import SessionLocal
from app.main import app
from app.routers.auth import hash_password
from app.services.billing.bootstrap import ensure_plans_and_pricing_seeded

client = TestClient(app)


def stamp() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def _create_tenant(db, plan_id: str):
    suffix = uuid.uuid4().hex[:6]
    user = models.User(
        id=f"usr-analyzer-{suffix}", username=f"analyzer_user_{suffix}",
        email=f"analyzer_{suffix}@test-univ.edu",
        hashed_password=hash_password("Password123!"), role="Researcher", created_at=stamp(),
    )
    db.add(user)
    org = models.Organization(
        id=f"analyzer-org-{suffix}", name=f"Analyzer Org {suffix}", slug=f"analyzer-{suffix}",
        organization_type="UNIVERSITY", status="ACTIVE", owner_user_id=user.id,
        default_language="ar", data_region="sa", created_at=stamp(),
    )
    db.add(org)
    db.flush()
    db.add(models.OrganizationMembership(
        id=f"mbr-analyzer-{suffix}", organization_id=org.id, user_id=user.id,
        role="OWNER", status="ACTIVE", created_at=stamp(),
    ))
    db.add(models.Subscription(
        id=f"sub-analyzer-{suffix}", organization_id=org.id, plan_id=plan_id,
        status="ACTIVE", current_period_start=stamp(), current_period_end=stamp(),
        created_at=stamp(), updated_at=stamp(),
    ))
    db.commit()
    return user, org


def _auth_headers(username: str, org_id: str) -> dict:
    res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Organization-ID": org_id}


def test_analyze_title_succeeds_within_quota():
    db = SessionLocal()
    ensure_plans_and_pricing_seeded(db)
    user, org = _create_tenant(db, "pln-enterprise")  # unlimited ai_tokens_limit
    username, org_id = user.username, org.id
    db.close()

    headers = _auth_headers(username, org_id)
    res = client.post("/api/analyzer/analyze-title", json={"title": "أثر التعلم النشط على التحصيل الدراسي"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["independentVariables"]
    assert data["dependentVariables"]


def test_analyze_title_blocked_when_ai_tokens_limit_reached():
    db = SessionLocal()
    ensure_plans_and_pricing_seeded(db)
    user, org = _create_tenant(db, "pln-starter")  # finite ai_tokens_limit=50000
    username, org_id, user_id = user.username, org.id, user.id
    current_period = datetime.datetime.now(datetime.UTC).strftime("%Y-%m")
    db.add(models.UsageEvent(
        id=f"use-analyzer-quota-{uuid.uuid4().hex[:6]}", organization_id=org_id, user_id=user_id,
        event_type="AI_TOKENS", quantity=50000.0, unit="count",
        occurred_at=stamp(), billing_period=current_period,
    ))
    db.commit()
    db.close()

    headers = _auth_headers(username, org_id)
    res = client.post("/api/analyzer/analyze-title", json={"title": "أثر التعلم النشط على التحصيل الدراسي"}, headers=headers)
    assert res.status_code == 403
    assert "ai_tokens_limit" in res.json()["detail"]
