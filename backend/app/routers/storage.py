import os
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from ..db import get_db
from ..models import UploadedFile, ResearchProject
from .. import models
from ..services.tenant_context import get_tenant_context, TenantContext, record_usage_event
from ..services.storage import get_storage_provider, StorageProvider
from .. import schemas

router = APIRouter(prefix="/storage", tags=["storage"])

@router.post("/upload", response_model=schemas.UploadedFileResponse)
def upload_file(
    projectId: Optional[str] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
    storage: StorageProvider = Depends(get_storage_provider)
):
    # Verify project access if projectId is provided
    if projectId:
        proj = db.query(ResearchProject).filter(
            ResearchProject.id == projectId,
            ResearchProject.organizationId == context.organization.id
        ).first()
        if not proj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )

    # 1. Read file content and size
    content = file.file.read()
    size_bytes = len(content)
    
    # 2. Check storage limit for active plan
    # Query current total storage usage in MB
    current_period = datetime.datetime.now(datetime.UTC).strftime("%Y-%m")
    total_bytes_used = db.query(func.sum(models.UsageEvent.quantity)).filter(
        models.UsageEvent.organization_id == context.organization.id,
        models.UsageEvent.event_type == "FILE_UPLOAD_BYTES"
    ).scalar() or 0.0

    max_storage_mb = context.limits.get("max_storage_mb", 50)
    max_storage_bytes = max_storage_mb * 1024 * 1024
    
    if total_bytes_used + size_bytes > max_storage_bytes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"لقد تجاوزت المساحة المتاحة للتخزين في باقتك الحالية ({round(total_bytes_used / (1024*1024), 2)}MB / {max_storage_mb}MB)"
        )

    # 3. Save to storage provider
    storage_key = storage.save_file(content, file.filename, file.content_type, context.organization.id)
    
    # 4. Save metadata to db
    now = datetime.datetime.now(datetime.UTC).isoformat()
    db_file = UploadedFile(
        id=f"fil-{str(uuid.uuid4())[:8]}",
        organization_id=context.organization.id,
        project_id=projectId,
        uploaded_by=context.user.id,
        storage_key=storage_key,
        filename=file.filename,
        mime_type=file.content_type,
        size_bytes=size_bytes,
        classification="INTERNAL",
        scan_status="CLEAN",
        created_at=now
    )
    db.add(db_file)
    
    # Record usage event
    record_usage_event(
        db=db,
        org_id=context.organization.id,
        user_id=context.user.id,
        event_type="FILE_UPLOAD_BYTES",
        quantity=float(size_bytes),
        metadata={"filename": file.filename, "projectId": projectId}
    )

    db.commit()
    db.refresh(db_file)
    
    return schemas.UploadedFileResponse(
        id=db_file.id,
        filename=db_file.filename,
        mime_type=db_file.mime_type,
        size_bytes=db_file.size_bytes,
        classification=db_file.classification,
        created_at=db_file.created_at
    )


@router.get("/list", response_model=List[schemas.UploadedFileResponse])
def list_files(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    files = db.query(UploadedFile).filter(
        UploadedFile.organization_id == context.organization.id,
        UploadedFile.deleted_at == None
    ).all()
    return files


@router.get("/download/{org_id}/{file_id}")
def download_file(
    org_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Enforce tenant isolation
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this resource"
        )
        
    db_file = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organization_id == org_id
    ).first()
    
    if not db_file:
        # Try matching by storage_key suffix in case file_id is the uuid filename
        db_file = db.query(UploadedFile).filter(
            UploadedFile.storage_key.like(f"%{file_id}%"),
            UploadedFile.organization_id == org_id
        ).first()

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    full_path = os.path.join("storage_files", db_file.storage_key)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Physical file not found in local storage")
        
    return FileResponse(
        path=full_path,
        media_type=db_file.mime_type,
        filename=db_file.filename
    )

