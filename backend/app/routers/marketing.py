"""Public marketing conversion endpoints.

Lead capture is intentionally unauthenticated so the commercial site can collect
demo and institutional requests before signup. Payloads are sanitized and stored
as audit events — no extra CRM dependency required for first-party capture.
"""
from __future__ import annotations

import datetime
import json
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..rate_limit import limiter
from ..services.sanitization import sanitize_text

router = APIRouter(prefix="/marketing", tags=["marketing"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_INTENTS = {"demo", "trial", "institutional", "support"}


class MarketingLeadRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=254)
    organization: str = Field("", max_length=160)
    intent: str = Field("demo", max_length=40)
    message: str = Field("", max_length=2000)
    source_path: str = Field("", max_length=200)

    @field_validator("email")
    @classmethod
    def email_shape(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not EMAIL_RE.match(cleaned):
            raise ValueError("Invalid email")
        return cleaned

    @field_validator("intent")
    @classmethod
    def intent_allowed(cls, value: str) -> str:
        cleaned = sanitize_text(value or "demo").strip().lower() or "demo"
        if cleaned not in ALLOWED_INTENTS:
            return "demo"
        return cleaned


class MarketingLeadResponse(BaseModel):
    ok: bool
    intent: str


@router.post("/leads", response_model=MarketingLeadResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("8/minute")
def capture_marketing_lead(
    request: Request,
    payload: MarketingLeadRequest,
    db: Session = Depends(get_db),
):
    name = sanitize_text(payload.name).strip()
    organization = sanitize_text(payload.organization or "").strip()
    message = sanitize_text(payload.message or "").strip()
    source_path = sanitize_text(payload.source_path or "").strip()[:200]
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required")

    details = json.dumps(
        {
            "name": name,
            "email": payload.email,
            "organization": organization,
            "intent": payload.intent,
            "message": message,
            "source_path": source_path,
        },
        ensure_ascii=False,
    )
    now = datetime.datetime.now(datetime.UTC).isoformat()
    ip_address = request.client.host if request.client else None
    db.add(
        models.MarketingLead(
            id=secrets.token_hex(8),
            name=name,
            email=payload.email,
            organization=organization or None,
            intent=payload.intent,
            message=message or None,
            source_path=source_path or None,
            status="NEW",
            ip_address=ip_address,
            created_at=now,
            updated_at=now,
        )
    )
    db.add(
        models.AuditLog(
            id=secrets.token_hex(8),
            action="MARKETING_LEAD",
            details=details,
            ip_address=ip_address,
            user_agent=(request.headers.get("user-agent") or "")[:300],
            timestamp=now,
        )
    )
    db.commit()
    return MarketingLeadResponse(ok=True, intent=payload.intent)
