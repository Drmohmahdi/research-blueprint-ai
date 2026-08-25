import hashlib
import json
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.thesis_workflow import now, validate_examiner_token
from ..services.notifications.outbox import OutboxService
from ..services.notifications.events import AggregateType, EventPayload, WorkflowEventType

router = APIRouter(prefix="/external-thesis-examiners", tags=["external-thesis-examiner"])


class AcceptRequest(BaseModel):
    accept: bool
    coi_disclosure: dict[str, Any] = Field(default_factory=dict)


class ReportRequest(BaseModel):
    rubric_version: str = Field(min_length=1, max_length=100)
    rubric_response: dict[str, Any] = Field(default_factory=dict)
    general_assessment: str | None = Field(default=None, max_length=20000)
    strengths: str | None = Field(default=None, max_length=10000)
    major_concerns: str | None = Field(default=None, max_length=10000)
    required_corrections: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    recommendation: Literal["PASS", "MINOR_CORRECTIONS", "MAJOR_CORRECTIONS", "REEXAMINATION", "FAIL"]
    confidential_comments: str | None = Field(default=None, max_length=10000)
    confidentiality_level: Literal["STUDENT_VISIBLE", "SUPERVISOR_VISIBLE", "COMMITTEE_ONLY", "GRADUATE_STUDIES_ONLY"] = "COMMITTEE_ONLY"


@router.get("/portal/{token}")
def portal(token: str, db: Session = Depends(get_db)):
    token_row, assignment = validate_examiner_token(db, token)
    member = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.id == assignment.committee_member_id).first()
    report = db.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.assignment_id == assignment.id).first()
    return {"assignment": {"id": assignment.id, "status": assignment.status, "due_at": assignment.due_at, "eligibility_status": assignment.eligibility_status, "coi_status": assignment.coi_status, "report_status": assignment.report_status, "examiner_name": member.external_name if member else None}, "thesis": assignment.frozen_thesis_snapshot_json, "thesis_fingerprint": assignment.frozen_thesis_fingerprint, "instructions": (assignment.frozen_thesis_snapshot_json or {}).get("examiner_instructions"), "own_report": ({"status": report.status, "recommendation": report.recommendation, "submitted_at": report.submitted_at} if report else None), "token_expires_at": token_row.expires_at}


@router.get("/portal/{token}/chapters/{chapter_id}/content", summary="Read a chapter's exact frozen examination version")
def download_frozen_chapter(token: str, chapter_id: str, db: Session = Depends(get_db)):
    """
    Serves the exact chapter version pinned at assignment-creation time — never
    the chapter's current/live approved version — so a later revision by the
    student cannot change what an in-progress examiner review is judging.
    """
    import re
    import urllib.parse
    from fastapi.responses import FileResponse
    from ..services.storage import get_storage_provider

    _, assignment = validate_examiner_token(db, token)
    snapshot = assignment.frozen_thesis_snapshot_json or {}
    entry = next((c for c in snapshot.get("chapters", []) if c.get("chapter_id") == chapter_id), None)
    if not entry or not entry.get("approved_version_id"):
        raise HTTPException(404, "الفصل ليس جزءًا من نسخة الفحص المجمدة / Chapter is not part of the frozen examination version")

    version = db.query(models.ThesisChapterVersion).filter(models.ThesisChapterVersion.id == entry["approved_version_id"]).first()
    if not version:
        raise HTTPException(404, "نسخة الفصل المجمدة غير موجودة / Frozen chapter version not found")

    if not version.file_id:
        return {"chapter_id": chapter_id, "version_id": version.id, "content": version.content_snapshot_json, "fingerprint": version.fingerprint}

    db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == version.file_id, models.UploadedFile.deleted_at.is_(None)).first()
    if not db_file:
        raise HTTPException(404, "ملف الفصل غير موجود / Chapter file not found")
    storage = get_storage_provider()
    if not storage.file_exists(db_file.storage_key):
        raise HTTPException(404, "ملف الفصل الفعلي غير موجود بوحدة التخزين / Physical chapter file not found")

    full_path = storage.get_file_path(db_file.storage_key)
    encoded_filename = urllib.parse.quote(db_file.filename)
    ascii_fallback = re.sub(r"[^\x20-\x7E]", "_", db_file.filename) or "chapter"
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Disposition": f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded_filename}'
    }
    return FileResponse(path=full_path, media_type=db_file.mime_type, headers=headers)


@router.post("/portal/{token}/respond")
def respond(token: str, body: AcceptRequest, db: Session = Depends(get_db)):
    token_row, assignment = validate_examiner_token(db, token)
    if assignment.status not in {"INVITED", "ACCEPTED"}: raise HTTPException(409, "Invitation cannot be changed")
    assignment.status = "ACCEPTED" if body.accept else "DECLINED"
    assignment.coi_status = "DECLARED" if body.coi_disclosure else "MISSING"
    token_row.accepted_at = now() if body.accept else None
    member = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.id == assignment.committee_member_id).first()
    if member: member.coi_json = body.coi_disclosure
    if body.accept:
        OutboxService.record_event(db, assignment.organization_id, WorkflowEventType.THESIS_EXAMINER_ACCEPTED, AggregateType.THESIS, assignment.thesis_id, EventPayload(title_ar="قبل المناقش الدعوة", title_en="Examiner accepted invitation", message_ar="تم قبول دعوة المناقشة دون كشف محتوى سري.", message_en="The examination invitation was accepted; confidential report content is not included.", target_type="THESIS", target_id=assignment.thesis_id, meta={"assignment_id": assignment.id}), scope_key=assignment.id)
    db.commit(); return {"assignment_id": assignment.id, "status": assignment.status, "coi_status": assignment.coi_status}


@router.put("/portal/{token}/report")
def save_report(token: str, body: ReportRequest, db: Session = Depends(get_db)):
    _, assignment = validate_examiner_token(db, token)
    if assignment.status != "ACCEPTED": raise HTTPException(409, "Assignment must be accepted")
    item = db.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.assignment_id == assignment.id).first()
    if item and item.status == "SUBMITTED": raise HTTPException(409, "Submitted examiner report is immutable")
    if not item:
        item = models.ThesisExaminerReport(id=f"thesis-report-{uuid.uuid4()}", organization_id=assignment.organization_id, thesis_id=assignment.thesis_id, examination_round_id=assignment.examination_round_id, assignment_id=assignment.id, rubric_version=body.rubric_version, thesis_fingerprint=assignment.frozen_thesis_fingerprint, created_at=now()); db.add(item)
    item.rubric_version=body.rubric_version; item.rubric_response_json=body.rubric_response; item.general_assessment=body.general_assessment; item.strengths=body.strengths; item.major_concerns=body.major_concerns; item.required_corrections_json=body.required_corrections; item.recommendation=body.recommendation; item.confidential_comments=body.confidential_comments; item.confidentiality_level=body.confidentiality_level
    assignment.report_status="DRAFT"; db.commit(); return {"id": item.id, "status": item.status}


@router.post("/portal/{token}/report/submit")
def submit_report(token: str, db: Session = Depends(get_db)):
    _, assignment = validate_examiner_token(db, token)
    db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.id == assignment.id).with_for_update().one()
    item = db.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.assignment_id == assignment.id).with_for_update().first()
    if not item: raise HTTPException(409, "Examiner report draft is required")
    if item.status == "SUBMITTED": return {"id": item.id, "status": item.status, "submitted_at": item.submitted_at}
    if not item.recommendation: raise HTTPException(409, "Recommendation is required")
    payload={"assignment":assignment.id,"round":assignment.examination_round_id,"thesis_fingerprint":item.thesis_fingerprint,"rubric_version":item.rubric_version,"rubric":item.rubric_response_json,"assessment":item.general_assessment,"strengths":item.strengths,"concerns":item.major_concerns,"corrections":item.required_corrections_json,"recommendation":item.recommendation,"confidential":item.confidential_comments,"level":item.confidentiality_level}
    item.report_fingerprint=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest(); item.status="SUBMITTED"; item.submitted_at=now(); assignment.report_status="SUBMITTED"; assignment.status="COMPLETED"
    OutboxService.record_event(db,assignment.organization_id,WorkflowEventType.THESIS_EXAMINER_REPORT_SUBMITTED,AggregateType.THESIS,assignment.thesis_id,EventPayload(title_ar="تم استلام تقرير المناقش",title_en="Examiner report submitted",message_ar="تم استلام تقرير مناقش دون تضمين أي محتوى سري في الإشعار.",message_en="An examiner report was received; confidential content is excluded from this notification.",target_type="THESIS",target_id=assignment.thesis_id,meta={"assignment_id":assignment.id}),scope_key=item.id); db.commit()
    return {"id": item.id, "status": item.status, "submitted_at": item.submitted_at, "fingerprint": item.report_fingerprint}
