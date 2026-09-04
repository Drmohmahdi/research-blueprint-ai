from .events import (
    WorkflowEventType,
    AggregateType,
    NotificationCategory,
    NotificationChannel,
    EventStatus,
    DeliveryStatus,
    EventPayload
)
from .outbox import OutboxService
from .recipient_resolver import RecipientResolver
from .policy import NotificationPolicy
from .dispatcher import EventDispatcher
from .email_adapter import (
    EmailDeliveryAdapter,
    NullEmailDeliveryAdapter,
    SmtpEmailDeliveryAdapter,
    EmailMessage,
    EmailDeliveryResult,
    get_email_adapter,
    set_email_adapter,
    configure_email_adapter,
)

__all__ = [
    "WorkflowEventType",
    "AggregateType",
    "NotificationCategory",
    "NotificationChannel",
    "EventStatus",
    "DeliveryStatus",
    "EventPayload",
    "OutboxService",
    "RecipientResolver",
    "NotificationPolicy",
    "EventDispatcher",
    "EmailDeliveryAdapter",
    "NullEmailDeliveryAdapter",
    "SmtpEmailDeliveryAdapter",
    "EmailMessage",
    "EmailDeliveryResult",
    "get_email_adapter",
    "set_email_adapter",
    "configure_email_adapter",
]
