"""Create an isolated, deterministic database for browser tests only."""

from pathlib import Path
import hashlib
import os
import uuid

db_path = (Path(__file__).resolve().parent / "e2e.db").resolve()
expected_parent = Path(__file__).resolve().parent
if db_path.parent != expected_parent or db_path.name != "e2e.db":
    raise RuntimeError("Refusing to prepare an unexpected E2E database path")

os.environ["DATABASE_URL"] = "sqlite:///./e2e.db"
os.environ["TESTING"] = "True"
os.environ["AUTO_CREATE_TABLES"] = "false"

print("e2e_seed: preparing sqlite e2e.db", flush=True)

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import Base, engine as imported_engine  # noqa: E402
from app.models import (  # noqa: E402
    User, Organization, OrganizationMembership, Plan, Subscription,
    ResearchProject, ResearchVariable, ResearchQuestion, Hypothesis,
    ResearchDesignState, PrismaFlow, LiteratureStudy,
)

if not settings.DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("E2E seed refused non-sqlite DATABASE_URL")

imported_engine.dispose()

for leftover in (db_path, Path(str(db_path) + "-wal"), Path(str(db_path) + "-shm")):
    if leftover.exists():
        try:
            leftover.unlink()
        except OSError as exc:
            raise RuntimeError("Cannot replace e2e.db (file in use)") from exc

print("e2e_seed: creating tables", flush=True)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    hash_val = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return salt.hex() + ":" + hash_val.hex()


def stamp() -> str:
    return "2026-08-25T00:00:00+00:00"


engine = create_engine(
    "sqlite:///./e2e.db",
    connect_args={"check_same_thread": False, "timeout": 15},
    poolclass=NullPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Replacing the file above is faster than drop_all; checkfirst inspects 100+ tables.
Base.metadata.create_all(bind=engine, checkfirst=False)

print("e2e_seed: inserting fixture user", flush=True)
with SessionLocal() as db:
    db.add(
        User(
            id="e2e-researcher-user",
            username="e2e_researcher",
            email="e2e@example.invalid",
            hashed_password=hash_password("E2ePass123!"),
            role="Researcher",
            created_at=stamp(),
        )
    )
    db.commit()

print("e2e_seed: creating organization + plan + subscription + project", flush=True)
with SessionLocal() as db:
    plan = Plan(
        id="pln-e2e-free", code="FREE", name="Free Plan", name_ar="الخطة المجانية",
        name_en="Free Plan", billing_interval="MONTHLY", price=0, price_minor_units=0,
        currency="SAR", features_json={}, limits_json={"max_projects": 100},
        created_at=stamp(),
    )
    db.add(plan); db.commit()

    org = Organization(
        id="e2e-org", name="E2E University", slug="e2e-univ",
        organization_type="UNIVERSITY", status="ACTIVE",
        owner_user_id="e2e-researcher-user", default_language="ar",
        data_region="sa", created_at=stamp(),
    )
    db.add(org); db.commit()

    membership = OrganizationMembership(
        id="e2e-membership", organization_id="e2e-org",
        user_id="e2e-researcher-user", role="OWNER", status="ACTIVE",
        created_at=stamp(),
    )
    db.add(membership); db.commit()

    sub = Subscription(
        id="e2e-sub", organization_id="e2e-org", plan_id="pln-e2e-free",
        status="ACTIVE", provider="MOCK", current_period_start=stamp(),
        current_period_end="2036-08-25T00:00:00Z", created_at=stamp(),
    )
    db.add(sub); db.commit()

    project = ResearchProject(
        id="e2e-project", userId="e2e-researcher-user", organizationId="e2e-org",
        titleAr="مشروع بحثي تجريبي", titleEn="E2E Research Project",
        problemStatementAr="مشكلة بحثية تتعلق بالتحصيل الدراسي",
        problemStatementEn="A research problem related to academic achievement",
        studyDesign="quasi_experimental_pre_post", sampleSettings={}, version=1,
    )
    db.add(project); db.commit()

    iv = ResearchVariable(id="e2e-iv", projectId="e2e-project", nameAr="المتغير المستقل",
                          nameEn="Independent Variable", type="independent", scale="nominal")
    dv = ResearchVariable(id="e2e-dv", projectId="e2e-project", nameAr="المتغير التابع",
                          nameEn="Dependent Variable", type="dependent", scale="ratio")
    db.add_all([iv, dv]); db.commit()

    q1 = ResearchQuestion(id="e2e-q1", projectId="e2e-project",
                          textAr="هل يختلف التحصيل الدراسي بين المجموعتين؟",
                          textEn="Does academic achievement differ between the two groups?",
                          associatedVariables=[iv.id, dv.id])
    q2 = ResearchQuestion(id="e2e-q2", projectId="e2e-project",
                          textAr="ما مستوى التحصيل الدراسي؟",
                          textEn="What is the level of academic achievement?",
                          associatedVariables=[iv.id, dv.id])
    db.add_all([q1, q2]); db.commit()

    h1 = Hypothesis(id="e2e-h1", projectId="e2e-project", questionId=q1.id,
                    textAr="يوجد فرق دال إحصائياً بين المجموعتين في التحصيل",
                    textEn="There is a significant difference between the two groups in achievement",
                    type="directional", independentVarId=iv.id, dependentVarId=dv.id)
    db.add(h1); db.commit()

    lit = LiteratureStudy(id="e2e-lit", projectId="e2e-project", organizationId="e2e-org",
                          author="Author", year=2023, sampleSize=100, effectSize=0.5,
                          ciLower=0.3, ciUpper=0.7, source="manual", doi="10.1234/e2e",
                          notes="E2E seed literature", createdAt=stamp(), updatedAt=stamp())
    db.add(lit); db.commit()

    prisma = PrismaFlow(id="e2e-prisma", projectId="e2e-project", organizationId="e2e-org",
                        identified=50, duplicates=5, excludedScreening=15,
                        excludedEligibility=10, source="manual",
                        createdAt=stamp(), updatedAt=stamp())
    db.add(prisma); db.commit()

    # Design state with structured sections
    state = ResearchDesignState(
        id="e2e-dstate", organization_id="e2e-org", project_id="e2e-project",
        idea_json={"topic": "التحصيل الدراسي", "maturity": "RESEARCHABLE",
                   "research_context": "سياق تعليمي", "target_population": "طلاب المرحلة الثانوية"},
        problem_json={"context": "التعليم", "current_situation": "ضعف التحصيل",
                      "observed_problem": "انخفاض المستوى التحصيلي", "evidence": "دراسات سابقة"},
        gap_json={"gaps": [{"id": "g1", "type": "KNOWLEDGE_GAP", "evidence_strength": "STRONG",
                            "description": "قلة الدراسات في هذا السياق"}]},
        objectives_json={"objectives": [{"id": "0", "text_ar": "هدف رئيسي",
                                         "text_en": "Primary objective", "kind": "PRIMARY"}]},
        sampling_json={"technique": "stratified", "planned_n": 200, "target_population": "Students"},
        protocol_status="NO_PROTOCOL",
        updated_by="e2e-researcher-user", updated_at=stamp(),
    )
    db.add(state); db.commit()

    # Project member as PI
    from app.models import ResearchProjectMember
    member = ResearchProjectMember(
        id="e2e-member", organization_id="e2e-org", project_id="e2e-project",
        user_id="e2e-researcher-user", relationship="PI", status="ACTIVE",
        assigned_sections=[], created_at=stamp(),
    )
    db.add(member); db.commit()

    print("e2e_seed: E2E research project + design state created", flush=True)

print("e2e_seed: seeding research data & analysis fixtures", flush=True)
with SessionLocal() as db:
    from app.services.research_data import fingerprint as _fp
    from app.models import (
        ResearchDataset, DatasetVersion, DatasetVariable, DatasetQualityIssue,
        ResearchAnalysis, DatasetAccessGrant,
    )

    # ── Personas (accounts + memberships + grants) ─────────────────────────
    from app.models import User as _User, OrganizationMembership as _OM, ResearchProjectMember as _RPM
    def _persona(uid, username, role):
        existing = db.get(_User, uid)
        if existing:
            return existing
        u = _User(id=uid, username=username, email=f"{username}@e2e.invalid",
                  hashed_password=hash_password("E2ePass123!"), role=role, created_at=stamp())
        db.add(u); db.flush()
        return u

    co_researcher = _persona("e2e-co-researcher", "e2e_co_researcher", "Researcher")
    data_analyst = _persona("e2e-data-analyst", "e2e_data_analyst", "Researcher")
    reviewer = _persona("e2e-reviewer", "e2e_reviewer", "Researcher")
    metadata_user = _persona("e2e-metadata-user", "e2e_metadata_user", "Researcher")
    org_admin = _persona("e2e-org-admin", "e2e_org_admin", "OrganizationAdmin")
    platform_admin = _persona("e2e-platform-admin", "e2e_platform_admin", "SystemAdmin")
    outsider = _persona("e2e-outsider", "e2e_outsider", "Researcher")

    for p in [co_researcher, data_analyst, reviewer, metadata_user, org_admin, platform_admin]:
        existing_m = db.query(_OM).filter(_OM.organization_id == "e2e-org", _OM.user_id == p.id).first()
        if not existing_m:
            member_role = "ORGANIZATION_ADMIN" if p.id == "e2e-org-admin" else "RESEARCHER"
            db.add(_OM(id=f"e2e-m-{p.id}", organization_id="e2e-org", user_id=p.id,
                       role=member_role, status="ACTIVE", created_at=stamp()))
    # Outsider in a different organization
    if not db.query(_OM).filter(_OM.organization_id == "e2e-outside-org", _OM.user_id == outsider.id).first():
        outside_org = __import__('app.models', fromlist=['Organization']).Organization(id="e2e-outside-org", name="Outside Org", slug="e2e-outside",
                                          organization_type="PERSONAL", status="ACTIVE",
                                          owner_user_id=outsider.id, default_language="ar",
                                          data_region="sa", created_at=stamp())
        db.add(outside_org)
        db.add(_OM(id="e2e-m-outsider", organization_id="e2e-outside-org", user_id=outsider.id,
                   role="OWNER", status="ACTIVE", created_at=stamp()))
    # Project relationships
    for pid, rel in [("e2e-co-researcher", "CO_RESEARCHER"), ("e2e-data-analyst", "DATA_ANALYST"),
                     ("e2e-reviewer", "METHODOLOGY_REVIEWER")]:
        if not db.query(_RPM).filter(_RPM.project_id == "e2e-project", _RPM.user_id == pid, _RPM.status == "ACTIVE").first():
            db.add(_RPM(id=f"e2e-rm-{pid}", organization_id="e2e-org", project_id="e2e-project",
                        user_id=pid, relationship=rel, status="ACTIVE", assigned_sections=[], created_at=stamp()))
    db.commit()

    # ── Dataset A: v1 RAW, v2 CLEANED, v3 ANALYSIS_READY ───────────────────
    rows_v1 = [
        {"national_id": f"NID{i:04d}", "age": 18 + (i % 12), "medical_status": "controlled" if i % 2 else "uncontrolled",
         "score": 55 + (i * 3) % 40, "group": "a" if i % 2 else "b"} for i in range(40)
    ]
    rows_v2 = [{**r, "medical_status": r["medical_status"].strip()} for r in rows_v1]
    rows_v3 = rows_v2  # ANALYSIS_READY after cleaning

    ds_a = db.get(ResearchDataset, "e2e-dataset-a")
    if not ds_a:
        ds_a = ResearchDataset(id="e2e-dataset-a", organization_id="e2e-org", project_id="e2e-project",
                               owner_id="e2e-researcher-user", name="E2E Study Dataset A",
                               source_type="CSV", sensitivity="CONFIDENTIAL", status="READY",
                               current_version_id="e2e-dsa-v3", created_at=stamp(), updated_at=stamp())
        db.add(ds_a)
        v1 = DatasetVersion(id="e2e-dsa-v1", organization_id="e2e-org", dataset_id=ds_a.id, version_number="1.0",
                            kind="RAW", fingerprint=_fp(rows_v1), row_count=len(rows_v1), column_count=5,
                            data_json=rows_v1, change_summary="Initial immutable import",
                            created_by="e2e-researcher-user", created_at=stamp())
        v2 = DatasetVersion(id="e2e-dsa-v2", organization_id="e2e-org", dataset_id=ds_a.id, source_version_id=v1.id,
                            version_number="2.0", kind="CLEANED", fingerprint=_fp(rows_v2), row_count=len(rows_v2),
                            column_count=5, data_json=rows_v2, change_summary="Trimmed medical_status text",
                            created_by="e2e-data-analyst", created_at=stamp())
        v3 = DatasetVersion(id="e2e-dsa-v3", organization_id="e2e-org", dataset_id=ds_a.id, source_version_id=v2.id,
                            version_number="3.0", kind="ANALYSIS_READY", fingerprint=_fp(rows_v3), row_count=len(rows_v3),
                            column_count=5, data_json=rows_v3, change_summary="Analysis-ready after cleaning",
                            created_by="e2e-data-analyst", created_at=stamp())
        db.add_all([v1, v2, v3])
        for i, (name, dtype, level, role, sensitive, identifier) in enumerate([
            ("national_id", "STRING", "FREE_TEXT", "IDENTIFIER", True, True),
            ("age", "INTEGER", "RATIO", "COVARIATE", False, False),
            ("medical_status", "CATEGORY", "NOMINAL", "DEPENDENT", True, False),
            ("score", "INTEGER", "RATIO", "DEPENDENT", False, False),
            ("group", "CATEGORY", "NOMINAL", "GROUPING", False, False),
        ]):
            db.add(DatasetVariable(id=f"e2e-dsa-var-{i}", organization_id="e2e-org", dataset_id=ds_a.id,
                                   name=name, data_type=dtype, measurement_level=level, role=role,
                                   sensitive=sensitive, identifier=identifier))
        db.add(DatasetQualityIssue(id="e2e-dsa-qi1", organization_id="e2e-org", dataset_id=ds_a.id, version_id=v1.id,
                                   variable_name="medical_status", issue_type="MISSING_VALUES", severity="LOW",
                                   status="OPEN", details={"count": 2, "percentage": 5.0}, created_at=stamp()))
        # Research variable mapping: conceptual "Academic Achievement" → score
        from app.models import ResearchVariable, ResearchVariableMapping
        rv = db.get(ResearchVariable, "e2e-rv-achievement")
        if not rv:
            rv = ResearchVariable(id="e2e-rv-achievement", projectId="e2e-project", nameAr="التحصيل الأكاديمي",
                                  nameEn="Academic Achievement", type="dependent", scale="ratio")
            db.add(rv); db.flush()
        db.add(ResearchVariableMapping(id="e2e-map-achievement", organization_id="e2e-org", project_id="e2e-project",
                                       research_variable_id=rv.id, dataset_variable_id="e2e-dsa-var-3",
                                       mapping_role="MEASURE", created_by="e2e-researcher-user", created_at=stamp()))
        db.commit()
    # Grants: data analyst CLEAN+RUN_ANALYSIS; reviewer REVIEW_ANALYSIS+APPROVE_ANALYSIS; metadata user none
    grant_specs = [
        ("e2e-data-analyst", "CLEAN", "e2e-dataset-a"),
        ("e2e-data-analyst", "RUN_ANALYSIS", "e2e-dataset-a"),
        ("e2e-reviewer", "REVIEW_ANALYSIS", "e2e-dataset-a"),
        ("e2e-reviewer", "APPROVE_ANALYSIS", "e2e-dataset-a"),
    ]
    for uid, cap, dsid in grant_specs:
        if not db.query(DatasetAccessGrant).filter(DatasetAccessGrant.dataset_id == dsid, DatasetAccessGrant.user_id == uid,
                                                   DatasetAccessGrant.capability == cap, DatasetAccessGrant.status == "ACTIVE").first():
            db.add(DatasetAccessGrant(id=f"e2e-grant-{uid}-{cap}", organization_id="e2e-org", dataset_id=dsid,
                                      project_id="e2e-project", user_id=uid, capability=cap, granted_by="e2e-researcher-user",
                                      reason="E2E seed grant", status="ACTIVE", created_at=stamp()))
    db.commit()

    # ── Dataset B (different project, owned by co-researcher) ──────────────
    ds_b = db.get(ResearchDataset, "e2e-dataset-b")
    if not ds_b:
        ds_b_rows = [{"id": f"P{i}", "value": i * 2} for i in range(10)]
        ds_b = ResearchDataset(id="e2e-dataset-b", organization_id="e2e-org", project_id="e2e-project",
                               owner_id="e2e-co-researcher", name="E2E Study Dataset B",
                               source_type="CSV", sensitivity="RESTRICTED", status="READY",
                               current_version_id="e2e-dsb-v1", created_at=stamp(), updated_at=stamp())
        db.add(ds_b)
        v1 = DatasetVersion(id="e2e-dsb-v1", organization_id="e2e-org", dataset_id=ds_b.id, version_number="1.0",
                            kind="RAW", fingerprint=_fp(ds_b_rows), row_count=len(ds_b_rows), column_count=2,
                            data_json=ds_b_rows, change_summary="Initial", created_by="e2e-co-researcher", created_at=stamp())
        db.add(v1)
        db.add(DatasetVariable(id="e2e-dsb-var-0", organization_id="e2e-org", dataset_id=ds_b.id,
                               name="id", data_type="STRING", measurement_level="FREE_TEXT", role="IDENTIFIER",
                               sensitive=True, identifier=True))
        db.add(DatasetVariable(id="e2e-dsb-var-1", organization_id="e2e-org", dataset_id=ds_b.id,
                               name="value", data_type="INTEGER", measurement_level="RATIO", role="DEPENDENT",
                               sensitive=False, identifier=False))
        db.commit()

    # ── Analyses: completed, approved, stale ───────────────────────────────
    analysis_specs = [
        ("e2e-analysis-approved", "DESCRIPTIVES", {"variables": ["score"]},
         {"analysis": "DESCRIPTIVES", "method": "Sample descriptives", "estimates": {"score": {"n": 40, "mean": 72.5, "sd": 11.4}},
          "warnings": []}, "APPROVED", "e2e-dsa-v3", "e2e-reviewer", "e2e-data-analyst"),
        ("e2e-analysis-stale", "DESCRIPTIVES", {"variables": ["score"]},
         {"analysis": "DESCRIPTIVES", "estimates": {"score": {"n": 40, "mean": 71.0}}}, "APPROVED", "e2e-dsa-v1",
         "e2e-reviewer", "e2e-data-analyst"),
        ("e2e-analysis-under-review", "DESCRIPTIVES", {"variables": ["score"]},
         {"analysis": "DESCRIPTIVES", "estimates": {"score": {"n": 40, "mean": 72.5}}}, "UNDER_REVIEW", "e2e-dsa-v3",
         None, "e2e-data-analyst"),
    ]
    for aid, atype, config, result, status, version_id, approved_by, created_by in analysis_specs:
        if not db.get(ResearchAnalysis, aid):
            db.add(ResearchAnalysis(id=aid, organization_id="e2e-org", project_id="e2e-project", dataset_id="e2e-dataset-a",
                                    dataset_version_id=version_id, analysis_type=atype, configuration=config,
                                    result=result, engine_version="baseerah-stats-1.0", status=status,
                                    approved_by=approved_by,
                                    approved_at=(stamp() if approved_by else None),
                                    created_by=created_by, created_at=stamp()))
    db.commit()
    print("e2e_seed: research data & analysis fixtures created", flush=True)

print("e2e_seed: seeding publication intelligence fixtures", flush=True)
with SessionLocal() as db:
    from app.models import (
        ScholarlyAsset, PublicationManuscriptVersion, PublicationManuscriptSection,
        PublicationManuscriptAuthorship, PublicationJournal, PublicationJournalShortlist,
        PublicationJournalMatch, PublicationSubmission, PublicationReference,
        PublicationAcceptance, PublicationReportingGuideline,
        PublicationReportingGuidelineItem, PublicationManuscriptGuidelineCheck,
        PublicationManuscriptGuidelineItemStatus,
    )
    # Manuscript asset
    asset = db.get(ScholarlyAsset, "e2e-manuscript")
    if not asset:
        asset = ScholarlyAsset(id="e2e-manuscript", organization_id="e2e-org", owner_user_id="e2e-researcher-user",
                               title_ar="دراسة أثر التدريب على التحصيل", title_en="Effect of training on achievement",
                               asset_type="ARTICLE", lifecycle_status="DRAFT", language="ar",
                               keywords_json=["training", "achievement"], metadata_json={"study_design": "cross_sectional"},
                               created_at=stamp(), updated_at=stamp())
        db.add(asset); db.flush()
    # Approved analysis reference for dependency (dataset v3 is current)
    from app.models import ResearchAnalysis, ResearchDataset as _RD
    analysis = db.query(ResearchAnalysis).filter(ResearchAnalysis.id == "e2e-analysis-approved").first()
    if not analysis:
        analysis = ResearchAnalysis(id="e2e-analysis-approved", organization_id="e2e-org", project_id="e2e-project",
                                    dataset_id="e2e-dataset-a", dataset_version_id="e2e-dsa-v3",
                                    analysis_type="DESCRIPTIVES", configuration={}, result={"mean": 72.5},
                                    engine_version="baseerah-stats-1.0", status="APPROVED",
                                    approved_by="e2e-researcher-user", approved_at=stamp(),
                                    created_by="e2e-data-analyst", created_at=stamp())
        db.add(analysis); db.flush()
    # Manuscript versions v1 DRAFT, v2 INTERNAL REVISION, v3 READY
    version_specs = [
        ("e2e-msv1", 1, "ORIGINAL_RESEARCH", "Initial draft", "DRAFT",
         [{"type": "ANALYSIS", "id": analysis.id, "dataset_version_id": "e2e-dsa-v3", "approved_at": stamp()}]),
        ("e2e-msv2", 2, "ORIGINAL_RESEARCH", "Internal revision", "READY",
         [{"type": "ANALYSIS", "id": analysis.id, "dataset_version_id": "e2e-dsa-v3", "approved_at": stamp()}]),
        ("e2e-msv3", 3, "ORIGINAL_RESEARCH", "Submitted version", "READY",
         [{"type": "ANALYSIS", "id": analysis.id, "dataset_version_id": "e2e-dsa-v3", "approved_at": stamp()}]),
    ]
    version_ids = {}
    for vid, number, atype, summary, status, deps in version_specs:
        v = db.get(PublicationManuscriptVersion, vid)
        if not v:
            import hashlib, json as _json
            fp = hashlib.sha256(_json.dumps({"asset": asset.id, "version": number}, sort_keys=True).encode()).hexdigest()
            v = PublicationManuscriptVersion(id=vid, organization_id="e2e-org", asset_id=asset.id,
                                             version_number=number, article_type=atype, change_summary=summary,
                                             fingerprint=fp, source_dependencies_json=deps,
                                             declarations_json={"conflict_of_interest": "none", "funding": "none",
                                                                "ai_disclosure": "none", "data_availability": "yes"},
                                             created_by="e2e-researcher-user", created_at=stamp())
            db.add(v); db.flush()
            for i, key in enumerate(["TITLE", "ABSTRACT", "KEYWORDS", "INTRODUCTION", "METHODS", "RESULTS",
                                     "DISCUSSION", "CONCLUSION", "REFERENCES", "DECLARATIONS"]):
                db.add(PublicationManuscriptSection(id=f"{vid}-s{i}", organization_id="e2e-org",
                                                    manuscript_version_id=v.id, section_key=key,
                                                    status="READY", content_json={}, updated_at=stamp()))
        version_ids[number] = v.id
    asset.version_number = 3; asset.updated_at = stamp(); db.commit()
    # Authorship: primary + corresponding + co-author
    if not db.query(PublicationManuscriptAuthorship).filter(PublicationManuscriptAuthorship.manuscript_version_id == version_ids[3]).first():
        db.add_all([
            PublicationManuscriptAuthorship(id="e2e-auth-owner", organization_id="e2e-org", manuscript_version_id=version_ids[3],
                                            user_id="e2e-researcher-user", display_name="Primary Researcher",
                                            author_order=1, is_corresponding_author=True,
                                            credit_roles=["Conceptualization", "Writing – Original Draft"],
                                            confirmed_at=stamp(), created_at=stamp(), updated_at=stamp()),
            PublicationManuscriptAuthorship(id="e2e-auth-co", organization_id="e2e-org", manuscript_version_id=version_ids[3],
                                            user_id="e2e-co-researcher", display_name="Co Author",
                                            author_order=2, is_corresponding_author=False,
                                            credit_roles=["Writing – Review & Editing"],
                                            confirmed_at=stamp(), created_at=stamp(), updated_at=stamp()),
        ])
        db.commit()
    # Journal + shortlist (human-selected target)
    journal = db.get(PublicationJournal, "e2e-journal")
    if not journal:
        journal = PublicationJournal(id="e2e-journal", canonical_key="e2e-journal-key", title="E2E Educational Journal",
                                     issn="1234-5679", eissn="1234-5687", publisher="E2E Publisher",
                                     metadata_json={"article_types": ["ORIGINAL_RESEARCH"], "languages": ["en", "ar"],
                                                    "scope_match": 90, "topic_match": 85, "methodology_match": 80,
                                                    "indexing": ["Scopus"], "open_access": True,
                                                    "apc": {"amount": 1200, "currency": "USD", "source": "TEST_PROVIDER",
                                                            "retrieved_at": stamp()}},
                                     provider_name="TEST_PROVIDER", retrieved_at=stamp(), verified_at=stamp(),
                                     stale_after="2030-01-01T00:00:00Z")
        db.add(journal); db.flush()
    if not db.query(PublicationJournalShortlist).filter(PublicationJournalShortlist.asset_id == asset.id,
                                                        PublicationJournalShortlist.journal_id == journal.id).first():
        db.add(PublicationJournalShortlist(id="e2e-shortlist", organization_id="e2e-org", asset_id=asset.id,
                                           journal_id=journal.id, position="PRIMARY",
                                           selected_by="e2e-researcher-user", created_at=stamp()))
    if not db.query(PublicationJournalMatch).filter(PublicationJournalMatch.asset_id == asset.id).first():
        db.add(PublicationJournalMatch(id="e2e-match", organization_id="e2e-org", asset_id=asset.id,
                                       manuscript_version_id=version_ids[3], journal_id=journal.id,
                                       eligibility="ELIGIBLE", score=88,
                                       factors_json={"scope": {"value": 90, "known": True}},
                                       concerns_json=[], metadata_snapshot_json={"provider": "TEST_PROVIDER"},
                                       created_by="e2e-researcher-user", created_at=stamp()))
    # References (one duplicate DOI pair)
    if not db.query(PublicationReference).filter(PublicationReference.manuscript_version_id == version_ids[3]).first():
        db.add_all([
            PublicationReference(id="e2e-ref1", organization_id="e2e-org", manuscript_version_id=version_ids[3],
                                 author="Smith J", title="Learning effects", journal="Journal A", year="2023",
                                 doi="https://doi.org/10.1000/abc", doi_canonical="10.1000/abc",
                                 verification_status="UNVERIFIED", created_at=stamp()),
            PublicationReference(id="e2e-ref2", organization_id="e2e-org", manuscript_version_id=version_ids[3],
                                 author="Jones K", title="Training outcomes", journal="Journal B", year="2024",
                                 doi="doi:10.1000/abc", doi_canonical="10.1000/abc",
                                 verification_status="UNVERIFIED", duplicate_of="e2e-ref1", created_at=stamp()),
        ])
        db.commit()
    # Submission on exact v3
    if not db.query(PublicationSubmission).filter(PublicationSubmission.asset_id == asset.id).first():
        db.add(PublicationSubmission(id="e2e-submission", organization_id="e2e-org", asset_id=asset.id,
                                     journal_id=journal.id, manuscript_version_id=version_ids[3],
                                     package_snapshot_json={"manuscript_fingerprint": "e2e-fp", "files": ["f1"]},
                                     status="UNDER_REVIEW", submitted_by="e2e-researcher-user",
                                     created_at=stamp(), updated_at=stamp()))
        db.commit()
    # Reporting guideline + checklist applied to v3
    guide = db.get(PublicationReportingGuideline, "guide-strobe")
    if not guide:
        guide = PublicationReportingGuideline(id="guide-strobe", name="STROBE", version="1.0", short_name="STROBE",
                                              created_at=stamp())
        db.add(guide); db.flush()
        for n, desc in [("1", "Title and abstract"), ("2", "Background"), ("3", "Objectives")]:
            db.add(PublicationReportingGuidelineItem(id=f"guide-strobe-{n}", guideline_id=guide.id,
                                                     item_number=n, description=desc))
    if not db.query(PublicationManuscriptGuidelineCheck).filter(
            PublicationManuscriptGuidelineCheck.manuscript_version_id == version_ids[3]).first():
        check = PublicationManuscriptGuidelineCheck(id="e2e-guide-check", organization_id="e2e-org",
                                                    manuscript_version_id=version_ids[3], guideline_id=guide.id,
                                                    guideline_version="1.0", status="COMPLETED",
                                                    applied_at=stamp(), applied_by="e2e-researcher-user")
        db.add(check); db.flush()
        for item in db.query(PublicationReportingGuidelineItem).filter(
                PublicationReportingGuidelineItem.guideline_id == guide.id).all():
            db.add(PublicationManuscriptGuidelineItemStatus(id=f"e2e-guide-status-{item.id}", check_id=check.id,
                                                            item_id=item.id, status="PRESENT"))
        db.commit()
    print("e2e_seed: publication intelligence fixtures created", flush=True)

print("e2e_seed: seeding peer review fixtures", flush=True)
with SessionLocal() as db:
    from app.models import (
        PeerReviewCase, PeerReviewRound, ReviewRubric, ReviewCriterion,
        ReviewerAssignment, ExternalReviewerToken, ReviewSubmission,
        ReviewCriterionResponse, ReviewComment,
    )
    asset = db.get(ScholarlyAsset, "e2e-manuscript")

    def _hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # Extra personas beyond the ones already seeded above (metadata_user
    # doubles as "Internal Reviewer B" — a plain researcher, not a co-author,
    # so it carries no conflict of interest on the bound manuscript).
    reviewer_a = "e2e-reviewer"          # already seeded above
    reviewer_b = "e2e-metadata-user"     # already seeded above
    # The case author is deliberately NOT e2e-researcher-user: that account
    # is the organization OWNER, which always qualifies as editor via
    # bootstrap authority (role == "OWNER") regardless of any per-case
    # editor_user_id — using it as "author" would make it impossible to
    # exercise the "author who is NOT editor" half of double-blind masking.
    case_author = "e2e-co-researcher"    # RESEARCHER role, not org OWNER
    case_editor = "e2e-data-analyst"     # RESEARCHER role, explicit per-case delegate

    rubric = db.get(ReviewRubric, "e2e-pr-rubric")
    if not rubric:
        rubric = ReviewRubric(id="e2e-pr-rubric", organization_id="e2e-org",
                              name_ar="نموذج تحكيم تجريبي", name_en="E2E Review Rubric",
                              rubric_type="GENERAL_MANUSCRIPT", version=1, is_default=True,
                              status="ACTIVE", created_at=stamp())
        db.add(rubric); db.flush()
        db.add(ReviewCriterion(id="e2e-pr-crit-1", rubric_id=rubric.id, code="METHODOLOGY",
                               title_ar="المنهجية", title_en="Methodology", response_type="SCORE",
                               weight=1.0, is_mandatory=True, sort_order=1, created_at=stamp()))
        db.commit()

    case = db.get(PeerReviewCase, "e2e-review-case")
    if not case:
        msv3 = db.get(PublicationManuscriptVersion, "e2e-msv3")
        case = PeerReviewCase(
            id="e2e-review-case", organization_id="e2e-org", owner_user_id=case_author,
            editor_user_id=case_editor,
            project_id="e2e-project", scholarly_asset_id="e2e-manuscript",
            manuscript_version_id=msv3.id, manuscript_fingerprint=msv3.fingerprint,
            publication_submission_id="e2e-submission",
            title_ar=asset.title_ar, title_en=asset.title_en,
            case_type="MANUSCRIPT", blind_type="DOUBLE_BLIND", status="IN_REVIEW",
            current_round_number=2, created_at=stamp(), updated_at=stamp(),
        )
        db.add(case); db.flush()

        rubric_snapshot = {"rubric_id": rubric.id, "name_ar": rubric.name_ar, "name_en": rubric.name_en,
                           "version": rubric.version,
                           "criteria": [{"id": c.id, "code": c.code, "title_ar": c.title_ar, "title_en": c.title_en,
                                        "desc_ar": c.desc_ar, "response_type": c.response_type, "weight": c.weight,
                                        "is_mandatory": c.is_mandatory, "sort_order": c.sort_order}
                                       for c in db.query(ReviewCriterion).filter(ReviewCriterion.rubric_id == rubric.id).all()]}

        # Round 1: COMPLETED, decided REVISION_REQUIRED — must remain
        # historical/unchanged after Round 2 exists.
        round1 = PeerReviewRound(id="e2e-pr-round-1", case_id=case.id, round_number=1, manuscript_version=2,
                                 status="COMPLETED",
                                 manuscript_snapshot_json={"title_ar": asset.title_ar, "title_en": asset.title_en, "version_number": 2},
                                 rubric_id=rubric.id, rubric_snapshot_json=rubric_snapshot,
                                 decision="REVISION_REQUIRED", decision_notes="يرجى توضيح المنهجية الإحصائية.",
                                 decision_by_user_id=case_editor, decision_at=stamp(), created_at=stamp())
        db.add(round1); db.flush()

        asg_a_r1 = ReviewerAssignment(id="e2e-pr-asg-a-r1", case_id=case.id, round_id=round1.id,
                                      reviewer_type="INTERNAL_REVIEWER", reviewer_user_id=reviewer_a,
                                      status="SUBMITTED", conflict_status="NO_CONFLICT",
                                      invited_at=stamp(), accepted_at=stamp(), submitted_at=stamp(), created_at=stamp())
        db.add(asg_a_r1); db.flush()
        sub_a_r1 = ReviewSubmission(id="e2e-pr-sub-a-r1", assignment_id=asg_a_r1.id, round_id=round1.id, case_id=case.id,
                                    status="SUBMITTED", recommendation="MAJOR_REVISION",
                                    summary_evaluation_ar="يحتاج البحث لمراجعة المنهجية.",
                                    total_weighted_score=6.0, is_confidential_to_editor=False,
                                    submitted_at=stamp(), created_at=stamp(), updated_at=stamp())
        db.add(sub_a_r1); db.flush()
        db.add(ReviewCriterionResponse(id="e2e-pr-resp-a-r1", submission_id=sub_a_r1.id, criterion_id="e2e-pr-crit-1",
                                       score_value=6.0, comments="المنهجية تحتاج توضيحًا.", created_at=stamp()))
        db.add(ReviewComment(id="e2e-pr-cmt-a-r1-visible", submission_id=sub_a_r1.id, case_id=case.id, round_id=round1.id,
                             section_key="METHODS", comment_type="AUTHOR_VISIBLE",
                             comment_text="يرجى توضيح حجم العينة وطريقة اختيارها.", created_at=stamp()))
        db.add(ReviewComment(id="e2e-pr-cmt-a-r1-confidential", submission_id=sub_a_r1.id, case_id=case.id, round_id=round1.id,
                             section_key="EDITOR", comment_type="CONFIDENTIAL_TO_EDITOR",
                             comment_text="ملاحظة سرية للمحرر فقط: أشك في دقة التحليل الإحصائي المُبلغ عنه.", created_at=stamp()))

        # Round 2: ACTIVE (current) — bound to the newer manuscript version.
        round2 = PeerReviewRound(id="e2e-pr-round-2", case_id=case.id, round_number=2, manuscript_version=3,
                                 status="ACTIVE",
                                 manuscript_snapshot_json={"title_ar": asset.title_ar, "title_en": asset.title_en, "version_number": 3},
                                 rubric_id=rubric.id, rubric_snapshot_json=rubric_snapshot,
                                 decision="PENDING", created_at=stamp())
        db.add(round2); db.flush()

        # Reviewer A on round 2: accepted, in progress (draft saved).
        asg_a_r2 = ReviewerAssignment(id="e2e-pr-asg-a-r2", case_id=case.id, round_id=round2.id,
                                      reviewer_type="INTERNAL_REVIEWER", reviewer_user_id=reviewer_a,
                                      status="IN_PROGRESS", conflict_status="NO_CONFLICT",
                                      invited_at=stamp(), accepted_at=stamp(), created_at=stamp())
        db.add(asg_a_r2); db.flush()
        db.add(ReviewSubmission(id="e2e-pr-sub-a-r2", assignment_id=asg_a_r2.id, round_id=round2.id, case_id=case.id,
                                status="DRAFT", recommendation="MINOR_REVISION",
                                summary_evaluation_ar="مسودة أولية.", total_weighted_score=0.0,
                                is_confidential_to_editor=False, created_at=stamp(), updated_at=stamp()))

        # Reviewer B on round 2: submitted a distinct, private report — used
        # to verify Reviewer A never sees Reviewer B's confidential content.
        asg_b_r2 = ReviewerAssignment(id="e2e-pr-asg-b-r2", case_id=case.id, round_id=round2.id,
                                      reviewer_type="INTERNAL_REVIEWER", reviewer_user_id=reviewer_b,
                                      status="SUBMITTED", conflict_status="NO_CONFLICT",
                                      invited_at=stamp(), accepted_at=stamp(), submitted_at=stamp(), created_at=stamp())
        db.add(asg_b_r2); db.flush()
        sub_b_r2 = ReviewSubmission(id="e2e-pr-sub-b-r2", assignment_id=asg_b_r2.id, round_id=round2.id, case_id=case.id,
                                    status="SUBMITTED", recommendation="ACCEPT",
                                    summary_evaluation_ar="بحث جيد بعد التعديلات.",
                                    total_weighted_score=9.0, is_confidential_to_editor=False,
                                    submitted_at=stamp(), created_at=stamp(), updated_at=stamp())
        db.add(sub_b_r2); db.flush()
        db.add(ReviewComment(id="e2e-pr-cmt-b-r2-confidential", submission_id=sub_b_r2.id, case_id=case.id, round_id=round2.id,
                             section_key="EDITOR", comment_type="CONFIDENTIAL_TO_EDITOR",
                             comment_text="CONFIDENTIAL_REVIEWER_B_ONLY — private note visible to the editor alone.",
                             created_at=stamp()))

        # External reviewer on round 2: valid, expired, and revoked tokens.
        asg_ext = ReviewerAssignment(id="e2e-pr-asg-ext", case_id=case.id, round_id=round2.id,
                                     reviewer_type="EXTERNAL_REVIEWER", external_email="external.referee@e2e.invalid",
                                     external_name="External Referee", status="INVITED", conflict_status="NO_CONFLICT",
                                     invited_at=stamp(), created_at=stamp())
        db.add(asg_ext); db.flush()
        db.add(ExternalReviewerToken(id="e2e-pr-tok-valid", assignment_id=asg_ext.id,
                                     token_hash=_hash_token("e2e_valid_external_reviewer_token_seed"),
                                     expires_at="2036-08-25T00:00:00Z", created_at=stamp()))

        asg_ext_expired = ReviewerAssignment(id="e2e-pr-asg-ext-expired", case_id=case.id, round_id=round2.id,
                                             reviewer_type="EXTERNAL_REVIEWER", external_email="expired.referee@e2e.invalid",
                                             external_name="Expired Referee", status="INVITED", conflict_status="NO_CONFLICT",
                                             invited_at=stamp(), created_at=stamp())
        db.add(asg_ext_expired); db.flush()
        db.add(ExternalReviewerToken(id="e2e-pr-tok-expired", assignment_id=asg_ext_expired.id,
                                     token_hash=_hash_token("e2e_expired_external_reviewer_token_seed"),
                                     expires_at="2020-01-01T00:00:00Z", created_at=stamp()))

        asg_ext_revoked = ReviewerAssignment(id="e2e-pr-asg-ext-revoked", case_id=case.id, round_id=round2.id,
                                             reviewer_type="EXTERNAL_REVIEWER", external_email="revoked.referee@e2e.invalid",
                                             external_name="Revoked Referee", status="INVITED", conflict_status="NO_CONFLICT",
                                             invited_at=stamp(), created_at=stamp())
        db.add(asg_ext_revoked); db.flush()
        db.add(ExternalReviewerToken(id="e2e-pr-tok-revoked", assignment_id=asg_ext_revoked.id,
                                     token_hash=_hash_token("e2e_revoked_external_reviewer_token_seed"),
                                     expires_at="2036-08-25T00:00:00Z", revoked_at=stamp(),
                                     revoked_by="e2e-researcher-user", created_at=stamp()))

        db.commit()
    print("e2e_seed: peer review fixtures created", flush=True)

print("e2e_seed: seeding academic promotion fixtures", flush=True)
with SessionLocal() as db:
    from app.models import PromotionPolicy, PromotionApplication, PromotionAssetSelection, PromotionEvaluationSnapshot, PromotionCommitteeAssignment
    from app.routers.promotions import seed_default_institutional_policy
    from app.services.promotion_evaluator import compute_evidence_points, generate_evaluation_fingerprint

    # e2e-co-researcher (RESEARCHER role, not org OWNER) is the applicant —
    # exercises the real ownership-scoped evidence rules (an applicant may
    # only attach ScholarlyAssets they themselves own).
    applicant_id = "e2e-co-researcher"
    # Committee decision authority is resource-scoped (PromotionCommitteeAssignment)
    # — org role alone (even OWNER/ORGANIZATION_ADMIN) grants nothing. e2e-org-admin
    # is explicitly assigned below so it remains a valid "real committee member"
    # persona for E2E tests, distinct from e2e-researcher-user (OWNER, used to
    # exercise read-only institutional oversight WITHOUT committee authority) and
    # e2e-platform-admin (SystemAdmin, used to prove platform admin gets nothing).
    committee_member_id = "e2e-org-admin"

    policy = db.query(PromotionPolicy).filter(
        PromotionPolicy.organization_id == "e2e-org",
        PromotionPolicy.is_default == True  # noqa: E712
    ).first()
    if not policy:
        policy = seed_default_institutional_policy("e2e-org", db, applicant_id)

    asset_q1 = db.get(ScholarlyAsset, "e2e-promo-asset-q1")
    if not asset_q1:
        asset_q1 = ScholarlyAsset(id="e2e-promo-asset-q1", organization_id="e2e-org", owner_user_id=applicant_id,
                                   title_ar="النمذجة الإحصائية في التعليم العالي", title_en="Statistical Modeling in Higher Education",
                                   asset_type="ARTICLE", lifecycle_status="PUBLISHED", language="ar",
                                   keywords_json=["statistics", "higher_education"],
                                   metadata_json={"journal_rank": "Q1", "author_role": "sole"},
                                   created_at=stamp(), updated_at=stamp())
        db.add(asset_q1); db.flush()

    asset_q2 = db.get(ScholarlyAsset, "e2e-promo-asset-q2")
    if not asset_q2:
        asset_q2 = ScholarlyAsset(id="e2e-promo-asset-q2", organization_id="e2e-org", owner_user_id=applicant_id,
                                   title_ar="تجربة تعليمية شبه تجريبية في القياس النفسي", title_en="A Quasi-Experimental Study in Psychometrics",
                                   asset_type="ARTICLE", lifecycle_status="PUBLISHED", language="ar",
                                   keywords_json=["psychometrics", "quasi_experimental"],
                                   metadata_json={"journal_rank": "Q2", "author_role": "first"},
                                   created_at=stamp(), updated_at=stamp())
        db.add(asset_q2); db.flush()

    application = db.query(PromotionApplication).filter(
        PromotionApplication.organization_id == "e2e-org",
        PromotionApplication.user_id == applicant_id
    ).first()
    if not application:
        application = PromotionApplication(
            id="e2e-promo-app", organization_id="e2e-org", user_id=applicant_id,
            policy_id=policy.id, policy_version=policy.version,
            current_rank="ASSISTANT_PROFESSOR", target_rank="ASSOCIATE_PROFESSOR",
            status="DRAFT", readiness_percentage=0, total_calculated_points=0.0,
            created_at=stamp(), updated_at=stamp()
        )
        db.add(application); db.flush()

        for asset in (asset_q1, asset_q2):
            points = compute_evidence_points(asset)
            db.add(PromotionAssetSelection(
                id=f"e2e-pas-{asset.id}", promotion_application_id=application.id,
                scholarly_asset_id=asset.id, eligibility_status="ELIGIBLE",
                calculated_points=points, evidence_status="SUBMITTED",
                evidence_snapshot_json={
                    "asset_id": asset.id, "title_ar": asset.title_ar, "title_en": asset.title_en,
                    "journal_name": asset.journal_name, "publication_date": asset.publication_date,
                    "doi": asset.doi, "metadata": asset.metadata_json or {}
                },
                verification_status="UNVERIFIED", created_at=stamp()
            ))
        db.flush()  # SessionLocal uses autoflush=False — the query below needs these visible.

        # A real evaluation snapshot reflecting genuine partial progress (2 of
        # 4 mandatory papers, ~31 of 40 required points) — deliberately left
        # DRAFT/not-fully-ready rather than a trivial 0% or 100% fixture, and
        # deliberately not submitted, so the E2E suite can exercise the full
        # forward path (add more evidence, evaluate, submit, committee review)
        # starting from this fixture.
        selections = db.query(PromotionAssetSelection).filter(
            PromotionAssetSelection.promotion_application_id == application.id
        ).all()
        fingerprint = generate_evaluation_fingerprint(policy.id, policy.version, application.target_rank, selections)
        total_points = round(sum(s.calculated_points for s in selections), 2)
        application.total_calculated_points = total_points
        application.readiness_percentage = 58  # mandatory_ratio 0.5*70 + points_ratio(31.25/40)*30 ≈ 58
        application.evaluation_fingerprint = fingerprint
        application.evaluation_summary_json = {
            "application_id": application.id, "policy_id": policy.id,
            "policy_name_ar": policy.name_ar, "policy_name_en": policy.name_en,
            "policy_version": policy.version, "target_rank": application.target_rank,
            "readiness_percentage": 58, "is_fully_ready": False,
            "total_calculated_points": total_points, "total_required_points": 40.0,
            "total_evidence_count": len(selections), "mandatory_criteria_satisfied": False,
            "criteria_results": [], "recommendations_ar": [], "recommendations_en": [],
            "evaluated_at": stamp(), "is_stale": False, "evaluation_fingerprint": fingerprint
        }
        db.add(PromotionEvaluationSnapshot(
            id="e2e-promo-snap-1", application_id=application.id, policy_id=policy.id,
            policy_version=policy.version, readiness_percentage=58, total_points=total_points,
            criteria_results_json=[], evaluation_fingerprint=fingerprint,
            evaluated_by=applicant_id, evaluated_at=stamp()
        ))
        db.add(PromotionCommitteeAssignment(
            id="e2e-promo-committee-1", organization_id="e2e-org", application_id=application.id,
            user_id=committee_member_id, assigned_by="e2e-researcher-user", status="ACTIVE",
            assigned_at=stamp()
        ))
        db.commit()
    print("e2e_seed: academic promotion fixtures created", flush=True)

print("e2e_seed: seeding academic identity fixtures", flush=True)
with SessionLocal() as db:
    from app.models import UnifiedAcademicProfile, AcademicIdentifier, AcademicAffiliation

    # Public, complete profile for e2e_researcher — the Public Profile
    # Journey target. e2e-manuscript (seeded above, DRAFT lifecycle_status,
    # PUBLIC visibility by default, owned by this same user) doubles as the
    # "must never leak while unpublished" regression fixture: it must NOT
    # appear in this profile's public portfolio even though its visibility
    # defaults to PUBLIC (ACCEPTED/DRAFT != PUBLISHED).
    profile = db.get(UnifiedAcademicProfile, "e2e-identity-profile")
    if not profile:
        profile = UnifiedAcademicProfile(
            id="e2e-identity-profile", user_id="e2e-researcher-user", organization_id="e2e-org",
            preferred_name_ar="د. سارة الباحثة", preferred_name_en="Dr. Sarah Researcher",
            academic_title="Associate Professor", current_rank="Associate Professor",
            country="Saudi Arabia", university="KSU", college="Science", department="Physics",
            general_specialization="Physics", specific_specialization="Nanotechnology",
            discipline="Physics", research_interests_json=["Quantum mechanics", "Nanomaterials"],
            keywords_ar_json=["نانو"], keywords_en_json=["nano"],
            institutional_email="sarah@ksu.edu.sa", public_email="sarah.researcher@example.com",
            short_bio_ar="أستاذة مشاركة متخصصة في فيزياء النانو ولها أبحاث منشورة في مجلات علمية محكمة.",
            short_bio_en="Associate Professor specializing in nanophysics with peer-reviewed publications.",
            visibility_status="PUBLIC", completeness_score=80,
            created_at=stamp(), updated_at=stamp()
        )
        db.add(profile); db.flush()
        db.add(AcademicIdentifier(
            id="e2e-identity-orcid", profile_id=profile.id, identifier_type="ORCID",
            identifier_value="0000-0002-1825-0097", profile_url="https://orcid.org/0000-0002-1825-0097",
            status="UNVERIFIED", verification_method="SELF_DECLARED"
        ))
        db.add(AcademicAffiliation(
            id="e2e-identity-affiliation", profile_id=profile.id, organization_name="King Saud University",
            college="College of Science", department="Department of Physics", position_title="Associate Professor",
            academic_rank="Associate Professor", start_date="2020-01-01", is_current=True,
            country="Saudi Arabia", verification_status="UNVERIFIED"
        ))
        db.commit()

    # Self-declared, genuinely PUBLISHED (visible) asset — distinct from
    # e2e-manuscript so the public portfolio's expected content is
    # deterministic (exactly one item) for e2e assertions.
    published_asset = db.get(ScholarlyAsset, "e2e-identity-published-asset")
    if not published_asset:
        db.add(ScholarlyAsset(
            id="e2e-identity-published-asset", organization_id="e2e-org", owner_user_id="e2e-researcher-user",
            title_ar="دور المواد النانوية في التطبيقات الطبية", title_en="Role of Nanomaterials in Biomedical Applications",
            abstract_en="A published study on biomedical applications of engineered nanomaterials.",
            asset_type="JOURNAL_PAPER", lifecycle_status="PUBLISHED", language="ar", visibility="PUBLIC",
            journal_name="Nano Letters", doi="10.1016/j.nano.2025.09.011", publication_date="2025-09-01",
            created_at=stamp(), updated_at=stamp()
        ))
        db.commit()

    # Non-public profile for e2e_co_researcher — proves the public endpoint
    # 404s for INSTITUTIONAL/PRIVATE visibility, not just missing profiles.
    private_profile = db.get(UnifiedAcademicProfile, "e2e-identity-profile-private")
    if not private_profile:
        db.add(UnifiedAcademicProfile(
            id="e2e-identity-profile-private", user_id="e2e-co-researcher", organization_id="e2e-org",
            preferred_name_en="Private Co-Researcher", visibility_status="PRIVATE",
            completeness_score=20, created_at=stamp(), updated_at=stamp()
        ))
        db.commit()
    print("e2e_seed: academic identity fixtures created", flush=True)

# Thesis registration: without this, /app/research/thesis shows the
# registration gate instead of the Thesis Operations dashboard, since a
# thesis must be registered against a project before its command center
# renders (see app.routers.thesis_workflow.register_thesis_for_project).
from app.models import ThesisRecord  # noqa: E402
from app.services.thesis_workflow import ensure_active_policy, create_thesis  # noqa: E402

with SessionLocal() as db:
    existing_thesis = db.query(ThesisRecord).filter(ThesisRecord.project_id == "e2e-project").first()
    if not existing_thesis:
        project = db.get(ResearchProject, "e2e-project")
        policy = ensure_active_policy(db, "e2e-org", "MASTERS", "e2e-researcher-user")
        create_thesis(db, project, policy, "e2e-researcher-user", "E2E Master's Program", "e2e-researcher-user", "EMPIRICAL")
        db.commit()
    print("e2e_seed: thesis registration fixture created", flush=True)

engine.dispose()
print("E2E database prepared with deterministic non-production fixtures", flush=True)
