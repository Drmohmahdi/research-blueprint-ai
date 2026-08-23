import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from pydantic import BaseModel
from .events import DeliveryStatus

logger = logging.getLogger(__name__)


class EmailMessage(BaseModel):
    recipient_email: str
    subject: str
    body_text: str
    body_html: Optional[str] = None
    template_key: Optional[str] = None
    template_params: Dict[str, Any] = {}


class EmailDeliveryResult(BaseModel):
    status: DeliveryStatus
    success: bool
    failure_code: Optional[str] = None
    message: str


class EmailDeliveryAdapter(ABC):
    @abstractmethod
    def send_email(self, message: EmailMessage) -> EmailDeliveryResult:
        """Sends an email or returns honest delivery status."""
        pass


class NullEmailDeliveryAdapter(EmailDeliveryAdapter):
    """
    Default adapter when no third-party email provider (SMTP, SendGrid, SES, Resend) is configured.
    Strictly reports NOT_CONFIGURED without faking success.
    """
    def send_email(self, message: EmailMessage) -> EmailDeliveryResult:
        logger.info(
            f"[EmailDelivery:NOT_CONFIGURED] Attempted to send email to {message.recipient_email} "
            f"for subject '{message.subject}', but no email provider is configured."
        )
        return EmailDeliveryResult(
            status=DeliveryStatus.NOT_CONFIGURED,
            success=False,
            failure_code="PROVIDER_NOT_CONFIGURED",
            message="Email delivery is not configured in current environment."
        )


_current_email_adapter: EmailDeliveryAdapter = NullEmailDeliveryAdapter()


def get_email_adapter() -> EmailDeliveryAdapter:
    return _current_email_adapter


def set_email_adapter(adapter: EmailDeliveryAdapter):
    global _current_email_adapter
    _current_email_adapter = adapter
