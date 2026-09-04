import pytest

from app.services.notifications.email_adapter import (
    EmailMessage,
    NullEmailDeliveryAdapter,
    SmtpEmailDeliveryAdapter,
    configure_email_adapter,
)
from app.services.notifications.events import DeliveryStatus


@pytest.fixture(autouse=True)
def restore_null_email_adapter():
    yield
    configure_email_adapter(host="")


def test_configure_email_adapter_stays_null_without_host():
    adapter = configure_email_adapter(host="")
    assert isinstance(adapter, NullEmailDeliveryAdapter)
    result = adapter.send_email(EmailMessage(
        recipient_email="user@example.test",
        subject="Reset",
        body_text="unused",
    ))
    assert result.success is False
    assert result.status == DeliveryStatus.NOT_CONFIGURED


def test_smtp_adapter_delivers_when_server_accepts(monkeypatch):
    recorded = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            recorded["init"] = (host, port, timeout)

        def starttls(self):
            recorded["tls"] = True

        def login(self, username, password):
            recorded["login"] = username

        def sendmail(self, frm, to, msg):
            recorded["mail"] = (frm, list(to), msg)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("app.services.notifications.email_adapter.smtplib.SMTP", FakeSMTP)
    adapter = configure_email_adapter(
        host="smtp.example.test",
        port=587,
        username="mailer",
        password="secret",
        from_addr="noreply@example.test",
        use_tls=True,
    )
    assert isinstance(adapter, SmtpEmailDeliveryAdapter)
    result = adapter.send_email(EmailMessage(
        recipient_email="user@example.test",
        subject="Reset your Baseerah password",
        body_text="https://research.ehaastore.com/login?token=demo",
    ))
    assert result.success is True
    assert result.status == DeliveryStatus.DELIVERED
    assert recorded["init"][0] == "smtp.example.test"
    assert recorded["tls"] is True
    assert recorded["login"] == "mailer"
    assert recorded["mail"][0] == "noreply@example.test"
    assert recorded["mail"][1] == ["user@example.test"]
    assert "login?token=demo" in recorded["mail"][2]


def test_smtp_adapter_reports_failure_without_faking_success(monkeypatch):
    class BoomSMTP:
        def __init__(self, *args, **kwargs):
            raise OSError("connection refused")

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("app.services.notifications.email_adapter.smtplib.SMTP", BoomSMTP)
    adapter = SmtpEmailDeliveryAdapter(
        host="smtp.example.test",
        port=587,
        username="mailer",
        password="secret",
        from_addr="noreply@example.test",
    )
    result = adapter.send_email(EmailMessage(
        recipient_email="user@example.test",
        subject="Reset",
        body_text="link",
    ))
    assert result.success is False
    assert result.status == DeliveryStatus.FAILED
    assert result.failure_code == "SMTP_DELIVERY_FAILED"
