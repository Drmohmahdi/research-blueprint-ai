import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app
from app.models import User
from app.routers.auth import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_email_verify_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
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
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_register_issues_verification_and_confirming_marks_user(client):
    registered = client.post("/api/auth/register", json={
        "username": "verify_user",
        "password": "SecurePassword123",
        "email": "verify_user@example.com",
        "role": "Researcher",
    })
    assert registered.status_code == 200, registered.text
    token = registered.json().get("verification_token")
    assert token
    assert registered.json()["email_verified"] is False

    login = client.post("/api/auth/login", json={"username": "verify_user", "password": "SecurePassword123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email_verified"] is False

    confirmed = client.post("/api/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200
    me_after = client.get("/api/auth/me", headers=headers)
    assert me_after.json()["email_verified"] is True


def test_existing_accounts_can_still_login_unverified(client):
    db = TestingSessionLocal()
    try:
        user = User(
            id="usr-legacy",
            username="legacy_user",
            email="legacy@example.com",
            hashed_password=hash_password("SecurePassword123"),
            role="Researcher",
            account_status="ACTIVE",
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
        )
        db.add(user)
        db.commit()
    finally:
        db.close()
    login = client.post("/api/auth/login", json={"username": "legacy_user", "password": "SecurePassword123"})
    assert login.status_code == 200
