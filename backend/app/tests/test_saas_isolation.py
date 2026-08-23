import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.models import User, ResearchProject, Organization, OrganizationMembership, Plan, Subscription

# Setup temporary memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_db.db"
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
    # Seed free and pro plans for testing limit enforcement
    import json, datetime
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
    pro_plan = Plan(
        id="pln-pro",
        code="RESEARCHER_PRO",
        name="الباقة الاحترافية للباحث",
        description="pro plan",
        billing_interval="MONTHLY",
        price=149.0,
        currency="SAR",
        limits_json={"max_projects": 10, "max_members": 1, "max_storage_mb": 2000},
        features_json={"can_export": True, "reviewer_portal": False},
        created_at=now
    )
    db.add(free_plan)
    db.add(pro_plan)
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

def test_saas_workspace_provisioning_and_isolation(client):
    # 1. Register User A (Researcher)
    reg_data_a = {
        "username": "saas_user_a",
        "password": "securepassword123",
        "email": "saas_user_a@example.com",
        "role": "Researcher"
    }
    response_reg = client.post("/api/auth/register", json=reg_data_a)
    assert response_reg.status_code == 200

    # 2. Login User A
    login_data_a = {"username": "saas_user_a", "password": "securepassword123"}
    response_login = client.post("/api/auth/login", json=login_data_a)
    token_a = response_login.json()["token"]
    
    # Verify that requesting active organization provisions a default personal org
    headers_a = {"Authorization": f"Bearer {token_a}"}
    response_org_active = client.get("/api/organizations/active", headers=headers_a)
    assert response_org_active.status_code == 200
    org_a_id = response_org_active.json()["id"]
    assert org_a_id.startswith("org-user-")

    # Add active workspace header
    headers_a["X-Organization-ID"] = org_a_id

    # 3. Create Projects within Free limit (3 projects)
    project_payload = {
        "titleAr": "مشروع أ", "titleEn": "Project A",
        "studyDesign": "quasi_experimental_pre_post", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05}
    }
    res_p1 = client.post("/api/projects", json=project_payload, headers=headers_a)
    assert res_p1.status_code == 200
    p1_id = res_p1.json()["id"]

    project_payload["titleEn"] = "Project B"
    res_p2 = client.post("/api/projects", json=project_payload, headers=headers_a)
    assert res_p2.status_code == 200

    project_payload["titleEn"] = "Project C"
    res_p3 = client.post("/api/projects", json=project_payload, headers=headers_a)
    assert res_p3.status_code == 200

    # 4. Attempt to create 4th Project -> should fail due to FREE plan limit (max_projects=3)
    project_payload["titleEn"] = "Project D"
    res_p4 = client.post("/api/projects", json=project_payload, headers=headers_a)
    assert res_p4.status_code == 403
    assert "PLAN_LIMIT_REACHED" in res_p4.json()["detail"] or "الحد الأقصى" in res_p4.json()["detail"]

    # 5. Register User B
    reg_data_b = {
        "username": "saas_user_b", "password": "securepassword456",
        "email": "saas_user_b@example.com", "role": "Researcher"
    }
    client.post("/api/auth/register", json=reg_data_b)
    
    login_data_b = {"username": "saas_user_b", "password": "securepassword456"}
    response_login_b = client.post("/api/auth/login", json=login_data_b)
    token_b = response_login_b.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # Resolve User B's active organization
    response_org_b = client.get("/api/organizations/active", headers=headers_b)
    org_b_id = response_org_b.json()["id"]
    headers_b["X-Organization-ID"] = org_b_id

    # 6. User B attempts to access User A's project -> should get 404 (isolation enforced)
    res_get_cross = client.get(f"/api/projects/{p1_id}", headers=headers_b)
    assert res_get_cross.status_code == 404

    # 7. User B attempts to access User A's project with User A's organization header -> should get 403 (membership check enforced)
    headers_b["X-Organization-ID"] = org_a_id
    res_get_cross_org = client.get(f"/api/projects/{p1_id}", headers=headers_b)
    assert res_get_cross_org.status_code == 403

