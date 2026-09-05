import enum
from typing import Optional
from pydantic import BaseModel


class PlanCode(str, enum.Enum):
    FREE = "FREE"
    STARTER = "STARTER"
    PROFESSIONAL = "PROFESSIONAL"
    INSTITUTIONAL = "INSTITUTIONAL"


class BillingInterval(str, enum.Enum):
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "TRIALING"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    SUSPENDED = "SUSPENDED"
    CANCELED = "CANCELED"
    EXPIRED = "EXPIRED"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    VOID = "VOID"
    UNCOLLECTIBLE = "UNCOLLECTIBLE"


class PaymentTransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class FeatureKey(str, enum.Enum):
    ADVANCED_REPORTING = "ADVANCED_REPORTING"
    PEER_REVIEW = "PEER_REVIEW"
    PROMOTION_ENGINE = "PROMOTION_ENGINE"
    AI_ASSISTANCE = "AI_ASSISTANCE"
    EXPORT_PDF = "EXPORT_PDF"
    EXPORT_DOCX = "EXPORT_DOCX"
    EXTERNAL_REVIEWERS = "EXTERNAL_REVIEWERS"


class LimitKey(str, enum.Enum):
    MAX_PROJECTS = "MAX_PROJECTS"
    MAX_MEMBERS = "MAX_MEMBERS"
    MAX_REPORTS_MONTHLY = "MAX_REPORTS_MONTHLY"
    MAX_STORAGE_MB = "MAX_STORAGE_MB"
    MAX_EXTERNAL_REVIEWS = "MAX_EXTERNAL_REVIEWS"


DEFAULT_CURRENCY = "SAR"
DEFAULT_TAX_RATE_BPS = 1500  # 15.00% VAT in Saudi Arabia


class CheckoutSessionRequest(BaseModel):
    plan_code: str
    billing_interval: BillingInterval = BillingInterval.MONTHLY
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str
    provider: str
    plan_code: str
    billing_interval: str
    amount_minor_units: int
    tax_amount_minor_units: int
    total_amount_minor_units: int
    currency: str
    status: str
