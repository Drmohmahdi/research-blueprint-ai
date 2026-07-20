"""
Tests for Academic Visibility module (Module 5)
بصيرة للهوية والانتشار الأكاديمي
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app
from app.services.tenant_context import get_tenant_context, TenantContext

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_visibility.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


class MockTenantContext:
    """Minimal mock for TenantContext to bypass auth in tests."""
    role = "OWNER"
    limits = {"max_projects": 999}
    features = {}
    subscription_owner_id = "test-org"

    class _User:
        id = "test-user-visibility-001"
        username = "test_vis_user"

    class _Organization:
        id = "test-org"
        name = "Test Org"

    class _Plan:
        name = "enterprise"
        limits_json = {}
        features_json = {}

    class _Membership:
        role = "OWNER"

    class _Subscription:
        plan_id = "enterprise"

    user = _User()
    organization = _Organization()
    plan = _Plan()
    membership = _Membership()
    subscription = _Subscription()


def override_tenant_context():
    return MockTenantContext()


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_tenant_context] = override_tenant_context
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


USER_ID = "test-user-visibility-001"


def test_get_profile_creates_default(client):
    """GET /api/academic-visibility/profile/{user_id} should auto-create profile with channels."""
    resp = client.get(f"/api/academic-visibility/profile/{USER_ID}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["profile"]["userId"] == USER_ID
    assert data["profile"]["preferredNameAr"] == ""
    # Should auto-create 6 default channels
    assert len(data["channels"]) >= 6
    channel_names = [ch["channelName"] for ch in data["channels"]]
    assert "ORCID" in channel_names
    assert "Google Scholar" in channel_names
    assert "ResearchGate" in channel_names


def test_upsert_profile(client):
    """POST /api/academic-visibility/profile should save profile data."""
    payload = {
        "userId": USER_ID,
        "preferredNameAr": "أحمد محمد علي",
        "preferredNameEn": "Ahmed Mohammed Ali",
        "nameVariants": "A.M. Ali, A. Ali",
        "discipline": "علم النفس التربوي",
        "researchInterests": "التقييم, التحصيل الدراسي",
        "keywords": "psychology, education, assessment",
        "shortBio": "باحث متخصص في التقييم التربوي",
        "fullBio": "أستاذ مساعد في قسم علم النفس التربوي ...",
        "channels": [
            {
                "channelName": "ORCID",
                "profileUrl": "https://orcid.org/0000-0000-0000-0001",
                "externalId": "0000-0000-0000-0001",
                "status": "active",
                "completenessScore": 85
            },
            {
                "channelName": "Google Scholar",
                "profileUrl": "https://scholar.google.com/citations?user=test",
                "externalId": "test",
                "status": "active",
                "completenessScore": 70
            }
        ]
    }
    resp = client.post("/api/academic-visibility/profile", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "profileId" in data


def test_get_profile_after_update(client):
    """GET profile should now return the updated data."""
    resp = client.get(f"/api/academic-visibility/profile/{USER_ID}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["profile"]["preferredNameAr"] == "أحمد محمد علي"
    assert data["profile"]["preferredNameEn"] == "Ahmed Mohammed Ali"
    assert data["profile"]["discipline"] == "علم النفس التربوي"
    # Should have 2 channels (we upserted 2)
    assert len(data["channels"]) == 2
    orcid_channel = next(
        (ch for ch in data["channels"] if ch["channelName"] == "ORCID"), None
    )
    assert orcid_channel is not None
    assert orcid_channel["completenessScore"] == 85
    assert orcid_channel["status"] == "active"


def test_different_users_isolated(client):
    """Different users should have isolated profiles."""
    other_user = "other-user-visibility-002"
    resp = client.get(f"/api/academic-visibility/profile/{other_user}")
    assert resp.status_code == 200
    data = resp.json()
    # Other user should have empty/default profile
    assert data["profile"]["preferredNameAr"] == ""
    assert data["profile"]["userId"] == other_user
