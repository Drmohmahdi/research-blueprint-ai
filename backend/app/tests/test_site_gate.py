import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.services import site_gate as site_gate_service


@pytest.fixture
def gate_enabled(monkeypatch):
    monkeypatch.setattr(config.settings, "SITE_GATE_PASSWORD", "letmein123")
    yield
    monkeypatch.setattr(config.settings, "SITE_GATE_PASSWORD", "")


def test_gate_disabled_by_default():
    assert site_gate_service.get_expected_site_gate_token() is None


def test_status_reports_unlocked_when_gate_disabled():
    client = TestClient(app)
    res = client.get("/api/site-gate/status")
    assert res.status_code == 200
    assert res.json() == {"gate_required": False, "unlocked": True}


def test_gate_blocks_api_without_cookie(gate_enabled):
    client = TestClient(app)
    res = client.get("/api/projects")
    assert res.status_code == 401
    assert res.json()["detail"] == "SITE_GATED"


def test_health_and_ready_exempt_from_gate(gate_enabled):
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200


def test_status_reports_gate_required_without_cookie(gate_enabled):
    client = TestClient(app)
    res = client.get("/api/site-gate/status")
    assert res.status_code == 200
    assert res.json() == {"gate_required": True, "unlocked": False}


def test_verify_rejects_wrong_password(gate_enabled):
    client = TestClient(app)
    res = client.post("/api/site-gate/verify", json={"password": "wrong"})
    assert res.status_code == 401
    assert "baseerah_gate" not in res.cookies


def test_verify_accepts_correct_password_and_unlocks(gate_enabled):
    client = TestClient(app)
    res = client.post("/api/site-gate/verify", json={"password": "letmein123"})
    assert res.status_code == 200
    assert res.cookies.get("baseerah_gate")

    status_res = client.get("/api/site-gate/status")
    assert status_res.json() == {"gate_required": True, "unlocked": True}

    projects_res = client.get("/api/projects")
    assert not (projects_res.status_code == 401 and projects_res.json().get("detail") == "SITE_GATED")


def test_billing_webhooks_exempt_from_gate(gate_enabled):
    client = TestClient(app)
    res = client.post("/api/billing/webhooks/moyasar", json={})
    assert res.json().get("detail") != "SITE_GATED"


def test_marketing_leads_exempt_from_gate(gate_enabled):
    client = TestClient(app)
    res = client.post(
        "/api/marketing/leads",
        json={"name": "Demo", "email": "demo@example.com", "intent": "demo"},
    )
    assert res.json().get("detail") != "SITE_GATED"
