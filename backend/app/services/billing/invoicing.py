import datetime
import uuid
import secrets
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ... import models
from .types import InvoiceStatus, DEFAULT_CURRENCY, DEFAULT_TAX_RATE_BPS
from .pricing import calculate_invoice_amounts


class InvoiceService:
    @staticmethod
    def generate_invoice_number(db: Session) -> str:
        now = datetime.datetime.now(datetime.UTC)
        year_month = now.strftime("%Y%m")
        suffix = secrets.token_hex(2).upper()
        return f"INV-{year_month}-{suffix}"

    @classmethod
    def create_invoice_for_subscription(
        cls,
        db: Session,
        organization: models.Organization,
        subscription: models.Subscription,
        plan: models.Plan,
        subtotal_minor_units: int,
        tax_rate_bps: int = DEFAULT_TAX_RATE_BPS,
        status_val: str = InvoiceStatus.PAID.value
    ) -> models.Invoice:
        """
        Creates an immutable, snapshot-backed invoice with itemized line items.
        """
        now = datetime.datetime.now(datetime.UTC)
        now_str = now.isoformat()
        
        subtotal, tax_amount, total = calculate_invoice_amounts(subtotal_minor_units, tax_rate_bps)
        inv_number = cls.generate_invoice_number(db)
        inv_id = f"inv-{secrets.token_hex(8)}"

        seller_snapshot = {
            "legal_name": "منصة بصيرة للبحث العلمي (Baseerah Academic Suite)",
            "country": "SA",
            "vat_number": "300000000000003",
            "address": "الرياض، المملكة العربية السعودية"
        }

        buyer_snapshot = {
            "organization_id": organization.id,
            "organization_name": organization.name,
            "organization_slug": organization.slug,
            "organization_type": organization.organization_type
        }

        invoice = models.Invoice(
            id=inv_id,
            organization_id=organization.id,
            subscription_id=subscription.id,
            invoice_number=inv_number,
            amount_subtotal=subtotal / 100.0,
            amount_tax=tax_amount / 100.0,
            amount_total=total / 100.0,
            amount_subtotal_minor_units=subtotal,
            tax_rate_basis_points=tax_rate_bps,
            amount_tax_minor_units=tax_amount,
            amount_total_minor_units=total,
            currency=DEFAULT_CURRENCY,
            status=status_val,
            issued_at=now_str,
            paid_at=now_str if status_val == InvoiceStatus.PAID.value else None,
            seller_snapshot_json=seller_snapshot,
            buyer_snapshot_json=buyer_snapshot,
            metadata_json={"plan_code": plan.code, "billing_interval": subscription.billing_interval}
        )
        db.add(invoice)
        db.flush()

        # Add itemized line item
        line = models.CommercialInvoiceLine(
            id=f"line-{secrets.token_hex(6)}",
            invoice_id=invoice.id,
            description_ar=f"اشتراك في {plan.name_ar or plan.name} ({'شهري' if subscription.billing_interval == 'MONTHLY' else 'سنوي'})",
            description_en=f"Subscription to {plan.name_en or plan.name} ({subscription.billing_interval})",
            quantity=1,
            unit_amount_minor_units=subtotal,
            line_total_minor_units=subtotal
        )
        db.add(line)
        db.commit()
        db.refresh(invoice)

        return invoice
