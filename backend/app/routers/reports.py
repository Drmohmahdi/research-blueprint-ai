import datetime
import json
import re
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.reporting import (
    ReportType,
    ReportFormat,
    ReportAudience,
    ReportContextBuilder,
    JsonReportRenderer,
    DocxReportRenderer,
    PdfReportRenderer
)

from ..services.billing import EntitlementService, FeatureKey

router = APIRouter(prefix="/api/reports", tags=["Academic Reporting & Export"])

ALLOWED_LANGUAGES = {"ar", "en", "bilingual"}


def sanitize_filename_component(name: str) -> str:
    """Sanitizes user and system string components for safe HTTP Content-Disposition headers."""
    clean = re.sub(r'[^a-zA-Z0-9_\-]', '', name)
    return clean[:40] if clean else "report"


@router.post("/export", summary="Export an academic report in PDF, DOCX, or JSON format")
def export_academic_report(
    req: schemas.ReportExportRequest,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Generates and streams an authorized academic report in the requested format (PDF, DOCX, JSON).
    Strictly enforces tenant isolation, user authorization, role-based privacy redaction, and commercial entitlements.
    """
    # 1. Parse Enums & Validate Inputs safely
    try:
        r_type = ReportType(req.report_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report_type: {req.report_type}. Allowed: {[e.value for e in ReportType]}"
        )

    try:
        r_format = ReportFormat(req.format.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid format: {req.format}. Allowed: {[e.value for e in ReportFormat]}"
        )

    # Entitlement Enforcement on Export Formats
    if r_format == ReportFormat.DOCX:
        EntitlementService.require_feature(db, context.organization.id, FeatureKey.EXPORT_DOCX.value)
    elif r_format == ReportFormat.PDF:
        EntitlementService.require_feature(db, context.organization.id, FeatureKey.EXPORT_PDF.value)

    try:
        r_audience = ReportAudience(req.audience.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audience: {req.audience}. Allowed: {[e.value for e in ReportAudience]}"
        )

    lang = (req.language or "ar").lower().strip()
    if lang not in ALLOWED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid language: {req.language}. Allowed: {sorted(list(ALLOWED_LANGUAGES))}"
        )

    # 2. Build Canonical Report Context (Domain extraction + authorization + redaction)
    report_context = ReportContextBuilder.build(
        report_type=r_type,
        source_id=req.source_id,
        context=context,
        db=db,
        language=lang,
        audience=r_audience,
        template_version=req.template_version
    )

    # 3. Render according to requested format
    if r_format == ReportFormat.JSON:
        raw_bytes, doc_hash = JsonReportRenderer.render(report_context)
        media_type = "application/json"
        ext = "json"
    elif r_format == ReportFormat.DOCX:
        raw_bytes, doc_hash = DocxReportRenderer.render(report_context, language=lang)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    elif r_format == ReportFormat.PDF:
        raw_bytes, doc_hash = PdfReportRenderer.render(report_context, language=lang)
        media_type = "application/pdf"
        ext = "pdf"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported output format")

    # 4. Audit Trail Event
    audit_details = {
        "report_type": r_type.value,
        "source_id": req.source_id,
        "format": r_format.value,
        "language": lang,
        "audience": r_audience.value,
        "document_hash": doc_hash,
        "verification_code": report_context.manifest.verification_code
    }
    audit = models.AuditLog(
        id=f"aud-{report_context.manifest.report_id}",
        organizationId=context.organization.id,
        userId=context.user.id,
        action="REPORT_GENERATED",
        details=json.dumps(audit_details),
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(audit)
    db.commit()

    # 5. Build Safe Filename (immune to path traversal and header injection)
    date_str = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d")
    clean_type = sanitize_filename_component(r_type.value.lower().replace("_", "-"))
    filename = f"baseerah-{clean_type}-{date_str}.{ext}"
    quoted_filename = urllib.parse.quote(filename)

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{quoted_filename}',
        "X-Report-Id": report_context.manifest.report_id,
        "X-Report-Integrity-Hash": doc_hash,
        "X-Verification-Code": report_context.manifest.verification_code,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }

    return Response(
        content=raw_bytes,
        media_type=media_type,
        headers=headers
    )


@router.post("/context", summary="Inspect canonical report context without rendering")
def get_canonical_report_context(
    req: schemas.ReportExportRequest,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Returns the raw Canonical Report Context JSON structure before rendering.
    Enforces identical authorization, multi-tenant isolation, and role-based privacy redaction.
    """
    try:
        r_type = ReportType(req.report_type)
        r_audience = ReportAudience(req.audience.upper())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    lang = (req.language or "ar").lower().strip()
    if lang not in ALLOWED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid language: {req.language}. Allowed: {sorted(list(ALLOWED_LANGUAGES))}"
        )

    report_context = ReportContextBuilder.build(
        report_type=r_type,
        source_id=req.source_id,
        context=context,
        db=db,
        language=lang,
        audience=r_audience,
        template_version=req.template_version
    )

    return report_context.model_dump()


@router.get("/verify/{code}", response_model=schemas.ReportVerificationResponse, summary="Verify authenticity of an issued report")
def verify_report_authenticity(
    code: str,
    db: Session = Depends(get_db)
):
    """
    Public verification endpoint to verify whether a given verification code corresponds to
    an authentically issued document from Baseerah Academic Suite.
    Exposes zero confidential review details, private user emails, or downloadable binaries.
    """
    clean_code = code.strip().upper()
    if not clean_code or len(clean_code) > 64 or not re.match(r'^[A-Z0-9\-]+$', clean_code):
        return schemas.ReportVerificationResponse(
            valid=False,
            verification_code=clean_code,
            message="صيغة رمز التحقق غير صحيحة / Invalid verification code format"
        )

    # Search in AuditLog
    audit = db.query(models.AuditLog).filter(
        models.AuditLog.action == "REPORT_GENERATED"
    ).all()

    matching_entry = None
    parsed_details = {}
    for a in audit:
        if a.details:
            try:
                d = json.loads(a.details) if isinstance(a.details, str) else a.details
                if d.get("verification_code") == clean_code:
                    matching_entry = a
                    parsed_details = d
                    break
            except Exception:
                continue

    if not matching_entry:
        return schemas.ReportVerificationResponse(
            valid=False,
            verification_code=clean_code,
            message="رمز التحقق غير مسجل أو منتهي الصلاحية / Invalid or unregistered verification code"
        )

    org = db.query(models.Organization).filter(models.Organization.id == matching_entry.organizationId).first()
    org_name = org.name if org else "منصة بصيرة للبحث العلمي"

    return schemas.ReportVerificationResponse(
        valid=True,
        verification_code=clean_code,
        report_type=parsed_details.get("report_type"),
        organization_name=org_name,
        generated_at=matching_entry.timestamp,
        document_hash=parsed_details.get("document_hash"),
        message="الوثيقة معتمدة ومسجلة رسمياً في سجل النزاهة الأكاديمية / Verified Authentic Academic Document"
    )
