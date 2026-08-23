from typing import Tuple
from .types import DEFAULT_CURRENCY, DEFAULT_TAX_RATE_BPS


def calculate_invoice_amounts(
    subtotal_minor_units: int,
    tax_rate_bps: int = DEFAULT_TAX_RATE_BPS
) -> Tuple[int, int, int]:
    """
    Computes (subtotal, tax_amount, total) strictly in integer minor units (halalas / cents).
    Prevents floating-point drift:
    tax_amount = round(subtotal * tax_rate_bps / 10000)
    total = subtotal + tax_amount
    """
    if subtotal_minor_units < 0:
        raise ValueError("Subtotal minor units cannot be negative")

    tax_amount_minor_units = int(round((subtotal_minor_units * tax_rate_bps) / 10000.0))
    total_minor_units = subtotal_minor_units + tax_amount_minor_units

    return subtotal_minor_units, tax_amount_minor_units, total_minor_units


def format_currency(
    amount_minor_units: int,
    currency: str = DEFAULT_CURRENCY
) -> str:
    """
    Formats minor units integer into localized human-readable string without float loss.
    e.g. 19900 -> "199.00 SAR"
    """
    major_units = amount_minor_units // 100
    minor_units = abs(amount_minor_units) % 100
    return f"{major_units}.{minor_units:02d} {currency}"
