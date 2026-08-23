import json
import logging
import importlib

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import engine
from app.main import app
from app.observability import JsonFormatter
from app.services.ai.provider import AIProviderError, AIProviderFactory
from app.services.billing.provider_adapter import NullPaymentProviderAdapter
from app.config import settings


client = TestClient(app)


def test_suite_uses_isolated_database():
    assert "test_suite.db" in str(engine.url)
    assert "research_blueprint.db" not in str(engine.url)


def test_health_is_lightweight_and_correlated():
    response = client.get("/health", headers={"X-Request-ID": "2df9de80-dad8-4b8d-8a71-a38fa99e930f"})
    assert response.status_code == 200
    assert response.json()["liveness"] == "alive"
    assert response.headers["X-Request-ID"] == "2df9de80-dad8-4b8d-8a71-a38fa99e930f"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]


def test_untrusted_request_id_is_regenerated_and_bounded():
    response = client.get("/health", headers={"X-Request-ID": "bad\nvalue" + "x" * 100})
    assert response.status_code == 200
    assert len(response.headers["X-Request-ID"]) == 36
    assert response.headers["X-Request-ID"] != "bad\nvalue" + "x" * 100


def test_readiness_reports_optional_providers_truthfully():
    response = client.get("/readiness")
    assert response.status_code == 200
    body = response.json()
    assert body["database"] == "ready"
    assert body["ai_live_provider"] in {"configured", "not_configured"}
    assert body["payment_live_provider"] in {"configured", "not_configured"}
    assert "DATABASE_URL" not in response.text


def test_database_failure_keeps_liveness_up_and_readiness_sanitized(monkeypatch):
    main_module = importlib.import_module("app.main")

    class UnavailableEngine:
        def connect(self):
            raise ConnectionError("postgresql://secret-user:secret-password@private-db")

    monkeypatch.setattr(main_module, "engine", UnavailableEngine())
    assert client.get("/health").status_code == 200
    response = client.get("/readiness")
    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
    assert "secret-password" not in response.text


def test_structured_logs_remove_control_characters_and_sensitive_fields():
    record = logging.LogRecord("baseerah", logging.INFO, __file__, 1, "safe", (), None)
    record.event = "login\nforged"
    record.fields = {"route": "/health\rforged", "authorization": "Bearer secret-marker"}
    payload = json.loads(JsonFormatter().format(record))
    assert "\n" not in payload["event"]
    assert "\r" not in payload["route"]
    assert "authorization" not in payload
    assert "secret-marker" not in json.dumps(payload)


def test_production_validator_rejects_unsafe_defaults():
    candidate = Settings()
    candidate.ENVIRONMENT = "production"
    candidate.DATABASE_URL = "sqlite:///./unsafe.db"
    candidate.APP_URL = "http://localhost:5173"
    candidate.AUTO_CREATE_TABLES = True
    candidate.COOKIE_SECURE = False
    candidate.CORS_ORIGINS = ["*"]
    candidate.TRUSTED_HOSTS = ["*"]
    with pytest.raises(RuntimeError, match="Unsafe production configuration"):
        candidate.validate_production()


def test_production_never_falls_back_to_fake_ai(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "AI_PROVIDER", "auto")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    with pytest.raises(AIProviderError, match="unavailable"):
        AIProviderFactory.create()
    assert AIProviderFactory.status() == "AI PROVIDER NOT CONFIGURED"


def test_production_null_payment_adapter_is_fail_closed(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PAYMENT_PROVIDER_MODE", "SANDBOX")
    adapter = NullPaymentProviderAdapter()
    assert adapter.get_status() == "LIVE_PROVIDER_NOT_CONFIGURED"
    assert adapter.verify_webhook_signature(b"{}", "known-default-signature") is False
    with pytest.raises(RuntimeError, match="not configured"):
        adapter.create_checkout_session("org", "PRO", "MONTHLY", 100, 15, 115, "SAR")
