import json
import hashlib
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.tenant_context import TenantContext, get_tenant_context
from ..services.notifications.outbox import OutboxService
from ..services.notifications.events import AggregateType, EventPayload, WorkflowEventType
from ..services.thesis_workflow import approve_chapter, approve_final, committee_composition_gaps, committee_eligibility, complete_deposit, correction_requires_final_authority, create_post_approval_amendment, create_thesis, decide_examination, defense_readiness, freeze_final_version, issue_examiner_token, next_action, now, policy_rules, submit_chapter_version

router = APIRouter(prefix="/theses", tags=["thesis-supervision"])
ADMIN_ROLES = {"OWNER", "ORGANIZATION_ADMIN"}


class PolicyCreate(BaseModel):
    degree_type: Literal["MASTERS", "DOCTORATE"]
    program_code: str | None = Field(default=None, max_length=100)
    version: int = Field(default=1, ge=1)
    rules: dict[str, Any] | None = None


class ThesisCreate(BaseModel):
    project_id: str
    policy_id: str
    student_user_id: str
    program_name: str = Field(min_length=2, max_length=300)
    research_type: Literal["EMPIRICAL", "SYSTEMATIC_REVIEW", "CONCEPTUAL"] = "EMPIRICAL"


class AssignmentCreate(BaseModel):
    user_id: str
    role: Literal["SUPERVISOR", "CO_SUPERVISOR"]
    can_final_recommend: bool = False


class MeetingCreate(BaseModel):
    scheduled_at: str
    status: Literal["SCHEDULED", "HELD", "CANCELLED", "MISSED"] = "SCHEDULED"
    agenda: list[str] = Field(default_factory=list, max_length=50)
    decisions: list[str] = Field(default_factory=list, max_length=50)
    private_supervisor_notes: str | None = Field(default=None, max_length=5000)


class ActionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    owner_user_id: str
    priority: Literal["BLOCKING", "HIGH", "NORMAL", "LOW"] = "NORMAL"
    due_at: str | None = None
    meeting_id: str | None = None


class ChapterVersionCreate(BaseModel):
    content: dict[str, Any] = Field(default_factory=dict)
    file_id: str | None = None
    change_summary: str | None = Field(default=None, max_length=1000)


class FeedbackCreate(BaseModel):
    chapter_version_id: str
    category: Literal["SCIENTIFIC_CONTENT", "METHODOLOGY", "LITERATURE", "ARGUMENTATION", "STATISTICS", "INTERPRETATION", "CITATION", "STRUCTURE", "LANGUAGE", "FORMATTING"]
    severity: Literal["BLOCKING", "MAJOR", "MINOR", "ADVISORY"]
    comment_text: str = Field(min_length=2, max_length=10000)
    location: dict[str, Any] = Field(default_factory=dict)


class FeedbackResolve(BaseModel):
    resolution_status: Literal["RESOLVED", "ACCEPTED_AS_IS", "REQUIRES_MORE_WORK"]


class ExaminationCreate(BaseModel):
    defense_at: str | None = None


class DecisionCreate(BaseModel):
    decision: Literal["PASS", "PASS_WITH_MINOR_CORRECTIONS", "MAJOR_CORRECTIONS", "REEXAMINATION", "FAIL"]


class CommitteeMemberCreate(BaseModel):
    user_id: str | None = None
    external_name: str | None = Field(default=None, max_length=300)
    external_email: str | None = Field(default=None, max_length=320)
    institution: str | None = Field(default=None, max_length=300)
    role: Literal["CHAIR", "SUPERVISOR", "CO_SUPERVISOR", "INTERNAL_EXAMINER", "EXTERNAL_EXAMINER", "MEMBER"]
    evidence: dict[str, Any] = Field(default_factory=dict)


class CoiDecision(BaseModel):
    decision: Literal["CLEARED", "NOT_CLEARED", "MORE_INFORMATION_REQUIRED"]
    reason: str = Field(min_length=2, max_length=2000)


class ExaminerAssignmentCreate(BaseModel):
    committee_member_id: str
    due_at: str | None = None


class InvitationCreate(BaseModel):
    expires_at: str


class DefenseSessionCreate(BaseModel):
    scheduled_at: str
    venue_type: Literal["IN_PERSON", "ONLINE", "HYBRID"]
    venue: dict[str, Any] = Field(default_factory=dict)


class CorrectionCreate(BaseModel):
    examination_round_id: str
    correction_type: Literal["MINOR", "MAJOR", "BLOCKING"]
    description: str = Field(min_length=2, max_length=10000)
    due_at: str | None = None
    source: str | None = Field(default="COMMITTEE", max_length=100)
    category: str | None = Field(default=None, max_length=100)
    chapter_id: str | None = None
    location: dict[str, Any] = Field(default_factory=dict)
    change_description: str | None = Field(default=None, max_length=5000)
    required: bool = True


class ExaminerReplace(BaseModel):
    committee_member_id: str
    reason: str = Field(min_length=2, max_length=2000)
    due_at: str | None = None


class DepositClearance(BaseModel):
    library: bool | None = None
    graduate_studies: bool | None = None


class ChapterApprove(BaseModel):
    version_id: str


class CorrectionResponse(BaseModel):
    response_text: str = Field(min_length=2, max_length=10000)
    evidence_version_id: str


class FinalVersionCreate(BaseModel):
    examination_round_id: str
    file_id: str | None = None
    content: dict[str, Any] = Field(default_factory=dict)


class FinalApprovalCreate(BaseModel):
    final_version_id: str
    rationale: str | None = Field(default=None, max_length=5000)


class PostApprovalAmendmentCreate(BaseModel):
    final_version_id: str
    reason: str = Field(min_length=2, max_length=2000)
    file_id: str | None = None
    content: dict[str, Any] = Field(default_factory=dict)


class DepositCreate(BaseModel):
    final_version_id: str
    repository_mode: Literal["MANUAL", "INTEGRATED"] = "MANUAL"
    repository_url: str | None = Field(default=None, max_length=2000)
    external_reference: str | None = Field(default=None, max_length=500)
    embargo: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    clearance: dict[str, Any] = Field(default_factory=dict)


class ThesisHandoffCreate(BaseModel):
    target: Literal["IDENTITY", "PROMOTION"]


def admin(ctx: TenantContext) -> bool:
    return ctx.is_global_admin or (ctx.role or "").upper() in ADMIN_ROLES


def thesis_event(db, thesis, event_type, actor_id, title_ar, title_en, message_ar, message_en, scope):
    OutboxService.record_event(db, thesis.organization_id, event_type, AggregateType.THESIS, thesis.id, EventPayload(title_ar=title_ar,title_en=title_en,message_ar=message_ar,message_en=message_en,target_type="THESIS",target_id=thesis.id,meta={}),actor_user_id=actor_id,scope_key=scope)


def thesis_or_404(db: Session, thesis_id: str, ctx: TenantContext) -> models.ThesisRecord:
    thesis = db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis_id, models.ThesisRecord.organization_id == ctx.organization.id).first()
    if not thesis: raise HTTPException(404, "Thesis not found")
    if thesis.student_user_id == ctx.user.id or admin(ctx): return thesis
    assigned = db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id == thesis.id, models.ThesisSupervisionAssignment.user_id == ctx.user.id, models.ThesisSupervisionAssignment.status == "ACTIVE").first()
    if not assigned: raise HTTPException(404, "Thesis not found")
    return thesis


def require_supervisor(db: Session, thesis: models.ThesisRecord, ctx: TenantContext, final: bool = False) -> models.ThesisSupervisionAssignment | None:
    # Cross-domain IAM consolidation Finding 1: supervisor-equivalent academic
    # authority (chapter approval, milestone completion, examination scheduling
    # and decisions, committee/examiner assignment, corrections) requires an
    # explicit ThesisSupervisionAssignment — generic OWNER/ORGANIZATION_ADMIN
    # role membership, and platform admin, no longer substitute for it, matching
    # the resource-scoped-relationship rule already enforced in Peer Review,
    # Promotion, Academic Identity and Research Data. The assignment authority
    # itself (who may assign a supervisor) remains admin-gated in
    # assign_supervisor — this function only governs acting AS the supervisor.
    item = db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id == thesis.id, models.ThesisSupervisionAssignment.user_id == ctx.user.id, models.ThesisSupervisionAssignment.status == "ACTIVE").first()
    if not item or (final and not item.can_final_recommend): raise HTTPException(403, "Supervisor relationship does not permit this operation")
    return item


def committee_member_of(db: Session, thesis_id: str, user_id: str) -> models.ThesisCommitteeMember | None:
    """An internal committee member with a platform account (chair/internal
    examiner) who is not otherwise a supervisor — used only to extend
    COMMITTEE_ONLY examiner-report visibility to the committee itself."""
    return db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == thesis_id, models.ThesisCommitteeMember.user_id == user_id, models.ThesisCommitteeMember.appointment_status != "REPLACED").first()


@router.post("/policies", status_code=201)
def add_policy(body: PolicyCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    if not admin(ctx): raise HTTPException(403, "Policy administration is not permitted")
    rules = body.rules or policy_rules(body.degree_type)
    item = models.ThesisPolicy(id=f"thesis-policy-{uuid.uuid4()}", organization_id=ctx.organization.id, degree_type=body.degree_type, program_code=body.program_code, version=body.version, status="ACTIVE", rules_json=rules, effective_from=now(), created_by=ctx.user.id, created_at=now())
    db.add(item); db.commit(); return {"id": item.id, "degree_type": item.degree_type, "version": item.version, "rules": item.rules_json}


@router.post("", status_code=201)
def add_thesis(body: ThesisCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    if not admin(ctx): raise HTTPException(403, "Thesis registration is not permitted")
    project = db.query(models.ResearchProject).filter(models.ResearchProject.id == body.project_id, models.ResearchProject.organizationId == ctx.organization.id).first()
    policy = db.query(models.ThesisPolicy).filter(models.ThesisPolicy.id == body.policy_id, models.ThesisPolicy.organization_id == ctx.organization.id, models.ThesisPolicy.status == "ACTIVE").first()
    if not project or not policy: raise HTTPException(404, "Project or active policy not found")
    item = create_thesis(db, project, policy, body.student_user_id, body.program_name, ctx.user.id, body.research_type)
    db.commit(); return {"id": item.id, "project_id": item.project_id, "degree_type": item.degree_type, "current_stage": item.current_stage}


@router.get("/projects/{project_id}")
def thesis_for_project(project_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    item = db.query(models.ThesisRecord).filter(models.ThesisRecord.project_id == project_id, models.ThesisRecord.organization_id == ctx.organization.id).first()
    if not item: raise HTTPException(404, "Thesis not found")
    thesis_or_404(db, item.id, ctx)
    return {"id": item.id, "project_id": item.project_id}


@router.get("/{thesis_id}/command-center")
def command_center(thesis_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx)
    ready = defense_readiness(db, thesis)
    chapters = db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == thesis.id).order_by(models.ThesisChapter.sort_order).all()
    meetings = db.query(models.ThesisMeeting).filter(models.ThesisMeeting.thesis_id == thesis.id).order_by(models.ThesisMeeting.scheduled_at.desc()).limit(10).all()
    overdue = db.query(models.ThesisAction).filter(models.ThesisAction.thesis_id == thesis.id, models.ThesisAction.status == "OPEN", models.ThesisAction.due_at.isnot(None), models.ThesisAction.due_at < now()).count()
    open_feedback = db.query(models.ThesisFeedback).filter(models.ThesisFeedback.thesis_id == thesis.id, models.ThesisFeedback.resolution_status == "OPEN").count()
    corrections_due = db.query(models.ThesisCorrection).filter(models.ThesisCorrection.thesis_id == thesis.id, models.ThesisCorrection.status != "VERIFIED").count()
    examiner_reports_due = db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.thesis_id == thesis.id, models.ThesisExaminerAssignment.report_status != "SUBMITTED", models.ThesisExaminerAssignment.status.in_(["INVITED", "ACCEPTED"])).count()
    committee = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == thesis.id).all()
    examinations = db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.thesis_id == thesis.id).order_by(models.ThesisExaminationRound.round_number).all()
    stage_states = thesis.stage_states_json or {}; completed = sum(1 for s in stage_states.values() if s.get("status") in {"APPROVED", "COMPLETED", "NOT_REQUIRED"}); applicable = sum(1 for s in stage_states.values() if s.get("applicability") != "NOT_REQUIRED") or 1
    return {
        "thesis": {"id": thesis.id, "title_ar": thesis.title_ar, "title_en": thesis.title_en, "degree_type": thesis.degree_type, "program": thesis.program_name, "current_stage": thesis.current_stage, "status": thesis.status, "final_version_id": thesis.final_version_id},
        "progress": round(100 * completed / applicable),
        "defense_readiness": ready,
        "next_best_action": next_action(ready, overdue, corrections_due, examiner_reports_due),
        "open_feedback": open_feedback,
        "corrections_due": corrections_due,
        "examiner_reports_due": examiner_reports_due,
        "chapters": [{"id": c.id, "key": c.chapter_key, "title": c.title, "status": c.status, "version": c.current_version_number, "stale_at": c.stale_at, "approved_version_id": c.approved_version_id} for c in chapters],
        "meetings": [{"id": m.id, "scheduled_at": m.scheduled_at, "status": m.status} for m in meetings],
        "committee": [{"id": m.id, "role": m.role, "eligibility_status": m.eligibility_status, "appointment_status": m.appointment_status, "external_name": m.external_name} for m in committee],
        "examinations": [{"id": r.id, "round_number": r.round_number, "status": r.status, "decision": r.human_decision, "defense_at": r.defense_at} for r in examinations],
    }


@router.post("/{thesis_id}/assignments", status_code=201)
def assign_supervisor(thesis_id: str, body: AssignmentCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx)
    if not admin(ctx): raise HTTPException(403, "Supervisor assignment is not permitted")
    if body.role == "CO_SUPERVISOR" and body.can_final_recommend: raise HTTPException(422, "Co-supervisor final authority requires an explicit institutional policy workflow")
    item = models.ThesisSupervisionAssignment(id=f"thesis-assignment-{uuid.uuid4()}", organization_id=ctx.organization.id, thesis_id=thesis.id, user_id=body.user_id, role=body.role, can_final_recommend=body.can_final_recommend, assigned_at=now())
    db.add(item); db.commit(); return {"id": item.id, "role": item.role, "can_final_recommend": item.can_final_recommend}


@router.post("/{thesis_id}/meetings", status_code=201)
def add_meeting(thesis_id: str, body: MeetingCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx)
    item = models.ThesisMeeting(id=f"thesis-meeting-{uuid.uuid4()}", organization_id=ctx.organization.id, thesis_id=thesis.id, scheduled_at=body.scheduled_at, status=body.status, agenda_json=body.agenda, decisions_json=body.decisions, private_supervisor_notes=body.private_supervisor_notes, recorded_by=ctx.user.id, created_at=now())
    db.add(item); db.commit()
    # Private notes are deliberately excluded from every response.
    return {"id": item.id, "scheduled_at": item.scheduled_at, "status": item.status}


@router.post("/{thesis_id}/actions", status_code=201)
def add_action(thesis_id: str, body: ActionCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx)
    if body.meeting_id and not db.query(models.ThesisMeeting).filter(models.ThesisMeeting.id == body.meeting_id, models.ThesisMeeting.thesis_id == thesis.id).first(): raise HTTPException(404, "Meeting not found")
    item = models.ThesisAction(id=f"thesis-action-{uuid.uuid4()}", organization_id=ctx.organization.id, thesis_id=thesis.id, meeting_id=body.meeting_id, title=body.title, owner_user_id=body.owner_user_id, priority=body.priority, due_at=body.due_at)
    db.add(item); db.commit(); return {"id": item.id, "status": item.status, "priority": item.priority}


@router.post("/{thesis_id}/chapters/{chapter_id}/versions", status_code=201)
def add_chapter_version(thesis_id: str, chapter_id: str, body: ChapterVersionCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx)
    if thesis.student_user_id != ctx.user.id and not admin(ctx): raise HTTPException(403, "Only the student may submit a chapter version")
    chapter = db.query(models.ThesisChapter).filter(models.ThesisChapter.id == chapter_id, models.ThesisChapter.thesis_id == thesis.id, models.ThesisChapter.organization_id == ctx.organization.id).first()
    if not chapter: raise HTTPException(404, "Chapter not found")
    if body.file_id and not db.query(models.UploadedFile).filter(models.UploadedFile.id == body.file_id, models.UploadedFile.organization_id == ctx.organization.id).first(): raise HTTPException(404, "File not found")
    item = submit_chapter_version(db, thesis, chapter, ctx.user.id, body.content, body.file_id, body.change_summary)
    thesis_event(db,thesis,WorkflowEventType.THESIS_CHAPTER_SUBMITTED,ctx.user.id,"تم تسليم نسخة فصل","Chapter version submitted","نسخة فصل جديدة جاهزة لمراجعة المشرف.","A new chapter version is ready for supervisor review.",item.id); db.commit()
    return {"id": item.id, "version_number": item.version_number, "fingerprint": item.fingerprint, "status": item.status}


@router.post("/{thesis_id}/chapters/{chapter_id}/approve")
def approve_chapter_version(thesis_id: str, chapter_id: str, body: ChapterApprove, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx)
    chapter = db.query(models.ThesisChapter).filter(models.ThesisChapter.id == chapter_id, models.ThesisChapter.thesis_id == thesis.id).first()
    version = db.query(models.ThesisChapterVersion).filter(models.ThesisChapterVersion.id == body.version_id, models.ThesisChapterVersion.chapter_id == chapter_id).first()
    if not chapter or not version: raise HTTPException(404, "Chapter or version not found")
    approve_chapter(chapter, version)
    db.flush()
    remaining = db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == thesis.id, models.ThesisChapter.status != "APPROVED").count()
    if remaining == 0:
        for milestone in db.query(models.ThesisMilestone).filter(models.ThesisMilestone.thesis_id == thesis.id, models.ThesisMilestone.code == "CHAPTERS_APPROVED").all():
            milestone.status = "COMPLETED"; milestone.completed_at = now()
    db.commit(); return {"id": chapter.id, "status": chapter.status, "approved_version_id": chapter.approved_version_id}


@router.post("/{thesis_id}/milestones/{milestone_id}/complete")
def complete_milestone(thesis_id: str, milestone_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx, final=True)
    item = db.query(models.ThesisMilestone).filter(models.ThesisMilestone.id == milestone_id, models.ThesisMilestone.thesis_id == thesis.id).first()
    if not item: raise HTTPException(404, "Milestone not found")
    item.status = "COMPLETED"; item.completed_at = now(); db.commit(); return {"id": item.id, "status": item.status}


@router.post("/{thesis_id}/feedback", status_code=201)
def add_feedback(thesis_id: str, body: FeedbackCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx)
    version = db.query(models.ThesisChapterVersion).join(models.ThesisChapter, models.ThesisChapter.id == models.ThesisChapterVersion.chapter_id).filter(models.ThesisChapterVersion.id == body.chapter_version_id, models.ThesisChapter.thesis_id == thesis.id).first()
    if not version: raise HTTPException(404, "Chapter version not found")
    item = models.ThesisFeedback(id=f"thesis-feedback-{uuid.uuid4()}", organization_id=ctx.organization.id, thesis_id=thesis.id, chapter_version_id=version.id, category=body.category, severity=body.severity, location_json=body.location, comment_text=body.comment_text, created_by=ctx.user.id, created_at=now())
    db.add(item); db.commit(); return {"id": item.id, "severity": item.severity, "resolution_status": item.resolution_status}


@router.patch("/{thesis_id}/feedback/{feedback_id}/resolve")
def resolve_feedback(thesis_id: str, feedback_id: str, body: FeedbackResolve, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx)
    item = db.query(models.ThesisFeedback).filter(models.ThesisFeedback.id == feedback_id, models.ThesisFeedback.thesis_id == thesis.id, models.ThesisFeedback.organization_id == ctx.organization.id).first()
    if not item: raise HTTPException(404, "Feedback not found")
    if item.severity == "BLOCKING": require_supervisor(db, thesis, ctx)
    elif thesis.student_user_id != ctx.user.id: require_supervisor(db, thesis, ctx)
    item.resolution_status = body.resolution_status; item.resolved_by = ctx.user.id; item.resolved_at = now() if body.resolution_status == "RESOLVED" else None
    db.commit(); return {"id": item.id, "resolution_status": item.resolution_status}


@router.post("/{thesis_id}/examinations", status_code=201)
def create_examination(thesis_id: str, body: ExaminationCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx, final=True)
    ready = defense_readiness(db, thesis)
    if ready["system_status"] != "READY": raise HTTPException(409, "Defense hard gates are not satisfied")
    latest = db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.thesis_id == thesis.id).order_by(models.ThesisExaminationRound.round_number.desc()).first(); number = (latest.round_number + 1) if latest else 1
    chapters = db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == thesis.id).all()
    snapshot = {"thesis_id": thesis.id, "title_ar": thesis.title_ar, "title_en": thesis.title_en, "chapters": [{"chapter_id": c.id, "approved_version_id": c.approved_version_id} for c in chapters]}
    item = models.ThesisExaminationRound(id=f"thesis-exam-{uuid.uuid4()}", organization_id=ctx.organization.id, thesis_id=thesis.id, round_number=number, thesis_snapshot_json=snapshot, policy_snapshot_json=thesis.policy_snapshot_json, defense_at=body.defense_at, created_at=now())
    db.add(item); db.commit(); return {"id": item.id, "round_number": item.round_number, "snapshot": item.thesis_snapshot_json}


@router.post("/{thesis_id}/examinations/{round_id}/decision")
def examination_decision(thesis_id: str, round_id: str, body: DecisionCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis = thesis_or_404(db, thesis_id, ctx); require_supervisor(db, thesis, ctx, final=True)
    item = db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id == round_id, models.ThesisExaminationRound.thesis_id == thesis.id, models.ThesisExaminationRound.organization_id == ctx.organization.id).with_for_update().first()
    if not item: raise HTTPException(404, "Examination round not found")
    gaps = committee_composition_gaps(db, thesis.policy_snapshot_json, item.id)
    if gaps: raise HTTPException(409, "Committee composition does not satisfy institutional policy: " + ", ".join(gaps))
    decide_examination(item, body.decision, ctx.user.id); thesis.current_stage = "CORRECTIONS" if "CORRECTION" in body.decision else "FINAL_APPROVAL"; thesis.updated_at = now(); db.commit()
    return {"id": item.id, "decision": item.human_decision, "decision_by": item.decision_by}


@router.post("/{thesis_id}/committee", status_code=201)
def add_committee_member(thesis_id: str, body: CommitteeMemberCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True)
    db.query(models.ThesisRecord).filter(models.ThesisRecord.id==thesis.id).with_for_update().one()
    if not body.user_id and not body.external_name: raise HTTPException(422,"Internal user or external examiner name is required")
    duplicate=db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id==thesis.id,models.ThesisCommitteeMember.role==body.role,models.ThesisCommitteeMember.user_id==body.user_id,models.ThesisCommitteeMember.external_email==body.external_email,models.ThesisCommitteeMember.appointment_status!="REPLACED").first()
    if duplicate: raise HTTPException(409,"Active committee seat already exists")
    item=models.ThesisCommitteeMember(id=f"thesis-member-{uuid.uuid4()}",organization_id=ctx.organization.id,thesis_id=thesis.id,user_id=body.user_id,external_name=body.external_name,external_email=body.external_email,institution=body.institution,role=body.role,coi_json=body.evidence)
    result=committee_eligibility(item,thesis.policy_snapshot_json); item.eligibility_status=result["status"]; item.appointment_history_json=[{"status":"PROPOSED","at":now(),"by":ctx.user.id,"eligibility_evidence":result["evidence"]}]
    db.add(item); db.commit(); return {"id":item.id,"role":item.role,"eligibility_status":item.eligibility_status,"eligibility_evidence":result["evidence"]}


@router.post("/{thesis_id}/committee/{member_id}/coi-decision")
def decide_coi(thesis_id:str,member_id:str,body:CoiDecision,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True)
    item=db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.id==member_id,models.ThesisCommitteeMember.thesis_id==thesis.id,models.ThesisCommitteeMember.organization_id==ctx.organization.id).first()
    if not item: raise HTTPException(404,"Committee member not found")
    disclosure=dict(item.coi_json or {}); disclosure["review"]={"decision":body.decision,"reason":body.reason,"reviewed_by":ctx.user.id,"reviewed_at":now()}; item.coi_json=disclosure
    if body.decision=="CLEARED" and item.eligibility_status!="INELIGIBLE": item.appointment_status="APPROVED"
    db.commit(); return {"id":item.id,"coi_decision":body.decision,"appointment_status":item.appointment_status}


@router.post("/{thesis_id}/examinations/{round_id}/assignments",status_code=201)
def add_examiner_assignment(thesis_id:str,round_id:str,body:ExaminerAssignmentCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True)
    round_=db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id==round_id,models.ThesisExaminationRound.thesis_id==thesis.id).first(); member=db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.id==body.committee_member_id,models.ThesisCommitteeMember.thesis_id==thesis.id).first()
    if not round_ or not member: raise HTTPException(404,"Examination round or committee member not found")
    review=(member.coi_json or {}).get("review",{}); coi="CLEARED" if review.get("decision")=="CLEARED" else "NOT_CLEARED"
    if member.eligibility_status!="ELIGIBLE" or coi!="CLEARED": raise HTTPException(409,"Examiner eligibility and human COI clearance are required")
    snapshot=json.loads(json.dumps(round_.thesis_snapshot_json)); fingerprint=__import__('hashlib').sha256(json.dumps(snapshot,sort_keys=True).encode()).hexdigest()
    item=models.ThesisExaminerAssignment(id=f"thesis-examiner-{uuid.uuid4()}",organization_id=ctx.organization.id,thesis_id=thesis.id,examination_round_id=round_.id,committee_member_id=member.id,frozen_thesis_fingerprint=fingerprint,frozen_thesis_snapshot_json=snapshot,status="APPROVED",due_at=body.due_at,eligibility_status=member.eligibility_status,eligibility_evidence_json=(member.appointment_history_json or [{}])[-1].get("eligibility_evidence",[]),coi_status=coi,created_by=ctx.user.id,created_at=now())
    db.add(item); db.commit(); return {"id":item.id,"status":item.status,"frozen_thesis_fingerprint":item.frozen_thesis_fingerprint}


@router.post("/{thesis_id}/examiner-assignments/{assignment_id}/invite",status_code=201)
def invite_examiner(thesis_id:str,assignment_id:str,body:InvitationCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True)
    item=db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.id==assignment_id,models.ThesisExaminerAssignment.thesis_id==thesis.id,models.ThesisExaminerAssignment.organization_id==ctx.organization.id).first()
    if not item: raise HTTPException(404,"Examiner assignment not found")
    token,raw=issue_examiner_token(db,item,body.expires_at); thesis_event(db,thesis,WorkflowEventType.THESIS_EXAMINER_INVITED,ctx.user.id,"دعوة مناقش خارجي","External examiner invited","تم إصدار دعوة آمنة مرتبطة بجولة المناقشة.","A scoped secure examination invitation was issued.",item.id); db.commit()
    return {"assignment_id":item.id,"token":raw,"expires_at":token.expires_at,"delivery":"RETURNED_ONCE_FOR_AUTHORIZED_DELIVERY"}


@router.post("/{thesis_id}/examiner-assignments/{assignment_id}/revoke")
def revoke_examiner(thesis_id:str,assignment_id:str,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True)
    item=db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.id==assignment_id,models.ThesisExaminerAssignment.thesis_id==thesis.id).first()
    if not item: raise HTTPException(404,"Examiner assignment not found")
    item.status="REVOKED"; tokens=db.query(models.ThesisExaminerToken).filter(models.ThesisExaminerToken.assignment_id==item.id,models.ThesisExaminerToken.revoked_at.is_(None)).all()
    for token in tokens: token.revoked_at=now(); token.revoked_by=ctx.user.id
    db.commit(); return {"id":item.id,"status":item.status}


@router.get("/{thesis_id}/committee")
def list_committee(thesis_id:str,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    rows=db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id==thesis.id).all()
    return [{"id":m.id,"role":m.role,"eligibility_status":m.eligibility_status,"appointment_status":m.appointment_status,"institution":m.institution,"external_name":m.external_name,"coi_review":(m.coi_json or {}).get("review")} for m in rows]


@router.get("/{thesis_id}/corrections")
def list_corrections(thesis_id:str,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    rows=db.query(models.ThesisCorrection).filter(models.ThesisCorrection.thesis_id==thesis.id).all()
    return [{"id":c.id,"correction_type":c.correction_type,"description":c.description,"status":c.status,"due_at":c.due_at,"details":c.details_json or {},"verified_by":c.verified_by,"verified_at":c.verified_at,"evidence_version_id":c.evidence_version_id} for c in rows]


@router.post("/{thesis_id}/examiner-assignments/{assignment_id}/replace",status_code=201)
def replace_examiner(thesis_id:str,assignment_id:str,body:ExaminerReplace,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True)
    previous=db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.id==assignment_id,models.ThesisExaminerAssignment.thesis_id==thesis.id).first()
    member=db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.id==body.committee_member_id,models.ThesisCommitteeMember.thesis_id==thesis.id).first()
    if not previous or not member: raise HTTPException(404,"Assignment or committee member not found")
    previous.status="REPLACED"
    for token in db.query(models.ThesisExaminerToken).filter(models.ThesisExaminerToken.assignment_id==previous.id,models.ThesisExaminerToken.revoked_at.is_(None)).all():
        token.revoked_at=now(); token.revoked_by=ctx.user.id
    item=models.ThesisExaminerAssignment(id=f"thesis-examiner-{uuid.uuid4()}",organization_id=ctx.organization.id,thesis_id=thesis.id,examination_round_id=previous.examination_round_id,committee_member_id=member.id,frozen_thesis_fingerprint=previous.frozen_thesis_fingerprint,frozen_thesis_snapshot_json=previous.frozen_thesis_snapshot_json,status="APPROVED",due_at=body.due_at or previous.due_at,eligibility_status=member.eligibility_status,eligibility_evidence_json=previous.eligibility_evidence_json,coi_status="MISSING",replacement_of_id=previous.id,replacement_reason=body.reason,created_by=ctx.user.id,created_at=now())
    db.add(item); db.commit(); return {"id":item.id,"status":item.status,"replacement_of_id":previous.id,"previous_status":previous.status}


@router.patch("/{thesis_id}/deposit/clearance")
def update_deposit_clearance(thesis_id:str,body:DepositClearance,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if not admin(ctx): raise HTTPException(403,"Graduate Studies deposit authority is required")
    item=db.query(models.ThesisDeposit).filter(models.ThesisDeposit.thesis_id==thesis.id).first()
    if not item: raise HTTPException(404,"Deposit record not found")
    clearance=dict(item.clearance_json or {})
    if body.library is not None: clearance["library"]=body.library
    if body.graduate_studies is not None: clearance["graduate_studies"]=body.graduate_studies
    item.clearance_json=clearance
    if item.status=="VERIFIED": raise HTTPException(409,"Verified deposit is immutable")
    db.commit(); return {"id":item.id,"clearance":item.clearance_json,"graduation_cleared":bool(clearance.get("library") and clearance.get("graduate_studies")),"thesis_status":thesis.status}


@router.get("/{thesis_id}/examiner-reports")
def list_examiner_reports(thesis_id:str,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=db.query(models.ThesisRecord).filter(models.ThesisRecord.id==thesis_id,models.ThesisRecord.organization_id==ctx.organization.id).first()
    if not thesis: raise HTTPException(404,"Thesis not found")
    assigned=db.query(models.ThesisSupervisionAssignment).filter(models.ThesisSupervisionAssignment.thesis_id==thesis.id,models.ThesisSupervisionAssignment.user_id==ctx.user.id,models.ThesisSupervisionAssignment.status=="ACTIVE").first()
    committee=committee_member_of(db,thesis.id,ctx.user.id)
    is_student=thesis.student_user_id==ctx.user.id
    is_graduate_studies=admin(ctx)
    if not (is_graduate_studies or assigned or committee or is_student): raise HTTPException(404,"Thesis not found")
    # Cross-domain IAM consolidation Finding 1 + Finding 3: generic org-admin/
    # platform-admin no longer bypasses into SUPERVISOR_VISIBLE/COMMITTEE_ONLY
    # confidential content (that still requires the genuine supervisor/committee
    # relationship). "Graduate Studies" oversight is instead scoped to exactly
    # its own GRADUATE_STUDIES_ONLY tier, which was previously unreachable by
    # anyone through this endpoint — this makes it reachable for its intended
    # audience without reintroducing a blanket bypass on every other tier.
    can_confidential=bool(assigned and assigned.role=="SUPERVISOR"); is_committee_viewer=bool(committee) and not can_confidential
    reports=db.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.thesis_id==thesis.id,models.ThesisExaminerReport.status=="SUBMITTED").all()
    visible=[r for r in reports if can_confidential or (is_student and r.confidentiality_level=="STUDENT_VISIBLE") or (assigned and r.confidentiality_level in {"STUDENT_VISIBLE","SUPERVISOR_VISIBLE"}) or (is_committee_viewer and r.confidentiality_level in {"STUDENT_VISIBLE","SUPERVISOR_VISIBLE","COMMITTEE_ONLY"}) or (is_graduate_studies and r.confidentiality_level=="GRADUATE_STUDIES_ONLY")]
    return [{"id":r.id,"assignment_id":r.assignment_id,"recommendation":r.recommendation,"general_assessment":r.general_assessment,"confidential_comments":r.confidential_comments if (can_confidential or (is_committee_viewer and r.confidentiality_level=="COMMITTEE_ONLY") or (is_graduate_studies and r.confidentiality_level=="GRADUATE_STUDIES_ONLY")) else None,"confidentiality_level":r.confidentiality_level,"submitted_at":r.submitted_at,"fingerprint":r.report_fingerprint} for r in visible]


@router.post("/{thesis_id}/examinations/{round_id}/defense-session",status_code=201)
def add_defense_session(thesis_id:str,round_id:str,body:DefenseSessionCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True); round_=db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id==round_id,models.ThesisExaminationRound.thesis_id==thesis.id).first()
    if not round_: raise HTTPException(404,"Examination round not found")
    fingerprint=__import__('hashlib').sha256(json.dumps(round_.thesis_snapshot_json,sort_keys=True).encode()).hexdigest(); item=models.ThesisDefenseSession(id=f"defense-session-{uuid.uuid4()}",organization_id=ctx.organization.id,thesis_id=thesis.id,examination_round_id=round_.id,scheduled_at=body.scheduled_at,venue_type=body.venue_type,venue_json=body.venue,thesis_fingerprint=fingerprint,created_by=ctx.user.id,created_at=now()); db.add(item); thesis_event(db,thesis,WorkflowEventType.THESIS_DEFENSE_SCHEDULED,ctx.user.id,"تم تحديد موعد المناقشة","Defense scheduled","تم تحديد جلسة المناقشة.","The defense session has been scheduled.",item.id); db.commit(); return {"id":item.id,"status":item.status,"thesis_fingerprint":item.thesis_fingerprint}


@router.post("/{thesis_id}/corrections",status_code=201)
def add_correction(thesis_id:str,body:CorrectionCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx); round_=db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id==body.examination_round_id,models.ThesisExaminationRound.thesis_id==thesis.id).first()
    if not round_ or not round_.human_decision: raise HTTPException(409,"A decided examination round is required")
    item=models.ThesisCorrection(id=f"thesis-correction-{uuid.uuid4()}",organization_id=ctx.organization.id,thesis_id=thesis.id,examination_round_id=round_.id,correction_type=body.correction_type,description=body.description,due_at=body.due_at,details_json={"source":body.source,"category":body.category,"chapter_id":body.chapter_id,"location":body.location,"change_description":body.change_description,"required":body.required}); db.add(item); thesis_event(db,thesis,WorkflowEventType.THESIS_CORRECTIONS_REQUIRED,ctx.user.id,"تصحيحات مطلوبة","Corrections required","تم تسجيل متطلبات تصحيح جديدة.","New correction requirements were recorded.",item.id)
    if body.due_at:
        thesis_event(db,thesis,WorkflowEventType.THESIS_CORRECTION_DEADLINE_APPROACHING,ctx.user.id,"اقتراب موعد التصحيح","Correction deadline approaching","موعد تصحيح مطلوب يقترب.","A required correction deadline is approaching.",item.id)
    db.commit(); return {"id":item.id,"status":item.status,"correction_type":item.correction_type,"details":item.details_json}


@router.post("/{thesis_id}/corrections/{correction_id}/respond")
def respond_correction(thesis_id:str,correction_id:str,body:CorrectionResponse,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if thesis.student_user_id!=ctx.user.id: raise HTTPException(403,"Only the student may submit a correction response")
    item=db.query(models.ThesisCorrection).filter(models.ThesisCorrection.id==correction_id,models.ThesisCorrection.thesis_id==thesis.id).first(); version=db.query(models.ThesisChapterVersion).join(models.ThesisChapter,models.ThesisChapter.id==models.ThesisChapterVersion.chapter_id).filter(models.ThesisChapterVersion.id==body.evidence_version_id,models.ThesisChapter.thesis_id==thesis.id).first()
    if not item or not version: raise HTTPException(404,"Correction or evidence version not found")
    item.response_text=body.response_text; item.evidence_version_id=version.id; item.status="SUBMITTED_FOR_VERIFICATION"; db.commit(); return {"id":item.id,"status":item.status}


@router.post("/{thesis_id}/corrections/{correction_id}/verify")
def verify_correction(thesis_id:str,correction_id:str,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if thesis.student_user_id==ctx.user.id: raise HTTPException(403,"Students cannot verify their own corrections")
    item=db.query(models.ThesisCorrection).filter(models.ThesisCorrection.id==correction_id,models.ThesisCorrection.thesis_id==thesis.id).first()
    if not item: raise HTTPException(404,"Correction not found")
    require_supervisor(db,thesis,ctx,final=correction_requires_final_authority(item,thesis.policy_snapshot_json))
    if item.status!="SUBMITTED_FOR_VERIFICATION" or not item.evidence_version_id: raise HTTPException(409,"Correction evidence is incomplete")
    existing=db.query(models.ThesisCorrection).filter(models.ThesisCorrection.id==item.id).with_for_update().one()
    if existing.status=="VERIFIED": return {"id":existing.id,"status":existing.status,"verified_by":existing.verified_by}
    existing.status="VERIFIED"; existing.verified_by=ctx.user.id; existing.verified_at=now(); db.commit(); return {"id":existing.id,"status":existing.status,"verified_by":existing.verified_by}


@router.post("/{thesis_id}/final-version",status_code=201)
def add_final_version(thesis_id:str,body:FinalVersionCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx); require_supervisor(db,thesis,ctx,final=True); round_=db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id==body.examination_round_id,models.ThesisExaminationRound.thesis_id==thesis.id).first()
    if not round_: raise HTTPException(404,"Examination round not found")
    if body.file_id and not db.query(models.UploadedFile).filter(models.UploadedFile.id==body.file_id,models.UploadedFile.organization_id==ctx.organization.id).first(): raise HTTPException(404,"File not found")
    item=freeze_final_version(db,thesis,round_,ctx.user.id,body.content,body.file_id); thesis_event(db,thesis,WorkflowEventType.THESIS_FINAL_APPROVAL_REQUIRED,ctx.user.id,"يلزم الاعتماد النهائي","Final approval required","نسخة نهائية مجمدة بانتظار اعتماد الدراسات العليا.","A frozen final version awaits Graduate Studies approval.",item.id); db.commit(); return {"id":item.id,"fingerprint":item.fingerprint,"version_type":item.version_type}


@router.post("/{thesis_id}/final-approval",status_code=201)
def final_approval(thesis_id:str,body:FinalApprovalCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if not admin(ctx): raise HTTPException(403,"Graduate Studies approval authority is required")
    final=db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.id==body.final_version_id,models.ThesisFinalVersion.thesis_id==thesis.id).first()
    if not final: raise HTTPException(404,"Final thesis version not found")
    item=approve_final(db,thesis,final,ctx.user.id,body.rationale); db.commit(); return {"id":item.id,"status":item.status,"approved_by":item.approved_by}


@router.post("/{thesis_id}/final-version/amendment",status_code=201)
def add_post_approval_amendment(thesis_id:str,body:PostApprovalAmendmentCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if not admin(ctx): raise HTTPException(403,"Graduate Studies approval authority is required to amend an approved thesis")
    original=db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.id==body.final_version_id,models.ThesisFinalVersion.thesis_id==thesis.id).first()
    if not original: raise HTTPException(404,"Final thesis version not found")
    if body.file_id and not db.query(models.UploadedFile).filter(models.UploadedFile.id==body.file_id,models.UploadedFile.organization_id==ctx.organization.id).first(): raise HTTPException(404,"File not found")
    item=create_post_approval_amendment(db,thesis,original,ctx.user.id,body.content,body.file_id,body.reason); thesis_event(db,thesis,WorkflowEventType.THESIS_FINAL_APPROVAL_REQUIRED,ctx.user.id,"تم تسجيل تعديل لاحق للاعتماد","Post-approval amendment recorded","تم تسجيل تعديل رسمي على نسخة معتمدة مسبقًا دون المساس بالنسخة التاريخية.","A formal amendment was recorded against a previously approved version; the historical version is unchanged.",item.id); db.commit(); return {"id":item.id,"fingerprint":item.fingerprint,"version_type":item.version_type,"amends_version_id":body.final_version_id}


@router.post("/{thesis_id}/deposit",status_code=201)
def add_deposit(thesis_id:str,body:DepositCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if not admin(ctx): raise HTTPException(403,"Graduate Studies deposit authority is required")
    approval=db.query(models.ThesisFinalApproval).filter(models.ThesisFinalApproval.thesis_id==thesis.id,models.ThesisFinalApproval.final_version_id==body.final_version_id).first()
    if not approval: raise HTTPException(409,"Final approval is required before deposit")
    item=models.ThesisDeposit(id=f"thesis-deposit-{uuid.uuid4()}",organization_id=ctx.organization.id,thesis_id=thesis.id,final_version_id=body.final_version_id,repository_mode=body.repository_mode,repository_url=body.repository_url,external_reference=body.external_reference,embargo_json=body.embargo,metadata_json=body.metadata,clearance_json=body.clearance); db.add(item); db.flush(); complete_deposit(thesis,item,ctx.user.id); db.commit(); return {"id":item.id,"status":item.status,"thesis_status":thesis.status,"repository_mode":item.repository_mode}


@router.get("/operations/summary")
def graduate_operations(db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    if not admin(ctx): raise HTTPException(403,"Graduate Studies operations access is required")
    base=db.query(models.ThesisRecord).filter(models.ThesisRecord.organization_id==ctx.organization.id); rows=base.all(); stage={}
    for t in rows: stage[t.current_stage]=stage.get(t.current_stage,0)+1
    return {"active":sum(t.status=="ACTIVE" for t in rows),"masters":sum(t.degree_type=="MASTERS" for t in rows),"doctorates":sum(t.degree_type=="DOCTORATE" for t in rows),"stage_distribution":stage,"pending_approvals":db.query(models.ThesisChapter).filter(models.ThesisChapter.organization_id==ctx.organization.id,models.ThesisChapter.status=="SUBMITTED").count(),"at_risk":db.query(models.ThesisAction).filter(models.ThesisAction.organization_id==ctx.organization.id,models.ThesisAction.status=="OPEN",models.ThesisAction.due_at.isnot(None),models.ThesisAction.due_at<now()).count(),"overdue_milestones":db.query(models.ThesisMilestone).filter(models.ThesisMilestone.organization_id==ctx.organization.id,models.ThesisMilestone.status!="COMPLETED",models.ThesisMilestone.due_at.isnot(None),models.ThesisMilestone.due_at<now()).count(),"supervisor_reviews_pending":db.query(models.ThesisChapter).filter(models.ThesisChapter.organization_id==ctx.organization.id,models.ThesisChapter.status=="SUBMITTED").count(),"upcoming_defenses":db.query(models.ThesisDefenseSession).filter(models.ThesisDefenseSession.organization_id==ctx.organization.id,models.ThesisDefenseSession.status=="SCHEDULED").count(),"pending_examiner_invitations":db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.organization_id==ctx.organization.id,models.ThesisExaminerAssignment.status.in_(["APPROVED","INVITED"])).count(),"examiner_reports_due":db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.organization_id==ctx.organization.id,models.ThesisExaminerAssignment.report_status!="SUBMITTED",models.ThesisExaminerAssignment.status.in_(["INVITED","ACCEPTED"])).count(),"corrections_due":db.query(models.ThesisCorrection).filter(models.ThesisCorrection.organization_id==ctx.organization.id,models.ThesisCorrection.status!="VERIFIED").count(),"final_approvals_pending":max(0,db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.organization_id==ctx.organization.id).count()-db.query(models.ThesisFinalApproval).filter(models.ThesisFinalApproval.organization_id==ctx.organization.id).count()),"deposits_pending":db.query(models.ThesisDeposit).filter(models.ThesisDeposit.organization_id==ctx.organization.id,models.ThesisDeposit.status!="VERIFIED").count()}


@router.post("/{thesis_id}/handoffs",status_code=201)
def thesis_handoff(thesis_id:str,body:ThesisHandoffCreate,db:Session=Depends(get_db),ctx:TenantContext=Depends(get_tenant_context)):
    thesis=thesis_or_404(db,thesis_id,ctx)
    if thesis.student_user_id!=ctx.user.id and not admin(ctx): raise HTTPException(403,"Human thesis owner confirmation is required")
    deposit=db.query(models.ThesisDeposit).filter(models.ThesisDeposit.thesis_id==thesis.id,models.ThesisDeposit.status=="VERIFIED").first()
    if thesis.status!="COMPLETED" or not deposit: raise HTTPException(409,"Completed thesis and verified deposit are required")
    handoff_type=f"THESIS_TO_{body.target}"; key=hashlib.sha256(f"{thesis.organization_id}:{thesis.id}:{handoff_type}:{deposit.id}".encode()).hexdigest(); existing=db.query(models.AcademicHandoff).filter(models.AcademicHandoff.idempotency_key==key).first()
    if existing: return {"id":existing.id,"status":existing.status,"candidate_only":True}
    payload={"thesis_id":thesis.id,"title_ar":thesis.title_ar,"title_en":thesis.title_en,"degree_type":thesis.degree_type,"year":(deposit.verified_at or '')[:4],"repository_url":deposit.repository_url,"external_reference":deposit.external_reference,"candidate_only":True,"human_confirmation_required":True}
    item=models.AcademicHandoff(id=f"thesis-handoff-{uuid.uuid4()}",organization_id=thesis.organization_id,project_id=thesis.project_id,handoff_type=handoff_type,source_entity_type="THESIS",source_entity_id=thesis.id,source_version=deposit.verified_at,source_fingerprint=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest(),target_domain=body.target,target_entity_type="ACADEMIC_PROFILE_CANDIDATE" if body.target=="IDENTITY" else "PROMOTION_EVIDENCE_CANDIDATE",target_entity_id=None,payload_json=payload,schema_version=1,status="PENDING",idempotency_key=key,created_by=ctx.user.id,created_at=now()); db.add(item); db.commit(); return {"id":item.id,"status":item.status,"candidate_only":True}
