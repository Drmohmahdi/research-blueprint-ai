import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage as Rfc822Message
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


class SmtpEmailDeliveryAdapter(EmailDeliveryAdapter):
    """Delivers mail through SMTP when host credentials are present. Failures stay explicit."""

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str = "",
        password: str = "",
        from_addr: str = "",
        use_tls: bool = True,
        timeout: float = 20.0,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_addr = from_addr or username
        self.use_tls = use_tls
        self.timeout = timeout

    def send_email(self, message: EmailMessage) -> EmailDeliveryResult:
        if not self.from_addr:
            return EmailDeliveryResult(
                status=DeliveryStatus.FAILED,
                success=False,
                failure_code="SMTP_FROM_MISSING",
                message="SMTP_FROM or SMTP_USERNAME must be set to send mail.",
            )
        envelope = Rfc822Message()
        envelope["From"] = self.from_addr
        envelope["To"] = message.recipient_email
        envelope["Subject"] = message.subject
        envelope.set_content(message.body_text)
        if message.body_html:
            envelope.add_alternative(message.body_html, subtype="html")
        try:
            with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as smtp:
                if self.use_tls:
                    smtp.starttls()
                if self.username:
                    smtp.login(self.username, self.password)
                smtp.sendmail(self.from_addr, [message.recipient_email], envelope.as_string())
        except Exception as exc:
            logger.warning("SMTP delivery failed: %s", type(exc).__name__)
            return EmailDeliveryResult(
                status=DeliveryStatus.FAILED,
                success=False,
                failure_code="SMTP_DELIVERY_FAILED",
                message="SMTP delivery failed.",
            )
        return EmailDeliveryResult(
            status=DeliveryStatus.DELIVERED,
            success=True,
            message="Email accepted by the SMTP server.",
        )


_current_email_adapter: EmailDeliveryAdapter = NullEmailDeliveryAdapter()


def get_email_adapter() -> EmailDeliveryAdapter:
    return _current_email_adapter


def set_email_adapter(adapter: EmailDeliveryAdapter):
    global _current_email_adapter
    _current_email_adapter = adapter


def configure_email_adapter(
    *,
    host: str = "",
    port: int = 587,
    username: str = "",
    password: str = "",
    from_addr: str = "",
    use_tls: bool = True,
) -> EmailDeliveryAdapter:
    if not (host or "").strip():
        adapter: EmailDeliveryAdapter = NullEmailDeliveryAdapter()
    else:
        adapter = SmtpEmailDeliveryAdapter(
            host=host.strip(),
            port=port,
            username=username,
            password=password,
            from_addr=from_addr or username,
            use_tls=use_tls,
        )
    set_email_adapter(adapter)
    return adapter
