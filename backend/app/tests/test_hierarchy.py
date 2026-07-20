import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime

from app.db import Base, get_db
from app.main import app
from app.models import User, Organization, OrganizationMembership, Plan, Subscription, ResearchProject

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_hierarchy.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.UTC).isoformat()
    
    # Seed plans
    free_plan = Plan(
        id="pln-free",
        code="PERSONAL_FREE",
        name="الباقة المجانية",
        limits_json={"max_projects": 2, "max_members": 1, "max_storage_mb": 50},
        features_json={"can_export": False},
        created_at=now
    )
    inst_plan = Plan(
        id="pln-inst",
        code="INSTITUTION",
        name="الباقة المؤسسية للجامعات",
        limits_json={"max_projects": 100, "max_members": 50, "max_storage_mb": 1000},
        features_json={"can_export": True},
        created_at=now
    )
    db.add(free_plan)
    db.add(inst_plan)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(setup_database):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_hierarchy_subscription_inheritance_and_isolation(client):
    # 1. Create a University User
    client.post("/api/auth/register", json={
        "username": "uni_admin", "password": "password123",
        "email": "uni@example.com", "role": "Researcher"
    })
    token_uni = client.post("/api/auth/login", json={"username": "uni_admin", "password": "password123"}).json()["token"]
    headers_uni = {"Authorization": f"Bearer {token_uni}"}

    # 2. Get active org (personal)
    res_active = client.get("/api/organizations/active", headers=headers_uni)
    personal_org_id = res_active.json()["id"]

    # 3. Create University Organization (Root)
    res_uni_org = client.post("/api/organizations", json={
        "name": "King Saud University",
        "slug": "ksu",
        "organization_type": "UNIVERSITY"
    }, headers=headers_uni)
    uni_org_id = res_uni_org.json()["id"]

    # Switch active org in headers
    headers_uni["X-Organization-ID"] = uni_org_id

    # 4. Subscribe University to INSTITUTION plan
    res_sub = client.post("/api/organizations/billing/subscribe", json={
        "plan_code": "INSTITUTION"
    }, headers=headers_uni)
    assert res_sub.status_code == 200

    # 5. Create a College Organization (Child of University)
    res_col_org = client.post("/api/organizations", json={
        "name": "College of Computer Science",
        "slug": "ksu-ccis",
        "organization_type": "COLLEGE",
        "parent_id": uni_org_id
    }, headers=headers_uni)
    col_org_id = res_col_org.json()["id"]
    assert res_col_org.json()["parent_id"] == uni_org_id
    assert res_col_org.json()["hierarchy_level"] == 1

    # 6. Check subscription of College (should inherit from University)
    headers_col = {"Authorization": f"Bearer {token_uni}", "X-Organization-ID": col_org_id}
    res_billing = client.get("/api/organizations/billing", headers=headers_col)
    assert res_billing.status_code == 200
    assert res_billing.json()["quota"]["plan_code"] == "INSTITUTION"  # Mapped via University!

    # 7. Create a project under the College
    res_proj = client.post("/api/projects", json={
        "titleAr": "بحث كلية الحاسب",
        "titleEn": "CS College Research Project",
        "studyDesign": "quasi_experimental_pre_post",
        "variables": [],
        "questions": [],
        "hypotheses": [],
        "sampleSettings": {
            "confidenceLevel": 0.95,
            "marginOfError": 0.05,
            "expectedPower": 0.80,
            "expectedEffectSize": 0.5,
            "expectedAttritionRate": 0.15,
            "groupsCount": 2
        }
    }, headers=headers_col)
    assert res_proj.status_code == 200
    proj_id = res_proj.json()["id"]

    # 8. Create a different root organization (e.g. Personal) and verify isolation
    headers_personal = {"Authorization": f"Bearer {token_uni}", "X-Organization-ID": personal_org_id}
    res_get_proj = client.get(f"/api/projects/{proj_id}", headers=headers_personal)
    # Should be 404/denied because it is in a different tenant context
    assert res_get_proj.status_code == 404

