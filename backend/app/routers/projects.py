from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import secrets
import datetime
import uuid
from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.sanitization import sanitize_text
from ..services.research_design import project_access, member_relationship

# Edit-capable relationships on ResearchProjectMember for a full-project
# overwrite — matches research_lifecycle.py's own EDIT_CAPABLE_RELATIONSHIPS,
# itself matching research_design.py's can_edit_section() precedent.
# RESEARCH_ASSISTANT is excluded: its authority is section-scoped, and these
# endpoints replace the whole project, not one section.
_EDIT_CAPABLE_RELATIONSHIPS = {"PI", "CO_RESEARCHER", "DATA_ANALYST"}


def _require_project_edit(db: Session, project: models.ResearchProject, context: TenantContext) -> None:
    if context.is_global_admin or project.userId == context.user.id:
        return
    if member_relationship(db, project, context.user.id) in _EDIT_CAPABLE_RELATIONSHIPS:
        return
    raise HTTPException(status_code=403, detail="Only the project owner or an authorized team member may modify this project")

def sanitize_project_data(project: schemas.ProjectCreate) -> schemas.ProjectCreate:
    project.titleAr = sanitize_text(project.titleAr)
    project.titleEn = sanitize_text(project.titleEn)
    project.departmentAr = sanitize_text(project.departmentAr)
    project.departmentEn = sanitize_text(project.departmentEn)
    project.institutionAr = sanitize_text(project.institutionAr)
    project.institutionEn = sanitize_text(project.institutionEn)
    project.descriptionAr = sanitize_text(project.descriptionAr)
    project.descriptionEn = sanitize_text(project.descriptionEn)
    project.problemStatementAr = sanitize_text(project.problemStatementAr)
    project.problemStatementEn = sanitize_text(project.problemStatementEn)
    project.objectives = sanitize_text(project.objectives)
    project.timeline = sanitize_text(project.timeline)
    project.ethics = sanitize_text(project.ethics)

    if project.ethicsFeasibilityPlan:
        project.ethicsFeasibilityPlan.consentPlan = sanitize_text(project.ethicsFeasibilityPlan.consentPlan)
        project.ethicsFeasibilityPlan.privacyPlan = sanitize_text(project.ethicsFeasibilityPlan.privacyPlan)
        project.ethicsFeasibilityPlan.riskMitigationPlan = sanitize_text(project.ethicsFeasibilityPlan.riskMitigationPlan)
    
    for v in project.variables:
        v.nameAr = sanitize_text(v.nameAr)
        v.nameEn = sanitize_text(v.nameEn)
        v.descriptionAr = sanitize_text(v.descriptionAr)
        v.descriptionEn = sanitize_text(v.descriptionEn)
        
    for q in project.questions:
        q.textAr = sanitize_text(q.textAr)
        q.textEn = sanitize_text(q.textEn)
        
    for h in project.hypotheses:
        h.textAr = sanitize_text(h.textAr)
        h.textEn = sanitize_text(h.textEn)

    for instrument in project.measurementInstruments or []:
        instrument.name = sanitize_text(instrument.name)
        instrument.scoringPlan = sanitize_text(instrument.scoringPlan)
        instrument.validityPlan = sanitize_text(instrument.validityPlan)

    for analysis_plan in project.hypothesisAnalysisPlans or []:
        analysis_plan.assumptionsPlan = sanitize_text(analysis_plan.assumptionsPlan)
        analysis_plan.notes = sanitize_text(analysis_plan.notes)
        
    return project

router = APIRouter(prefix="/projects", tags=["projects"])

def serialize_project_model(proj: models.ResearchProject) -> schemas.ProjectResponse:
    # Convert model relationships and JSON fields back to Pydantic schema
    return schemas.ProjectResponse(
        id=proj.id,
        titleAr=proj.titleAr,
        titleEn=proj.titleEn,
        departmentAr=proj.departmentAr,
        departmentEn=proj.departmentEn,
        institutionAr=proj.institutionAr,
        institutionEn=proj.institutionEn,
        descriptionAr=proj.descriptionAr,
        descriptionEn=proj.descriptionEn,
        problemStatementAr=proj.problemStatementAr,
        problemStatementEn=proj.problemStatementEn,
        studyDesign=proj.studyDesign,
        variables=[
            schemas.VariableSchema(
                id=v.id,
                nameAr=v.nameAr,
                nameEn=v.nameEn,
                type=v.type,
                scale=v.scale,
                maxValue=v.maxValue,
                minValue=v.minValue,
                descriptionAr=v.descriptionAr,
                descriptionEn=v.descriptionEn
            ) for v in proj.variables
        ],
        questions=[
            schemas.QuestionSchema(
                id=q.id,
                textAr=q.textAr,
                textEn=q.textEn,
                associatedVariables=q.associatedVariables
            ) for q in proj.questions
        ],
        hypotheses=[
            schemas.HypothesisSchema(
                id=h.id,
                questionId=h.questionId or "",
                textAr=h.textAr,
                textEn=h.textEn,
                type=h.type,
                independentVarId=h.independentVarId or "",
                dependentVarId=h.dependentVarId or "",
                mediatorVarId=h.mediatorVarId,
                moderatorVarId=h.moderatorVarId
            ) for h in proj.hypotheses
        ],
        sampleSettings=schemas.SampleSettingsSchema(**proj.sampleSettings),
        preRegistrationHash=proj.preRegistrationHash,
        preRegistrationLockedAt=proj.preRegistrationLockedAt,
        preRegistrationHistory=proj.preRegistrationHistory,
        version=proj.version,
        activePathId=proj.activePathId,
        completedSteps=proj.completedSteps,
        intelligenceProfile=proj.intelligenceProfile,
        organizationId=proj.organizationId,
        objectives=proj.objectives,
        timeline=proj.timeline,
        ethics=proj.ethics,
        ethicsFeasibilityPlan=proj.ethicsFeasibilityPlan,
        measurementInstruments=proj.measurementInstruments,
        hypothesisAnalysisPlans=proj.hypothesisAnalysisPlans
    )

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import sys
import os

is_testing = "pytest" in sys.modules or os.getenv("TESTING") == "True"
limiter = Limiter(key_func=get_remote_address, enabled=not is_testing)

@router.post("", response_model=schemas.ProjectResponse)
@limiter.limit("5/minute")
def create_project(
    request: Request,
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = sanitize_project_data(project)
    
    # Enforce atomic project limit for organization's active plan
    from ..services.billing import EntitlementService
    project_count = db.query(models.ResearchProject).filter(
        models.ResearchProject.organizationId == context.organization.id
    ).count()
    EntitlementService.require_limit(db, context.organization.id, "MAX_PROJECTS", project_count)

    # Generate unique ID
    project_id = f"proj-{int(db.query(models.ResearchProject).count() + 1)}"
    
    db_project = models.ResearchProject(
        id=project_id,
        userId=context.user.id,
        organizationId=context.organization.id,
        titleAr=project.titleAr,
        titleEn=project.titleEn,
        departmentAr=project.departmentAr,
        departmentEn=project.departmentEn,
        institutionAr=project.institutionAr,
        institutionEn=project.institutionEn,
        descriptionAr=project.descriptionAr,
        descriptionEn=project.descriptionEn,
        problemStatementAr=project.problemStatementAr,
        problemStatementEn=project.problemStatementEn,
        studyDesign=project.studyDesign,
        sampleSettings=project.sampleSettings.model_dump(),
        objectives=project.objectives,
        timeline=project.timeline,
        ethics=project.ethics,
        ethicsFeasibilityPlan=project.ethicsFeasibilityPlan.model_dump() if project.ethicsFeasibilityPlan else None,
        measurementInstruments=[instrument.model_dump() for instrument in project.measurementInstruments or []],
        hypothesisAnalysisPlans=[analysis_plan.model_dump() for analysis_plan in project.hypothesisAnalysisPlans or []],
        preRegistrationHash=project.preRegistrationHash,
        preRegistrationLockedAt=project.preRegistrationLockedAt,
        preRegistrationHistory=[revision.model_dump() for revision in project.preRegistrationHistory or []],
        version=1
    )
    db.add(db_project)
    
    # Save variables
    for var in project.variables:
        db_var = models.ResearchVariable(
            id=var.id,
            projectId=project_id,
            nameAr=var.nameAr,
            nameEn=var.nameEn,
            type=var.type,
            scale=var.scale,
            maxValue=var.maxValue,
            minValue=var.minValue,
            descriptionAr=var.descriptionAr,
            descriptionEn=var.descriptionEn
        )
        db.add(db_var)

    # Save questions
    for q in project.questions:
        db_q = models.ResearchQuestion(
            id=q.id,
            projectId=project_id,
            textAr=q.textAr,
            textEn=q.textEn,
            associatedVariables=q.associatedVariables
        )
        db.add(db_q)

    # Save hypotheses
    for h in project.hypotheses:
        db_h = models.Hypothesis(
            id=h.id,
            projectId=project_id,
            questionId=h.questionId,
            textAr=h.textAr,
            textEn=h.textEn,
            type=h.type,
            independentVarId=h.independentVarId,
            dependentVarId=h.dependentVarId,
            mediatorVarId=h.mediatorVarId,
            moderatorVarId=h.moderatorVarId
        )
        db.add(db_h)

    # Audit creation
    db_audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="CREATE_PROJECT",
        details=f"Created project {project_id} - {project.titleEn}",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(db_audit)

    db.commit()
    db.refresh(db_project)
    return serialize_project_model(db_project)

@router.get("", response_model=List[schemas.ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Same-tenant horizontal boundary: this returns the full project record
    # (identical shape to get_project below), so it must not be org-wide —
    # scoped to ownership, an active ResearchProjectMember relationship, or
    # platform admin, matching research_design.py's project_access() for the
    # same resource.
    if context.is_global_admin:
        projects = db.query(models.ResearchProject).filter(
            models.ResearchProject.organizationId == context.organization.id
        ).all()
    else:
        member_project_ids = db.query(models.ResearchProjectMember.project_id).filter(
            models.ResearchProjectMember.user_id == context.user.id,
            models.ResearchProjectMember.status == "ACTIVE",
        )
        projects = db.query(models.ResearchProject).filter(
            models.ResearchProject.organizationId == context.organization.id,
            (models.ResearchProject.userId == context.user.id) |
            (models.ResearchProject.id.in_(member_project_ids)),
        ).all()
    return [serialize_project_model(p) for p in projects]

@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    proj = project_access(db, project_id, context)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    return serialize_project_model(proj)

@router.put("/{project_id}", response_model=schemas.ProjectResponse)
def update_project(
    project_id: str,
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    project = sanitize_project_data(project)
    db_project = project_access(db, project_id, context)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    _require_project_edit(db, db_project, context)

    # Update base fields
    db_project.titleAr = project.titleAr
    db_project.titleEn = project.titleEn
    db_project.departmentAr = project.departmentAr
    db_project.departmentEn = project.departmentEn
    db_project.institutionAr = project.institutionAr
    db_project.institutionEn = project.institutionEn
    db_project.descriptionAr = project.descriptionAr
    db_project.descriptionEn = project.descriptionEn
    db_project.problemStatementAr = project.problemStatementAr
    db_project.problemStatementEn = project.problemStatementEn
    db_project.studyDesign = project.studyDesign
    db_project.sampleSettings = project.sampleSettings.model_dump()
    db_project.objectives = project.objectives
    db_project.timeline = project.timeline
    db_project.ethics = project.ethics
    db_project.ethicsFeasibilityPlan = project.ethicsFeasibilityPlan.model_dump() if project.ethicsFeasibilityPlan else None
    db_project.measurementInstruments = [instrument.model_dump() for instrument in project.measurementInstruments or []]
    db_project.hypothesisAnalysisPlans = [analysis_plan.model_dump() for analysis_plan in project.hypothesisAnalysisPlans or []]
    db_project.preRegistrationHash = project.preRegistrationHash
    db_project.preRegistrationLockedAt = project.preRegistrationLockedAt
    db_project.preRegistrationHistory = [revision.model_dump() for revision in project.preRegistrationHistory or []]
    db_project.version += 1

    # Delete existing variables, questions, hypotheses and insert new
    db.query(models.ResearchVariable).filter(models.ResearchVariable.projectId == project_id).delete()
    db.query(models.ResearchQuestion).filter(models.ResearchQuestion.projectId == project_id).delete()
    db.query(models.Hypothesis).filter(models.Hypothesis.projectId == project_id).delete()

    for var in project.variables:
        db_var = models.ResearchVariable(
            id=var.id,
            projectId=project_id,
            nameAr=var.nameAr,
            nameEn=var.nameEn,
            type=var.type,
            scale=var.scale,
            maxValue=var.maxValue,
            minValue=var.minValue,
            descriptionAr=var.descriptionAr,
            descriptionEn=var.descriptionEn
        )
        db.add(db_var)

    for q in project.questions:
        db_q = models.ResearchQuestion(
            id=q.id,
            projectId=project_id,
            textAr=q.textAr,
            textEn=q.textEn,
            associatedVariables=q.associatedVariables
        )
        db.add(db_q)

    for h in project.hypotheses:
        db_h = models.Hypothesis(
            id=h.id,
            projectId=project_id,
            questionId=h.questionId,
            textAr=h.textAr,
            textEn=h.textEn,
            type=h.type,
            independentVarId=h.independentVarId,
            dependentVarId=h.dependentVarId,
            mediatorVarId=h.mediatorVarId,
            moderatorVarId=h.moderatorVarId
        )
        db.add(db_h)

    # Audit update
    db_audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="UPDATE_PROJECT",
        details=f"Updated project {project_id}",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(db_audit)

    db.commit()
    db.refresh(db_project)
    return serialize_project_model(db_project)

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    proj = project_access(db, project_id, context)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    # Deletion is irreversible and destroys every sub-resource — deliberately
    # narrower than the edit-capable set above: only the actual owner (or
    # platform admin) may delete, never a PI/co-researcher/data-analyst
    # relationship alone. No existing register or code establishes a broader
    # authority for this specific action, so none is invented here.
    if not (context.is_global_admin or proj.userId == context.user.id):
        raise HTTPException(status_code=403, detail="Only the project owner may delete this project")

    # Audit deletion
    db_audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="DELETE_PROJECT",
        details=f"Deleted project {project_id}",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(db_audit)

    db.delete(proj)
    db.commit()
    return None

class ProjectWorkflowProfileUpdateRequest(BaseModel):
    activePathId: Optional[str] = None
    completedSteps: Optional[List[str]] = None
    intelligenceProfile: Optional[Dict[str, Any]] = None

@router.post("/{project_id}/workflow-profile", response_model=schemas.ProjectResponse)
def update_project_workflow_profile(
    project_id: str,
    req: ProjectWorkflowProfileUpdateRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    db_project = project_access(db, project_id, context)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    _require_project_edit(db, db_project, context)

    if req.activePathId is not None:
        db_project.activePathId = req.activePathId
    if req.completedSteps is not None:
        db_project.completedSteps = req.completedSteps
    if req.intelligenceProfile is not None:
        db_project.intelligenceProfile = req.intelligenceProfile
        
    db_project.version += 1
    db.commit()
    db.refresh(db_project)
    return serialize_project_model(db_project)

@router.post("/{project_id}/create-manuscript")
def create_manuscript_from_project(
    project_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    db_project = project_access(db, project_id, context)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    _require_project_edit(db, db_project, context)

    # Get parent asset
    parent_asset_id = db_project.scholarly_asset_id
    if not parent_asset_id:
        # Auto-provision parent asset if missing
        parent_asset = models.ScholarlyAsset(
            id=str(uuid.uuid4()),
            organization_id=context.organization.id,
            owner_user_id=context.user.id,
            created_by=context.user.id,
            title_ar=db_project.titleAr,
            title_en=db_project.titleEn,
            abstract_ar=db_project.descriptionAr,
            abstract_en=db_project.descriptionEn,
            asset_type="RESEARCH_PROJECT",
            lifecycle_status="COMPLETED",
            source_module="research",
            source_record_id=db_project.id,
            created_at=datetime.datetime.now(datetime.UTC).isoformat()
        )
        db.add(parent_asset)
        db.flush()
        parent_asset_id = parent_asset.id
        db_project.scholarly_asset_id = parent_asset_id

    # Create child manuscript asset
    manuscript_asset = models.ScholarlyAsset(
        id=str(uuid.uuid4()),
        organization_id=context.organization.id,
        owner_user_id=context.user.id,
        created_by=context.user.id,
        title_ar=db_project.titleAr,
        title_en=db_project.titleEn,
        abstract_ar=db_project.descriptionAr,
        abstract_en=db_project.descriptionEn,
        asset_type="MANUSCRIPT",
        lifecycle_status="DRAFT",
        source_module="research",
        source_record_id=db_project.id,
        parent_asset_id=parent_asset_id,
        created_at=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(manuscript_asset)

    # Audit log
    db_audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="CREATE_MANUSCRIPT_FROM_PROJECT",
        details=f"Created child manuscript asset {manuscript_asset.id} for project {project_id}",
        timestamp=datetime.datetime.now(datetime.UTC).isoformat()
    )
    db.add(db_audit)
    db.commit()

    return {
        "ok": True,
        "manuscriptAssetId": manuscript_asset.id,
        "parentAssetId": parent_asset_id,
        "titleAr": manuscript_asset.title_ar,
        "titleEn": manuscript_asset.title_en,
        "lifecycleStatus": manuscript_asset.lifecycle_status
    }





