import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models

ARTICLE_SECTIONS = {
    "ORIGINAL_RESEARCH": ["TITLE", "ABSTRACT", "KEYWORDS", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION", "REFERENCES", "DECLARATIONS"],
    "SYSTEMATIC_REVIEW": ["TITLE", "ABSTRACT", "KEYWORDS", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION", "REFERENCES", "DECLARATIONS", "REPORTING_CHECKLIST"],
    "CONCEPTUAL_ARTICLE": ["TITLE", "ABSTRACT", "KEYWORDS", "INTRODUCTION", "CONCEPTUAL_FRAMEWORK", "DISCUSSION", "CONCLUSION", "REFERENCES", "DECLARATIONS"],
}
SECTION_STATES = {"NOT_STARTED", "DRAFT", "NEEDS_REVIEW", "READY", "STALE", "NOT_REQUIRED"}
SUBMISSION_TRANSITIONS = {
    "PREPARING": {"READY_TO_SUBMIT"}, "READY_TO_SUBMIT": {"SUBMITTED"},
    "SUBMITTED": {"EDITORIAL_SCREENING", "UNDER_REVIEW", "WITHDRAWN", "REJECTED"},
    "EDITORIAL_SCREENING": {"UNDER_REVIEW", "REJECTED", "WITHDRAWN"},
    "UNDER_REVIEW": {"REVISION_REQUESTED", "ACCEPTED", "REJECTED", "WITHDRAWN"},
    "REVISION_REQUESTED": {"RESUBMITTED", "WITHDRAWN"},
    "RESUBMITTED": {"UNDER_REVIEW", "ACCEPTED", "REJECTED"},
    "ACCEPTED": {"PUBLISHED"}, "REJECTED": set(), "WITHDRAWN": set(), "PUBLISHED": set(),
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_issn(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9Xx]", "", value).upper()
    if len(digits) != 8:
        raise HTTPException(422, "Invalid ISSN")
    total = sum(int(ch) * (8 - i) for i, ch in enumerate(digits[:7]))
    check = (11 - total % 11) % 11
    expected = "X" if check == 10 else str(check)
    if digits[-1] != expected:
        raise HTTPException(422, "Invalid ISSN checksum")
    return f"{digits[:4]}-{digits[4:]}"


def article_sections(article_type: str) -> list[str]:
    if article_type not in ARTICLE_SECTIONS:
        raise HTTPException(422, "Unsupported article type")
    return ARTICLE_SECTIONS[article_type]


def create_version(db: Session, asset: models.ScholarlyAsset, article_type: str, user_id: str, summary: str | None, dependencies: list[dict[str, Any]]) -> models.PublicationManuscriptVersion:
    required = article_sections(article_type)
    for dep in dependencies:
        if dep.get("type") != "ANALYSIS":
            continue
        analysis = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id == dep.get("id"), models.ResearchAnalysis.organization_id == asset.organization_id).first()
        dataset = db.query(models.ResearchDataset).filter(models.ResearchDataset.id == analysis.dataset_id, models.ResearchDataset.organization_id == asset.organization_id).first() if analysis else None
        if not analysis or analysis.status != "COMPLETED" or not analysis.approved_at or not dataset or dataset.current_version_id != analysis.dataset_version_id:
            raise HTTPException(409, "Only current, completed, human-approved analyses may be used")
        dep.update({"version": analysis.created_at, "dataset_version_id": analysis.dataset_version_id, "approved_at": analysis.approved_at})
    latest = db.query(models.PublicationManuscriptVersion).filter(models.PublicationManuscriptVersion.asset_id == asset.id).order_by(models.PublicationManuscriptVersion.version_number.desc()).first()
    number = (latest.version_number + 1) if latest else 1
    created = now()
    fingerprint = hashlib.sha256(json.dumps({"asset": asset.id, "version": number, "article_type": article_type, "dependencies": dependencies}, sort_keys=True).encode()).hexdigest()
    version = models.PublicationManuscriptVersion(id=f"pmv-{asset.id}-{number}", organization_id=asset.organization_id, asset_id=asset.id, version_number=number, article_type=article_type, change_summary=summary, fingerprint=fingerprint, source_dependencies_json=dependencies, created_by=user_id, created_at=created)
    db.add(version)
    db.flush()
    for index, key in enumerate(required):
        db.add(models.PublicationManuscriptSection(id=f"pms-{version.id}-{index}", organization_id=asset.organization_id, manuscript_version_id=version.id, section_key=key, status="NOT_STARTED", content_json={}, dependencies_json=dependencies if key in {"METHODS", "RESULTS", "DISCUSSION"} else [], updated_at=created))
    asset.version_number = number
    asset.updated_at = created
    return version


def readiness(db: Session, version: models.PublicationManuscriptVersion) -> dict[str, Any]:
    sections = db.query(models.PublicationManuscriptSection).filter(models.PublicationManuscriptSection.manuscript_version_id == version.id).all()
    blocking = []
    ready = 0
    for section in sections:
        if section.status == "READY": ready += 1
        elif section.status != "NOT_REQUIRED": blocking.append({"code": "SECTION_NOT_READY", "section": section.section_key, "status": section.status})
    declarations = version.declarations_json or {}
    for key in ("conflict_of_interest", "funding", "ai_disclosure", "data_availability"):
        if not declarations.get(key): blocking.append({"code": "DECLARATION_MISSING", "field": key})
    score = round(100 * ready / len(sections)) if sections else 0
    return {"score": score, "status": "READY" if not blocking else "NOT_READY", "blocking": blocking, "sections": [{"key": s.section_key, "status": s.status, "stale_at": s.stale_at} for s in sections]}


def match_journal(manuscript: models.PublicationManuscriptVersion, journal: models.PublicationJournal, preferences: dict[str, Any]) -> dict[str, Any]:
    data = journal.metadata_json or {}
    accepted = data.get("article_types")
    languages = data.get("languages")
    if accepted is not None and manuscript.article_type not in accepted:
        return {"eligibility": "INELIGIBLE", "score": None, "factors": {"article_type": {"value": 0, "known": True}}, "concerns": ["ARTICLE_TYPE_NOT_ACCEPTED"]}
    requested_language = preferences.get("language")
    if requested_language and languages is not None and requested_language not in languages:
        return {"eligibility": "INELIGIBLE", "score": None, "factors": {"language": {"value": 0, "known": True}}, "concerns": ["LANGUAGE_NOT_ACCEPTED"]}
    raw = {
        "scope": data.get("scope_match"), "topic": data.get("topic_match"),
        "article_type": 100 if accepted is not None else None,
        "methodology": data.get("methodology_match"),
        "language": 100 if requested_language and languages is not None else None,
        "indexing": 100 if preferences.get("indexing") in (data.get("indexing") or []) else (None if data.get("indexing") is None else 0),
        "open_access": 100 if preferences.get("open_access") == data.get("open_access") else (None if data.get("open_access") is None else 50),
        "apc": None,
    }
    apc = data.get("apc")
    if preferences.get("apc_max") is not None and apc and all(k in apc for k in ("amount", "currency", "source", "retrieved_at")):
        raw["apc"] = 100 if apc["amount"] <= preferences["apc_max"] else 0
    weights = {"scope": .25, "topic": .20, "article_type": .15, "methodology": .10, "language": .05, "indexing": .10, "open_access": .075, "apc": .075}
    known_weight = sum(weights[k] for k, v in raw.items() if v is not None)
    score = round(sum(weights[k] * v for k, v in raw.items() if v is not None) / known_weight) if known_weight else None
    factors = {k: {"value": v, "known": v is not None, "weight": weights[k]} for k, v in raw.items()}
    concerns = [f"{k.upper()}_UNKNOWN" for k, v in raw.items() if v is None]
    return {"eligibility": "ELIGIBLE" if score is not None else "UNKNOWN", "score": score, "factors": factors, "concerns": concerns}


def transition_submission(item: models.PublicationSubmission, target: str) -> None:
    if target not in SUBMISSION_TRANSITIONS.get(item.status, set()):
        raise HTTPException(409, f"Invalid submission transition: {item.status} -> {target}")
    item.status = target
    item.updated_at = now()
    if target == "SUBMITTED" and not item.submitted_at:
        item.submitted_at = item.updated_at
