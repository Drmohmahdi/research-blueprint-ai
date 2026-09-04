import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app
from app.models import AuditLog, MarketingLead, User
from app.routers.auth import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_marketing_db.db"
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


def test_capture_lead_stores_sanitized_audit(client):
    res = client.post(
        "/api/marketing/leads",
        json={
            "name": "<b>نورة</b>",
            "email": "noura@university.edu.sa",
            "organization": "كلية التربية",
            "intent": "demo",
            "message": "نرغب في عرض للكلية",
            "source_path": "/contact",
        },
    )
    assert res.status_code == 201
    assert res.json() == {"ok": True, "intent": "demo"}

    db = TestingSessionLocal()
    try:
        row = db.query(AuditLog).filter(AuditLog.action == "MARKETING_LEAD").one()
        details = json.loads(row.details)
        assert details["name"] == "نورة"
        assert details["email"] == "noura@university.edu.sa"
        assert "<" not in details["name"]
    finally:
        db.close()


def test_capture_lead_rejects_invalid_email(client):
    res = client.post(
        "/api/marketing/leads",
        json={"name": "باحث", "email": "not-an-email", "intent": "trial"},
    )
    assert res.status_code == 422


def _admin_headers(client):
    import datetime
    db = TestingSessionLocal()
    try:
        admin = User(
            id="usr-mkt-admin",
            username="mkt_admin",
            email="mkt_admin@example.com",
            hashed_password=hash_password("SecurePassword123"),
            role="SystemAdmin",
            account_status="ACTIVE",
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    login = client.post("/api/auth/login", json={"username": "mkt_admin", "password": "SecurePassword123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    org = client.get("/api/organizations/active", headers=headers)
    assert org.status_code == 200
    headers["X-Organization-ID"] = org.json()["id"]
    return headers


def test_admin_can_list_and_update_lead_status(client):
    client.post(
        "/api/marketing/leads",
        json={"name": "عميد", "email": "dean@university.edu.sa", "intent": "institutional", "organization": "عمادة"},
    )
    researcher = client.post("/api/auth/register", json={
        "username": "mkt_researcher",
        "password": "SecurePassword123",
        "email": "mkt_researcher@example.com",
        "role": "Researcher",
    })
    assert researcher.status_code == 200
    login = client.post("/api/auth/login", json={"username": "mkt_researcher", "password": "SecurePassword123"})
    researcher_headers = {"Authorization": f"Bearer {login.json()['token']}"}
    denied = client.get("/api/admin/leads", headers=researcher_headers)
    assert denied.status_code == 403

    headers = _admin_headers(client)
    listed = client.get("/api/admin/leads", headers=headers)
    assert listed.status_code == 200, listed.text
    rows = listed.json()
    assert any(row["email"] == "dean@university.edu.sa" for row in rows)
    lead_id = next(row["id"] for row in rows if row["email"] == "dean@university.edu.sa")
    patched = client.patch(f"/api/admin/leads/{lead_id}", json={"status": "CONTACTED", "notes": "تم الاتصال"}, headers=headers)
    assert patched.status_code == 200
    assert patched.json()["status"] == "CONTACTED"
    assert patched.json()["notes"] == "تم الاتصال"
    db = TestingSessionLocal()
    try:
        stored = db.query(MarketingLead).filter(MarketingLead.id == lead_id).one()
        assert stored.status == "CONTACTED"
        assert stored.notes == "تم الاتصال"
    finally:
        db.close()
