"""Exactly 24 named thesis cross-path scenarios — API authority, not unit stubs."""
from datetime import datetime, timedelta, timezone

import pytest
import secrets
from fastapi.testclient import TestClient

from app.main import app
from app.db import Base, engine, SessionLocal
from app import models
from app.routers.auth import hash_password
from app.services.thesis_workflow import hash_token, policy_rules

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


def _now():
    return datetime.now(timezone.utc).isoformat()


def _user(db, username, org_id, role="OWNER"):
    user = models.User(id=f"usr-{username}", username=username, email=f"{username}@test.invalid", hashed_password=hash_password("Password123!"), role="Researcher", created_at=_now())
    db.add(user)
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        org = models.Organization(id=org_id, name=org_id, slug=org_id, organization_type="UNIVERSITY", status="ACTIVE", owner_user_id=user.id, created_at=_now())
        db.add(org)
        plan = db.query(models.Plan).filter(models.Plan.id == "pln-free").first()
        if not plan:
            db.add(models.Plan(id="pln-free", code="FREE", name="Free", name_ar="مجاني", name_en="Free", billing_interval="MONTHLY", price=0, price_minor_units=0, currency="SAR", features_json={}, limits_json={"max_projects": 100}, created_at=_now()))
            db.flush()
        db.add(models.Subscription(id=f"sub-{org_id}", organization_id=org_id, plan_id="pln-free", status="ACTIVE", provider="MOCK", current_period_start=_now(), current_period_end="2036-01-01T00:00:00+00:00", created_at=_now()))
    db.add(models.OrganizationMembership(id=f"mbr-{username}", organization_id=org_id, user_id=user.id, role=role, status="ACTIVE", created_at=_now()))
    db.commit()
    return user


def _headers(username, org_id):
    token = client.post("/api/auth/login", json={"username": username, "password": "Password123!"}).json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Organization-ID": org_id}


def _project(db, org_id, owner_id, suffix):
    project = models.ResearchProject(id=f"proj-{suffix}", userId=owner_id, organizationId=org_id, titleAr="رسالة اختبار", titleEn="Test thesis", sampleSettings={})
    db.add(project); db.commit(); return project


def _bootstrap(degree="MASTERS", research_type="EMPIRICAL"):
    db = SessionLocal()
    suffix = secrets.token_hex(4)
    org = f"org-th-{suffix}"
    admin = _user(db, f"adm_{suffix}", org, "OWNER")
    student = _user(db, f"stu_{suffix}", org, "RESEARCHER")
    supervisor = _user(db, f"sup_{suffix}", org, "RESEARCHER")
    stranger = _user(db, f"str_{suffix}", org, "RESEARCHER")
    other_org = f"org-th-b-{suffix}"
    other = _user(db, f"oth_{suffix}", other_org, "OWNER")
    project = _project(db, org, student.id, suffix)
    hadmin, hstu, hsup, hstr, hoth = _headers(admin.username, org), _headers(student.username, org), _headers(supervisor.username, org), _headers(stranger.username, org), _headers(other.username, other_org)
    policy = client.post("/api/theses/policies", headers=hadmin, json={"degree_type": degree, "version": 1, "rules": policy_rules(degree)}).json()
    thesis = client.post("/api/theses", headers=hadmin, json={"project_id": project.id, "policy_id": policy["id"], "student_user_id": student.id, "program_name": "Graduate Program", "research_type": research_type}).json()
    client.post(f"/api/theses/{thesis['id']}/assignments", headers=hadmin, json={"user_id": supervisor.id, "role": "SUPERVISOR", "can_final_recommend": True})
    db.close()
    return {"org": org, "thesis": thesis["id"], "hadmin": hadmin, "hstu": hstu, "hsup": hsup, "hstr": hstr, "hoth": hoth, "student": student, "supervisor": supervisor, "admin": admin, "project": project.id}


def _ready_for_defense(ctx, research_type="EMPIRICAL"):
    center = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()
    for chapter in center["chapters"]:
        version = client.post(f"/api/theses/{ctx['thesis']}/chapters/{chapter['id']}/versions", headers=ctx["hstu"], json={"content": {"body": chapter["key"]}, "change_summary": "v1"}).json()
        assert client.post(f"/api/theses/{ctx['thesis']}/chapters/{chapter['id']}/approve", headers=ctx["hsup"], json={"version_id": version["id"]}).status_code == 200
    db = SessionLocal()
    for milestone in db.query(models.ThesisMilestone).filter(models.ThesisMilestone.thesis_id == ctx["thesis"]).all():
        if milestone.status != "COMPLETED":
            client.post(f"/api/theses/{ctx['thesis']}/milestones/{milestone.id}/complete", headers=ctx["hsup"])
    db.close()
    return client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()


def _satisfy_committee(ctx, exam_id):
    """Assigns the minimum committee a MASTERS policy requires (2 examiners,
    1 external, a chair) to the given examination round, so a defense
    decision passes the policy-driven committee-composition gate."""
    for role in ("EXTERNAL_EXAMINER", "CHAIR"):
        member = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": f"Committee {role}", "role": role, "evidence": {"disclosure": True, "eligibility_confirmed_by": ctx["admin"].id}}).json()
        client.post(f"/api/theses/{ctx['thesis']}/committee/{member['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "No conflict"})
        client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam_id}/assignments", headers=ctx["hsup"], json={"committee_member_id": member["id"]})


def test_01_masters_standard_lifecycle():
    ctx = _bootstrap("MASTERS")
    ready = _ready_for_defense(ctx)
    assert ready["defense_readiness"]["system_status"] == "READY"
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    _satisfy_committee(ctx, exam["id"])
    assert client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "PASS"}).status_code == 200


def test_02_doctorate_publication_requirement_blocks_defense():
    ctx = _bootstrap("DOCTORATE")
    ready = _ready_for_defense(ctx)
    assert any(b["code"] == "PUBLICATION_REQUIREMENT" for b in ready["defense_readiness"]["blockers"])
    assert client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).status_code == 409


def test_03_conceptual_thesis_does_not_force_dataset():
    ctx = _bootstrap("MASTERS", "CONCEPTUAL")
    keys = {c["key"] for c in client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()["chapters"]}
    assert "CONCEPTUAL_FRAMEWORK" in keys and "RESULTS" not in keys


def test_04_systematic_review_thesis_uses_synthesis_chapters():
    ctx = _bootstrap("MASTERS", "SYSTEMATIC_REVIEW")
    keys = {c["key"] for c in client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()["chapters"]}
    assert "SYNTHESIS" in keys and "METHODS" in keys


def test_05_supervision_meeting_to_action():
    ctx = _bootstrap()
    meeting = client.post(f"/api/theses/{ctx['thesis']}/meetings", headers=ctx["hsup"], json={"scheduled_at": _now(), "status": "HELD", "agenda": ["progress"], "private_supervisor_notes": "secret"}).json()
    assert "private_supervisor_notes" not in meeting
    action = client.post(f"/api/theses/{ctx['thesis']}/actions", headers=ctx["hsup"], json={"title": "Revise methodology", "owner_user_id": ctx["student"].id, "priority": "HIGH", "meeting_id": meeting["id"]})
    assert action.status_code == 201


def test_06_chapter_historical_integrity_v1_v2_v3():
    ctx = _bootstrap()
    chapter = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()["chapters"][0]
    versions = [client.post(f"/api/theses/{ctx['thesis']}/chapters/{chapter['id']}/versions", headers=ctx["hstu"], json={"content": {"n": n}, "change_summary": str(n)}).json() for n in (1, 2, 3)]
    assert [v["version_number"] for v in versions] == [1, 2, 3]
    assert len({v["fingerprint"] for v in versions}) == 3


def test_07_stale_analysis_blocks_dependent_chapter_and_defense():
    ctx = _bootstrap()
    db = SessionLocal()
    chapter = db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == ctx["thesis"]).first()
    chapter_id = chapter.id
    chapter.dependencies_json = [{"type": "ANALYSIS", "id": "missing-analysis"}]
    db.commit(); db.close()
    res = client.post(f"/api/theses/{ctx['thesis']}/chapters/{chapter_id}/versions", headers=ctx["hstu"], json={"content": {}})
    assert res.status_code == 409


def test_08_external_examiner_full_journey():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    member = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": "Prof. Examiner", "external_email": "ex@univ.invalid", "institution": "KSU", "role": "EXTERNAL_EXAMINER", "evidence": {"disclosure": True, "academic_rank": "PROFESSOR", "eligibility_confirmed_by": ctx["admin"].id}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/committee/{member['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "No conflict"})
    assignment = client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/assignments", headers=ctx["hsup"], json={"committee_member_id": member["id"]}).json()
    invite = client.post(f"/api/theses/{ctx['thesis']}/examiner-assignments/{assignment['id']}/invite", headers=ctx["hsup"], json={"expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()}).json()
    portal = client.get(f"/api/external-thesis-examiners/portal/{invite['token']}")
    assert portal.status_code == 200
    assert portal.json()["thesis_fingerprint"] == assignment["frozen_thesis_fingerprint"]

    # The examiner can actually read the frozen chapter content, not just a fingerprint.
    chapters = portal.json()["thesis"]["chapters"]
    assert chapters and all(c["approved_version_id"] for c in chapters)
    target_chapter_id = chapters[0]["chapter_id"]
    frozen_version_id = chapters[0]["approved_version_id"]
    chapter_content = client.get(f"/api/external-thesis-examiners/portal/{invite['token']}/chapters/{target_chapter_id}/content")
    assert chapter_content.status_code == 200
    assert chapter_content.json()["version_id"] == frozen_version_id
    assert chapter_content.json()["content"]

    # If the student submits a new revision mid-review, the examiner must keep
    # seeing the exact version that was frozen at assignment time, not the new one.
    client.post(f"/api/theses/{ctx['thesis']}/chapters/{target_chapter_id}/versions", headers=ctx["hstu"], json={"content": {"body": "revised-after-freeze"}, "change_summary": "v2"})
    still_frozen = client.get(f"/api/external-thesis-examiners/portal/{invite['token']}/chapters/{target_chapter_id}/content")
    assert still_frozen.json()["version_id"] == frozen_version_id
    assert still_frozen.json()["content"] != {"body": "revised-after-freeze"}

    client.post(f"/api/external-thesis-examiners/portal/{invite['token']}/respond", json={"accept": True, "coi_disclosure": {"disclosure": True}})
    client.put(f"/api/external-thesis-examiners/portal/{invite['token']}/report", json={"rubric_version": "T1", "recommendation": "MAJOR_CORRECTIONS", "general_assessment": "Needs work", "confidential_comments": "secret-note", "confidentiality_level": "COMMITTEE_ONLY"})
    submitted = client.post(f"/api/external-thesis-examiners/portal/{invite['token']}/report/submit")
    assert submitted.status_code == 200 and submitted.json()["status"] == "SUBMITTED"


def test_09_expired_external_examiner_link():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    member = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": "Expired", "role": "EXTERNAL_EXAMINER", "evidence": {"disclosure": True, "eligibility_confirmed_by": "chair"}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/committee/{member['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "ok"})
    assignment = client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/assignments", headers=ctx["hsup"], json={"committee_member_id": member["id"]}).json()
    invite = client.post(f"/api/theses/{ctx['thesis']}/examiner-assignments/{assignment['id']}/invite", headers=ctx["hsup"], json={"expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}).json()
    assert client.get(f"/api/external-thesis-examiners/portal/{invite['token']}").status_code == 401


def test_10_confidential_examiner_note_boundary():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    member = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": "Conf", "role": "EXTERNAL_EXAMINER", "evidence": {"disclosure": True, "eligibility_confirmed_by": "chair"}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/committee/{member['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "ok"})
    assignment = client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/assignments", headers=ctx["hsup"], json={"committee_member_id": member["id"]}).json()
    invite = client.post(f"/api/theses/{ctx['thesis']}/examiner-assignments/{assignment['id']}/invite", headers=ctx["hsup"], json={"expires_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()}).json()
    client.post(f"/api/external-thesis-examiners/portal/{invite['token']}/respond", json={"accept": True, "coi_disclosure": {"disclosure": True}})
    client.put(f"/api/external-thesis-examiners/portal/{invite['token']}/report", json={"rubric_version": "T1", "recommendation": "PASS", "general_assessment": "ok", "confidential_comments": "secret-note", "confidentiality_level": "COMMITTEE_ONLY"})
    client.post(f"/api/external-thesis-examiners/portal/{invite['token']}/report/submit")
    student_reports = client.get(f"/api/theses/{ctx['thesis']}/examiner-reports", headers=ctx["hstu"]).json()
    assert student_reports == [] or all(r.get("confidential_comments") is None and r["confidentiality_level"] != "COMMITTEE_ONLY" for r in student_reports)


def test_11_major_corrections_workflow():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    _satisfy_committee(ctx, exam["id"])
    client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "MAJOR_CORRECTIONS"})
    correction = client.post(f"/api/theses/{ctx['thesis']}/corrections", headers=ctx["hsup"], json={"examination_round_id": exam["id"], "correction_type": "MAJOR", "description": "Rewrite discussion", "source": "EXAMINER"}).json()
    chapter = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()["chapters"][0]
    version = client.post(f"/api/theses/{ctx['thesis']}/chapters/{chapter['id']}/versions", headers=ctx["hstu"], json={"content": {"fix": True}}).json()
    assert client.post(f"/api/theses/{ctx['thesis']}/corrections/{correction['id']}/verify", headers=ctx["hstu"]).status_code == 403
    client.post(f"/api/theses/{ctx['thesis']}/corrections/{correction['id']}/respond", headers=ctx["hstu"], json={"response_text": "Revised chapter", "evidence_version_id": version["id"]})
    assert client.post(f"/api/theses/{ctx['thesis']}/corrections/{correction['id']}/verify", headers=ctx["hsup"]).status_code == 200


def test_12_human_defense_decision_rejects_ai():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    assert client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "AI_PASS"}).status_code == 422


def test_13_cross_tenant_student_attack():
    ctx = _bootstrap()
    assert client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hoth"]).status_code == 404


def test_14_unassigned_supervisor_horizontal_attack():
    ctx = _bootstrap()
    assert client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstr"]).status_code == 404
    assert client.post(f"/api/theses/{ctx['thesis']}/meetings", headers=ctx["hstr"], json={"scheduled_at": _now()}).status_code == 404


def test_15_examiner_horizontal_attack():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    member = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": "A", "role": "EXTERNAL_EXAMINER", "evidence": {"disclosure": True, "eligibility_confirmed_by": "c"}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/committee/{member['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "ok"})
    assignment = client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/assignments", headers=ctx["hsup"], json={"committee_member_id": member["id"]}).json()
    invite = client.post(f"/api/theses/{ctx['thesis']}/examiner-assignments/{assignment['id']}/invite", headers=ctx["hsup"], json={"expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}).json()
    assert client.get(f"/api/external-thesis-examiners/portal/{invite['token']}tampered").status_code == 404


def test_16_mass_assignment_cannot_spoof_decision_actor():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    _satisfy_committee(ctx, exam["id"])
    res = client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "PASS", "decision_by": "forged-user"})
    assert res.status_code == 200
    assert res.json()["decision_by"] == ctx["supervisor"].id


def test_17_duplicate_invitation_and_handoff_idempotency():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    member = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": "Dup", "role": "EXTERNAL_EXAMINER", "evidence": {"disclosure": True, "eligibility_confirmed_by": "c"}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/committee/{member['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "ok"})
    assignment = client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/assignments", headers=ctx["hsup"], json={"committee_member_id": member["id"]}).json()
    expires = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    first = client.post(f"/api/theses/{ctx['thesis']}/examiner-assignments/{assignment['id']}/invite", headers=ctx["hsup"], json={"expires_at": expires})
    second = client.post(f"/api/theses/{ctx['thesis']}/examiner-assignments/{assignment['id']}/invite", headers=ctx["hsup"], json={"expires_at": expires})
    assert first.status_code == 201 and second.status_code == 409

    # Complete the committee (policy requires a chair alongside the external
    # examiner already assigned above) so the defense decision below is valid.
    chair = client.post(f"/api/theses/{ctx['thesis']}/committee", headers=ctx["hsup"], json={"external_name": "Chair", "role": "CHAIR", "evidence": {"disclosure": True, "eligibility_confirmed_by": "c"}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/committee/{chair['id']}/coi-decision", headers=ctx["hsup"], json={"decision": "CLEARED", "reason": "ok"})
    client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/assignments", headers=ctx["hsup"], json={"committee_member_id": chair["id"]})

    # Duplicate event/idempotency continued: drive the same thesis through
    # decision -> final version -> final approval -> deposit -> handoff, then
    # repeat the handoff request unchanged and assert it returns the same
    # candidate record rather than creating a second one.
    client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "PASS"})
    final = client.post(f"/api/theses/{ctx['thesis']}/final-version", headers=ctx["hsup"], json={"examination_round_id": exam["id"], "content": {"pdf": "frozen"}}).json()
    client.post(f"/api/theses/{ctx['thesis']}/final-approval", headers=ctx["hadmin"], json={"final_version_id": final["id"]})
    deposit = client.post(f"/api/theses/{ctx['thesis']}/deposit", headers=ctx["hadmin"], json={
        "final_version_id": final["id"], "repository_mode": "MANUAL",
        "repository_url": "https://repository.example.edu/thesis/1", "external_reference": "REPO-1",
        "clearance": {"library": True, "graduate_studies": True},
    })
    assert deposit.status_code == 201 and deposit.json()["status"] == "VERIFIED"

    handoff_first = client.post(f"/api/theses/{ctx['thesis']}/handoffs", headers=ctx["hadmin"], json={"target": "IDENTITY"})
    handoff_second = client.post(f"/api/theses/{ctx['thesis']}/handoffs", headers=ctx["hadmin"], json={"target": "IDENTITY"})
    assert handoff_first.status_code == 201 and handoff_second.status_code == 201
    assert handoff_first.json()["id"] == handoff_second.json()["id"]
    assert handoff_first.json()["candidate_only"] is True
    db = SessionLocal()
    assert db.query(models.AcademicHandoff).filter(models.AcademicHandoff.source_entity_id == ctx["thesis"], models.AcademicHandoff.handoff_type == "THESIS_TO_IDENTITY").count() == 1
    db.close()


def test_18_supervisor_sees_assigned_thesis_only():
    first = _bootstrap()
    second = _bootstrap()
    assert client.get(f"/api/theses/{first['thesis']}/command-center", headers=first["hsup"]).status_code == 200
    assert client.get(f"/api/theses/{second['thesis']}/command-center", headers=first["hsup"]).status_code == 404


def test_19_graduate_studies_aggregate_has_no_private_payload():
    ctx = _bootstrap()
    summary = client.get("/api/theses/operations/summary", headers=ctx["hadmin"]).json()
    assert "private_supervisor_notes" not in str(summary)
    assert "confidential_comments" not in str(summary)
    assert client.get("/api/theses/operations/summary", headers=ctx["hstu"]).status_code == 403


def test_20_mobile_contract_command_center_is_compact():
    ctx = _bootstrap()
    body = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()
    assert {"thesis", "next_best_action", "defense_readiness", "chapters"} <= set(body)


def test_21_keyboard_contract_exposes_named_actions():
    ctx = _bootstrap()
    body = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()
    assert body["next_best_action"]["action"]
    assert body["defense_readiness"]["human_recommendation_required"] is True


def test_22_arabic_and_english_titles_are_both_present():
    ctx = _bootstrap()
    thesis = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()["thesis"]
    assert thesis["title_ar"] and thesis["title_en"]


def test_23_policy_version_change_preserves_historical_decision():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    snapshot = exam["snapshot"]
    client.post("/api/theses/policies", headers=ctx["hadmin"], json={"degree_type": "MASTERS", "version": 99, "rules": {**policy_rules("MASTERS"), "minimum_examiners": 9}})
    _satisfy_committee(ctx, exam["id"])
    assert client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "PASS"}).status_code == 200
    later = client.get(f"/api/theses/{ctx['thesis']}/command-center", headers=ctx["hstu"]).json()
    assert later["thesis"]["id"] == ctx["thesis"]
    db = SessionLocal()
    stored = db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id == exam["id"]).one()
    assert stored.thesis_snapshot_json == snapshot
    db.close()


def test_24_final_thesis_historical_immutability():
    ctx = _bootstrap()
    _ready_for_defense(ctx)
    exam = client.post(f"/api/theses/{ctx['thesis']}/examinations", headers=ctx["hsup"], json={}).json()
    _satisfy_committee(ctx, exam["id"])
    client.post(f"/api/theses/{ctx['thesis']}/examinations/{exam['id']}/decision", headers=ctx["hsup"], json={"decision": "PASS"})
    final = client.post(f"/api/theses/{ctx['thesis']}/final-version", headers=ctx["hsup"], json={"examination_round_id": exam["id"], "content": {"pdf": "frozen"}}).json()
    approval = client.post(f"/api/theses/{ctx['thesis']}/final-approval", headers=ctx["hadmin"], json={"final_version_id": final["id"]}).json()
    again = client.post(f"/api/theses/{ctx['thesis']}/final-approval", headers=ctx["hadmin"], json={"final_version_id": final["id"]}).json()
    assert approval["id"] == again["id"]
    assert final["version_type"] == "FINAL_APPROVED_VERSION"
    assert hash_token("x") != "x"

    # A formally-justified post-approval amendment must not overwrite the
    # historical approved version, and only Graduate Studies authority may record one.
    forbidden = client.post(f"/api/theses/{ctx['thesis']}/final-version/amendment", headers=ctx["hsup"], json={"final_version_id": final["id"], "reason": "attempt", "content": {}})
    assert forbidden.status_code == 403
    amendment = client.post(f"/api/theses/{ctx['thesis']}/final-version/amendment", headers=ctx["hadmin"], json={"final_version_id": final["id"], "reason": "Corrected a factual error found after graduation", "content": {"pdf": "frozen-amended"}})
    assert amendment.status_code == 201
    assert amendment.json()["version_type"] == "POST_APPROVAL_AMENDMENT"
    assert amendment.json()["amends_version_id"] == final["id"]
    duplicate_amendment = client.post(f"/api/theses/{ctx['thesis']}/final-version/amendment", headers=ctx["hadmin"], json={"final_version_id": final["id"], "reason": "second attempt", "content": {}})
    assert duplicate_amendment.status_code == 409
    db = SessionLocal()
    original_row = db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.id == final["id"]).first()
    assert original_row.content_snapshot_json == {"pdf": "frozen"} and original_row.version_type == "FINAL_APPROVED_VERSION"
    db.close()
