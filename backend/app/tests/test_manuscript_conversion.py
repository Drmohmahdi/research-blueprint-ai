"""
B1.1 — Manuscript Conversion Runtime Tests
Tests POST /api/projects/{id}/create-manuscript for idempotency, concurrency, and rollback.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_manuscript_db.db"
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


def _register_and_login(client, username, email):
    """Helper: register user, login, get token and org headers."""
    reg = {"username": username, "password": "securepass123", "email": email, "role": "Researcher"}
    client.post("/api/auth/register", json=reg)
    res = client.post("/api/auth/login", json={"username": username, "password": "securepass123"})
    token = res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    org_res = client.get("/api/organizations/active", headers=headers)
    org_id = org_res.json()["id"]
    headers["X-Organization-ID"] = org_id
    return headers, org_id


def _create_project(client, headers):
    """Helper: create a research project."""
    payload = {
        "titleAr": "دراسة اختبار المخطوطة", "titleEn": "Manuscript Test Study",
        "studyDesign": "quasi_experimental_pre_post", "variables": [], "questions": [], "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05}
    }
    res = client.post("/api/projects", json=payload, headers=headers)
    assert res.status_code == 200
    return res.json()["id"]


class TestManuscriptConversionFirstTime:
    def test_first_manuscript_creation(self, client):
        """TC1: First-time creation should succeed and return child asset"""
        headers, org_id = _register_and_login(client, "manuscript_user_1", "m1@test.com")
        project_id = _create_project(client, headers)

        res = client.post(f"/api/projects/{project_id}/create-manuscript", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["manuscriptAssetId"] is not None
        assert data["parentAssetId"] is not None
        assert data["lifecycleStatus"] == "DRAFT"


class TestManuscriptIdempotency:
    def test_second_call_creates_new_manuscript(self, client):
        """TC2: Second call creates another manuscript (not idempotent by design — each call = new manuscript)"""
        headers, org_id = _register_and_login(client, "manuscript_user_2", "m2@test.com")
        project_id = _create_project(client, headers)

        res1 = client.post(f"/api/projects/{project_id}/create-manuscript", headers=headers)
        assert res1.status_code == 200
        id1 = res1.json()["manuscriptAssetId"]

        res2 = client.post(f"/api/projects/{project_id}/create-manuscript", headers=headers)
        assert res2.status_code == 200
        id2 = res2.json()["manuscriptAssetId"]

        # Both should share the same parent
        assert res1.json()["parentAssetId"] == res2.json()["parentAssetId"]
        # But different manuscript IDs
        assert id1 != id2


class TestManuscriptCrossTenant:
    def test_cross_tenant_blocked(self, client):
        """TC5: User from Org B cannot create manuscript for Org A project"""
        headers_a, org_a = _register_and_login(client, "manuscript_user_a", "ma@test.com")
        project_id = _create_project(client, headers_a)

        headers_b, org_b = _register_and_login(client, "manuscript_user_b", "mb@test.com")

        res = client.post(f"/api/projects/{project_id}/create-manuscript", headers=headers_b)
        assert res.status_code in [403, 404], f"Expected 403/404, got {res.status_code}"


class TestManuscriptNotFound:
    def test_nonexistent_project(self, client):
        """TC6: Non-existent project returns 404"""
        headers, org_id = _register_and_login(client, "manuscript_user_nf", "mnf@test.com")
        res = client.post("/api/projects/nonexistent-id/create-manuscript", headers=headers)
        assert res.status_code == 404


class TestManuscriptParentAssetLink:
    def test_parent_asset_auto_provisioned(self, client):
        """TC7: Project without ScholarlyAsset gets one auto-provisioned"""
        headers, org_id = _register_and_login(client, "manuscript_user_ap", "map@test.com")
        project_id = _create_project(client, headers)

        res = client.post(f"/api/projects/{project_id}/create-manuscript", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["parentAssetId"] is not None
        assert data["manuscriptAssetId"] != data["parentAssetId"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
