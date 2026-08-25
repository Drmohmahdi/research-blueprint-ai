from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base
from app.services.thesis_workflow import complete_deposit, decide_examination, hash_token, issue_examiner_token, next_action, policy_rules, validate_examiner_token


@pytest.fixture
def thesis_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close(); engine.dispose()


def test_masters_and_doctorate_policies_are_distinct():
    masters = policy_rules("MASTERS")
    doctorate = policy_rules("DOCTORATE")
    assert masters["publication"]["required"] is False
    assert doctorate["publication"] == {"required": True, "minimum_accepted": 1}
    assert masters["minimum_examiners"] != doctorate["minimum_examiners"]


def test_optional_proposal_defense_is_policy_driven():
    assert policy_rules("MASTERS")["proposal_defense"] == "NOT_REQUIRED"
    assert policy_rules("DOCTORATE")["proposal_defense"] == "OPTIONAL"


def test_unsupported_degree_is_rejected():
    with pytest.raises(HTTPException):
        policy_rules("BACHELORS")


def test_defense_decision_is_human_attributed_and_immutable():
    round_ = SimpleNamespace(human_decision=None, decision_by=None, decision_at=None, status="SCHEDULED")
    decide_examination(round_, "MAJOR_CORRECTIONS", "committee-chair")
    assert round_.human_decision == "MAJOR_CORRECTIONS"
    assert round_.decision_by == "committee-chair"
    assert round_.status == "DECIDED"
    with pytest.raises(HTTPException):
        decide_examination(round_, "PASS", "someone-else")


def test_invalid_defense_decision_is_rejected():
    with pytest.raises(HTTPException):
        decide_examination(SimpleNamespace(human_decision=None), "AI_APPROVED", "ai")


def test_next_action_is_deterministic_and_blocker_first():
    action = next_action({"blockers": [{"code": "CHAPTER_SOURCE_STALE"}]}, overdue_actions=4)
    assert action == {"priority": "BLOCKING", "action": "CHAPTER_SOURCE_STALE", "reason": "Defense readiness hard gate"}


def test_human_recommendation_follows_system_readiness():
    action = next_action({"blockers": []}, overdue_actions=0)
    assert action["action"] == "REQUEST_SUPERVISOR_RECOMMENDATION"
    assert action["priority"] == "RECOMMENDED"


def test_examiner_magic_link_is_hash_only_and_scoped(thesis_db):
    assignment = models.ThesisExaminerAssignment(id="asg-1", organization_id="org", thesis_id="thesis", examination_round_id="round", committee_member_id="member", frozen_thesis_fingerprint="fp", frozen_thesis_snapshot_json={"title":"Frozen"}, status="APPROVED", eligibility_status="ELIGIBLE", coi_status="CLEARED", created_at="2026-01-01")
    thesis_db.add(assignment); thesis_db.flush()
    expires = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    token, raw = issue_examiner_token(thesis_db, assignment, expires); thesis_db.commit()
    assert raw not in token.token_hash
    assert token.token_hash == hash_token(raw)
    _, resolved = validate_examiner_token(thesis_db, raw)
    assert resolved.id == assignment.id
    assert resolved.frozen_thesis_snapshot_json == {"title":"Frozen"}
    with pytest.raises(HTTPException) as error:
        validate_examiner_token(thesis_db, raw + "tampered")
    assert error.value.status_code == 404


def test_expired_and_revoked_examiner_links_are_rejected(thesis_db):
    assignment = models.ThesisExaminerAssignment(id="asg-2", organization_id="org", thesis_id="thesis", examination_round_id="round", committee_member_id="member", frozen_thesis_fingerprint="fp", frozen_thesis_snapshot_json={}, status="APPROVED", eligibility_status="ELIGIBLE", coi_status="CLEARED", created_at="2026-01-01")
    thesis_db.add(assignment); thesis_db.flush()
    token, raw = issue_examiner_token(thesis_db, assignment, (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()); thesis_db.commit()
    with pytest.raises(HTTPException) as expired: validate_examiner_token(thesis_db, raw)
    assert expired.value.status_code == 401
    token.expires_at=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat(); token.revoked_at=datetime.now(timezone.utc).isoformat(); thesis_db.commit()
    with pytest.raises(HTTPException) as revoked: validate_examiner_token(thesis_db, raw)
    assert revoked.value.status_code == 401


def test_graduation_completion_requires_clearance_and_deposit_evidence():
    thesis=SimpleNamespace(status="ACTIVE",current_stage="FINAL_DEPOSIT",updated_at=None)
    deposit=SimpleNamespace(clearance_json={"library":True,"graduate_studies":False},repository_mode="MANUAL",external_reference="R",repository_url="https://example.invalid/r",status="PENDING",verified_by=None,verified_at=None)
    with pytest.raises(HTTPException): complete_deposit(thesis,deposit,"admin")
    deposit.clearance_json["graduate_studies"]=True; deposit.external_reference=None
    with pytest.raises(HTTPException): complete_deposit(thesis,deposit,"admin")
    deposit.external_reference="R"; complete_deposit(thesis,deposit,"admin")
    assert thesis.status=="COMPLETED" and deposit.status=="VERIFIED"
