import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.models  # Import all models to ensure Base.metadata is populated
from app.db import Base, get_db
from app.main import app
from app.models import Plan
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_orgs_db.db"
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

def test_organization_provisioning_and_switching(client):
    # 1. Register User A
    client.post("/api/auth/register", json={
        "username": "org_user_a", "password": "securepassword123",
        "email": "org_a@example.com", "role": "Researcher"
    })
    
    # 2. Login User A
    token_a = client.post("/api/auth/login", json={"username": "org_user_a", "password": "securepassword123"}).json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # 3. Get Active Org for User A
    res_active = client.get("/api/organizations/active", headers=headers_a)
    assert res_active.status_code == 200
    org_a_id = res_active.json()["id"]
    assert res_active.json()["name"] == "مساحة org_user_a الشخصية"
    
    # 4. List User A's organizations
    res_list = client.get("/api/organizations", headers=headers_a)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["id"] == org_a_id
    
    # 5. Create a new team organization
    res_create = client.post("/api/organizations", json={
        "name": "Team Alpha",
        "slug": "team-alpha",
        "organization_type": "RESEARCH_TEAM"
    }, headers=headers_a)
    assert res_create.status_code == 200
    team_org_id = res_create.json()["id"]
    
    # 6. List orgs again, should be 2
    res_list2 = client.get("/api/organizations", headers=headers_a)
    assert len(res_list2.json()) == 2
    
    # 7. Switch to new org by passing it in header
    headers_a["X-Organization-ID"] = team_org_id
    res_active2 = client.get("/api/organizations/active", headers=headers_a)
    assert res_active2.status_code == 200
    assert res_active2.json()["id"] == team_org_id
    assert res_active2.json()["name"] == "Team Alpha"

