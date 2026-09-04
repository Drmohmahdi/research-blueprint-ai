"""
Phase 03 (Admin) — Platform Administration & Settings API.

Persistent platform settings, feature flags, and system status — all guarded
by the global admin role (SYSTEMADMIN/ADMIN/SUPERADMIN/DEVELOPER).
"""
import datetime
import json
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..db import engine, get_db
from .. import models
from ..services.tenant_context import (
    get_tenant_context, TenantContext,
    GLOBAL_ADMIN_ROLES,
)

router = APIRouter(prefix="/admin", tags=["Platform Administration"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlatformSettingItem(BaseModel):
    key: str
    value: Any
    value_type: str = "string"
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PlatformSettingsResponse(BaseModel):
    settings: Dict[str, Any]
    settings_meta: Dict[str, PlatformSettingItem]
    feature_flags: Dict[str, bool]


class PlatformSettingsUpdateRequest(BaseModel):
    settings: Dict[str, Any]
    """Key -> value dict. Existing keys are upserted; new keys created."""


class SystemStatusResponse(BaseModel):
    version: str
    database: str
    storage: str
    ai_provider: str
    payment_provider: str
    counts: Dict[str, int]
    recent_audit_count: int


class UserAccountStatusUpdate(BaseModel):
    account_status: str


LEAD_STATUSES = {"NEW", "CONTACTED", "DEMO", "CLOSED"}


class MarketingLeadOut(BaseModel):
    id: str
    name: str
    email: str
    organization: Optional[str] = None
    intent: str
    message: Optional[str] = None
    source_path: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class MarketingLeadStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_global_admin(ctx: TenantContext):
    if not ctx.is_global_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Global admin role required"
        )


SETTING_DEFAULT_META = {
    "platform.title_ar": {"value_type": "string", "description_ar": "اسم المنصة بالعربية", "description_en": "Platform title (Arabic)"},
    "platform.title_en": {"value_type": "string", "description_ar": "اسم المنصة بالإنجليزية", "description_en": "Platform title (English)"},
    "platform.contact_email": {"value_type": "string", "description_ar": "البريد الإلكتروني للتواصل", "description_en": "Contact email"},
    "platform.contact_phone": {"value_type": "string", "description_ar": "رقم الجوال للتواصل", "description_en": "Contact phone"},
    "platform.ai_model": {"value_type": "string", "description_ar": "نموذج الذكاء الاصطناعي الافتراضي", "description_en": "Default AI model"},
    "platform.announcement_ar": {"value_type": "string", "description_ar": "إعلان المنصة (عربي)", "description_en": "Platform announcement (Arabic)"},
    "platform.announcement_en": {"value_type": "string", "description_ar": "إعلان المنصة (إنجليزي)", "description_en": "Platform announcement (English)"},
    "platform.maintenance_mode": {"value_type": "bool", "description_ar": "وضع الصيانة", "description_en": "Maintenance mode"},
}


def _load_settings(db: Session) -> Dict[str, Any]:
    rows = db.query(models.PlatformSetting).all()
    out = {}
    for r in rows:
        if r.value_type == "bool":
            out[r.key] = bool(r.value_json) if r.value_json is not None else False
        elif r.value_type == "int":
            out[r.key] = int(r.value_json) if r.value_json is not None else 0
        elif r.value_type == "json":
            out[r.key] = r.value_json if r.value_json is not None else {}
        else:
            out[r.key] = str(r.value_json) if r.value_json is not None else ""
    return out


def _load_settings_meta(db: Session) -> Dict[str, PlatformSettingItem]:
    rows = db.query(models.PlatformSetting).all()
    out = {}
    for r in rows:
        val = r.value_json
        if r.value_type == "bool":
            val = bool(val) if val is not None else False
        elif r.value_type == "int":
            val = int(val) if val is not None else 0
        out[r.key] = PlatformSettingItem(
            key=r.key, value=val, value_type=r.value_type,
            description_ar=r.description_ar, description_en=r.description_en,
            updated_at=r.updated_at,
        )
    return out


def _ensure_defaults(db: Session):
    for key, meta in SETTING_DEFAULT_META.items():
        existing = db.query(models.PlatformSetting).filter(models.PlatformSetting.key == key).first()
        if not existing:
            default_val = {
                "platform.title_ar": "منصة بصيرة للبحث العلمي",
                "platform.title_en": "Baseerah Academic Suite",
                "platform.contact_email": "info@ehaastore.com",
                "platform.contact_phone": "0566007625",
                "platform.ai_model": "gemini-2.0-flash",
                "platform.announcement_ar": "",
                "platform.announcement_en": "",
                "platform.maintenance_mode": False,
            }.get(key, "")
            db.add(models.PlatformSetting(
                key=key,
                value_type=meta["value_type"],
                value_json=default_val if not isinstance(default_val, bool) else default_val,
                description_ar=meta.get("description_ar"),
                description_en=meta.get("description_en"),
                updated_at=datetime.datetime.now(datetime.UTC).isoformat(),
            ))
    db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=PlatformSettingsResponse)
def get_admin_settings(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    _require_global_admin(context)
    _ensure_defaults(db)
    settings = _load_settings(db)
    meta = _load_settings_meta(db)
    # Extract feature flags (keys starting with "feature_flag.")
    feature_flags = {}
    for k, v in settings.items():
        if k.startswith("feature_flag."):
            flag_name = k[len("feature_flag."):]
            feature_flags[flag_name] = bool(v) if isinstance(v, bool) else v
    return PlatformSettingsResponse(
        settings=settings,
        settings_meta=meta,
        feature_flags=feature_flags,
    )


@router.put("/settings", response_model=PlatformSettingsResponse)
def update_admin_settings(
    req: PlatformSettingsUpdateRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    _require_global_admin(context)
    now = datetime.datetime.now(datetime.UTC).isoformat()
    for key, value in req.settings.items():
        meta = SETTING_DEFAULT_META.get(key, {"value_type": "string"})
        # Determine value_type
        vtype = meta["value_type"]
        if isinstance(value, bool):
            vtype = "bool"
        elif isinstance(value, int):
            vtype = "int"
        elif isinstance(value, dict):
            vtype = "json"
        else:
            vtype = "string"
        existing = db.query(models.PlatformSetting).filter(models.PlatformSetting.key == key).first()
        if existing:
            existing.value_json = value if isinstance(value, (dict, list)) else value
            existing.value_type = vtype
            existing.updated_by = context.user.id
            existing.updated_at = now
        else:
            db.add(models.PlatformSetting(
                key=key,
                value_type=vtype,
                value_json=value if isinstance(value, (dict, list)) else value,
                description_ar=meta.get("description_ar"),
                description_en=meta.get("description_en"),
                updated_by=context.user.id,
                updated_at=now,
            ))
    db.commit()
    return get_admin_settings(db=db, context=context)


@router.get("/status", response_model=SystemStatusResponse)
def get_system_status(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    _require_global_admin(context)
    db_status = "unavailable"
    try:
        db.execute(text("SELECT 1"))
        db_status = "ready"
    except Exception:
        pass
    storage_ready = bool(__import__("os").getenv("STORAGE_ROOT", "storage_files"))
    from ..services.ai import GovernedAIService
    ai_status = GovernedAIService.status()
    ai_provider = ai_status["provider_status"]
    counts = {
        "organizations": db.query(func.count(models.Organization.id)).scalar() or 0,
        "users": db.query(func.count(models.User.id)).scalar() or 0,
        "projects": db.query(func.count(models.ResearchProject.id)).scalar() or 0,
        "literature_studies": db.query(func.count(models.LiteratureStudy.id)).scalar() or 0,
        "peer_review_cases": db.query(func.count(models.PeerReviewCase.id)).scalar() or 0,
        "promotion_applications": db.query(func.count(models.PromotionApplication.id)).scalar() or 0,
        "uploaded_files": db.query(func.count(models.UploadedFile.id)).scalar() or 0,
        "ai_runs": db.query(func.count(models.AIRun.id)).scalar() or 0,
    }
    recent_audit = db.query(func.count(models.AuditLog.id)).filter(
        models.AuditLog.timestamp >= datetime.datetime.now(datetime.UTC).isoformat().split("T")[0] + "T00:00:00"
    ).scalar() or 0
    return SystemStatusResponse(
        version="3.0.0",
        database=db_status,
        storage="ready" if storage_ready else "not_ready",
        ai_provider=ai_provider,
        payment_provider="not_configured",
        counts=counts,
        recent_audit_count=recent_audit,
    )


@router.patch("/users/{user_id}/status")
def update_user_account_status(
    user_id: str,
    body: UserAccountStatusUpdate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    """Platform-wide enable/disable. Does not grant the operator access to the
    target user's academic data — it only controls whether they can authenticate."""
    _require_global_admin(context)
    next_status = (body.account_status or "").upper()
    if next_status not in {"ACTIVE", "DISABLED"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="account_status must be ACTIVE or DISABLED")
    if user_id == context.user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own account status")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    previous = getattr(target, "account_status", None) or "ACTIVE"
    target.account_status = next_status
    revoked = 0
    if next_status == "DISABLED":
        revoked = db.query(models.UserSession).filter(models.UserSession.userId == user_id).delete()

    now = datetime.datetime.now(datetime.UTC).isoformat()
    db.add(models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="UPDATE_ACCOUNT_STATUS",
        details=f"user={user_id} {previous}->{next_status} sessions_revoked={revoked}",
        before_json={"account_status": previous},
        after_json={"account_status": next_status},
        timestamp=now,
    ))
    db.commit()
    return {"ok": True, "user_id": user_id, "account_status": next_status, "sessions_revoked": revoked}


def _lead_out(row: models.MarketingLead) -> MarketingLeadOut:
    return MarketingLeadOut(
        id=row.id,
        name=row.name,
        email=row.email,
        organization=row.organization,
        intent=row.intent,
        message=row.message,
        source_path=row.source_path,
        status=row.status,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/leads", response_model=List[MarketingLeadOut])
def list_marketing_leads(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    _require_global_admin(context)
    rows = (
        db.query(models.MarketingLead)
        .order_by(models.MarketingLead.created_at.desc())
        .limit(200)
        .all()
    )
    return [_lead_out(row) for row in rows]


@router.patch("/leads/{lead_id}", response_model=MarketingLeadOut)
def update_marketing_lead(
    lead_id: str,
    body: MarketingLeadStatusUpdate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
):
    _require_global_admin(context)
    next_status = (body.status or "").upper()
    if next_status not in LEAD_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid lead status")
    row = db.query(models.MarketingLead).filter(models.MarketingLead.id == lead_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    from ..services.sanitization import sanitize_text
    previous = row.status
    row.status = next_status
    if body.notes is not None:
        row.notes = sanitize_text(body.notes).strip()[:2000] or None
    row.updated_at = datetime.datetime.now(datetime.UTC).isoformat()
    db.add(models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        action="MARKETING_LEAD_STATUS",
        details=f"lead={lead_id} {previous}->{next_status}",
        timestamp=row.updated_at,
    ))
    db.commit()
    db.refresh(row)
    return _lead_out(row)