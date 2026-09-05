import datetime
import hashlib
import secrets
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.sanitization import sanitize_text
from ..services.notifications import (
    OutboxService,
    WorkflowEventType,
    AggregateType,
    EventPayload
)

router = APIRouter(prefix="/peer-reviews", tags=["Peer Review Workflow"])


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 token hash of a raw token for safe storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def is_case_editor(case: "models.PeerReviewCase", context: TenantContext) -> bool:
    """Resource-scoped editorial authority: OWNER (bootstrap authority) or the
    case's assigned editor. Organization admin, supervisor, and platform
    administration do NOT imply editorial authority over a specific case —
    editorial content and decisions belong to the assigned editor only."""
    role = (context.membership.role or "RESEARCHER").upper()
    if role == "OWNER":
        return True
    return bool(case.editor_user_id) and case.editor_user_id == context.user.id


def require_case_editor(case: "models.PeerReviewCase", context: TenantContext) -> None:
    if not is_case_editor(case, context):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editorial authority over this review case is required for this action"
        )


def seed_default_rubric_if_needed(org_id: str, db: Session) -> models.ReviewRubric:
    """Creates a default standard peer review rubric if none exists for the organization."""
    existing = db.query(models.ReviewRubric).filter(
        models.ReviewRubric.organization_id == org_id,
        models.ReviewRubric.is_default == True,
        models.ReviewRubric.status == "ACTIVE"
    ).first()
    if existing:
        return existing

    now = datetime.datetime.now(datetime.UTC).isoformat()
    rubric = models.ReviewRubric(
        id=f"rbc-{secrets.token_hex(6)}",
        organization_id=org_id,
        name_ar="النموذج الموحد لتحكيم الأبحاث العلمية",
        name_en="Unified Academic Manuscript Review Rubric",
        rubric_type="GENERAL_MANUSCRIPT",
        version=1,
        is_default=True,
        status="ACTIVE",
        created_at=now
    )
    db.add(rubric)

    criteria_defs = [
        ("METHODOLOGY", "المنهجية العلمية وتصميم الدراسة", "Scientific Methodology & Design", "مدى سلامة تصميم البحث واتساق المنهج المختار مع الأهداف والفروض.", 0.30, 1),
        ("STATISTICS", "التحليل الإحصائي والعينة", "Statistical Analysis & Sample", "كفاية حجم العينة إحصائياً وملاءمة الاختبارات الإحصائية المفترضة.", 0.25, 2),
        ("LITERATURE", "التأصيل النظري والدراسات السابقة", "Literature Review & Theoretical Base", "كفاية مراجعة الدراسات السابقة وتحديد الفجوة البحثية بوضوح.", 0.20, 3),
        ("ETHICS", "الأخلاقيات والنزاهة الأكاديمية", "Ethics & Academic Integrity", "الالتزام بضوابط التسجيل المسبق وحماية البيانات والموافقة المستنيرة.", 0.15, 4),
        ("ORIGINALITY", "الأصالة والإضافة المعرفية", "Originality & Contribution", "مدى أصالة الفكرة البحثية والقيمة المضافة للمعرفة العلمية.", 0.10, 5)
    ]

    for code, title_ar, title_en, desc_ar, weight, order in criteria_defs:
        crit = models.ReviewCriterion(
            id=f"crt-{secrets.token_hex(6)}",
            rubric_id=rubric.id,
            code=code,
            title_ar=title_ar,
            title_en=title_en,
            desc_ar=desc_ar,
            desc_en=desc_ar,
            response_type="SCORE",
            weight=weight,
            is_mandatory=True,
            sort_order=order,
            created_at=now
        )
        db.add(crit)

    db.commit()
    db.refresh(rubric)
    return rubric


def apply_privacy_and_confidentiality(case_resp: schemas.PeerReviewCaseResponse, current_user_id: str, is_editor: bool):
    """
    Applies privacy masking (Double-Blind / Single-Blind) and strips CONFIDENTIAL_TO_EDITOR comments for non-editors.
    Also stamps case_resp.is_editor so the frontend can align editor-only
    controls to actual authority instead of reimplementing the authorization
    check client-side — the backend remains the single source of truth.
    """
    case_resp.is_editor = is_editor
    is_author = (case_resp.owner_user_id == current_user_id)

    if not is_editor:
        # 1. Double-Blind / Single-Blind Masking
        if case_resp.blind_type == "DOUBLE_BLIND":
            if not is_author:
                # Reviewer sees masked author identity
                case_resp.owner_user_id = None
                case_resp.author_name = "مؤلف محجوب الهوية (Double-Blind)"
            else:
                # Author sees masked reviewer identities
                for rnd in case_resp.rounds:
                    for assignment in rnd.assignments:
                        assignment.reviewer_user_id = None
                        assignment.external_email = None
                        assignment.external_name = "محكم علمي محجوب الهوية (Double-Blind)"
        elif case_resp.blind_type == "SINGLE_BLIND":
            if is_author:
                # Author cannot see reviewer identities
                for rnd in case_resp.rounds:
                    for assignment in rnd.assignments:
                        assignment.reviewer_user_id = None
                        assignment.external_email = None
                        assignment.external_name = "محكم علمي محجوب الهوية (Single-Blind)"

        # 2. Confidential comments stripping: Non-editors (especially authors) never see CONFIDENTIAL_TO_EDITOR
        for rnd in case_resp.rounds:
            for assignment in rnd.assignments:
                if assignment.submission:
                    assignment.submission.comments = [
                        c for c in assignment.submission.comments if c.comment_type == "AUTHOR_VISIBLE"
                    ]

    return case_resp


# ── Peer Review Cases Endpoints ────────────────────────────────────────────────

@router.post("/cases", response_model=schemas.PeerReviewCaseResponse, status_code=status.HTTP_201_CREATED)
def create_peer_review_case(
    payload: schemas.PeerReviewCaseCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    now = datetime.datetime.now(datetime.UTC).isoformat()
    org_id = context.organization.id

    # 1. Resolve Rubric
    rubric = None
    if payload.rubric_id:
        rubric = db.query(models.ReviewRubric).filter(
            models.ReviewRubric.id == payload.rubric_id,
            models.ReviewRubric.organization_id == org_id
        ).first()
    if not rubric:
        rubric = seed_default_rubric_if_needed(org_id, db)

    # 1b. Resolve optional exact-version Publication binding. The fingerprint
    # and submission reference are always derived server-side from the
    # referenced version — never accepted from the client — so a caller
    # cannot assert a fingerprint that does not match the actual manuscript.
    manuscript_version = None
    manuscript_fingerprint = None
    publication_submission_id = None
    if payload.manuscript_version_id:
        manuscript_version = db.query(models.PublicationManuscriptVersion).filter(
            models.PublicationManuscriptVersion.id == payload.manuscript_version_id,
            models.PublicationManuscriptVersion.organization_id == org_id,
        ).first()
        if not manuscript_version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced manuscript version not found")
        manuscript_fingerprint = manuscript_version.fingerprint
        submission = db.query(models.PublicationSubmission).filter(
            models.PublicationSubmission.manuscript_version_id == manuscript_version.id,
            models.PublicationSubmission.organization_id == org_id,
        ).order_by(models.PublicationSubmission.created_at.desc()).first()
        publication_submission_id = submission.id if submission else None

    # 2. Create PeerReviewCase
    case_id = f"prc-{secrets.token_hex(6)}"
    case = models.PeerReviewCase(
        id=case_id,
        organization_id=org_id,
        owner_user_id=context.user.id,
        project_id=payload.project_id,
        scholarly_asset_id=payload.scholarly_asset_id,
        manuscript_version_id=manuscript_version.id if manuscript_version else None,
        manuscript_fingerprint=manuscript_fingerprint,
        publication_submission_id=publication_submission_id,
        title_ar=sanitize_text(payload.title_ar),
        title_en=sanitize_text(payload.title_en),
        abstract_ar=sanitize_text(payload.abstract_ar) if payload.abstract_ar else None,
        abstract_en=sanitize_text(payload.abstract_en) if payload.abstract_en else None,
        discipline=sanitize_text(payload.discipline) if payload.discipline else None,
        case_type=payload.case_type,
        blind_type=payload.blind_type,
        status="IN_REVIEW",
        current_round_number=1,
        created_at=now,
        updated_at=now
    )
    db.add(case)

    # 3. Create Initial ReviewRound (Round 1) with immutable snapshots
    rubric_snapshot = {
        "rubric_id": rubric.id,
        "name_ar": rubric.name_ar,
        "name_en": rubric.name_en,
        "version": rubric.version,
        "criteria": [
            {
                "id": c.id,
                "code": c.code,
                "title_ar": c.title_ar,
                "title_en": c.title_en,
                "desc_ar": c.desc_ar,
                "response_type": c.response_type,
                "weight": c.weight,
                "is_mandatory": c.is_mandatory,
                "sort_order": c.sort_order
            }
            for c in rubric.criteria
        ]
    }

    manuscript_snapshot = {
        "title_ar": case.title_ar,
        "title_en": case.title_en,
        "abstract_ar": case.abstract_ar,
        "abstract_en": case.abstract_en,
        "version_number": 1
    }

    round_1 = models.PeerReviewRound(
        id=f"rnd-{secrets.token_hex(6)}",
        case_id=case.id,
        round_number=1,
        manuscript_version=1,
        status="ACTIVE",
        manuscript_snapshot_json=manuscript_snapshot,
        rubric_id=rubric.id,
        rubric_snapshot_json=rubric_snapshot,
        decision="PENDING",
        created_at=now
    )
    db.add(round_1)

    # 4. Audit Log (Ensures NO tokens or passwords are logged)
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=org_id,
        action="PEER_REVIEW_CASE_CREATED",
        details=f"Created peer review case {case.id} for manuscript '{case.title_ar}'",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    resp = schemas.PeerReviewCaseResponse.model_validate(case)
    return apply_privacy_and_confidentiality(resp, context.user.id, is_editor=True)


@router.get("/cases", response_model=List[schemas.PeerReviewCaseSummaryResponse])
def list_peer_review_cases(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    org_id = context.organization.id
    user_role = (context.membership.role or "RESEARCHER").upper()

    query = db.query(models.PeerReviewCase).filter(models.PeerReviewCase.organization_id == org_id)

    # Researchers can only list cases they own, are explicitly delegated as
    # editor of (case.editor_user_id — see is_case_editor), or are assigned to
    # as reviewers.
    if user_role not in ["OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"]:
        assigned_case_ids = db.query(models.ReviewerAssignment.case_id).filter(
            models.ReviewerAssignment.reviewer_user_id == context.user.id,
            models.ReviewerAssignment.status.notin_(["REVOKED", "DECLINED"])
        ).subquery()
        query = query.filter(
            (models.PeerReviewCase.owner_user_id == context.user.id) |
            (models.PeerReviewCase.editor_user_id == context.user.id) |
            (models.PeerReviewCase.id.in_(assigned_case_ids))
        )

    cases = query.order_by(models.PeerReviewCase.created_at.desc()).all()

    summaries = []
    for c in cases:
        active_assignments = db.query(models.ReviewerAssignment).filter(
            models.ReviewerAssignment.case_id == c.id,
            models.ReviewerAssignment.status.in_(["INVITED", "ACCEPTED", "IN_PROGRESS"])
        ).count()
        completed_reviews = db.query(models.ReviewerAssignment).filter(
            models.ReviewerAssignment.case_id == c.id,
            models.ReviewerAssignment.status == "SUBMITTED"
        ).count()

        summaries.append(schemas.PeerReviewCaseSummaryResponse(
            id=c.id,
            organization_id=c.organization_id,
            title_ar=c.title_ar,
            title_en=c.title_en,
            case_type=c.case_type,
            blind_type=c.blind_type,
            status=c.status,
            current_round_number=c.current_round_number,
            is_editor=is_case_editor(c, context),
            active_assignments_count=active_assignments,
            completed_reviews_count=completed_reviews,
            created_at=c.created_at,
            updated_at=c.updated_at
        ))
    return summaries


@router.get("/cases/{case_id}", response_model=schemas.PeerReviewCaseResponse)
def get_peer_review_case(
    case_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    case = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.id == case_id,
        models.PeerReviewCase.organization_id == context.organization.id
    ).first()

    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")

    is_editor = is_case_editor(case, context)
    is_author = (case.owner_user_id == context.user.id)

    # Check assignment if not author and not editor. Excludes REVOKED/DECLINED,
    # matching the same filter already applied to this exact relationship in
    # search/providers.py and storage.py — revocation removes access to the
    # case immediately and totally, including to the reviewer's own prior
    # contribution, per the platform's decided revocation policy.
    if not is_editor and not is_author:
        is_assigned = db.query(models.ReviewerAssignment).filter(
            models.ReviewerAssignment.case_id == case.id,
            models.ReviewerAssignment.reviewer_user_id == context.user.id,
            models.ReviewerAssignment.status.notin_(["REVOKED", "DECLINED"])
        ).first()
        if not is_assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this review case")

    resp = schemas.PeerReviewCaseResponse.model_validate(case)
    return apply_privacy_and_confidentiality(resp, context.user.id, is_editor=is_editor)


@router.put("/cases/{case_id}/editor", response_model=schemas.PeerReviewCaseResponse)
def assign_case_editor(
    case_id: str,
    payload: schemas.EditorAssignmentRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    """Assigns (or reassigns) the editor of record for a review case. Only the
    organization OWNER may designate an editor — editorial authority is a
    deliberate delegation, not something an existing editor or organization
    admin can grant to themselves or others."""
    case = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.id == case_id,
        models.PeerReviewCase.organization_id == context.organization.id
    ).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")

    role = (context.membership.role or "RESEARCHER").upper()
    if role != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner may assign a review case editor")

    member = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == context.organization.id,
        models.OrganizationMembership.user_id == payload.editor_user_id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Editor candidate is not a member of this organization")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    previous_editor_user_id = case.editor_user_id
    case.editor_user_id = payload.editor_user_id
    case.updated_at = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PEER_REVIEW_EDITOR_ASSIGNED",
        details=f"Case {case.id} editor changed from {previous_editor_user_id} to {payload.editor_user_id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(case)

    resp = schemas.PeerReviewCaseResponse.model_validate(case)
    return apply_privacy_and_confidentiality(resp, context.user.id, is_editor=True)


@router.post("/cases/{case_id}/rounds", response_model=schemas.PeerReviewRoundResponse, status_code=status.HTTP_201_CREATED)
def create_next_review_round(
    case_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Locked for the duration of the transaction: concurrent round-creation
    # requests for the same case must serialise on round/version numbering
    # (mirrors the Publication domain's manuscript-version-allocation lock).
    case = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.id == case_id,
        models.PeerReviewCase.organization_id == context.organization.id
    ).with_for_update().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")
    require_case_editor(case, context)

    # Fetch latest revision if available
    latest_rev = db.query(models.ManuscriptRevision).filter(
        models.ManuscriptRevision.case_id == case.id
    ).order_by(models.ManuscriptRevision.version_number.desc()).first()

    now = datetime.datetime.now(datetime.UTC).isoformat()
    new_round_number = case.current_round_number + 1
    new_version_number = latest_rev.version_number if latest_rev else (case.current_round_number + 1)

    rubric = seed_default_rubric_if_needed(context.organization.id, db)

    manuscript_snapshot = {
        "title_ar": latest_rev.title_ar if latest_rev else case.title_ar,
        "title_en": latest_rev.title_en if latest_rev else case.title_en,
        "abstract_ar": latest_rev.abstract_ar if latest_rev else case.abstract_ar,
        "abstract_en": latest_rev.abstract_en if latest_rev else case.abstract_en,
        "version_number": new_version_number,
        "response_to_reviewers": latest_rev.response_to_reviewers if latest_rev else None
    }

    rubric_snapshot = {
        "rubric_id": rubric.id,
        "name_ar": rubric.name_ar,
        "name_en": rubric.name_en,
        "version": rubric.version,
        "criteria": [
            {
                "id": c.id,
                "code": c.code,
                "title_ar": c.title_ar,
                "title_en": c.title_en,
                "desc_ar": c.desc_ar,
                "response_type": c.response_type,
                "weight": c.weight,
                "is_mandatory": c.is_mandatory,
                "sort_order": c.sort_order
            }
            for c in rubric.criteria
        ]
    }

    new_round = models.PeerReviewRound(
        id=f"rnd-{secrets.token_hex(6)}",
        case_id=case.id,
        round_number=new_round_number,
        manuscript_version=new_version_number,
        status="ACTIVE",
        manuscript_snapshot_json=manuscript_snapshot,
        rubric_id=rubric.id,
        rubric_snapshot_json=rubric_snapshot,
        decision="PENDING",
        created_at=now
    )
    case.current_round_number = new_round_number
    case.status = "IN_REVIEW"
    case.updated_at = now

    db.add(new_round)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PEER_REVIEW_ROUND_CREATED",
        details=f"Created round {new_round_number} for case {case.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(new_round)
    return schemas.PeerReviewRoundResponse.model_validate(new_round)


# ── Reviewer Assignments Endpoints ───────────────────────────────────────────

@router.post("/rounds/{round_id}/assignments", response_model=schemas.ReviewerAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_or_invite_reviewer(
    round_id: str,
    payload: schemas.ReviewerAssignmentCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    rnd = db.query(models.PeerReviewRound).filter(models.PeerReviewRound.id == round_id).first()
    if not rnd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review round not found")

    case = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.id == rnd.case_id,
        models.PeerReviewCase.organization_id == context.organization.id
    ).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")
    require_case_editor(case, context)

    now = datetime.datetime.now(datetime.UTC).isoformat()
    assignment_id = f"asg-{secrets.token_hex(6)}"

    # Check duplicate assignment in same round
    if payload.reviewer_type == "INTERNAL_REVIEWER":
        if not payload.reviewer_user_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="reviewer_user_id required for internal reviewer")
        
        # Verify user belongs to same tenant
        member = db.query(models.OrganizationMembership).filter(
            models.OrganizationMembership.organization_id == context.organization.id,
            models.OrganizationMembership.user_id == payload.reviewer_user_id
        ).first()
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Internal reviewer user not found in this organization")

        # Prevent assigning the author to review own manuscript
        if payload.reviewer_user_id == case.owner_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Author cannot be assigned as reviewer for their own manuscript")

        # Conflict-of-interest signal: block a listed co-author on the bound
        # Publication manuscript version from being assigned as a reviewer.
        # This is a real, data-derived signal (not a fabricated one) — only
        # available when the case is bound to an exact manuscript version.
        if case.manuscript_version_id:
            is_coauthor = db.query(models.PublicationManuscriptAuthorship).filter(
                models.PublicationManuscriptAuthorship.manuscript_version_id == case.manuscript_version_id,
                models.PublicationManuscriptAuthorship.user_id == payload.reviewer_user_id,
            ).first()
            if is_coauthor:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Listed co-author cannot be assigned as reviewer for this manuscript (conflict of interest)")

        dup = db.query(models.ReviewerAssignment).filter(
            models.ReviewerAssignment.round_id == round_id,
            models.ReviewerAssignment.reviewer_user_id == payload.reviewer_user_id
        ).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reviewer already assigned to this round")

        assignment = models.ReviewerAssignment(
            id=assignment_id,
            case_id=case.id,
            round_id=rnd.id,
            reviewer_type="INTERNAL_REVIEWER",
            reviewer_user_id=payload.reviewer_user_id,
            status="INVITED",
            conflict_status="NO_CONFLICT",
            due_at=payload.due_at,
            invited_at=now,
            created_at=now
        )
        db.add(assignment)

        # Record Outbox Event for Internal Reviewer
        OutboxService.record_event(
            db=db,
            organization_id=context.organization.id,
            event_type=WorkflowEventType.REVIEWER_INVITED,
            aggregate_type=AggregateType.PEER_REVIEW_CASE,
            aggregate_id=case.id,
            actor_user_id=context.user.id,
            payload=EventPayload(
                title_ar="دعوة تحكيم علمي جديدة",
                title_en="New Peer Review Invitation",
                message_ar=f"تمت دعوتك لتحكيم بحث علمي جديد (الجولة {rnd.round_number}).",
                message_en=f"You have been invited to review a manuscript (Round {rnd.round_number}).",
                target_type="PEER_REVIEW_CASE",
                target_id=case.id,
                meta={"assignment_id": assignment_id, "round_number": rnd.round_number}
            ),
            scope_key=f"invite:{assignment_id}"
        )

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reviewer already assigned to this round")
        db.refresh(assignment)
        return schemas.ReviewerAssignmentResponse.model_validate(assignment)

    else:
        # EXTERNAL_REVIEWER
        if not payload.external_email:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="external_email required for external reviewer")

        dup = db.query(models.ReviewerAssignment).filter(
            models.ReviewerAssignment.round_id == round_id,
            models.ReviewerAssignment.external_email == payload.external_email
        ).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="External reviewer already invited to this round")

        assignment = models.ReviewerAssignment(
            id=assignment_id,
            case_id=case.id,
            round_id=rnd.id,
            reviewer_type="EXTERNAL_REVIEWER",
            external_email=payload.external_email,
            external_name=payload.external_name or payload.external_email.split("@")[0],
            status="INVITED",
            conflict_status="NO_CONFLICT",
            due_at=payload.due_at,
            invited_at=now,
            created_at=now
        )
        db.add(assignment)

        # Generate cryptographically secure magic link token (entropy 32 bytes)
        raw_token = secrets.token_urlsafe(32)
        token_record = models.ExternalReviewerToken(
            id=f"tok-{secrets.token_hex(6)}",
            assignment_id=assignment_id,
            token_hash=hash_token(raw_token),
            expires_at=(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=14)).isoformat(),
            created_at=now
        )
        db.add(token_record)

        # Record Outbox Event (Payload does NOT contain raw magic token to protect security)
        OutboxService.record_event(
            db=db,
            organization_id=context.organization.id,
            event_type=WorkflowEventType.REVIEWER_INVITED,
            aggregate_type=AggregateType.PEER_REVIEW_CASE,
            aggregate_id=case.id,
            actor_user_id=context.user.id,
            payload=EventPayload(
                title_ar="دعوة محكم خارجي",
                title_en="External Reviewer Invitation",
                message_ar=f"تم إرسال دعوة تحكيم للمحكم الخارجي {payload.external_email}.",
                message_en=f"Review invitation dispatched to external referee {payload.external_email}.",
                target_type="PEER_REVIEW_CASE",
                target_id=case.id,
                meta={"assignment_id": assignment_id, "external_email": payload.external_email}
            ),
            scope_key=f"invite:{assignment_id}"
        )

        # Ensure raw token is never written to audit log
        audit = models.AuditLog(
            id=secrets.token_hex(8),
            userId=context.user.id,
            organizationId=context.organization.id,
            action="REVIEWER_INVITED",
            details=f"Invited external reviewer {payload.external_email} for case {case.id}",
            timestamp=now
        )
        db.add(audit)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="External reviewer already invited to this round")
        db.refresh(assignment)

        resp = schemas.ReviewerAssignmentResponse.model_validate(assignment)
        resp.magic_link_url = f"/external-review/{raw_token}"
        return resp


@router.get("/assignments/my", response_model=List[schemas.ReviewerAssignmentResponse])
def get_my_reviewer_assignments(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    assignments = db.query(models.ReviewerAssignment).filter(
        models.ReviewerAssignment.reviewer_user_id == context.user.id
    ).order_by(models.ReviewerAssignment.created_at.desc()).all()

    return [schemas.ReviewerAssignmentResponse.model_validate(a) for a in assignments]


@router.post("/assignments/{assignment_id}/accept", response_model=schemas.ReviewerAssignmentResponse)
def accept_reviewer_assignment(
    assignment_id: str,
    payload: schemas.ReviewerAcceptRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    assignment = db.query(models.ReviewerAssignment).filter(
        models.ReviewerAssignment.id == assignment_id,
        models.ReviewerAssignment.reviewer_user_id == context.user.id
    ).with_for_update().first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found or not owned by caller")

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

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="REVIEWER_ACCEPTED",
        details=f"Reviewer accepted assignment {assignment.id} (COI: {payload.conflict_status})",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return schemas.ReviewerAssignmentResponse.model_validate(assignment)


@router.post("/assignments/{assignment_id}/decline", response_model=schemas.ReviewerAssignmentResponse)
def decline_reviewer_assignment(
    assignment_id: str,
    payload: schemas.ReviewerDeclineRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    assignment = db.query(models.ReviewerAssignment).filter(
        models.ReviewerAssignment.id == assignment_id,
        models.ReviewerAssignment.reviewer_user_id == context.user.id
    ).with_for_update().first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found or not owned by caller")

    if assignment.status in ["SUBMITTED", "EXPIRED", "REVOKED"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot decline assignment in status {assignment.status}")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    assignment.status = "DECLINED"
    assignment.decline_reason = payload.decline_reason

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="REVIEWER_DECLINED",
        details=f"Reviewer declined assignment {assignment.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return schemas.ReviewerAssignmentResponse.model_validate(assignment)


@router.put("/assignments/{assignment_id}/draft", response_model=schemas.ReviewSubmissionResponse)
def save_review_draft(
    assignment_id: str,
    payload: schemas.ReviewSubmissionDraftRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    assignment = db.query(models.ReviewerAssignment).filter(
        models.ReviewerAssignment.id == assignment_id,
        models.ReviewerAssignment.reviewer_user_id == context.user.id
    ).with_for_update().first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found or not owned by caller")

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


@router.post("/assignments/{assignment_id}/submit", response_model=schemas.ReviewSubmissionResponse)
def submit_completed_review(
    assignment_id: str,
    payload: schemas.ReviewSubmissionFinalRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    assignment = db.query(models.ReviewerAssignment).filter(
        models.ReviewerAssignment.id == assignment_id,
        models.ReviewerAssignment.reviewer_user_id == context.user.id
    ).with_for_update().first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found or not owned by caller")

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
    rnd = db.query(models.PeerReviewRound).filter(models.PeerReviewRound.id == assignment.round_id).first()
    rubric = db.query(models.ReviewRubric).filter(models.ReviewRubric.id == rnd.rubric_id).first()
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

    # Calculate weighted score & validate score boundaries
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

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="REVIEW_SUBMITTED",
        details=f"Reviewer submitted review for assignment {assignment.id} with recommendation {payload.recommendation}",
        timestamp=now
    )
    db.add(audit)

    # Record Outbox Event (Strict Privacy: Never include confidential comments in event payload)
    OutboxService.record_event(
        db=db,
        organization_id=context.organization.id,
        event_type=WorkflowEventType.REVIEW_SUBMITTED,
        aggregate_type=AggregateType.PEER_REVIEW_CASE,
        aggregate_id=assignment.case_id,
        actor_user_id=context.user.id,
        payload=EventPayload(
            title_ar="اكتمال تقرير تحكيم علمي",
            title_en="Peer Review Report Submitted",
            message_ar=f"قام أحد المحكمين بإيداع تقرير التحكيم بتوصية ({payload.recommendation}).",
            message_en=f"A referee has submitted their review report with recommendation ({payload.recommendation}).",
            target_type="PEER_REVIEW_CASE",
            target_id=assignment.case_id,
            meta={"assignment_id": assignment.id, "recommendation": payload.recommendation}
        ),
        scope_key=f"submit:{assignment.id}"
    )

    db.commit()
    db.refresh(submission)
    return schemas.ReviewSubmissionResponse.model_validate(submission)


# ── Author Revision & Human Decision Endpoints ───────────────────────────────

@router.post("/cases/{case_id}/revisions", response_model=schemas.ManuscriptRevisionResponse, status_code=status.HTTP_201_CREATED)
def upload_manuscript_revision(
    case_id: str,
    payload: schemas.ManuscriptRevisionCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Locked for the duration of the transaction: concurrent revision uploads
    # for the same case must serialise on version-number allocation.
    case = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.id == case_id,
        models.PeerReviewCase.organization_id == context.organization.id
    ).with_for_update().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")

    if case.owner_user_id != context.user.id and (context.membership.role or "").upper() not in ["OWNER", "ORGANIZATION_ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only manuscript author or admin can upload revisions")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    new_version = len(case.revisions) + 2 # Initial was version 1

    revision = models.ManuscriptRevision(
        id=f"mrv-{secrets.token_hex(6)}",
        case_id=case.id,
        round_id=None,
        version_number=new_version,
        title_ar=sanitize_text(payload.title_ar),
        title_en=sanitize_text(payload.title_en),
        abstract_ar=sanitize_text(payload.abstract_ar) if payload.abstract_ar else None,
        abstract_en=sanitize_text(payload.abstract_en) if payload.abstract_en else None,
        response_to_reviewers=sanitize_text(payload.response_to_reviewers) if payload.response_to_reviewers else None,
        file_id=payload.file_id,
        uploaded_by=context.user.id,
        created_at=now
    )
    db.add(revision)

    case.title_ar = revision.title_ar
    case.title_en = revision.title_en
    case.abstract_ar = revision.abstract_ar
    case.abstract_en = revision.abstract_en
    case.updated_at = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="MANUSCRIPT_REVISION_UPLOADED",
        details=f"Uploaded revision v{new_version} for case {case.id}",
        timestamp=now
    )
    db.add(audit)

    # Record Outbox Event
    OutboxService.record_event(
        db=db,
        organization_id=context.organization.id,
        event_type=WorkflowEventType.MANUSCRIPT_REVISION_UPLOADED,
        aggregate_type=AggregateType.PEER_REVIEW_CASE,
        aggregate_id=case.id,
        actor_user_id=context.user.id,
        payload=EventPayload(
            title_ar="رفع نسخة معدلة من البحث",
            title_en="Manuscript Revision Uploaded",
            message_ar=f"قام الباحث برفع نسخة معدلة من البحث (الإصدار {new_version}).",
            message_en=f"Author uploaded a revised version of the manuscript (Version {new_version}).",
            target_type="PEER_REVIEW_CASE",
            target_id=case.id,
            meta={"version_number": new_version}
        ),
        scope_key=f"revision:v{new_version}:{case.id}"
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A revision with this version number was already recorded")
    db.refresh(revision)
    return schemas.ManuscriptRevisionResponse.model_validate(revision)


@router.post("/cases/{case_id}/decision", response_model=schemas.PeerReviewCaseResponse)
def record_editorial_decision(
    case_id: str,
    payload: schemas.EditorialDecisionRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    # Locked for the duration of the transaction: two concurrent editorial
    # decisions on the same case (e.g. ACCEPT vs REJECT racing) must not
    # produce a silent lost update — the second transaction blocks until the
    # first commits, then observes the already-decided state.
    case = db.query(models.PeerReviewCase).filter(
        models.PeerReviewCase.id == case_id,
        models.PeerReviewCase.organization_id == context.organization.id
    ).with_for_update().first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peer review case not found")
    require_case_editor(case, context)

    allowed_decisions = ["ACCEPTED", "REVISION_REQUIRED", "REJECTED"]
    if payload.decision not in allowed_decisions:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid decision. Allowed: {allowed_decisions}")

    now = datetime.datetime.now(datetime.UTC).isoformat()

    # Update current active round decision
    active_round = db.query(models.PeerReviewRound).filter(
        models.PeerReviewRound.case_id == case.id,
        models.PeerReviewRound.round_number == case.current_round_number
    ).first()

    # A round's decision is final once recorded — reconsidering it requires a
    # new round, never a second call silently overwriting the first (which
    # would let two concurrent, contradictory decisions both "win" with no
    # authoritative outcome).
    if active_round and active_round.decision != "PENDING":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This review round already has a recorded decision; open a new round to reconsider it")

    if active_round:
        active_round.decision = payload.decision
        active_round.decision_notes = payload.decision_notes
        active_round.decision_by_user_id = context.user.id
        active_round.decision_at = now
        active_round.status = "COMPLETED"

    if payload.decision == "REVISION_REQUIRED":
        case.status = "REVISION_REQUESTED"
        event_type = WorkflowEventType.REVISION_REQUESTED
        event_title_ar = "طلب تعديل في البحث العلمي"
        event_title_en = "Manuscript Revision Requested"
        event_msg_ar = "طلبت هيئة التحرير إجراء تعديلات ومراجعة على بحثك العلمي."
        event_msg_en = "Editorial committee has requested revisions on your manuscript."
    else:
        case.status = "DECIDED"
        event_type = WorkflowEventType.FINAL_REVIEW_DECISION_RECORDED
        event_title_ar = "صدور القرار التحريري النهائي للبحث"
        event_title_en = "Final Editorial Decision Recorded"
        event_msg_ar = f"تم تسجيل القرار النهائي للبحث: {payload.decision}."
        event_msg_en = f"The final editorial decision was recorded: {payload.decision}."

    case.updated_at = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="FINAL_REVIEW_DECISION_RECORDED",
        details=f"Editorial decision '{payload.decision}' recorded by {context.user.username} for case {case.id}",
        timestamp=now
    )
    db.add(audit)

    # Record Outbox Event
    OutboxService.record_event(
        db=db,
        organization_id=context.organization.id,
        event_type=event_type,
        aggregate_type=AggregateType.PEER_REVIEW_CASE,
        aggregate_id=case.id,
        actor_user_id=context.user.id,
        payload=EventPayload(
            title_ar=event_title_ar,
            title_en=event_title_en,
            message_ar=event_msg_ar,
            message_en=event_msg_en,
            target_type="PEER_REVIEW_CASE",
            target_id=case.id,
            meta={"decision": payload.decision, "round_number": case.current_round_number}
        ),
        scope_key=f"decision:{case.current_round_number}:{case.updated_at}"
    )

    db.commit()
    db.refresh(case)

    resp = schemas.PeerReviewCaseResponse.model_validate(case)
    return apply_privacy_and_confidentiality(resp, context.user.id, is_editor=True)


# ── Institutional Peer Review Operations (aggregate-first) ──────────────────

@router.get("/organization/operations")
def peer_review_operations(db: Session = Depends(get_db), context: TenantContext = Depends(get_tenant_context)):
    """Aggregate-only institutional view. Never returns manuscript content,
    reviewer identities, confidential comments, or COI narratives — only
    counts and statuses, matching the Publication domain's equivalent."""
    role = (context.membership.role or "RESEARCHER").upper()
    if role not in ["OWNER", "ORGANIZATION_ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Peer review operations require an organization administrator role")

    org_id = context.organization.id
    cases = db.query(models.PeerReviewCase).filter(models.PeerReviewCase.organization_id == org_id).all()

    by_status: dict[str, int] = {}
    for c in cases:
        by_status[c.status] = by_status.get(c.status, 0) + 1

    case_ids = [c.id for c in cases]
    pending_assignments = 0
    overdue_reviews = 0
    completed_reviews = 0
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    if case_ids:
        assignments = db.query(models.ReviewerAssignment).filter(models.ReviewerAssignment.case_id.in_(case_ids)).all()
        for a in assignments:
            if a.status in ("INVITED", "ACCEPTED", "IN_PROGRESS"):
                pending_assignments += 1
                if a.due_at and a.due_at < now_iso:
                    overdue_reviews += 1
            elif a.status == "SUBMITTED":
                completed_reviews += 1

    cases_awaiting_editor = sum(1 for c in cases if not c.editor_user_id and c.status not in ("DECIDED", "WITHDRAWN"))

    return {
        "organization_id": org_id,
        "scope": "ORGANIZATION",
        "counts": {
            "active_cases": sum(1 for c in cases if c.status not in ("DECIDED", "WITHDRAWN")),
            "cases_awaiting_editor_assignment": cases_awaiting_editor,
            "pending_reviewer_assignments": pending_assignments,
            "overdue_reviews": overdue_reviews,
            "completed_reviews": completed_reviews,
            "decided_cases": by_status.get("DECIDED", 0),
        },
        "cases_by_status": by_status,
        "aggregate_only": True,
        "raw_content_excluded": True,
    }
