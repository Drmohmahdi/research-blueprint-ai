from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base
from app.routers.thesis_workflow import list_examiner_reports, thesis_or_404


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    for item in [
        models.ThesisRecord(id="thesis-a", organization_id="org-a", project_id="p-a", student_user_id="student", policy_id="policy", policy_snapshot_json={}, degree_type="MASTERS", program_name="P", title_ar="أ", title_en="A", created_at="2026", updated_at="2026"),
        models.ThesisRecord(id="thesis-b", organization_id="org-b", project_id="p-b", student_user_id="other-student", policy_id="policy", policy_snapshot_json={}, degree_type="MASTERS", program_name="P", title_ar="ب", title_en="B", created_at="2026", updated_at="2026"),
        models.ThesisSupervisionAssignment(id="supervision", organization_id="org-a", thesis_id="thesis-a", user_id="supervisor", role="SUPERVISOR", can_final_recommend=True, assigned_at="2026"),
        models.ThesisSupervisionAssignment(id="co-supervision", organization_id="org-a", thesis_id="thesis-a", user_id="co-supervisor", role="CO_SUPERVISOR", assigned_at="2026"),
        models.ThesisCommitteeMember(id="committee-seat", organization_id="org-a", thesis_id="thesis-a", user_id="committee-member", role="INTERNAL_EXAMINER", eligibility_status="ELIGIBLE"),
    ]:
        session.add(item)
    for report_id, level in [("student-report", "STUDENT_VISIBLE"), ("supervisor-report", "SUPERVISOR_VISIBLE"), ("committee-report", "COMMITTEE_ONLY"), ("grad-studies-report", "GRADUATE_STUDIES_ONLY")]:
        session.add(models.ThesisExaminerReport(id=report_id, organization_id="org-a", thesis_id="thesis-a", examination_round_id="round", assignment_id=f"assignment-{report_id}", rubric_version="1", recommendation="PASS", general_assessment="assessment", confidential_comments="secret", confidentiality_level=level, thesis_fingerprint="fp", report_fingerprint="report-fp", status="SUBMITTED", submitted_at="2026", created_at="2026"))
    session.commit()
    yield session
    session.close(); engine.dispose()


def _ctx(user, org="org-a", role="MEMBER", is_global_admin=False):
    return SimpleNamespace(user=SimpleNamespace(id=user, role="MEMBER"), organization=SimpleNamespace(id=org), role=role, is_global_admin=is_global_admin)


def _manifest(report_id="report", org="org-a", user="viewer"):
    from app.services.reporting.models import ReportManifest, ReportType
    return ReportManifest(report_id=report_id, report_type=ReportType.THESIS_EXAMINER_REPORT, source_type="THESIS_EXAMINER_REPORT", source_id=report_id, organization_id=org, organization_name_ar="جامعة", organization_name_en="University", generated_by_user_id=user, generated_by_username=user, verification_code="TEST-1234", verification_code_hash="hash")


def test_same_tenant_unassigned_user_cannot_enumerate_thesis(db):
    with pytest.raises(HTTPException) as error:
        thesis_or_404(db, "thesis-a", _ctx("stranger"))
    assert error.value.status_code == 404


def test_cross_tenant_student_cannot_access_thesis(db):
    with pytest.raises(HTTPException) as error:
        thesis_or_404(db, "thesis-b", _ctx("other-student", org="org-a"))
    assert error.value.status_code == 404


def test_student_only_receives_student_visible_report_without_confidential_comments(db):
    reports = list_examiner_reports("thesis-a", db, _ctx("student"))
    assert [item["id"] for item in reports] == ["student-report"]
    assert reports[0]["confidential_comments"] is None


def test_co_supervisor_visibility_excludes_committee_only_and_confidential_comments(db):
    reports = list_examiner_reports("thesis-a", db, _ctx("co-supervisor"))
    assert {item["id"] for item in reports} == {"student-report", "supervisor-report"}
    assert all(item["confidential_comments"] is None for item in reports)


def test_primary_supervisor_receives_authorized_confidential_reports(db):
    reports = list_examiner_reports("thesis-a", db, _ctx("supervisor"))
    assert len(reports) == 4
    assert all(item["confidential_comments"] == "secret" for item in reports)


def test_committee_member_sees_committee_only_but_not_graduate_studies_only(db):
    reports = list_examiner_reports("thesis-a", db, _ctx("committee-member"))
    assert {item["id"] for item in reports} == {"student-report", "supervisor-report", "committee-report"}
    by_id = {item["id"]: item for item in reports}
    assert by_id["committee-report"]["confidential_comments"] == "secret"
    assert by_id["student-report"]["confidential_comments"] is None
    assert by_id["supervisor-report"]["confidential_comments"] is None


def test_report_response_never_leaks_rubric_or_required_corrections_payload(db):
    reports = list_examiner_reports("thesis-a", db, _ctx("student"))
    assert "rubric_response_json" not in reports[0]
    assert "required_corrections_json" not in reports[0]


def test_unassigned_same_tenant_user_cannot_open_supervised_thesis(db):
    with pytest.raises(HTTPException) as error:
        thesis_or_404(db, "thesis-a", _ctx("other-supervisor"))
    assert error.value.status_code == 404


def test_nested_chapter_from_other_thesis_is_not_found(db):
    from app.routers.thesis_workflow import ChapterVersionCreate, add_chapter_version
    db.add(models.ThesisChapter(id="chapter-b", organization_id="org-b", thesis_id="thesis-b", chapter_key="INTRODUCTION", title="Intro", sort_order=1, dependencies_json=[]))
    db.commit()
    with pytest.raises(HTTPException) as error:
        add_chapter_version("thesis-a", "chapter-b", ChapterVersionCreate(content={}), db, _ctx("student"))
    assert error.value.status_code == 404


def test_nested_correction_from_other_thesis_is_not_found(db):
    from app.routers.thesis_workflow import verify_correction
    db.add(models.ThesisCorrection(id="corr-b", organization_id="org-b", thesis_id="thesis-b", examination_round_id="round-b", correction_type="MAJOR", description="x", details_json={"required": True}))
    db.commit()
    with pytest.raises(HTTPException) as error:
        verify_correction("thesis-a", "corr-b", db, _ctx("supervisor"))
    assert error.value.status_code == 404


def test_search_provider_does_not_leak_unassigned_or_cross_tenant_thesis(db):
    from app.services.search.providers import get_provider
    provider = get_provider("THESIS")
    same_tenant = provider.build_base(db, _ctx("stranger")).filter(models.ThesisRecord.id.in_(["thesis-a", "thesis-b"])).count()
    cross = provider.build_base(db, _ctx("other-student", org="org-a")).filter(models.ThesisRecord.id == "thesis-b").count()
    assert same_tenant == 0
    assert cross == 0


def test_graduate_studies_role_is_required_for_operations_summary(db):
    from app.routers.thesis_workflow import graduate_operations
    with pytest.raises(HTTPException) as error:
        graduate_operations(db, _ctx("student"))
    assert error.value.status_code == 403


def test_report_engine_blocks_unrelated_user_from_any_examiner_report_tier(db):
    from app.services.reporting.context_builder import ReportContextBuilder
    # Same tenant, but no relationship to this specific thesis at all — must
    # be blocked even for the least-restrictive STUDENT_VISIBLE tier.
    with pytest.raises(HTTPException) as error:
        ReportContextBuilder._build_thesis_examiner_report("student-report", None, _ctx("stranger"), db, None)
    assert error.value.status_code == 404


def test_report_engine_allows_committee_member_to_read_committee_only_report(db):
    from app.services.reporting.context_builder import ReportContextBuilder
    result = ReportContextBuilder._build_thesis_examiner_report("committee-report", _manifest(), _ctx("committee-member"), db, None)
    assert "Confidential comments are available only to authorized academic officers." in result.sections[0].paragraphs_en


def test_report_engine_blocks_committee_member_from_graduate_studies_only_report(db):
    from app.services.reporting.context_builder import ReportContextBuilder
    with pytest.raises(HTTPException) as error:
        ReportContextBuilder._build_thesis_examiner_report("grad-studies-report", None, _ctx("committee-member"), db, None)
    assert error.value.status_code == 404


def test_report_engine_allows_student_to_read_own_student_visible_report(db):
    from app.services.reporting.context_builder import ReportContextBuilder
    result = ReportContextBuilder._build_thesis_examiner_report("student-report", _manifest(), _ctx("student"), db, None)
    assert result.metadata["confidentiality_level"] == "STUDENT_VISIBLE"


# ── Cross-domain IAM consolidation Finding 1 / Finding 3 regression ──────────
# Generic ORGANIZATION_ADMIN role membership (and platform is_global_admin) no
# longer substitutes for a resource-scoped ThesisSupervisionAssignment: it
# must not see SUPERVISOR_VISIBLE/COMMITTEE_ONLY confidential examiner
# comments, and require_supervisor must reject it outright for supervisor-
# equivalent write/decision actions. "Graduate Studies" oversight is instead
# scoped to exactly its own, previously-unreachable GRADUATE_STUDIES_ONLY tier.

def test_organization_admin_without_assignment_cannot_see_supervisor_or_committee_tier_reports(db):
    # Not just redacted confidential_comments — an admin with no resource-scoped
    # relationship cannot see SUPERVISOR_VISIBLE/COMMITTEE_ONLY reports exist
    # at all through this endpoint, matching a plain unrelated user's view.
    reports = list_examiner_reports("thesis-a", db, _ctx("org-admin-user", role="ORGANIZATION_ADMIN"))
    ids = {item["id"] for item in reports}
    assert "supervisor-report" not in ids
    assert "committee-report" not in ids


def test_platform_admin_without_assignment_cannot_see_supervisor_or_committee_tier_reports(db):
    reports = list_examiner_reports("thesis-a", db, _ctx("platform-user", role="MEMBER", is_global_admin=True))
    ids = {item["id"] for item in reports}
    assert "supervisor-report" not in ids
    assert "committee-report" not in ids


def test_organization_admin_can_see_graduate_studies_only_tier(db):
    # Finding 3: this tier was previously unreachable through this endpoint by
    # anyone, admin included — now correctly scoped to Graduate Studies (admin).
    reports = list_examiner_reports("thesis-a", db, _ctx("org-admin-user", role="ORGANIZATION_ADMIN"))
    by_id = {item["id"]: item for item in reports}
    assert "grad-studies-report" in by_id
    assert by_id["grad-studies-report"]["confidential_comments"] == "secret"


def test_report_engine_organization_admin_cannot_read_supervisor_visible_report(db):
    # Not merely redacted — an admin with no resource-scoped relationship
    # cannot generate a report for a SUPERVISOR_VISIBLE tier item at all.
    from app.services.reporting.context_builder import ReportContextBuilder
    with pytest.raises(HTTPException) as error:
        ReportContextBuilder._build_thesis_examiner_report(
            "supervisor-report", _manifest(), _ctx("org-admin-user", role="ORGANIZATION_ADMIN"), db, None
        )
    assert error.value.status_code == 404


def test_report_engine_organization_admin_can_read_graduate_studies_only_confidential_comments(db):
    from app.services.reporting.context_builder import ReportContextBuilder
    result = ReportContextBuilder._build_thesis_examiner_report(
        "grad-studies-report", _manifest(), _ctx("org-admin-user", role="ORGANIZATION_ADMIN"), db, None
    )
    assert "Confidential comments are available only to authorized academic officers." in result.sections[0].paragraphs_en


def test_require_supervisor_rejects_organization_admin_without_assignment(db):
    from app.routers.thesis_workflow import require_supervisor
    thesis = db.get(models.ThesisRecord, "thesis-a")
    with pytest.raises(HTTPException) as error:
        require_supervisor(db, thesis, _ctx("org-admin-user", role="ORGANIZATION_ADMIN"))
    assert error.value.status_code == 403


def test_require_supervisor_rejects_platform_admin_without_assignment(db):
    from app.routers.thesis_workflow import require_supervisor
    thesis = db.get(models.ThesisRecord, "thesis-a")
    with pytest.raises(HTTPException) as error:
        require_supervisor(db, thesis, _ctx("platform-user", role="MEMBER", is_global_admin=True))
    assert error.value.status_code == 403


def test_require_supervisor_still_accepts_the_genuinely_assigned_supervisor(db):
    from app.routers.thesis_workflow import require_supervisor
    thesis = db.get(models.ThesisRecord, "thesis-a")
    item = require_supervisor(db, thesis, _ctx("supervisor"), final=True)
    assert item is not None and item.role == "SUPERVISOR"
