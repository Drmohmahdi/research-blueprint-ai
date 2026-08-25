import hashlib
import json
import uuid
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models

STAGES = ["REGISTRATION", "SUPERVISOR_ASSIGNMENT", "PROPOSAL_DEVELOPMENT", "PROPOSAL_REVIEW", "PROPOSAL_APPROVAL", "RESEARCH_EXECUTION", "DATA_COLLECTION", "ANALYSIS", "THESIS_WRITING", "SUPERVISOR_REVIEW", "DEFENSE_READINESS", "COMMITTEE_FORMATION", "EXAMINATION", "DEFENSE", "CORRECTIONS", "FINAL_APPROVAL", "FINAL_DEPOSIT", "COMPLETED"]
CHAPTER_TEMPLATES = {
    "EMPIRICAL": ["INTRODUCTION", "LITERATURE_REVIEW", "METHODOLOGY", "RESULTS", "DISCUSSION", "CONCLUSION"],
    "SYSTEMATIC_REVIEW": ["INTRODUCTION", "LITERATURE_REVIEW", "METHODS", "SYNTHESIS", "DISCUSSION", "CONCLUSION"],
    "CONCEPTUAL": ["INTRODUCTION", "LITERATURE_REVIEW", "CONCEPTUAL_FRAMEWORK", "ARGUMENT", "DISCUSSION", "CONCLUSION"],
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def policy_rules(degree_type: str) -> dict[str, Any]:
    committee = {"required_external": 1, "chair_required": True, "correction_verification": {"MINOR": "SUPERVISOR", "MAJOR": "FINAL_SUPERVISOR", "BLOCKING": "FINAL_SUPERVISOR"}}
    if degree_type == "MASTERS":
        return {"required_milestones": ["PROPOSAL_APPROVAL", "CHAPTERS_APPROVED"], "proposal_defense": "NOT_REQUIRED", "publication": {"required": False}, "minimum_supervisors": 1, "minimum_examiners": 2, "committee": committee}
    if degree_type == "DOCTORATE":
        return {"required_milestones": ["PROPOSAL_APPROVAL", "CHAPTERS_APPROVED", "PUBLICATION_REQUIREMENT"], "proposal_defense": "OPTIONAL", "publication": {"required": True, "minimum_accepted": 1}, "minimum_supervisors": 1, "minimum_examiners": 3, "committee": {**committee, "required_external": 1}}
    raise HTTPException(422, "Unsupported degree type")


def create_thesis(db: Session, project: models.ResearchProject, policy: models.ThesisPolicy, student_id: str, program: str, creator_id: str, research_type: str) -> models.ThesisRecord:
    existing = db.query(models.ThesisRecord).filter(models.ThesisRecord.project_id == project.id).first()
    if existing: raise HTTPException(409, "Project already has a thesis")
    rules = json.loads(json.dumps(policy.rules_json))
    states = {stage: {"applicability": "REQUIRED", "status": "NOT_STARTED"} for stage in STAGES}
    if rules.get("proposal_defense") == "NOT_REQUIRED": states["PROPOSAL_REVIEW"]["applicability"] = "NOT_REQUIRED"
    created = now()
    thesis = models.ThesisRecord(id=f"thesis-{uuid.uuid4()}", organization_id=project.organizationId, project_id=project.id, student_user_id=student_id, policy_id=policy.id, policy_snapshot_json={"id": policy.id, "version": policy.version, "rules": rules}, degree_type=policy.degree_type, program_name=program, title_ar=project.titleAr, title_en=project.titleEn, current_stage="REGISTRATION", stage_states_json=states, created_by=creator_id, created_at=created, updated_at=created)
    db.add(thesis); db.flush()
    for index, key in enumerate(CHAPTER_TEMPLATES.get(research_type, CHAPTER_TEMPLATES["EMPIRICAL"])):
        db.add(models.ThesisChapter(id=f"chapter-{uuid.uuid4()}", organization_id=project.organizationId, thesis_id=thesis.id, chapter_key=key, title=key.replace("_", " ").title(), sort_order=index + 1, dependencies_json=[]))
    for code in rules.get("required_milestones", []):
        db.add(models.ThesisMilestone(id=f"milestone-{uuid.uuid4()}", organization_id=project.organizationId, thesis_id=thesis.id, code=code, title=code.replace("_", " ").title(), applicability="REQUIRED"))
    return thesis


def submit_chapter_version(db: Session, thesis: models.ThesisRecord, chapter: models.ThesisChapter, user_id: str, content: dict, file_id: str | None, summary: str | None) -> models.ThesisChapterVersion:
    chapter = db.query(models.ThesisChapter).filter(models.ThesisChapter.id == chapter.id, models.ThesisChapter.thesis_id == thesis.id).populate_existing().with_for_update().one()
    dependencies = chapter.dependencies_json or []
    for dep in dependencies:
        if dep.get("type") != "ANALYSIS": continue
        analysis = db.query(models.ResearchAnalysis).filter(models.ResearchAnalysis.id == dep.get("id"), models.ResearchAnalysis.organization_id == thesis.organization_id).first()
        dataset = db.query(models.ResearchDataset).filter(models.ResearchDataset.id == analysis.dataset_id).first() if analysis else None
        if not analysis or analysis.status != "COMPLETED" or not analysis.approved_at or not dataset or dataset.current_version_id != analysis.dataset_version_id:
            raise HTTPException(409, "A chapter cannot use a stale, incomplete, or unapproved analysis")
    number = chapter.current_version_number + 1
    fingerprint = hashlib.sha256(json.dumps({"chapter": chapter.id, "version": number, "content": content, "file": file_id, "dependencies": dependencies}, sort_keys=True).encode()).hexdigest()
    item = models.ThesisChapterVersion(id=f"chapter-version-{uuid.uuid4()}", organization_id=thesis.organization_id, chapter_id=chapter.id, version_number=number, file_id=file_id, content_snapshot_json=content, fingerprint=fingerprint, change_summary=summary, submitted_by=user_id, submitted_at=now())
    db.add(item); chapter.current_version_number = number; chapter.status = "SUBMITTED"; return item


def defense_readiness(db: Session, thesis: models.ThesisRecord) -> dict[str, Any]:
    blockers: list[dict[str, Any]] = []
    chapters = db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == thesis.id).all()
    for chapter in chapters:
        if chapter.status != "APPROVED": blockers.append({"code": "CHAPTER_NOT_APPROVED", "chapter_id": chapter.id, "status": chapter.status})
        if chapter.stale_at: blockers.append({"code": "CHAPTER_SOURCE_STALE", "chapter_id": chapter.id})
    feedback = db.query(models.ThesisFeedback).filter(models.ThesisFeedback.thesis_id == thesis.id, models.ThesisFeedback.severity == "BLOCKING", models.ThesisFeedback.resolution_status != "RESOLVED").count()
    if feedback: blockers.append({"code": "BLOCKING_FEEDBACK", "count": feedback})
    for milestone in db.query(models.ThesisMilestone).filter(models.ThesisMilestone.thesis_id == thesis.id, models.ThesisMilestone.applicability == "REQUIRED").all():
        if milestone.status != "COMPLETED": blockers.append({"code": "MILESTONE_INCOMPLETE", "milestone": milestone.code})
    rules = (thesis.policy_snapshot_json or {}).get("rules", {})
    pub = rules.get("publication", {})
    if pub.get("required"):
        assets = db.query(models.ScholarlyAsset).filter(models.ScholarlyAsset.organization_id == thesis.organization_id, models.ScholarlyAsset.source_record_id == thesis.project_id, models.ScholarlyAsset.lifecycle_status.in_(["ACCEPTED", "PUBLISHED"])).count()
        if assets < pub.get("minimum_accepted", 0): blockers.append({"code": "PUBLICATION_REQUIREMENT", "current": assets, "required": pub.get("minimum_accepted")})
    total = len(chapters) + 3
    score = max(0, round(100 * (total - min(total, len(blockers))) / total)) if total else 0
    return {"score": score, "system_status": "READY" if not blockers else "NOT_READY", "blockers": blockers, "human_recommendation_required": True}


def next_action(readiness: dict[str, Any], overdue_actions: int, corrections_due: int = 0, examiner_reports_due: int = 0) -> dict[str, Any]:
    if readiness["blockers"]:
        return {"priority": "BLOCKING", "action": readiness["blockers"][0]["code"], "reason": "Defense readiness hard gate"}
    if corrections_due:
        return {"priority": "HIGH", "action": "COMPLETE_CORRECTIONS", "reason": f"{corrections_due} required correction(s) remain open"}
    if examiner_reports_due:
        return {"priority": "HIGH", "action": "EXAMINER_REPORT_DUE", "reason": f"{examiner_reports_due} examiner report(s) outstanding"}
    if overdue_actions:
        return {"priority": "HIGH", "action": "COMPLETE_OVERDUE_ACTION", "reason": f"{overdue_actions} overdue action(s)"}
    return {"priority": "RECOMMENDED", "action": "REQUEST_SUPERVISOR_RECOMMENDATION", "reason": "System requirements are ready; human authority is required"}


def approve_chapter(chapter: models.ThesisChapter, version: models.ThesisChapterVersion) -> None:
    if version.chapter_id != chapter.id:
        raise HTTPException(404, "Chapter version not found")
    chapter.approved_version_id = version.id
    chapter.status = "APPROVED"
    chapter.stale_at = None


def correction_requires_final_authority(correction: models.ThesisCorrection, policy_snapshot: dict[str, Any]) -> bool:
    mapping = ((policy_snapshot or {}).get("rules") or {}).get("committee", {}).get("correction_verification") or {}
    authority = mapping.get(correction.correction_type, "FINAL_SUPERVISOR" if correction.correction_type in {"MAJOR", "BLOCKING"} else "SUPERVISOR")
    return authority == "FINAL_SUPERVISOR"


def committee_composition_gaps(db: Session, policy_snapshot: dict[str, Any], round_id: str) -> list[str]:
    """Policy-driven quorum check: minimum examiner count, required external
    examiner(s), and chair presence, evaluated against the round's currently
    active (non-declined/revoked/replaced) examiner assignments. Declared in
    policy_rules() but was never previously read anywhere."""
    rules = (policy_snapshot or {}).get("rules", {})
    committee_rules = rules.get("committee", {})
    assignments = db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.examination_round_id == round_id, models.ThesisExaminerAssignment.status.notin_(["DECLINED", "REVOKED", "REPLACED"])).all()
    member_ids = [a.committee_member_id for a in assignments]
    members = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.id.in_(member_ids)).all() if member_ids else []
    roles = [m.role for m in members]
    gaps: list[str] = []
    minimum_examiners = rules.get("minimum_examiners")
    if minimum_examiners and len(members) < minimum_examiners:
        gaps.append(f"MINIMUM_EXAMINERS_NOT_MET:{len(members)}/{minimum_examiners}")
    required_external = committee_rules.get("required_external")
    if required_external and sum(1 for r in roles if r == "EXTERNAL_EXAMINER") < required_external:
        gaps.append("REQUIRED_EXTERNAL_EXAMINER_MISSING")
    if committee_rules.get("chair_required") and "CHAIR" not in roles:
        gaps.append("CHAIR_NOT_ASSIGNED")
    return gaps


def decide_examination(round_: models.ThesisExaminationRound, decision: str, user_id: str) -> None:
    if round_.human_decision: raise HTTPException(409, "Examination decision is immutable")
    if decision not in {"PASS", "PASS_WITH_MINOR_CORRECTIONS", "MAJOR_CORRECTIONS", "REEXAMINATION", "FAIL"}: raise HTTPException(422, "Unsupported defense decision")
    round_.human_decision, round_.decision_by, round_.decision_at, round_.status = decision, user_id, now(), "DECIDED"


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_examiner_token(db: Session, assignment: models.ThesisExaminerAssignment, expires_at: str) -> tuple[models.ThesisExaminerToken, str]:
    assignment = db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.id == assignment.id).populate_existing().with_for_update().one()
    if assignment.status not in {"APPROVED", "INVITED"}: raise HTTPException(409, "Assignment must be approved before invitation")
    existing = db.query(models.ThesisExaminerToken).filter(models.ThesisExaminerToken.assignment_id == assignment.id, models.ThesisExaminerToken.revoked_at.is_(None)).first()
    if existing: raise HTTPException(409, "An active invitation already exists")
    raw = secrets.token_urlsafe(48)
    item = models.ThesisExaminerToken(id=f"thesis-token-{uuid.uuid4()}", assignment_id=assignment.id, token_hash=hash_token(raw), expires_at=expires_at, created_at=now())
    assignment.status = "INVITED"; db.add(item); return item, raw


def validate_examiner_token(db: Session, raw: str) -> tuple[models.ThesisExaminerToken, models.ThesisExaminerAssignment]:
    token = db.query(models.ThesisExaminerToken).filter(models.ThesisExaminerToken.token_hash == hash_token(raw)).first()
    if not token: raise HTTPException(404, "Invalid examiner invitation")
    if token.revoked_at: raise HTTPException(401, "Examiner invitation has been revoked")
    if token.expires_at < now(): raise HTTPException(401, "Examiner invitation has expired")
    assignment = db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.id == token.assignment_id).first()
    if not assignment or assignment.status in {"DECLINED", "REVOKED", "REPLACED"}: raise HTTPException(403, "Examiner assignment is not active")
    return token, assignment


def committee_eligibility(member: models.ThesisCommitteeMember, policy_snapshot: dict[str, Any]) -> dict[str, Any]:
    rules = (policy_snapshot or {}).get("rules", {}).get("committee", {})
    evidence = []
    observed_rank = (member.coi_json or {}).get("academic_rank")
    required_rank = rules.get("minimum_academic_rank")
    if required_rank:
        result = "NEEDS_VERIFICATION" if not observed_rank else ("ELIGIBLE" if observed_rank in rules.get("accepted_ranks", [required_rank]) else "INELIGIBLE")
        evidence.append({"rule": "minimum_academic_rank", "required": required_rank, "observed": observed_rank, "result": result})
    if not (member.coi_json or {}).get("disclosure"):
        evidence.append({"rule": "coi_disclosure", "required": True, "observed": False, "result": "NEEDS_VERIFICATION"})
    states = [e["result"] for e in evidence]
    human_verified = bool((member.coi_json or {}).get("eligibility_confirmed_by"))
    status = "INELIGIBLE" if "INELIGIBLE" in states else ("ELIGIBLE" if human_verified and "NEEDS_VERIFICATION" not in states else "NEEDS_VERIFICATION")
    return {"status": status, "evidence": evidence}


def freeze_final_version(db: Session, thesis: models.ThesisRecord, round_: models.ThesisExaminationRound, user_id: str, content: dict[str, Any], file_id: str | None) -> models.ThesisFinalVersion:
    db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis.id).with_for_update().one()
    existing = db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.thesis_id == thesis.id, models.ThesisFinalVersion.version_type == "FINAL_APPROVED_VERSION").first()
    if existing: raise HTTPException(409, "A FINAL_APPROVED_VERSION already exists; use POST_APPROVAL_AMENDMENT")
    if not round_.human_decision or round_.human_decision in {"FAIL", "REEXAMINATION"}: raise HTTPException(409, "A passing human defense decision is required")
    open_required = db.query(models.ThesisCorrection).filter(models.ThesisCorrection.thesis_id == thesis.id, models.ThesisCorrection.status != "VERIFIED").all()
    still_open = [c for c in open_required if (c.details_json or {}).get("required", True)]
    if still_open: raise HTTPException(409, "Required corrections remain unresolved")
    fingerprint = hashlib.sha256(json.dumps({"thesis": thesis.id, "round": round_.id, "content": content, "file": file_id}, sort_keys=True).encode()).hexdigest()
    corrections = db.query(models.ThesisCorrection).filter(models.ThesisCorrection.thesis_id == thesis.id).all()
    item = models.ThesisFinalVersion(id=f"thesis-final-{uuid.uuid4()}", organization_id=thesis.organization_id, thesis_id=thesis.id, examination_round_id=round_.id, file_id=file_id, content_snapshot_json=content, fingerprint=fingerprint, policy_snapshot_json=thesis.policy_snapshot_json, corrections_snapshot_json=[{"id": c.id, "status": c.status, "verified_by": c.verified_by, "verified_at": c.verified_at} for c in corrections], frozen_by=user_id, frozen_at=now())
    db.add(item); db.flush(); thesis.final_version_id = item.id; thesis.current_stage = "FINAL_APPROVAL"; thesis.updated_at = now(); return item


def create_post_approval_amendment(db: Session, thesis: models.ThesisRecord, original: models.ThesisFinalVersion, user_id: str, content: dict[str, Any], file_id: str | None, reason: str) -> models.ThesisFinalVersion:
    """
    Records a formally-justified correction to an already-approved thesis
    without touching the historical FINAL_APPROVED_VERSION row — that row
    stays exactly as it was frozen and approved. Kept to a single amendment
    per thesis to match the (thesis_id, version_type) uniqueness this table
    already enforces; a thesis needing more than one would be an
    exceptionally unusual case handled operationally rather than in-app.
    """
    db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis.id).with_for_update().one()
    if original.version_type != "FINAL_APPROVED_VERSION":
        raise HTTPException(409, "Amendments may only be recorded against the approved final version")
    existing = db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.thesis_id == thesis.id, models.ThesisFinalVersion.version_type == "POST_APPROVAL_AMENDMENT").first()
    if existing: raise HTTPException(409, "A POST_APPROVAL_AMENDMENT already exists for this thesis")
    fingerprint = hashlib.sha256(json.dumps({"thesis": thesis.id, "amends": original.id, "content": content, "file": file_id}, sort_keys=True).encode()).hexdigest()
    payload = {**content, "_amendment": {"amends_version_id": original.id, "reason": reason}}
    item = models.ThesisFinalVersion(id=f"thesis-amendment-{uuid.uuid4()}", organization_id=thesis.organization_id, thesis_id=thesis.id, examination_round_id=original.examination_round_id, file_id=file_id, content_snapshot_json=payload, fingerprint=fingerprint, version_type="POST_APPROVAL_AMENDMENT", policy_snapshot_json=original.policy_snapshot_json, corrections_snapshot_json=original.corrections_snapshot_json, frozen_by=user_id, frozen_at=now())
    db.add(item); return item


def approve_final(db: Session, thesis: models.ThesisRecord, final: models.ThesisFinalVersion, user_id: str, rationale: str | None) -> models.ThesisFinalApproval:
    db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis.id).with_for_update().one()
    existing = db.query(models.ThesisFinalApproval).filter(models.ThesisFinalApproval.thesis_id == thesis.id).first()
    if existing: return existing
    item = models.ThesisFinalApproval(id=f"thesis-approval-{uuid.uuid4()}", organization_id=thesis.organization_id, thesis_id=thesis.id, final_version_id=final.id, approved_by=user_id, approved_at=now(), rationale=rationale)
    db.add(item); thesis.current_stage = "FINAL_DEPOSIT"; thesis.updated_at = now(); return item


def complete_deposit(thesis: models.ThesisRecord, deposit: models.ThesisDeposit, user_id: str) -> None:
    clearance = deposit.clearance_json or {}
    if not clearance.get("library") or not clearance.get("graduate_studies"): raise HTTPException(409, "Graduation clearance is incomplete")
    if deposit.repository_mode == "MANUAL" and (not deposit.external_reference or not deposit.repository_url): raise HTTPException(409, "Verified external deposit evidence is required")
    deposit.status, deposit.verified_by, deposit.verified_at = "VERIFIED", user_id, now()
    thesis.status, thesis.current_stage, thesis.updated_at = "COMPLETED", "COMPLETED", now()
