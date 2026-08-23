import datetime
import uuid
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from ... import models
from .events import (
    WorkflowEventType,
    AggregateType,
    NotificationCategory,
    NotificationChannel,
    EventStatus,
    DeliveryStatus
)
from .recipient_resolver import RecipientResolver
from .policy import NotificationPolicy
from .email_adapter import get_email_adapter, EmailMessage

logger = logging.getLogger(__name__)


class EventDispatcher:
    @staticmethod
    def process_event(db: Session, event: models.WorkflowEvent) -> bool:
        """
        Idempotently processes a single WorkflowEvent:
        1. Resolves authorized recipients server-side.
        2. Evaluates user category preferences & mandatory delivery rules.
        3. Creates In-App Notification records (deduplicated).
        4. Handles Email delivery via EmailDeliveryAdapter (reporting NOT_CONFIGURED honestly).
        5. Marks WorkflowEvent as PROCESSED.
        """
        if event.status == EventStatus.PROCESSED.value:
            logger.info(f"EventDispatcher: Event {event.id} is already PROCESSED.")
            return True

        now_str = datetime.datetime.now(datetime.UTC).isoformat()
        event.status = EventStatus.PROCESSING.value
        event.attempt_count += 1
        db.flush()

        try:
            payload = event.payload_json or {}
            title_ar = payload.get("title_ar", "تنبيه أكاديمي")
            title_en = payload.get("title_en", "Academic Notification")
            message_ar = payload.get("message_ar", "لديك إشعار جديد")
            message_en = payload.get("message_en", "You have a new notification")
            target_type = payload.get("target_type") or event.aggregate_type
            target_id = payload.get("target_id") or event.aggregate_id
            meta = payload.get("meta") or {}

            # 1. Determine Category
            category = NotificationPolicy.get_category_for_event(event.event_type, event.aggregate_type)

            # 2. Resolve Recipients
            recipients = RecipientResolver.resolve_recipients(
                db=db,
                event_type=event.event_type,
                aggregate_type=event.aggregate_type,
                aggregate_id=event.aggregate_id,
                organization_id=event.organization_id,
                actor_user_id=event.actor_user_id,
                payload_meta=meta
            )

            if not recipients:
                logger.info(f"EventDispatcher: No recipients resolved for event {event.id}.")
                event.status = EventStatus.PROCESSED.value
                event.processed_at = now_str
                db.commit()
                return True

            email_adapter = get_email_adapter()

            for rec in recipients:
                # 3. Policy & Preferences
                deliver_in_app, deliver_email = NotificationPolicy.should_deliver(
                    db=db,
                    user_id=rec.user_id,
                    organization_id=event.organization_id,
                    category=category,
                    event_type=event.event_type
                )

                # A. In-App Notification (Deduplicated)
                notif_record: Optional[models.Notification] = None
                if deliver_in_app:
                    existing_notif = db.query(models.Notification).filter(
                        models.Notification.workflow_event_id == event.id,
                        models.Notification.recipient_user_id == rec.user_id
                    ).first()

                    if not existing_notif:
                        notif_id = f"notif-{uuid.uuid4().hex[:12]}"
                        notif_record = models.Notification(
                            id=notif_id,
                            organization_id=event.organization_id,
                            recipient_user_id=rec.user_id,
                            workflow_event_id=event.id,
                            category=category,
                            title_ar=title_ar,
                            title_en=title_en,
                            message_ar=message_ar,
                            message_en=message_en,
                            target_type=target_type,
                            target_id=target_id,
                            read_at=None,
                            created_at=now_str
                        )
                        db.add(notif_record)
                        db.flush()

                        # Record In-App Delivery
                        inapp_delivery = models.NotificationDelivery(
                            id=f"del-inapp-{uuid.uuid4().hex[:12]}",
                            organization_id=event.organization_id,
                            notification_id=notif_record.id,
                            workflow_event_id=event.id,
                            channel=NotificationChannel.IN_APP.value,
                            recipient_address=rec.user_id,
                            status=DeliveryStatus.DELIVERED.value,
                            attempt_count=1,
                            last_attempt_at=now_str,
                            created_at=now_str
                        )
                        db.add(inapp_delivery)
                    else:
                        notif_record = existing_notif

                # B. Email Notification Channel
                if rec.email:
                    existing_email_deliv = db.query(models.NotificationDelivery).filter(
                        models.NotificationDelivery.workflow_event_id == event.id,
                        models.NotificationDelivery.recipient_address == rec.email,
                        models.NotificationDelivery.channel == NotificationChannel.EMAIL.value
                    ).first()

                    if not existing_email_deliv:
                        if deliver_email:
                            email_msg = EmailMessage(
                                recipient_email=rec.email,
                                subject=title_ar,
                                body_text=f"{title_ar}\n\n{message_ar}",
                                template_key=event.event_type,
                                template_params=meta
                            )
                            send_res = email_adapter.send_email(email_msg)
                            email_deliv = models.NotificationDelivery(
                                id=f"del-email-{uuid.uuid4().hex[:12]}",
                                organization_id=event.organization_id,
                                notification_id=notif_record.id if notif_record else None,
                                workflow_event_id=event.id,
                                channel=NotificationChannel.EMAIL.value,
                                recipient_address=rec.email,
                                status=send_res.status.value,
                                attempt_count=1,
                                last_attempt_at=now_str,
                                failure_code=send_res.failure_code,
                                created_at=now_str
                            )
                            db.add(email_deliv)
                        else:
                            # Skipped by user preference
                            skipped_deliv = models.NotificationDelivery(
                                id=f"del-email-{uuid.uuid4().hex[:12]}",
                                organization_id=event.organization_id,
                                notification_id=notif_record.id if notif_record else None,
                                workflow_event_id=event.id,
                                channel=NotificationChannel.EMAIL.value,
                                recipient_address=rec.email,
                                status=DeliveryStatus.SKIPPED_PREFERENCE.value,
                                attempt_count=0,
                                last_attempt_at=now_str,
                                failure_code=None,
                                created_at=now_str
                            )
                            db.add(skipped_deliv)

            event.status = EventStatus.PROCESSED.value
            event.processed_at = now_str
            db.commit()
            return True

        except Exception as e:
            logger.exception(f"EventDispatcher: Failed processing event {event.id}: {e}")
            db.rollback()
            # Mark event as failed / schedule retry
            try:
                event.status = EventStatus.FAILED.value
                db.add(event)
                db.commit()
            except Exception:
                pass
            return False

    @staticmethod
    def process_pending_events(db: Session, limit: int = 50) -> int:
        """Processes all pending outbox events in chronological order."""
        events = db.query(models.WorkflowEvent).filter(
            models.WorkflowEvent.status.in_([EventStatus.PENDING.value, EventStatus.FAILED.value])
        ).order_by(models.WorkflowEvent.created_at.asc()).limit(limit).all()

        processed_count = 0
        for evt in events:
            if EventDispatcher.process_event(db, evt):
                processed_count += 1

        return processed_count
