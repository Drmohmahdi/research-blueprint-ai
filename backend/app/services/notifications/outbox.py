import datetime
import uuid
import hashlib
import json
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from ... import models
from .events import WorkflowEventType, AggregateType, EventStatus, EventPayload

logger = logging.getLogger(__name__)


class OutboxService:
    @staticmethod
    def generate_idempotency_key(
        event_type: str,
        aggregate_id: str,
        scope_key: Optional[str] = None
    ) -> str:
        """Generates a clean deterministic idempotency key for domain events."""
        base = f"{event_type}:{aggregate_id}"
        if scope_key:
            base += f":{scope_key}"
        return hashlib.sha256(base.encode("utf-8")).hexdigest()[:32]

    @staticmethod
    def record_event(
        db: Session,
        organization_id: str,
        event_type: WorkflowEventType,
        aggregate_type: AggregateType,
        aggregate_id: str,
        payload: EventPayload,
        actor_user_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        scope_key: Optional[str] = None
    ) -> models.WorkflowEvent:
        """
        Persists a WorkflowEvent atomically inside the active DB transaction.
        Enforces idempotency and guarantees that if the domain transaction rolls back,
        the event is also rolled back.
        """
        key = idempotency_key or OutboxService.generate_idempotency_key(
            event_type.value, aggregate_id, scope_key
        )

        # Check if event already recorded in current transaction or DB
        existing = db.query(models.WorkflowEvent).filter(
            models.WorkflowEvent.idempotency_key == key
        ).first()

        if existing:
            logger.info(f"OutboxService: Event with key {key} already exists (Idempotency matched).")
            return existing

        now_str = datetime.datetime.now(datetime.UTC).isoformat()
        event_id = f"evt-{uuid.uuid4().hex[:12]}"

        # Validate & sanitize payload
        payload_dict = payload.model_dump()

        event = models.WorkflowEvent(
            id=event_id,
            organization_id=organization_id,
            event_type=event_type.value,
            aggregate_type=aggregate_type.value,
            aggregate_id=aggregate_id,
            actor_user_id=actor_user_id,
            payload_json=payload_dict,
            idempotency_key=key,
            status=EventStatus.PENDING.value,
            attempt_count=0,
            occurred_at=now_str,
            created_at=now_str
        )

        db.add(event)
        logger.info(f"OutboxService: Recorded event {event_id} ({event_type.value}) for {aggregate_type.value}:{aggregate_id}")
        return event
