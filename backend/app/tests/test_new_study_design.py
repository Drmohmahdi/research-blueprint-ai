import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app

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
    yield
    Base.metadata.drop_all(bind=engine)



@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_new_study_design_path_progression_and_comments_isolation(client):
    # 1. Register and Login User A
    reg_data_a = {
        "username": "studypath_user_a",
        "password": "securepassword123",
        "email": "studypath_user_a@example.com",
        "role": "Researcher"
    }
    client.post("/api/auth/register", json=reg_data_a)
    login_data_a = {"username": "studypath_user_a", "password": "securepassword123"}
    res_login_a = client.post("/api/auth/login", json=login_data_a)
    token_a = res_login_a.json()["token"]
    
    # Get User A active organization
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res_org_a = client.get("/api/organizations/active", headers=headers_a)
    org_a_id = res_org_a.json()["id"]
    headers_a["X-Organization-ID"] = org_a_id

    # 2. Create Project under Organization A
    project_payload = {
        "titleAr": "مشروع أثر استكشافي", "titleEn": "Exploratory Project",
        "studyDesign": "quasi_experimental_pre_post", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05}
    }
    res_p = client.post("/api/projects", json=project_payload, headers=headers_a)
    assert res_p.status_code == 200
    p_id = res_p.json()["id"]

    # 3. Update activePathId and completedSteps
    update_workflow_payload = {
        "activePathId": "NEW_STUDY_DESIGN",
        "completedSteps": ["ideaExploration", "titleAnalysis", "problemGap"]
    }
    res_update = client.post(f"/api/projects/{p_id}/workflow-profile", json=update_workflow_payload, headers=headers_a)
    assert res_update.status_code == 200
    assert res_update.json()["activePathId"] == "NEW_STUDY_DESIGN"
    assert "ideaExploration" in res_update.json()["completedSteps"]

    # 4. Post supervisor comment on specific step
    comment_payload = {
        "projectId": p_id,
        "contentAr": "ملاحظة تدقيقية للخطوة الأولى",
        "step": "ideaExploration",
        "priority": "HIGH"
    }
    res_comment = client.post("/api/comments/", json=comment_payload, headers=headers_a)
    assert res_comment.status_code == 200
    comment_id = res_comment.json()["id"]

    # 5. List step comments
    res_comments_list = client.get(f"/api/comments/project/{p_id}?step=ideaExploration", headers=headers_a)
    assert res_comments_list.status_code == 200
    assert len(res_comments_list.json()) > 0
    assert res_comments_list.json()[0]["id"] == comment_id

    # 6. Register and Login User B (Cross-tenant intruder)
    reg_data_b = {
        "username": "studypath_user_b",
        "password": "securepassword123",
        "email": "studypath_user_b@example.com",
        "role": "Researcher"
    }
    client.post("/api/auth/register", json=reg_data_b)
    login_data_b = {"username": "studypath_user_b", "password": "securepassword123"}
    res_login_b = client.post("/api/auth/login", json=login_data_b)
    token_b = res_login_b.json()["token"]
    
    headers_b = {"Authorization": f"Bearer {token_b}"}
    res_org_b = client.get("/api/organizations/active", headers=headers_b)
    org_b_id = res_org_b.json()["id"]
    headers_b["X-Organization-ID"] = org_b_id

    # Try updating User A's project workflow from User B context -> Must return 404/403
    res_intruder_update = client.post(f"/api/projects/{p_id}/workflow-profile", json=update_workflow_payload, headers=headers_b)
    assert res_intruder_update.status_code in [403, 404]

    # Try posting comment to User A's project from User B -> Must block
    res_intruder_comment = client.post("/api/comments/", json=comment_payload, headers=headers_b)
    assert res_intruder_comment.status_code in [403, 404]


def test_create_project_persists_active_path(client):
    username = "studypath_create_path"
    client.post("/api/auth/register", json={
        "username": username,
        "password": "securepassword123",
        "email": f"{username}@example.com",
        "role": "Researcher",
    })
    login = client.post("/api/auth/login", json={"username": username, "password": "securepassword123"})
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    org = client.get("/api/organizations/active", headers=headers)
    headers["X-Organization-ID"] = org.json()["id"]

    payload = {
        "titleAr": "مشروع من اختيار المسار",
        "titleEn": "Path Adopted Project",
        "studyDesign": "quasi_experimental_pre_post",
        "variables": [],
        "questions": [],
        "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
        "activePathId": "NEW_STUDY_DESIGN",
        "completedSteps": [],
    }
    created = client.post("/api/projects", json=payload, headers=headers)
    assert created.status_code == 200
    body = created.json()
    assert body["id"].startswith("proj-")
    assert body["id"] != "demo-1"
    assert body["activePathId"] == "NEW_STUDY_DESIGN"

    listed = client.get("/api/projects", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == body["id"] and item["activePathId"] == "NEW_STUDY_DESIGN" for item in listed.json())
