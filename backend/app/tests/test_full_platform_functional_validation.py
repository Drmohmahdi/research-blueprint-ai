"""End-to-end functional validation with realistic Saudi academic fixture data."""
import io
import secrets

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PASSWORD = "SecurePass123"


def _uid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(3)}"


def _register(username: str, email: str, role: str = "Researcher"):
    return client.post("/api/auth/register", json={
        "username": username,
        "password": PASSWORD,
        "email": email,
        "role": role,
    })


def _login_headers(username: str) -> dict:
    login = client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    org = client.get("/api/organizations/active", headers=headers)
    assert org.status_code == 200, org.text
    headers["X-Organization-ID"] = org.json()["id"]
    return headers


def test_full_platform_journey_with_realistic_academic_data():
    researcher = _uid("fv_researcher")
    outsider = _uid("fv_outsider")
    email = f"{researcher}@ksu.edu.sa"

    assert _register("ab", f"ab_{secrets.token_hex(2)}@ksu.edu.sa").status_code == 422
    assert _register(researcher, "not-an-email").status_code == 422
    weak = client.post("/api/auth/register", json={
        "username": _uid("fv_weak"),
        "password": "short",
        "email": f"weak_{secrets.token_hex(2)}@ksu.edu.sa",
        "role": "Researcher",
    })
    assert weak.status_code == 400

    created = _register(researcher, email)
    assert created.status_code == 200, created.text
    assert created.json()["username"] == researcher
    assert _register(researcher, email).status_code == 400

    assert _register(_uid("fv_admin_try"), f"adm_{secrets.token_hex(2)}@ksu.edu.sa", "OrganizationAdmin").status_code == 400

    bad_login = client.post("/api/auth/login", json={"username": researcher, "password": "WrongPass99"})
    assert bad_login.status_code == 401

    headers = _login_headers(researcher)
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["username"] == researcher

    lead = client.post("/api/marketing/leads", json={
        "name": "د. سارة العتيبي",
        "email": "sara.alotaibi@ksu.edu.sa",
        "organization": "كلية التربية — جامعة الملك سعود",
        "intent": "demo",
        "message": "طلب تجربة معزولة لعمادة الدراسات العليا",
        "source_path": "/contact",
    })
    assert lead.status_code == 201
    assert client.post("/api/marketing/leads", json={
        "name": "x", "email": "bad", "intent": "demo",
    }).status_code == 422

    empty_projects = client.get("/api/projects", headers=headers)
    assert empty_projects.status_code == 200
    assert empty_projects.json() == []

    project_payload = {
        "titleAr": "أثر التعلم المدمج على التحصيل الدراسي لدى طلاب المرحلة الثانوية",
        "titleEn": "Blended learning and secondary-school achievement",
        "departmentAr": "المناهج وطرق التدريس",
        "departmentEn": "Curriculum and Instruction",
        "institutionAr": "جامعة الملك سعود",
        "institutionEn": "King Saud University",
        "problemStatementAr": "ضعف التحصيل في مهارات الفهم القرائي بعد التحول الجزئي للتعليم عن بعد.",
        "problemStatementEn": "Reading-comprehension achievement dropped after partial remote instruction.",
        "studyDesign": "quasi_experimental_pre_post",
        "variables": [],
        "questions": [],
        "hypotheses": [],
        "sampleSettings": {"confidenceLevel": 0.95, "marginOfError": 0.05},
        "objectives": "قياس أثر التعلم المدمج على التحصيل مع ضبط المعرفة السابقة.",
    }
    created_project = client.post("/api/projects", json=project_payload, headers=headers)
    assert created_project.status_code == 200, created_project.text
    project = created_project.json()
    project_id = project["id"]
    assert project["titleAr"].startswith("أثر التعلم المدمج")
    assert project["titleEn"].startswith("Blended learning")

    listed = client.get("/api/projects", headers=headers)
    assert any(item["id"] == project_id for item in listed.json())

    fetched = client.get(f"/api/projects/{project_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["problemStatementAr"].startswith("ضعف التحصيل")

    updated = client.put(f"/api/projects/{project_id}", json={
        **project_payload,
        "titleEn": "Blended learning and secondary-school achievement (revised)",
        "variables": project.get("variables") or [],
        "questions": project.get("questions") or [],
        "hypotheses": project.get("hypotheses") or [],
    }, headers=headers)
    assert updated.status_code == 200, updated.text
    assert "revised" in updated.json()["titleEn"]

    workflow = client.post(f"/api/projects/{project_id}/workflow-profile", json={
        "activePathId": "NEW_STUDY_DESIGN",
        "completedSteps": ["ideaExploration"],
    }, headers=headers)
    assert workflow.status_code == 200

    study = client.post(
        f"/api/projects/{project_id}/literature-synthesis/studies",
        json={
            "author": "Alharbi & Nasser",
            "year": 2024,
            "sampleSize": 180,
            "effectSize": 0.42,
            "ciLower": 0.18,
            "ciUpper": 0.66,
            "doi": "10.1000/fv.blended.2024",
            "notes": "Quasi-experimental secondary reading study",
        },
        headers=headers,
    )
    assert study.status_code == 201, study.text
    study_id = study.json()["id"]

    invalid_study = client.post(
        f"/api/projects/{project_id}/literature-synthesis/studies",
        json={
            "author": "Broken CI",
            "year": 2020,
            "sampleSize": 10,
            "effectSize": 0.2,
            "ciLower": 0.8,
            "ciUpper": 0.1,
        },
        headers=headers,
    )
    assert invalid_study.status_code == 422

    synthesis = client.get(f"/api/projects/{project_id}/literature-synthesis", headers=headers)
    assert synthesis.status_code == 200
    assert synthesis.json()["totalStudies"] >= 1

    search = client.get("/api/search", params={"q": "التعلم المدمج", "limit": 10}, headers=headers)
    assert search.status_code == 200, search.text
    assert search.json()["total"] >= 1

    empty_search = client.get("/api/search", params={"q": "xyzzy-no-such-study-999"}, headers=headers)
    assert empty_search.status_code == 200
    assert empty_search.json()["total"] == 0

    injection = client.get("/api/search", params={"q": "'; DROP TABLE users;--"}, headers=headers)
    assert injection.status_code == 200

    upload = client.post(
        "/api/storage/upload",
        files={"file": ("pretest_scores.csv", io.BytesIO(b"id,score\n1,18\n2,21\n3,19\n"), "text/csv")},
        data={"project_id": project_id},
        headers=headers,
    )
    assert upload.status_code == 200, upload.text
    file_id = upload.json()["id"]
    downloaded = client.get(f"/api/storage/files/{file_id}/download", headers=headers)
    assert downloaded.status_code == 200
    assert b"score" in downloaded.content

    exe = client.post(
        "/api/storage/upload",
        files={"file": ("payload.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        data={"project_id": project_id},
        headers=headers,
    )
    assert exe.status_code in {400, 403, 415, 422}

    notifications = client.get("/api/notifications", headers=headers)
    assert notifications.status_code == 200
    unread = client.get("/api/notifications/unread-count", headers=headers)
    assert unread.status_code == 200
    prefs = client.get("/api/notifications/preferences", headers=headers)
    assert prefs.status_code == 200

    profile = client.post("/api/academic-foundation/profile/upsert", json={
        "preferred_name_ar": "د. فهد القحطاني",
        "preferred_name_en": "Dr. Fahad Alqahtani",
        "academic_title": "Assistant Professor",
        "current_rank": "ASSISTANT_PROFESSOR",
        "university": "King Saud University",
        "college": "College of Education",
        "department": "Curriculum and Instruction",
        "visibility_status": "PUBLIC",
        "short_bio_ar": "باحث في تقنيات التعليم والتعلم المدمج.",
        "short_bio_en": "Education-technology researcher focused on blended learning.",
    }, headers=headers)
    assert profile.status_code == 200, profile.text

    billing = client.get("/api/organizations/billing", headers=headers)
    assert billing.status_code == 200

    admin_settings = client.get("/api/admin/settings", headers=headers)
    assert admin_settings.status_code == 403
    admin_leads = client.get("/api/admin/leads", headers=headers)
    assert admin_leads.status_code == 403

    assert _register(outsider, f"{outsider}@imamu.edu.sa").status_code == 200
    outsider_headers = _login_headers(outsider)
    stolen = client.get(f"/api/projects/{project_id}", headers=outsider_headers)
    assert stolen.status_code in {403, 404}
    stolen_file = client.get(f"/api/storage/files/{file_id}/download", headers=outsider_headers)
    assert stolen_file.status_code in {403, 404}
    stolen_study = client.post(
        f"/api/projects/{project_id}/literature-synthesis/studies",
        json={
            "author": "Intruder",
            "year": 2021,
            "sampleSize": 12,
            "effectSize": 0.1,
            "ciLower": 0.0,
            "ciUpper": 0.2,
        },
        headers=outsider_headers,
    )
    assert stolen_study.status_code in {403, 404}

    deleted_study = client.delete(
        f"/api/projects/{project_id}/literature-synthesis/studies/{study_id}",
        headers=headers,
    )
    assert deleted_study.status_code in {200, 204}

    deleted_file = client.delete(f"/api/storage/files/{file_id}", headers=headers)
    assert deleted_file.status_code == 200

    gone = client.get(f"/api/storage/files/{file_id}/download", headers=headers)
    assert gone.status_code in {403, 404}

    logout = client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 200
    after_logout = client.get("/api/auth/me", headers=headers)
    assert after_logout.status_code == 401


def test_forgot_password_does_not_reveal_unknown_accounts():
    known = _uid("fv_reset")
    assert _register(known, f"{known}@ksu.edu.sa").status_code == 200
    known_res = client.post("/api/auth/forgot-password", json={"email": f"{known}@ksu.edu.sa"})
    unknown_res = client.post("/api/auth/forgot-password", json={"email": "nobody@ksu.edu.sa"})
    assert known_res.status_code == 200
    assert unknown_res.status_code == 200
    assert "reset_token" not in unknown_res.json()
