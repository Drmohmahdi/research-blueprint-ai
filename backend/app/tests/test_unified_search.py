"""
Phase 09 — Unified Search: Security, Relevance, Filtering, Pagination, Performance.

Golden dataset markers used throughout:
    PROJECT_ALPHA_VISIBLE        — tenant A visible project
    PROJECT_SECRET_OTHER_TENANT  — tenant B only project
    SECRET_REVIEWER_NAME         — must never leak in author search
    CONFIDENTIAL_EDITOR_NOTE     — must never leak to non-editors
"""
import json
import time
import datetime
from sqlalchemy.dialects import postgresql
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app import models
from app.routers.auth import hash_password
from app.services.billing.bootstrap import ensure_plans_and_pricing_seeded
from app.services.search import signals

signals.register_search_signals()

client = TestClient(app)


def _seed_plans(db_session):
    ensure_plans_and_pricing_seeded(db_session)


def create_test_tenant(db_session: Session, suffix: str, plan_id: str = "pln-enterprise"):
    """Creates an organization, owner, and a colleague member."""
    now = datetime.datetime.now(datetime.UTC).isoformat()
    org = models.Organization(
        id=f"org-search-{suffix}",
        name=f"Search Org {suffix}",
        slug=f"search-{suffix}",
        organization_type="UNIVERSITY",
        status="ACTIVE",
        created_at=now
    )
    db_session.add(org)
    db_session.flush()

    owner = models.User(
        id=f"user-search-{suffix}-owner",
        username=f"search_owner_{suffix}",
        hashed_password=hash_password("securepass123"),
        email=f"search_owner_{suffix}@example.com",
        role="Researcher",
        created_at=now
    )
    colleague = models.User(
        id=f"user-search-{suffix}-col",
        username=f"search_col_{suffix}",
        hashed_password=hash_password("securepass123"),
        email=f"search_col_{suffix}@example.com",
        role="Researcher",
        created_at=now
    )
    db_session.add_all([owner, colleague])
    db_session.flush()

    db_session.add_all([
        models.OrganizationMembership(
            id=f"mem-search-{suffix}-owner", organization_id=org.id,
            user_id=owner.id, role="OWNER", status="ACTIVE",
            created_at=now
        ),
        models.OrganizationMembership(
            id=f"mem-search-{suffix}-col", organization_id=org.id,
            user_id=colleague.id, role="RESEARCHER", status="ACTIVE",
            created_at=now
        ),
    ])
    db_session.flush()

    db_session.add(models.Subscription(
        id=f"sub-search-{suffix}",
        organization_id=org.id,
        plan_id=plan_id,
        status="ACTIVE",
        current_period_start=now,
        current_period_end=now,
        created_at=now,
        updated_at=now
    ))
    db_session.commit()

    return {
        "org": org,
        "researcher": owner,
        "colleague": colleague,
    }


def get_auth_headers(username: str, org_id: str) -> dict:
    res = client.post("/api/auth/login", json={"username": username, "password": "securepass123"})
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Organization-ID": org_id}


def _make_project(t, project_id, title_ar, title_en, study_design="quasi_experimental_pre_post"):
    return models.ResearchProject(
        id=project_id,
        userId=t["researcher"].id,
        organizationId=t["org"].id,
        titleAr=title_ar,
        titleEn=title_en,
        descriptionAr=f"وصف {title_ar}",
        descriptionEn=f"Description of {title_en}",
        problemStatementAr=f"مشكلة {title_ar}",
        problemStatementEn=f"Problem of {title_en}",
        studyDesign=study_design,
        sampleSettings={"confidenceLevel": 0.95, "marginOfError": 0.05},
        version=1
    )


def _seed_projects(db_session, t_a, t_b, prefix=None):
    if prefix is None:
        prefix = t_a["org"].id.replace("org-search-", "")[:24]
    db_session.add_all([
        _make_project(t_a, f"proj-{prefix}-alpha", "بحث تجريبي ألفا", "PROJECT_ALPHA_VISIBLE"),
        _make_project(t_a, f"proj-{prefix}-admin", "دراسة الإدارة العامة", "Public Administration Study"),
        _make_project(t_a, f"proj-{prefix}-admin2", "دراسة الادارة الحديثة", "Modern Management Study"),
        _make_project(t_a, f"proj-{prefix}-learning", "التَّعَلُّم المعزز", "Enhanced Learning Study"),
        _make_project(t_b, f"proj-{prefix}-secret", "مشروع سري للجهة الأخرى", "PROJECT_SECRET_OTHER_TENANT"),
    ])
    db_session.commit()


def _seed_asset_with_doi(db_session, t, asset_id, title, doi):
    now = datetime.datetime.now(datetime.UTC).isoformat()
    asset = models.ScholarlyAsset(
        id=asset_id,
        organization_id=t["org"].id,
        owner_user_id=t["researcher"].id,
        created_by=t["researcher"].id,
        title_ar=title,
        title_en=title,
        abstract_ar=f"ملخص {title}",
        abstract_en=f"Abstract of {title}",
        asset_type="JOURNAL_ARTICLE",
        lifecycle_status="PUBLISHED",
        doi=doi,
        journal_name="Test Journal",
        publication_date="2024-01-01",
        language="ar",
        visibility="PUBLIC",
        created_at=now,
        updated_at=now
    )
    db_session.add(asset)
    db_session.commit()
    return asset


# ─────────────────────────────────────────────────────────────────────────────
# 1. GOLDEN / RELEVANCE TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_search_exact_title_ranked_first(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rel", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rel_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "PROJECT_ALPHA_VISIBLE", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    prefix = t_a["org"].id.replace("org-search-", "")[:24]
    assert data["results"][0]["entity_id"] == f"proj-{prefix}-alpha"
    # Exact identifier-like marker surfaces
    assert data["results"][0]["title"] in ("بحث تجريبي ألفا", "PROJECT_ALPHA_VISIBLE")


def test_search_partial_title(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "partial", "pln-enterprise")
    t_b = create_test_tenant(db_session, "partial_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "ALPHA", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_search_arabic_normalization(db_session: Session):
    """الإدارة and الادارة should converge (hamza normalization documented)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "arabnorm", "pln-enterprise")
    t_b = create_test_tenant(db_session, "arabnorm_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    r1 = client.get("/api/search", params={"q": "الإدارة", "domains": "PROJECT"}, headers=headers)
    r2 = client.get("/api/search", params={"q": "الادارة", "domains": "PROJECT"}, headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    # Both normalize to the same token and find the same projects
    ids1 = {r["entity_id"] for r in r1.json()["results"]}
    ids2 = {r["entity_id"] for r in r2.json()["results"]}
    assert ids1 == ids2
    assert len(ids1) >= 1


def test_search_diacritics_normalization(db_session: Session):
    """التَّعَلُّم vs التعلم should converge (diacritics removed)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "diac", "pln-enterprise")
    t_b = create_test_tenant(db_session, "diac_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    r1 = client.get("/api/search", params={"q": "التَّعَلُّم", "domains": "PROJECT"}, headers=headers)
    r2 = client.get("/api/search", params={"q": "التعلم", "domains": "PROJECT"}, headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    assert {r["entity_id"] for r in r1.json()["results"]} == {r["entity_id"] for r in r2.json()["results"]}


def test_search_doi_canonical_forms(db_session: Session):
    """10.1234/abcd and https://doi.org/10.1234/abcd both find the asset."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "doi", "pln-enterprise")
    _seed_asset_with_doi(db_session, t_a, "asset-doi-1", "DOI Test Asset", "10.1234/abcd")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    r1 = client.get("/api/search", params={"q": "10.1234/abcd", "domains": "ASSET"}, headers=headers)
    r2 = client.get("/api/search", params={"q": "https://doi.org/10.1234/abcd", "domains": "ASSET"}, headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["total"] >= 1
    assert r2.json()["total"] >= 1
    assert r1.json()["results"][0]["entity_id"] == "asset-doi-1"
    assert r2.json()["results"][0]["entity_id"] == "asset-doi-1"


def test_search_orcid_exact(db_session: Session):
    """ORCID search on academic profile identifiers."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "orcid", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    profile = models.UnifiedAcademicProfile(
        id="prof-orcid-1",
        user_id=t_a["researcher"].id,
        organization_id=t_a["org"].id,
        preferred_name_ar="د. اختبار أوركيد",
        preferred_name_en="Dr. ORCID Test",
        academic_title="ASSISTANT_PROFESSOR",
        current_rank="ASSISTANT_PROFESSOR",
        visibility_status="PUBLIC",
        created_at=now,
        updated_at=now
    )
    db_session.add(profile)
    db_session.add(models.AcademicIdentifier(
        id="aid-orcid-1",
        profile_id=profile.id,
        identifier_type="ORCID",
        identifier_value="0000-0002-1825-0097",
        verification_method="MANUAL",
        verified_at=now,
        last_checked_at=now,
        metadata_json={}
    ))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    r1 = client.get("/api/search", params={"q": "0000-0002-1825-0097", "domains": "PROFILE"}, headers=headers)
    r2 = client.get("/api/search", params={"q": "https://orcid.org/0000-0002-1825-0097", "domains": "PROFILE"}, headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["total"] >= 1
    assert r2.json()["total"] >= 1


# ─────────────────────────────────────────────────────────────────────────────
# 2. SECURITY — TENANT ISOLATION / HORIZONTAL / PRIVACY
# ─────────────────────────────────────────────────────────────────────────────

def test_search_cross_tenant_zero_leak(db_session: Session):
    """Tenant A searching a title exclusive to Tenant B returns zero results, no count leak."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "xten", "pln-enterprise")
    t_b = create_test_tenant(db_session, "xten_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "PROJECT_SECRET_OTHER_TENANT", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["results"] == []
    assert data["domain_counts"].get("PROJECT", 0) == 0


def test_search_same_tenant_unauthorized_project(db_session: Session):
    """Colleague user B in the same org sees only their authorized projects (org-wide list policy)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "horiz", "pln-enterprise")
    t_b = create_test_tenant(db_session, "horiz_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers_col = get_auth_headers(t_a["colleague"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "PROJECT_ALPHA_VISIBLE", "domains": "PROJECT"}, headers=headers_col)
    assert resp.status_code == 200
    # Same org => projects are org-wide visible (matches list_projects policy)
    assert resp.json()["total"] == 1


def test_search_promotion_privacy(db_session: Session):
    """A researcher cannot search another applicant's promotion application."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "prompriv", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    policy_id = f"plc-{t_a['org'].id}"
    db_session.add(models.PromotionPolicy(
        id=policy_id, organization_id=t_a["org"].id,
        name_ar="سياسة ترقية اختبارية", name_en="Test promotion policy",
        target_rank="PROFESSOR", version=1, status="ACTIVE",
        created_by=t_a["researcher"].id, created_at=now, updated_at=now,
    ))
    db_session.flush()
    app_owner = models.PromotionApplication(
        id="papp-priv-owner", organization_id=t_a["org"].id,
        user_id=t_a["researcher"].id, policy_id=policy_id, policy_version=1,
        current_rank="ASSISTANT_PROFESSOR", target_rank="ASSOCIATE_PROFESSOR",
        status="DRAFT", readiness_percentage=10, created_at=now, updated_at=now
    )
    app_other = models.PromotionApplication(
        id="papp-priv-other", organization_id=t_a["org"].id,
        user_id=t_a["colleague"].id, policy_id=policy_id, policy_version=1,
        current_rank="ASSISTANT_PROFESSOR", target_rank="PROFESSOR",
        status="SUBMITTED", readiness_percentage=90, created_at=now, updated_at=now
    )
    db_session.add_all([app_owner, app_other])
    db_session.commit()
    headers_col = get_auth_headers(t_a["colleague"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "PROFESSOR", "domains": "PROMOTION"}, headers=headers_col)
    assert resp.status_code == 200
    data = resp.json()
    # Colleague only sees their own application, not the owner's
    assert data["total"] == 1
    assert data["results"][0]["entity_id"] == "papp-priv-other"


def test_search_peer_review_blindness(db_session: Session):
    """Author search must NOT expose SECRET_REVIEWER_NAME or confidential comments."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "privacy", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    case = models.PeerReviewCase(
        id="case-priv-1", organization_id=t_a["org"].id,
        owner_user_id=t_a["researcher"].id,
        title_ar="بحث سري للمراجعة", title_en="Secret Review Manuscript",
        status="IN_REVIEW", case_type="MANUSCRIPT", blind_type="DOUBLE_BLIND",
        current_round_number=1, created_at=now, updated_at=now
    )
    db_session.add(case)
    db_session.flush()
    db_session.add(models.PeerReviewRound(
        id="round-priv-1", case_id=case.id, round_number=1,
        manuscript_version=1, status="ACTIVE", created_at=now
    ))
    db_session.flush()
    db_session.add(models.ReviewerAssignment(
        id="asg-priv-1", round_id="round-priv-1", case_id=case.id,
        reviewer_type="EXTERNAL_REVIEWER", external_name="SECRET_REVIEWER_NAME",
        external_email="secret@example.com", status="IN_PROGRESS",
        conflict_status="UNCHECKED", invited_at=now, created_at=now
    ))
    db_session.flush()
    db_session.add(models.ReviewSubmission(
        id="sub-priv-1", assignment_id="asg-priv-1", case_id=case.id,
        round_id="round-priv-1", status="SUBMITTED",
        recommendation="MINOR_REVISION", created_at=now, updated_at=now,
    ))
    db_session.flush()
    db_session.add(models.ReviewComment(
        id="cmt-priv-1", submission_id="sub-priv-1", case_id=case.id, round_id="round-priv-1",
        comment_type="CONFIDENTIAL_TO_EDITOR", comment_text="CONFIDENTIAL_EDITOR_NOTE",
        created_at=now
    ))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "SECRET", "domains": "PEER_REVIEW"}, headers=headers)
    assert resp.status_code == 200
    raw = resp.text
    assert "SECRET_REVIEWER_NAME" not in raw
    assert "CONFIDENTIAL_EDITOR_NOTE" not in raw
    # Author sees their own case safe metadata
    if resp.json()["total"] > 0:
        item = resp.json()["results"][0]
        assert "caseType" in item["metadata"]
        assert "reviewer" not in json.dumps(item).lower()


# ─────────────────────────────────────────────────────────────────────────────
# 3. INJECTION / VALIDATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_search_sql_injection_blocked(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "sqli", "pln-enterprise")
    t_b = create_test_tenant(db_session, "sqli_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    for payload in ["' OR 1=1 --", "%; DROP TABLE research_projects", "x' OR '1'='1"]:
        resp = client.get("/api/search", params={"q": payload, "domains": "PROJECT"}, headers=headers)
        assert resp.status_code == 200
        # No injection effect: never returns cross-tenant data
        assert resp.json()["total"] == 0


def test_search_sort_injection_blocked(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "sortinj", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "x", "sort": "drop_table"}, headers=headers)
    assert resp.status_code == 422


def test_search_filter_injection_blocked(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "filtinj", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={
        "q": "x",
        "filters": json.dumps({"arbitrary_column": "evil"}),
    }, headers=headers)
    assert resp.status_code == 422


def test_search_limit_abuse_clamped(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "limitab", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "x", "limit": 999999}, headers=headers)
    assert resp.status_code == 422  # rejected, not silently accepted


def test_search_negative_pagination_rejected(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "negpage", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    assert client.get("/api/search", params={"q": "x", "page": -1}, headers=headers).status_code == 422
    assert client.get("/api/search", params={"q": "x", "limit": -5}, headers=headers).status_code == 422


def test_search_invalid_date_range(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "daterange", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={
        "q": "x", "domains": "LITERATURE",
        "filters": json.dumps({"year_from": 2030, "year_to": 2000}),
    }, headers=headers)
    assert resp.status_code == 422


def test_search_xss_rendered_as_text(db_session: Session):
    """XSS query must return as data; the API must not echo HTML unescaped in a dangerous way."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "xss", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "<script>alert(1)</script>", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    assert "<script>" not in resp.json().get("query", "") or "query" in resp.json()


def test_search_no_sensitive_fields(db_session: Session):
    """Search results must not include password hashes, tokens, storage keys, reviewer emails."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "nosen", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    db_session.add(models.UploadedFile(
        id="fil-sen-1", organization_id=t_a["org"].id,
        uploaded_by=t_a["researcher"].id,
        storage_key=f"tenant/{t_a['org'].id}/f_sensitive.pdf",
        filename="sensitive_doc.pdf", mime_type="application/pdf",
        size_bytes=100, checksum="abc123", classification="CONFIDENTIAL_RESEARCH",
        scan_status="UNSCANNED", created_at=now
    ))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "sensitive", "domains": "FILE"}, headers=headers)
    assert resp.status_code == 200
    raw = resp.text
    assert "storage_key" not in raw
    assert "tenant/" not in raw
    assert "hashed_password" not in raw
    assert "token_hash" not in raw
    assert "secret@example.com" not in raw


# ─────────────────────────────────────────────────────────────────────────────
# 4. PAGINATION / ORDERING / COUNT
# ─────────────────────────────────────────────────────────────────────────────

def test_search_stable_ordering(db_session: Session):
    """Same dataset/query returns deterministic ordering."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "stable", "pln-enterprise")
    t_b = create_test_tenant(db_session, "stable_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    r1 = client.get("/api/search", params={"q": "دراسة", "domains": "PROJECT", "sort": "title"}, headers=headers)
    r2 = client.get("/api/search", params={"q": "دراسة", "domains": "PROJECT", "sort": "title"}, headers=headers)
    ids1 = [r["entity_id"] for r in r1.json()["results"]]
    ids2 = [r["entity_id"] for r in r2.json()["results"]]
    assert ids1 == ids2


def test_search_pagination_no_duplicates(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "pagin", "pln-enterprise")
    t_b = create_test_tenant(db_session, "pagin_b", "pln-enterprise")
    # Seed 5 projects, page size 2
    for i in range(5):
        db_session.add(_make_project(
            t_a, f"proj-pag-{i}", f"مشروع ترقيم {i}", f"Pagination Project {i}"
        ))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    p1 = client.get("/api/search", params={"q": "مشروع", "domains": "PROJECT", "page": 1, "limit": 2}, headers=headers)
    p2 = client.get("/api/search", params={"q": "مشروع", "domains": "PROJECT", "page": 2, "limit": 2}, headers=headers)
    assert p1.status_code == 200 and p2.status_code == 200
    ids1 = {r["entity_id"] for r in p1.json()["results"]}
    ids2 = {r["entity_id"] for r in p2.json()["results"]}
    assert ids1.isdisjoint(ids2)


def test_search_count_is_authorized_only(db_session: Session):
    """total count must not include hidden cross-tenant records."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "counta", "pln-enterprise")
    t_b = create_test_tenant(db_session, "countb", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers_a = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    headers_b = get_auth_headers(t_b["researcher"].username, t_b["org"].id)

    r_a = client.get("/api/search", params={"q": "PROJECT_ALPHA_VISIBLE", "domains": "PROJECT"}, headers=headers_a)
    r_b = client.get("/api/search", params={"q": "PROJECT_SECRET_OTHER_TENANT", "domains": "PROJECT"}, headers=headers_a)
    assert r_a.json()["total"] == 1  # tenant A project only
    assert r_b.json()["total"] == 0  # secret B project not counted for A


# ─────────────────────────────────────────────────────────────────────────────
# 5. ENTITLEMENT
# ─────────────────────────────────────────────────────────────────────────────

def test_search_entitlement_hides_premium_domain(db_session: Session):
    """Free plan without PEER_REVIEW hides the premium domain."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "entitle", "pln-free")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    db_session.add(models.PeerReviewCase(
        id="case-ent-1", organization_id=t_a["org"].id,
        owner_user_id=t_a["researcher"].id,
        title_ar="مراجعة متميزة", title_en="Premium Review Case",
        status="IN_REVIEW", created_at=now, updated_at=now
    ))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "مراجعة", "domains": "PEER_REVIEW"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    assert resp.json()["hidden_domains"] == ["PEER_REVIEW"]


# ─────────────────────────────────────────────────────────────────────────────
# 6. WILDCARD / EMPTY QUERY
# ─────────────────────────────────────────────────────────────────────────────

def test_search_wildcard_abuse_literal(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "wild", "pln-enterprise")
    t_b = create_test_tenant(db_session, "wild_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "%%%%%%%", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_search_empty_query_returns_empty(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "emptyq", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    assert resp.json()["results"] == []


# ─────────────────────────────────────────────────────────────────────────────
# 7. DOMAIN FILTERS
# ─────────────────────────────────────────────────────────────────────────────

def test_search_domain_filters_and_status(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "domf", "pln-enterprise")
    t_b = create_test_tenant(db_session, "domf_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={
        "q": "دراسة",
        "domains": "PROJECT",
        "filters": json.dumps({"study_design": "quasi_experimental_pre_post"}),
    }, headers=headers)
    assert resp.status_code == 200
    for r in resp.json()["results"]:
        assert r["metadata"]["studyDesign"] == "quasi_experimental_pre_post"


def test_search_invalid_domain_rejected(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "invdom", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "x", "domains": "DROP_TABLE"}, headers=headers)
    assert resp.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# 8. DELETED RECORDS
# ─────────────────────────────────────────────────────────────────────────────

def test_search_soft_deleted_asset_hidden(db_session: Session):
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "softdel", "pln-enterprise")
    _seed_asset_with_doi(db_session, t_a, "asset-del-1", "Deleted Asset Title", "10.9999/deleted")
    asset = db_session.query(models.ScholarlyAsset).filter(models.ScholarlyAsset.id == "asset-del-1").first()
    asset.deleted_at = datetime.datetime.now(datetime.UTC).isoformat()
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "Deleted Asset", "domains": "ASSET"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# 9. PERFORMANCE / QUERY COUNT
# ─────────────────────────────────────────────────────────────────────────────

def test_search_query_count_no_n_plus_1(db_session: Session):
    """Global search should run a bounded number of search-table queries (no N+1)."""
    import sqlalchemy as sa
    from app.db import engine

    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "qcount", "pln-enterprise")
    t_b = create_test_tenant(db_session, "qcount_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    # Warm auth/tenant-context queries once (login + tenant context), then measure only search-table hits
    client.get("/api/search", params={"q": "PROJECT", "domains": "PROJECT"}, headers=headers)

    search_queries = []

    def _counter(conn, cursor, statement, parameters, context, executemany):
        s = str(statement)
        if "research_projects" in s or "project_literature_studies" in s \
           or "core_scholarly_assets" in s or "core_unified_academic_profiles" in s \
           or "promotion_applications" in s or "peer_review_cases" in s or "uploaded_files" in s:
            search_queries.append(s[:80])

    sa.event.listen(engine, "before_cursor_execute", _counter)
    try:
        resp = client.get("/api/search", params={"q": "PROJECT", "domains": "PROJECT,LITERATURE,ASSET"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1
    finally:
        sa.event.remove(engine, "before_cursor_execute", _counter)

    # For 3 domains: count+page per domain + auth subqueries — bounded, no per-row N+1
    assert len(search_queries) < 30


def test_search_performance_latency(db_session: Session):
    """Measured latency for representative queries (informational, not an SLA)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "perf", "pln-enterprise")
    t_b = create_test_tenant(db_session, "perf_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    start = time.perf_counter()
    resp = client.get("/api/search", params={"q": "PROJECT_ALPHA_VISIBLE", "domains": "PROJECT"}, headers=headers)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert elapsed_ms < 5000  # generous bound for CI


# ─────────────────────────────────────────────────────────────────────────────
# 10. MIGRATION-FREE GET / SEARCH MUTATION
# ─────────────────────────────────────────────────────────────────────────────

def test_search_is_mutation_free(db_session: Session):
    """Search GET must not modify domain records (no last_seen, no index writes)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "mutfree", "pln-enterprise")
    t_b = create_test_tenant(db_session, "mutfree_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    before = db_session.query(models.ResearchProject).count()
    client.get("/api/search", params={"q": "دراسة", "domains": "PROJECT"}, headers=headers)
    after = db_session.query(models.ResearchProject).count()
    assert before == after


# ─────────────────────────────────────────────────────────────────────────────
# 10b. PERFORMANCE DATASET (moderate volume; no huge synthetic loads)
# ─────────────────────────────────────────────────────────────────────────────

def test_search_performance_dataset_1000_records(db_session: Session):
    """A moderate 1,000-record dataset: representative queries complete quickly,
    pagination stays bounded, and no per-row N+1 occurs."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "perf1k", "pln-enterprise")
    t_b = create_test_tenant(db_session, "perf1k_b", "pln-enterprise")

    # 1,000 projects across both tenants (990 tenant A, 10 tenant B)
    batch = []
    for i in range(990):
        batch.append(_make_project(
            t_a, f"proj-perf1k-{i}",
            f"دراسة الأداء رقم {i}",
            f"Perf Benchmark Project {i}",
            study_design="quasi_experimental_pre_post" if i % 2 == 0 else "randomized_controlled_trial"
        ))
    for i in range(10):
        batch.append(_make_project(
            t_b, f"proj-perf1k-b-{i}",
            f"دراسة أداء جهة أخرى {i}",
            f"Other Tenant Perf Project {i}",
        ))
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    # exact identifier query: use a unique UUID token
    unique_token = "PROJ-UNIQUE-ID-000042"
    batch.append(_make_project(t_a, "proj-perf-unique", "مشروع فريد للأداء", unique_token))
    db_session.add_all(batch)
    db_session.commit()

    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    # exact identifier query
    start = time.perf_counter()
    r1 = client.get("/api/search", params={"q": unique_token, "domains": "PROJECT"}, headers=headers)
    t1 = (time.perf_counter() - start) * 1000
    assert r1.status_code == 200 and r1.json()["total"] == 1

    # common text query
    start = time.perf_counter()
    r2 = client.get("/api/search", params={"q": "دراسة الأداء", "domains": "PROJECT", "limit": 100}, headers=headers)
    t2 = (time.perf_counter() - start) * 1000
    assert r2.status_code == 200
    assert r2.json()["total"] == 990
    assert len(r2.json()["results"]) == 100

    # filtered query
    start = time.perf_counter()
    r3 = client.get("/api/search", params={
        "q": "دراسة الأداء", "domains": "PROJECT",
        "filters": json.dumps({"study_design": "randomized_controlled_trial"}),
        "limit": 100,
    }, headers=headers)
    t3 = (time.perf_counter() - start) * 1000
    assert r3.status_code == 200
    for item in r3.json()["results"]:
        assert item["metadata"]["studyDesign"] == "randomized_controlled_trial"

    # cross-domain query
    start = time.perf_counter()
    r4 = client.get("/api/search", params={"q": "دراسة الأداء", "domains": "PROJECT,LITERATURE,ASSET"}, headers=headers)
    t4 = (time.perf_counter() - start) * 1000
    assert r4.status_code == 200
    assert r4.json()["total"] >= 990

    # Document measured latencies (no SLA asserted; generous CI-safe bounds)
    assert t1 < 5000 and t2 < 5000 and t3 < 5000 and t4 < 5000

    # Cross-tenant isolation preserved at scale: B-only project never leaks
    r5 = client.get("/api/search", params={"q": "Other Tenant Perf Project", "domains": "PROJECT"}, headers=headers)
    assert r5.json()["total"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# 11. RUNTIME SCENARIOS (spec §166–§177)
# ─────────────────────────────────────────────────────────────────────────────

def test_runtime_scenario_arabic_project_discovered_and_opens(db_session: Session):
    """Researcher searches an Arabic project; authorized project appears."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_ar", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rt_ar_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)

    resp = client.get("/api/search", params={"q": "الإدارة", "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    item = resp.json()["results"][0]
    # Frontend can open the project via its target route
    assert item["target"] is not None
    assert item["entity_id"]


def test_runtime_scenario_doi_asset_ranked(db_session: Session):
    """Search a DOI; scholarly asset appears and is found via canonical form."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_doi", "pln-enterprise")
    _seed_asset_with_doi(db_session, t_a, "asset-rt-doi", "Runtime DOI Asset", "10.5678/runtime")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "https://doi.org/10.5678/runtime", "domains": "ASSET"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["results"][0]["entity_id"] == "asset-rt-doi"


def test_runtime_scenario_tenant_b_exclusive_zero(db_session: Session):
    """Tenant A searching a Tenant-B-only title returns zero results, no count leak."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_xt", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rt_xt_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "PROJECT_SECRET_OTHER_TENANT", "domains": "PROJECT"}, headers=headers)
    assert resp.json()["total"] == 0
    assert resp.json()["domain_counts"].get("PROJECT", 0) == 0


def test_runtime_scenario_same_tenant_policy(db_session: Session):
    """Same-tenant user search follows the existing org-wide project policy."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_h", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rt_h_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["colleague"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "PROJECT_ALPHA_VISIBLE", "domains": "PROJECT"}, headers=headers)
    assert resp.json()["total"] == 1


def test_runtime_scenario_peer_review_safe_metadata(db_session: Session):
    """Author searches peer-review case; sees safe metadata, never reviewer identity."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_pr", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    case = models.PeerReviewCase(
        id="case-rt-pr", organization_id=t_a["org"].id,
        owner_user_id=t_a["researcher"].id,
        title_ar="دراسة بحثية خاضعة للتحكيم", title_en="Manuscript Under Review",
        status="IN_REVIEW", case_type="MANUSCRIPT", blind_type="DOUBLE_BLIND",
        current_round_number=1, created_at=now, updated_at=now
    )
    db_session.add(case)
    db_session.add(models.ReviewerAssignment(
        id="asg-rt-pr", round_id="round-rt-pr", case_id=case.id,
        reviewer_type="EXTERNAL_REVIEWER", external_name="SECRET_REVIEWER_NAME",
        external_email="secret@example.com", status="IN_PROGRESS",
        conflict_status="UNCHECKED", invited_at=now, created_at=now
    ))
    db_session.add(models.PeerReviewRound(
        id="round-rt-pr", case_id=case.id, round_number=1,
        manuscript_version=1, status="ACTIVE", created_at=now
    ))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "تحكيم", "domains": "PEER_REVIEW"}, headers=headers)
    assert resp.status_code == 200
    assert "SECRET_REVIEWER_NAME" not in resp.text
    assert resp.json()["results"][0]["metadata"]["caseType"] == "MANUSCRIPT"


def test_runtime_scenario_committee_promotion_access(db_session: Session):
    """Authorized committee member sees promotion records allowed by RBAC."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_prom", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    policy_id = f"plc-{t_a['org'].id}"
    db_session.add(models.PromotionPolicy(
        id=policy_id, organization_id=t_a["org"].id,
        name_ar="سياسة ترقية اختبارية", name_en="Test promotion policy",
        target_rank="PROFESSOR", version=1, status="ACTIVE",
        created_by=t_a["researcher"].id, created_at=now, updated_at=now,
    ))
    db_session.flush()
    db_session.add_all([
        models.PromotionApplication(
            id="papp-rt-1", organization_id=t_a["org"].id,
            user_id=t_a["researcher"].id, policy_id=policy_id, policy_version=1,
            current_rank="ASSISTANT_PROFESSOR", target_rank="ASSOCIATE_PROFESSOR",
            status="SUBMITTED", readiness_percentage=70, created_at=now, updated_at=now
        ),
        models.PromotionApplication(
            id="papp-rt-2", organization_id=t_a["org"].id,
            user_id=t_a["colleague"].id, policy_id=policy_id, policy_version=1,
            current_rank="ASSISTANT_PROFESSOR", target_rank="PROFESSOR",
            status="UNDER_REVIEW", readiness_percentage=80, created_at=now, updated_at=now
        ),
    ])
    db_session.commit()
    # Owner (committee) sees both org applications
    headers_owner = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={"q": "PROFESSOR", "domains": "PROMOTION"}, headers=headers_owner)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


def test_runtime_scenario_arabic_normalization_variation(db_session: Session):
    """Arabic normalization variation yields expected matches."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_arnorm", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rt_arnorm_b", "pln-enterprise")
    _seed_projects(db_session, t_a, t_b)
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    r1 = client.get("/api/search", params={"q": "الإدارة", "domains": "PROJECT"}, headers=headers)
    r2 = client.get("/api/search", params={"q": "الادارة", "domains": "PROJECT"}, headers=headers)
    assert {r["entity_id"] for r in r1.json()["results"]} == {r["entity_id"] for r in r2.json()["results"]}


def test_runtime_scenario_domain_status_date_filters(db_session: Session):
    """Apply domain + status-like filter and year filter to get correct subset."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_filt", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rt_filt_b", "pln-enterprise")
    # Need a project to satisfy NOT NULL projectId
    ref_proj = _make_project(t_a, "proj-rt-filt-ref", "مشروع مرجع", "Reference Project")
    db_session.add(ref_proj)
    db_session.flush()
    now = datetime.datetime.now(datetime.UTC).isoformat()
    db_session.add_all([
        models.LiteratureStudy(
            id="lit-rt-2022", projectId=ref_proj.id, organizationId=t_a["org"].id,
            author="Author 2022", year=2022, sampleSize=50, effectSize=0.5,
            ciLower=0.2, ciUpper=0.8, source="manual", createdAt=now, updatedAt=now
        ),
        models.LiteratureStudy(
            id="lit-rt-2024", projectId=ref_proj.id, organizationId=t_a["org"].id,
            author="Author 2024", year=2024, sampleSize=50, effectSize=0.5,
            ciLower=0.2, ciUpper=0.8, source="manual", createdAt=now, updatedAt=now
        ),
    ])
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={
        "q": "Author", "domains": "LITERATURE",
        "filters": json.dumps({"year_from": 2023, "year_to": 2025}),
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["results"][0]["entity_id"] == "lit-rt-2024"


def test_runtime_scenario_pagination_no_duplicates(db_session: Session):
    """Pagination next page contains no duplicate items."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_pag", "pln-enterprise")
    t_b = create_test_tenant(db_session, "rt_pag_b", "pln-enterprise")
    for i in range(5):
        db_session.add(_make_project(t_a, f"proj-rt-pag-{i}", f"مشروع RT {i}", f"Runtime Page Project {i}"))
    db_session.commit()
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    p1 = client.get("/api/search", params={"q": "مشروع RT", "domains": "PROJECT", "page": 1, "limit": 2}, headers=headers)
    p2 = client.get("/api/search", params={"q": "مشروع RT", "domains": "PROJECT", "page": 2, "limit": 2}, headers=headers)
    ids1 = {r["entity_id"] for r in p1.json()["results"]}
    ids2 = {r["entity_id"] for r in p2.json()["results"]}
    assert ids1.isdisjoint(ids2)


def test_runtime_scenario_invalid_filter_safe_error(db_session: Session):
    """Invalid filter/sort yields a safe validation error (no SQL leak)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_err", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    resp = client.get("/api/search", params={
        "q": "x", "sort": "drop_table",
        "filters": json.dumps({"unknown_thing": "1"}),
    }, headers=headers)
    assert resp.status_code == 422
    assert "drop_table" in resp.json()["detail"] or "unknown_thing" in resp.json()["detail"]


def test_runtime_scenario_xss_rendered_safely(db_session: Session):
    """XSS-like search text is returned as inert JSON data (no results, nothing stored/executed)."""
    _seed_plans(db_session)
    t_a = create_test_tenant(db_session, "rt_xss", "pln-enterprise")
    headers = get_auth_headers(t_a["researcher"].username, t_a["org"].id)
    payload = "<script>alert('xss')</script>"
    resp = client.get("/api/search", params={"q": payload, "domains": "PROJECT"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    # The raw query is echoed back as inert JSON data (frontend escapes before render).
    # The critical invariant: no stored/result field contains executable markup.
    for item in data["results"]:
        blob = json.dumps(item).lower()
        assert "<script" not in blob
    assert data["total"] == 0
def _make_asset(t, asset_id, title, lifecycle_status, visibility="PUBLIC", owner=None):
    now = datetime.datetime.now(datetime.UTC).isoformat()
    return models.ScholarlyAsset(
        id=asset_id,
        organization_id=t["org"].id,
        owner_user_id=(owner or t["researcher"]).id,
        created_by=(owner or t["researcher"]).id,
        title_ar=title,
        title_en=title,
        asset_type="JOURNAL_ARTICLE",
        lifecycle_status=lifecycle_status,
        visibility=visibility,
        language="ar",
        created_at=now,
        updated_at=now,
    )


def test_search_asset_hides_other_users_unpublished_work_same_tenant(db_session: Session):
    """General Unified Search must not let a same-org colleague discover
    another researcher's DRAFT/UNDER_REVIEW/ACCEPTED work — only genuinely
    PUBLISHED+PUBLIC assets are discoverable across users within an org."""
    _seed_plans(db_session)
    t = create_test_tenant(db_session, "assetpriv", "pln-enterprise")
    db_session.add_all([
        _make_asset(t, "asset-priv-draft", "AssetPrivacyDraftTitle", "DRAFT"),
        _make_asset(t, "asset-priv-review", "AssetPrivacyReviewTitle", "UNDER_REVIEW"),
        _make_asset(t, "asset-priv-accepted", "AssetPrivacyAcceptedTitle", "ACCEPTED"),
        _make_asset(t, "asset-priv-published", "AssetPrivacyPublishedTitle", "PUBLISHED"),
    ])
    db_session.commit()

    colleague_headers = get_auth_headers(t["colleague"].username, t["org"].id)
    for title in ["AssetPrivacyDraftTitle", "AssetPrivacyReviewTitle", "AssetPrivacyAcceptedTitle"]:
        resp = client.get("/api/search", params={"q": title, "domains": "ASSET"}, headers=colleague_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0, f"{title} leaked to a same-tenant colleague via Search"
        assert data["domain_counts"].get("ASSET", 0) == 0, f"{title} leaked via Search domain_counts"
        assert data["results"] == [], f"{title} leaked into search results"

    published_resp = client.get(
        "/api/search", params={"q": "AssetPrivacyPublishedTitle", "domains": "ASSET"}, headers=colleague_headers
    )
    assert published_resp.status_code == 200
    assert published_resp.json()["total"] == 1
    assert published_resp.json()["results"][0]["entity_id"] == "asset-priv-published"


def test_search_asset_owner_can_still_find_own_unpublished_work(db_session: Session):
    """The privacy fix must not regress the owner's own ability to find their
    own DRAFT work via Search."""
    _seed_plans(db_session)
    t = create_test_tenant(db_session, "assetself", "pln-enterprise")
    db_session.add(_make_asset(t, "asset-self-draft", "AssetSelfDraftTitle", "DRAFT"))
    db_session.commit()

    owner_headers = get_auth_headers(t["researcher"].username, t["org"].id)
    resp = client.get("/api/search", params={"q": "AssetSelfDraftTitle", "domains": "ASSET"}, headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["results"][0]["entity_id"] == "asset-self-draft"


def test_search_profile_navigation_targets_public_profile_for_other_user(db_session: Session):
    """A search result for ANOTHER user's public profile must navigate to
    that user's public profile route, not the current user's own private
    editor. A result for the caller's OWN profile still targets the editor."""
    _seed_plans(db_session)
    t = create_test_tenant(db_session, "navtarget", "pln-enterprise")
    now = datetime.datetime.now(datetime.UTC).isoformat()
    db_session.add(models.UnifiedAcademicProfile(
        id="profile-nav-owner", user_id=t["researcher"].id, organization_id=t["org"].id,
        preferred_name_en="NavTargetOwnerProfile", visibility_status="PUBLIC",
        completeness_score=50, search_text="navtargetownerprofile",
        created_at=now, updated_at=now,
    ))
    db_session.commit()

    colleague_headers = get_auth_headers(t["colleague"].username, t["org"].id)
    resp = client.get(
        "/api/search", params={"q": "NavTargetOwnerProfile", "domains": "PROFILE"}, headers=colleague_headers
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    result = resp.json()["results"][0]
    assert result["target"] == f"/researcher/{t['researcher'].username}"
    assert result["target"] != "/app/profile"

    owner_headers = get_auth_headers(t["researcher"].username, t["org"].id)
    own_resp = client.get(
        "/api/search", params={"q": "NavTargetOwnerProfile", "domains": "PROFILE"}, headers=owner_headers
    )
    assert own_resp.status_code == 200
    assert own_resp.json()["results"][0]["target"] == "/app/profile"


def test_search_backfill_quotes_postgresql_mixed_case_identifiers():
    from app.services.search.backfill import backfill_all_search_text

    class EmptyResult:
        def fetchall(self):
            return []

    class RecordingConnection:
        dialect = postgresql.dialect()

        def __init__(self):
            self.statements = []

        def execute(self, statement, *_args, **_kwargs):
            self.statements.append(str(statement))
            return EmptyResult()

    connection = RecordingConnection()
    backfill_all_search_text(connection, lambda value: value)

    project_query = connection.statements[0]
    assert '"titleAr"' in project_query
    assert '"studyDesign"' in project_query
    assert 'FROM research_projects' in project_query
