import datetime
import uuid
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.data_authz import (
    effective_access_level, grant_dataset_access, has_capability, list_dataset_grants,
    require_capability, resolve_capabilities, revoke_dataset_access,
)
from ..services.research_data import ENGINE_VERSION, decide_test, fingerprint, frame_records, infer_variables, load_tabular, quality_scan, run_analysis, safe_csv_value
from ..services.research_lifecycle import propagate_dataset_staleness
from ..services.storage import StorageProvider, get_storage_provider
from ..services.tenant_context import TenantContext, get_tenant_context

router = APIRouter(prefix="/research-data", tags=["research-data"])
now = lambda: datetime.datetime.now(datetime.UTC).isoformat()
uid = lambda prefix: f"{prefix}-{uuid.uuid4().hex[:16]}"

SENSITIVITY_LEVELS = {"NON_SENSITIVE", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"}
ANALYSIS_STATUS = {"DRAFT", "RUNNING", "COMPLETED", "FAILED", "STALE", "UNDER_REVIEW", "APPROVED", "REJECTED"}
REVIEW_RECOMMENDATIONS = {"APPROVED", "REVISIONS_REQUIRED", "REJECTED"}


def require_dataset_org(db: Session, dataset_id: str, org_id: str) -> models.ResearchDataset:
    dataset = db.query(models.ResearchDataset).filter(
        models.ResearchDataset.id == dataset_id,
        models.ResearchDataset.organization_id == org_id,
    ).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    return dataset


def dataset_or_404(db: Session, dataset_id: str, context: TenantContext) -> models.ResearchDataset:
    dataset = require_dataset_org(db, dataset_id, context.organization.id)
    require_capability(db, dataset, context, "VIEW_METADATA")
    return dataset


def project_or_404(db: Session, project_id: str, org_id: str):
    item = db.query(models.ResearchProject).filter(models.ResearchProject.id == project_id, models.ResearchProject.organizationId == org_id).first()
    if not item:
        raise HTTPException(404, "Project not found")
    return item


def version_or_404(db: Session, dataset_id: str, version_id: str, org_id: str):
    item = db.query(models.DatasetVersion).filter(models.DatasetVersion.id == version_id, models.DatasetVersion.dataset_id == dataset_id, models.DatasetVersion.organization_id == org_id).first()
    if not item:
        raise HTTPException(404, "Dataset version not found")
    return item


class ImportRequest(BaseModel):
    project_id: str
    uploaded_file_id: str
    name: str = Field(min_length=1, max_length=200)
    source_type: str = "OTHER"
    sensitivity: str = "INTERNAL"


class VariableUpdate(BaseModel):
    label_ar: str | None = None; label_en: str | None = None; description: str | None = None
    data_type: str | None = None; measurement_level: str | None = None; role: str | None = None
    allowed_values: list[Any] | None = None; missing_codes: list[Any] | None = None
    sensitive: bool | None = None; identifier: bool | None = None


class CleaningRequest(BaseModel):
    operation: str
    variable: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    change_summary: str = Field(min_length=1, max_length=500)


class DecisionRequest(BaseModel):
    objective: str; dependent_measurement_level: str; groups: int = Field(ge=1, le=100)
    paired: bool = False; normality_acceptable: bool = True


class AnalysisRequest(BaseModel):
    dataset_version_id: str
    analysis_type: str
    configuration: dict[str, Any]
    research_question_id: str | None = None
    hypothesis_id: str | None = None


class IssueResolution(BaseModel):
    status: str
    resolution: str = Field(min_length=3, max_length=500)


class GrantRequest(BaseModel):
    user_id: str
    capability: str
    reason: str | None = None
    expires_at: str | None = None


class RevokeRequest(BaseModel):
    user_id: str
    capability: str


class AnalysisReviewRequest(BaseModel):
    recommendation: str = Field(max_length=30)
    notes: str | None = Field(default=None, max_length=2000)


def serialize_dataset(item, db, context):
    version = db.query(models.DatasetVersion).filter(models.DatasetVersion.id == item.current_version_id).first()
    open_issues = db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == item.id, models.DatasetQualityIssue.status == "OPEN").count()
    level = effective_access_level(db, item, context)
    return {"id": item.id, "project_id": item.project_id, "name": item.name, "source_type": item.source_type,
            "sensitivity": item.sensitivity, "status": item.status, "current_version_id": item.current_version_id,
            "version": version.version_number if version else None, "rows": version.row_count if version else 0,
            "variables": version.column_count if version else 0, "open_quality_issues": open_issues,
            "access_level": level, "created_at": item.created_at, "updated_at": item.updated_at}


def _desensitize_columns(db: Session, dataset: models.ResearchDataset, context, include_sensitive: bool) -> list[str]:
    variables = db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == dataset.id).all()
    if include_sensitive:
        return [v.name for v in variables]
    return [v.name for v in variables if not v.sensitive and not v.identifier]


def _analysis_status(dataset: models.ResearchDataset, item: models.ResearchAnalysis) -> str:
    # Staleness takes precedence over prior approval: an approved analysis on
    # a superseded dataset version is no longer current and must be re-run.
    if dataset.current_version_id != item.dataset_version_id:
        return "STALE"
    return item.status


@router.post("/datasets", status_code=201)
def import_dataset(payload: ImportRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context), storage: StorageProvider = Depends(get_storage_provider)):
    project = project_or_404(db, payload.project_id, context.organization.id)
    from ..services.data_authz import project_relationship
    rel = project_relationship(db, project, context.user.id)
    if rel not in {"OWNER", "PI"}:
        raise HTTPException(403, "Only the project owner or PI may import datasets")
    sensitivity = payload.sensitivity.upper()
    if sensitivity not in SENSITIVITY_LEVELS:
        raise HTTPException(422, f"Unsupported sensitivity classification: {sensitivity}")
    uploaded = db.query(models.UploadedFile).filter(models.UploadedFile.id == payload.uploaded_file_id, models.UploadedFile.organization_id == context.organization.id,
        models.UploadedFile.project_id == payload.project_id, models.UploadedFile.deleted_at.is_(None)).first()
    if not uploaded: raise HTTPException(404, "Uploaded file not found")
    try: frame = load_tabular(storage.read_file_bytes(uploaded.storage_key), uploaded.filename)
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    records = frame_records(frame); stamp = now(); dataset_id = uid("ds"); version_id = uid("dsv")
    dataset = models.ResearchDataset(id=dataset_id, organization_id=context.organization.id, project_id=payload.project_id, owner_id=context.user.id,
        name=payload.name, source_type=payload.source_type.upper(), sensitivity=sensitivity, status="UNDER_REVIEW", current_version_id=version_id, created_at=stamp, updated_at=stamp)
    version = models.DatasetVersion(id=version_id, organization_id=context.organization.id, dataset_id=dataset_id, uploaded_file_id=uploaded.id, version_number="1.0", kind="RAW",
        fingerprint=fingerprint(records), row_count=len(frame), column_count=len(frame.columns), data_json=records, change_summary="Initial immutable import", created_by=context.user.id, created_at=stamp)
    db.add_all([dataset, version])
    for variable in infer_variables(frame): db.add(models.DatasetVariable(id=uid("var"), organization_id=context.organization.id, dataset_id=dataset_id, **variable))
    summary, issues = quality_scan(frame)
    for issue in issues: db.add(models.DatasetQualityIssue(id=uid("qi"), organization_id=context.organization.id, dataset_id=dataset_id, version_id=version_id, created_at=stamp, **issue))
    dataset.status = "READY" if summary["quality_score"] >= 90 and not any(i["severity"] == "HIGH" for i in issues) else "UNDER_REVIEW"
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="DATASET_IMPORTED", details=f"dataset={dataset_id}; version={version_id}; rows={len(frame)}; sensitivity={sensitivity}", timestamp=stamp))
    db.commit(); return {**serialize_dataset(dataset, db, context), "quality": summary}


@router.get("/projects/{project_id}/command-center")
def command_center(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project_or_404(db, project_id, context.organization.id)
    datasets = db.query(models.ResearchDataset).filter(models.ResearchDataset.project_id == project_id, models.ResearchDataset.organization_id == context.organization.id).all()
    datasets = [d for d in datasets if has_capability(db, d, context, "VIEW_METADATA")]
    variables = sum(db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == d.id).count() for d in datasets)
    open_issues = sum(db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == d.id, models.DatasetQualityIssue.status == "OPEN").count() for d in datasets)
    analyses = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.project_id == project_id, models.ResearchAnalysis.organization_id == context.organization.id).all()
    defined = sum(db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == d.id, models.DatasetVariable.measurement_level.isnot(None), models.DatasetVariable.role.isnot(None)).count() for d in datasets)
    definition = round(defined / max(1, variables) * 100)
    quality = max(0, 100 - min(60, open_issues * 5)); structure = 100 if datasets else 0
    plan = 100 if analyses else 40 if datasets else 0
    approved = sum(1 for a in analyses if _analysis_status(_dataset_of(db, a.dataset_id), a) == "APPROVED")
    stale = sum(1 for a in analyses if _analysis_status(_dataset_of(db, a.dataset_id), a) == "STALE")
    under_review = sum(1 for a in analyses if _analysis_status(_dataset_of(db, a.dataset_id), a) == "UNDER_REVIEW")
    sensitive = sum(1 for d in datasets if d.sensitivity in {"CONFIDENTIAL", "RESTRICTED"})
    with_identifiers = sum(1 for d in datasets if db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == d.id, models.DatasetVariable.identifier.is_(True)).count())
    if not datasets:
        next_action = {"priority": "CRITICAL", "title": "Import a research dataset"}
    elif open_issues:
        next_action = {"priority": "HIGH", "title": "Resolve open data quality issues"}
    elif not analyses:
        next_action = {"priority": "MEDIUM", "title": "Create and run the first linked analysis"}
    elif under_review:
        next_action = {"priority": "MEDIUM", "title": "Complete analysis review"}
    elif stale:
        next_action = {"priority": "HIGH", "title": "Re-run stale analyses against the current dataset version"}
    else:
        next_action = {"priority": "LOW", "title": "Review and pin validated results"}
    return {
        "metrics": {"datasets": len(datasets), "variables": variables, "quality_issues": open_issues,
                    "analyses": len(analyses), "approved_analyses": approved, "stale_analyses": stale,
                    "under_review_analyses": under_review},
        "indicators": {
            "data_readiness": round(structure * .5 + (100 if all(d.status == "READY" for d in datasets) else 40) * .5) if datasets else 0,
            "data_quality": quality,
            "analysis_readiness": plan,
            "analysis_completion": round(approved / max(1, len(analyses)) * 100) if analyses else 0,
            "approval_status": "APPROVED" if approved else ("UNDER_REVIEW" if under_review else "NONE"),
            "staleness": stale,
            "sensitive_status": "CONTAINS_SENSITIVE" if sensitive else ("HAS_IDENTIFIERS" if with_identifiers else "NON_SENSITIVE"),
            "next_best_data_action": next_action,
        },
        "next_action": next_action,
        "datasets": [serialize_dataset(d, db, context) for d in datasets],
    }


def _dataset_of(db: Session, dataset_id: str):
    return db.query(models.ResearchDataset).filter(models.ResearchDataset.id == dataset_id).first()


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    variables = db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == dataset_id).all()
    version = version_or_404(db, dataset_id, dataset.current_version_id, context.organization.id)
    summary, _ = quality_scan(pd.DataFrame(version.data_json))
    safe_variables = [{"id": v.id, "name": v.name, "label_ar": v.label_ar, "label_en": v.label_en, "data_type": v.data_type,
        "measurement_level": v.measurement_level, "role": v.role, "sensitive": v.sensitive, "identifier": v.identifier} for v in variables]
    can_sensitive = has_capability(db, dataset, context, "VIEW_SENSITIVE")
    can_deidentified = has_capability(db, dataset, context, "PREVIEW_DEIDENTIFIED")
    preview_columns = _desensitize_columns(db, dataset, context, include_sensitive=can_sensitive)
    preview = []
    if can_deidentified or can_sensitive:
        preview = [{k: row.get(k) for k in preview_columns} for row in version.data_json[:25]]
    return {**serialize_dataset(dataset, db, context), "fingerprint": version.fingerprint, "quality": summary,
            "dictionary": safe_variables, "preview": preview}


@router.get("/datasets/{dataset_id}/versions")
def list_versions(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset_or_404(db, dataset_id, context)
    rows = db.query(models.DatasetVersion).filter(models.DatasetVersion.dataset_id == dataset_id, models.DatasetVersion.organization_id == context.organization.id).order_by(models.DatasetVersion.created_at.desc()).all()
    return [{"id":v.id,"version":v.version_number,"kind":v.kind,"source_version_id":v.source_version_id,"fingerprint":v.fingerprint,"rows":v.row_count,"columns":v.column_count,"change_summary":v.change_summary,"created_at":v.created_at} for v in rows]


@router.get("/datasets/{dataset_id}/issues")
def list_issues(dataset_id: str, status_filter: str | None = None, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset_or_404(db, dataset_id, context)
    query = db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == dataset_id, models.DatasetQualityIssue.organization_id == context.organization.id)
    if status_filter: query = query.filter(models.DatasetQualityIssue.status == status_filter.upper())
    return [{"id":i.id,"version_id":i.version_id,"variable_name":i.variable_name,"issue_type":i.issue_type,"severity":i.severity,"status":i.status,"details":i.details,"resolution":i.resolution} for i in query.order_by(models.DatasetQualityIssue.created_at.desc()).all()]


@router.patch("/datasets/{dataset_id}/issues/{issue_id}")
def resolve_issue(dataset_id: str, issue_id: str, payload: IssueResolution, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    require_capability(db, dataset, context, "CLEAN")
    allowed = {"REVIEWED","RESOLVED","IGNORED_WITH_REASON"}
    if payload.status.upper() not in allowed: raise HTTPException(422, "Unsupported issue status")
    issue = db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.id == issue_id, models.DatasetQualityIssue.dataset_id == dataset_id, models.DatasetQualityIssue.organization_id == context.organization.id).first()
    if not issue: raise HTTPException(404, "Quality issue not found")
    issue.status=payload.status.upper(); issue.resolution=payload.resolution; dataset.updated_at=now()
    remaining=db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id==dataset_id,models.DatasetQualityIssue.status=="OPEN",models.DatasetQualityIssue.id!=issue_id).count()
    if remaining == 0: dataset.status="READY"
    db.add(models.AuditLog(id=uid("aud"),userId=context.user.id,organizationId=context.organization.id,action="QUALITY_ISSUE_RESOLVED",details=f"dataset={dataset_id}; issue={issue_id}; status={issue.status}",timestamp=now()))
    db.commit(); return {"id":issue.id,"status":issue.status,"dataset_status":dataset.status}


@router.get("/datasets/{dataset_id}/export.csv")
def export_dataset(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset=dataset_or_404(db,dataset_id,context); version=version_or_404(db,dataset_id,dataset.current_version_id,context.organization.id)
    can_sensitive = has_capability(db, dataset, context, "EXPORT_SENSITIVE") or has_capability(db, dataset, context, "DOWNLOAD_RAW")
    variables=db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id==dataset_id,models.DatasetVariable.organization_id==context.organization.id).all()
    allowed=[v.name for v in variables if can_sensitive or (not v.identifier and not v.sensitive)]
    if not can_sensitive and not has_capability(db, dataset, context, "PREVIEW_DEIDENTIFIED"):
        raise HTTPException(403, "De-identified export requires dataset preview access")
    frame=pd.DataFrame([{key:safe_csv_value(row.get(key)) for key in allowed} for row in version.data_json],columns=allowed)
    output=frame.to_csv(index=False).encode("utf-8-sig")
    safe_name="".join(c for c in dataset.name if c.isalnum() or c in "-_ ").strip() or "dataset"
    db.add(models.AuditLog(id=uid("aud"),userId=context.user.id,organizationId=context.organization.id,action="DATASET_EXPORTED",details=f"dataset={dataset_id}; version={version.id}; sensitive_columns_excluded={not can_sensitive}",timestamp=now())); db.commit()
    return StreamingResponse(iter([output]),media_type="text/csv; charset=utf-8",headers={"Content-Disposition":f'attachment; filename="{safe_name}.csv"'})


@router.patch("/datasets/{dataset_id}/variables/{variable_id}")
def update_variable(dataset_id: str, variable_id: str, payload: VariableUpdate, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    require_capability(db, dataset, context, "CLASSIFY")
    variable = db.query(models.DatasetVariable).filter(models.DatasetVariable.id == variable_id, models.DatasetVariable.dataset_id == dataset_id, models.DatasetVariable.organization_id == context.organization.id).first()
    if not variable: raise HTTPException(404, "Variable not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(variable, key, value)
    db.add(models.AuditLog(id=uid("aud"),userId=context.user.id,organizationId=context.organization.id,action="DATASET_VARIABLE_UPDATED",details=f"dataset={dataset_id}; variable_id={variable.id}; fields={','.join(payload.model_dump(exclude_unset=True).keys())}",timestamp=now()))
    db.commit(); return {"id": variable.id, "updated": True}


@router.post("/datasets/{dataset_id}/clean")
def clean_dataset(dataset_id: str, payload: CleaningRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    # Acquire the row-level lock FIRST, before any capability check, so that
    # the identity map has the locked version.  The lock serialises concurrent
    # cleaning requests: each subsequent thread observes the new current version.
    dataset = db.query(models.ResearchDataset).filter(
        models.ResearchDataset.id == dataset_id,
        models.ResearchDataset.organization_id == context.organization.id,
    ).with_for_update().first()
    if not dataset: raise HTTPException(404, "Dataset not found")
    from ..services.data_authz import require_capability
    require_capability(db, dataset, context, "CLEAN")
    source = version_or_404(db, dataset_id, dataset.current_version_id, context.organization.id)
    frame = pd.DataFrame(source.data_json); op = payload.operation.upper(); col = payload.variable
    if col and col not in frame.columns: raise HTTPException(422, "Variable does not exist")
    try:
        if op == "TRIM_TEXT": frame[col] = frame[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
        elif op == "REPLACE_MISSING_CODE": frame[col] = frame[col].replace(payload.parameters.get("codes", []), None)
        elif op == "NORMALIZE_CATEGORIES": frame[col] = frame[col].apply(lambda x: x.strip().casefold() if isinstance(x, str) else x)
        elif op == "RENAME_VARIABLE": frame = frame.rename(columns={col: payload.parameters["new_name"]})
        elif op == "FILTER_ROWS": frame = frame[frame[col] != payload.parameters["value"]]
        else: raise ValueError("Unsupported cleaning operation")
    except (KeyError, TypeError) as exc: raise HTTPException(422, "Invalid cleaning parameters") from exc
    records = frame_records(frame); major, minor = map(int, source.version_number.split(".")); stamp = now(); version_id = uid("dsv")
    version = models.DatasetVersion(id=version_id, organization_id=context.organization.id, dataset_id=dataset_id, source_version_id=source.id,
        version_number=f"{major}.{minor+1}", kind="CLEANED", fingerprint=fingerprint(records), row_count=len(frame), column_count=len(frame.columns),
        data_json=records, change_summary=payload.change_summary, created_by=context.user.id, created_at=stamp)
    db.add(version); dataset.current_version_id=version_id; dataset.updated_at=stamp
    if op == "RENAME_VARIABLE":
        variable=db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id==dataset_id,models.DatasetVariable.name==col).first()
        if variable: variable.name=payload.parameters["new_name"]
    summary, issues=quality_scan(frame)
    for issue in issues: db.add(models.DatasetQualityIssue(id=uid("qi"),organization_id=context.organization.id,dataset_id=dataset_id,version_id=version_id,created_at=stamp,**issue))
    dataset.status="READY" if summary["quality_score"] >= 90 and not any(i["severity"]=="HIGH" for i in issues) else "UNDER_REVIEW"
    propagate_dataset_staleness(db, dataset, version_id, context.user.id)
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="DATASET_CLEANED", details=f"dataset={dataset_id}; source={source.id}; derived={version_id}; operation={op}", timestamp=stamp))
    db.commit(); return {"dataset_id": dataset_id, "source_version_id": source.id, "version_id": version_id, "version": version.version_number, "fingerprint": version.fingerprint}


@router.post("/decision")
def statistical_decision(payload: DecisionRequest, context: TenantContext = Depends(get_tenant_context)):
    try: return decide_test(payload.objective, payload.dependent_measurement_level, payload.groups, payload.paired, payload.normality_acceptable)
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc


@router.post("/datasets/{dataset_id}/analyses", status_code=201)
def create_analysis(dataset_id: str, payload: AnalysisRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    require_capability(db, dataset, context, "RUN_ANALYSIS")
    version = version_or_404(db, dataset_id, payload.dataset_version_id, context.organization.id)
    for model, item_id in ((models.ResearchQuestion, payload.research_question_id), (models.Hypothesis, payload.hypothesis_id)):
        if item_id and not db.query(model).filter(model.id == item_id, model.projectId == dataset.project_id).first(): raise HTTPException(422, "Research linkage does not belong to this project")
    try: result = run_analysis(version.data_json, payload.analysis_type, payload.configuration)
    except (ValueError, KeyError) as exc: raise HTTPException(422, str(exc)) from exc
    stamp=now(); item=models.ResearchAnalysis(id=uid("ana"), organization_id=context.organization.id, project_id=dataset.project_id, dataset_id=dataset_id,
        dataset_version_id=version.id, research_question_id=payload.research_question_id, hypothesis_id=payload.hypothesis_id, analysis_type=payload.analysis_type.upper(),
        configuration=payload.configuration, result=result, engine_version=ENGINE_VERSION, status="UNDER_REVIEW", created_by=context.user.id, created_at=stamp)
    db.add(item); db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="ANALYSIS_COMPLETED", details=f"analysis={item.id}; dataset_version={version.id}; engine={ENGINE_VERSION}", timestamp=stamp)); db.commit()
    return {"id": item.id, "dataset_version_id": version.id, "status": _analysis_status(dataset, item), "stale": dataset.current_version_id != version.id, "engine_version": ENGINE_VERSION, "result": result}


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    item=db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id==analysis_id, models.ResearchAnalysis.organization_id==context.organization.id).first()
    if not item: raise HTTPException(404, "Analysis not found")
    dataset=dataset_or_404(db, item.dataset_id, context)
    require_capability(db, dataset, context, "VIEW_RESULTS")
    return {"id":item.id,"analysis_type":item.analysis_type,"dataset_version_id":item.dataset_version_id,"status":_analysis_status(dataset,item),"stale":dataset.current_version_id!=item.dataset_version_id,"configuration":item.configuration,"result":item.result,"engine_version":item.engine_version,"created_at":item.created_at}


@router.get("/datasets/{dataset_id}/analyses")
def list_analyses(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset=dataset_or_404(db,dataset_id,context)
    require_capability(db,dataset,context,"VIEW_RESULTS")
    items=db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.dataset_id==dataset_id,models.ResearchAnalysis.organization_id==context.organization.id).order_by(models.ResearchAnalysis.created_at.desc()).all()
    return [{"id":i.id,"analysis_type":i.analysis_type,"dataset_version_id":i.dataset_version_id,"status":_analysis_status(dataset,i),"stale":dataset.current_version_id!=i.dataset_version_id,"configuration":i.configuration,"result":i.result,"engine_version":i.engine_version,"created_at":i.created_at} for i in items]


@router.post("/analyses/{analysis_id}/submit-review")
def submit_analysis_for_review(analysis_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    item = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id == analysis_id, models.ResearchAnalysis.organization_id == context.organization.id).first()
    if not item: raise HTTPException(404, "Analysis not found")
    dataset = dataset_or_404(db, item.dataset_id, context)
    require_capability(db, dataset, context, "RUN_ANALYSIS")
    if item.status != "UNDER_REVIEW" or dataset.current_version_id != item.dataset_version_id:
        raise HTTPException(409, "Only a current analysis may be submitted for review")
    item.status = "UNDER_REVIEW"
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="ANALYSIS_SUBMITTED_FOR_REVIEW", details=f"analysis={item.id}", timestamp=now()))
    db.commit()
    return {"id": item.id, "status": item.status}


@router.post("/analyses/{analysis_id}/review")
def review_analysis(analysis_id: str, payload: AnalysisReviewRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    """Human review of an exact analysis snapshot. Reviewer must hold the
    REVIEW_ANALYSIS capability on the dataset (e.g. via DatasetAccessGrant)."""
    item = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id == analysis_id, models.ResearchAnalysis.organization_id == context.organization.id).first()
    if not item: raise HTTPException(404, "Analysis not found")
    dataset = dataset_or_404(db, item.dataset_id, context)
    require_capability(db, dataset, context, "REVIEW_ANALYSIS")
    if dataset.current_version_id != item.dataset_version_id:
        raise HTTPException(409, "Cannot review a stale analysis; re-run against the current version")
    recommendation = payload.recommendation.upper()
    if recommendation not in REVIEW_RECOMMENDATIONS:
        raise HTTPException(422, "Recommendation must be APPROVED, REVISIONS_REQUIRED or REJECTED")
    item.status = "APPROVED" if recommendation == "APPROVED" else ("REJECTED" if recommendation == "REJECTED" else "UNDER_REVIEW")
    if recommendation == "APPROVED":
        item.approved_by = context.user.id
        item.approved_at = now()
    item.configuration = {**(item.configuration or {}), "review_notes": payload.notes}
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="ANALYSIS_REVIEWED", details=f"analysis={item.id}; recommendation={recommendation}", timestamp=now()))
    db.commit()
    return {"id": item.id, "status": item.status, "approved_by": item.approved_by, "approved_at": item.approved_at}


@router.get("/datasets/{dataset_id}/access-grants")
def list_grants(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    require_capability(db, dataset, context, "CLASSIFY")
    return list_dataset_grants(db, dataset)


@router.post("/datasets/{dataset_id}/access-grants", status_code=201)
def add_grant(dataset_id: str, payload: GrantRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    require_capability(db, dataset, context, "CLASSIFY")
    target = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not target: raise HTTPException(404, "User not found")
    row = grant_dataset_access(db, dataset, payload.user_id, payload.capability.upper(), context.user.id, payload.reason, payload.expires_at)
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="DATASET_ACCESS_GRANTED", details=f"dataset={dataset_id}; user={payload.user_id}; capability={payload.capability.upper()}", timestamp=now()))
    db.commit()
    return {"id": row.id, "user_id": row.user_id, "capability": row.capability, "status": row.status}


@router.post("/datasets/{dataset_id}/access-grants/revoke")
def revoke_grant(dataset_id: str, payload: RevokeRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context)
    require_capability(db, dataset, context, "CLASSIFY")
    removed = revoke_dataset_access(db, dataset, payload.user_id, payload.capability.upper())
    if not removed: raise HTTPException(404, "Active grant not found")
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="DATASET_ACCESS_REVOKED", details=f"dataset={dataset_id}; user={payload.user_id}; capability={payload.capability.upper()}", timestamp=now()))
    db.commit()
    return {"revoked": True}


# ── Institutional Research Data Operations (aggregate-first) ────────────────

@router.get("/organization/operations")
def data_office_operations(db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    role = (context.role or "").upper()
    if role not in {"OWNER", "ORGANIZATION_ADMIN"} and not context.is_global_admin:
        raise HTTPException(403, "Research data operations require an organization administrator role")
    datasets = db.query(models.ResearchDataset).filter(models.ResearchDataset.organization_id == context.organization.id).all()
    counts = {
        "active_datasets": len(datasets),
        "datasets_by_classification": {},
        "datasets_with_identifiers": 0,
        "analysis_ready_datasets": 0,
        "analyses_under_review": 0,
        "approved_analyses": 0,
        "stale_analyses": 0,
        "storage_bytes": 0,
    }
    classification: dict[str, int] = {}
    for d in datasets:
        classification[d.sensitivity] = classification.get(d.sensitivity, 0) + 1
        if db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == d.id, models.DatasetVariable.identifier.is_(True)).count():
            counts["datasets_with_identifiers"] += 1
        open_issues = db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == d.id, models.DatasetQualityIssue.status == "OPEN").count()
        if d.status == "READY" and open_issues == 0:
            counts["analysis_ready_datasets"] += 1
        analyses = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.dataset_id == d.id).all()
        for a in analyses:
            status = _analysis_status(d, a)
            if status == "UNDER_REVIEW": counts["analyses_under_review"] += 1
            if status == "APPROVED": counts["approved_analyses"] += 1
            if status == "STALE": counts["stale_analyses"] += 1
    counts["datasets_by_classification"] = classification
    return {
        "organization_id": context.organization.id,
        "scope": "ORGANIZATION",
        "counts": counts,
        "datasets": [
            {"id": d.id, "name": d.name, "sensitivity": d.sensitivity, "status": d.status,
             "version": _version_number(db, d), "access_level": "AGGREGATE_ONLY"}
            for d in datasets[:200]
        ],
        "aggregate_only": True,
        "raw_content_excluded": True,
    }


def _version_number(db: Session, dataset: models.ResearchDataset):
    version = db.query(models.DatasetVersion).filter(models.DatasetVersion.id == dataset.current_version_id).first()
    return version.version_number if version else None
