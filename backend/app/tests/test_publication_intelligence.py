from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.publication_intelligence import canonical_issn, match_journal, transition_submission


def manuscript(article_type="ORIGINAL_RESEARCH"):
    return SimpleNamespace(article_type=article_type)


def journal(metadata):
    return SimpleNamespace(metadata_json=metadata)


def test_issn_canonicalization_and_checksum():
    assert canonical_issn("2049-3630") == "2049-3630"
    with pytest.raises(HTTPException):
        canonical_issn("2049-3631")


def test_article_type_is_hard_eligibility_gate():
    result = match_journal(manuscript("SYSTEMATIC_REVIEW"), journal({"article_types": ["ORIGINAL_RESEARCH"], "scope_match": 99}), {})
    assert result["eligibility"] == "INELIGIBLE"
    assert result["score"] is None


def test_unknown_metadata_is_not_scored_as_zero():
    result = match_journal(manuscript(), journal({"article_types": ["ORIGINAL_RESEARCH"], "scope_match": 80}), {})
    assert result["eligibility"] == "ELIGIBLE"
    assert result["score"] == 89  # normalized over known factors only
    assert result["factors"]["topic"]["known"] is False
    assert "TOPIC_UNKNOWN" in result["concerns"]


def test_apc_requires_source_currency_and_date():
    result = match_journal(manuscript(), journal({"article_types": ["ORIGINAL_RESEARCH"], "apc": {"amount": 900}}), {"apc_max": 1000})
    assert result["factors"]["apc"]["known"] is False


def test_language_is_hard_gate_when_verified():
    result = match_journal(manuscript(), journal({"article_types": ["ORIGINAL_RESEARCH"], "languages": ["en"]}), {"language": "ar"})
    assert result["eligibility"] == "INELIGIBLE"


def test_accepted_does_not_implicitly_publish():
    submission = SimpleNamespace(status="UNDER_REVIEW", updated_at=None, submitted_at="2026-01-01")
    transition_submission(submission, "ACCEPTED")
    assert submission.status == "ACCEPTED"
    with pytest.raises(HTTPException):
        transition_submission(SimpleNamespace(status="UNDER_REVIEW"), "PUBLISHED")


def test_submission_state_machine_rejects_invalid_transition():
    with pytest.raises(HTTPException):
        transition_submission(SimpleNamespace(status="PREPARING"), "SUBMITTED")
