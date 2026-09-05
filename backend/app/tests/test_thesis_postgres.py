import os
import socket
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app import models
from app.services.thesis_workflow import approve_final, decide_examination, freeze_final_version, issue_examiner_token, submit_chapter_version


def _normalize(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)


def _wait_port(host: str, port: int, timeout: float = 40) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), 1):
                return
        except OSError:
            time.sleep(0.5)
    raise RuntimeError(f"PostgreSQL did not accept connections on {host}:{port}")


def _local_postgres_url() -> str:
    bin_dir = Path(r"C:\Program Files\PostgreSQL\16\bin")
    pg_ctl = bin_dir / "pg_ctl.exe"
    initdb = bin_dir / "initdb.exe"
    bin_dir / "createdb.exe"
    if not pg_ctl.exists():
        raise FileNotFoundError("PostgreSQL 16 pg_ctl was not found")
    root = Path(os.environ.get("TEMP", ".")) / "baseerah-thesis-pg"
    if not (root / "PG_VERSION").exists():
        subprocess.check_call([str(initdb), "-D", str(root), "-U", "thesis", "--auth=trust", "--locale=C", "--encoding=UTF8"])
    status = subprocess.run([str(pg_ctl), "-D", str(root), "status"], capture_output=True, text=True)
    if status.returncode != 0:
        subprocess.check_call([str(pg_ctl), "-D", str(root), "-l", str(root / "logfile"), "-o", "-p 55432", "start"])
    _wait_port("127.0.0.1", 55432)
    url = "postgresql+psycopg2://thesis:thesis@127.0.0.1:55432/thesis_test"
    try:
        probe = create_engine(url)
        with probe.connect() as connection:
            connection.execute(text("SELECT 1"))
        probe.dispose()
        return url
    except Exception:
        pass
    admin = create_engine(url.rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        exists = connection.execute(text("SELECT 1 FROM pg_database WHERE datname='thesis_test'")).scalar()
        if not exists:
            connection.execute(text("CREATE DATABASE thesis_test"))
    admin.dispose()
    return url


def _docker_postgres_url() -> str:
    name = "baseerah-thesis-pg-test"
    inspect = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", name], capture_output=True, text=True)
    if inspect.returncode != 0:
        subprocess.check_call([
            "docker", "run", "-d", "--name", name,
            "-e", "POSTGRES_PASSWORD=thesis", "-e", "POSTGRES_USER=thesis", "-e", "POSTGRES_DB=thesis_test",
            "-p", "55432:5432", "postgres:16-alpine",
        ])
    elif inspect.stdout.strip() != "true":
        subprocess.check_call(["docker", "start", name])
    _wait_port("127.0.0.1", 55432)
    url = "postgresql+psycopg2://thesis:thesis@127.0.0.1:55432/thesis_test"
    engine = create_engine(url)
    for _ in range(40):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            engine.dispose()
            return url
        except Exception:
            time.sleep(0.5)
    engine.dispose()
    raise RuntimeError("PostgreSQL container started but the database was not ready")


def _resolve_url() -> str:
    env = os.getenv("POSTGRES_THESIS_TEST_URL")
    if env:
        return _normalize(env)
    errors = []
    for factory in (_local_postgres_url, _docker_postgres_url):
        try:
            return factory()
        except Exception as error:
            errors.append(f"{factory.__name__}: {error}")
    pytest.fail("Thesis PostgreSQL critical suite requires a live PostgreSQL instance: " + " | ".join(errors))


@pytest.fixture(scope="module")
def pg_url():
    return _resolve_url()


@pytest.fixture(scope="module")
def pg_domain(pg_url):
    suffix = uuid.uuid4().hex[:8]
    engine = create_engine(pg_url, pool_size=8, max_overflow=4)
    from app.db import Base
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    db = Session()
    now = "2026-08-25T00:00:00+00:00"
    user = models.User(id=f"pg-user-{suffix}", username=f"pg_user_{suffix}", hashed_password="x", email=f"{suffix}@example.invalid", role="Supervisor", created_at=now)
    org = models.Organization(id=f"pg-org-{suffix}", name="PG Thesis", slug=f"pg-thesis-{suffix}", organization_type="UNIVERSITY", status="ACTIVE", owner_user_id=user.id, created_at=now)
    project = models.ResearchProject(id=f"pg-project-{suffix}", userId=user.id, organizationId=org.id, titleAr="رسالة", titleEn="Thesis", sampleSettings={})
    policy = models.ThesisPolicy(id=f"pg-policy-{suffix}", organization_id=org.id, degree_type="DOCTORATE", version=1, status="ACTIVE", rules_json={}, created_by=user.id, created_at=now)
    thesis = models.ThesisRecord(id=f"pg-thesis-{suffix}", organization_id=org.id, project_id=project.id, student_user_id=user.id, policy_id=policy.id, policy_snapshot_json={"rules": {}}, degree_type="DOCTORATE", program_name="Program", title_ar="رسالة", title_en="Thesis", title_history_json=[], current_stage="DEFENSE", stage_states_json={}, status="ACTIVE", created_by=user.id, created_at=now, updated_at=now)
    chapter = models.ThesisChapter(id=f"pg-chapter-{suffix}", organization_id=org.id, thesis_id=thesis.id, chapter_key="RESULTS", title="Results", sort_order=1, status="DRAFT", current_version_number=0, dependencies_json=[])
    round_ = models.ThesisExaminationRound(id=f"pg-round-{suffix}", organization_id=org.id, thesis_id=thesis.id, round_number=1, thesis_snapshot_json={"version": "frozen"}, policy_snapshot_json={}, status="SCHEDULED", created_at=now)
    final = models.ThesisFinalVersion(id=f"pg-final-{suffix}", organization_id=org.id, thesis_id=thesis.id, examination_round_id=round_.id, content_snapshot_json={}, fingerprint="final-fp", policy_snapshot_json={}, corrections_snapshot_json=[], frozen_by=user.id, frozen_at=now)
    db.add(user); db.flush()
    db.add(org); db.flush()
    db.add_all([project, policy]); db.flush()
    db.add(thesis); db.flush()
    db.add_all([chapter, round_]); db.flush()
    db.add(final); db.commit(); db.close()
    yield {"Session": Session, "engine": engine, "thesis": thesis.id, "chapter": chapter.id, "round": round_.id, "final": final.id, "user": user.id, "org": org.id, "project": project.id, "suffix": suffix}
    db = Session()
    db.query(models.ThesisFinalApproval).filter(models.ThesisFinalApproval.thesis_id == thesis.id).delete()
    db.query(models.ThesisCorrection).filter(models.ThesisCorrection.thesis_id == thesis.id).delete()
    db.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.thesis_id == thesis.id).delete()
    db.query(models.ThesisExaminerAssignment).filter(models.ThesisExaminerAssignment.thesis_id == thesis.id).delete()
    db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == thesis.id).delete()
    db.query(models.ThesisFinalVersion).filter(models.ThesisFinalVersion.thesis_id == thesis.id).delete()
    db.query(models.ThesisChapterVersion).filter(models.ThesisChapterVersion.chapter_id == chapter.id).delete()
    db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.thesis_id == thesis.id).delete()
    db.query(models.ThesisChapter).filter(models.ThesisChapter.thesis_id == thesis.id).delete()
    db.query(models.ThesisRecord).filter(models.ThesisRecord.id == thesis.id).delete()
    db.query(models.ThesisPolicy).filter(models.ThesisPolicy.id == policy.id).delete()
    db.query(models.ResearchProject).filter(models.ResearchProject.id == project.id).delete()
    db.query(models.Organization).filter(models.Organization.id == org.id).delete()
    db.query(models.User).filter(models.User.id == user.id).delete()
    db.commit(); db.close(); engine.dispose()


def test_postgres_chapter_version_allocation_is_serialized(pg_domain):
    barrier = threading.Barrier(2)
    def work(n):
        db = pg_domain["Session"](); thesis = db.get(models.ThesisRecord, pg_domain["thesis"]); chapter = db.get(models.ThesisChapter, pg_domain["chapter"]); barrier.wait(); item = submit_chapter_version(db, thesis, chapter, pg_domain["user"], {"run": n}, None, None); db.commit(); number = item.version_number; db.close(); return number
    with ThreadPoolExecutor(max_workers=2) as pool:
        numbers = sorted(f.result() for f in [pool.submit(work, 1), pool.submit(work, 2)])
    assert numbers == [1, 2]


def test_postgres_defense_decision_has_one_authority(pg_domain):
    barrier = threading.Barrier(2)
    def work(decision):
        db = pg_domain["Session"](); barrier.wait(); row = db.query(models.ThesisExaminationRound).filter(models.ThesisExaminationRound.id == pg_domain["round"]).with_for_update().one()
        try:
            decide_examination(row, decision, pg_domain["user"]); db.commit(); result = "won"
        except HTTPException:
            db.rollback(); result = "rejected"
        db.close(); return result
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(f.result() for f in [pool.submit(work, "PASS"), pool.submit(work, "FAIL")])
    assert results == ["rejected", "won"]


def test_postgres_final_approval_is_idempotent_under_race(pg_domain):
    barrier = threading.Barrier(2)
    def work():
        db = pg_domain["Session"](); thesis = db.get(models.ThesisRecord, pg_domain["thesis"]); final = db.get(models.ThesisFinalVersion, pg_domain["final"]); barrier.wait(); item = approve_final(db, thesis, final, pg_domain["user"], None); db.commit(); result = item.id; db.close(); return result
    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = [f.result() for f in [pool.submit(work), pool.submit(work)]]
    assert ids[0] == ids[1]
    db = pg_domain["Session"](); assert db.query(models.ThesisFinalApproval).filter(models.ThesisFinalApproval.thesis_id == pg_domain["thesis"]).count() == 1; db.close()


def test_postgres_committee_seat_is_not_duplicated(pg_domain):
    barrier = threading.Barrier(2)
    def work(n):
        db = pg_domain["Session"](); barrier.wait()
        db.query(models.ThesisRecord).filter(models.ThesisRecord.id == pg_domain["thesis"]).with_for_update().one()
        duplicate = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == pg_domain["thesis"], models.ThesisCommitteeMember.role == "EXTERNAL_EXAMINER", models.ThesisCommitteeMember.appointment_status != "REPLACED").first()
        if duplicate:
            db.rollback(); db.close(); return "rejected"
        db.add(models.ThesisCommitteeMember(id=f"pg-member-{pg_domain['suffix']}-{n}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], external_name="Examiner", role="EXTERNAL_EXAMINER", eligibility_status="ELIGIBLE"))
        db.commit(); db.close(); return "won"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(f.result() for f in [pool.submit(work, 1), pool.submit(work, 2)])
    assert results == ["rejected", "won"]
    db = pg_domain["Session"](); assert db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == pg_domain["thesis"], models.ThesisCommitteeMember.role == "EXTERNAL_EXAMINER").count() == 1; db.close()


def test_postgres_examiner_report_finalization_is_single(pg_domain):
    db = pg_domain["Session"]()
    member = db.query(models.ThesisCommitteeMember).filter(models.ThesisCommitteeMember.thesis_id == pg_domain["thesis"]).first()
    if not member:
        member = models.ThesisCommitteeMember(id=f"pg-member-report-{pg_domain['suffix']}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], external_name="Report", role="INTERNAL_EXAMINER", eligibility_status="ELIGIBLE")
        db.add(member); db.flush()
    assignment = models.ThesisExaminerAssignment(id=f"pg-asg-{pg_domain['suffix']}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], examination_round_id=pg_domain["round"], committee_member_id=member.id, frozen_thesis_fingerprint="fp", frozen_thesis_snapshot_json={}, status="ACCEPTED", eligibility_status="ELIGIBLE", coi_status="CLEARED", created_at="2026-08-25T00:00:00+00:00")
    report = models.ThesisExaminerReport(id=f"pg-report-{pg_domain['suffix']}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], examination_round_id=pg_domain["round"], assignment_id=assignment.id, rubric_version="1", recommendation="PASS", thesis_fingerprint="fp", status="DRAFT", created_at="2026-08-25T00:00:00+00:00")
    db.add_all([assignment, report]); db.commit(); db.close()
    barrier = threading.Barrier(2)
    def work():
        session = pg_domain["Session"](); barrier.wait()
        item = session.query(models.ThesisExaminerReport).filter(models.ThesisExaminerReport.id == report.id).with_for_update().one()
        if item.status == "SUBMITTED":
            session.rollback(); session.close(); return "rejected"
        item.status = "SUBMITTED"; item.submitted_at = "2026-08-25T00:00:01+00:00"; session.commit(); session.close(); return "won"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(f.result() for f in [pool.submit(work), pool.submit(work)])
    assert results == ["rejected", "won"]


def test_postgres_correction_verification_is_single(pg_domain):
    db = pg_domain["Session"]()
    version = db.query(models.ThesisChapterVersion).filter(models.ThesisChapterVersion.chapter_id == pg_domain["chapter"]).first()
    if not version:
        version = models.ThesisChapterVersion(id=f"pg-ver-{pg_domain['suffix']}", organization_id=pg_domain["org"], chapter_id=pg_domain["chapter"], version_number=9, content_snapshot_json={}, fingerprint="x", submitted_by=pg_domain["user"], submitted_at="2026-08-25T00:00:00+00:00")
        db.add(version); db.flush()
    correction = models.ThesisCorrection(id=f"pg-corr-{pg_domain['suffix']}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], examination_round_id=pg_domain["round"], correction_type="MAJOR", description="fix", status="SUBMITTED_FOR_VERIFICATION", evidence_version_id=version.id, details_json={"required": True})
    db.add(correction); db.commit(); db.close()
    barrier = threading.Barrier(2)
    def work(user):
        session = pg_domain["Session"](); barrier.wait()
        item = session.query(models.ThesisCorrection).filter(models.ThesisCorrection.id == correction.id).with_for_update().one()
        if item.status == "VERIFIED":
            session.rollback(); session.close(); return "rejected"
        item.status = "VERIFIED"; item.verified_by = user; item.verified_at = "2026-08-25T00:00:02+00:00"; session.commit(); session.close(); return "won"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(f.result() for f in [pool.submit(work, pg_domain["user"]), pool.submit(work, pg_domain["user"])])
    assert results == ["rejected", "won"]


def test_postgres_duplicate_final_version_is_rejected(pg_domain):
    db = pg_domain["Session"]()
    thesis = db.get(models.ThesisRecord, pg_domain["thesis"])
    round_ = db.get(models.ThesisExaminationRound, pg_domain["round"])
    if not round_.human_decision:
        round_.human_decision = "PASS"; round_.decision_by = pg_domain["user"]; round_.decision_at = "2026-08-25T00:00:00+00:00"; db.commit()
    with pytest.raises(HTTPException) as error:
        freeze_final_version(db, thesis, round_, pg_domain["user"], {"n": 2}, None)
    assert error.value.status_code == 409
    db.close()


def test_postgres_examiner_invitation_is_not_duplicated(pg_domain):
    db = pg_domain["Session"]()
    member = models.ThesisCommitteeMember(id=f"pg-member-invite-{pg_domain['suffix']}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], external_name="Invitee", role="INTERNAL_EXAMINER", eligibility_status="ELIGIBLE")
    db.add(member); db.flush()
    assignment = models.ThesisExaminerAssignment(id=f"pg-asg-invite-{pg_domain['suffix']}", organization_id=pg_domain["org"], thesis_id=pg_domain["thesis"], examination_round_id=pg_domain["round"], committee_member_id=member.id, frozen_thesis_fingerprint="fp", frozen_thesis_snapshot_json={}, status="APPROVED", eligibility_status="ELIGIBLE", coi_status="CLEARED", created_at="2026-08-25T00:00:00+00:00")
    db.add(assignment); db.commit(); assignment_id = assignment.id; db.close()
    barrier = threading.Barrier(2)
    def work():
        session = pg_domain["Session"](); item = session.get(models.ThesisExaminerAssignment, assignment_id); barrier.wait()
        try:
            issue_examiner_token(session, item, "2026-09-08T00:00:00+00:00"); session.commit(); result = "won"
        except HTTPException:
            session.rollback(); result = "rejected"
        session.close(); return result
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(f.result() for f in [pool.submit(work), pool.submit(work)])
    assert results == ["rejected", "won"]
    db = pg_domain["Session"]()
    assert db.query(models.ThesisExaminerToken).filter(models.ThesisExaminerToken.assignment_id == assignment_id, models.ThesisExaminerToken.revoked_at.is_(None)).count() == 1
    db.close()


def test_postgres_schema_contains_thesis_tables(pg_domain):
    inspector = inspect(pg_domain["engine"])
    tables = set(inspector.get_table_names())
    for name in ("thesis_records", "thesis_examiner_assignments", "thesis_examiner_reports", "thesis_corrections", "thesis_final_versions", "thesis_final_approvals", "thesis_deposits"):
        assert name in tables
    from app.db import Base
    mapped = {table.name for table in Base.metadata.sorted_tables if table.name.startswith("thesis_")}
    assert mapped <= tables
