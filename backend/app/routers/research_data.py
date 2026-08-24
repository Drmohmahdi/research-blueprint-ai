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
from ..services.research_data import ENGINE_VERSION, decide_test, fingerprint, frame_records, infer_variables, load_tabular, quality_scan, run_analysis, safe_csv_value
from ..services.research_lifecycle import propagate_dataset_staleness
from ..services.storage import StorageProvider, get_storage_provider
from ..services.tenant_context import TenantContext, get_tenant_context

router = APIRouter(prefix="/research-data", tags=["research-data"])
now = lambda: datetime.datetime.now(datetime.UTC).isoformat()
uid = lambda prefix: f"{prefix}-{uuid.uuid4().hex[:16]}"
DATASET_WRITE_ROLES={"OWNER","ORGANIZATION_ADMIN","RESEARCHER"}

def require_dataset_write(context: TenantContext):
    if context.role not in DATASET_WRITE_ROLES and not context.is_global_admin:
        raise HTTPException(403,"Dataset modification is not permitted for this workspace role")

def project_or_404(db: Session, project_id: str, org_id: str):
    item = db.query(models.ResearchProject).filter(models.ResearchProject.id == project_id, models.ResearchProject.organizationId == org_id).first()
    if not item: raise HTTPException(404, "Project not found")
    return item

def dataset_or_404(db: Session, dataset_id: str, org_id: str):
    item = db.query(models.ResearchDataset).filter(models.ResearchDataset.id == dataset_id, models.ResearchDataset.organization_id == org_id).first()
    if not item: raise HTTPException(404, "Dataset not found")
    return item

def version_or_404(db: Session, dataset_id: str, version_id: str, org_id: str):
    item = db.query(models.DatasetVersion).filter(models.DatasetVersion.id == version_id, models.DatasetVersion.dataset_id == dataset_id, models.DatasetVersion.organization_id == org_id).first()
    if not item: raise HTTPException(404, "Dataset version not found")
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

def serialize_dataset(item, db):
    version = db.query(models.DatasetVersion).filter(models.DatasetVersion.id == item.current_version_id).first()
    open_issues = db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == item.id, models.DatasetQualityIssue.status == "OPEN").count()
    return {"id": item.id, "project_id": item.project_id, "name": item.name, "source_type": item.source_type,
            "sensitivity": item.sensitivity, "status": item.status, "current_version_id": item.current_version_id,
            "version": version.version_number if version else None, "rows": version.row_count if version else 0,
            "variables": version.column_count if version else 0, "open_quality_issues": open_issues,
            "created_at": item.created_at, "updated_at": item.updated_at}

@router.post("/datasets", status_code=201)
def import_dataset(payload: ImportRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context), storage: StorageProvider = Depends(get_storage_provider)):
    require_dataset_write(context)
    project_or_404(db, payload.project_id, context.organization.id)
    uploaded = db.query(models.UploadedFile).filter(models.UploadedFile.id == payload.uploaded_file_id, models.UploadedFile.organization_id == context.organization.id,
        models.UploadedFile.project_id == payload.project_id, models.UploadedFile.deleted_at.is_(None)).first()
    if not uploaded: raise HTTPException(404, "Uploaded file not found")
    try: frame = load_tabular(storage.read_file_bytes(uploaded.storage_key), uploaded.filename)
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    records = frame_records(frame); stamp = now(); dataset_id = uid("ds"); version_id = uid("dsv")
    dataset = models.ResearchDataset(id=dataset_id, organization_id=context.organization.id, project_id=payload.project_id, owner_id=context.user.id,
        name=payload.name, source_type=payload.source_type.upper(), sensitivity=payload.sensitivity.upper(), status="UNDER_REVIEW", current_version_id=version_id, created_at=stamp, updated_at=stamp)
    version = models.DatasetVersion(id=version_id, organization_id=context.organization.id, dataset_id=dataset_id, uploaded_file_id=uploaded.id, version_number="1.0", kind="RAW",
        fingerprint=fingerprint(records), row_count=len(frame), column_count=len(frame.columns), data_json=records, change_summary="Initial immutable import", created_by=context.user.id, created_at=stamp)
    db.add_all([dataset, version])
    for variable in infer_variables(frame): db.add(models.DatasetVariable(id=uid("var"), organization_id=context.organization.id, dataset_id=dataset_id, **variable))
    summary, issues = quality_scan(frame)
    for issue in issues: db.add(models.DatasetQualityIssue(id=uid("qi"), organization_id=context.organization.id, dataset_id=dataset_id, version_id=version_id, created_at=stamp, **issue))
    dataset.status = "READY" if summary["quality_score"] >= 90 and not any(i["severity"] == "HIGH" for i in issues) else "UNDER_REVIEW"
    db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="DATASET_IMPORTED", details=f"dataset={dataset_id}; version={version_id}; rows={len(frame)}", timestamp=stamp))
    db.commit(); return {**serialize_dataset(dataset, db), "quality": summary}

@router.get("/projects/{project_id}/command-center")
def command_center(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project_or_404(db, project_id, context.organization.id)
    datasets = db.query(models.ResearchDataset).filter(models.ResearchDataset.project_id == project_id, models.ResearchDataset.organization_id == context.organization.id).all()
    variables = sum(db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == d.id).count() for d in datasets)
    open_issues = sum(db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == d.id, models.DatasetQualityIssue.status == "OPEN").count() for d in datasets)
    analyses = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.project_id == project_id, models.ResearchAnalysis.organization_id == context.organization.id).all()
    defined = sum(db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == d.id, models.DatasetVariable.measurement_level.isnot(None), models.DatasetVariable.role.isnot(None)).count() for d in datasets)
    definition = round(defined / max(1, variables) * 100)
    quality = max(0, 100 - min(60, open_issues * 5)); structure = 100 if datasets else 0; plan = 100 if analyses else 40 if datasets else 0
    overall = round(structure*.25 + definition*.25 + quality*.30 + plan*.20)
    blockers = any(d.status == "UNDER_REVIEW" for d in datasets)
    if not datasets: next_action = {"priority": "CRITICAL", "title": "Import a research dataset"}
    elif blockers: next_action = {"priority": "HIGH", "title": "Resolve high-priority data quality issues"}
    elif not analyses: next_action = {"priority": "MEDIUM", "title": "Create and run the first linked analysis"}
    else: next_action = {"priority": "LOW", "title": "Review and pin validated results"}
    return {"metrics": {"datasets": len(datasets), "variables": variables, "quality_issues": open_issues, "analyses": len(analyses)},
            "readiness": {"data_structure": structure, "variable_definition": definition, "data_quality": quality, "analysis_plan": plan, "overall": overall},
            "next_action": next_action, "datasets": [serialize_dataset(d, db) for d in datasets]}

@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset = dataset_or_404(db, dataset_id, context.organization.id)
    variables = db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id == dataset_id).all()
    version = version_or_404(db, dataset_id, dataset.current_version_id, context.organization.id)
    summary, _ = quality_scan(pd.DataFrame(version.data_json))
    safe_variables = [{"id": v.id, "name": v.name, "label_ar": v.label_ar, "label_en": v.label_en, "data_type": v.data_type,
        "measurement_level": v.measurement_level, "role": v.role, "sensitive": v.sensitive, "identifier": v.identifier} for v in variables]
    preview_columns = [v.name for v in variables if not v.identifier and not v.sensitive]
    preview = [{k: row.get(k) for k in preview_columns} for row in version.data_json[:25]]
    return {**serialize_dataset(dataset, db), "fingerprint": version.fingerprint, "quality": summary, "dictionary": safe_variables, "preview": preview}

@router.get("/datasets/{dataset_id}/versions")
def list_versions(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset_or_404(db, dataset_id, context.organization.id)
    rows = db.query(models.DatasetVersion).filter(models.DatasetVersion.dataset_id == dataset_id, models.DatasetVersion.organization_id == context.organization.id).order_by(models.DatasetVersion.created_at.desc()).all()
    return [{"id":v.id,"version":v.version_number,"kind":v.kind,"source_version_id":v.source_version_id,"fingerprint":v.fingerprint,"rows":v.row_count,"columns":v.column_count,"change_summary":v.change_summary,"created_at":v.created_at} for v in rows]

@router.get("/datasets/{dataset_id}/issues")
def list_issues(dataset_id: str, status_filter: str | None = None, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset_or_404(db, dataset_id, context.organization.id)
    query = db.query(models.DatasetQualityIssue).filter(models.DatasetQualityIssue.dataset_id == dataset_id, models.DatasetQualityIssue.organization_id == context.organization.id)
    if status_filter: query = query.filter(models.DatasetQualityIssue.status == status_filter.upper())
    return [{"id":i.id,"version_id":i.version_id,"variable_name":i.variable_name,"issue_type":i.issue_type,"severity":i.severity,"status":i.status,"details":i.details,"resolution":i.resolution} for i in query.order_by(models.DatasetQualityIssue.created_at.desc()).all()]

@router.patch("/datasets/{dataset_id}/issues/{issue_id}")
def resolve_issue(dataset_id: str, issue_id: str, payload: IssueResolution, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    require_dataset_write(context)
    dataset = dataset_or_404(db, dataset_id, context.organization.id)
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
    dataset=dataset_or_404(db,dataset_id,context.organization.id); version=version_or_404(db,dataset_id,dataset.current_version_id,context.organization.id)
    variables=db.query(models.DatasetVariable).filter(models.DatasetVariable.dataset_id==dataset_id,models.DatasetVariable.organization_id==context.organization.id).all()
    allowed=[v.name for v in variables if not v.identifier and not v.sensitive]
    frame=pd.DataFrame([{key:safe_csv_value(row.get(key)) for key in allowed} for row in version.data_json],columns=allowed)
    output=frame.to_csv(index=False).encode("utf-8-sig")
    safe_name="".join(c for c in dataset.name if c.isalnum() or c in "-_ ").strip() or "dataset"
    db.add(models.AuditLog(id=uid("aud"),userId=context.user.id,organizationId=context.organization.id,action="DATASET_EXPORTED",details=f"dataset={dataset_id}; version={version.id}; sensitive_columns_excluded=true",timestamp=now())); db.commit()
    return StreamingResponse(iter([output]),media_type="text/csv; charset=utf-8",headers={"Content-Disposition":f'attachment; filename="{safe_name}.csv"'})

@router.patch("/datasets/{dataset_id}/variables/{variable_id}")
def update_variable(dataset_id: str, variable_id: str, payload: VariableUpdate, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    require_dataset_write(context)
    dataset_or_404(db, dataset_id, context.organization.id)
    variable = db.query(models.DatasetVariable).filter(models.DatasetVariable.id == variable_id, models.DatasetVariable.dataset_id == dataset_id, models.DatasetVariable.organization_id == context.organization.id).first()
    if not variable: raise HTTPException(404, "Variable not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(variable, key, value)
    db.add(models.AuditLog(id=uid("aud"),userId=context.user.id,organizationId=context.organization.id,action="DATASET_VARIABLE_UPDATED",details=f"dataset={dataset_id}; variable_id={variable.id}; fields={','.join(payload.model_dump(exclude_unset=True).keys())}",timestamp=now()))
    db.commit(); return {"id": variable.id, "updated": True}

@router.post("/datasets/{dataset_id}/clean")
def clean_dataset(dataset_id: str, payload: CleaningRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    require_dataset_write(context)
    # Serialize version allocation per dataset. PostgreSQL's row lock makes two
    # concurrent cleaning requests observe successive current versions instead
    # of attempting the same unique version number.
    dataset = db.query(models.ResearchDataset).filter(
        models.ResearchDataset.id == dataset_id,
        models.ResearchDataset.organization_id == context.organization.id,
    ).with_for_update().first()
    if not dataset: raise HTTPException(404, "Dataset not found")
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
    require_dataset_write(context)
    dataset = dataset_or_404(db, dataset_id, context.organization.id); version = version_or_404(db, dataset_id, payload.dataset_version_id, context.organization.id)
    for model, item_id in ((models.ResearchQuestion, payload.research_question_id), (models.Hypothesis, payload.hypothesis_id)):
        if item_id and not db.query(model).filter(model.id == item_id, model.projectId == dataset.project_id).first(): raise HTTPException(422, "Research linkage does not belong to this project")
    try: result = run_analysis(version.data_json, payload.analysis_type, payload.configuration)
    except (ValueError, KeyError) as exc: raise HTTPException(422, str(exc)) from exc
    stamp=now(); item=models.ResearchAnalysis(id=uid("ana"), organization_id=context.organization.id, project_id=dataset.project_id, dataset_id=dataset_id,
        dataset_version_id=version.id, research_question_id=payload.research_question_id, hypothesis_id=payload.hypothesis_id, analysis_type=payload.analysis_type.upper(),
        configuration=payload.configuration, result=result, engine_version=ENGINE_VERSION, created_by=context.user.id, created_at=stamp)
    db.add(item); db.add(models.AuditLog(id=uid("aud"), userId=context.user.id, organizationId=context.organization.id, action="ANALYSIS_COMPLETED", details=f"analysis={item.id}; dataset_version={version.id}; engine={ENGINE_VERSION}", timestamp=stamp)); db.commit()
    return {"id": item.id, "dataset_version_id": version.id, "stale": dataset.current_version_id != version.id, "engine_version": ENGINE_VERSION, "result": result}

@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    item=db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id==analysis_id, models.ResearchAnalysis.organization_id==context.organization.id).first()
    if not item: raise HTTPException(404, "Analysis not found")
    dataset=dataset_or_404(db, item.dataset_id, context.organization.id)
    return {"id":item.id,"analysis_type":item.analysis_type,"dataset_version_id":item.dataset_version_id,"stale":dataset.current_version_id!=item.dataset_version_id,"configuration":item.configuration,"result":item.result,"engine_version":item.engine_version,"created_at":item.created_at}

@router.get("/datasets/{dataset_id}/analyses")
def list_analyses(dataset_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    dataset=dataset_or_404(db,dataset_id,context.organization.id)
    items=db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.dataset_id==dataset_id,models.ResearchAnalysis.organization_id==context.organization.id).order_by(models.ResearchAnalysis.created_at.desc()).all()
    return [{"id":i.id,"analysis_type":i.analysis_type,"dataset_version_id":i.dataset_version_id,"stale":dataset.current_version_id!=i.dataset_version_id,"configuration":i.configuration,"result":i.result,"engine_version":i.engine_version,"created_at":i.created_at} for i in items]
