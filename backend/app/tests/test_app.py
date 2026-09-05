import pytest
import math
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services.stats_service import (
    normal_cdf,
    normal_inverse,
    calculate_power_sample_size,
    run_independent_t_test,
    inspect_uploaded_csv
)

# Setup temporary memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency override
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

# ================= 1. STATISTICAL TESTS =================


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_normal_distribution_boundaries(client):
    # Z score boundaries
    assert math.isclose(normal_cdf(0.0), 0.5, abs_tol=1e-5)
    assert normal_cdf(-10.0) < 1e-9
    assert normal_cdf(10.0) > 1.0 - 1e-9

    # PPF boundaries
    assert math.isclose(normal_inverse(0.5), 0.0, abs_tol=1e-5)
    assert normal_inverse(0.0001) < -3.0
    assert normal_inverse(0.9999) > 3.0


def test_health_and_readiness_endpoints(client):
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"

    ready_res = client.get("/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"
    assert ready_res.json()["database"] == "ok"


def test_api_security_headers(client):
    response = client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"


def test_default_cors_origin_is_allowed(client):
    for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        response = client.options(
            "/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin

def test_t_test_edge_cases(client):
    # Empty groups
    res_empty = run_independent_t_test([], [])
    assert res_empty["tStatistic"] == 0.0
    assert res_empty["pValue"] == 1.0
    assert res_empty["cohensD"] == 0.0

    # Single item groups (insufficient degrees of freedom)
    res_single = run_independent_t_test([10.0], [12.0])
    assert res_single["tStatistic"] == 0.0
    assert res_single["pValue"] == 1.0
    assert res_single["cohensD"] == 0.0

def test_power_sample_size_calculations(client):
    # Independent t-test standard parameters
    n_ind = calculate_power_sample_size("t_test_independent", alpha=0.05, power=0.80, effect_size=0.5)
    assert n_ind >= 100 # Should be ~128

    # Paired t-test
    n_paired = calculate_power_sample_size("t_test_paired", alpha=0.05, power=0.80, effect_size=0.5)
    assert n_paired < n_ind

# ================= 2. DATA INSPECTOR TESTS =================

def test_inspect_csv_anomalies(client):
    # Test valid clean CSV
    clean_csv = "Score,Age\n50,22\n60,25\n70,24\n"
    res_clean = inspect_uploaded_csv(clean_csv, is_arabic=False)
    assert res_clean["qualityScore"] == 100
    assert len(res_clean["issues"]) == 1

    # Test CSV with missing data
    missing_csv = "Score,Age\n,22\n60,25\n70,24\n"
    res_missing = inspect_uploaded_csv(missing_csv, is_arabic=False)
    assert res_missing["qualityScore"] < 100
    assert any("missing values" in iss for iss in res_missing["issues"])

    # Test CSV with outliers (Z-Score > 3)
    # 20 items to establish standard deviation, with one huge outlier 1000
    outlier_csv = "Score\n" + "\n".join(["50"]*20) + "\n1000\n"
    res_outlier = inspect_uploaded_csv(outlier_csv, is_arabic=False)
    assert res_outlier["qualityScore"] < 100
    assert any("outliers" in iss for iss in res_outlier["issues"])

# ================= 3. AUTH & PRIVILEGES TESTS =================

def test_auth_registration_and_login(client):
    # 1. Register User A (Researcher)
    reg_data_a = {
        "username": "user_a",
        "password": "securepassword123",
        "email": "user_a@example.com",
        "role": "Researcher"
    }
    response_reg = client.post("/api/auth/register", json=reg_data_a)
    assert response_reg.status_code == 200
    assert response_reg.json()["username"] == "user_a"

    # 2. Login User A
    login_data_a = {
        "username": "user_a",
        "password": "securepassword123"
    }
    response_login = client.post("/api/auth/login", json=login_data_a)
    assert response_login.status_code == 200
    token_a = response_login.json()["token"]
    assert token_a is not None
    set_cookie = response_login.headers["set-cookie"].lower()
    assert "session_token=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert me.status_code == 200
    assert me.json()["username"] == "user_a"
    assert me.json()["email"] == "user_a@example.com"

    # 3. Create Project for User A
    project_payload = {
        "titleAr": "مشروع أ",
        "titleEn": "Project A",
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
    }
    headers_a = {"Authorization": f"Bearer {token_a}"}
    response_create = client.post("/api/projects", json=project_payload, headers=headers_a)
    assert response_create.status_code == 200
    proj_id = response_create.json()["id"]

    # 4. Register User B (Researcher)
    reg_data_b = {
        "username": "user_b",
        "password": "securepassword456",
        "email": "user_b@example.com",
        "role": "Researcher"
    }
    client.post("/api/auth/register", json=reg_data_b)

    # 5. Login User B
    login_data_b = {
        "username": "user_b",
        "password": "securepassword456"
    }
    response_login_b = client.post("/api/auth/login", json=login_data_b)
    token_b = response_login_b.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 6. User B attempts to access User A's project (Permission test!)
    response_get_unauthorized = client.get(f"/api/projects/{proj_id}", headers=headers_b)
    # Should block and return 404 (Access Denied / Not Found)
    assert response_get_unauthorized.status_code == 404


def test_auth_me_requires_session(client):
    assert client.get("/api/auth/me").status_code == 401


def test_password_reset_flow(client):
    client.post("/api/auth/register", json={
        "username": "reset_user",
        "password": "oldpassword1",
        "email": "reset_user@example.com",
        "role": "Researcher",
    })
    forgot = client.post("/api/auth/forgot-password", json={"email": "reset_user@example.com"})
    assert forgot.status_code == 200
    token = forgot.json().get("reset_token")
    assert token
    unknown = client.post("/api/auth/forgot-password", json={"email": "missing@example.com"})
    assert unknown.status_code == 200
    assert "reset_token" not in unknown.json()
    reset = client.post("/api/auth/reset-password", json={"token": token, "new_password": "newpassword2"})
    assert reset.status_code == 200
    old_login = client.post("/api/auth/login", json={"username": "reset_user", "password": "oldpassword1"})
    assert old_login.status_code == 401
    new_login = client.post("/api/auth/login", json={"username": "reset_user", "password": "newpassword2"})
    assert new_login.status_code == 200


def test_forgot_password_sends_reset_link_through_email_adapter(client, monkeypatch):
    from app.services.notifications.email_adapter import EmailDeliveryResult
    from app.services.notifications.events import DeliveryStatus

    sent = []

    class FakeAdapter:
        def send_email(self, message):
            sent.append(message)
            return EmailDeliveryResult(
                status=DeliveryStatus.NOT_CONFIGURED,
                success=False,
                failure_code="PROVIDER_NOT_CONFIGURED",
                message="Email delivery is not configured in current environment.",
            )

    monkeypatch.setattr("app.routers.auth.get_email_adapter", lambda: FakeAdapter())
    client.post("/api/auth/register", json={
        "username": "reset_mail_user",
        "password": "oldpassword1",
        "email": "reset_mail_user@example.com",
        "role": "Researcher",
    })
    forgot = client.post("/api/auth/forgot-password", json={"email": "reset_mail_user@example.com"})
    assert forgot.status_code == 200
    assert sent
    # register() also sends a separate email-verification message, so locate
    # the password-reset message by its template rather than assuming index 0.
    reset_messages = [m for m in sent if m.template_key == "password_reset"]
    assert reset_messages
    assert "/login?token=" in reset_messages[0].body_text
    assert reset_messages[0].recipient_email == "reset_mail_user@example.com"
    assert forgot.json().get("reset_token")
