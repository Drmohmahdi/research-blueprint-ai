import json
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.publication_intelligence import (
    SECTION_STATES, canonical_doi, canonical_issn, create_version, match_journal,
    now, readiness, reference_integrity, select_reporting_guidelines,
    transition_submission, authorship_snapshot, authorship_complete, CREDIT_TAXONOMY,
)
from ..services.tenant_context import TenantContext, get_tenant_context

router = APIRouter(prefix="/publication-intelligence", tags=["publication-intelligence"])
WRITE_ROLES = {"OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR", "RESEARCHER"}


class VersionCreate(BaseModel):
    article_type: Literal["ORIGINAL_RESEARCH", "SYSTEMATIC_REVIEW", "CONCEPTUAL_ARTICLE"]
    change_summary: str | None = Field(default=None, max_length=500)
    dependencies: list[dict[str, Any]] = Field(default_factory=list, max_length=100)


class SectionUpdate(BaseModel):
    status: Literal["NOT_STARTED", "DRAFT", "NEEDS_REVIEW", "READY", "STALE", "NOT_REQUIRED"]
    content: dict[str, Any] = Field(default_factory=dict)


class JournalCreate(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    issn: str | None = None
    eissn: str | None = None
    publisher: str | None = Field(default=None, max_length=300)
    metadata: dict[str, Any] = Field(default_factory=dict)
    provider_name: str = Field(min_length=2, max_length=100)
    provider_record_id: str | None = Field(default=None, max_length=300)
    retrieved_at: str
    verified_at: str | None = None
    stale_after: str


class MatchRequest(BaseModel):
    journal_ids: list[str] = Field(min_length=1, max_length=100)
    preferences: dict[str, Any] = Field(default_factory=dict)


class ShortlistRequest(BaseModel):
    journal_id: str
    position: Literal["PRIMARY", "ALTERNATIVE_1", "ALTERNATIVE_2", "WATCHLIST", "REJECTED"]


class SubmissionCreate(BaseModel):
    journal_id: str
    manuscript_version_id: str
    package_snapshot: dict[str, Any] = Field(default_factory=dict)


class SubmissionStatus(BaseModel):
    status: Literal["READY_TO_SUBMIT", "SUBMITTED", "EDITORIAL_SCREENING", "UNDER_REVIEW", "REVISION_REQUESTED", "RESUBMITTED", "ACCEPTED", "REJECTED", "WITHDRAWN", "PUBLISHED"]
    raw_external_status: str | None = Field(default=None, max_length=200)
    submission_identifier: str | None = Field(default=None, max_length=200)


def asset_or_404(db: Session, asset_id: str, ctx: TenantContext) -> models.ScholarlyAsset:
    asset = db.query(models.ScholarlyAsset).filter(models.ScholarlyAsset.id == asset_id, models.ScholarlyAsset.organization_id == ctx.organization.id, models.ScholarlyAsset.deleted_at.is_(None)).first()
    if not asset: raise HTTPException(404, "Manuscript not found")
    return asset


def require_write(asset: models.ScholarlyAsset, ctx: TenantContext) -> None:
    # Manuscript edit authority is resource ownership only. Generic org-role
    # membership (OWNER/ORGANIZATION_ADMIN) does not imply it, matching the
    # platform-wide convention: private academic content authority requires
    # a resource-scoped relationship, not a bare organization role.
    if asset.owner_user_id == ctx.user.id:
        return
    raise HTTPException(403, "Publication modification is not permitted")


def require_authorship_manage(asset: models.ScholarlyAsset, ctx: TenantContext) -> None:
    # Same resource-ownership-only rule as require_write.
    if asset.owner_user_id == ctx.user.id:
        return
    raise HTTPException(403, "Authorship management is not permitted for this role")


def require_submission_authority(asset: models.ScholarlyAsset, version: models.PublicationManuscriptVersion,
                                 ctx: TenantContext, db: Session) -> None:
    # Submission approval: resource owner or the confirmed corresponding
    # author for this specific manuscript version — never a bare org role.
    if asset.owner_user_id == ctx.user.id:
        return
    auth = db.query(models.PublicationManuscriptAuthorship).filter(
        models.PublicationManuscriptAuthorship.manuscript_version_id == version.id,
        models.PublicationManuscriptAuthorship.user_id == ctx.user.id,
        models.PublicationManuscriptAuthorship.is_corresponding_author.is_(True),
    ).first()
    if not auth:
        raise HTTPException(403, "Only the corresponding author may approve submissions")


def version_or_404(db: Session, asset: models.ScholarlyAsset, version_id: str) -> models.PublicationManuscriptVersion:
    item = db.query(models.PublicationManuscriptVersion).filter(models.PublicationManuscriptVersion.id == version_id, models.PublicationManuscriptVersion.asset_id == asset.id, models.PublicationManuscriptVersion.organization_id == asset.organization_id).first()
    if not item: raise HTTPException(404, "Manuscript version not found")
    return item


@router.get("/assets/{asset_id}/command-center")
def command_center(asset_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx)
    version = db.query(models.PublicationManuscriptVersion).filter(models.PublicationManuscriptVersion.asset_id == asset.id).order_by(models.PublicationManuscriptVersion.version_number.desc()).first()
    manuscript = readiness(db, version) if version else {"score": 0, "status": "NOT_READY", "blocking": [{"code": "NO_MANUSCRIPT_VERSION"}], "sections": []}
    shortlist = db.query(models.PublicationJournalShortlist).filter(models.PublicationJournalShortlist.asset_id == asset.id, models.PublicationJournalShortlist.organization_id == ctx.organization.id).all()
    submissions = db.query(models.PublicationSubmission).filter(models.PublicationSubmission.asset_id == asset.id, models.PublicationSubmission.organization_id == ctx.organization.id).order_by(models.PublicationSubmission.created_at.desc()).all()
    next_action = manuscript["blocking"][0] if manuscript["blocking"] else ({"code": "SELECT_JOURNAL"} if not shortlist else {"code": "PREPARE_SUBMISSION"})
    return {"asset": {"id": asset.id, "title_ar": asset.title_ar, "title_en": asset.title_en, "lifecycle_status": asset.lifecycle_status}, "version": ({"id": version.id, "number": version.version_number, "article_type": version.article_type, "fingerprint": version.fingerprint} if version else None), "manuscript_readiness": manuscript, "reporting_compliance": {"status": "REQUIRES_HUMAN_CONFIRMATION", "score": None}, "journal_match": {"shortlisted": len(shortlist), "status": "AVAILABLE" if version else "BLOCKED"}, "submission_readiness": {"status": "READY" if manuscript["status"] == "READY" and shortlist else "NOT_READY"}, "next_best_action": {"priority": "BLOCKING" if manuscript["blocking"] else "RECOMMENDED", **next_action}, "submissions": [{"id": s.id, "status": s.status, "manuscript_version_id": s.manuscript_version_id} for s in submissions]}


@router.post("/assets/{asset_id}/versions", status_code=201)
def add_version(asset_id: str, body: VersionCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx)
    item = create_version(db, asset, body.article_type, ctx.user.id, body.change_summary, body.dependencies)
    db.commit()
    return {"id": item.id, "version_number": item.version_number, "article_type": item.article_type, "fingerprint": item.fingerprint}


@router.patch("/assets/{asset_id}/versions/{version_id}/sections/{section_key}")
def update_section(asset_id: str, version_id: str, section_key: str, body: SectionUpdate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx); version_or_404(db, asset, version_id)
    section = db.query(models.PublicationManuscriptSection).filter(models.PublicationManuscriptSection.manuscript_version_id == version_id, models.PublicationManuscriptSection.section_key == section_key.upper(), models.PublicationManuscriptSection.organization_id == ctx.organization.id).first()
    if not section: raise HTTPException(404, "Section not found")
    section.status, section.content_json, section.updated_at = body.status, body.content, now()
    section.stale_at = now() if body.status == "STALE" else None
    db.commit(); return {"key": section.section_key, "status": section.status}


@router.post("/journals", status_code=201)
def add_journal(body: JournalCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    if (ctx.role or "").upper() not in {"OWNER", "ORGANIZATION_ADMIN"} and not ctx.is_global_admin: raise HTTPException(403, "Journal catalog administration is not permitted")
    issn, eissn = canonical_issn(body.issn), canonical_issn(body.eissn)
    key = issn or eissn or "title:" + " ".join(body.title.lower().split())
    existing = db.query(models.PublicationJournal).filter(models.PublicationJournal.canonical_key == key).first()
    if existing: raise HTTPException(409, "Journal already exists")
    item = models.PublicationJournal(id=f"journal-{uuid.uuid4()}", canonical_key=key, title=body.title, issn=issn, eissn=eissn, publisher=body.publisher, metadata_json=body.metadata, provider_name=body.provider_name, provider_record_id=body.provider_record_id, retrieved_at=body.retrieved_at, verified_at=body.verified_at, stale_after=body.stale_after)
    db.add(item); db.commit(); return {"id": item.id, "canonical_key": item.canonical_key}


@router.post("/assets/{asset_id}/versions/{version_id}/matches")
def create_matches(asset_id: str, version_id: str, body: MatchRequest, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx); version = version_or_404(db, asset, version_id)
    journals = db.query(models.PublicationJournal).filter(models.PublicationJournal.id.in_(body.journal_ids)).all()
    if len(journals) != len(set(body.journal_ids)): raise HTTPException(404, "Journal not found")
    output = []
    for journal in journals:
        result = match_journal(version, journal, body.preferences)
        item = models.PublicationJournalMatch(id=f"match-{uuid.uuid4()}", organization_id=ctx.organization.id, asset_id=asset.id, manuscript_version_id=version.id, journal_id=journal.id, eligibility=result["eligibility"], score=result["score"], factors_json=result["factors"], concerns_json=result["concerns"], metadata_snapshot_json={"provider": journal.provider_name, "retrieved_at": journal.retrieved_at, "verified_at": journal.verified_at, "stale_after": journal.stale_after, "metadata": journal.metadata_json}, created_by=ctx.user.id, created_at=now())
        db.add(item); output.append({"id": item.id, "journal_id": journal.id, "journal_title": journal.title, **result, "disclaimer": "Suitability match, not likelihood of acceptance."})
    db.commit(); return sorted(output, key=lambda x: (x["eligibility"] != "ELIGIBLE", -(x["score"] or -1)))


@router.put("/assets/{asset_id}/shortlist")
def shortlist(asset_id: str, body: ShortlistRequest, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx)
    if not db.query(models.PublicationJournal).filter(models.PublicationJournal.id == body.journal_id).first(): raise HTTPException(404, "Journal not found")
    item = db.query(models.PublicationJournalShortlist).filter(models.PublicationJournalShortlist.asset_id == asset.id, models.PublicationJournalShortlist.journal_id == body.journal_id).first()
    if item: item.position = body.position; item.selected_by = ctx.user.id
    else:
        item = models.PublicationJournalShortlist(id=f"short-{uuid.uuid4()}", organization_id=ctx.organization.id, asset_id=asset.id, journal_id=body.journal_id, position=body.position, selected_by=ctx.user.id, created_at=now()); db.add(item)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request just inserted the same (asset, journal) row first;
        # this call is still logically an upsert, so fall back to updating it
        # rather than surfacing a conflict for what is semantically idempotent.
        db.rollback()
        item = db.query(models.PublicationJournalShortlist).filter(models.PublicationJournalShortlist.asset_id == asset.id, models.PublicationJournalShortlist.journal_id == body.journal_id).first()
        item.position = body.position; item.selected_by = ctx.user.id
        db.commit()
    return {"id": item.id, "position": item.position}


@router.post("/assets/{asset_id}/submissions", status_code=201)
def add_submission(asset_id: str, body: SubmissionCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); version = version_or_404(db, asset, body.manuscript_version_id)
    require_submission_authority(asset, version, ctx, db)
    if readiness(db, version)["status"] != "READY": raise HTTPException(409, "Manuscript is not ready")
    if not db.query(models.PublicationJournalShortlist).filter(models.PublicationJournalShortlist.asset_id == asset.id, models.PublicationJournalShortlist.journal_id == body.journal_id, models.PublicationJournalShortlist.organization_id == ctx.organization.id).first(): raise HTTPException(409, "Journal must be selected by the researcher")
    created = now(); package = json.loads(json.dumps(body.package_snapshot))
    item = models.PublicationSubmission(id=f"submission-{uuid.uuid4()}", organization_id=ctx.organization.id, asset_id=asset.id, journal_id=body.journal_id, manuscript_version_id=version.id, package_snapshot_json={**package, "manuscript_fingerprint": version.fingerprint, "manuscript_version": version.version_number}, submitted_by=ctx.user.id, created_at=created, updated_at=created)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A submission already exists for this manuscript version and journal")
    return {"id": item.id, "status": item.status, "manuscript_version_id": item.manuscript_version_id}


@router.patch("/assets/{asset_id}/submissions/{submission_id}/status")
def set_submission_status(asset_id: str, submission_id: str, body: SubmissionStatus, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx)
    # Lock the submission row before reading its status: two concurrent status
    # transitions read at READ COMMITTED would otherwise both see the same
    # pre-transition status and the later commit would silently overwrite the
    # earlier one (a lost update), producing two "final" outcomes.
    item = db.query(models.PublicationSubmission).filter(models.PublicationSubmission.id == submission_id, models.PublicationSubmission.asset_id == asset.id, models.PublicationSubmission.organization_id == ctx.organization.id).with_for_update().first()
    if not item: raise HTTPException(404, "Submission not found")
    version = version_or_404(db, asset, item.manuscript_version_id)
    require_submission_authority(asset, version, ctx, db)
    transition_submission(item, body.status); item.raw_external_status = body.raw_external_status
    if body.submission_identifier: item.submission_identifier = body.submission_identifier
    if body.status == "ACCEPTED": asset.lifecycle_status = "ACCEPTED"
    elif body.status == "PUBLISHED": asset.lifecycle_status = "PUBLISHED"
    db.commit(); return {"id": item.id, "status": item.status, "asset_status": asset.lifecycle_status}


# ── Authorship & CRediT ──────────────────────────────────────────────────────

class AuthorshipAdd(BaseModel):
    user_id: str
    display_name: str | None = None
    affiliation: str | None = None
    orcid: str | None = None
    author_order: int = Field(ge=1, le=100)
    is_corresponding_author: bool = False
    credit_roles: list[str] = Field(default_factory=list)


class AuthorshipUpdate(BaseModel):
    author_order: int | None = Field(default=None, ge=1, le=100)
    is_corresponding_author: bool | None = None
    credit_roles: list[str] | None = None


class AuthorConfirm(BaseModel):
    confirmed: bool = True


class GuidelineApply(BaseModel):
    guideline_short_name: str


class GuidelineItemStatus(BaseModel):
    status: str  # NOT_STARTED, PRESENT, PARTIAL, MISSING, NOT_APPLICABLE, NEEDS_REVIEW
    notes: str | None = None


class ReferenceCreate(BaseModel):
    citation_key: str | None = None
    author: str | None = None
    title: str | None = None
    journal: str | None = None
    year: str | None = None
    doi: str | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    publisher: str | None = None
    reference_type: str = "JOURNAL_ARTICLE"


class AcceptanceCreate(BaseModel):
    submission_id: str
    accepted_at: str
    evidence: str | None = None


@router.get("/assets/{asset_id}/versions/{version_id}/authorship")
def get_authorship(asset_id: str, version_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); version = version_or_404(db, asset, version_id)
    return {"version_id": version.id, "authors": authorship_snapshot(db, version),
            "complete": authorship_complete(db, version), "credit_taxonomy": CREDIT_TAXONOMY}


@router.post("/assets/{asset_id}/versions/{version_id}/authorship", status_code=201)
def add_author(asset_id: str, version_id: str, body: AuthorshipAdd, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_authorship_manage(asset, ctx); version = version_or_404(db, asset, version_id)
    invalid = [r for r in body.credit_roles if r not in CREDIT_TAXONOMY]
    if invalid: raise HTTPException(422, f"Unknown CRediT roles: {invalid}")
    existing = db.query(models.PublicationManuscriptAuthorship).filter(
        models.PublicationManuscriptAuthorship.manuscript_version_id == version.id,
        models.PublicationManuscriptAuthorship.user_id == body.user_id).first()
    if existing: raise HTTPException(409, "Author already in authorship")
    stamp = now()
    row = models.PublicationManuscriptAuthorship(
        id=f"pm-a-{uuid.uuid4().hex[:12]}", organization_id=ctx.organization.id,
        manuscript_version_id=version.id, user_id=body.user_id, display_name=body.display_name,
        affiliation=body.affiliation, orcid=body.orcid, author_order=body.author_order,
        is_corresponding_author=body.is_corresponding_author, credit_roles=body.credit_roles,
        confirmed_at=None, source="MANUAL", created_at=stamp, updated_at=stamp)
    db.add(row); db.commit()
    return {"id": row.id, "author_order": row.author_order, "is_corresponding_author": row.is_corresponding_author}


@router.patch("/assets/{asset_id}/versions/{version_id}/authorship/{authorship_id}")
def update_author(asset_id: str, version_id: str, authorship_id: str, body: AuthorshipUpdate,
                  db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_authorship_manage(asset, ctx); version = version_or_404(db, asset, version_id)
    row = db.query(models.PublicationManuscriptAuthorship).filter(
        models.PublicationManuscriptAuthorship.id == authorship_id,
        models.PublicationManuscriptAuthorship.manuscript_version_id == version.id).first()
    if not row: raise HTTPException(404, "Authorship record not found")
    if body.author_order is not None: row.author_order = body.author_order
    if body.is_corresponding_author is not None:
        if body.is_corresponding_author:
            # Clear the WHOLE row set (including this row), never a subset that
            # excludes `row.id`: two concurrent reassignments each excluding a
            # different row acquire non-overlapping locks in opposite order and
            # deadlock. Touching the identical full set every time guarantees
            # concurrent transactions contend for the same lock and simply queue.
            db.query(models.PublicationManuscriptAuthorship).filter(
                models.PublicationManuscriptAuthorship.manuscript_version_id == version.id).update({"is_corresponding_author": False})
        row.is_corresponding_author = body.is_corresponding_author
    if body.credit_roles is not None:
        invalid = [r for r in body.credit_roles if r not in CREDIT_TAXONOMY]
        if invalid: raise HTTPException(422, f"Unknown CRediT roles: {invalid}")
        row.credit_roles = body.credit_roles
    row.updated_at = now()
    db.add(models.AuditLog(id=f"aud-pubauth-{uuid.uuid4().hex[:10]}", userId=ctx.user.id,
                          organizationId=ctx.organization.id, action="PUBLICATION_AUTHORSHIP_UPDATED",
                          details=f"asset={asset.id}; version={version.id}; author={row.user_id}", timestamp=now()))
    db.commit()
    return {"id": row.id, "author_order": row.author_order, "is_corresponding_author": row.is_corresponding_author}


@router.post("/assets/{asset_id}/versions/{version_id}/authorship/{authorship_id}/confirm")
def confirm_author(asset_id: str, version_id: str, authorship_id: str, body: AuthorConfirm,
                   db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); version = version_or_404(db, asset, version_id)
    row = db.query(models.PublicationManuscriptAuthorship).filter(
        models.PublicationManuscriptAuthorship.id == authorship_id,
        models.PublicationManuscriptAuthorship.manuscript_version_id == version.id).first()
    if not row: raise HTTPException(404, "Authorship record not found")
    if row.user_id != ctx.user.id and asset.owner_user_id != ctx.user.id and not ctx.is_global_admin:
        raise HTTPException(403, "Only the author themselves (or the manuscript owner) may confirm authorship")
    row.confirmed_at = now() if body.confirmed else None
    row.updated_at = now()
    db.add(models.AuditLog(id=f"aud-pubauth-conf-{uuid.uuid4().hex[:10]}", userId=ctx.user.id,
                          organizationId=ctx.organization.id, action="PUBLICATION_AUTHORSHIP_CONFIRMED",
                          details=f"asset={asset.id}; author={row.user_id}; confirmed={body.confirmed}", timestamp=now()))
    db.commit()
    return {"id": row.id, "confirmed_at": row.confirmed_at}


# ── Reporting guidelines ─────────────────────────────────────────────────────

GUIDELINE_TEMPLATES = {
    "CONSORT": [("1", "Title and abstract"), ("2", "Background and objectives"),
                ("3", "Trial design"), ("4", "Participants"), ("5", "Interventions"),
                ("6", "Outcomes"), ("7", "Sample size"), ("8", "Randomization"),
                ("9", "Blinding"), ("10", "Statistical methods"), ("11", "Participant flow"),
                ("12", "Recruitment"), ("13", "Baseline data"), ("14", "Outcomes and estimation"),
                ("15", "Ancillary analyses"), ("16", "Harms"), ("17", "Limitations"),
                ("18", "Generalisability"), ("19", "Interpretation"), ("20", "Registration"),
                ("21", "Funding")],
    "STROBE": [("1", "Title and abstract"), ("2", "Background/rationale"), ("3", "Objectives"),
               ("4", "Study design"), ("5", "Setting"), ("6", "Participants"), ("7", "Variables"),
               ("8", "Data sources/measurement"), ("9", "Bias"), ("10", "Study size"),
               ("11", "Quantitative variables"), ("12", "Statistical methods"),
               ("13", "Participants flow"), ("14", "Descriptive data"), ("15", "Outcome data"),
               ("16", "Main results"), ("17", "Other analyses"), ("18", "Key results"),
               ("19", "Limitations"), ("20", "Interpretation"), ("21", "Generalisability"),
               ("22", "Funding")],
    "PRISMA": [("1", "Title"), ("2", "Abstract"), ("3", "Rationale"), ("4", "Objectives"),
               ("5", "Eligibility criteria"), ("6", "Information sources"), ("7", "Search"),
               ("8", "Study selection"), ("9", "Data collection process"), ("10", "Data items"),
               ("11", "Risk of bias"), ("12", "Effect measures"), ("13", "Synthesis methods"),
               ("14", "Study selection flow"), ("15", "Study characteristics"),
               ("16", "Risk of bias across studies"), ("17", "Results of individual studies"),
               ("18", "Synthesis of results"), ("19", "Reporting biases"), ("20", "Certainty of evidence"),
               ("21", "Discussion"), ("22", "Limitations of evidence"), ("23", "Conclusion"),
               ("24", "Registration and funding")],
}


@router.post("/reporting-guidelines/seed")
def seed_guidelines(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    if (ctx.role or "").upper() not in {"OWNER", "ORGANIZATION_ADMIN"} and not ctx.is_global_admin:
        raise HTTPException(403, "Guideline administration is not permitted")
    created = []
    for name, items in GUIDELINE_TEMPLATES.items():
        g = db.query(models.PublicationReportingGuideline).filter(models.PublicationReportingGuideline.name == name).first()
        if not g:
            g = models.PublicationReportingGuideline(id=f"guide-{name.lower()}", name=name, version="1.0",
                                                     short_name=name, created_at=now())
            db.add(g); db.flush()
        for number, desc in items:
            if not db.query(models.PublicationReportingGuidelineItem).filter(
                    models.PublicationReportingGuidelineItem.guideline_id == g.id,
                    models.PublicationReportingGuidelineItem.item_number == number).first():
                db.add(models.PublicationReportingGuidelineItem(id=f"gi-{g.id}-{number}",
                        guideline_id=g.id, item_number=number, description=desc))
        created.append(name)
    db.commit()
    return {"guidelines": created}


@router.get("/assets/{asset_id}/versions/{version_id}/guidelines")
def get_guidelines(asset_id: str, version_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); version = version_or_404(db, asset, version_id)
    applicable = select_reporting_guidelines(version.article_type, (asset.metadata_json or {}).get("study_design"))
    checks = db.query(models.PublicationManuscriptGuidelineCheck).filter(
        models.PublicationManuscriptGuidelineCheck.manuscript_version_id == version.id,
        models.PublicationManuscriptGuidelineCheck.organization_id == ctx.organization.id).all()
    return {"applicable": applicable, "checks": [{"id": c.id, "guideline": c.guideline_id,
            "status": c.status, "guideline_version": c.guideline_version} for c in checks]}


@router.post("/assets/{asset_id}/versions/{version_id}/guidelines/apply", status_code=201)
def apply_guideline(asset_id: str, version_id: str, body: GuidelineApply, db: Session = Depends(get_db),
                    ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx); version = version_or_404(db, asset, version_id)
    guideline = db.query(models.PublicationReportingGuideline).filter(
        models.PublicationReportingGuideline.short_name == body.guideline_short_name.upper()).first()
    if not guideline: raise HTTPException(404, "Guideline not found")
    existing = db.query(models.PublicationManuscriptGuidelineCheck).filter(
        models.PublicationManuscriptGuidelineCheck.manuscript_version_id == version.id,
        models.PublicationManuscriptGuidelineCheck.guideline_id == guideline.id).first()
    if existing: raise HTTPException(409, "Guideline already applied to this version")
    stamp = now()
    check = models.PublicationManuscriptGuidelineCheck(
        id=f"pmg-{uuid.uuid4().hex[:12]}", organization_id=ctx.organization.id,
        manuscript_version_id=version.id, guideline_id=guideline.id,
        guideline_version=guideline.version, status="IN_PROGRESS", applied_at=stamp, applied_by=ctx.user.id)
    db.add(check); db.flush()
    items = db.query(models.PublicationReportingGuidelineItem).filter(
        models.PublicationReportingGuidelineItem.guideline_id == guideline.id).all()
    for item in items:
        db.add(models.PublicationManuscriptGuidelineItemStatus(
            id=f"pmgs-{uuid.uuid4().hex[:12]}", check_id=check.id, item_id=item.id, status="NOT_STARTED"))
    db.commit()
    return {"id": check.id, "guideline": guideline.name, "items": len(items)}


@router.patch("/assets/{asset_id}/versions/{version_id}/guidelines/{check_id}/items/{item_number}")
def update_guideline_item(asset_id: str, version_id: str, check_id: str, item_number: str, body: GuidelineItemStatus,
                          db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx); version = version_or_404(db, asset, version_id)
    allowed = {"NOT_STARTED", "PRESENT", "PARTIAL", "MISSING", "NOT_APPLICABLE", "NEEDS_REVIEW"}
    if body.status not in allowed: raise HTTPException(422, "Unsupported item status")
    check = db.query(models.PublicationManuscriptGuidelineCheck).filter(
        models.PublicationManuscriptGuidelineCheck.id == check_id,
        models.PublicationManuscriptGuidelineCheck.manuscript_version_id == version.id).first()
    if not check: raise HTTPException(404, "Guideline check not found")
    item = db.query(models.PublicationReportingGuidelineItem).filter(
        models.PublicationReportingGuidelineItem.guideline_id == check.guideline_id,
        models.PublicationReportingGuidelineItem.item_number == item_number).first()
    if not item: raise HTTPException(404, "Guideline item not found")
    status_row = db.query(models.PublicationManuscriptGuidelineItemStatus).filter(
        models.PublicationManuscriptGuidelineItemStatus.check_id == check.id,
        models.PublicationManuscriptGuidelineItemStatus.item_id == item.id).first()
    if not status_row: raise HTTPException(404, "Item status not found")
    status_row.status = body.status; status_row.notes = body.notes
    db.commit()
    return {"item_number": item_number, "status": status_row.status}


# ── References ───────────────────────────────────────────────────────────────

@router.get("/assets/{asset_id}/versions/{version_id}/references")
def list_references(asset_id: str, version_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); version = version_or_404(db, asset, version_id)
    refs = db.query(models.PublicationReference).filter(
        models.PublicationReference.manuscript_version_id == version.id,
        models.PublicationReference.organization_id == ctx.organization.id).all()
    return [{"id": r.id, "citation_key": r.citation_key, "author": r.author, "title": r.title,
             "journal": r.journal, "year": r.year, "doi": r.doi, "doi_canonical": r.doi_canonical,
             "verification_status": r.verification_status, "duplicate_of": r.duplicate_of} for r in refs]


@router.post("/assets/{asset_id}/versions/{version_id}/references", status_code=201)
def add_reference(asset_id: str, version_id: str, body: ReferenceCreate, db: Session = Depends(get_db),
                  ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx); version = version_or_404(db, asset, version_id)
    canonical = canonical_doi(body.doi)
    row = models.PublicationReference(
        id=f"pref-{uuid.uuid4().hex[:12]}", organization_id=ctx.organization.id, manuscript_version_id=version.id,
        citation_key=body.citation_key, author=body.author, title=body.title, journal=body.journal,
        year=body.year, doi=body.doi, doi_canonical=canonical, volume=body.volume, issue=body.issue,
        pages=body.pages, publisher=body.publisher, reference_type=body.reference_type,
        verification_status="UNVERIFIED", created_by=ctx.user.id, created_at=now())
    db.add(row); db.commit()
    return {"id": row.id, "doi_canonical": canonical}


@router.get("/assets/{asset_id}/versions/{version_id}/references/integrity")
def references_integrity(asset_id: str, version_id: str, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); version = version_or_404(db, asset, version_id)
    return reference_integrity(db, version)


# ── Acceptance recording ─────────────────────────────────────────────────────

@router.post("/assets/{asset_id}/acceptances", status_code=201)
def record_acceptance(asset_id: str, body: AcceptanceCreate, db: Session = Depends(get_db),
                      ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx)
    submission = db.query(models.PublicationSubmission).filter(
        models.PublicationSubmission.id == body.submission_id,
        models.PublicationSubmission.asset_id == asset.id,
        models.PublicationSubmission.organization_id == ctx.organization.id).first()
    if not submission: raise HTTPException(404, "Submission not found")
    if submission.status != "ACCEPTED":
        raise HTTPException(409, "Acceptance may only be recorded for an ACCEPTED submission")
    version = version_or_404(db, asset, submission.manuscript_version_id)
    existing = db.query(models.PublicationAcceptance).filter(
        models.PublicationAcceptance.submission_id == submission.id).first()
    if existing: raise HTTPException(409, "Acceptance already recorded for this submission")
    row = models.PublicationAcceptance(
        id=f"pa-{uuid.uuid4().hex[:12]}", organization_id=ctx.organization.id, asset_id=asset.id,
        submission_id=submission.id, manuscript_version_id=version.id, accepted_at=body.accepted_at,
        evidence=body.evidence, recorded_by=ctx.user.id, created_at=now())
    db.add(row); asset.acceptance_date = body.accepted_at
    db.add(models.AuditLog(id=f"aud-pubacc-{uuid.uuid4().hex[:10]}", userId=ctx.user.id,
                          organizationId=ctx.organization.id, action="PUBLICATION_ACCEPTANCE_RECORDED",
                          details=f"asset={asset.id}; submission={submission.id}; version={version.id}", timestamp=now()))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Acceptance already recorded for this submission")
    return {"id": row.id, "accepted_at": row.accepted_at, "manuscript_version_id": version.id}


# ── Institutional Publication Operations (aggregate-first) ──────────────────

@router.get("/organization/operations")
def publication_operations(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    role = (ctx.role or "").upper()
    if role not in {"OWNER", "ORGANIZATION_ADMIN"} and not ctx.is_global_admin:
        raise HTTPException(403, "Publication operations require an organization administrator role")
    assets = db.query(models.ScholarlyAsset).filter(
        models.ScholarlyAsset.organization_id == ctx.organization.id,
        models.ScholarlyAsset.deleted_at.is_(None)).all()
    by_state: dict[str, int] = {}
    counts = {"active_manuscripts": len(assets), "accepted": 0, "published": 0,
              "under_review": 0, "stale_dependencies": 0}
    for a in assets:
        by_state[a.lifecycle_status or "DRAFT"] = by_state.get(a.lifecycle_status or "DRAFT", 0) + 1
        if a.lifecycle_status == "ACCEPTED": counts["accepted"] += 1
        if a.lifecycle_status == "PUBLISHED": counts["published"] += 1
    # Determine stale data dependencies across manuscript versions
    for a in assets:
        latest = db.query(models.PublicationManuscriptVersion).filter(
            models.PublicationManuscriptVersion.asset_id == a.id).order_by(
            models.PublicationManuscriptVersion.version_number.desc()).first()
        if latest:
            deps = latest.source_dependencies_json or []
            for dep in deps:
                if dep.get("type") != "ANALYSIS":
                    continue
                analysis = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id == dep.get("id")).first()
                dataset = db.query(models.ResearchDataset).filter(
                    models.ResearchDataset.id == analysis.dataset_id).first() if analysis else None
                if not analysis or not dataset or dataset.current_version_id != analysis.dataset_version_id:
                    counts["stale_dependencies"] += 1
                    break
    return {
        "organization_id": ctx.organization.id,
        "scope": "ORGANIZATION",
        "counts": counts,
        "manuscripts_by_state": by_state,
        "manuscripts": [
            {"id": a.id, "title_en": a.title_en, "title_ar": a.title_ar,
             "lifecycle_status": a.lifecycle_status, "asset_type": a.asset_type}
            for a in assets[:200]
        ],
        "aggregate_only": True,
        "raw_content_excluded": True,
    }

