import json
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..services.publication_intelligence import SECTION_STATES, canonical_issn, create_version, match_journal, now, readiness, transition_submission
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
    role = (ctx.role or "").upper()
    if not ctx.is_global_admin and (role not in WRITE_ROLES or (asset.owner_user_id != ctx.user.id and role not in {"OWNER", "ORGANIZATION_ADMIN", "SUPERVISOR"})):
        raise HTTPException(403, "Publication modification is not permitted")


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
    db.commit(); return {"id": item.id, "position": item.position}


@router.post("/assets/{asset_id}/submissions", status_code=201)
def add_submission(asset_id: str, body: SubmissionCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx); version = version_or_404(db, asset, body.manuscript_version_id)
    if readiness(db, version)["status"] != "READY": raise HTTPException(409, "Manuscript is not ready")
    if not db.query(models.PublicationJournalShortlist).filter(models.PublicationJournalShortlist.asset_id == asset.id, models.PublicationJournalShortlist.journal_id == body.journal_id, models.PublicationJournalShortlist.organization_id == ctx.organization.id).first(): raise HTTPException(409, "Journal must be selected by the researcher")
    created = now(); package = json.loads(json.dumps(body.package_snapshot))
    item = models.PublicationSubmission(id=f"submission-{uuid.uuid4()}", organization_id=ctx.organization.id, asset_id=asset.id, journal_id=body.journal_id, manuscript_version_id=version.id, package_snapshot_json={**package, "manuscript_fingerprint": version.fingerprint, "manuscript_version": version.version_number}, submitted_by=ctx.user.id, created_at=created, updated_at=created)
    db.add(item); db.commit(); return {"id": item.id, "status": item.status, "manuscript_version_id": item.manuscript_version_id}


@router.patch("/assets/{asset_id}/submissions/{submission_id}/status")
def set_submission_status(asset_id: str, submission_id: str, body: SubmissionStatus, db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    asset = asset_or_404(db, asset_id, ctx); require_write(asset, ctx)
    item = db.query(models.PublicationSubmission).filter(models.PublicationSubmission.id == submission_id, models.PublicationSubmission.asset_id == asset.id, models.PublicationSubmission.organization_id == ctx.organization.id).first()
    if not item: raise HTTPException(404, "Submission not found")
    transition_submission(item, body.status); item.raw_external_status = body.raw_external_status
    if body.submission_identifier: item.submission_identifier = body.submission_identifier
    if body.status == "ACCEPTED": asset.lifecycle_status = "ACCEPTED"
    elif body.status == "PUBLISHED": asset.lifecycle_status = "PUBLISHED"
    db.commit(); return {"id": item.id, "status": item.status, "asset_status": asset.lifecycle_status}

