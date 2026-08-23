"""Real multi-connection concurrency checks for the PostgreSQL release gate."""
import hashlib
import hmac
import json
import os
import threading

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("POSTGRES_TESTING", "").lower() != "true",
    reason="requires the isolated PostgreSQL release-gate database",
)

from app import models
from app.db import SessionLocal
from app.services.notifications.dispatcher import EventDispatcher
from app.services.notifications.events import AggregateType, EventPayload, WorkflowEventType
from app.services.notifications.outbox import OutboxService
from app.tests.test_ai import client as ai_client, create_test_tenant as create_ai_tenant, get_auth_headers as ai_headers, _seed_plans as seed_ai_plans
from app.tests.test_billing import client as billing_client, create_test_tenant as create_billing_tenant
from app.tests.test_notifications import create_test_tenant as create_notification_tenant


def _run_concurrently(operation):
    barrier = threading.Barrier(2)
    results = []
    errors = []

    def worker():
        try:
            barrier.wait(timeout=15)
            results.append(operation())
        except Exception as exc:  # surfaced by the assertion below
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    assert not errors
    assert all(not thread.is_alive() for thread in threads)
    return results


def test_postgresql_dispatcher_claims_event_once():
    db = SessionLocal()
    owner, org = create_notification_tenant(db, "pg_dispatch", "RESEARCHER")
    project = models.ResearchProject(
        id="proj-pg-dispatch", organizationId=org.id, userId=owner.id,
        titleAr="اختبار التزامن", titleEn="Concurrency test",
        sampleSettings={"marginOfError": 0.05},
    )
    db.add(project)
    event = OutboxService.record_event(
        db=db, organization_id=org.id,
        event_type=WorkflowEventType.PROJECT_COMMENT_ADDED,
        aggregate_type=AggregateType.RESEARCH_PROJECT,
        aggregate_id=project.id, actor_user_id=None,
        payload=EventPayload(title_ar="تنبيه", title_en="Alert", message_ar="حدث", message_en="Event"),
        idempotency_key="pg-dispatch-once",
    )
    db.commit(); event_id = event.id; owner_id = owner.id; db.close()

    def claim():
        session = SessionLocal()
        try:
            return EventDispatcher.process_pending_events(session, limit=1)
        finally:
            session.close()

    assert sorted(_run_concurrently(claim)) == [0, 1]
    verify = SessionLocal()
    try:
        assert verify.query(models.WorkflowEvent).filter_by(id=event_id, status="PROCESSED").count() == 1
        assert verify.query(models.Notification).filter_by(workflow_event_id=event_id, recipient_user_id=owner_id).count() == 1
    finally:
        verify.close()


def test_postgresql_webhook_has_one_financial_effect():
    db = SessionLocal(); _user, org = create_billing_tenant(db, "pg_webhook", "ORGANIZATION_ADMIN"); org_id = org.id; db.close()
    payload = json.dumps({
        "id": "evt-pg-concurrent", "type": "payment.succeeded",
        "data": {"organization_id": org_id, "plan_code": "STARTER", "billing_interval": "MONTHLY", "amount_minor_units": 9900, "provider": "MOYASAR"},
    }).encode()
    signature = hmac.new(b"test_webhook_secret_baseerah_academic_2026", payload, hashlib.sha256).hexdigest()

    def deliver():
        response = billing_client.post("/api/billing/webhooks/moyasar", content=payload, headers={"X-Signature": signature, "Content-Type": "application/json"})
        return response.status_code, response.json().get("status")

    responses = _run_concurrently(deliver)
    assert sorted(status for _code, status in responses) == ["ALREADY_PROCESSED", "PROCESSED"]
    assert all(code == 200 for code, _status in responses)
    verify = SessionLocal()
    try:
        assert verify.query(models.PaymentWebhookEvent).filter_by(provider_event_id="evt-pg-concurrent").count() == 1
        assert verify.query(models.Invoice).filter_by(organization_id=org_id).count() == 1
    finally:
        verify.close()


def test_postgresql_ai_idempotency_has_one_paid_run():
    db = SessionLocal(); seed_ai_plans(db); tenant = create_ai_tenant(db, "pg_ai_idem", "pln-enterprise"); username=tenant["researcher"].username; org_id=tenant["org"].id; db.close()
    headers = ai_headers(username, org_id)
    body = {"use_case": "ACADEMIC_WRITING_ASSIST", "text": "Improve this paragraph.", "idempotency_key": "pg-ai-once"}

    def assist():
        response = ai_client.post("/api/ai/assist", json=body, headers=headers)
        return response.status_code

    assert _run_concurrently(assist) == [200, 200]
    verify = SessionLocal()
    try:
        assert verify.query(models.AIRun).filter_by(organization_id=org_id, idempotency_key="pg-ai-once").count() == 1
    finally:
        verify.close()
