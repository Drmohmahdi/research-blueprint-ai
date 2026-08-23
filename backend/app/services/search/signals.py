"""
Phase 09 — Automatic search_text synchronization.

Registers SQLAlchemy `before_insert` / `before_update` listeners that keep the
normalized `search_text` column in sync whenever a searchable domain record is
created or updated. This guarantees that title/metadata edits are reflected in
Unified Search (no stale search columns).
"""
import json
from sqlalchemy import event
from ... import models
from .normalization import normalize_search_text

# model -> ordered list of attribute names used to build search_text
_SEARCH_FIELD_MAP = {
    models.ResearchProject: [
        "titleAr", "titleEn", "descriptionAr", "descriptionEn",
        "problemStatementAr", "problemStatementEn", "objectives", "studyDesign",
    ],
    models.LiteratureStudy: [
        "author", "source", "doi", "notes", "year",
    ],
    models.ScholarlyAsset: [
        "title_ar", "title_en", "abstract_ar", "abstract_en", "doi",
        "journal_name", "publisher", "primary_discipline", "asset_type",
    ],
    models.UnifiedAcademicProfile: [
        "preferred_name_ar", "preferred_name_en", "academic_title",
        "current_rank", "university", "college", "department",
        "general_specialization", "research_interests_json",
    ],
    models.PromotionApplication: [
        "target_rank", "current_rank", "status",
    ],
    models.PeerReviewCase: [
        "title_ar", "title_en", "abstract_ar", "abstract_en",
        "discipline", "case_type", "status",
    ],
    models.UploadedFile: [
        "filename", "mime_type", "classification",
    ],
}


def _coerce(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        try:
            return " ".join(str(v) for v in (value.values() if isinstance(value, dict) else value))
        except Exception:
            return json.dumps(value, ensure_ascii=False)
    return str(value)


def _build_search_text(model, fields):
    parts = []
    for attr in fields:
        try:
            val = getattr(model, attr, None)
        except Exception:
            val = None
        if val is None:
            continue
        text = _coerce(val)
        if text:
            parts.append(text)
    return normalize_search_text(" ".join(parts))


def _make_listener(fields):
    def _listener(mapper, connection, target):
        target.search_text = _build_search_text(target, fields)
    return _listener


_registered = False


def register_search_signals() -> None:
    global _registered
    if _registered:
        return
    for model, fields in _SEARCH_FIELD_MAP.items():
        listener = _make_listener(fields)
        event.listen(model, "before_insert", listener)
        event.listen(model, "before_update", listener)
    _registered = True
