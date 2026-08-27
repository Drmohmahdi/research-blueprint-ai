import datetime
import secrets
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..services.tenant_context import get_tenant_context, TenantContext
from ..services.sanitization import sanitize_text
from ..services.promotion_evaluator import (
    evaluate_promotion_application,
    compute_evidence_points,
    generate_evaluation_fingerprint
)
from ..services.notifications import (
    OutboxService,
    WorkflowEventType,
    AggregateType,
    EventPayload
)

router = APIRouter(prefix="/promotions", tags=["Academic Promotion Engine"])


def verify_policy_admin(context: TenantContext):
    """Ensures caller has institutional administrative privileges to manage policies."""
    role = (context.membership.role or "RESEARCHER").upper()
    if role not in ["OWNER", "ORGANIZATION_ADMIN"] and not context.is_global_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional Admin or Owner privileges required to configure promotion policies"
        )


def is_committee_member(application: "models.PromotionApplication", context: TenantContext, db: Session) -> bool:
    """Academic committee authority (view/evaluate/review/decide) over ONE
    specific application is granted ONLY through an ACTIVE
    PromotionCommitteeAssignment row for that exact application — never
    through organization role (OWNER/ORGANIZATION_ADMIN/SUPERVISOR) and never
    through platform-wide admin status (context.is_global_admin). This is a
    deliberate, stricter boundary than the org-role-based bootstrap authority
    used elsewhere in Baseerah (e.g. Peer Review's OWNER bootstrap): academic
    promotion committee integrity requires that decision authority come from
    an explicit, auditable, per-application academic assignment, not from
    generic administrative or platform privilege."""
    return db.query(models.PromotionCommitteeAssignment).filter(
        models.PromotionCommitteeAssignment.application_id == application.id,
        models.PromotionCommitteeAssignment.user_id == context.user.id,
        models.PromotionCommitteeAssignment.status == "ACTIVE"
    ).first() is not None


def require_committee_member(application: "models.PromotionApplication", context: TenantContext, db: Session) -> None:
    if not is_committee_member(application, context, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Academic committee membership on this specific application is required for this action"
        )


def has_org_oversight_access(context: TenantContext) -> bool:
    """Read-only institutional oversight (GET only) for an organization's own
    OWNER/ORGANIZATION_ADMIN — a legitimate administrative transparency need,
    distinct from academic committee decision authority. Deliberately does
    NOT consider context.is_global_admin: platform-wide administration must
    never imply access to private academic promotion content (see §18/§99 of
    the closure gate this enforces) — a platform SystemAdmin gets no
    automatic access at all and must be explicitly committee-assigned like
    anyone else."""
    role = (context.membership.role or "RESEARCHER").upper()
    return role in ["OWNER", "ORGANIZATION_ADMIN"]


def verify_committee_admin(context: TenantContext):
    """Authority to CONFIGURE who serves on a committee (assign/revoke) —
    distinct from BEING a committee member. Unlike verify_policy_admin
    (bylaws configuration, a platform-level administrative capability),
    deciding who sits on a specific applicant's promotion committee is
    institutional academic governance, not platform operations — so this
    deliberately does NOT accept context.is_global_admin. Only a real
    org-level OWNER/ORGANIZATION_ADMIN may assign or revoke committee
    members; a platform SystemAdmin gets nothing here either."""
    role = (context.membership.role or "RESEARCHER").upper()
    if role not in ["OWNER", "ORGANIZATION_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional Admin or Owner privileges required to manage committee assignments"
        )


def seed_default_institutional_policy(org_id: str, db: Session, user_id: str) -> models.PromotionPolicy:
    """Seeds default standard university promotion bylaws if none exist for the organization."""
    now = datetime.datetime.now(datetime.UTC).isoformat()
    policy = models.PromotionPolicy(
        id=f"pol-{secrets.token_hex(6)}",
        organization_id=org_id,
        name_ar="اللائحة الموحدة لترقية أعضاء هيئة التدريس (أستاذ مشارك)",
        name_en="Unified Academic Promotion Bylaws (Associate Professor)",
        description_ar="لائحة ترقيات أعضاء هيئة التدريس لدرجة أستاذ مشارك متضمنة شروط الإنتاج العلمي والبحثي",
        description_en="Academic faculty promotion regulations for Associate Professor rank including research output requirements",
        target_rank="ASSOCIATE_PROFESSOR",
        version=1,
        status="ACTIVE",
        is_default=True,
        rules_json={"min_total_points": 40.0, "min_papers": 4},
        created_by=user_id,
        created_at=now,
        updated_at=now
    )
    db.add(policy)
    db.flush()

    criteria_defs = [
        {
            "code": "MIN_PAPERS_COUNT",
            "title_ar": "الحد الأدنى من الأبحاث المنشورة (4 أبحاث)",
            "title_en": "Minimum published papers requirement (4 papers)",
            "type": "RESEARCH_OUTPUT",
            "required_points": 0.0,
            "min_asset_count": 4,
            "rule": {"metric": "asset_count", "operator": ">=", "value": 4},
            "weight": 1.0,
            "mandatory": True,
            "order": 1
        },
        {
            "code": "MIN_RESEARCH_POINTS",
            "title_ar": "الحد الأدنى لنقاط الإنتاج العلمي (40 نقطة)",
            "title_en": "Minimum total research points (40 pts)",
            "type": "RESEARCH_OUTPUT",
            "required_points": 40.0,
            "min_asset_count": 0,
            "rule": {"metric": "total_points", "operator": ">=", "value": 40.0},
            "weight": 1.0,
            "mandatory": True,
            "order": 2
        },
        {
            "code": "Q1_Q2_INDEXED",
            "title_ar": "أبحاث منشورة في مجلات مصنفة Q1 أو Q2 (بحثان على الأقل)",
            "title_en": "Publications in Q1/Q2 indexed journals (Min 2 papers)",
            "type": "RESEARCH_OUTPUT",
            "required_points": 0.0,
            "min_asset_count": 2,
            "rule": {"metric": "q1_q2_count", "operator": ">=", "value": 2},
            "weight": 1.0,
            "mandatory": True,
            "order": 3
        },
        {
            "code": "SOLE_OR_FIRST_AUTHOR",
            "title_ar": "نشر كباحث منفرد أو رئيس (بحثان على الأقل)",
            "title_en": "Sole or Lead / First author publications (Min 2 papers)",
            "type": "RESEARCH_OUTPUT",
            "required_points": 0.0,
            "min_asset_count": 2,
            "rule": {"metric": "sole_first_author_count", "operator": ">=", "value": 2},
            "weight": 1.0,
            "mandatory": True,
            "order": 4
        }
    ]

    for c in criteria_defs:
        crit = models.PromotionCriterion(
            id=f"crit-{secrets.token_hex(6)}",
            policy_id=policy.id,
            organization_id=org_id,
            code=c["code"],
            title_ar=c["title_ar"],
            title_en=c["title_en"],
            criterion_type=c["type"],
            required_points=c["required_points"],
            min_asset_count=c["min_asset_count"],
            rule_definition_json=c["rule"],
            weight=c["weight"],
            is_mandatory=c["mandatory"],
            sort_order=c["order"],
            created_at=now
        )
        db.add(crit)

    db.commit()
    db.refresh(policy)
    return policy


# ── Policy Management Endpoints ─────────────────────────────────────────────

@router.get("/policies", response_model=List[schemas.PromotionPolicyResponse])
def list_promotion_policies(
    target_rank: Optional[str] = None,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    query = db.query(models.PromotionPolicy).filter(
        models.PromotionPolicy.organization_id == context.organization.id
    )
    if target_rank:
        query = query.filter(models.PromotionPolicy.target_rank == target_rank)

    policies = query.order_by(models.PromotionPolicy.created_at.desc()).all()

    # If no policy exists for this org, auto-seed default policy
    if not policies:
        default_policy = seed_default_institutional_policy(context.organization.id, db, context.user.id)
        policies = [default_policy]

    return [schemas.PromotionPolicyResponse.model_validate(p) for p in policies]


@router.post("/policies", response_model=schemas.PromotionPolicyResponse, status_code=status.HTTP_201_CREATED)
def create_promotion_policy(
    payload: schemas.PromotionPolicyCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    verify_policy_admin(context)
    now = datetime.datetime.now(datetime.UTC).isoformat()
    policy_id = f"pol-{secrets.token_hex(6)}"

    policy = models.PromotionPolicy(
        id=policy_id,
        organization_id=context.organization.id,
        name_ar=sanitize_text(payload.name_ar),
        name_en=sanitize_text(payload.name_en),
        description_ar=sanitize_text(payload.description_ar) if payload.description_ar else None,
        description_en=sanitize_text(payload.description_en) if payload.description_en else None,
        target_rank=payload.target_rank,
        version=1,
        status=payload.status,
        is_default=payload.is_default,
        rules_json=payload.rules_json or {},
        created_by=context.user.id,
        created_at=now,
        updated_at=now
    )
    db.add(policy)
    db.flush()

    if payload.criteria:
        for idx, crit_in in enumerate(payload.criteria):
            criterion = models.PromotionCriterion(
                id=f"crit-{secrets.token_hex(6)}",
                policy_id=policy.id,
                organization_id=context.organization.id,
                code=crit_in.code,
                title_ar=sanitize_text(crit_in.title_ar),
                title_en=sanitize_text(crit_in.title_en),
                criterion_type=crit_in.criterion_type,
                required_points=crit_in.required_points,
                min_asset_count=crit_in.min_asset_count,
                rule_definition_json=crit_in.rule_definition_json,
                weight=crit_in.weight,
                is_mandatory=crit_in.is_mandatory,
                sort_order=crit_in.sort_order or (idx + 1),
                created_at=now
            )
            db.add(criterion)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_POLICY_CREATED",
        details=f"Created promotion policy {policy.id} ({policy.name_en}) v{policy.version}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(policy)
    return schemas.PromotionPolicyResponse.model_validate(policy)


@router.put("/policies/{policy_id}", response_model=schemas.PromotionPolicyResponse)
def update_promotion_policy(
    policy_id: str,
    payload: schemas.PromotionPolicyCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    verify_policy_admin(context)
    policy = db.query(models.PromotionPolicy).filter(
        models.PromotionPolicy.id == policy_id,
        models.PromotionPolicy.organization_id == context.organization.id
    ).first()

    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion policy not found")

    # Published policy immutability safeguard
    if policy.status == "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify an ACTIVE policy in place. Active bylaws are immutable to protect historical applications. Please create a new version."
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    policy.name_ar = sanitize_text(payload.name_ar)
    policy.name_en = sanitize_text(payload.name_en)
    policy.description_ar = sanitize_text(payload.description_ar) if payload.description_ar else None
    policy.description_en = sanitize_text(payload.description_en) if payload.description_en else None
    policy.target_rank = payload.target_rank
    policy.status = payload.status
    policy.rules_json = payload.rules_json or {}
    policy.updated_at = now

    db.commit()
    db.refresh(policy)
    return schemas.PromotionPolicyResponse.model_validate(policy)


@router.post("/policies/{policy_id}/new-version", response_model=schemas.PromotionPolicyResponse, status_code=status.HTTP_201_CREATED)
def create_policy_new_version(
    policy_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    verify_policy_admin(context)
    old_policy = db.query(models.PromotionPolicy).filter(
        models.PromotionPolicy.id == policy_id,
        models.PromotionPolicy.organization_id == context.organization.id
    ).first()

    if not old_policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion policy not found")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    new_policy = models.PromotionPolicy(
        id=f"pol-{secrets.token_hex(6)}",
        organization_id=context.organization.id,
        name_ar=old_policy.name_ar,
        name_en=old_policy.name_en,
        description_ar=old_policy.description_ar,
        description_en=old_policy.description_en,
        target_rank=old_policy.target_rank,
        version=old_policy.version + 1,
        status="ACTIVE",
        is_default=old_policy.is_default,
        rules_json=old_policy.rules_json or {},
        created_by=context.user.id,
        created_at=now,
        updated_at=now
    )
    db.add(new_policy)
    db.flush()

    for old_crit in old_policy.criteria:
        new_crit = models.PromotionCriterion(
            id=f"crit-{secrets.token_hex(6)}",
            policy_id=new_policy.id,
            organization_id=context.organization.id,
            code=old_crit.code,
            title_ar=old_crit.title_ar,
            title_en=old_crit.title_en,
            criterion_type=old_crit.criterion_type,
            required_points=old_crit.required_points,
            min_asset_count=old_crit.min_asset_count,
            rule_definition_json=old_crit.rule_definition_json,
            weight=old_crit.weight,
            is_mandatory=old_crit.is_mandatory,
            sort_order=old_crit.sort_order,
            created_at=now
        )
        db.add(new_crit)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_POLICY_VERSION_PUBLISHED",
        details=f"Published new version v{new_policy.version} for policy {new_policy.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(new_policy)
    return schemas.PromotionPolicyResponse.model_validate(new_policy)


@router.get("/policies/{policy_id}", response_model=schemas.PromotionPolicyResponse)
def get_promotion_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    policy = db.query(models.PromotionPolicy).filter(
        models.PromotionPolicy.id == policy_id,
        models.PromotionPolicy.organization_id == context.organization.id
    ).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion policy not found")
    return schemas.PromotionPolicyResponse.model_validate(policy)


# ── Promotion Applications Endpoints ────────────────────────────────────────

@router.get("/applications/my", response_model=schemas.PromotionApplicationResponse)
def get_my_promotion_application(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    """
    Safe, idempotent, side-effect free endpoint to retrieve applicant's current promotion application.
    Does NOT create any database records on GET.
    """
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.user_id == context.user.id,
        models.PromotionApplication.organization_id == context.organization.id
    ).order_by(models.PromotionApplication.created_at.desc()).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active promotion application found for current user"
        )

    # Detect stale evaluation if evidence or policy changed
    if app.evaluation_summary_json and app.evaluation_fingerprint:
        evidence_items = app.evidence_selections
        current_fingerprint = generate_evaluation_fingerprint(
            app.policy_id,
            app.policy_version,
            app.target_rank,
            evidence_items
        )
        if current_fingerprint != app.evaluation_fingerprint:
            app.evaluation_summary_json["is_stale"] = True

    return schemas.PromotionApplicationResponse.model_validate(app)


@router.post("/applications", response_model=schemas.PromotionApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_promotion_application(
    payload: schemas.PromotionApplicationCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    now = datetime.datetime.now(datetime.UTC).isoformat()

    policy = None
    if payload.policy_id:
        policy = db.query(models.PromotionPolicy).filter(
            models.PromotionPolicy.id == payload.policy_id,
            models.PromotionPolicy.organization_id == context.organization.id
        ).first()

    if not policy:
        policy = db.query(models.PromotionPolicy).filter(
            models.PromotionPolicy.organization_id == context.organization.id,
            models.PromotionPolicy.status == "ACTIVE"
        ).first()

    if not policy:
        policy = seed_default_institutional_policy(context.organization.id, db, context.user.id)

    app = models.PromotionApplication(
        id=f"papp-{secrets.token_hex(6)}",
        organization_id=context.organization.id,
        user_id=context.user.id,
        policy_id=policy.id,
        policy_version=policy.version,
        current_rank=payload.current_rank or "ASSISTANT_PROFESSOR",
        target_rank=payload.target_rank or policy.target_rank,
        status="DRAFT",
        readiness_percentage=0,
        total_calculated_points=0.0,
        created_at=now,
        updated_at=now
    )
    db.add(app)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_APPLICATION_CREATED",
        details=f"Created promotion application {app.id} for rank {app.target_rank} under policy {policy.id} v{policy.version}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(app)
    return schemas.PromotionApplicationResponse.model_validate(app)


@router.get("/applications/{application_id}")
def get_promotion_application(
    application_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).first()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    # Access check: the applicant, an explicitly assigned committee member for
    # THIS application, or an org-level OWNER/ORGANIZATION_ADMIN's read-only
    # institutional oversight. Platform-wide admin status grants nothing here.
    is_owner = app.user_id == context.user.id
    member = is_committee_member(app, context, db)
    oversight_only = not is_owner and not member and has_org_oversight_access(context)
    if not is_owner and not member and not oversight_only:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this promotion application")

    # Oversight-only viewers (org admin/owner not on the committee) get a
    # server-side-projected administrative-metadata response — never the
    # private academic dossier (evidence, evaluation detail, readiness/points,
    # committee notes, decision rationale). This is enforced by constructing
    # a fully separate response object here, not by hiding fields client-side.
    if oversight_only:
        committee_count = db.query(models.PromotionCommitteeAssignment).filter(
            models.PromotionCommitteeAssignment.application_id == app.id,
            models.PromotionCommitteeAssignment.status == "ACTIVE"
        ).count()
        return schemas.PromotionApplicationAdminMetadataResponse(
            id=app.id, organization_id=app.organization_id, user_id=app.user_id,
            policy_id=app.policy_id, policy_version=app.policy_version,
            current_rank=app.current_rank, target_rank=app.target_rank, status=app.status,
            committee_assignment_count=committee_count, has_committee_assigned=committee_count > 0,
            decision_status=app.human_review_decision, decision_recorded_at=app.reviewed_at,
            submitted_at=app.submitted_at, created_at=app.created_at, updated_at=app.updated_at
        )

    # Stale check
    if app.evaluation_summary_json and app.evaluation_fingerprint:
        evidence_items = app.evidence_selections
        current_fingerprint = generate_evaluation_fingerprint(
            app.policy_id,
            app.policy_version,
            app.target_rank,
            evidence_items
        )
        if current_fingerprint != app.evaluation_fingerprint:
            app.evaluation_summary_json["is_stale"] = True

    resp = schemas.PromotionApplicationResponse.model_validate(app)
    resp.is_committee_member = member
    return resp


# ── Committee Assignment Endpoints ──────────────────────────────────────────
# Assigning/revoking WHO serves on a committee is an administrative
# configuration action (verify_committee_admin); it is deliberately separate
# from BEING a committee member (is_committee_member) — granting this
# authority does not itself confer review/decision authority.

@router.post("/applications/{application_id}/committee", response_model=schemas.PromotionCommitteeAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_committee_member(
    application_id: str,
    payload: schemas.PromotionCommitteeAssignRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    verify_committee_admin(context)

    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).with_for_update().first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    if payload.user_id == app.user_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The applicant cannot be assigned to review their own promotion application")

    target_membership = db.query(models.OrganizationMembership).filter(
        models.OrganizationMembership.organization_id == context.organization.id,
        models.OrganizationMembership.user_id == payload.user_id
    ).first()
    if not target_membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user is not a member of this organization")

    existing = db.query(models.PromotionCommitteeAssignment).filter(
        models.PromotionCommitteeAssignment.application_id == application_id,
        models.PromotionCommitteeAssignment.user_id == payload.user_id,
        models.PromotionCommitteeAssignment.status == "ACTIVE"
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already an active committee member for this application")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    assignment = models.PromotionCommitteeAssignment(
        id=f"pca-{secrets.token_hex(6)}",
        organization_id=context.organization.id,
        application_id=application_id,
        user_id=payload.user_id,
        assigned_by=context.user.id,
        status="ACTIVE",
        assigned_at=now
    )
    db.add(assignment)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_COMMITTEE_ASSIGNED",
        details=f"Assigned user {payload.user_id} to the review committee for promotion application {application_id}",
        timestamp=now
    )
    db.add(audit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already an active committee member for this application")
    db.refresh(assignment)
    return assignment


@router.delete("/applications/{application_id}/committee/{user_id}", response_model=schemas.PromotionCommitteeAssignmentResponse)
def revoke_committee_member(
    application_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    verify_committee_admin(context)

    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    assignment = db.query(models.PromotionCommitteeAssignment).filter(
        models.PromotionCommitteeAssignment.application_id == application_id,
        models.PromotionCommitteeAssignment.user_id == user_id,
        models.PromotionCommitteeAssignment.status == "ACTIVE"
    ).with_for_update().first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active committee assignment not found")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    assignment.status = "REVOKED"
    assignment.revoked_at = now
    assignment.revoked_by = context.user.id

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_COMMITTEE_REVOKED",
        details=f"Revoked user {user_id} from the review committee for promotion application {application_id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(assignment)
    return assignment


# ── Evidence Mapping Endpoints ──────────────────────────────────────────────

@router.post("/applications/{application_id}/evidence", response_model=schemas.PromotionApplicationResponse)
def map_evidence_to_application(
    application_id: str,
    payload: schemas.PromotionEvidenceSelectRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).with_for_update().first()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    if app.user_id != context.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify another researcher's promotion evidence")

    # Terminal state protection
    if app.status in ["SUBMITTED", "UNDER_REVIEW", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot add evidence to application in status {app.status}. File is locked."
        )

    # Criterion binding verification (Criterion must belong to locked policy)
    if payload.criterion_id:
        criterion = db.query(models.PromotionCriterion).filter(
            models.PromotionCriterion.id == payload.criterion_id,
            models.PromotionCriterion.policy_id == app.policy_id
        ).first()
        if not criterion:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Criterion does not belong to application's active promotion policy"
            )

    now = datetime.datetime.now(datetime.UTC).isoformat()

    # Evidence ownership verification (Applicant must own the scholarly asset)
    assets = db.query(models.ScholarlyAsset).filter(
        models.ScholarlyAsset.id.in_(payload.scholarly_asset_ids),
        models.ScholarlyAsset.organization_id == context.organization.id
    ).all()

    found_ids = {a.id for a in assets}
    for req_id in payload.scholarly_asset_ids:
        if req_id not in found_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scholarly asset {req_id} not found in this organization"
            )

    for asset in assets:
        if asset.owner_user_id != context.user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scholarly asset {asset.id} does not belong to applicant"
            )

    existing_asset_ids = {
        sel.scholarly_asset_id
        for sel in db.query(models.PromotionAssetSelection).filter(
            models.PromotionAssetSelection.promotion_application_id == app.id
        ).all()
    }

    new_selections_count = 0
    for asset in assets:
        if asset.id not in existing_asset_ids:
            snapshot = {
                "asset_id": asset.id,
                "title_ar": asset.title_ar,
                "title_en": asset.title_en,
                "journal_name": asset.journal_name,
                "publication_date": asset.publication_date,
                "doi": asset.doi,
                "metadata": asset.metadata_json or {}
            }
            points = compute_evidence_points(asset)

            selection = models.PromotionAssetSelection(
                id=f"pas-{secrets.token_hex(6)}",
                promotion_application_id=app.id,
                scholarly_asset_id=asset.id,
                criterion_id=payload.criterion_id,
                eligibility_status="ELIGIBLE",
                calculated_points=points,
                evidence_status="SUBMITTED",
                evidence_snapshot_json=snapshot,
                verification_status="UNVERIFIED",
                created_at=now
            )
            db.add(selection)
            new_selections_count += 1

    app.updated_at = now
    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_EVIDENCE_ADDED",
        details=f"Added {new_selections_count} scholarly evidence assets to promotion application {app.id}",
        timestamp=now
    )
    db.add(audit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This evidence is already attached to the application")
    db.refresh(app)
    return schemas.PromotionApplicationResponse.model_validate(app)


@router.delete("/applications/{application_id}/evidence/{asset_id}", response_model=schemas.PromotionApplicationResponse)
def remove_evidence_from_application(
    application_id: str,
    asset_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).first()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    if app.user_id != context.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify another researcher's promotion evidence")

    # Terminal state protection
    if app.status in ["SUBMITTED", "UNDER_REVIEW", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot remove evidence from application in status {app.status}. File is locked."
        )

    deleted_count = db.query(models.PromotionAssetSelection).filter(
        models.PromotionAssetSelection.promotion_application_id == app.id,
        models.PromotionAssetSelection.scholarly_asset_id == asset_id
    ).delete(synchronize_session=False)

    if deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence selection not found in this dossier")

    now = datetime.datetime.now(datetime.UTC).isoformat()
    app.updated_at = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_EVIDENCE_REMOVED",
        details=f"Removed asset {asset_id} from promotion application {app.id}",
        timestamp=now
    )
    db.add(audit)
    db.commit()
    db.refresh(app)
    return schemas.PromotionApplicationResponse.model_validate(app)


# ── Evaluation Engine Endpoints ─────────────────────────────────────────────

@router.post("/applications/{application_id}/evaluate", response_model=schemas.PromotionEvaluationResult)
def evaluate_application(
    application_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).first()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    # Evaluation is either the applicant's own self-service readiness check or
    # part of a committee member's review of an application they are
    # explicitly assigned to — never generic org-level or platform admin
    # access (evaluate is treated as sensitive, on par with review/decide,
    # not as passive institutional oversight).
    is_owner = app.user_id == context.user.id
    if not is_owner and not is_committee_member(app, context, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to evaluate this promotion application")

    # Load locked policy version
    policy = db.query(models.PromotionPolicy).filter(
        models.PromotionPolicy.id == app.policy_id
    ).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Applicable promotion policy not found")

    criteria = db.query(models.PromotionCriterion).filter(
        models.PromotionCriterion.policy_id == policy.id
    ).order_by(models.PromotionCriterion.sort_order.asc()).all()

    evidence_items = db.query(models.PromotionAssetSelection).filter(
        models.PromotionAssetSelection.promotion_application_id == app.id
    ).all()

    asset_ids = [e.scholarly_asset_id for e in evidence_items]
    assets = db.query(models.ScholarlyAsset).filter(
        models.ScholarlyAsset.id.in_(asset_ids)
    ).all()

    eval_result = evaluate_promotion_application(app, policy, criteria, evidence_items, assets)

    # Persist snapshot and update application state
    now = datetime.datetime.now(datetime.UTC).isoformat()
    app.readiness_percentage = eval_result.readiness_percentage
    app.total_calculated_points = eval_result.total_calculated_points
    app.evaluation_summary_json = eval_result.model_dump()
    app.evaluation_fingerprint = eval_result.evaluation_fingerprint
    app.updated_at = now

    snapshot = models.PromotionEvaluationSnapshot(
        id=f"snap-{secrets.token_hex(6)}",
        application_id=app.id,
        policy_id=policy.id,
        policy_version=policy.version,
        readiness_percentage=eval_result.readiness_percentage,
        total_points=eval_result.total_calculated_points,
        criteria_results_json=[cr.model_dump() for cr in eval_result.criteria_results],
        evaluation_fingerprint=eval_result.evaluation_fingerprint,
        evaluated_by=context.user.id,
        evaluated_at=now
    )
    db.add(snapshot)

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_EVALUATED",
        details=f"Evaluated promotion application {app.id}: Readiness {eval_result.readiness_percentage}%, Points {eval_result.total_calculated_points}",
        timestamp=now
    )
    db.add(audit)
    db.commit()

    return eval_result


# ── Submission & Committee Review ───────────────────────────────────────────

@router.post("/applications/{application_id}/submit", response_model=schemas.PromotionApplicationResponse)
def submit_promotion_application(
    application_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).with_for_update().first()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    if app.user_id != context.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the applicant can submit their promotion dossier")

    # State Machine Transition Check
    if app.status not in ["DRAFT", "READY_FOR_REVIEW", "RETURNED_FOR_CHANGES"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit application in status '{app.status}'. Must be DRAFT or RETURNED_FOR_CHANGES."
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    app.status = "SUBMITTED"
    app.submitted_at = now
    app.updated_at = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_SUBMITTED",
        details=f"Submitted promotion application {app.id} for committee evaluation",
        timestamp=now
    )
    db.add(audit)

    # Record Outbox Workflow Event
    OutboxService.record_event(
        db=db,
        organization_id=context.organization.id,
        event_type=WorkflowEventType.PROMOTION_APPLICATION_SUBMITTED,
        aggregate_type=AggregateType.PROMOTION_APPLICATION,
        aggregate_id=app.id,
        actor_user_id=context.user.id,
        payload=EventPayload(
            title_ar="طلب ترقية أكاديمية جديد",
            title_en="New Promotion Application Submitted",
            message_ar=f"تم تقديم ملف ترقية جديد للرتبة ({app.target_rank}) من قبل {context.user.username}.",
            message_en=f"A new promotion application for rank ({app.target_rank}) was submitted by {context.user.username}.",
            target_type="PROMOTION_APPLICATION",
            target_id=app.id,
            meta={"target_rank": app.target_rank, "policy_version": app.policy_version}
        ),
        scope_key=f"submit:{app.updated_at}"
    )

    db.commit()
    db.refresh(app)
    return schemas.PromotionApplicationResponse.model_validate(app)


@router.post("/applications/{application_id}/review", response_model=schemas.PromotionApplicationResponse)
def review_promotion_application(
    application_id: str,
    payload: schemas.HumanReviewDecisionRequest,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context)
):
    app = db.query(models.PromotionApplication).filter(
        models.PromotionApplication.id == application_id,
        models.PromotionApplication.organization_id == context.organization.id
    ).with_for_update().first()

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion application not found")

    # Committee decision authority is resource-scoped to this exact
    # application (see is_committee_member) — never granted by organization
    # role or platform-admin status alone.
    require_committee_member(app, context, db)

    # Defense in depth: even if an application's own owner were ever
    # mistakenly assigned to its committee, they may never decide their own
    # promotion.
    if app.user_id == context.user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Applicants cannot review or decide their own promotion application")

    # State machine check: Must be SUBMITTED or UNDER_REVIEW. The row lock
    # above ensures two concurrent committee decisions on the same dossier
    # cannot both pass this check — the second request blocks until the
    # first commits, then correctly sees the now-terminal status and is
    # rejected rather than silently overwriting the first decision.
    if app.status not in ["SUBMITTED", "UNDER_REVIEW"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot record committee review for application in status '{app.status}'. Dossier must be SUBMITTED."
        )

    now = datetime.datetime.now(datetime.UTC).isoformat()
    app.human_review_decision = payload.decision
    app.human_review_notes = sanitize_text(payload.notes)
    app.reviewer_user_id = context.user.id
    app.reviewed_at = now
    
    if payload.decision == "REQUIRES_FURTHER_DOCS":
        app.status = "RETURNED_FOR_CHANGES"
        event_type = WorkflowEventType.PROMOTION_RETURNED_FOR_CHANGES
        msg_ar = "تمت إعادة ملف الترقية من قبل اللجنة لطلب مستندات وتعديلات إضافية."
        msg_en = "Your promotion dossier has been returned by the committee for additional documentation."
    else:
        app.status = "COMPLETED"
        event_type = WorkflowEventType.PROMOTION_PROCESS_COMPLETED
        msg_ar = f"تم تسجيل قرار اللجنة النهائي بشأن طلب الترقية: {payload.decision}."
        msg_en = f"The committee has recorded the final promotion decision: {payload.decision}."
        
    app.updated_at = now

    audit = models.AuditLog(
        id=secrets.token_hex(8),
        userId=context.user.id,
        organizationId=context.organization.id,
        action="PROMOTION_HUMAN_REVIEW_RECORDED",
        details=f"Recorded committee human decision '{payload.decision}' for promotion application {app.id}",
        timestamp=now
    )
    db.add(audit)

    # Record Outbox Workflow Event
    OutboxService.record_event(
        db=db,
        organization_id=context.organization.id,
        event_type=event_type,
        aggregate_type=AggregateType.PROMOTION_APPLICATION,
        aggregate_id=app.id,
        actor_user_id=context.user.id,
        payload=EventPayload(
            title_ar="تحديث بشأن ملف الترقية الأكاديمية",
            title_en="Academic Promotion Dossier Update",
            message_ar=msg_ar,
            message_en=msg_en,
            target_type="PROMOTION_APPLICATION",
            target_id=app.id,
            meta={"decision": payload.decision, "target_rank": app.target_rank}
        ),
        scope_key=f"review:{app.updated_at}"
    )

    db.commit()
    db.refresh(app)
    return schemas.PromotionApplicationResponse.model_validate(app)
