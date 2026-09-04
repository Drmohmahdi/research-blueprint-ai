import datetime
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import models
from app.routers.research_lifecycle import project_or_404, project_timeline, require_project_write
from app.services.research_design import save_design_section
from app.services.research_lifecycle import (
    TEMPLATES,
    build_summary,
    create_handoff,
    mapping_create,
    propagate_dataset_staleness,
    resolve_template,
)


def stamp() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


@pytest.fixture
def lifecycle_domain(db_session):
    suffix = uuid.uuid4().hex[:10]
    user = models.User(id=f"life-user-{suffix}", username=f"life-{suffix}", email=f"life-{suffix}@example.invalid", hashed_password="unused", role="Researcher", created_at=stamp())
    other = models.User(id=f"life-other-{suffix}", username=f"life-other-{suffix}", email=f"life-other-{suffix}@example.invalid", hashed_password="unused", role="Researcher", created_at=stamp())
    org = models.Organization(id=f"life-org-{suffix}", name="Lifecycle org", slug=f"life-{suffix}", organization_type="PERSONAL", status="ACTIVE", owner_user_id=user.id, created_at=stamp())
    other_org = models.Organization(id=f"life-other-org-{suffix}", name="Other org", slug=f"life-other-{suffix}", organization_type="PERSONAL", status="ACTIVE", owner_user_id=other.id, created_at=stamp())
    db_session.add_all([user, other]); db_session.commit()
    db_session.add_all([org, other_org]); db_session.commit()
    project = models.ResearchProject(
        id=f"life-project-{suffix}", userId=user.id, organizationId=org.id,
        titleAr="دورة البحث", titleEn="Research lifecycle", problemStatementAr="مشكلة",
        studyDesign="quantitative", sampleSettings={}, version=1,
    )
    research_var = models.ResearchVariable(id=f"life-rv-{suffix}", projectId=project.id, nameAr="التحصيل", nameEn="Achievement", type="dependent", scale="ratio")
    question = models.ResearchQuestion(id=f"life-rq-{suffix}", projectId=project.id, textAr="سؤال", textEn="Question", associatedVariables=[research_var.id])
    db_session.add(project); db_session.commit()
    db_session.add_all([research_var, question]); db_session.commit()
    dataset = models.ResearchDataset(
        id=f"life-ds-{suffix}", organization_id=org.id, project_id=project.id, owner_id=user.id,
        name="Scores", source_type="TEST", sensitivity="INTERNAL", status="READY",
        current_version_id=f"life-v1-{suffix}", created_at=stamp(), updated_at=stamp(),
    )
    version = models.DatasetVersion(
        id=f"life-v1-{suffix}", organization_id=org.id, dataset_id=dataset.id,
        version_number="1.0", kind="RAW", fingerprint="a" * 64, row_count=2,
        column_count=1, data_json=[{"score": 1}, {"score": 2}], created_by=user.id, created_at=stamp(),
    )
    dataset_var = models.DatasetVariable(
        id=f"life-dv-{suffix}", organization_id=org.id, dataset_id=dataset.id,
        name="score", data_type="INTEGER", measurement_level="RATIO", role="DEPENDENT",
        sensitive=False, identifier=False,
    )
    db_session.add(dataset); db_session.commit()
    db_session.add_all([version, dataset_var]); db_session.commit()
    context = SimpleNamespace(user=user, organization=org, role="RESEARCHER", is_global_admin=False)
    other_context = SimpleNamespace(user=other, organization=other_org, role="RESEARCHER", is_global_admin=False)
    domain = SimpleNamespace(db=db_session, user=user, other=other, org=org, other_org=other_org, project=project,
                             research_var=research_var, dataset=dataset, version=version, dataset_var=dataset_var,
                             context=context, other_context=other_context, suffix=suffix)
    yield domain
    db_session.rollback()
    db_session.query(models.WorkflowEvent).filter(models.WorkflowEvent.organization_id.in_([org.id, other_org.id])).delete(synchronize_session=False)
    db_session.query(models.AuditLog).filter(models.AuditLog.organizationId.in_([org.id, other_org.id])).delete(synchronize_session=False)
    for candidate in db_session.query(models.ResearchProject).filter(models.ResearchProject.id.like(f"%{suffix}%")).all():
        db_session.delete(candidate)
    db_session.flush()
    for candidate in (org, other_org):
        persisted = db_session.get(models.Organization, candidate.id)
        if persisted:
            db_session.delete(persisted)
    db_session.flush()
    for persisted in db_session.query(models.User).filter(models.User.username.like(f"%{suffix}%")).all():
        db_session.delete(persisted)
    db_session.commit()


def test_lifecycle_template_resolution_and_qualitative_availability(lifecycle_domain):
    d = lifecycle_domain
    assert resolve_template(d.project) == "EMPIRICAL_QUANTITATIVE"
    d.project.studyDesign = "conceptual theoretical"
    assert resolve_template(d.project) == "CONCEPTUAL_THEORETICAL"
    d.project.studyDesign = "systematic review prisma"
    assert resolve_template(d.project) == "SYSTEMATIC_REVIEW"
    d.project.studyDesign = "qualitative"
    assert resolve_template(d.project) == "QUALITATIVE"
    summary = build_summary(d.db, d.project, d.user.id)
    qualitative = {stage["key"]: stage for stage in summary["stages"]}
    assert qualitative["QUALITATIVE_DATA"]["status"] == "AVAILABLE"
    assert qualitative["QUALITATIVE_ANALYSIS"]["status"] == "BLOCKED"
    d.project.studyDesign = "mixed_methods"
    d.db.commit()
    assert resolve_template(d.project) == "MIXED_METHODS"
    assert summary["next_action"]["computed_by"] == "DETERMINISTIC_LIFECYCLE_ENGINE"
    assert set(TEMPLATES) == {"EMPIRICAL_QUANTITATIVE", "CONCEPTUAL_THEORETICAL", "SYSTEMATIC_REVIEW", "QUALITATIVE", "MIXED_METHODS"}


def test_qualitative_coding_completes_data_and_analysis_stages(lifecycle_domain):
    d = lifecycle_domain
    d.project.studyDesign = "qualitative"
    d.db.commit()
    save_design_section(d.db, d.project, "procedure", {
        "qualitative_coding": {
            "transcript": "Field notes from classroom interviews about motivation.",
            "themes": [{"codeEn": "Motivation", "codeAr": "الدافعية"}],
        }
    }, d.user.id)
    d.db.commit()
    stages = {stage["key"]: stage for stage in build_summary(d.db, d.project, d.user.id)["stages"]}
    assert stages["QUALITATIVE_DATA"]["status"] == "COMPLETED"
    assert stages["QUALITATIVE_ANALYSIS"]["status"] == "COMPLETED"


def test_variable_mapping_is_idempotent_and_rejects_foreign_project(lifecycle_domain):
    d = lifecycle_domain
    first = mapping_create(d.db, d.project, d.research_var.id, d.dataset_var.id, "outcome", d.user.id)
    second = mapping_create(d.db, d.project, d.research_var.id, d.dataset_var.id, "outcome", d.user.id)
    assert first.id == second.id
    foreign_project = models.ResearchProject(id=f"foreign-project-{d.suffix}", userId=d.other.id, organizationId=d.other_org.id, titleAr="آخر", titleEn="Other", studyDesign="quantitative", sampleSettings={})
    d.db.add(foreign_project); d.db.commit()
    with pytest.raises(HTTPException) as error:
        mapping_create(d.db, foreign_project, d.research_var.id, d.dataset_var.id, "outcome", d.other.id)
    assert error.value.status_code == 422


def test_research_to_data_handoff_is_minimal_and_idempotent(lifecycle_domain):
    d = lifecycle_domain
    first = create_handoff(d.db, d.project, "RESEARCH_TO_DATA", d.project.id, None, d.user.id)
    second = create_handoff(d.db, d.project, "RESEARCH_TO_DATA", d.project.id, None, d.user.id)
    d.db.commit()
    assert first.id == second.id
    assert set(first.payload_json) == {"project_id", "question_ids", "hypothesis_ids", "conceptual_variable_ids", "study_design"}
    assert "sampleSettings" not in first.payload_json
    assert d.db.query(models.WorkflowEvent).filter(models.WorkflowEvent.aggregate_id == first.id).count() == 1


def test_data_to_publication_requires_current_completed_analysis_and_propagates_staleness(lifecycle_domain):
    d = lifecycle_domain
    analysis = models.ResearchAnalysis(
        id=f"life-analysis-{d.suffix}", organization_id=d.org.id, project_id=d.project.id,
        dataset_id=d.dataset.id, dataset_version_id=d.version.id, analysis_type="DESCRIPTIVES",
        configuration={}, result={"mean": 1.5, "p_value": None}, engine_version="baseerah-stats-1.0",
        status="COMPLETED", created_by=d.user.id, created_at=stamp(),
    )
    manuscript = models.ScholarlyAsset(
        id=f"life-manuscript-{d.suffix}", organization_id=d.org.id, owner_user_id=d.user.id,
        created_by=d.user.id, title_ar="مخطوطة", title_en="Manuscript", asset_type="MANUSCRIPT",
        lifecycle_status="DRAFT", source_module="research", source_record_id=d.project.id,
        version_number=1, created_at=stamp(),
    )
    d.db.add_all([analysis, manuscript]); d.db.commit()
    with pytest.raises(HTTPException) as unapproved:
        create_handoff(d.db, d.project, "DATA_TO_PUBLICATION", analysis.id, manuscript.id, d.user.id)
    assert unapproved.value.status_code == 409
    analysis.approved_by = d.user.id
    analysis.approved_at = stamp()
    d.db.commit()
    handoff = create_handoff(d.db, d.project, "DATA_TO_PUBLICATION", analysis.id, manuscript.id, d.user.id)
    d.db.commit()
    assert handoff.payload_json["dataset_version_id"] == d.version.id
    dependency = d.db.query(models.AnalysisAssetDependency).filter_by(analysis_id=analysis.id).one()
    assert dependency.status == "CURRENT"

    new_version = models.DatasetVersion(
        id=f"life-v2-{d.suffix}", organization_id=d.org.id, dataset_id=d.dataset.id,
        source_version_id=d.version.id, version_number="1.1", kind="CLEANED", fingerprint="b" * 64,
        row_count=2, column_count=1, data_json=[{"score": 2}, {"score": 3}], created_by=d.user.id, created_at=stamp(),
    )
    d.db.add(new_version); d.dataset.current_version_id = new_version.id; d.db.flush()
    assert propagate_dataset_staleness(d.db, d.dataset, new_version.id, d.user.id) == 1
    d.db.commit(); d.db.refresh(analysis); d.db.refresh(dependency); d.db.refresh(handoff)
    assert analysis.status == "STALE"
    assert dependency.status == "NEEDS_REVIEW"
    assert handoff.status == "STALE"
    assert manuscript.lifecycle_status == "DRAFT"
    with pytest.raises(HTTPException) as error:
        create_handoff(d.db, d.project, "DATA_TO_PUBLICATION", analysis.id, manuscript.id, d.user.id)
    assert error.value.status_code == 409


def test_cross_tenant_and_same_tenant_horizontal_mutation_are_blocked(lifecycle_domain):
    d = lifecycle_domain
    with pytest.raises(HTTPException) as missing:
        project_or_404(d.db, d.project.id, d.other_context)
    assert missing.value.status_code == 404
    colleague = models.User(id=f"life-colleague-{d.suffix}", username=f"life-colleague-{d.suffix}", email=f"life-colleague-{d.suffix}@example.invalid", hashed_password="unused", role="Researcher", created_at=stamp())
    d.db.add(colleague); d.db.commit()
    colleague_context = SimpleNamespace(user=colleague, organization=d.org, role="RESEARCHER", is_global_admin=False)
    with pytest.raises(HTTPException) as forbidden:
        require_project_write(d.project, colleague_context, d.db)
    assert forbidden.value.status_code == 403


def test_timeline_never_exposes_reviewer_or_confidential_content(lifecycle_domain):
    d = lifecycle_domain
    case = models.PeerReviewCase(
        id=f"life-review-{d.suffix}", organization_id=d.org.id, owner_user_id=d.user.id,
        project_id=d.project.id, title_ar="تحكيم", title_en="Review", case_type="MANUSCRIPT",
        blind_type="DOUBLE_BLIND", status="IN_REVIEW", current_round_number=1,
        created_at=stamp(), updated_at=stamp(),
    )
    d.db.add(case); d.db.commit()
    result = project_timeline(d.project.id, d.db, d.context)
    serialized = str(result)
    assert "reviewer_user_id" not in serialized
    assert "confidential" not in serialized.casefold()
    assert all("payload" not in event for event in result["events"])


# ── Cross-domain IAM consolidation Finding 1 regression (extended to this router) ──
# Generic ORGANIZATION_ADMIN/SUPERVISOR organization-role membership must not
# substitute for a resource-scoped ResearchProjectMember relationship — this
# router previously diverged from research_design.py's own established
# can_edit_section()/project_access() precedent for this exact resource.

def test_organization_admin_without_project_relationship_cannot_write_lifecycle_records(lifecycle_domain):
    d = lifecycle_domain
    admin_context = SimpleNamespace(user=d.other, organization=d.org, role="ORGANIZATION_ADMIN", is_global_admin=False)
    with pytest.raises(HTTPException) as error:
        require_project_write(d.project, admin_context, d.db)
    assert error.value.status_code == 403


def test_supervisor_without_project_relationship_cannot_write_lifecycle_records(lifecycle_domain):
    d = lifecycle_domain
    supervisor_context = SimpleNamespace(user=d.other, organization=d.org, role="SUPERVISOR", is_global_admin=False)
    with pytest.raises(HTTPException) as error:
        require_project_write(d.project, supervisor_context, d.db)
    assert error.value.status_code == 403


def test_project_member_with_edit_capable_relationship_can_write_lifecycle_records(lifecycle_domain):
    d = lifecycle_domain
    colleague = models.User(id=f"life-pi-{d.suffix}", username=f"life-pi-{d.suffix}", email=f"life-pi-{d.suffix}@example.invalid", hashed_password="unused", role="Researcher", created_at=stamp())
    d.db.add(colleague); d.db.commit()
    d.db.add(models.ResearchProjectMember(
        id=f"life-member-{d.suffix}", organization_id=d.org.id, project_id=d.project.id,
        user_id=colleague.id, relationship="PI", status="ACTIVE", created_at=stamp(),
    ))
    d.db.commit()
    pi_context = SimpleNamespace(user=colleague, organization=d.org, role="RESEARCHER", is_global_admin=False)
    require_project_write(d.project, pi_context, d.db)  # must not raise


def test_promotion_handoff_remains_candidate_and_requires_human_selection(lifecycle_domain):
    d = lifecycle_domain
    asset = models.ScholarlyAsset(
        id=f"life-published-{d.suffix}", organization_id=d.org.id, owner_user_id=d.user.id,
        title_ar="منشور", title_en="Published", asset_type="ARTICLE", lifecycle_status="PUBLISHED",
        source_module="research", source_record_id=d.project.id, version_number=1, created_at=stamp(),
    )
    policy = models.PromotionPolicy(
        id=f"life-policy-{d.suffix}", organization_id=d.org.id, name_ar="سياسة", name_en="Policy",
        target_rank="ASSOCIATE", version=1, status="ACTIVE", is_default=True,
        created_by=d.user.id, created_at=stamp(), updated_at=stamp(),
    )
    d.db.add_all([asset, policy]); d.db.commit()
    application = models.PromotionApplication(
        id=f"life-application-{d.suffix}", organization_id=d.org.id, user_id=d.user.id,
        policy_id=policy.id, policy_version=1, target_rank="ASSOCIATE", status="DRAFT",
        readiness_percentage=0, total_calculated_points=0, created_at=stamp(), updated_at=stamp(),
    )
    d.db.add(application); d.db.commit()
    handoff = create_handoff(d.db, d.project, "PUBLICATION_TO_PROMOTION", asset.id, application.id, d.user.id)
    d.db.commit()
    assert handoff.payload_json["candidate_only"] is True
    assert handoff.payload_json["human_selection_required"] is True
    assert d.db.query(models.PromotionAssetSelection).filter_by(promotion_application_id=application.id).count() == 0
