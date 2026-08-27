from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.research_lifecycle import accept_handoff, build_summary, create_handoff, mapping_create
from ..services.research_lifecycle import utc_now
from ..services.tenant_context import TenantContext, get_tenant_context


router = APIRouter(prefix="/research-lifecycle", tags=["research-lifecycle"])
# Edit-capable relationships on ResearchProjectMember, matching
# research_design.py's own established can_edit_section() precedent for
# this exact resource — never a generic organization role. RESEARCH_ASSISTANT
# is intentionally excluded here (its authority is section-scoped, and no
# lifecycle-record action here is section-scoped).
EDIT_CAPABLE_RELATIONSHIPS = {"PI", "CO_RESEARCHER", "DATA_ANALYST"}


class VariableMappingRequest(BaseModel):
    research_variable_id: str
    dataset_variable_id: str
    mapping_role: str = Field(default="MEASURE", max_length=50)


class HandoffRequest(BaseModel):
    handoff_type: str = Field(max_length=80)
    source_id: str
    target_id: str | None = None


def project_or_404(db: Session, project_id: str, context: TenantContext) -> models.ResearchProject:
    project = db.query(models.ResearchProject).filter(
        models.ResearchProject.id == project_id,
        models.ResearchProject.organizationId == context.organization.id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def require_project_write(project: models.ResearchProject, context: TenantContext, db: Session) -> None:
    # Cross-domain IAM consolidation Finding 1 (extended to this router):
    # generic ORGANIZATION_ADMIN/SUPERVISOR organization-role membership does
    # not imply lifecycle-record authority over a project the caller has no
    # relationship to — a resource-scoped ResearchProjectMember relationship
    # (or genuine ownership, or platform admin) is required, matching
    # research_design.py's own can_edit_section()/project_access() for this
    # exact resource, which this router previously diverged from.
    if context.is_global_admin or project.userId == context.user.id:
        return
    member = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == context.user.id,
        models.ResearchProjectMember.status == "ACTIVE",
        models.ResearchProjectMember.relationship.in_(EDIT_CAPABLE_RELATIONSHIPS),
    ).first()
    if not member:
        raise HTTPException(403, "Only the project owner or an authorized team member may create cross-path handoffs")


def serialize_handoff(item: models.AcademicHandoff) -> dict[str, Any]:
    # Deliberately excludes the payload: aggregate/list APIs must not become a
    # side channel for statistical results or future confidential data.
    return {
        "id": item.id, "project_id": item.project_id, "handoff_type": item.handoff_type,
        "source_entity_type": item.source_entity_type, "source_entity_id": item.source_entity_id,
        "source_version": item.source_version, "target_domain": item.target_domain,
        "target_entity_type": item.target_entity_type, "target_entity_id": item.target_entity_id,
        "schema_version": item.schema_version, "status": item.status,
        "created_at": item.created_at, "accepted_at": item.accepted_at, "stale_at": item.stale_at,
    }


@router.get("/projects/{project_id}")
def lifecycle_summary(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = project_or_404(db, project_id, context)
    summary = build_summary(db, project, context.user.id)
    db.commit()
    return {
        **summary,
        "project": {
            "id": project.id, "title_ar": project.titleAr, "title_en": project.titleEn,
            "research_type": project.studyDesign, "lead_researcher_id": project.userId,
            "organization_id": project.organizationId,
        },
    }


@router.get("/projects/{project_id}/handoffs")
def list_handoffs(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project_or_404(db, project_id, context)
    items = db.query(models.AcademicHandoff).filter(
        models.AcademicHandoff.organization_id == context.organization.id,
        models.AcademicHandoff.project_id == project_id,
    ).order_by(models.AcademicHandoff.created_at.desc()).all()
    return [serialize_handoff(item) for item in items]


@router.post("/projects/{project_id}/handoffs", status_code=201)
def create_project_handoff(project_id: str, payload: HandoffRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = project_or_404(db, project_id, context)
    require_project_write(project, context, db)
    item = create_handoff(db, project, payload.handoff_type, payload.source_id, payload.target_id, context.user.id)
    db.add(models.AuditLog(
        id=f"aud-{item.id}", userId=context.user.id, organizationId=context.organization.id,
        action="ACADEMIC_HANDOFF_CREATED",
        details=f"project={project.id}; handoff={item.id}; type={item.handoff_type}",
        timestamp=item.created_at,
    ))
    db.commit()
    return serialize_handoff(item)


@router.post("/projects/{project_id}/handoffs/{handoff_id}/accept")
def accept_project_handoff(project_id: str, handoff_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = project_or_404(db, project_id, context)
    require_project_write(project, context, db)
    item = db.query(models.AcademicHandoff).filter(
        models.AcademicHandoff.id == handoff_id,
        models.AcademicHandoff.project_id == project.id,
        models.AcademicHandoff.organization_id == context.organization.id,
    ).first()
    if not item:
        raise HTTPException(404, "Handoff not found")
    accept_handoff(db, item, context.user.id)
    db.commit()
    return serialize_handoff(item)


@router.post("/projects/{project_id}/variable-mappings", status_code=201)
def create_variable_mapping(project_id: str, payload: VariableMappingRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = project_or_404(db, project_id, context)
    require_project_write(project, context, db)
    item = mapping_create(db, project, payload.research_variable_id, payload.dataset_variable_id, payload.mapping_role, context.user.id)
    db.commit()
    return {
        "id": item.id, "project_id": item.project_id,
        "research_variable_id": item.research_variable_id,
        "dataset_variable_id": item.dataset_variable_id,
        "mapping_role": item.mapping_role,
    }


@router.post("/projects/{project_id}/analyses/{analysis_id}/approve")
def approve_analysis_result(project_id: str, analysis_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = project_or_404(db, project_id, context)
    require_project_write(project, context, db)
    analysis = db.query(models.ResearchAnalysis).filter(
        models.ResearchAnalysis.id == analysis_id,
        models.ResearchAnalysis.project_id == project.id,
        models.ResearchAnalysis.organization_id == context.organization.id,
    ).first()
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    dataset = db.query(models.ResearchDataset).filter(
        models.ResearchDataset.id == analysis.dataset_id,
        models.ResearchDataset.organization_id == context.organization.id,
    ).first()
    if analysis.status != "COMPLETED" or not dataset or dataset.current_version_id != analysis.dataset_version_id:
        raise HTTPException(409, "A stale or incomplete analysis cannot be approved")
    if not analysis.approved_at:
        analysis.approved_by = context.user.id
        analysis.approved_at = utc_now()
        db.add(models.AuditLog(
            id=f"aud-approve-{analysis.id}", userId=context.user.id,
            organizationId=context.organization.id, action="ANALYSIS_RESULT_APPROVED",
            details=f"project={project.id}; analysis={analysis.id}; dataset_version={analysis.dataset_version_id}",
            timestamp=analysis.approved_at,
        ))
        db.commit()
    return {"analysis_id": analysis.id, "approved": True, "approved_by": analysis.approved_by, "approved_at": analysis.approved_at}


@router.get("/projects/{project_id}/lineage")
def project_lineage(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project_or_404(db, project_id, context)
    edges = db.query(models.ResearchLineageEdge).filter(
        models.ResearchLineageEdge.organization_id == context.organization.id,
        models.ResearchLineageEdge.project_id == project_id,
    ).order_by(models.ResearchLineageEdge.created_at.asc()).all()
    return {
        "project_id": project_id,
        "edges": [{
            "id": e.id, "source": {"type": e.source_entity_type, "id": e.source_entity_id, "version": e.source_version},
            "relationship": e.relationship_type,
            "target": {"type": e.target_entity_type, "id": e.target_entity_id, "version": e.target_version},
            "created_at": e.created_at,
        } for e in edges],
    }


@router.get("/projects/{project_id}/timeline")
def project_timeline(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project_or_404(db, project_id, context)
    handoffs = db.query(models.AcademicHandoff).filter(
        models.AcademicHandoff.organization_id == context.organization.id,
        models.AcademicHandoff.project_id == project_id,
    ).all()
    datasets = db.query(models.ResearchDataset).filter(
        models.ResearchDataset.organization_id == context.organization.id,
        models.ResearchDataset.project_id == project_id,
    ).all()
    analyses = db.query(models.ResearchAnalysis).filter(
        models.ResearchAnalysis.organization_id == context.organization.id,
        models.ResearchAnalysis.project_id == project_id,
    ).all()
    assets = db.query(models.ScholarlyAsset).filter(
        models.ScholarlyAsset.organization_id == context.organization.id,
        models.ScholarlyAsset.source_record_id == project_id,
        models.ScholarlyAsset.deleted_at.is_(None),
    ).all()
    reviews = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.organization_id == context.organization.id,
        models.PeerReviewCase.project_id == project_id,
    ).all()
    events: list[dict[str, Any]] = []
    events.extend({"id": d.id, "type": "DATASET_CREATED", "occurred_at": d.created_at, "title": d.name, "resource_type": "DATASET"} for d in datasets)
    events.extend({"id": a.id, "type": "ANALYSIS_RECORDED", "occurred_at": a.created_at, "title": a.analysis_type, "status": a.status, "resource_type": "ANALYSIS"} for a in analyses)
    events.extend({"id": a.id, "type": "OUTPUT_CREATED", "occurred_at": a.created_at, "title": a.title_ar or a.title_en, "status": a.lifecycle_status, "resource_type": "SCHOLARLY_ASSET"} for a in assets)
    events.extend({"id": r.id, "type": "REVIEW_CASE_CREATED", "occurred_at": r.created_at, "title": r.title_ar or r.title_en, "status": r.status, "resource_type": "PEER_REVIEW_CASE"} for r in reviews)
    events.extend({"id": h.id, "type": "ACADEMIC_HANDOFF", "occurred_at": h.created_at, "title": h.handoff_type, "status": h.status, "resource_type": "HANDOFF"} for h in handoffs)
    events.sort(key=lambda item: item["occurred_at"], reverse=True)
    # No reviewer identity, assignment, confidential comment, raw data, or
    # handoff payload is ever included in this aggregate response.
    return {"project_id": project_id, "events": events[:100]}
