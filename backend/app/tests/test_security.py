import pytest
from fastapi.testclient import TestClient
import app.models
from app.main import app
from app.services.sanitization import sanitize_text
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.routers.auth import _parse_session_expiry
from datetime import UTC

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_security_db.db"
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

def test_html_sanitization(client):
    # Test stripping normal HTML tags
    dirty1 = "<script>alert('xss')</script> Hello World"
    clean1 = sanitize_text(dirty1)
    assert "<script>" not in clean1
    assert "Hello World" in clean1

    # Test stripping attributes and keeping text
    dirty2 = '<p style="color:red" onclick="malicious()">Safe Text</p>'
    clean2 = sanitize_text(dirty2)
    assert "<p" not in clean2
    assert "Safe Text" in clean2

    # Test complex/broken HTML
    dirty3 = "<div>Just some text <b onmouseover='bad()'>bold</b></div>"
    clean3 = sanitize_text(dirty3)
    assert "<div" not in clean3
    assert "Just some text" in clean3
    assert "bold" in clean3

    # Test empty string and None
    assert sanitize_text("") == ""
    assert sanitize_text(None) is None


def test_password_strength_validation(client):
    # Attempt to register with a weak password (too short)
    reg_data_short = {
        "username": "weak_user_1",
        "password": "pwd",
        "email": "weak1@example.com",
        "role": "Researcher"
    }
    resp1 = client.post("/api/auth/register", json=reg_data_short)
    assert resp1.status_code == 400
    assert "Password must be at least 8 characters long" in resp1.json()["detail"]

    # Attempt to register with a weak password (no numbers)
    reg_data_no_nums = {
        "username": "weak_user_2",
        "password": "passwordonlyletters",
        "email": "weak2@example.com",
        "role": "Researcher"
    }
    resp2 = client.post("/api/auth/register", json=reg_data_no_nums)
    assert resp2.status_code == 400
    assert "Password must be at least 8 characters long" in resp2.json()["detail"]

    # Attempt to register with a weak password (no letters)
    reg_data_no_letters = {
        "username": "weak_user_3",
        "password": "1234567890",
        "email": "weak3@example.com",
        "role": "Researcher"
    }
    resp3 = client.post("/api/auth/register", json=reg_data_no_letters)
    assert resp3.status_code == 400
    assert "Password must be at least 8 characters long" in resp3.json()["detail"]

    # Attempt to register with a strong password (at least 8 chars, alphanumeric)
    # The endpoint might return 200 or 400 depending on DB state, but it won't fail validation.
    reg_data_strong = {
        "username": "strong_user_1",
        "password": "SecurePassword123",
        "email": "strong1@example.com",
        "role": "Researcher"
    }
    resp4 = client.post("/api/auth/register", json=reg_data_strong)
    # Assuming the user doesn't already exist, should be 200
    assert resp4.status_code == 200


def test_session_expiry_parser_accepts_legacy_naive_timestamps():
    expiry = _parse_session_expiry("2026-07-20T12:00:00")
    assert expiry.tzinfo == UTC
