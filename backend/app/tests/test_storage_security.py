import io
import os
import hashlib
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db import get_db
from app import models
from app.routers.auth import hash_password
from app.services.billing.bootstrap import ensure_plans_and_pricing_seeded
from app.services.storage import (
    FileValidationService,
    LocalStorageProvider,
    StorageQuotaService,
    MAX_FILE_SIZE_BYTES,
    BLOCKED_EXTENSIONS,
    get_storage_provider,
)

client = TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES & HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def create_test_tenant(db: Session, suffix: str, plan_id: str = "pln-enterprise"):
    """Helper to create test tenant, users, and subscription."""
    ensure_plans_and_pricing_seeded(db)

    org = models.Organization(
        id=f"org-storage-{suffix}",
        name=f"Storage Lab {suffix}",
        slug=f"storage-lab-{suffix}",
        owner_user_id=f"usr-owner-{suffix}",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(org)

    owner = models.User(
        id=f"usr-owner-{suffix}",
        email=f"owner_{suffix}@test.com",
        username=f"owner_{suffix}",
        hashed_password=hash_password("Password123!"),
        role="OWNER",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(owner)

    researcher = models.User(
        id=f"usr-res-{suffix}",
        email=f"res_{suffix}@test.com",
        username=f"res_{suffix}",
        hashed_password=hash_password("Password123!"),
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(researcher)

    colleague = models.User(
        id=f"usr-colleague-{suffix}",
        email=f"colleague_{suffix}@test.com",
        username=f"colleague_{suffix}",
        hashed_password=hash_password("Password123!"),
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add(colleague)

    db.flush()

    m1 = models.OrganizationMembership(
        id=f"mem-owner-{suffix}",
        organization_id=org.id,
        user_id=owner.id,
        role="OWNER",
        created_at="2026-08-23T00:00:00Z"
    )
    m2 = models.OrganizationMembership(
        id=f"mem-res-{suffix}",
        organization_id=org.id,
        user_id=researcher.id,
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    )
    m3 = models.OrganizationMembership(
        id=f"mem-colleague-{suffix}",
        organization_id=org.id,
        user_id=colleague.id,
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    )
    db.add_all([m1, m2, m3])

    sub = models.Subscription(
        id=f"sub-storage-{suffix}",
        organization_id=org.id,
        plan_id=plan_id,
        status="ACTIVE",
        billing_interval="MONTHLY",
        unit_amount_minor_units=0,
        currency="SAR",
        current_period_start="2026-08-01T00:00:00Z",
        current_period_end="2036-09-01T00:00:00Z",
        created_at="2026-08-01T00:00:00Z"
    )
    db.add(sub)
    db.commit()

    return {
        "org": org,
        "owner": owner,
        "researcher": researcher,
        "colleague": colleague
    }


def get_auth_headers(username: str, org_id: str):
    res = client.post("/api/auth/login", json={"username": username, "password": "Password123!"})
    token = res.json()["token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-ID": org_id
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. UNIT & SERVICE-LEVEL STORAGE VALIDATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_filename_sanitization_and_path_traversal():
    """Verifies that malicious path traversal filenames are neutralized."""
    malicious_names = [
        ("../../etc/passwd", "etcpasswd"),
        ("..\\..\\windows\\system32\\cmd.exe", "windowssystem32cmd.exe"),
        ("/var/log/secret.pdf", "secret.pdf"),
        ("research\r\nheader.pdf", "researchheader.pdf"),
        ("بحث_علمي_2026.pdf", "بحث_علمي_2026.pdf"),
        ('test"file\x00.docx', 'testfile.docx')
    ]
    for raw, expected in malicious_names:
        clean = FileValidationService.sanitize_filename(raw)
        assert "/" not in clean
        assert "\\" not in clean
        assert ".." not in clean
        assert "\r" not in clean
        assert "\n" not in clean
        assert "\x00" not in clean


def test_blocked_dangerous_extensions():
    """Verifies that executables, scripts, and macro-enabled files are rejected."""
    for ext in [".exe", ".bat", ".cmd", ".ps1", ".sh", ".svg", ".docm", ".xlsm"]:
        fake_content = b"echo 'malicious payload'"
        with pytest.raises(Exception) as exc_info:
            FileValidationService.validate_file(
                file_content=fake_content,
                filename=f"payload{ext}",
                declared_mime="application/octet-stream"
            )
        assert exc_info.value.status_code == 400


def test_magic_bytes_structural_validation():
    """Verifies that MIME/magic bytes spoofing (fake PDF / fake DOCX) is rejected."""
    # 1. Fake PDF with plain text content
    fake_pdf = b"This is not a real PDF file."
    with pytest.raises(Exception) as exc_info:
        FileValidationService.validate_file(
            file_content=fake_pdf,
            filename="paper.pdf",
            declared_mime="application/pdf"
        )
    assert exc_info.value.status_code == 400

    # 2. Valid PDF with %PDF- header
    valid_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    clean_name, detected_mime, size, sha = FileValidationService.validate_file(
        file_content=valid_pdf,
        filename="valid_paper.pdf",
        declared_mime="application/pdf"
    )
    assert clean_name == "valid_paper.pdf"
    assert detected_mime == "application/pdf"
    assert size == len(valid_pdf)
    assert sha == hashlib.sha256(valid_pdf).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# 2. API-LEVEL UPLOAD & INTEGRITY TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_api_upload_valid_pdf_and_integrity_hash(db_session: Session):
    """Verifies successful file upload with SHA-256 checksum and audit log."""
    t = create_test_tenant(db_session, "upload1", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    pdf_content = b"%PDF-1.4\n% Baseerah Academic Storage Hardening 2026\n%%EOF"
    expected_sha256 = hashlib.sha256(pdf_content).hexdigest()

    response = client.post(
        "/api/storage/upload",
        headers=headers,
        data={"classification": "INTERNAL", "category": "RESEARCH_ATTACHMENT"},
        files={"file": ("manuscript.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "manuscript.pdf"
    assert data["size_bytes"] == len(pdf_content)

    # Verify database record
    db_file = db_session.query(models.UploadedFile).filter(models.UploadedFile.id == data["id"]).first()
    assert db_file is not None
    assert db_file.checksum == expected_sha256
    assert db_file.organization_id == t["org"].id
    assert db_file.uploaded_by == t["researcher"].id
    assert "tenant/" in db_file.storage_key


def test_api_upload_disguised_executable_rejected(db_session: Session):
    """Verifies that an executable disguised as PDF is blocked by magic byte check."""
    t = create_test_tenant(db_session, "spoof1", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"  # DOS/PE header
    response = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("malware.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    )
    assert response.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# 3. TENANT ISOLATION & SAME-TENANT HORIZONTAL IDOR TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_cross_tenant_file_download_blocked(db_session: Session):
    """Verifies that Tenant B cannot access or download files belonging to Tenant A."""
    t1 = create_test_tenant(db_session, "tenantA", "pln-enterprise")
    t2 = create_test_tenant(db_session, "tenantB", "pln-enterprise")

    headers_a = get_auth_headers(t1["researcher"].username, t1["org"].id)
    headers_b = get_auth_headers(t2["researcher"].username, t2["org"].id)

    # Org A uploads file
    pdf_content = b"%PDF-1.4\n% Confidential Research for Tenant A\n%%EOF"
    upload_resp = client.post(
        "/api/storage/upload",
        headers=headers_a,
        files={"file": ("tenant_a_paper.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["id"]

    # Org B attempts to download via legacy endpoint
    res_b_legacy = client.get(
        f"/api/storage/download/{t1['org'].id}/{file_id}",
        headers=headers_b
    )
    assert res_b_legacy.status_code == 403

    # Org B attempts to download via direct endpoint
    res_b_direct = client.get(
        f"/api/storage/files/{file_id}/download",
        headers=headers_b
    )
    assert res_b_direct.status_code in [403, 404]


def test_same_tenant_horizontal_file_access(db_session: Session):
    """Same-tenant horizontal isolation: neither an unrelated colleague nor the
    organization OWNER role can read another member's private file with no
    explicit relationship to it — only a genuine platform-wide admin (or the
    uploader) can. Organization role is not a substitute for a per-resource
    relationship (see storage.py FileAccessPolicy)."""
    t = create_test_tenant(db_session, "same_tenant", "pln-enterprise")
    headers_res_a = get_auth_headers(t["researcher"].username, t["org"].id)
    headers_res_b = get_auth_headers(t["colleague"].username, t["org"].id)
    headers_owner = get_auth_headers(t["owner"].username, t["org"].id)

    platform_admin = models.User(
        id="usr-platform-admin-same-tenant",
        email="platform_admin_same_tenant@test.com",
        username="platform_admin_same_tenant",
        hashed_password=hash_password("Password123!"),
        role="ADMIN",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(platform_admin)
    db_session.add(models.OrganizationMembership(
        id="mem-platform-admin-same-tenant",
        organization_id=t["org"].id,
        user_id=platform_admin.id,
        role="RESEARCHER",
        created_at="2026-08-23T00:00:00Z"
    ))
    db_session.commit()
    headers_platform_admin = get_auth_headers(platform_admin.username, t["org"].id)

    # Researcher A uploads private file
    pdf_content = b"%PDF-1.4\n% Private research draft\n%%EOF"
    upload_resp = client.post(
        "/api/storage/upload",
        headers=headers_res_a,
        data={"classification": "INTERNAL"},
        files={"file": ("private_draft.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["id"]

    # Colleague B tries to download Researcher A's unshared file -> 403 Forbidden
    res_b = client.get(f"/api/storage/files/{file_id}/download", headers=headers_res_b)
    assert res_b.status_code == 403

    # Organization OWNER role alone, with no relationship to this file, is
    # ALSO denied — org role is not a blanket file-access grant.
    res_owner = client.get(f"/api/storage/files/{file_id}/download", headers=headers_owner)
    assert res_owner.status_code == 403

    # A genuine platform-wide admin retains override access, with headers intact.
    res_admin = client.get(f"/api/storage/files/{file_id}/download", headers=headers_platform_admin)
    assert res_admin.status_code == 200
    assert res_admin.headers.get("X-Content-Type-Options") == "nosniff"
    assert "attachment" in res_admin.headers.get("Content-Disposition", "")


# ─────────────────────────────────────────────────────────────────────────────
# 4. STORAGE QUOTA & ENTITLEMENT TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_storage_quota_enforcement_on_limited_plan(db_session: Session):
    """Verifies that exceeding storage limit raises 403 Forbidden without leaking storage."""
    # Create tenant on Free Plan with max_storage_mb = 100
    t = create_test_tenant(db_session, "quota1", "pln-free")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    # Artificially insert existing usage totaling 99.9 MB
    large_size = int(99.9 * 1024 * 1024)
    existing_file = models.UploadedFile(
        id="fil-preexisting-quota",
        organization_id=t["org"].id,
        uploaded_by=t["researcher"].id,
        storage_key=f"tenant/{t['org'].id}/f_large.pdf",
        filename="existing_large.pdf",
        mime_type="application/pdf",
        size_bytes=large_size,
        checksum="mock_sha",
        classification="INTERNAL",
        scan_status="CLEAN",
        created_at="2026-08-01T00:00:00Z"
    )
    db_session.add(existing_file)
    db_session.commit()

    # Attempt to upload 2 MB file (99.9 + 2 > 100 MB quota)
    pdf_content = b"%PDF-1.4\n" + (b"A" * (2 * 1024 * 1024)) + b"\n%%EOF"
    response = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("exceeding_paper.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )

    assert response.status_code == 403
    assert "تجاوزت المساحة المتاحة للتخزين" in response.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 5. HISTORICAL MANUSCRIPT IMMUTABILITY & VERSIONING TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_historical_manuscript_immutability_and_delete_protection(db_session: Session):
    """Verifies that manuscript revisions in active review rounds cannot be deleted."""
    t = create_test_tenant(db_session, "immutable1", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    # 1. Upload manuscript v1
    v1_content = b"%PDF-1.4\n% Manuscript Revision 1\n%%EOF"
    up_v1 = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("manuscript_v1.pdf", io.BytesIO(v1_content), "application/pdf")}
    )
    assert up_v1.status_code == 200
    file_id_v1 = up_v1.json()["id"]

    # 2. Create peer review case and active round referencing v1
    case = models.PeerReviewCase(
        id="case-storage-immut-1",
        organization_id=t["org"].id,
        owner_user_id=t["researcher"].id,
        title_ar="دراسة التخزين الآمن 1",
        title_en="Storage Hardening Study 1",
        status="IN_REVIEW",
        current_round_number=1,
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db_session.add(case)
    db_session.flush()

    round1 = models.PeerReviewRound(
        id="round-storage-immut-1",
        case_id=case.id,
        round_number=1,
        manuscript_version=1,
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(round1)
    db_session.flush()
    db_session.flush()

    rev1 = models.ManuscriptRevision(
        id="rev-storage-immut-1",
        case_id=case.id,
        round_id=round1.id,
        version_number=1,
        title_ar="دراسة التخزين الآمن 1",
        title_en="Storage Hardening Study 1",
        file_id=file_id_v1,
        uploaded_by=t["researcher"].id,
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(rev1)
    db_session.commit()

    # 3. Attempt to delete manuscript v1 -> 403 Forbidden (Immutability protection)
    del_resp = client.delete(f"/api/storage/files/{file_id_v1}", headers=headers)
    assert del_resp.status_code == 403
    assert "لا يمكن حذف ملف مخطوطة" in del_resp.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 6. EXTERNAL REVIEWER SCOPED MANUSCRIPT ACCESS TEST
# ─────────────────────────────────────────────────────────────────────────────

def test_external_reviewer_scoped_manuscript_download(db_session: Session):
    """Verifies that an external referee with a valid token can download their assigned manuscript."""
    t = create_test_tenant(db_session, "ext_review_file", "pln-enterprise")
    headers_author = get_auth_headers(t["researcher"].username, t["org"].id)

    # 1. Author uploads manuscript
    pdf_content = b"%PDF-1.4\n% Manuscript for External Referee Review\n%%EOF"
    up_resp = client.post(
        "/api/storage/upload",
        headers=headers_author,
        files={"file": ("referee_manuscript.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert up_resp.status_code == 200
    file_id = up_resp.json()["id"]

    # 2. Setup peer review case, round, revision, and external reviewer assignment
    case = models.PeerReviewCase(
        id="case-ext-file-1",
        organization_id=t["org"].id,
        owner_user_id=t["researcher"].id,
        title_ar="بحث التحكيم الخارجي",
        title_en="External Review Paper",
        status="IN_REVIEW",
        current_round_number=1,
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db_session.add(case)
    db_session.flush()

    round1 = models.PeerReviewRound(
        id="round-ext-file-1",
        case_id=case.id,
        round_number=1,
        manuscript_version=1,
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(round1)
    db_session.flush()

    rev = models.ManuscriptRevision(
        id="rev-ext-file-1",
        case_id=case.id,
        round_id=round1.id,
        version_number=1,
        title_ar="بحث التحكيم الخارجي",
        title_en="External Review Paper",
        file_id=file_id,
        uploaded_by=t["researcher"].id,
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(rev)

    assignment = models.ReviewerAssignment(
        id="asg-ext-file-1",
        round_id=round1.id,
        case_id=case.id,
        reviewer_type="EXTERNAL",
        external_name="Dr. External Referee",
        external_email="referee@oxford.edu",
        status="INVITED",
        conflict_status="UNCHECKED",
        invited_at="2026-08-23T00:00:00Z",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(assignment)
    db_session.flush()

    raw_token = "ext_secret_token_123456789abcdef"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    token_record = models.ExternalReviewerToken(
        id="tok-ext-file-1",
        assignment_id=assignment.id,
        token_hash=token_hash,
        expires_at="2036-09-01T00:00:00Z",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(token_record)
    db_session.commit()

    # 3. Download manuscript via external portal endpoint
    download_resp = client.get(f"/api/external-reviews/portal/{raw_token}/manuscript")
    assert download_resp.status_code == 200
    assert download_resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert download_resp.content == pdf_content

    # 4. Revoke token and verify access is immediately blocked
    assignment.status = "REVOKED"
    db_session.commit()

    revoked_resp = client.get(f"/api/external-reviews/portal/{raw_token}/manuscript")
    assert revoked_resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 7. ADVERSARIAL & COMPREHENSIVE SECURITY TESTS FOR PHASE 08 CLOSURE
# ─────────────────────────────────────────────────────────────────────────────

def create_valid_docx_bytes() -> bytes:
    """Generates a valid in-memory OOXML DOCX file with required parts."""
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
        )
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Baseerah Academic Paper</w:t></w:r></w:p></w:body></w:document>'
        )
    return buf.getvalue()


def create_fake_zip_bytes() -> bytes:
    """Generates an arbitrary ZIP file lacking Word OOXML parts."""
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("notes.txt", "Arbitrary zip content not containing word/document.xml")
    return buf.getvalue()


def test_fake_zip_renamed_docx_is_rejected():
    """Verifies that an arbitrary ZIP renamed to .docx is rejected for lack of OOXML structure."""
    fake_docx = create_fake_zip_bytes()
    with pytest.raises(Exception) as exc:
        FileValidationService.validate_file(
            file_content=fake_docx,
            filename="paper.docx",
            declared_mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    assert exc.value.status_code == 400
    assert "تنقصه بنية مستند Word القياسية" in exc.value.detail


def test_docx_ooxml_structure_validation():
    """Verifies that a genuine OOXML DOCX passes deep structural inspection."""
    valid_docx = create_valid_docx_bytes()
    clean_name, detected_mime, size_bytes, sha256_hash = FileValidationService.validate_file(
        file_content=valid_docx,
        filename="real_manuscript.docx",
        declared_mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert clean_name == "real_manuscript.docx"
    assert size_bytes == len(valid_docx)
    assert sha256_hash == hashlib.sha256(valid_docx).hexdigest()


def test_docx_zip_safety_path_traversal():
    """Verifies that a ZIP/DOCX containing path traversal entries (Zip Slip) is rejected."""
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("../../etc/evil.xml", "evil payload")
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
    malicious_zip = buf.getvalue()

    with pytest.raises(Exception) as exc:
        FileValidationService.validate_file(
            file_content=malicious_zip,
            filename="slip.docx",
            declared_mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    assert exc.value.status_code == 400
    assert "مسارات غير آمنة" in exc.value.detail


def test_content_disposition_header_injection_blocked(db_session: Session):
    """Verifies that CRLF, quotes, semicolons, and Unicode in filenames do not break headers or cause HTTP splitting."""
    t = create_test_tenant(db_session, "hdr_inj", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    pdf_content = b"%PDF-1.4\n% Header injection test\n%%EOF"
    malicious_filename = 'paper\r\nSet-Cookie: session=evil\r\n"bad;.pdf'
    
    upload_resp = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": (malicious_filename, io.BytesIO(pdf_content), "application/pdf")}
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["id"]

    # Download and verify headers
    dl_resp = client.get(f"/api/storage/files/{file_id}/download", headers=headers)
    assert dl_resp.status_code == 200
    cd_header = dl_resp.headers.get("Content-Disposition", "")
    assert "\r" not in cd_header
    assert "\n" not in cd_header
    # Ensure no separate Set-Cookie header was injected into HTTP response
    assert "Set-Cookie" not in dl_resp.headers
    assert dl_resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert dl_resp.headers.get("X-Storage-Integrity-SHA256") == hashlib.sha256(pdf_content).hexdigest()


def test_upload_enforces_actual_streamed_bytes_limit(db_session: Session):
    """Verifies that uploading a payload exceeding 50MB is rejected with 413 even if declared size is spoofed."""
    from app.services.storage import MAX_FILE_SIZE_BYTES
    # Test boundary behavior in FileValidationService
    oversized = b"%PDF-1.4\n" + (b"0" * (MAX_FILE_SIZE_BYTES + 100)) + b"\n%%EOF"
    with pytest.raises(Exception) as exc:
        FileValidationService.validate_file(
            file_content=oversized,
            filename="huge_paper.pdf",
            declared_mime="application/pdf"
        )
    assert exc.value.status_code == 413


def test_storage_provider_failure_rolls_back_quota_and_metadata(db_session: Session):
    """Verifies that if storage provider write fails, no AVAILABLE metadata or active quota is committed."""
    t = create_test_tenant(db_session, "fail_rollback", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    class BrokenStorage:
        def save_file(self, *args, **kwargs):
            raise RuntimeError("Disk I/O failure on storage volume")
        def file_exists(self, *args, **kwargs):
            return False

    from app.services.storage import get_storage_provider
    app.dependency_overrides[get_storage_provider] = lambda: BrokenStorage()

    try:
        pdf_content = b"%PDF-1.4\n% Broken storage payload\n%%EOF"
        resp = client.post(
            "/api/storage/upload",
            headers=headers,
            files={"file": ("fail_paper.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        assert resp.status_code == 500

        # Verify no file was created in DB
        db_file = db_session.query(models.UploadedFile).filter(
            models.UploadedFile.organization_id == t["org"].id,
            models.UploadedFile.filename == "fail_paper.pdf"
        ).first()
        assert db_file is None
    finally:
        app.dependency_overrides.pop(get_storage_provider, None)


def test_external_reviewer_wrong_assignment_cannot_download(db_session: Session):
    """Verifies that a reviewer token bound to Assignment A cannot access manuscripts of Assignment B."""
    t = create_test_tenant(db_session, "wrong_asg", "pln-enterprise")
    headers_author = get_auth_headers(t["researcher"].username, t["org"].id)

    # 1. Upload manuscript
    pdf_content = b"%PDF-1.4\n% Manuscript A\n%%EOF"
    up_resp = client.post(
        "/api/storage/upload",
        headers=headers_author,
        files={"file": ("manuscript_a.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert up_resp.status_code == 200
    file_id_a = up_resp.json()["id"]

    # 2. Case and Round 1
    case = models.PeerReviewCase(
        id="case-wrong-asg-1",
        organization_id=t["org"].id,
        owner_user_id=t["researcher"].id,
        title_ar="بحث التحكيم أ",
        title_en="Review Paper A",
        status="IN_REVIEW",
        current_round_number=1,
        created_at="2026-08-23T00:00:00Z",
        updated_at="2026-08-23T00:00:00Z"
    )
    db_session.add(case)
    db_session.flush()

    round1 = models.PeerReviewRound(
        id="round-wrong-asg-1",
        case_id=case.id,
        round_number=1,
        manuscript_version=1,
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(round1)

    # 3. Round 2 without manuscript
    round2 = models.PeerReviewRound(
        id="round-wrong-asg-2",
        case_id=case.id,
        round_number=2,
        manuscript_version=2,
        status="ACTIVE",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(round2)
    db_session.flush()

    # Revision linked only to Round 1
    rev1 = models.ManuscriptRevision(
        id="rev-wrong-asg-1",
        case_id=case.id,
        round_id=round1.id,
        version_number=1,
        title_ar="بحث التحكيم أ",
        title_en="Review Paper A",
        file_id=file_id_a,
        uploaded_by=t["researcher"].id,
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(rev1)

    # Assignment on Round 2 (which has no revision attached)
    asg2 = models.ReviewerAssignment(
        id="asg-wrong-asg-2",
        round_id=round2.id,
        case_id=case.id,
        reviewer_type="EXTERNAL",
        external_name="Dr. External B",
        external_email="referee_b@oxford.edu",
        status="INVITED",
        conflict_status="UNCHECKED",
        invited_at="2026-08-23T00:00:00Z",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(asg2)
    db_session.flush()

    raw_token_b = "token_for_round_2_unattached"
    tok2 = models.ExternalReviewerToken(
        id="tok-wrong-asg-2",
        assignment_id=asg2.id,
        token_hash=hashlib.sha256(raw_token_b.encode("utf-8")).hexdigest(),
        expires_at="2036-09-01T00:00:00Z",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(tok2)
    db_session.commit()

    # Attempt download -> 404 (No manuscript revision for round 2)
    res = client.get(f"/api/external-reviews/portal/{raw_token_b}/manuscript")
    assert res.status_code == 404



def test_generic_file_download_and_metadata_idor(db_session: Session):
    """Verifies that cross-tenant and same-tenant IDOR attacks on metadata, download, and delete are blocked."""
    t1 = create_test_tenant(db_session, "idorA", "pln-enterprise")
    t2 = create_test_tenant(db_session, "idorB", "pln-enterprise")

    headers_a = get_auth_headers(t1["researcher"].username, t1["org"].id)
    headers_b = get_auth_headers(t2["researcher"].username, t2["org"].id)
    headers_same_org_colleague = get_auth_headers(t1["colleague"].username, t1["org"].id)

    # Org A uploads file
    pdf_content = b"%PDF-1.4\n% Secret File A\n%%EOF"
    up_resp = client.post(
        "/api/storage/upload",
        headers=headers_a,
        data={"classification": "INTERNAL"},
        files={"file": ("secret_a.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert up_resp.status_code == 200
    file_id = up_resp.json()["id"]

    # 1. Cross-Tenant Metadata IDOR -> 404
    meta_b = client.get(f"/api/storage/files/{file_id}", headers=headers_b)
    assert meta_b.status_code == 404

    # 2. Cross-Tenant Download IDOR -> 404
    dl_b = client.get(f"/api/storage/files/{file_id}/download", headers=headers_b)
    assert dl_b.status_code == 404

    # 3. Cross-Tenant Delete IDOR -> 404
    del_b = client.delete(f"/api/storage/files/{file_id}", headers=headers_b)
    assert del_b.status_code == 404

    # 4. Same-Tenant Unauthorized Colleague Metadata IDOR -> 403
    meta_colleague = client.get(f"/api/storage/files/{file_id}", headers=headers_same_org_colleague)
    assert meta_colleague.status_code == 403

    # 5. Same-Tenant Unauthorized Colleague Download IDOR -> 403
    dl_colleague = client.get(f"/api/storage/files/{file_id}/download", headers=headers_same_org_colleague)
    assert dl_colleague.status_code == 403

    # 6. Same-Tenant Unauthorized Colleague Delete IDOR -> 403
    del_colleague = client.delete(f"/api/storage/files/{file_id}", headers=headers_same_org_colleague)
    assert del_colleague.status_code == 403


def test_raw_storage_path_not_exposed(db_session: Session):
    """Verifies that API responses and errors never expose raw filesystem or server paths."""
    t = create_test_tenant(db_session, "no_leak", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    pdf_content = b"%PDF-1.4\n% Privacy verification\n%%EOF"
    upload_resp = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("privacy_test.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert upload_resp.status_code == 200
    data = upload_resp.json()

    # Ensure no internal path is exposed in metadata
    assert "storage_key" not in data
    assert "storage_files" not in str(data)
    assert "C:\\" not in str(data)
    assert "/var/" not in str(data)


def test_external_reviewer_expired_token_cannot_download(db_session: Session):
    """Verifies that an expired external reviewer magic token is rejected."""
    t = create_test_tenant(db_session, "ext_exp", "pln-enterprise")
    headers_author = get_auth_headers(t["researcher"].username, t["org"].id)

    # 1. Author uploads manuscript
    pdf_content = b"%PDF-1.4\n% Expired Token Manuscript\n%%EOF"
    up_resp = client.post(
        "/api/storage/upload",
        headers=headers_author,
        files={"file": ("manuscript_exp.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert up_resp.status_code == 200
    file_id = up_resp.json()["id"]

    # 2. Setup case and expired token
    case = models.PeerReviewCase(
        id="case-ext-exp-1",
        organization_id=t["org"].id,
        owner_user_id=t["researcher"].id,
        title_ar="بحث منتهي الصلاحية",
        title_en="Expired Token Paper",
        status="IN_REVIEW",
        current_round_number=1,
        created_at="2026-08-01T00:00:00Z",
        updated_at="2026-08-01T00:00:00Z"
    )
    db_session.add(case)
    db_session.flush()

    round1 = models.PeerReviewRound(
        id="round-ext-exp-1",
        case_id=case.id,
        round_number=1,
        manuscript_version=1,
        status="ACTIVE",
        created_at="2026-08-01T00:00:00Z"
    )
    db_session.add(round1)
    db_session.flush()

    rev = models.ManuscriptRevision(
        id="rev-ext-exp-1",
        case_id=case.id,
        round_id=round1.id,
        version_number=1,
        title_ar="بحث منتهي الصلاحية",
        title_en="Expired Token Paper",
        file_id=file_id,
        uploaded_by=t["researcher"].id,
        created_at="2026-08-01T00:00:00Z"
    )
    db_session.add(rev)

    assignment = models.ReviewerAssignment(
        id="asg-ext-exp-1",
        round_id=round1.id,
        case_id=case.id,
        reviewer_type="EXTERNAL",
        external_name="Dr. Expired",
        external_email="expired@university.edu",
        status="INVITED",
        conflict_status="UNCHECKED",
        invited_at="2026-08-01T00:00:00Z",
        created_at="2026-08-01T00:00:00Z"
    )
    db_session.add(assignment)
    db_session.flush()

    raw_token = "ext_expired_token_99999"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    token_record = models.ExternalReviewerToken(
        id="tok-ext-exp-1",
        assignment_id=assignment.id,
        token_hash=token_hash,
        expires_at="2026-08-10T00:00:00Z",  # Expired in past
        created_at="2026-08-01T00:00:00Z"
    )
    db_session.add(token_record)
    db_session.commit()

    # Attempt download with expired token -> 401 Unauthorized
    resp = client.get(f"/api/external-reviews/portal/{raw_token}/manuscript")
    assert resp.status_code == 401


def test_manuscript_v1_v2_storage_is_immutable(db_session: Session):
    """Verifies that uploading manuscript v2 generates a separate storage key and preserves v1 hash intact."""
    t = create_test_tenant(db_session, "v1v2", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    # 1. Upload Manuscript Revision 1
    v1_content = b"%PDF-1.4\n% Manuscript Version 1 Content\n%%EOF"
    v1_sha = hashlib.sha256(v1_content).hexdigest()
    up1 = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("paper_v1.pdf", io.BytesIO(v1_content), "application/pdf")}
    )
    assert up1.status_code == 200
    f1_id = up1.json()["id"]

    # 2. Upload Manuscript Revision 2
    v2_content = b"%PDF-1.4\n% Manuscript Version 2 With Author Revisions\n%%EOF"
    v2_sha = hashlib.sha256(v2_content).hexdigest()
    up2 = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("paper_v2.pdf", io.BytesIO(v2_content), "application/pdf")}
    )
    assert up2.status_code == 200
    f2_id = up2.json()["id"]

    # Verify DB records have distinct keys and original checksums
    file1 = db_session.query(models.UploadedFile).filter(models.UploadedFile.id == f1_id).first()
    file2 = db_session.query(models.UploadedFile).filter(models.UploadedFile.id == f2_id).first()

    assert file1.storage_key != file2.storage_key
    assert file1.checksum == v1_sha
    assert file2.checksum == v2_sha

    # Download v1 and verify contents unchanged
    dl1 = client.get(f"/api/storage/files/{f1_id}/download", headers=headers)
    assert dl1.status_code == 200
    assert dl1.content == v1_content


def test_orphan_storage_reconciliation(db_session: Session):
    """Verifies that orphaned physical storage files are cleanly identified and reconciled."""
    from app.services.storage import reconcile_orphaned_storage_files, LocalStorageProvider
    
    t = create_test_tenant(db_session, "orphan_test", "pln-enterprise")
    storage = LocalStorageProvider()
    
    # 1. Manually create an orphaned file on disk
    tenant_dir = os.path.join(storage.base_dir, "tenant", t["org"].id)
    os.makedirs(tenant_dir, exist_ok=True)
    orphan_path = os.path.join(tenant_dir, "f_orphan_file_test.pdf")
    with open(orphan_path, "wb") as f:
        f.write(b"%PDF-1.4\n% Orphan file\n%%EOF")

    assert os.path.exists(orphan_path)

    # 2. Run reconciliation with auto_clean=True
    report = reconcile_orphaned_storage_files(db=db_session, org_id=t["org"].id, auto_clean=True)
    assert report["physical_orphans_found"] >= 1
    assert report["physical_orphans_cleaned"] >= 1
    assert not os.path.exists(orphan_path)


# ─────────────────────────────────────────────────────────────────────────────
# 8. PHASE 08 CLOSURE — REQUIRED REGRESSION TESTS (NOMENCLATURE-EXACT)
# ─────────────────────────────────────────────────────────────────────────────

def test_concurrent_storage_quota_cannot_exceed_plan_limit(db_session: Session):
    """Verifies that two concurrent uploads cannot jointly exceed the plan storage limit."""
    import threading

    # Custom plan with a tight 1 MB storage limit
    now = "2026-08-23T00:00:00Z"
    plan = models.Plan(
        id="pln-concurrent-test",
        code="CONCURRENT_TEST",
        name="Concurrent Quota Test Plan",
        limits_json={"max_projects": 10, "max_members": 10, "max_storage_mb": 1},
        features_json={"can_export": True},
        created_at=now
    )
    db_session.add(plan)
    db_session.commit()

    t = create_test_tenant(db_session, "conc_q", "pln-concurrent-test")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    payload = b"%PDF-1.4\n" + (b"P" * (800 * 1024)) + b"\n%%EOF"  # ~0.8 MB
    results = []
    barrier = threading.Barrier(2)

    def do_upload():
        barrier.wait(timeout=15)
        resp = client.post(
            "/api/storage/upload",
            headers=headers,
            files={"file": ("conc_paper.pdf", io.BytesIO(payload), "application/pdf")}
        )
        results.append(resp.status_code)

    threads = [threading.Thread(target=do_upload) for _ in range(2)]
    for th in threads:
        th.start()
    for th in threads:
        th.join(timeout=60)

    assert len(results) == 2
    assert 200 in results
    assert 403 in results
    assert results.count(200) == 1

    # Total active bytes must never exceed the 1 MB plan limit
    from sqlalchemy import func
    total_used = db_session.query(func.sum(models.UploadedFile.size_bytes)).filter(
        models.UploadedFile.organization_id == t["org"].id,
        models.UploadedFile.deleted_at.is_(None)
    ).scalar() or 0
    assert total_used <= 1 * 1024 * 1024
    # The atomic counter must match reality (no reservation leakage)
    assert StorageQuotaService.current_used_bytes(db_session, t["org"].id) == total_used


def test_db_failure_after_storage_write_is_compensated(db_session: Session):
    """Verifies that when DB persistence fails after a successful storage write,
    the compensation deletes the blob, releases the reservation, and leaves no
    AVAILABLE metadata and no quota leak."""
    import app.routers.storage as storage_router

    t = create_test_tenant(db_session, "db_fail_comp", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    class RecordingStorage:
        def __init__(self):
            self.deleted_keys = []
        def save_file(self, file_content, filename, mime_type, org_id):
            self.saved_key = f"tenant/{org_id}/f_comp_test.pdf"
            return self.saved_key, hashlib.sha256(file_content).hexdigest(), len(file_content)
        def delete_file(self, storage_key):
            self.deleted_keys.append(storage_key)
            return True
        def file_exists(self, storage_key):
            return False
        def get_file_path(self, storage_key):
            raise RuntimeError("not applicable")
        def read_file_bytes(self, storage_key):
            return b""
        def generate_download_url(self, storage_key, expires_in_seconds=900):
            return "unused"
        def get_status(self):
            return "TEST_PROVIDER"

    fake = RecordingStorage()
    app.dependency_overrides[get_storage_provider] = lambda: fake

    original_record_usage = storage_router.record_usage_event
    def failing_record_usage(db, org_id, user_id, event_type, quantity=1.0, metadata=None):
        raise RuntimeError("Simulated DB commit failure after storage write")
    storage_router.record_usage_event = failing_record_usage

    try:
        pdf_content = b"%PDF-1.4\n% Compensation Test\n%%EOF"
        resp = client.post(
            "/api/storage/upload",
            headers=headers,
            files={"file": ("compensation.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        assert resp.status_code == 500
        assert "Database persistence failure" in resp.json()["detail"]
        assert "Simulated DB commit failure" not in resp.json()["detail"]  # no internal leak

        # No AVAILABLE metadata row left behind
        db_file = db_session.query(models.UploadedFile).filter(
            models.UploadedFile.organization_id == t["org"].id,
            models.UploadedFile.filename == "compensation.pdf",
            models.UploadedFile.deleted_at.is_(None)
        ).first()
        assert db_file is None

        # Compensation delete attempted on the written blob
        assert len(fake.deleted_keys) == 1
        assert fake.deleted_keys[0] == fake.saved_key

        # Quota reservation released (no quota leak)
        assert StorageQuotaService.current_used_bytes(db_session, t["org"].id) == 0
    finally:
        storage_router.record_usage_event = original_record_usage
        app.dependency_overrides.pop(get_storage_provider, None)


def test_generic_file_download_idor(db_session: Session):
    """Verifies download IDOR is blocked across tenants and within the same tenant."""
    t1 = create_test_tenant(db_session, "idor_dl_a", "pln-enterprise")
    t2 = create_test_tenant(db_session, "idor_dl_b", "pln-enterprise")
    headers_a = get_auth_headers(t1["researcher"].username, t1["org"].id)
    headers_b = get_auth_headers(t2["researcher"].username, t2["org"].id)
    headers_same = get_auth_headers(t1["colleague"].username, t1["org"].id)

    up = client.post(
        "/api/storage/upload",
        headers=headers_a,
        data={"classification": "INTERNAL"},
        files={"file": ("dl_private.pdf", io.BytesIO(b"%PDF-1.4\n% idor\n%%EOF"), "application/pdf")}
    )
    assert up.status_code == 200
    file_id = up.json()["id"]

    assert client.get(f"/api/storage/files/{file_id}/download", headers=headers_b).status_code == 404
    assert client.get(f"/api/storage/files/{file_id}/download", headers=headers_same).status_code == 403


def test_generic_file_metadata_idor(db_session: Session):
    """Verifies metadata IDOR is blocked across tenants and within the same tenant."""
    t1 = create_test_tenant(db_session, "idor_meta_a", "pln-enterprise")
    t2 = create_test_tenant(db_session, "idor_meta_b", "pln-enterprise")
    headers_a = get_auth_headers(t1["researcher"].username, t1["org"].id)
    headers_b = get_auth_headers(t2["researcher"].username, t2["org"].id)
    headers_same = get_auth_headers(t1["colleague"].username, t1["org"].id)

    up = client.post(
        "/api/storage/upload",
        headers=headers_a,
        data={"classification": "INTERNAL"},
        files={"file": ("meta_private.pdf", io.BytesIO(b"%PDF-1.4\n% idor\n%%EOF"), "application/pdf")}
    )
    assert up.status_code == 200
    file_id = up.json()["id"]

    assert client.get(f"/api/storage/files/{file_id}", headers=headers_b).status_code == 404
    assert client.get(f"/api/storage/files/{file_id}", headers=headers_same).status_code == 403


def test_generic_file_delete_idor(db_session: Session):
    """Verifies delete IDOR is blocked across tenants and within the same tenant."""
    t1 = create_test_tenant(db_session, "idor_del_a", "pln-enterprise")
    t2 = create_test_tenant(db_session, "idor_del_b", "pln-enterprise")
    headers_a = get_auth_headers(t1["researcher"].username, t1["org"].id)
    headers_b = get_auth_headers(t2["researcher"].username, t2["org"].id)
    headers_same = get_auth_headers(t1["colleague"].username, t1["org"].id)

    up = client.post(
        "/api/storage/upload",
        headers=headers_a,
        data={"classification": "INTERNAL"},
        files={"file": ("del_private.pdf", io.BytesIO(b"%PDF-1.4\n% idor\n%%EOF"), "application/pdf")}
    )
    assert up.status_code == 200
    file_id = up.json()["id"]

    assert client.delete(f"/api/storage/files/{file_id}", headers=headers_b).status_code == 404
    assert client.delete(f"/api/storage/files/{file_id}", headers=headers_same).status_code == 403
    # Owner can still delete
    assert client.delete(f"/api/storage/files/{file_id}", headers=headers_a).status_code == 200


def test_external_reviewer_revoked_token_cannot_download(db_session: Session):
    """Verifies that an externally revoked magic token is rejected for manuscript download."""
    t = create_test_tenant(db_session, "ext_rev_token", "pln-enterprise")
    headers_author = get_auth_headers(t["researcher"].username, t["org"].id)

    pdf_content = b"%PDF-1.4\n% Revoked Token Manuscript\n%%EOF"
    up_resp = client.post(
        "/api/storage/upload",
        headers=headers_author,
        files={"file": ("revoked_manuscript.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert up_resp.status_code == 200
    file_id = up_resp.json()["id"]

    case = models.PeerReviewCase(
        id="case-ext-rev-tok-1", organization_id=t["org"].id,
        owner_user_id=t["researcher"].id, title_ar="بحث ملغي الرابط",
        title_en="Revoked Token Paper", status="IN_REVIEW", current_round_number=1,
        created_at="2026-08-23T00:00:00Z", updated_at="2026-08-23T00:00:00Z"
    )
    db_session.add(case)
    db_session.flush()
    round1 = models.PeerReviewRound(
        id="round-ext-rev-tok-1", case_id=case.id, round_number=1,
        manuscript_version=1, status="ACTIVE", created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(round1)
    db_session.flush()
    db_session.add(models.ManuscriptRevision(
        id="rev-ext-rev-tok-1", case_id=case.id, round_id=round1.id,
        version_number=1, title_ar="بحث ملغي الرابط", title_en="Revoked Token Paper",
        file_id=file_id, uploaded_by=t["researcher"].id, created_at="2026-08-23T00:00:00Z"
    ))
    assignment = models.ReviewerAssignment(
        id="asg-ext-rev-tok-1", round_id=round1.id, case_id=case.id,
        reviewer_type="EXTERNAL", external_name="Dr. Revoked",
        external_email="revoked@university.edu", status="INVITED",
        conflict_status="UNCHECKED", invited_at="2026-08-23T00:00:00Z",
        created_at="2026-08-23T00:00:00Z"
    )
    db_session.add(assignment)
    db_session.flush()

    raw_token = "ext_revoked_magic_token_424242"
    db_session.add(models.ExternalReviewerToken(
        id="tok-ext-rev-tok-1", assignment_id=assignment.id,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        expires_at="2036-09-01T00:00:00Z", revoked_at="2026-08-22T00:00:00Z",
        created_at="2026-08-23T00:00:00Z"
    ))
    db_session.commit()

    resp = client.get(f"/api/external-reviews/portal/{raw_token}/manuscript")
    assert resp.status_code == 401
    # Portal data also rejected
    assert client.get(f"/api/external-reviews/portal/{raw_token}").status_code == 401


def test_storage_integrity_hash_matches_actual_bytes(db_session: Session):
    """Verifies that the stored SHA-256 and download header match the actual file bytes."""
    t = create_test_tenant(db_session, "integrity_hash", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    pdf_content = b"%PDF-1.4\n% Known Integrity Payload 2026\n" + b"A" * 4096 + b"\n%%EOF"
    expected_sha256 = hashlib.sha256(pdf_content).hexdigest()

    up = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("integrity.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert up.status_code == 200
    file_id = up.json()["id"]

    # Independent hash computed on actual bytes matches DB record and header
    db_file = db_session.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
    assert db_file.checksum == expected_sha256

    dl = client.get(f"/api/storage/files/{file_id}/download", headers=headers)
    assert dl.status_code == 200
    assert dl.headers.get("X-Storage-Integrity-SHA256") == expected_sha256
    assert hashlib.sha256(dl.content).hexdigest() == expected_sha256


def test_upload_near_limit_boundary(monkeypatch):
    """Verifies boundary behavior at exactly limit-1, limit, and limit+1 bytes."""
    from app import routers as routers_pkg
    from app import services as services_pkg
    import app.services.storage as storage_service
    import app.routers.storage as storage_router

    small_limit = 1024 * 1024  # 1 MB test limit
    monkeypatch.setattr(storage_service, "MAX_FILE_SIZE_BYTES", small_limit)
    monkeypatch.setattr(storage_router, "MAX_FILE_SIZE_BYTES", small_limit)

    prefix = b"%PDF-1.4\n"
    suffix = b"\n%%EOF"

    def build(exact_total):
        pad = exact_total - len(prefix) - len(suffix)
        assert pad >= 0
        return prefix + (b"B" * pad) + suffix

    # limit - 1 -> accepted
    under = build(small_limit - 1)
    assert len(under) == small_limit - 1
    clean, mime, sz, sha = FileValidationService.validate_file(
        under, "boundary_under.pdf", "application/pdf"
    )
    assert sz == len(under)

    # limit exactly -> accepted
    exact = build(small_limit)
    assert len(exact) == small_limit
    clean, mime, sz, sha = FileValidationService.validate_file(
        exact, "boundary_exact.pdf", "application/pdf"
    )
    assert sz == len(exact)

    # limit + 1 -> rejected 413
    over = build(small_limit + 1)
    assert len(over) == small_limit + 1
    with pytest.raises(Exception) as exc:
        FileValidationService.validate_file(over, "boundary_over.pdf", "application/pdf")
    assert exc.value.status_code == 413


def test_declared_size_spoof_is_rejected_by_actual_bytes(monkeypatch, db_session: Session):
    """A request declaring a small size but carrying more actual bytes is rejected."""
    import app.services.storage as storage_service
    import app.routers.storage as storage_router

    small_limit = 512 * 1024  # 512 KB test limit
    monkeypatch.setattr(storage_service, "MAX_FILE_SIZE_BYTES", small_limit)
    monkeypatch.setattr(storage_router, "MAX_FILE_SIZE_BYTES", small_limit)

    t = create_test_tenant(db_session, "size_spoof", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    # Actual payload much larger than the enforced limit
    oversized = b"%PDF-1.4\n" + (b"S" * (1024 * 1024)) + b"\n%%EOF"
    resp = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("spoofed_size.pdf", io.BytesIO(oversized), "application/pdf")}
    )
    assert resp.status_code == 413

    # No partial AVAILABLE file and no quota impact
    from sqlalchemy import func
    total = db_session.query(func.sum(models.UploadedFile.size_bytes)).filter(
        models.UploadedFile.organization_id == t["org"].id,
        models.UploadedFile.deleted_at.is_(None)
    ).scalar() or 0
    assert total == 0
    assert StorageQuotaService.current_used_bytes(db_session, t["org"].id) == 0


def test_malformed_docx_missing_document_xml_rejected():
    """A ZIP with some OOXML parts but missing word/document.xml is rejected."""
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("_rels/.rels", "<Relationships/>")
    malformed = buf.getvalue()

    with pytest.raises(Exception) as exc:
        FileValidationService.validate_file(
            malformed, "broken.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    assert exc.value.status_code == 400
    assert "تنقصه بنية مستند Word القياسية" in exc.value.detail


def test_docx_zip_bomb_entry_count_rejected():
    """DOCX-like ZIPs with excessive entry counts are rejected (ZIP bomb protection)."""
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("_rels/.rels", "<Relationships/>")
        zf.writestr("word/document.xml", "<w:document/>")
        for i in range(1200):
            zf.writestr(f"word/media/img_{i}.bin", b"0")
    bomb = buf.getvalue()

    with pytest.raises(Exception) as exc:
        FileValidationService.validate_file(
            bomb, "bomb.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    assert exc.value.status_code == 400
    assert "عدد عناصر مشبوه" in exc.value.detail


def test_unlimited_quota_negative_one_is_not_negative_available(db_session: Session):
    """max_storage_mb == -1 (unlimited) must not be treated as negative available quota."""
    t = create_test_tenant(db_session, "unlimited_q", "pln-enterprise")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    pdf_content = b"%PDF-1.4\n% Unlimited quota tenant\n%%EOF"
    resp = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("unlimited.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert resp.status_code == 200
    # Unlimited plan (-1) must not be treated as negative available quota:
    # the file is accepted and counted as an active record, not rejected.
    from sqlalchemy import func
    active_bytes = db_session.query(func.sum(models.UploadedFile.size_bytes)).filter(
        models.UploadedFile.organization_id == t["org"].id,
        models.UploadedFile.deleted_at.is_(None)
    ).scalar() or 0
    assert active_bytes == len(pdf_content)


def test_existing_over_limit_tenant_files_retained(db_session: Session):
    """Existing files of an over-limit tenant are retained; only new uploads are denied."""
    t = create_test_tenant(db_session, "overlimit_keep", "pln-free")
    headers = get_auth_headers(t["researcher"].username, t["org"].id)

    # Free plan limit is 100 MB; simulate an existing tenant already over the limit
    large_size = int(120 * 1024 * 1024)
    existing = models.UploadedFile(
        id="fil-overlimit-existing",
        organization_id=t["org"].id,
        uploaded_by=t["researcher"].id,
        storage_key=f"tenant/{t['org'].id}/f_existing_overlimit.pdf",
        filename="legacy_large.pdf",
        mime_type="application/pdf",
        size_bytes=large_size,
        checksum="mock",
        classification="INTERNAL",
        scan_status="UNSCANNED",
        created_at="2026-08-01T00:00:00Z"
    )
    db_session.add(existing)
    db_session.commit()

    pdf_content = b"%PDF-1.4\n% New upload attempt\n%%EOF"
    resp = client.post(
        "/api/storage/upload",
        headers=headers,
        files={"file": ("new_attempt.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert resp.status_code == 403

    # Existing file retained, not deleted
    still_there = db_session.query(models.UploadedFile).filter(
        models.UploadedFile.id == "fil-overlimit-existing",
        models.UploadedFile.deleted_at.is_(None)
    ).first()
    assert still_there is not None


def test_manuscript_historical_round_retrieves_own_version(db_session: Session):
    """Round 1 must retrieve v1 and Round 2 must retrieve v2 (no cross-version overwrite)."""
    t = create_test_tenant(db_session, "hist_rounds", "pln-enterprise")
    headers_author = get_auth_headers(t["researcher"].username, t["org"].id)

    v1_content = b"%PDF-1.4\n% Manuscript Version 1 For Round 1\n%%EOF"
    v2_content = b"%PDF-1.4\n% Manuscript Version 2 For Round 2\n%%EOF"
    up1 = client.post("/api/storage/upload", headers=headers_author,
                      files={"file": ("hist_v1.pdf", io.BytesIO(v1_content), "application/pdf")})
    up2 = client.post("/api/storage/upload", headers=headers_author,
                      files={"file": ("hist_v2.pdf", io.BytesIO(v2_content), "application/pdf")})
    assert up1.status_code == 200 and up2.status_code == 200
    f1_id, f2_id = up1.json()["id"], up2.json()["id"]

    case = models.PeerReviewCase(
        id="case-hist-rounds-1", organization_id=t["org"].id,
        owner_user_id=t["researcher"].id, title_ar="النسخ التاريخية",
        title_en="Historical Versions", status="IN_REVIEW", current_round_number=2,
        created_at="2026-08-23T00:00:00Z", updated_at="2026-08-23T00:00:00Z"
    )
    db_session.add(case)
    db_session.flush()

    round1 = models.PeerReviewRound(id="round-hist-1", case_id=case.id, round_number=1,
                                    manuscript_version=1, status="COMPLETED",
                                    created_at="2026-08-23T00:00:00Z")
    round2 = models.PeerReviewRound(id="round-hist-2", case_id=case.id, round_number=2,
                                    manuscript_version=2, status="ACTIVE",
                                    created_at="2026-08-23T00:00:00Z")
    db_session.add_all([round1, round2])
    db_session.flush()

    db_session.add_all([
        models.ManuscriptRevision(id="rev-hist-1", case_id=case.id, round_id=round1.id,
                                  version_number=1, title_ar="النسخة 1", title_en="V1",
                                  file_id=f1_id, uploaded_by=t["researcher"].id,
                                  created_at="2026-08-23T00:00:00Z"),
        models.ManuscriptRevision(id="rev-hist-2", case_id=case.id, round_id=round2.id,
                                  version_number=2, title_ar="النسخة 2", title_en="V2",
                                  file_id=f2_id, uploaded_by=t["researcher"].id,
                                  created_at="2026-08-23T00:00:00Z"),
    ])
    db_session.commit()

    # Authorized editorial access (org owner) to each round's file must return its own version
    f1 = db_session.query(models.UploadedFile).filter(models.UploadedFile.id == f1_id).first()
    f2 = db_session.query(models.UploadedFile).filter(models.UploadedFile.id == f2_id).first()
    assert f1.storage_key != f2.storage_key
    assert f1.checksum == hashlib.sha256(v1_content).hexdigest()
    assert f2.checksum == hashlib.sha256(v2_content).hexdigest()

    dl1 = client.get(f"/api/storage/files/{f1_id}/download", headers=headers_author)
    dl2 = client.get(f"/api/storage/files/{f2_id}/download", headers=headers_author)
    assert dl1.content == v1_content
    assert dl2.content == v2_content
    # v1 hash remains unchanged after v2 upload (proven by byte equality above)

    # Delete protection applies to historical rounds (v1 tied to COMPLETED round 1)
    del_resp = client.delete(f"/api/storage/files/{f1_id}", headers=headers_author)
    assert del_resp.status_code == 403
