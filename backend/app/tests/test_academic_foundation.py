import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.models
from app.db import Base, get_db
from app.main import app
from app.models import User, Organization, Plan, UnifiedAcademicProfile, ScholarlyAsset
import json
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

