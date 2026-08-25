"""Create an isolated, deterministic database for browser tests only."""

from pathlib import Path
import hashlib
import os

db_path = (Path(__file__).resolve().parent / "e2e.db").resolve()
expected_parent = Path(__file__).resolve().parent
if db_path.parent != expected_parent or db_path.name != "e2e.db":
    raise RuntimeError("Refusing to prepare an unexpected E2E database path")

os.environ["DATABASE_URL"] = "sqlite:///./e2e.db"
os.environ["TESTING"] = "True"
os.environ["AUTO_CREATE_TABLES"] = "false"

print("e2e_seed: preparing sqlite e2e.db", flush=True)

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import Base, engine as imported_engine  # noqa: E402
from app.models import User  # noqa: E402

if not settings.DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("E2E seed refused non-sqlite DATABASE_URL")

imported_engine.dispose()

for leftover in (db_path, Path(str(db_path) + "-wal"), Path(str(db_path) + "-shm")):
    if leftover.exists():
        try:
            leftover.unlink()
        except OSError as exc:
            raise RuntimeError("Cannot replace e2e.db (file in use)") from exc

print("e2e_seed: creating tables", flush=True)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    hash_val = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return salt.hex() + ":" + hash_val.hex()


engine = create_engine(
    "sqlite:///./e2e.db",
    connect_args={"check_same_thread": False, "timeout": 15},
    poolclass=NullPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Replacing the file above is faster than drop_all; checkfirst inspects 100+ tables.
Base.metadata.create_all(bind=engine, checkfirst=False)

print("e2e_seed: inserting fixture user", flush=True)
with SessionLocal() as db:
    db.add(
        User(
            id="e2e-researcher-user",
            username="e2e_researcher",
            email="e2e@example.invalid",
            hashed_password=hash_password("E2ePass123!"),
            role="Researcher",
            created_at="2026-01-01T00:00:00+00:00",
        )
    )
    db.commit()

engine.dispose()
print("E2E database prepared with deterministic non-production fixtures", flush=True)
