import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.models
from app.db import Base, get_db
from app.main import app
from app.models import (
    Plan, ScholarlyAsset,
    PublicationSubmission, PublicationJournal, PublicationManuscriptVersion
)
import uuid
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_academic_foundation_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.UTC).isoformat()
    free_plan = Plan(
        id="pln-free",
        code="PERSONAL_FREE",
        name="الباقة الشخصية المجانية",
        description="free plan",
        billing_interval="MONTHLY",
        price=0.0,
        currency="SAR",
        limits_json={"max_projects": 2, "max_members": 1, "max_storage_mb": 50},
        features_json={"can_export": False, "reviewer_portal": False},
        created_at=now
    )
    db.add(free_plan)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_academic_profile_and_assets_lifecycle(client):
    # 1. Register and Login User A
    res = client.post("/api/auth/register", json={
        "username": "prof_a",
        "email": "prof_a@baseerah.sa",
        "password": "securepassword123",
        "role": "Researcher"
    })
    assert res.status_code == 200

    login_res = client.post("/api/auth/login", json={
        "username": "prof_a",
        "password": "securepassword123"
    })
    assert login_res.status_code == 200
    token_a = login_res.json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Set organization header
    org_a_id = client.get("/api/organizations/active", headers=headers_a).json()["id"]
    headers_a["X-Organization-ID"] = org_a_id

    # 2. Get my profile (should auto-create empty profile)
    profile_res = client.get("/api/academic-foundation/profile/me", headers=headers_a)
    assert profile_res.status_code == 200
    prof_data = profile_res.json()
    assert prof_data["user_id"] is not None
    assert prof_data["completeness_score"] == 0

    # 3. Upsert profile with details
    upsert_body = {
        "preferred_name_ar": "أ.د. أحمد الباحث",
        "preferred_name_en": "Prof. Ahmed Researcher",
        "name_variants_json": ["Ahmed A. Researcher", "A. Researcher"],
        "academic_title": "Professor",
        "current_rank": "Professor",
        "target_rank": "Professor",
        "country": "Saudi Arabia",
        "university": "KSU",
        "college": "Science",
        "department": "Physics",
        "general_specialization": "Physics",
        "specific_specialization": "Nanotechnology",
        "discipline": "Physics",
        "research_interests_json": ["Quantum mechanics", "Nanomaterials"],
        "keywords_ar_json": ["نانو", "كمي"],
        "keywords_en_json": ["nano", "quantum"],
        "institutional_email": "ahmed@ksu.edu.sa",
        "public_email": "ahmed.res@gmail.com",
        "phone": "+966555555555",
        "short_bio_ar": "أستاذ مشارك متخصص في فيزياء النانو وله العديد من الأبحاث المنشورة.",
        "short_bio_en": "Professor of Physics focusing on nanomaterials and quantum mechanics applications.",
        "full_bio_ar": "سيرة ذاتية طويلة تحتوي على تفاصيل الخبرات والمشاريع البحثية والمؤتمرات الدولية والتدريس الجامعي.",
        "full_bio_en": "Detailed biography containing research projects, academic achievements, international conferences, and tutoring.",
        "profile_photo_file_id": None,
        "visibility_status": "PUBLIC",
        "identifiers": [
            {
                "identifier_type": "ORCID",
                "identifier_value": "0000-0002-1825-0097",
                "profile_url": "https://orcid.org/0000-0002-1825-0097",
                "status": "UNVERIFIED"
            }
        ],
        "affiliations": [
            {
                "organization_name": "King Saud University",
                "college": "College of Science",
                "department": "Department of Physics",
                "position_title": "Professor",
                "academic_rank": "Professor",
                "start_date": "2020-01-01",
                "is_current": True,
                "country": "Saudi Arabia",
                "verification_status": "UNVERIFIED"
            }
        ]
    }
    
    upsert_res = client.post("/api/academic-foundation/profile/upsert", json=upsert_body, headers=headers_a)
    assert upsert_res.status_code == 200
    updated_prof = upsert_res.json()
    assert updated_prof["preferred_name_ar"] == "أ.د. أحمد الباحث"
    assert updated_prof["completeness_score"] > 50
    assert len(updated_prof["identifiers"]) == 1
    assert len(updated_prof["affiliations"]) == 1

    # 4. Create a custom Scholarly Asset
    asset_body = {
        "title_ar": "تصنيع وتوصيف المواد النانوية الذكية",
        "title_en": "Synthesis and Characterization of Smart Nanomaterials",
        "abstract_ar": "ملخص البحث باللغة العربية حول تصنيع وتوصيف المواد النانوية وتطبيقاتها الطبية.",
        "abstract_en": "Abstract of the study in English language focusing on biomedical applications of smart nanomaterials.",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "PUBLISHED",
        "primary_discipline": "Nanotechnology",
        "secondary_disciplines_json": ["Physics", "Materials Science"],
        "keywords_json": ["nano", "materials", "synthesis"],
        "doi": "10.1016/j.nano.2026.01.002",
        "issn": "1530-6984",
        "journal_name": "Nano Letters",
        "publisher": "ACS Publications",
        "publication_date": "2026-02-15",
        "language": "ar",
        "visibility": "PUBLIC",
        "source_module": "FOUNDATION",
        "contributors": [
            {
                "external_name": "Ahmed Researcher",
                "orcid": "0000-0002-1825-0097",
                "author_order": 1,
                "is_corresponding_author": True,
                "contribution_roles_json": ["Conceptualization", "Methodology", "Writing - Original Draft"],
                "affiliation_text": "King Saud University",
                "contribution_percentage": 60.0
            },
            {
                "external_name": "Co-Author Scholar",
                "author_order": 2,
                "contribution_roles_json": ["Investigation", "Formal Analysis"],
                "contribution_percentage": 40.0
            }
        ],
        "files": []
    }

    create_asset_res = client.post("/api/academic-foundation/scholarly-assets", json=asset_body, headers=headers_a)
    assert create_asset_res.status_code == 200
    asset_data = create_asset_res.json()
    assert asset_data["id"] is not None
    assert asset_data["title_ar"] == "تصنيع وتوصيف المواد النانوية الذكية"

    # 5. List assets
    list_res = client.get("/api/academic-foundation/scholarly-assets", headers=headers_a)
    assert list_res.status_code == 200
    assets_list = list_res.json()
    assert len(assets_list) == 1
    assert assets_list[0]["id"] == asset_data["id"]

    # 6. Delete the scholarly asset
    del_res = client.delete(f"/api/academic-foundation/scholarly-assets/{asset_data['id']}", headers=headers_a)
    assert del_res.status_code == 200
    
    # List assets again
    list_res_empty = client.get("/api/academic-foundation/scholarly-assets", headers=headers_a)
    assert len(list_res_empty.json()) == 0


def test_scholarly_assets_tenant_isolation(client):
    # 1. Register and Login User A (Workspace Admin)
    client.post("/api/auth/register", json={
        "username": "admin_t",
        "email": "admin_t@baseerah.sa",
        "password": "securepassword123",
        "role": "Researcher"
    })
    token_a = client.post("/api/auth/login", json={"username": "admin_t", "password": "securepassword123"}).json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Provision workspace for User A
    workspace_res = client.post("/api/organizations", json={
        "name": "KFUPM",
        "slug": "kfupm"
    }, headers=headers_a)
    assert workspace_res.status_code == 200
    org_id = workspace_res.json()["id"]
    headers_a["X-Organization-ID"] = org_id

    # Create Scholarly Asset inside User A's workspace
    asset_body = {
        "title_ar": "أصل علمي خاص بجامعة الملك فهد",
        "title_en": "Scholarly Asset of KFUPM",
        "asset_type": "JOURNAL_PAPER",
        "primary_discipline": "Engineering",
        "contributors": []
    }
    create_res = client.post("/api/academic-foundation/scholarly-assets", json=asset_body, headers=headers_a)
    assert create_res.status_code == 200
    asset_id = create_res.json()["id"]

    # 2. Register and Login User B (External user, different tenant)
    client.post("/api/auth/register", json={
        "username": "external_b",
        "email": "external_b@baseerah.sa",
        "password": "securepassword123",
        "role": "Researcher"
    })
    token_b = client.post("/api/auth/login", json={"username": "external_b", "password": "securepassword123"}).json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Get active organization for User B
    org_b_id = client.get("/api/organizations/active", headers=headers_b).json()["id"]
    headers_b["X-Organization-ID"] = org_b_id

    # List scholarly assets of User B (should be empty, KFUPM asset isolated)
    list_b_res = client.get("/api/academic-foundation/scholarly-assets", headers=headers_b)
    assert list_b_res.status_code == 200
    assert len(list_b_res.json()) == 0

    # Retrieve KFUPM asset directly using User B (should be forbidden or not found due to tenant mismatch)
    direct_res = client.get(f"/api/academic-foundation/scholarly-assets/{asset_id}", headers=headers_b)
    assert direct_res.status_code == 403 or direct_res.status_code == 404


def _register_and_login(client, username):
    client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@baseerah.sa",
        "password": "securepassword123",
        "role": "Researcher"
    })
    token = client.post("/api/auth/login", json={"username": username, "password": "securepassword123"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    org_id = client.get("/api/organizations/active", headers=headers).json()["id"]
    headers["X-Organization-ID"] = org_id
    return headers, org_id


def test_verification_status_cannot_be_client_declared_verified(client):
    # No ORCID OAuth or equivalent verification authority exists in this
    # codebase yet — a client asserting status/verification_status/
    # verified_status: "VERIFIED" must always be forced back to UNVERIFIED,
    # server-side, regardless of what the payload claims.
    headers_a, _ = _register_and_login(client, "spoof_prof")

    upsert_body = {
        "preferred_name_en": "Spoof Attempt Researcher",
        "visibility_status": "PUBLIC",
        "identifiers": [
            {
                "identifier_type": "ORCID",
                "identifier_value": "0000-0001-2345-6789",
                "status": "VERIFIED",
                "verification_method": "ORCID_OAUTH",
                "verified_at": "2026-01-01T00:00:00Z",
                "last_checked_at": "2026-01-01T00:00:00Z"
            }
        ],
        "affiliations": [
            {
                "organization_name": "Self-Declared University",
                "is_current": True,
                "verification_status": "VERIFIED"
            }
        ]
    }
    upsert_res = client.post("/api/academic-foundation/profile/upsert", json=upsert_body, headers=headers_a)
    assert upsert_res.status_code == 200
    body = upsert_res.json()
    assert body["identifiers"][0]["status"] == "UNVERIFIED"
    assert body["identifiers"][0]["verified_at"] is None
    assert body["identifiers"][0]["last_checked_at"] is None
    assert body["affiliations"][0]["verification_status"] == "UNVERIFIED"

    # Same rule for scholarly-asset contributors' verified_status.
    asset_body = {
        "title_en": "Spoofed Contributor Verification Attempt",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "DRAFT",
        "contributors": [
            {
                "external_name": "Suspicious Co-Author",
                "author_order": 1,
                "verified_status": "VERIFIED"
            }
        ]
    }
    asset_res = client.post("/api/academic-foundation/scholarly-assets", json=asset_body, headers=headers_a)
    assert asset_res.status_code == 200
    assert asset_res.json()["contributors"][0]["verified_status"] == "UNVERIFIED"


def test_identifier_profile_url_rejects_unsafe_scheme(client):
    # An identifier's profile_url is rendered as a raw <a href> on the public,
    # unauthenticated profile page — a javascript: (or other non-http(s))
    # scheme there is a stored-XSS vector reachable by any visitor.
    headers_a, _ = _register_and_login(client, "xssurl_prof")

    res = client.post("/api/academic-foundation/profile/upsert", json={
        "preferred_name_en": "XSS Attempt Researcher",
        "visibility_status": "PUBLIC",
        "identifiers": [
            {
                "identifier_type": "ORCID",
                "identifier_value": "0000-0003-3456-7890",
                "profile_url": "javascript:alert(document.cookie)"
            }
        ]
    }, headers=headers_a)
    assert res.status_code == 422

    ok_res = client.post("/api/academic-foundation/profile/upsert", json={
        "preferred_name_en": "XSS Attempt Researcher",
        "visibility_status": "PUBLIC",
        "identifiers": [
            {
                "identifier_type": "ORCID",
                "identifier_value": "0000-0003-3456-7890",
                "profile_url": "https://orcid.org/0000-0003-3456-7890"
            }
        ]
    }, headers=headers_a)
    assert ok_res.status_code == 200


def test_public_profile_hides_unpublished_assets_even_when_visibility_public(client):
    # visibility defaults to PUBLIC on creation, but that alone must never be
    # enough to surface on the public profile — only lifecycle_status ==
    # PUBLISHED may. DRAFT/UNDER_REVIEW/ACCEPTED must stay hidden even with
    # visibility left at its PUBLIC default (ACCEPTED != PUBLISHED).
    headers_a, _ = _register_and_login(client, "pubfilter_prof")

    client.post("/api/academic-foundation/profile/upsert", json={
        "preferred_name_en": "Public Filter Researcher",
        "visibility_status": "PUBLIC"
    }, headers=headers_a)

    draft_asset = client.post("/api/academic-foundation/scholarly-assets", json={
        "title_en": "Not Yet Published Work",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "ACCEPTED",
        "visibility": "PUBLIC",
        "contributors": []
    }, headers=headers_a)
    assert draft_asset.status_code == 200
    asset_id = draft_asset.json()["id"]

    public_res = client.get("/api/academic-foundation/public/pubfilter_prof")
    assert public_res.status_code == 200
    titles = [a["title_en"] for a in public_res.json()["scholarly_assets"]]
    assert "Not Yet Published Work" not in titles

    # Once genuinely marked PUBLISHED (self-declared, no submission pipeline
    # involved here), it becomes eligible to appear.
    update_body = {
        "title_en": "Not Yet Published Work",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "PUBLISHED",
        "visibility": "PUBLIC",
        "contributors": []
    }
    update_res = client.put(f"/api/academic-foundation/scholarly-assets/{asset_id}", json=update_body, headers=headers_a)
    assert update_res.status_code == 200
    assert update_res.json()["lifecycle_status"] == "PUBLISHED"

    public_res_2 = client.get("/api/academic-foundation/public/pubfilter_prof")
    titles_2 = [a["title_en"] for a in public_res_2.json()["scholarly_assets"]]
    assert "Not Yet Published Work" in titles_2


def test_lifecycle_status_locked_once_real_submission_pipeline_exists(client):
    # Once an asset has actually entered Publication's own editorial
    # pipeline (a PublicationSubmission row references it), the owner
    # editing their Academic Identity portfolio must not be able to
    # hand-declare it PUBLISHED and bypass peer review.
    headers_a, org_id = _register_and_login(client, "pipeline_prof")
    client.post("/api/academic-foundation/profile/upsert", json={
        "preferred_name_en": "Pipeline Researcher",
        "visibility_status": "PUBLIC"
    }, headers=headers_a)

    asset_res = client.post("/api/academic-foundation/scholarly-assets", json={
        "title_en": "Manuscript Under Real Peer Review",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "UNDER_REVIEW",
        "visibility": "PUBLIC",
        "contributors": []
    }, headers=headers_a)
    assert asset_res.status_code == 200
    asset_id = asset_res.json()["id"]

    now = datetime.datetime.now(datetime.UTC).isoformat()
    db = TestingSessionLocal()
    journal = PublicationJournal(
        id=str(uuid.uuid4()), canonical_key=f"jrnl-{uuid.uuid4()}", title="Test Journal",
        provider_name="MANUAL", retrieved_at=now, stale_after=now
    )
    manuscript_version = PublicationManuscriptVersion(
        id=str(uuid.uuid4()), organization_id=org_id, asset_id=asset_id, version_number=1,
        article_type="ORIGINAL_RESEARCH", fingerprint="fp-1", created_at=now
    )
    db.add(journal)
    db.add(manuscript_version)
    db.commit()
    submission = PublicationSubmission(
        id=str(uuid.uuid4()), organization_id=org_id, asset_id=asset_id,
        journal_id=journal.id, manuscript_version_id=manuscript_version.id,
        status="SUBMITTED", created_at=now, updated_at=now
    )
    db.add(submission)
    db.commit()
    db.close()

    hijack_res = client.put(f"/api/academic-foundation/scholarly-assets/{asset_id}", json={
        "title_en": "Manuscript Under Real Peer Review",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "PUBLISHED",
        "visibility": "PUBLIC",
        "contributors": []
    }, headers=headers_a)
    assert hijack_res.status_code == 200
    assert hijack_res.json()["lifecycle_status"] == "UNDER_REVIEW"

    public_res = client.get("/api/academic-foundation/public/pipeline_prof")
    titles = [a["title_en"] for a in public_res.json()["scholarly_assets"]]
    assert "Manuscript Under Real Peer Review" not in titles


def test_publication_provenance_self_declared_vs_pipeline_verified(client):
    # Two PUBLISHED assets for the same researcher: one self-declared (never
    # submitted through the real editorial pipeline), one that genuinely went
    # through Publication Intelligence's PublicationSubmission. Both must be
    # labeled with the truthful provenance, not a generic "PUBLISHED" that
    # implies equal trust.
    headers_a, org_id = _register_and_login(client, "provenance_prof")
    client.post("/api/academic-foundation/profile/upsert", json={
        "preferred_name_en": "Provenance Researcher",
        "visibility_status": "PUBLIC"
    }, headers=headers_a)

    self_declared = client.post("/api/academic-foundation/scholarly-assets", json={
        "title_en": "Self-Declared External Paper",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "PUBLISHED",
        "visibility": "PUBLIC",
        "contributors": []
    }, headers=headers_a)
    assert self_declared.status_code == 200
    assert self_declared.json()["publication_verification_status"] == "SELF_DECLARED"
    self_declared_id = self_declared.json()["id"]

    draft_for_pipeline = client.post("/api/academic-foundation/scholarly-assets", json={
        "title_en": "Genuine Pipeline Manuscript",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "UNDER_REVIEW",
        "visibility": "PUBLIC",
        "contributors": []
    }, headers=headers_a)
    assert draft_for_pipeline.status_code == 200
    assert draft_for_pipeline.json()["publication_verification_status"] is None  # not PUBLISHED yet
    pipeline_asset_id = draft_for_pipeline.json()["id"]

    now = datetime.datetime.now(datetime.UTC).isoformat()
    db = TestingSessionLocal()
    journal = PublicationJournal(
        id=str(uuid.uuid4()), canonical_key=f"jrnl-{uuid.uuid4()}", title="Provenance Test Journal",
        provider_name="MANUAL", retrieved_at=now, stale_after=now
    )
    manuscript_version = PublicationManuscriptVersion(
        id=str(uuid.uuid4()), organization_id=org_id, asset_id=pipeline_asset_id, version_number=1,
        article_type="ORIGINAL_RESEARCH", fingerprint="fp-provenance", created_at=now
    )
    db.add(journal)
    db.add(manuscript_version)
    db.commit()
    db.add(PublicationSubmission(
        id=str(uuid.uuid4()), organization_id=org_id, asset_id=pipeline_asset_id,
        journal_id=journal.id, manuscript_version_id=manuscript_version.id,
        status="PUBLISHED", created_at=now, updated_at=now
    ))
    # Directly set lifecycle_status PUBLISHED as Publication Intelligence's
    # own pipeline would (not via the Academic Identity self-service PUT,
    # which is correctly locked out once a submission exists — see
    # test_lifecycle_status_locked_once_real_submission_pipeline_exists).
    asset_row = db.get(ScholarlyAsset, pipeline_asset_id)
    asset_row.lifecycle_status = "PUBLISHED"
    db.commit()
    db.close()

    get_res = client.get(f"/api/academic-foundation/scholarly-assets/{pipeline_asset_id}", headers=headers_a)
    assert get_res.status_code == 200
    assert get_res.json()["publication_verification_status"] == "BASEERAH_PIPELINE_VERIFIED"

    list_res = client.get("/api/academic-foundation/scholarly-assets", headers=headers_a)
    by_id = {a["id"]: a for a in list_res.json()}
    assert by_id[self_declared_id]["publication_verification_status"] == "SELF_DECLARED"
    assert by_id[pipeline_asset_id]["publication_verification_status"] == "BASEERAH_PIPELINE_VERIFIED"

    public_res = client.get("/api/academic-foundation/public/provenance_prof")
    public_by_title = {a["title_en"]: a for a in public_res.json()["scholarly_assets"]}
    assert public_by_title["Self-Declared External Paper"]["publication_verification_status"] == "SELF_DECLARED"
    assert public_by_title["Genuine Pipeline Manuscript"]["publication_verification_status"] == "BASEERAH_PIPELINE_VERIFIED"


def test_publication_provenance_cannot_be_client_spoofed(client):
    # The field does not exist on ScholarlyAssetCreate at all, so a client
    # attempting to send it must have no effect whatsoever — the server's
    # own computed value (SELF_DECLARED, since no submission exists) must
    # win regardless of what the payload claims.
    headers_a, _ = _register_and_login(client, "spoofprov_prof")
    res = client.post("/api/academic-foundation/scholarly-assets", json={
        "title_en": "Spoofed Provenance Attempt",
        "asset_type": "JOURNAL_PAPER",
        "lifecycle_status": "PUBLISHED",
        "visibility": "PUBLIC",
        "publication_verification_status": "BASEERAH_PIPELINE_VERIFIED",
        "contributors": []
    }, headers=headers_a)
    assert res.status_code == 200
    assert res.json()["publication_verification_status"] == "SELF_DECLARED"

