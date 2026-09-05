import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.models  # Import all models to ensure Base.metadata is populated
from app.db import Base, get_db
from app.main import app
from app.models import Plan
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_comments_db.db"
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

def test_comment_creation_and_isolation(client):
    # 1. Register User A
    client.post("/api/auth/register", json={
        "username": "comment_user_a", "password": "securepassword123",
        "email": "a@example.com", "role": "Researcher"
    })
    
    # 2. Login User A
    token_a = client.post("/api/auth/login", json={"username": "comment_user_a", "password": "securepassword123"}).json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # 3. Get Active Org for User A
    org_a_id = client.get("/api/organizations/active", headers=headers_a).json()["id"]
    headers_a["X-Organization-ID"] = org_a_id
    
    # 4. Create Project for User A
    res_proj = client.post("/api/projects", json={
        "titleAr": "Test Project", "titleEn": "Test Project",
        "studyDesign": "descriptive", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05}
    }, headers=headers_a)
    proj_id = res_proj.json()["id"]
    
    # 5. Create Comment on Project
    comment_payload = {
        "projectId": proj_id,
        "contentAr": "تعليق تجريبي",
        "contentEn": "Test Comment",
        "priority": "HIGH"
    }
    res_comment = client.post("/api/comments", json=comment_payload, headers=headers_a)
    assert res_comment.status_code == 200
    res_comment.json()["id"]
    
    # 6. List Comments for Project (User A)
    res_list = client.get(f"/api/comments/project/{proj_id}", headers=headers_a)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["contentAr"] == "تعليق تجريبي"
    
    # 7. Register User B
    client.post("/api/auth/register", json={
        "username": "comment_user_b", "password": "securepassword123",
        "email": "b@example.com", "role": "Researcher"
    })
    token_b = client.post("/api/auth/login", json={"username": "comment_user_b", "password": "securepassword123"}).json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    org_b_id = client.get("/api/organizations/active", headers=headers_b).json()["id"]
    headers_b["X-Organization-ID"] = org_b_id
    
    # 8. User B tries to access User A's project comments -> should be 403/404 isolation
    res_cross_list = client.get(f"/api/comments/project/{proj_id}", headers=headers_b)
    # The endpoint in comments router currently checks TenantContext but does it ensure project belongs to org?
    # Wait, the comments router might not be checking TenantContext properly if it wasn't updated!
    # Let's assert what should happen if we are strictly isolated.
    assert res_cross_list.status_code in [403, 404]

