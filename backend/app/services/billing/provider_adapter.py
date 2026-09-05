import os
import hmac
import hashlib
import secrets
from abc import ABC, abstractmethod
from typing import Optional
from .types import CheckoutSessionResponse, DEFAULT_CURRENCY


class PaymentProviderAdapter(ABC):
    @abstractmethod
    def get_status(self) -> str:
        """Returns provider readiness status: LIVE_CONFIGURED, SANDBOX, or NOT_CONFIGURED"""
        pass

    @abstractmethod
    def create_checkout_session(
        self,
        organization_id: str,
        plan_code: str,
        billing_interval: str,
        amount_minor_units: int,
        tax_amount_minor_units: int,
        total_minor_units: int,
        currency: str,
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> CheckoutSessionResponse:
        pass

    @abstractmethod
    def verify_webhook_signature(
        self,
        raw_payload: bytes,
        signature_header: Optional[str]
    ) -> bool:
        pass


class NullPaymentProviderAdapter(PaymentProviderAdapter):
    """
    Honest Payment Adapter for Baseerah.
    Reports 'LIVE_PROVIDER_NOT_CONFIGURED' when external payment gateways (e.g. Moyasar/Stripe) are not active.
    Supports deterministic sandbox and test checkout flows with HMAC-SHA256 signature verification.
    """
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development").lower()
        self.webhook_secret = os.getenv("WEBHOOK_SECRET", "test_webhook_secret_baseerah_academic_2026")
        self.api_key = os.getenv("PAYMENT_API_KEY", "")
        self.provider_mode = os.getenv("PAYMENT_PROVIDER_MODE", "SANDBOX")

    def get_status(self) -> str:
        # This adapter never represents a live payment integration.
        if self.environment == "production":
            return "LIVE_PROVIDER_NOT_CONFIGURED"
        if self.provider_mode == "SANDBOX":
            return "SANDBOX_MOCK_ACTIVE"
        return "LIVE_PROVIDER_NOT_CONFIGURED"

    def create_checkout_session(
        self,
        organization_id: str,
        plan_code: str,
        billing_interval: str,
        amount_minor_units: int,
        tax_amount_minor_units: int,
        total_minor_units: int,
        currency: str = DEFAULT_CURRENCY,
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> CheckoutSessionResponse:
        if self.environment == "production":
            raise RuntimeError("Live payment provider is not configured")
        session_id = f"cs_test_{secrets.token_hex(12)}"
        base_app_url = os.getenv("APP_URL", "http://localhost:5173")
        checkout_url = f"{base_app_url}/billing/checkout?session_id={session_id}&org_id={organization_id}&plan={plan_code}&amount={total_minor_units}"

        return CheckoutSessionResponse(
            checkout_url=checkout_url,
            session_id=session_id,
            provider="NULL_ADAPTER_SANDBOX",
            plan_code=plan_code,
            billing_interval=billing_interval,
            amount_minor_units=amount_minor_units,
            tax_amount_minor_units=tax_amount_minor_units,
            total_amount_minor_units=total_minor_units,
            currency=currency,
            status="CREATED"
        )

    def verify_webhook_signature(
        self,
        raw_payload: bytes,
        signature_header: Optional[str]
    ) -> bool:
        if self.environment == "production":
            return False
        if not signature_header:
            return False

        secret = self.webhook_secret.encode("utf-8")
        computed_sig = hmac.new(secret, raw_payload, hashlib.sha256).hexdigest()
        
        # Compare securely using constant-time comparison
        # Support formats: raw hex or "t=...,v1=..."
        if "=" in signature_header:
            parts = dict(item.split("=", 1) for item in signature_header.split(",") if "=" in item)
            v1_sig = parts.get("v1", "")
            return hmac.compare_digest(computed_sig, v1_sig)

        return hmac.compare_digest(computed_sig, signature_header)


def get_payment_provider_adapter() -> PaymentProviderAdapter:
    return NullPaymentProviderAdapter()
