"""
Research Design Intelligence API.

Deterministic engines + project-scoped collaboration + exact-version
methodology review + institutional aggregate view. No global IAM here.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services import research_design as rd
from ..services.research_design import (
    check_protocol_staleness, compute_coherence, compute_design_map, compute_next_action,
    compute_readiness, create_protocol, get_or_create_design_state, list_project_members,
    project_access, recommend_methodology, save_design_section,
)
from ..services.tenant_context import TenantContext, get_tenant_context

router = APIRouter(prefix="/research-design", tags=["research-design"])

SECTION_NAMES = {
    "idea": "idea", "problem": "problem", "gap": "gap", "objectives": "objectives",
    "question_ext": "question_ext", "hypothesis_ext": "hypothesis_ext",
    "variable_registry": "variable_registry", "conceptual_framework": "conceptual_framework",
    "theoretical_framework": "theoretical_framework", "methodology": "methodology",
    "sampling": "sampling", "measurement": "measurement", "procedure": "procedure",
    "analysis": "analysis",
}


class SectionPayload(BaseModel):
    data: Dict[str, Any]


class MemberAddRequest(BaseModel):
    user_id: str
    relationship: str = Field(max_length=40)
    assigned_sections: Optional[List[str]] = None


class MemberRemoveRequest(BaseModel):
    user_id: str
    relationship: str = Field(max_length=40)


class ReviewSubmitRequest(BaseModel):
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    recommendation: str = Field(max_length=30)
    visibility: str = Field(default="CONFIDENTIAL_TO_RESEARCHER", max_length=40)


def _authorized_project(db: Session, project_id: str, context: TenantContext) -> models.ResearchProject:
    project = project_access(db, project_id, context)
    if not project:
        raise HTTPException(404, "Project not found or access denied")
    return project


def _require_edit(db: Session, project: models.ResearchProject, context: TenantContext, section: str | None = None) -> None:
    if not rd.can_edit_section(db, project, context, section):
        raise HTTPException(403, "You are not permitted to edit this research design section")


def _command_center(db: Session, project: models.ResearchProject, context: TenantContext) -> Dict[str, Any]:
    state = get_or_create_design_state(db, project, context.user.id)
    check_protocol_staleness(db, project, state)
    db.flush()
    coherence = compute_coherence(db, project, state)
    readiness = compute_readiness(db, project, state, coherence)
    next_action = compute_next_action(db, project, state, coherence, readiness)
    design_map = compute_design_map(db, project, state)
    methodology = recommend_methodology(db, project, state)
    protocols = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == context.organization.id,
    ).order_by(models.ResearchProtocol.version_number.asc()).all()
    team = list_project_members(db, project)
    relation = rd.member_relationship(db, project, context.user.id)

    return {
        "project_id": project.id,
        "title_ar": project.titleAr,
        "title_en": project.titleEn,
        "study_design": project.studyDesign,
        "research_family": rd.research_family(project),
        "current_relation": relation,
        "indicators": {
            "completion": _completion(db, project),
            "coherence": coherence,
            "readiness": readiness,
            "protocol_status": state.protocol_status,
            "protocol_review_due": state.protocol_review_due,
            "next_best_action": next_action,
            "critical_blockers": [f for f in coherence["findings"] if f["severity"] == "BLOCKING"],
        },
        "design_map": design_map,
        "methodology": methodology,
        "team": team,
        "protocols": [
            {"id": p.id, "version": p.version_number, "status": p.status,
             "fingerprint": p.fingerprint, "created_at": p.created_at,
             "submitted_at": p.submitted_at, "approved_at": p.approved_at,
             "is_current": p.id == state.current_protocol_id}
            for p in protocols
        ],
        "ai": {
            "use_cases": ["PROBLEM_REFINEMENT", "GAP_EXPLANATION", "QUESTION_REFINEMENT",
                          "HYPOTHESIS_REFINEMENT", "METHODOLOGY_EXPLANATION",
                          "COHERENCE_FINDING_EXPLANATION", "NEXT_RESEARCH_ACTION_EXPLANATION",
                          "PROTOCOL_DRAFT_ASSISTANCE"],
            "authority": "ADVISORY_ONLY",
        },
    }


def _completion(db: Session, project: models.ResearchProject) -> Dict[str, Any]:
    questions = db.query(models.ResearchQuestion).filter(models.ResearchQuestion.projectId == project.id).count()
    variables = db.query(models.ResearchVariable).filter(models.ResearchVariable.projectId == project.id).count()
    hypotheses = db.query(models.Hypothesis).filter(models.Hypothesis.projectId == project.id).count()
    literature = db.query(models.LiteratureStudy).filter(models.LiteratureStudy.projectId == project.id).count()
    parts = {
        "problem": bool(project.problemStatementAr or project.problemStatementEn),
        "objectives": bool(project.objectives),
        "questions": questions > 0,
        "variables": variables > 0,
        "hypotheses": hypotheses > 0,
        "sample_settings": bool(project.sampleSettings),
        "literature": literature > 0,
        "ethics": bool(project.ethics),
    }
    score = round(sum(1 for v in parts.values() if v) / max(1, len(parts)) * 100)
    return {"score": score, "parts": parts}


# ── Command Center ───────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/command-center")
def command_center(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    return _command_center(db, project, context)


@router.get("/projects/{project_id}/design-map")
def design_map(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    state = get_or_create_design_state(db, project, context.user.id)
    return compute_design_map(db, project, state)


@router.get("/projects/{project_id}/coherence")
def coherence_view(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    state = get_or_create_design_state(db, project, context.user.id)
    return compute_coherence(db, project, state)


@router.get("/projects/{project_id}/readiness")
def readiness_view(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    state = get_or_create_design_state(db, project, context.user.id)
    coherence = compute_coherence(db, project, state)
    return compute_readiness(db, project, state, coherence)


@router.get("/projects/{project_id}/next-action")
def next_action_view(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    state = get_or_create_design_state(db, project, context.user.id)
    coherence = compute_coherence(db, project, state)
    readiness = compute_readiness(db, project, state, coherence)
    return compute_next_action(db, project, state, coherence, readiness)


@router.get("/projects/{project_id}/methodology-recommendation")
def methodology_recommendation(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    state = get_or_create_design_state(db, project, context.user.id)
    return recommend_methodology(db, project, state)


# ── Design sections (researcher-authored) ────────────────────────────────────

@router.get("/projects/{project_id}/sections/{section}")
def get_section(project_id: str, section: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    if section not in SECTION_NAMES:
        raise HTTPException(404, "Unknown design section")
    state = get_or_create_design_state(db, project, context.user.id)
    return {"section": section, "data": getattr(state, f"{section}_json") or {}}


@router.put("/projects/{project_id}/sections/{section}")
def put_section(project_id: str, section: str, payload: SectionPayload, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    if section not in SECTION_NAMES:
        raise HTTPException(404, "Unknown design section")
    _require_edit(db, project, context, section)
    state = save_design_section(db, project, section, payload.data, context.user.id)
    check_protocol_staleness(db, project, state)
    db.add(models.AuditLog(
        id=f"aud-rd-{state.id}-{section}", userId=context.user.id,
        organizationId=context.organization.id, action=f"RESEARCH_DESIGN_{section.upper()}_UPDATED",
        details=f"project={project.id}; section={section}", timestamp=rd.utc_now(),
    ))
    db.commit()
    return {"section": section, "data": getattr(state, f"{section}_json") or {}}


# ── Protocol lifecycle ───────────────────────────────────────────────────────

@router.post("/projects/{project_id}/protocols", status_code=201)
def create_protocol_endpoint(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    _require_edit(db, project, context)
    item = create_protocol(db, project, context.user.id)
    db.add(models.AuditLog(
        id=f"aud-proto-{item.id}", userId=context.user.id, organizationId=context.organization.id,
        action="RESEARCH_PROTOCOL_CREATED",
        details=f"project={project.id}; protocol={item.id}; version={item.version_number}",
        timestamp=item.created_at,
    ))
    db.commit()
    return {"id": item.id, "version": item.version_number, "status": item.status, "fingerprint": item.fingerprint}


@router.get("/projects/{project_id}/protocols")
def list_protocols(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    items = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == context.organization.id,
    ).order_by(models.ResearchProtocol.version_number.asc()).all()
    return [
        {"id": p.id, "version": p.version_number, "status": p.status, "fingerprint": p.fingerprint,
         "created_at": p.created_at, "submitted_at": p.submitted_at, "approved_at": p.approved_at,
         "created_by": p.created_by}
        for p in items
    ]


@router.get("/projects/{project_id}/protocols/{protocol_id}")
def get_protocol(project_id: str, protocol_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    item = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.id == protocol_id,
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == context.organization.id,
    ).first()
    if not item:
        raise HTTPException(404, "Protocol not found")
    return {
        "id": item.id, "project_id": item.project_id, "version": item.version_number,
        "fingerprint": item.fingerprint, "status": item.status,
        "created_at": item.created_at, "submitted_at": item.submitted_at,
        "approved_at": item.approved_at, "approved_by": item.approved_by,
        "snapshot": item.snapshot_json,
    }


@router.post("/projects/{project_id}/protocols/{protocol_id}/submit")
def submit_protocol(project_id: str, protocol_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    _require_edit(db, project, context)
    item = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.id == protocol_id,
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == context.organization.id,
    ).first()
    if not item:
        raise HTTPException(404, "Protocol not found")
    if item.status not in {"DRAFT", "STALE"}:
        raise HTTPException(409, "Only a draft protocol can be submitted")
    item.status = "SUBMITTED"
    item.submitted_at = rd.utc_now()
    state = get_or_create_design_state(db, project, context.user.id)
    state.protocol_status = "SUBMITTED"
    state.updated_at = rd.utc_now()
    db.add(models.AuditLog(
        id=f"aud-proto-sub-{item.id}", userId=context.user.id, organizationId=context.organization.id,
        action="RESEARCH_PROTOCOL_SUBMITTED", details=f"project={project.id}; protocol={item.id}; version={item.version_number}",
        timestamp=item.submitted_at,
    ))
    db.commit()
    return {"id": item.id, "version": item.version_number, "status": item.status}


@router.post("/projects/{project_id}/protocols/{protocol_id}/approve")
def approve_protocol(project_id: str, protocol_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    """Human approval of an exact protocol version (PI / authorized role)."""
    project = _authorized_project(db, project_id, context)
    relation = rd.member_relationship(db, project, context.user.id)
    if relation not in {"OWNER", "PI"} and not context.is_global_admin:
        raise HTTPException(403, "Only the project owner or principal investigator may approve a protocol")
    item = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.id == protocol_id,
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == context.organization.id,
    ).first()
    if not item:
        raise HTTPException(404, "Protocol not found")
    if item.status != "SUBMITTED":
        raise HTTPException(409, "Only a submitted protocol can be approved")
    item.status = "APPROVED"
    item.approved_by = context.user.id
    item.approved_at = rd.utc_now()
    state = get_or_create_design_state(db, project, context.user.id)
    state.protocol_status = "APPROVED"
    state.current_protocol_id = item.id
    state.protocol_review_due = False
    state.updated_at = rd.utc_now()
    db.add(models.AuditLog(
        id=f"aud-proto-appr-{item.id}", userId=context.user.id, organizationId=context.organization.id,
        action="RESEARCH_PROTOCOL_APPROVED", details=f"project={project.id}; protocol={item.id}; version={item.version_number}",
        timestamp=item.approved_at,
    ))
    db.commit()
    return {"id": item.id, "version": item.version_number, "status": item.status, "approved_at": item.approved_at}


# ── Collaboration / team ─────────────────────────────────────────────────────

@router.get("/projects/{project_id}/team")
def project_team(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    return {"project_id": project.id, "owner_id": project.userId, "members": list_project_members(db, project)}


@router.post("/projects/{project_id}/team", status_code=201)
def add_team_member(project_id: str, payload: MemberAddRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    relation = rd.member_relationship(db, project, context.user.id)
    if relation not in {"OWNER", "PI"} and not context.is_global_admin:
        raise HTTPException(403, "Only the project owner or PI may assign team members")
    target = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not target:
        raise HTTPException(404, "User not found")
    if payload.relationship.upper() == "PI" and context.user.id != payload.user_id:
        member_count = db.query(models.ResearchProjectMember).filter(
            models.ResearchProjectMember.project_id == project.id,
            models.ResearchProjectMember.relationship == "PI",
            models.ResearchProjectMember.status == "ACTIVE",
        ).count()
        if member_count >= 1:
            raise HTTPException(409, "A principal investigator is already assigned")
    item = rd.add_project_member(db, project, payload.user_id, payload.relationship, context.user.id, payload.assigned_sections)
    db.add(models.AuditLog(
        id=f"aud-team-{item.id}", userId=context.user.id, organizationId=context.organization.id,
        action="RESEARCH_TEAM_MEMBER_ADDED",
        details=f"project={project.id}; member={item.user_id}; relationship={item.relationship}",
        timestamp=item.created_at,
    ))
    db.commit()
    return {"id": item.id, "user_id": item.user_id, "relationship": item.relationship, "status": item.status}


@router.post("/projects/{project_id}/team/remove")
def remove_team_member(project_id: str, payload: MemberRemoveRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    relation = rd.member_relationship(db, project, context.user.id)
    if relation not in {"OWNER", "PI"} and not context.is_global_admin:
        raise HTTPException(403, "Only the project owner or PI may remove team members")
    removed = rd.remove_project_member(db, project, payload.user_id, payload.relationship)
    if not removed:
        raise HTTPException(404, "Active membership not found")
    db.add(models.AuditLog(
        id=f"aud-team-rm-{rd.new_id('x')}", userId=context.user.id, organizationId=context.organization.id,
        action="RESEARCH_TEAM_MEMBER_REMOVED",
        details=f"project={project.id}; member={payload.user_id}; relationship={payload.relationship}",
        timestamp=rd.utc_now(),
    ))
    db.commit()
    return {"removed": True}


# ── Methodology Review (exact-version) ───────────────────────────────────────

@router.post("/projects/{project_id}/protocols/{protocol_id}/reviews", status_code=201)
def submit_review(project_id: str, protocol_id: str, payload: ReviewSubmitRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    item = db.query(models.ResearchProtocol).filter(
        models.ResearchProtocol.id == protocol_id,
        models.ResearchProtocol.project_id == project.id,
        models.ResearchProtocol.organization_id == context.organization.id,
    ).first()
    if not item:
        raise HTTPException(404, "Protocol not found")
    if payload.recommendation not in rd.REVIEW_RECOMMENDATIONS:
        raise HTTPException(422, "Recommendation must be READY, REVISIONS_REQUIRED or MAJOR_CONCERNS")
    # Reviewer must be assigned to this exact protocol's project (not any project)
    member = db.query(models.ResearchProjectMember).filter(
        models.ResearchProjectMember.project_id == project.id,
        models.ResearchProjectMember.user_id == context.user.id,
        models.ResearchProjectMember.relationship == "METHODOLOGY_REVIEWER",
        models.ResearchProjectMember.status == "ACTIVE",
    ).first()
    is_owner_or_admin = project.userId == context.user.id or context.is_global_admin
    if not member and not is_owner_or_admin:
        raise HTTPException(403, "Only an assigned methodology reviewer may submit a review")
    review = db.query(models.MethodologyReview).filter(
        models.MethodologyReview.protocol_id == item.id,
        models.MethodologyReview.reviewer_id == context.user.id,
    ).first()
    if not review:
        review = models.MethodologyReview(
            id=rd.new_id("mrev"), organization_id=project.organizationId, project_id=project.id,
            protocol_id=item.id, protocol_version=item.version_number,
            reviewer_id=context.user.id, status="DRAFT",
            findings_json=payload.findings, recommendation=None,
            visibility=payload.visibility, created_at=rd.utc_now(), updated_at=rd.utc_now(),
        )
        db.add(review)
    review.findings_json = payload.findings
    review.recommendation = payload.recommendation
    review.visibility = payload.visibility
    review.status = "SUBMITTED"
    review.submitted_at = rd.utc_now()
    review.updated_at = rd.utc_now()
    db.add(models.AuditLog(
        id=f"aud-mrev-{review.id}", userId=context.user.id, organizationId=context.organization.id,
        action="METHODOLOGY_REVIEW_SUBMITTED",
        details=f"project={project.id}; protocol={item.id}; version={item.version_number}",
        timestamp=review.submitted_at,
    ))
    db.commit()
    return {
        "id": review.id, "protocol_id": review.protocol_id, "protocol_version": review.protocol_version,
        "recommendation": review.recommendation, "status": review.status, "submitted_at": review.submitted_at,
    }


@router.get("/projects/{project_id}/reviews")
def list_reviews(project_id: str, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    items = db.query(models.MethodologyReview).filter(
        models.MethodologyReview.project_id == project.id,
        models.MethodologyReview.organization_id == context.organization.id,
    ).order_by(models.MethodologyReview.created_at.desc()).all()
    # Privacy: findings are only exposed to the reviewer, the owner/PI, or
    # research-office holders with an explicit relationship; never to assistants.
    can_view = project.userId == context.user.id or context.is_global_admin
    can_view = can_view or rd.member_relationship(db, project, context.user.id) in {"PI", "METHODOLOGY_REVIEWER"}
    result = []
    for r in items:
        row = {
            "id": r.id, "protocol_id": r.protocol_id, "protocol_version": r.protocol_version,
            "reviewer_id": r.reviewer_id, "status": r.status, "recommendation": r.recommendation,
            "visibility": r.visibility, "submitted_at": r.submitted_at, "created_at": r.created_at,
        }
        if can_view or r.reviewer_id == context.user.id:
            row["findings"] = r.findings_json
        else:
            row["findings"] = None
        result.append(row)
    return result


# ── AI assistance (governed, advisory) ───────────────────────────────────────

class AIAssistRequest(BaseModel):
    use_case: str
    question: Optional[str] = None
    text: Optional[str] = None
    finding_index: Optional[int] = None


@router.post("/projects/{project_id}/ai-assist")
def ai_assist(project_id: str, payload: AIAssistRequest, db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    project = _authorized_project(db, project_id, context)
    from ..services.ai.service import GovernedAIService
    from ..services.ai.service import AIServiceError
    allowed = {
        "PROBLEM_REFINEMENT", "GAP_EXPLANATION", "QUESTION_REFINEMENT",
        "HYPOTHESIS_REFINEMENT", "METHODOLOGY_EXPLANATION",
        "COHERENCE_FINDING_EXPLANATION", "NEXT_RESEARCH_ACTION_EXPLANATION",
        "PROTOCOL_DRAFT_ASSISTANCE",
    }
    if payload.use_case not in allowed:
        raise HTTPException(422, "Unsupported research design AI use case")
    state = get_or_create_design_state(db, project, context.user.id)
    coherence = compute_coherence(db, project, state)
    find = None
    if payload.finding_index is not None:
        try:
            find = coherence["findings"][payload.finding_index]
        except IndexError:
            raise HTTPException(404, "Finding not found")
    call_payload: Dict[str, Any] = {"project_id": project.id, "question": payload.question or payload.text or ""}
    if find:
        call_payload["text"] = json.dumps(find, ensure_ascii=False)
    try:
        return GovernedAIService.assist(db, context, payload.use_case, call_payload)
    except AIServiceError as exc:
        raise HTTPException(status_code=exc.http_status, detail=exc.message)


# ── Institutional Research Operations (aggregate-first) ──────────────────────

def _org_projects(db: Session, context: TenantContext) -> List[models.ResearchProject]:
    return db.query(models.ResearchProject).filter(
        models.ResearchProject.organizationId == context.organization.id,
    ).all()


@router.get("/organization/operations")
def research_office_operations(db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    """Aggregate-first Research Office view.

    Exposes counts, readiness/status distributions and blocker tallies only.
    Never returns raw project content, private notes, participant data,
    confidential reviews, or unpublished protocol bodies.
    """
    role = (context.role or "").upper()
    if role not in {"OWNER", "ORGANIZATION_ADMIN"} and not context.is_global_admin:
        raise HTTPException(403, "Research office operations require an organization administrator role")
    projects = _org_projects(db, context)
    project_rows: List[Dict[str, Any]] = []
    counts = {
        "active_projects": len(projects),
        "designs_ready_for_execution": 0,
        "projects_with_blocking_issues": 0,
        "protocols_awaiting_review": 0,
        "stale_protocols": 0,
        "protocols_approved": 0,
        "projects_without_protocol": 0,
    }
    readiness_dist: Dict[str, int] = {}
    family_dist: Dict[str, int] = {}
    blocked_dist: Dict[str, int] = {}

    for project in projects:
        state = get_or_create_design_state(db, project, None)
        check_protocol_staleness(db, project, state)
        coherence = compute_coherence(db, project, state)
        readiness = compute_readiness(db, project, state, coherence)
        family = rd.research_family(project)
        family_dist[family] = family_dist.get(family, 0) + 1
        readiness_dist[readiness["status"]] = readiness_dist.get(readiness["status"], 0) + 1
        blocking_count = len([f for f in coherence["findings"] if f["severity"] == "BLOCKING"])
        blocked_dist[str(blocking_count)] = blocked_dist.get(str(blocking_count), 0) + 1
        if blocking_count:
            counts["projects_with_blocking_issues"] += 1
        if readiness["status"] == "READY" and state.protocol_status in {"APPROVED", "SUBMITTED"}:
            counts["designs_ready_for_execution"] += 1
        if state.protocol_status == "SUBMITTED":
            counts["protocols_awaiting_review"] += 1
        if state.protocol_review_due:
            counts["stale_protocols"] += 1
        if state.protocol_status == "APPROVED":
            counts["protocols_approved"] += 1
        if state.protocol_status == "NO_PROTOCOL":
            counts["projects_without_protocol"] += 1
        project_rows.append({
            "id": project.id, "title_en": project.titleEn, "title_ar": project.titleAr,
            "stage": readiness["template"], "readiness_status": readiness["status"],
            "readiness_score": readiness["score"], "blocker_count": blocking_count,
            "protocol_status": state.protocol_status,
        })
    # Order by blocker count desc, then readiness asc — no content leakage.
    project_rows.sort(key=lambda r: (-r["blocker_count"], r["readiness_score"]))
    return {
        "organization_id": context.organization.id,
        "scope": "ORGANIZATION",
        "counts": counts,
        "readiness_distribution": readiness_dist,
        "research_type_distribution": family_dist,
        "blocker_distribution": blocked_dist,
        "projects": project_rows[:200],
        "aggregate_only": True,
        "raw_content_excluded": True,
    }


import json  # noqa: E402
