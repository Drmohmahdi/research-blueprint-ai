import os
import re
import urllib.parse
import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..models import UploadedFile, ResearchProject, AuditLog
from .. import models
from ..services.tenant_context import get_tenant_context, TenantContext, record_usage_event
from ..services.storage import (
    get_storage_provider,
    StorageProvider,
    FileValidationService,
    FileAccessPolicy,
    StorageQuotaService,
    MAX_FILE_SIZE_BYTES
)
from ..services.research_design import project_access
from .. import schemas

router = APIRouter(prefix="/storage", tags=["storage"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. FILE UPLOAD ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=schemas.UploadedFileResponse, summary="Upload research file or document")
def upload_file(
    projectId: Optional[str] = Form(None),
    classification: Optional[str] = Form("INTERNAL"),
    category: Optional[str] = Form("RESEARCH_ATTACHMENT"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
    storage: StorageProvider = Depends(get_storage_provider)
):
    """
    Secure file upload endpoint for Baseerah.
    Performs server-side filename sanitization, magic bytes verification, MIME validation,
    storage quota checks, SHA-256 integrity calculation, and audit logging.
    """
    # 1. Verify the caller has an explicit relationship to the project, not just org membership
    if projectId:
        proj = project_access(db, projectId, context)
        if not proj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="المشروع البحثي غير موجود أو ليس لديك صلاحية للوصول إليه / Project not found or access denied"
            )

    # 2. Read incoming file content with streaming byte limit guard
    CHUNK_SIZE = 64 * 1024  # 64 KB
    content_buf = bytearray()
    total_read = 0
    try:
        while True:
            chunk = file.file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > MAX_FILE_SIZE_BYTES:
                max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"حجم البيانات المستلمة يتجاوز الحد الأقصى المسموح به ({max_mb} MB) / Actual received bytes exceed limit"
                )
            content_buf.extend(chunk)
        content = bytes(content_buf)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"فشل قراءة محتوى الملف / Failed to read uploaded file: {str(e)}"
        )

    # 3. Server-side Validation (Dangerous extensions, magic bytes, SHA-256)
    clean_filename, detected_mime, size_bytes, sha256_hash = FileValidationService.validate_file(
        file_content=content,
        filename=file.filename or "unnamed_file",
        declared_mime=file.content_type,
        context_category=category or "RESEARCH_ATTACHMENT"
    )

    # 4. Storage Quota & Entitlement Check — Concurrency-Safe Atomic Reservation
    max_storage_mb = context.limits.get("max_storage_mb", 100)

    if max_storage_mb == -1:
        # Unlimited plan: no quota gate.
        quota_ok = True
    else:
        max_storage_bytes = max_storage_mb * 1024 * 1024
        quota_ok = StorageQuotaService.reserve(
            db=db,
            org_id=context.organization.id,
            additional_bytes=size_bytes,
            max_storage_bytes=max_storage_bytes
        )

    if not quota_ok:
        # Audit log quota exceeded
        db.add(AuditLog(
            id=f"aud-{uuid.uuid4().hex[:12]}",
            organizationId=context.organization.id,
            userId=context.user.id,
            action="STORAGE_QUOTA_EXCEEDED",
            details=f"Storage quota exceeded: requested {size_bytes}B, active {StorageQuotaService.current_used_bytes(db, context.organization.id)}B, limit {max_storage_mb}MB",
            timestamp=datetime.datetime.now(datetime.UTC).isoformat()
        ))
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"لقد تجاوزت المساحة المتاحة للتخزين في باقتك الحالية ({round(StorageQuotaService.current_used_bytes(db, context.organization.id) / (1024*1024), 2)}MB / {max_storage_mb}MB)"
        )

    # 5. Persist to Storage Provider
    storage_key = None
    try:
        storage_key, hash_stored, final_size = storage.save_file(
            file_content=content,
            filename=clean_filename,
            mime_type=detected_mime,
            org_id=context.organization.id
        )
    except Exception as e:
        # Release the quota reservation so a failed upload does not leak quota.
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="فشل حفظ الملف في وحدة التخزين السحابية / Storage engine write failure"
        )

    # 6. Persist Metadata in Database with Compensation Rollback
    try:
        now = datetime.datetime.now(datetime.UTC).isoformat()
        db_file = UploadedFile(
            id=f"fil-{uuid.uuid4().hex[:8]}",
            organization_id=context.organization.id,
            project_id=projectId,
            uploaded_by=context.user.id,
            storage_key=storage_key,
            filename=clean_filename,
            mime_type=detected_mime,
            size_bytes=final_size,
            checksum=hash_stored,
            classification=classification or "INTERNAL",
            scan_status="UNSCANNED",
            created_at=now
        )
        db.add(db_file)

        # 7. Audit Log + Usage Event — all committed in the single commit below
        db.add(AuditLog(
            id=f"aud-{uuid.uuid4().hex[:12]}",
            organizationId=context.organization.id,
            userId=context.user.id,
            action="FILE_UPLOADED",
            details=f"Uploaded file {clean_filename} ({final_size} bytes)",
            after_json={
                "filename": clean_filename,
                "size_bytes": final_size,
                "mime_type": detected_mime,
                "sha256": hash_stored
            },
            timestamp=now
        ))

        record_usage_event(
            db=db,
            org_id=context.organization.id,
            user_id=context.user.id,
            event_type="FILE_UPLOAD_BYTES",
            quantity=float(final_size),
            metadata={"filename": clean_filename, "projectId": projectId, "sha256": hash_stored}
        )

        db.commit()
        db.refresh(db_file)
    except Exception as db_exc:
        db.rollback()
        # Compensation: Delete the written storage blob so no silent orphan remains.
        if storage_key:
            try:
                storage.delete_file(storage_key)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="فشل تسجيل بيانات الملف في قاعدة البيانات / Database persistence failure"
        )

    return schemas.UploadedFileResponse(
        id=db_file.id,
        filename=db_file.filename,
        mime_type=db_file.mime_type,
        size_bytes=db_file.size_bytes,
        classification=db_file.classification,
        created_at=db_file.created_at
    )



# ─────────────────────────────────────────────────────────────────────────────
# 2. FILE LISTING & METADATA
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/list", response_model=List[schemas.UploadedFileResponse], summary="List organization files")
@router.get("/files", response_model=List[schemas.UploadedFileResponse], summary="List organization files (alias)")
def list_files(
    projectId: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    """
    Returns files belonging strictly to the authenticated organization.
    Filters out soft-deleted files.
    """
    query = db.query(UploadedFile).filter(
        UploadedFile.organization_id == context.organization.id,
        UploadedFile.deleted_at.is_(None)
    )

    if projectId:
        query = query.filter(UploadedFile.project_id == projectId)

    # If researcher role, only files accessible
    files = query.order_by(UploadedFile.created_at.desc()).offset(offset).limit(limit).all()
    
    # Filter by FileAccessPolicy
    accessible_files = [
        f for f in files
        if FileAccessPolicy.can_read_file(context.user, context.organization, context.role, f, db)
    ]
    return accessible_files


@router.get("/files/{file_id}", response_model=schemas.UploadedFileResponse, summary="Get file metadata")
def get_file_metadata(
    file_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    """
    Returns metadata for a specific file after validating multi-tenant and ownership permissions.
    """
    db_file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organization_id == context.organization.id,
        UploadedFile.deleted_at.is_(None)
    ).first()

    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الملف غير موجود / File not found")

    if not FileAccessPolicy.can_read_file(context.user, context.organization, context.role, db_file, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ليس لديك صلاحية للاطلاع على هذا الملف / Access denied to this file"
        )

    return db_file


# ─────────────────────────────────────────────────────────────────────────────
# 3. SECURE FILE DOWNLOAD
# ─────────────────────────────────────────────────────────────────────────────

def _serve_file_response(db_file: UploadedFile, storage: StorageProvider) -> FileResponse:
    """Helper to serve file safely with security headers and RFC 5987 / 6266 filename encoding."""
    if not storage.file_exists(db_file.storage_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical file not found in storage")

    full_path = storage.get_file_path(db_file.storage_key)

    # Sanitize and encode filename for Content-Disposition header
    safe_name = FileValidationService.sanitize_filename(db_file.filename)
    encoded_filename = urllib.parse.quote(safe_name)
    ascii_fallback = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", safe_name) or "file"

    headers = {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Content-Disposition": f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded_filename}',
        "X-Storage-Integrity-SHA256": db_file.checksum or ""
    }

    return FileResponse(
        path=full_path,
        media_type=db_file.mime_type,
        headers=headers
    )



@router.get("/download/{org_id}/{file_id}", summary="Download file (tenant scoped)")
def download_file_legacy(
    org_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
    storage: StorageProvider = Depends(get_storage_provider)
):
    # 1. Enforce strict tenant isolation
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization's storage"
        )

    # 2. Query file metadata
    db_file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organization_id == org_id,
        UploadedFile.deleted_at.is_(None)
    ).first()

    if not db_file:
        # Try matching by storage_key suffix
        db_file = db.query(UploadedFile).filter(
            UploadedFile.storage_key.like(f"%{file_id}%"),
            UploadedFile.organization_id == org_id,
            UploadedFile.deleted_at.is_(None)
        ).first()

    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # 3. Horizontal and role-based authorization check
    if not FileAccessPolicy.can_read_file(context.user, context.organization, context.role, db_file, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this file"
        )

    return _serve_file_response(db_file, storage)


@router.get("/files/{file_id}/download", summary="Download file directly")
def download_file_direct(
    file_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
    storage: StorageProvider = Depends(get_storage_provider)
):
    db_file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organization_id == context.organization.id,
        UploadedFile.deleted_at.is_(None)
    ).first()

    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الملف غير موجود / File not found")

    if not FileAccessPolicy.can_read_file(context.user, context.organization, context.role, db_file, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ليس لديك صلاحية لتحميل هذا الملف / Access denied to download this file"
        )

    return _serve_file_response(db_file, storage)


# ─────────────────────────────────────────────────────────────────────────────
# 4. FILE DELETION & HISTORICAL IMMUTABILITY
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/files/{file_id}", summary="Delete file (authorized & immutability aware)")
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
    storage: StorageProvider = Depends(get_storage_provider)
):
    """
    Deletes a file safely while enforcing historical immutability rules.
    Files attached to active peer review rounds or verified promotion dossiers cannot be deleted.
    """
    db_file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organization_id == context.organization.id,
        UploadedFile.deleted_at.is_(None)
    ).first()

    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الملف غير موجود / File not found")

    # Authorization and Historical Immutability check
    can_delete, reason = FileAccessPolicy.can_delete_file(
        context.user, context.organization, context.role, db_file, db
    )
    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=reason
        )

    # Perform soft delete
    now = datetime.datetime.now(datetime.UTC).isoformat()
    db_file.deleted_at = now

    # Release the storage quota consumed by this file (floor at 0)
    try:
        StorageQuotaService.release(db, context.organization.id, db_file.size_bytes or 0)
    except Exception:
        pass

    # Audit log
    db.add(AuditLog(
        id=f"aud-{uuid.uuid4().hex[:12]}",
        organizationId=context.organization.id,
        userId=context.user.id,
        action="FILE_DELETED",
        details=f"Deleted file {db_file.filename} ({db_file.size_bytes} bytes)",
        after_json={
            "filename": db_file.filename,
            "size_bytes": db_file.size_bytes
        },
        timestamp=now
    ))

    db.commit()
    return {"status": "ok", "message": "تم حذف الملف بنجاح / File deleted successfully"}
