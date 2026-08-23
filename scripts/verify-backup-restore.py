"""Verify a fresh, representative SQLite backup and isolated restore."""
from __future__ import annotations

import hashlib, json, os, shutil, sqlite3, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "RC14-REPRESENTATIVE-2026"

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def insert(connection: sqlite3.Connection, table: str, values: dict) -> None:
    columns = ",".join(values)
    placeholders = ",".join("?" for _ in values)
    connection.execute(f'INSERT INTO "{table}" ({columns}) VALUES ({placeholders})', tuple(values.values()))

def main() -> None:
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="baseerah-rc14-recovery-") as name:
        root = Path(name); source = root / "source.sqlite3"; storage = root / "source-storage"
        env = os.environ.copy(); env.update(DATABASE_URL=f"sqlite:///{source.as_posix()}", TESTING="true", AUTO_CREATE_TABLES="false")
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT / "backend", env=env, check=True, capture_output=True, text=True)
        now = "2026-08-23T00:00:00Z"
        domains = {
            "Organization": ("organizations", "org-rc14"), "User": ("users", "user-rc14"),
            "Research Project": ("research_projects", "project-rc14"), "Literature Study": ("project_literature_studies", "literature-rc14"),
            "Promotion": ("promotion_applications", "promotion-rc14"), "Peer Review": ("peer_review_cases", "review-rc14"),
            "Notification": ("notifications", "notification-rc14"), "Billing": ("invoices", "invoice-rc14"),
            "AI": ("ai_runs", "ai-rc14"), "File": ("uploaded_files", "file-rc14"),
        }
        file = storage / "org-rc14/project-rc14/representative.txt"; file.parent.mkdir(parents=True); file.write_text(MARKER, encoding="utf-8"); expected_hash = sha(file)
        with sqlite3.connect(source) as db:
            db.execute("PRAGMA foreign_keys=ON")
            insert(db,"organizations",dict(id="org-rc14",name=MARKER,slug="rc14-org",organization_type="INSTITUTION",status="ACTIVE",created_at=now))
            insert(db,"users",dict(id="user-rc14",username="rc14-user",hashed_password="non-secret-test-hash",email="rc14@example.invalid",role="RESEARCHER",created_at=now))
            insert(db,"organization_memberships",dict(id="member-rc14",organization_id="org-rc14",user_id="user-rc14",role="ORGANIZATION_ADMIN",status="ACTIVE",created_at=now))
            insert(db,"research_projects",dict(id="project-rc14",userId="user-rc14",organizationId="org-rc14",titleAr=MARKER,titleEn=MARKER,sampleSettings="{}",version=1))
            insert(db,"project_literature_studies",dict(id="literature-rc14",projectId="project-rc14",organizationId="org-rc14",author=MARKER,year=2026,sampleSize=10,effectSize=.5,ciLower=.1,ciUpper=.9,source="manual",notes=MARKER,createdAt=now,updatedAt=now))
            insert(db,"promotion_policies",dict(id="policy-rc14",organization_id="org-rc14",name_ar=MARKER,name_en=MARKER,target_rank="ASSOCIATE",version=1,status="ACTIVE",created_at=now,updated_at=now))
            insert(db,"promotion_applications",dict(id="promotion-rc14",organization_id="org-rc14",user_id="user-rc14",policy_id="policy-rc14",policy_version=1,target_rank="ASSOCIATE",status="DRAFT",created_at=now,updated_at=now))
            insert(db,"peer_review_cases",dict(id="review-rc14",organization_id="org-rc14",owner_user_id="user-rc14",project_id="project-rc14",title_ar=MARKER,title_en=MARKER,case_type="MANUSCRIPT",blind_type="DOUBLE_BLIND",status="IN_REVIEW",current_round_number=1,created_at=now,updated_at=now))
            insert(db,"peer_review_rounds",dict(id="round-rc14",case_id="review-rc14",round_number=1,manuscript_version=1,status="ACTIVE",decision="PENDING",created_at=now))
            insert(db,"notifications",dict(id="notification-rc14",organization_id="org-rc14",recipient_user_id="user-rc14",category="SYSTEM",title_ar=MARKER,title_en=MARKER,message_ar=MARKER,message_en=MARKER,target_type="RESEARCH_PROJECT",target_id="project-rc14",created_at=now))
            insert(db,"plans",dict(id="plan-rc14",code="RC14",name=MARKER,billing_interval="MONTHLY",price=0,price_minor_units=0,currency="SAR",limits_json="{}",features_json="{}",created_at=now))
            insert(db,"subscriptions",dict(id="subscription-rc14",organization_id="org-rc14",plan_id="plan-rc14",status="ACTIVE",provider="NULL_ADAPTER",unit_amount_minor_units=0,currency="SAR",billing_interval="MONTHLY",current_period_start=now,current_period_end=now,created_at=now))
            insert(db,"invoices",dict(id="invoice-rc14",organization_id="org-rc14",subscription_id="subscription-rc14",invoice_number=MARKER,amount_subtotal=0,amount_tax=0,amount_total=0,amount_subtotal_minor_units=0,tax_rate_basis_points=1500,amount_tax_minor_units=0,amount_total_minor_units=0,currency="SAR",status="DRAFT",issued_at=now,metadata_json=json.dumps({"marker":MARKER})))
            insert(db,"ai_runs",dict(id="ai-rc14",organization_id="org-rc14",user_id="user-rc14",use_case=MARKER,provider="UNAVAILABLE",status="FAILED",error_code="NOT_CONFIGURED",created_at=now))
            insert(db,"uploaded_files",dict(id="file-rc14",organization_id="org-rc14",project_id="project-rc14",uploaded_by="user-rc14",storage_key="org-rc14/project-rc14/representative.txt",filename="representative.txt",mime_type="text/plain",size_bytes=file.stat().st_size,checksum=expected_hash,classification="INTERNAL",scan_status="CLEAN",created_at=now))
            db.commit()
        db.close()
        backup = root / "backup.sqlite3"; backup_storage = root / "backup-storage"
        src, dst = sqlite3.connect(source), sqlite3.connect(backup)
        try:
            src.backup(dst)
        finally:
            src.close(); dst.close()
        shutil.copytree(storage, backup_storage); backup_ms = round((time.perf_counter()-started)*1000,2)
        restored = root / "isolated-restore/restored.sqlite3"; restored.parent.mkdir(); shutil.copy2(backup, restored)
        restored_storage = restored.parent / "storage"; shutil.copytree(backup_storage, restored_storage)
        db = sqlite3.connect(restored)
        try:
            integrity=db.execute("PRAGMA integrity_check").fetchone()[0]; tables=db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'").fetchone()[0]
            verified={domain: db.execute(f'SELECT 1 FROM "{table}" WHERE id=?',(identifier,)).fetchone() is not None for domain,(table,identifier) in domains.items()}
            relationships={"Project→Literature":bool(db.execute("SELECT 1 FROM project_literature_studies WHERE projectId='project-rc14'").fetchone()),"PeerReviewCase→Round":bool(db.execute("SELECT 1 FROM peer_review_rounds WHERE case_id='review-rc14'").fetchone()),"Invoice→Organization":bool(db.execute("SELECT 1 FROM invoices WHERE organization_id='org-rc14'").fetchone()),"UploadedFile→Organization/project":bool(db.execute("SELECT 1 FROM uploaded_files WHERE organization_id='org-rc14' AND project_id='project-rc14'").fetchone())}
        finally:
            db.close()
        hash_match=sha(restored_storage/"org-rc14/project-rc14/representative.txt")==expected_hash
        if integrity!="ok" or tables!=68 or not all(verified.values()) or not all(relationships.values()) or not hash_match:
            raise SystemExit(f"Representative isolated restore verification failed: integrity={integrity}, tables={tables}, domains={verified}, relationships={relationships}, hash={hash_match}")
        print(json.dumps(dict(database_integrity=integrity,table_count=tables,representative_domains=verified,relationships=relationships,storage_files_verified=1,file_sha256_match=hash_match,backup_duration_ms=backup_ms,restore_verify_duration_ms=round((time.perf_counter()-started)*1000-backup_ms,2)),sort_keys=True))

if __name__ == "__main__": main()
