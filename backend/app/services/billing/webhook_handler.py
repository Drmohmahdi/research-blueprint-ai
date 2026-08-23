import json
import logging
import datetime
import secrets
from typing import Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ... import models
from .types import SubscriptionStatus, InvoiceStatus, PaymentTransactionStatus, DEFAULT_CURRENCY
from .provider_adapter import get_payment_provider_adapter
from .invoicing import InvoiceService

logger = logging.getLogger(__name__)


class WebhookHandler:
    @classmethod
    def process_webhook_event(
        cls,
        db: Session,
        provider: str,
        raw_payload: bytes,
        signature_header: str | None
    ) -> Dict[str, Any]:
        """
        Validates signature, prevents duplicate replay, processes financial state transitions idempotently,
        and logs the webhook event audit record.
        """
        adapter = get_payment_provider_adapter()
        
        # 1. Signature Verification
        is_valid = adapter.verify_webhook_signature(raw_payload, signature_header)
        now_str = datetime.datetime.now(datetime.UTC).isoformat()

        if not is_valid:
            logger.warning("Rejected webhook with invalid signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_WEBHOOK_SIGNATURE: توقيع الويب هوك غير صالح / Invalid webhook signature"
            )

        # Parse JSON
        try:
            payload = json.loads(raw_payload.decode("utf-8"))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"MALFORMED_JSON_PAYLOAD: خطأ في بنية البيانات / Malformed JSON: {e}"
            )

        provider_event_id = payload.get("id") or payload.get("event_id") or f"evt_{secrets.token_hex(8)}"
        event_type = payload.get("type") or payload.get("event_type") or "unknown"
        data = payload.get("data", {})

        # 2. Check Idempotency / Duplicate Replay
        existing_event = db.query(models.PaymentWebhookEvent).filter(
            models.PaymentWebhookEvent.provider_event_id == provider_event_id
        ).first()

        if existing_event:
            logger.info(f"Duplicate webhook received ({provider_event_id}), returning idempotent success")
            return {
                "status": "ALREADY_PROCESSED",
                "event_id": provider_event_id,
                "message": "تمت معالجة الحدث مسبقاً / Event already processed idempotently"
            }

        # Record incoming event record
        webhook_log = models.PaymentWebhookEvent(
            id=f"pwe-{secrets.token_hex(8)}",
            provider=provider,
            provider_event_id=provider_event_id,
            event_type=event_type,
            received_at=now_str,
            status="PROCESSING",
            signature_valid=True,
            payload_summary_json={"event_type": event_type, "org_id": data.get("organization_id")}
        )
        db.add(webhook_log)
        try:
            db.flush()
        except IntegrityError:
            # A concurrent delivery with the same provider event won the unique
            # key. PostgreSQL waits for that transaction before raising, so the
            # authoritative event is visible after rollback.
            db.rollback()
            existing_event = db.query(models.PaymentWebhookEvent).filter(
                models.PaymentWebhookEvent.provider_event_id == provider_event_id
            ).first()
            if existing_event:
                return {
                    "status": "ALREADY_PROCESSED",
                    "event_id": provider_event_id,
                    "message": "تمت معالجة الحدث مسبقاً / Event already processed idempotently",
                }
            raise

        try:
            # 3. Handle specific event types
            result = cls._dispatch_event(db, event_type, data, now_str)
            webhook_log.status = "PROCESSED"
            webhook_log.processed_at = datetime.datetime.now(datetime.UTC).isoformat()
            db.commit()
            return {"status": "PROCESSED", "event_id": provider_event_id, "result": result}
        except Exception as ex:
            db.rollback()
            webhook_log.status = "FAILED"
            webhook_log.error_details = str(ex)
            db.commit()
            raise ex

    @classmethod
    def _dispatch_event(cls, db: Session, event_type: str, data: Dict[str, Any], now_str: str) -> Dict[str, Any]:
        org_id = data.get("organization_id")
        if not org_id:
            return {"message": "No organization_id specified in event data"}

        org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
        if not org:
            return {"message": f"Organization {org_id} not found"}

        sub = db.query(models.Subscription).filter(
            models.Subscription.organization_id == org_id
        ).first()

        if event_type in ["payment.succeeded", "checkout.session.completed"]:
            from .bootstrap import ensure_plans_and_pricing_seeded
            ensure_plans_and_pricing_seeded(db)
            # Expire session cache to ensure plan rows seeded above are visible
            db.expire_all()

            plan_code = data.get("plan_code", "PROFESSIONAL")
            billing_interval = data.get("billing_interval", "MONTHLY")
            amount_minor_units = int(data.get("amount_minor_units", 29900))
            
            plan = db.query(models.Plan).filter(
                models.Plan.code == plan_code
            ).first()

            if not plan:
                # Fallback by ID
                plan = db.query(models.Plan).filter(models.Plan.id == plan_code).first()

            if not plan:
                # Last resort: use first available paid plan
                plan = db.query(models.Plan).filter(
                    models.Plan.code.in_(["PROFESSIONAL", "STARTER", "FREE"])
                ).first()

            now_dt = datetime.datetime.now(datetime.UTC)
            period_days = 365 if billing_interval == "YEARLY" else 30

            if not sub:
                sub = models.Subscription(
                    id=f"sub-{secrets.token_hex(8)}",
                    organization_id=org_id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.ACTIVE.value,
                    provider=data.get("provider", "MOYASAR"),
                    currency=DEFAULT_CURRENCY,
                    billing_interval=billing_interval,
                    unit_amount_minor_units=amount_minor_units,
                    current_period_start=now_dt.isoformat(),
                    current_period_end=(now_dt + datetime.timedelta(days=period_days)).isoformat(),
                    created_at=now_str
                )
                db.add(sub)
            else:
                sub.plan_id = plan.id
                sub.status = SubscriptionStatus.ACTIVE.value
                sub.billing_interval = billing_interval
                sub.unit_amount_minor_units = amount_minor_units
                sub.current_period_start = now_dt.isoformat()
                sub.current_period_end = (now_dt + datetime.timedelta(days=period_days)).isoformat()
                sub.cancel_at_period_end = False
                sub.updated_at = now_str

            # Create Paid Invoice
            invoice = InvoiceService.create_invoice_for_subscription(
                db=db,
                organization=org,
                subscription=sub,
                plan=plan,
                subtotal_minor_units=amount_minor_units,
                status_val=InvoiceStatus.PAID.value
            )

            # Record Payment Transaction
            txn = models.PaymentTransaction(
                id=f"txn-{secrets.token_hex(8)}",
                organization_id=org_id,
                invoice_id=invoice.id,
                provider=data.get("provider", "MOYASAR"),
                provider_transaction_ref=data.get("transaction_ref", f"tx_{secrets.token_hex(8)}"),
                amount_minor_units=amount_minor_units,
                currency=DEFAULT_CURRENCY,
                status=PaymentTransactionStatus.PAID.value,
                created_at=now_str,
                confirmed_at=now_str
            )
            db.add(txn)
            return {"subscription_id": sub.id, "status": "ACTIVE", "invoice_id": invoice.id}

        elif event_type in ["payment.failed", "invoice.payment_failed"]:
            if sub and sub.status == SubscriptionStatus.ACTIVE.value:
                # Transition to PAST_DUE without immediate catastrophic data deletion
                sub.status = SubscriptionStatus.PAST_DUE.value
                sub.updated_at = now_str
                return {"subscription_id": sub.id, "status": "PAST_DUE"}

        elif event_type in ["subscription.canceled", "customer.subscription.deleted"]:
            if sub:
                sub.status = SubscriptionStatus.CANCELED.value
                sub.cancelled_at = now_str
                sub.updated_at = now_str
                return {"subscription_id": sub.id, "status": "CANCELED"}

        return {"event_type": event_type, "status": "IGNORED"}
