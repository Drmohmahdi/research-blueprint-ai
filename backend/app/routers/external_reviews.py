import datetime
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.sanitization import sanitize_text

router = APIRouter(prefix="/external-reviews", tags=["External Reviewer Portal"])


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hash of a raw token for safe lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def get_and_validate_external_token(token: str, db: Session) -> models.ReviewerAssignment:
    """
    Validates high-entropy external reviewer token against stored SHA-256 hash.
    Ensures token is not revoked, not expired, and resolves assignment.
    """
    token_hash = hash_token(token)
    token_record = db.query(models.ExternalReviewerToken).filter(
        models.ExternalReviewerToken.token_hash == token_hash
    ).first()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or unrecognized external reviewer invitation link"
        )

    if token_record.revoked_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This review invitation has been revoked by the editorial board"
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    if token_record.expires_at and token_record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This review invitation link has expired"
        )

    assignment = token_record.assignment
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review assignment not found"
        )

    if assignment.status in ["REVOKED", "DECLINED"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This review assignment is no longer active (revoked or declined)"
        )

    return assignment



@router.get("/portal/{token}", response_model=schemas.ExternalReviewerPortalResponse)
def get_external_reviewer_portal_data(
    token: str,
    db: Session = Depends(get_db)
):
    assignment = get_and_validate_external_token(token, db)
    rnd = assignment.round
    case = rnd.case

    # Double-blind check: Always present anonymous/sanitized manuscript data for external reviewers
    rubric = rnd.rubric
    rubric_resp = schemas.ReviewRubricResponse.model_validate(rubric) if rubric else None

    # Load submission if exists
    submission_resp = schemas.ReviewSubmissionResponse.model_validate(assignment.submission) if assignment.submission else None

    # Snapshot data
    ms_snap = rnd.manuscript_snapshot_json or {}
    title = ms_snap.get("title_ar") or case.title_ar
    abstract = ms_snap.get("abstract_ar") or case.abstract_ar

    return schemas.ExternalReviewerPortalResponse(
        assignment_id=assignment.id,
        case_id=case.id,
        round_id=rnd.id,
        round_number=rnd.round_number,
        manuscript_version=rnd.manuscript_version,
        manuscript_title=title,
        manuscript_abstract=abstract,
        case_type=case.case_type,
        blind_type=case.blind_type,
        due_at=assignment.due_at,
        assignment_status=assignment.status,
        conflict_status=assignment.conflict_status,
        reviewer_name=assignment.external_name,
        rubric=rubric_resp,
        submission=submission_resp
    )


@router.post("/portal/{token}/accept", response_model=schemas.ExternalReviewerPortalResponse)
def external_reviewer_accept_assignment(
    token: str,
    payload: schemas.ReviewerAcceptRequest,
    db: Session = Depends(get_db)
):
    assignment = get_and_validate_external_token(token, db)

    if assignment.status in ["SUBMITTED", "EXPIRED", "REVOKED"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot accept assignment in status {assignment.status}")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    assignment.status = "ACCEPTED"
    assignment.conflict_status = payload.conflict_status
    assignment.conflict_notes = payload.conflict_notes
    assignment.accepted_at = now

    # Pre-create draft submission if none exists
    if not assignment.submission:
        sub = models.ReviewSubmission(
            id=f"sub-{secrets.token_hex(6)}",
            assignment_id=assignment.id,
            round_id=assignment.round_id,
            case_id=assignment.case_id,
            status="DRAFT",
            recommendation="MINOR_REVISION",
            total_weighted_score=0.0,
            created_at=now,
            updated_at=now
        )
        db.add(sub)

    db.commit()
    db.refresh(assignment)
    return get_external_reviewer_portal_data(token, db)


@router.post("/portal/{token}/decline", response_model=schemas.ExternalReviewerPortalResponse)
def external_reviewer_decline_assignment(
    token: str,
    payload: schemas.ReviewerDeclineRequest,
    db: Session = Depends(get_db)
):
    assignment = get_and_validate_external_token(token, db)

    if assignment.status in ["SUBMITTED", "EXPIRED", "REVOKED"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot decline assignment in status {assignment.status}")

    assignment.status = "DECLINED"
    assignment.decline_reason = payload.decline_reason

    db.commit()
    db.refresh(assignment)
    return get_external_reviewer_portal_data(token, db)


@router.put("/portal/{token}/draft", response_model=schemas.ReviewSubmissionResponse)
def external_reviewer_save_draft(
    token: str,
    payload: schemas.ReviewSubmissionDraftRequest,
    db: Session = Depends(get_db)
):
    assignment = get_and_validate_external_token(token, db)

    if assignment.status == "SUBMITTED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review has already been submitted and cannot be modified")

    if assignment.status in ["DECLINED", "EXPIRED", "REVOKED"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot save review draft in status {assignment.status}")

    if assignment.conflict_status == "CONFLICT_DECLARED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewer declared a conflict of interest; review cannot proceed until resolved by editorial committee"
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    assignment.status = "IN_PROGRESS"

    submission = assignment.submission
    if not submission:
        submission = models.ReviewSubmission(
            id=f"sub-{secrets.token_hex(6)}",
            assignment_id=assignment.id,
            round_id=assignment.round_id,
            case_id=assignment.case_id,
            status="DRAFT",
            recommendation=payload.recommendation or "MINOR_REVISION",
            summary_evaluation_ar=payload.summary_evaluation_ar,
            summary_evaluation_en=payload.summary_evaluation_en,
            is_confidential_to_editor=bool(payload.is_confidential_to_editor),
            total_weighted_score=0.0,
            created_at=now,
            updated_at=now
        )
        db.add(submission)
        db.flush()
    else:
        submission.recommendation = payload.recommendation or submission.recommendation
        submission.summary_evaluation_ar = payload.summary_evaluation_ar
        submission.summary_evaluation_en = payload.summary_evaluation_en
        submission.is_confidential_to_editor = bool(payload.is_confidential_to_editor)
        submission.updated_at = now

    # Clear old responses and add new
    db.query(models.ReviewCriterionResponse).filter(
        models.ReviewCriterionResponse.submission_id == submission.id
    ).delete()

    for item in payload.responses:
        if item.score_value is not None and (item.score_value < 0.0 or item.score_value > 10.0):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Score value {item.score_value} is out of valid range (0 to 10)"
            )
        resp = models.ReviewCriterionResponse(
            id=f"rcr-{secrets.token_hex(6)}",
            submission_id=submission.id,
            criterion_id=item.criterion_id,
            score_value=item.score_value,
            text_value=item.text_value,
            choice_value=item.choice_value,
            comments=item.comments,
            created_at=now
        )
        db.add(resp)

    # Replace comments
    db.query(models.ReviewComment).filter(
        models.ReviewComment.submission_id == submission.id
    ).delete()

    for c in payload.comments:
        comment = models.ReviewComment(
            id=f"rcm-{secrets.token_hex(6)}",
            submission_id=submission.id,
            case_id=assignment.case_id,
            round_id=assignment.round_id,
            section_key=c.section_key,
            comment_type=c.comment_type,
            comment_text=sanitize_text(c.comment_text),
            is_resolved=False,
            created_at=now
        )
        db.add(comment)

    db.commit()
    db.refresh(submission)
    return schemas.ReviewSubmissionResponse.model_validate(submission)


@router.post("/portal/{token}/submit", response_model=schemas.ReviewSubmissionResponse)
def external_reviewer_submit_review(
    token: str,
    payload: schemas.ReviewSubmissionFinalRequest,
    db: Session = Depends(get_db)
):
    assignment = get_and_validate_external_token(token, db)

    if assignment.status == "SUBMITTED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review has already been submitted and cannot be resubmitted")

    if assignment.status in ["DECLINED", "EXPIRED", "REVOKED"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot submit review in assignment status '{assignment.status}'")

    if assignment.conflict_status == "CONFLICT_DECLARED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewer declared a conflict of interest; review cannot proceed until resolved by editorial committee"
        )

    # Fetch round and rubric criteria
    rnd = assignment.round
    rubric = rnd.rubric
    mandatory_criteria = [c for c in rubric.criteria if c.is_mandatory] if rubric else []

    # Validate that all mandatory criteria have score/response
    provided_crit_ids = {r.criterion_id for r in payload.responses if r.score_value is not None or r.text_value or r.choice_value}
    for mc in mandatory_criteria:
        if mc.id not in provided_crit_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Mandatory review criterion '{mc.title_ar}' must be completed before submission"
            )

    now = datetime.datetime.now(datetime.UTC).isoformat()

    # Calculate weighted score & validate bounds
    total_score = 0.0
    total_weight = 0.0
    for r in payload.responses:
        if r.score_value is not None:
            if r.score_value < 0.0 or r.score_value > 10.0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Score value {r.score_value} is out of valid range (0 to 10)"
                )
            crit = next((c for c in rubric.criteria if c.id == r.criterion_id), None) if rubric else None
            if crit:
                total_score += (r.score_value * crit.weight)
                total_weight += crit.weight

    weighted_score = (total_score / total_weight) if total_weight > 0 else 0.0

    submission = assignment.submission
    if not submission:
        submission = models.ReviewSubmission(
            id=f"sub-{secrets.token_hex(6)}",
            assignment_id=assignment.id,
            round_id=assignment.round_id,
            case_id=assignment.case_id,
            status="SUBMITTED",
            recommendation=payload.recommendation,
            summary_evaluation_ar=payload.summary_evaluation_ar,
            summary_evaluation_en=payload.summary_evaluation_en,
            total_weighted_score=round(weighted_score, 2),
            is_confidential_to_editor=bool(payload.is_confidential_to_editor),
            submitted_at=now,
            created_at=now,
            updated_at=now
        )
        db.add(submission)
        db.flush()
    else:
        submission.status = "SUBMITTED"
        submission.recommendation = payload.recommendation
        submission.summary_evaluation_ar = payload.summary_evaluation_ar
        submission.summary_evaluation_en = payload.summary_evaluation_en
        submission.total_weighted_score = round(weighted_score, 2)
        submission.is_confidential_to_editor = bool(payload.is_confidential_to_editor)
        submission.submitted_at = now
        submission.updated_at = now

    # Store responses
    db.query(models.ReviewCriterionResponse).filter(
        models.ReviewCriterionResponse.submission_id == submission.id
    ).delete()

    for item in payload.responses:
        resp = models.ReviewCriterionResponse(
            id=f"rcr-{secrets.token_hex(6)}",
            submission_id=submission.id,
            criterion_id=item.criterion_id,
            score_value=item.score_value,
            text_value=item.text_value,
            choice_value=item.choice_value,
            comments=item.comments,
            created_at=now
        )
        db.add(resp)

    # Store comments
    db.query(models.ReviewComment).filter(
        models.ReviewComment.submission_id == submission.id
    ).delete()

    for c in payload.comments:
        comment = models.ReviewComment(
            id=f"rcm-{secrets.token_hex(6)}",
            submission_id=submission.id,
            case_id=assignment.case_id,
            round_id=assignment.round_id,
            section_key=c.section_key,
            comment_type=c.comment_type,
            comment_text=sanitize_text(c.comment_text),
            is_resolved=False,
            created_at=now
        )
        db.add(comment)

    assignment.status = "SUBMITTED"
    assignment.submitted_at = now

    db.commit()
    db.refresh(submission)
    return schemas.ReviewSubmissionResponse.model_validate(submission)


@router.get("/portal/{token}/manuscript", summary="Download assigned manuscript file for external referee")
def download_external_reviewer_manuscript(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Allows external referees with valid non-expired tokens to download the specific manuscript
    file assigned to their review round. Strict horizontal isolation, zero IDOR.
    """
    import urllib.parse
    import re
    from fastapi.responses import FileResponse
    from ..services.storage import get_storage_provider

    assignment = get_and_validate_external_token(token, db)

    if assignment.status in ["REVOKED", "DECLINED"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="تم إلغاء أو رفض دعوة التحكيم هذه / Assignment invitation has been revoked or declined"
        )

    # Find the manuscript revision for this round
    rev = db.query(models.ManuscriptRevision).filter(
        models.ManuscriptRevision.case_id == assignment.case_id,
        models.ManuscriptRevision.round_id == assignment.round_id
    ).first()

    if not rev:
        # Fallback to latest revision matching version
        rev = db.query(models.ManuscriptRevision).filter(
            models.ManuscriptRevision.case_id == assignment.case_id,
            models.ManuscriptRevision.version_number == assignment.round.manuscript_version
        ).first()

    if not rev or not rev.file_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ملف المخطوطة غير متاح حاليًا لهذه الجولة / Manuscript file is not attached to this review round"
        )

    db_file = db.query(models.UploadedFile).filter(
        models.UploadedFile.id == rev.file_id,
        models.UploadedFile.deleted_at.is_(None)
    ).first()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ملف المخطوطة غير موجود / Manuscript file not found"
        )

    storage = get_storage_provider()
    if not storage.file_exists(db_file.storage_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ملف المخطوطة الفعلي غير موجود بوحدة التخزين / Physical manuscript file not found"
        )

    full_path = storage.get_file_path(db_file.storage_key)
    encoded_filename = urllib.parse.quote(db_file.filename)
    ascii_fallback = re.sub(r"[^\x20-\x7E]", "_", db_file.filename) or "manuscript"

    headers = {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Disposition": f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded_filename}'
    }

    return FileResponse(
        path=full_path,
        media_type=db_file.mime_type,
        headers=headers
    )
