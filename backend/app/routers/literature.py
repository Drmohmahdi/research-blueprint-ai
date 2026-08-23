import datetime
import math
import uuid
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.sanitization import sanitize_text

router = APIRouter(prefix="/projects", tags=["Literature & PRISMA Persistence"])


def calculate_meta_analysis_metrics(studies: List[models.LiteratureStudy]) -> dict:
    valid_studies = [
        s for s in studies
        if s.sampleSize > 0 and s.ciUpper > s.ciLower
    ]
    total_n = sum(s.sampleSize for s in valid_studies)

    weighted = []
    for s in valid_studies:
        se = (s.ciUpper - s.ciLower) / (2.0 * 1.96)
        if se > 0:
            weight = 1.0 / (se * se)
            weighted.append((s, weight))

    total_weight = sum(w for _, w in weighted)
    if total_weight > 0:
        pooled_es = sum(s.effectSize * w for s, w in weighted) / total_weight
        pooled_ci = 1.96 / math.sqrt(total_weight)
        pooled_lower = round(pooled_es - pooled_ci, 2)
        pooled_upper = round(pooled_es + pooled_ci, 2)
        pooled_es_rounded = round(pooled_es, 2)

        q = sum(w * ((s.effectSize - pooled_es) ** 2) for s, w in weighted)
        k = len(weighted)
        if k > 1 and q > 0:
            i2 = max(0.0, min(100.0, ((q - (k - 1)) / q) * 100.0))
        else:
            i2 = 0.0
    else:
        pooled_es_rounded = 0.0
        pooled_lower = 0.0
        pooled_upper = 0.0
        q = 0.0
        i2 = 0.0

    return {
        "totalStudies": len(studies),
        "totalSampleCount": total_n,
        "pooledEffectSize": pooled_es_rounded,
        "pooledLower": pooled_lower,
        "pooledUpper": pooled_upper,
        "heterogeneityQ": round(q, 2),
        "heterogeneityI2": round(i2, 1)
    }


def get_verified_project(project_id: str, db: Session, context: TenantContext) -> models.ResearchProject:
    project = db.query(models.ResearchProject).filter(
        models.ResearchProject.id == project_id,
        models.ResearchProject.organizationId == context.organization.id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return project


# ── Literature Synthesis Endpoints ──────────────────────────────────────────

@router.get("/{project_id}/literature-synthesis", response_model=schemas.LiteratureSynthesisResponse)
def get_literature_synthesis(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    studies = db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.projectId == project.id
    ).order_by(models.LiteratureStudy.createdAt.asc()).all()

    metrics = calculate_meta_analysis_metrics(studies)
    return schemas.LiteratureSynthesisResponse(
        projectId=project.id,
        studies=[schemas.LiteratureStudySchema.model_validate(s) for s in studies],
        **metrics
    )


@router.post("/{project_id}/literature-synthesis/studies", response_model=schemas.LiteratureStudySchema, status_code=status.HTTP_201_CREATED)
def add_literature_study(
    project_id: str,
    payload: schemas.LiteratureStudyCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)

    # Input validation
    if payload.ciLower > payload.ciUpper:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Confidence interval lower bound cannot exceed upper bound"
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    study_id = payload.id if payload.id and payload.id.strip() else f"study-{str(uuid.uuid4())[:8]}"

    # Check for duplicate ID
    existing = db.query(models.LiteratureStudy).filter(models.LiteratureStudy.id == study_id).first()
    if existing:
        study_id = f"study-{str(uuid.uuid4())[:8]}"

    study = models.LiteratureStudy(
        id=study_id,
        projectId=project.id,
        organizationId=context.organization.id,
        author=sanitize_text(payload.author),
        year=payload.year,
        sampleSize=payload.sampleSize,
        effectSize=payload.effectSize,
        ciLower=payload.ciLower,
        ciUpper=payload.ciUpper,
        source=sanitize_text(payload.source or "manual"),
        doi=sanitize_text(payload.doi) if payload.doi else None,
        notes=sanitize_text(payload.notes) if payload.notes else None,
        createdAt=now,
        updatedAt=now
    )
    db.add(study)

    # Audit log
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="LITERATURE_STUDY_ADDED",
        details=f"Added study {study.id} ({study.author}, {study.year}) to project {project.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(study)
    return schemas.LiteratureStudySchema.model_validate(study)


@router.put("/{project_id}/literature-synthesis/sync", response_model=schemas.LiteratureSynthesisResponse)
def sync_literature_studies(
    project_id: str,
    payload: schemas.LiteratureStudyBatchSyncRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    now = datetime.datetime.now(datetime.UTC).isoformat()

    # Clear existing studies for this project
    db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.projectId == project.id
    ).delete(synchronize_session=False)

    new_studies = []
    for item in payload.studies:
        if item.ciLower > item.ciUpper:
            continue
        study_id = item.id if item.id and item.id.strip() else f"study-{str(uuid.uuid4())[:8]}"
        study = models.LiteratureStudy(
            id=study_id,
            projectId=project.id,
            organizationId=context.organization.id,
            author=sanitize_text(item.author),
            year=item.year,
            sampleSize=item.sampleSize,
            effectSize=item.effectSize,
            ciLower=item.ciLower,
            ciUpper=item.ciUpper,
            source=sanitize_text(item.source or "manual"),
            doi=sanitize_text(item.doi) if item.doi else None,
            notes=sanitize_text(item.notes) if item.notes else None,
            createdAt=now,
            updatedAt=now
        )
        db.add(study)
        new_studies.append(study)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="LITERATURE_STUDIES_SYNCED",
        details=f"Batch synchronized {len(new_studies)} studies for project {project.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    # Query refreshed list
    all_studies = db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.projectId == project.id
    ).order_by(models.LiteratureStudy.createdAt.asc()).all()

    metrics = calculate_meta_analysis_metrics(all_studies)
    return schemas.LiteratureSynthesisResponse(
        projectId=project.id,
        studies=[schemas.LiteratureStudySchema.model_validate(s) for s in all_studies],
        **metrics
    )


@router.delete("/{project_id}/literature-synthesis/studies/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_literature_study(
    project_id: str,
    study_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    study = db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.id == study_id,
        models.LiteratureStudy.projectId == project.id
    ).first()

    if not study:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Literature study not found"
        )

    db.delete(study)
    now = datetime.datetime.now(datetime.UTC).isoformat()
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="LITERATURE_STUDY_DELETED",
        details=f"Deleted study {study_id} from project {project.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    return None


@router.delete("/{project_id}/literature-synthesis", status_code=status.HTTP_204_NO_CONTENT)
def clear_literature_synthesis(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    db.query(models.LiteratureStudy).filter(
        models.LiteratureStudy.projectId == project.id
    ).delete(synchronize_session=False)

    now = datetime.datetime.now(datetime.UTC).isoformat()
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="LITERATURE_SYNTHESIS_CLEARED",
        details=f"Cleared all literature studies for project {project.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    return None


# ── PRISMA Flow Endpoints ───────────────────────────────────────────────────

def serialize_prisma_response(flow: models.PrismaFlow) -> schemas.PrismaFlowResponse:
    screened = max(0, flow.identified - flow.duplicates)
    eligible = max(0, screened - flow.excludedScreening)
    included = max(0, eligible - flow.excludedEligibility)

    return schemas.PrismaFlowResponse(
        id=flow.id,
        projectId=flow.projectId,
        organizationId=flow.organizationId,
        identified=flow.identified,
        duplicates=flow.duplicates,
        excludedScreening=flow.excludedScreening,
        excludedEligibility=flow.excludedEligibility,
        screened=screened,
        eligible=eligible,
        included=included,
        source=flow.source,
        notes=flow.notes,
        createdAt=flow.createdAt,
        updatedAt=flow.updatedAt
    )


@router.get("/{project_id}/prisma-flow", response_model=schemas.PrismaFlowResponse)
def get_prisma_flow(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    flow = db.query(models.PrismaFlow).filter(
        models.PrismaFlow.projectId == project.id
    ).first()

    now = datetime.datetime.now(datetime.UTC).isoformat()
    if not flow:
        # Default empty PRISMA record
        return schemas.PrismaFlowResponse(
            id=f"prisma-{project.id}",
            projectId=project.id,
            organizationId=context.organization.id,
            identified=0,
            duplicates=0,
            excludedScreening=0,
            excludedEligibility=0,
            screened=0,
            eligible=0,
            included=0,
            source="manual",
            notes=None,
            createdAt=now,
            updatedAt=now
        )

    return serialize_prisma_response(flow)


@router.put("/{project_id}/prisma-flow", response_model=schemas.PrismaFlowResponse)
def upsert_prisma_flow(
    project_id: str,
    payload: schemas.PrismaFlowUpsertRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    now = datetime.datetime.now(datetime.UTC).isoformat()

    flow = db.query(models.PrismaFlow).filter(
        models.PrismaFlow.projectId == project.id
    ).first()

    if not flow:
        flow = models.PrismaFlow(
            id=f"prisma-{str(uuid.uuid4())[:8]}",
            projectId=project.id,
            organizationId=context.organization.id,
            identified=payload.identified,
            duplicates=payload.duplicates,
            excludedScreening=payload.excludedScreening,
            excludedEligibility=payload.excludedEligibility,
            source=sanitize_text(payload.source or "manual"),
            notes=sanitize_text(payload.notes) if payload.notes else None,
            createdAt=now,
            updatedAt=now
        )
        db.add(flow)
    else:
        flow.identified = payload.identified
        flow.duplicates = payload.duplicates
        flow.excludedScreening = payload.excludedScreening
        flow.excludedEligibility = payload.excludedEligibility
        flow.source = sanitize_text(payload.source or "manual")
        flow.notes = sanitize_text(payload.notes) if payload.notes else None
        flow.updatedAt = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PRISMA_FLOW_UPDATED",
        details=f"Updated PRISMA flow for project {project.id} (Identified: {payload.identified}, Included: {max(0, payload.identified - payload.duplicates - payload.excludedScreening - payload.excludedEligibility)})",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(flow)
    return serialize_prisma_response(flow)


@router.delete("/{project_id}/prisma-flow", status_code=status.HTTP_204_NO_CONTENT)
def reset_prisma_flow(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = get_verified_project(project_id, db, context)
    flow = db.query(models.PrismaFlow).filter(
        models.PrismaFlow.projectId == project.id
    ).first()

    if flow:
        db.delete(flow)
        now = datetime.datetime.now(datetime.UTC).isoformat()
        audit = models.AuditLog(
            id=secrets.token_hex(8),
            userId=context.user.id,
            organizationId=context.organization.id,
            action="PRISMA_FLOW_RESET",
            details=f"Reset PRISMA flow for project {project.id}",
            timestamp=now
        )
        db.add(audit)
        db.commit()
    return None
