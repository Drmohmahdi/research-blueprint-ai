import os
import re
import uuid
import hashlib
import datetime
import mimetypes
from abc import ABC, abstractmethod
from typing import Optional, Tuple, Set, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import update as sa_update, case, func as sa_func
from sqlalchemy.orm import Session
from .. import models


# ─────────────────────────────────────────────────────────────────────────────
# 1. CONSTANTS & SECURITY CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_STORAGE_ROOT = os.getenv("STORAGE_ROOT", "storage_files")
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(50 * 1024 * 1024)))  # 50 MB

# Strictly blocked extensions (Executable, scripts, active macros, dangerous vectors)
BLOCKED_EXTENSIONS: Set[str] = {
    ".exe", ".bat", ".cmd", ".ps1", ".sh", ".bash", ".vbs", ".js", ".mjs",
    ".php", ".py", ".rb", ".pl", ".html", ".htm", ".xhtml", ".svg",
    ".docm", ".xlsm", ".pptm", ".dotm", ".xltm", ".potm",
    ".jar", ".msi", ".dll", ".so", ".dylib", ".com", ".scr", ".pif", ".hta"
}

# Context-specific allowed extensions
ALLOWED_RESEARCH_EXTENSIONS: Set[str] = {
    ".pdf", ".docx", ".xlsx", ".pptx", ".csv", ".tsv", ".txt", ".json",
    ".png", ".jpg", ".jpeg", ".webp", ".zip"
}

ALLOWED_IMAGE_EXTENSIONS: Set[str] = {
    ".png", ".jpg", ".jpeg", ".webp"
}

ALLOWED_DOCUMENT_EXTENSIONS: Set[str] = {
    ".pdf", ".docx", ".txt", ".rtf"
}

# Magic bytes signatures for structural validation
MAGIC_SIGNATURES: Dict[str, bytes] = {
    ".pdf": b"%PDF-",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
    ".zip": b"PK\x03\x04",
    ".docx": b"PK\x03\x04",
    ".xlsx": b"PK\x03\x04",
    ".pptx": b"PK\x03\x04",
}


# ─────────────────────────────────────────────────────────────────────────────
# 2. FILE VALIDATION & SANITIZATION SERVICE
# ─────────────────────────────────────────────────────────────────────────────

class FileValidationService:
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Strips path components, CRLF, null bytes, and dangerous characters.
        Preserves valid Arabic and English letters, numbers, hyphens, and dots.
        """
        if not filename:
            return "unnamed_file"

        # 1. Take only basename
        clean = os.path.basename(filename)

        # 2. Remove null bytes and CRLF
        clean = clean.replace("\x00", "").replace("\r", "").replace("\n", "").replace('"', "").replace("'", "")

        # 3. Prevent path traversal dots at start
        clean = clean.lstrip(".")

        # 4. Remove Windows/Unix path separators
        clean = clean.replace("/", "").replace("\\", "").replace(":", "")

        # 5. Clean whitespace
        clean = re.sub(r"\s+", " ", clean).strip()

        if not clean:
            clean = "unnamed_file"

        # Max length 200 chars
        if len(clean) > 200:
            name, ext = os.path.splitext(clean)
            clean = name[: 200 - len(ext)] + ext

        return clean

    @staticmethod
    def validate_file(
        file_content: bytes,
        filename: str,
        declared_mime: Optional[str] = None,
        context_category: str = "RESEARCH_ATTACHMENT"
    ) -> Tuple[str, str, int, str]:
        """
        Validates file content against size, dangerous extensions, magic bytes, and compute SHA-256.
        Returns (sanitized_filename, detected_mime, size_bytes, sha256_hash).
        """
        size_bytes = len(file_content)

        # 1. Size Validation
        if size_bytes == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="الملف فارغ لا يحتوي على أي بيانات / File is empty (0 bytes)"
            )

        if size_bytes > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"حجم الملف ({round(size_bytes / (1024 * 1024), 2)} MB) يتجاوز الحد الأقصى المسموح به ({max_mb} MB) / File size exceeds maximum limit"
            )

        # 2. Filename & Extension Sanitization
        clean_filename = FileValidationService.sanitize_filename(filename)
        _, ext = os.path.splitext(clean_filename)
        ext_lower = ext.lower()

        if not ext_lower:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="امتداد الملف مفقود / Missing file extension"
            )

        # 3. Block Dangerous Extensions
        if ext_lower in BLOCKED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"نوع الملف '{ext_lower}' محظور لدواعي الأمان الأكاديمي / File extension is prohibited for security reasons"
            )

        # 4. Context-Specific Allowlist
        if context_category == "ORGANIZATION_LOGO" or context_category == "PROFILE_PHOTO":
            if ext_lower not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"يسمح فقط بالصور ({', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}) / Only images allowed"
                )
        elif context_category == "MANUSCRIPT":
            if ext_lower not in ALLOWED_DOCUMENT_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"يسمح فقط بمستندات ({', '.join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))}) للمخطوطات / Only document formats allowed for manuscripts"
                )
        else:
            if ext_lower not in ALLOWED_RESEARCH_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"نوع الملف '{ext_lower}' غير مدعوم في منصة البحث / Unsupported file format"
                )

        # 5. Magic Bytes Structural Verification
        if ext_lower in MAGIC_SIGNATURES:
            expected_sig = MAGIC_SIGNATURES[ext_lower]
            if not file_content.startswith(expected_sig):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"بنية الملف لا تتطابق مع الامتداد المصرح به '{ext_lower}' / File content signature mismatch"
                )

        # 5b. Deep OOXML Structural Verification for DOCX
        if ext_lower == ".docx":
            import zipfile
            import io
            try:
                with zipfile.ZipFile(io.BytesIO(file_content), 'r') as zf:
                    infolist = zf.infolist()
                    if len(infolist) > 1000:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="الملف يحتوي على عدد عناصر مشبوه يتجاوز الحد المسموح / Suspicious ZIP entry count"
                        )
                    total_uncompressed = 0
                    for info in infolist:
                        # Zip slip protection
                        if info.filename.startswith(("/", "\\")) or ".." in info.filename or ":" in info.filename:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="بنية الملف تحتوي على مسارات غير آمنة / Unsafe ZIP entry path detected"
                            )
                        total_uncompressed += info.file_size
                        if total_uncompressed > MAX_FILE_SIZE_BYTES * 5:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="حجم فك الضغط يتجاوز الحد الأقصى المسموح / Suspicious decompression ratio"
                            )
                    
                    namelist = zf.namelist()
                    # Real Word Document OOXML must contain the core parts:
                    #   [Content_Types].xml, _rels/.rels, word/document.xml
                    if "word/document.xml" not in namelist or "[Content_Types].xml" not in namelist or "_rels/.rels" not in namelist:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="ملف DOCX غير صالح: تنقصه بنية مستند Word القياسية (word/document.xml) / Invalid DOCX: Missing OOXML document structure"
                        )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"بنية ملف DOCX تالفة أو غير صالحة / Malformed DOCX OOXML structure: {str(e)}"
                )

        # 6. WebP Magic Check (RIFF....WEBP)
        if ext_lower == ".webp":
            if not (file_content.startswith(b"RIFF") and b"WEBP" in file_content[:16]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="بنية ملف WebP غير صالحة / Invalid WebP image signature"
                )

        # 7. MIME Determination
        detected_mime = mimetypes.guess_type(clean_filename)[0] or declared_mime or "application/octet-stream"

        # 8. Compute SHA-256 Hash
        sha256_hash = hashlib.sha256(file_content).hexdigest()

        return clean_filename, detected_mime, size_bytes, sha256_hash



# ─────────────────────────────────────────────────────────────────────────────
# 3. STORAGE PROVIDER ABSTRACTION
# ─────────────────────────────────────────────────────────────────────────────

class StorageProvider(ABC):
    @abstractmethod
    def get_status(self) -> str:
        """Returns provider mode: LOCAL_SECURE or S3_COMPATIBLE"""
        pass

    @abstractmethod
    def save_file(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
        org_id: str
    ) -> Tuple[str, str, int]:
        """
        Saves file bytes and returns (storage_key, sha256_hash, size_bytes).
        """
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Deletes file physically from storage"""
        pass

    @abstractmethod
    def file_exists(self, storage_key: str) -> bool:
        """Checks if file physically exists"""
        pass

    @abstractmethod
    def get_file_path(self, storage_key: str) -> str:
        """Returns physical filesystem path (for local secure streaming)"""
        pass

    @abstractmethod
    def read_file_bytes(self, storage_key: str) -> bytes:
        """Reads file bytes from storage"""
        pass

    @abstractmethod
    def generate_download_url(self, storage_key: str, expires_in_seconds: int = 900) -> str:
        """Generates temporary download URL"""
        pass


class LocalStorageProvider(StorageProvider):
    """
    Secure Local Filesystem Provider for Baseerah.
    Enforces server-generated opaque keys and prevents path traversal out of STORAGE_ROOT.
    """
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = os.path.abspath(base_dir or os.getenv("STORAGE_ROOT", DEFAULT_STORAGE_ROOT))
        os.makedirs(self.base_dir, exist_ok=True)

    def get_status(self) -> str:
        return "LOCAL_SECURE"

    def _resolve_safe_path(self, storage_key: str) -> str:
        """
        Guarantees that the resolved path is strictly inside self.base_dir.
        Raises HTTPException 400 on any path traversal attempt.
        """
        normalized_key = storage_key.replace("\\", "/").lstrip("/")
        full_path = os.path.abspath(os.path.join(self.base_dir, normalized_key))
        
        # Path traversal guard
        common = os.path.commonpath([self.base_dir, full_path])
        if common != self.base_dir:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="محاولة وصول غير صالحة لمسار التخزين / Invalid storage path traversal attempt"
            )
        return full_path

    def save_file(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
        org_id: str
    ) -> Tuple[str, str, int]:
        _, ext = os.path.splitext(filename)
        opaque_file_id = f"f_{uuid.uuid4().hex[:16]}"
        safe_org = re.sub(r"[^a-zA-Z0-9_\-]", "", org_id) or "default_org"
        
        # Storage key format: tenant/{org_id}/{opaque_file_id}{ext}
        storage_key = f"tenant/{safe_org}/{opaque_file_id}{ext.lower()}"
        full_path = self._resolve_safe_path(storage_key)
        
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Write bytes
        with open(full_path, "wb") as f:
            f.write(file_content)

        sha256_hash = hashlib.sha256(file_content).hexdigest()
        size_bytes = len(file_content)

        return storage_key, sha256_hash, size_bytes

    def delete_file(self, storage_key: str) -> bool:
        try:
            full_path = self._resolve_safe_path(storage_key)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
        except Exception:
            pass
        return False

    def file_exists(self, storage_key: str) -> bool:
        try:
            full_path = self._resolve_safe_path(storage_key)
            return os.path.exists(full_path) and os.path.isfile(full_path)
        except Exception:
            return False

    def get_file_path(self, storage_key: str) -> str:
        full_path = self._resolve_safe_path(storage_key)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الملف غير موجود في وحدة التخزين / File not found in storage")
        return full_path

    def read_file_bytes(self, storage_key: str) -> bytes:
        full_path = self.get_file_path(storage_key)
        with open(full_path, "rb") as f:
            return f.read()

    def generate_download_url(self, storage_key: str, expires_in_seconds: int = 900) -> str:
        # For local secure storage, files are served via authorized backend streaming endpoint
        return f"/api/storage/download/{storage_key}"


class S3StorageProvider(StorageProvider):
    """
    S3 / Object Storage Provider for Production Cloud Deployments.
    """
    def __init__(
        self,
        bucket_name: str,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region_name: str = "us-east-1"
    ):
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.region_name = region_name

    def get_status(self) -> str:
        return "S3_COMPATIBLE"

    def save_file(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
        org_id: str
    ) -> Tuple[str, str, int]:
        _, ext = os.path.splitext(filename)
        opaque_file_id = f"f_{uuid.uuid4().hex[:16]}"
        safe_org = re.sub(r"[^a-zA-Z0-9_\-]", "", org_id) or "default_org"
        storage_key = f"tenant/{safe_org}/{opaque_file_id}{ext.lower()}"

        sha256_hash = hashlib.sha256(file_content).hexdigest()
        size_bytes = len(file_content)

        # In production with boto3: s3_client.put_object(Bucket=self.bucket_name, Key=storage_key, Body=file_content, ContentType=mime_type)
        return storage_key, sha256_hash, size_bytes

    def delete_file(self, storage_key: str) -> bool:
        # In production: s3_client.delete_object(Bucket=self.bucket_name, Key=storage_key)
        return True

    def file_exists(self, storage_key: str) -> bool:
        return True

    def get_file_path(self, storage_key: str) -> str:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Direct filesystem path is not applicable for S3 Object Storage"
        )

    def read_file_bytes(self, storage_key: str) -> bytes:
        return b""

    def generate_download_url(self, storage_key: str, expires_in_seconds: int = 900) -> str:
        expires = int(datetime.datetime.now(datetime.UTC).timestamp()) + expires_in_seconds
        return f"{self.endpoint_url}/{self.bucket_name}/{storage_key}?Expires={expires}&Signature=MOCK_SIGNED"


def get_storage_provider() -> StorageProvider:
    """
    Factory function returning the active StorageProvider based on environment.
    """
    s3_bucket = os.getenv("S3_BUCKET_NAME")
    s3_endpoint = os.getenv("S3_ENDPOINT_URL")
    s3_access = os.getenv("S3_ACCESS_KEY_ID")
    s3_secret = os.getenv("S3_SECRET_ACCESS_KEY")

    if s3_bucket and s3_endpoint and s3_access and s3_secret:
        return S3StorageProvider(
            bucket_name=s3_bucket,
            endpoint_url=s3_endpoint,
            access_key=s3_access,
            secret_key=s3_secret
        )
    return LocalStorageProvider()


# ─────────────────────────────────────────────────────────────────────────────
# 4b. CONCURRENCY-SAFE STORAGE QUOTA SERVICE
# ─────────────────────────────────────────────────────────────────────────────

class StorageQuotaService:
    """
    Atomic per-organization storage quota enforcement backed by a single-row
    counter (storage_quota_usage). Works on both PostgreSQL (conditional UPDATE
    with row-level locking) and SQLite (serialized writes).

    Lifecycle:
        reserve  -> atomic conditional UPDATE increments used_bytes only if it
                    stays under the plan limit; returns False otherwise.
        commit   -> the same transaction persists the UploadedFile metadata;
                    rollback automatically releases the reservation.
        release  -> explicit decrement used for deletions / compensation.
    """

    @staticmethod
    def reserve(
        db: Session,
        org_id: str,
        additional_bytes: int,
        max_storage_bytes: int
    ) -> bool:
        """
        Atomically reserve `additional_bytes` against the organization's storage
        quota. Returns True if the reservation succeeded (used_bytes now includes
        the additional bytes), False if it would exceed `max_storage_bytes`.
        """
        from sqlalchemy.exc import IntegrityError
        now = datetime.datetime.now(datetime.UTC).isoformat()

        # Seed the counter row from actual usage on first use (idempotent).
        existing = db.query(models.StorageQuotaUsage).filter(
            models.StorageQuotaUsage.organization_id == org_id
        ).first()
        if not existing:
            current_used = db.query(sa_func.sum(models.UploadedFile.size_bytes)).filter(
                models.UploadedFile.organization_id == org_id,
                models.UploadedFile.deleted_at.is_(None)
            ).scalar() or 0
            try:
                with db.begin_nested():
                    db.add(models.StorageQuotaUsage(
                        organization_id=org_id,
                        used_bytes=int(current_used),
                        updated_at=now
                    ))
            except IntegrityError:
                pass  # row already created by concurrent request

        # Atomic conditional reservation: only succeeds if limit not exceeded.
        result = db.execute(
            sa_update(models.StorageQuotaUsage)
            .where(models.StorageQuotaUsage.organization_id == org_id)
            .where(
                (models.StorageQuotaUsage.used_bytes + additional_bytes) <= max_storage_bytes
            )
            .values(
                used_bytes=models.StorageQuotaUsage.used_bytes + additional_bytes,
                updated_at=now
            )
        )
        return result.rowcount == 1

    @staticmethod
    def release(
        db: Session,
        org_id: str,
        size_bytes: int
    ) -> None:
        """Decrement the organization's storage usage counter (floor at 0)."""
        db.execute(
            sa_update(models.StorageQuotaUsage)
            .where(models.StorageQuotaUsage.organization_id == org_id)
            .values(
                used_bytes=case(
                    ((models.StorageQuotaUsage.used_bytes - size_bytes) < 0, 0),
                    else_=models.StorageQuotaUsage.used_bytes - size_bytes
                )
            )
        )

    @staticmethod
    def current_used_bytes(db: Session, org_id: str) -> int:
        """Return the current reserved/used byte counter for an organization."""
        row = db.query(models.StorageQuotaUsage).filter(
            models.StorageQuotaUsage.organization_id == org_id
        ).first()
        return int(row.used_bytes) if row else 0


# ─────────────────────────────────────────────────────────────────────────────
# 4. FILE ACCESS POLICY & AUTHORIZATION SERVICE
# ─────────────────────────────────────────────────────────────────────────────

class FileAccessPolicy:
    """
    Central Multi-Tenant and Horizontal Authorization Engine for Academic Files.
    """

    @staticmethod
    def can_read_file(
        user: models.User,
        org: models.Organization,
        role: str,
        file: models.UploadedFile,
        db: Session
    ) -> bool:
        # 1. Strict Multi-Tenant Sovereign Isolation
        if file.organization_id != org.id:
            return False

        # 2. Superadmin or Org Admin / Owner
        if getattr(user, "is_superadmin", False) or role in ["ORGANIZATION_ADMIN", "OWNER"]:
            return True

        # 3. File Uploader Ownership
        if file.uploaded_by == user.id:
            return True

        # 4. Public Assets / Photos
        if file.classification == "PUBLIC":
            return True

        # 5. Project Membership Scoping
        if file.project_id:
            # Check if user is the project owner
            proj = db.query(models.ResearchProject).filter(
                models.ResearchProject.id == file.project_id,
                models.ResearchProject.organizationId == org.id
            ).first()
            if proj:
                if proj.userId == user.id:
                    return True
                # If comments or shared collaborator
                collab = db.query(models.ProjectComment).filter(
                    models.ProjectComment.project_id == file.project_id,
                    models.ProjectComment.user_id == user.id
                ).first()
                if collab:
                    return True

        # 6. Scholarly Asset Contributor Scoping
        asset_file = db.query(models.ScholarlyAssetFile).filter(
            models.ScholarlyAssetFile.file_id == file.id
        ).first()
        if asset_file:
            asset = db.query(models.ScholarlyAsset).filter(
                models.ScholarlyAsset.id == asset_file.asset_id
            ).first()
            if asset:
                if asset.owner_user_id == user.id or asset.visibility == "PUBLIC":
                    return True
                contrib = db.query(models.ScholarlyAssetContributor).filter(
                    models.ScholarlyAssetContributor.asset_id == asset.id,
                    models.ScholarlyAssetContributor.user_id == user.id
                ).first()
                if contrib:
                    return True

        # 7. Peer Review Case Scoping
        manuscript_rev = db.query(models.ManuscriptRevision).filter(
            models.ManuscriptRevision.file_id == file.id
        ).first()
        if manuscript_rev:
            case = db.query(models.PeerReviewCase).filter(
                models.PeerReviewCase.id == manuscript_rev.case_id
            ).first()
            if case:
                if case.owner_user_id == user.id:
                    return True
                # Check assigned reviewer
                assigned = db.query(models.ReviewerAssignment).join(models.PeerReviewRound).filter(
                    models.PeerReviewRound.case_id == case.id,
                    models.ReviewerAssignment.reviewer_user_id == user.id,
                    models.ReviewerAssignment.status.notin_(["REVOKED", "DECLINED"])
                ).first()
                if assigned:
                    return True

        return False

    @staticmethod
    def can_delete_file(
        user: models.User,
        org: models.Organization,
        role: str,
        file: models.UploadedFile,
        db: Session
    ) -> Tuple[bool, str]:
        # 1. Multi-tenant guard
        if file.organization_id != org.id:
            return False, "Access denied to other organization files"

        # 2. Historical Immutability & Evidence Protection
        # Protect active manuscript revisions
        manuscript_rev = db.query(models.ManuscriptRevision).filter(
            models.ManuscriptRevision.file_id == file.id
        ).first()
        if manuscript_rev:
            round_obj = db.query(models.PeerReviewRound).filter(
                models.PeerReviewRound.id == manuscript_rev.round_id
            ).first()
            if round_obj and round_obj.status in ["ACTIVE", "COMPLETED"]:
                return False, "لا يمكن حذف ملف مخطوطة مرتبط بجولة تحكيم جارية أو مكتملة / Cannot delete manuscript revision tied to active peer review"

        # Protect verified academic affiliations / promotions
        affiliation = db.query(models.AcademicAffiliation).filter(
            models.AcademicAffiliation.evidence_file_id == file.id,
            models.AcademicAffiliation.verification_status == "VERIFIED"
        ).first()
        if affiliation:
            return False, "لا يمكن حذف ملف وثيقة رسمية معتمدة أكاديميًا / Cannot delete verified academic evidence file"

        # 3. Ownership / Role authorization
        if getattr(user, "is_superadmin", False) or role in ["ORGANIZATION_ADMIN", "OWNER"]:
            return True, "Authorized by Admin role"

        if file.uploaded_by == user.id:
            return True, "Authorized by Uploader ownership"

        return False, "غير مصرح لك بحذف هذا الملف / Unauthorized to delete this file"


# ─────────────────────────────────────────────────────────────────────────────
# 5. ORPHAN RECONCILIATION SERVICE
# ─────────────────────────────────────────────────────────────────────────────

def reconcile_orphaned_storage_files(
    db: Session,
    org_id: str,
    auto_clean: bool = True
) -> Dict[str, Any]:
    """
    Reconciles physical storage files against the database metadata for an organization.
    Identifies:
      - physical_orphans: Storage files on disk with no active UploadedFile DB record.
      - missing_physicals: Active UploadedFile DB records whose disk file is missing.
    """
    storage = get_storage_provider()
    results = {
        "organization_id": org_id,
        "physical_orphans_found": 0,
        "physical_orphans_cleaned": 0,
        "missing_physicals_found": 0,
        "active_db_files": 0
    }

    # 1. Query all active DB records
    active_files = db.query(models.UploadedFile).filter(
        models.UploadedFile.organization_id == org_id,
        models.UploadedFile.deleted_at.is_(None)
    ).all()
    results["active_db_files"] = len(active_files)

    active_keys = {f.storage_key for f in active_files}

    # 2. Check for missing physicals
    for f in active_files:
        if not storage.file_exists(f.storage_key):
            results["missing_physicals_found"] += 1

    # 3. Check for physical orphans on local storage
    if isinstance(storage, LocalStorageProvider):
        safe_org = re.sub(r"[^a-zA-Z0-9_\-]", "", org_id) or "default_org"
        tenant_dir = os.path.join(storage.base_dir, "tenant", safe_org)
        if os.path.exists(tenant_dir) and os.path.isdir(tenant_dir):
            for fname in os.listdir(tenant_dir):
                fpath = os.path.join(tenant_dir, fname)
                if os.path.isfile(fpath):
                    rel_key = f"tenant/{safe_org}/{fname}"
                    if rel_key not in active_keys:
                        results["physical_orphans_found"] += 1
                        if auto_clean:
                            try:
                                os.remove(fpath)
                                results["physical_orphans_cleaned"] += 1
                            except Exception:
                                pass

    return results
