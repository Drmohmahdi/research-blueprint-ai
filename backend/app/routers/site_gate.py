"""Temporary development-only access gate endpoints.

Unrelated to real application authentication (see auth.py) — this only
unlocks visibility of the platform while it is hidden from the public during
active development. Auto-disabled whenever SITE_GATE_PASSWORD is unset.
"""
from fastapi import APIRouter, Request, Response, HTTPException, status
from pydantic import BaseModel

from ..config import settings
from ..rate_limit import limiter
from ..services.site_gate import (
    GATE_COOKIE_NAME,
    get_expected_site_gate_token,
    verify_site_gate_password,
)

router = APIRouter(prefix="/site-gate", tags=["Site Access Gate"])


class SiteGateVerifyRequest(BaseModel):
    password: str


class SiteGateStatusResponse(BaseModel):
    gate_required: bool
    unlocked: bool


@router.get("/status", response_model=SiteGateStatusResponse)
def get_site_gate_status(request: Request):
    expected = get_expected_site_gate_token()
    gate_required = expected is not None
    unlocked = (not gate_required) or (request.cookies.get(GATE_COOKIE_NAME) == expected)
    return SiteGateStatusResponse(gate_required=gate_required, unlocked=unlocked)


@router.post("/verify")
@limiter.limit("10/minute")
def verify_site_gate(request: Request, payload: SiteGateVerifyRequest, response: Response):
    token = verify_site_gate_password(payload.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="بيانات الدخول غير صحيحة / Incorrect password"
        )
    response.set_cookie(
        key=GATE_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )
    return {"ok": True}
