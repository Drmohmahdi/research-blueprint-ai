"""Create an isolated, deterministic database for browser tests only."""

from pathlib import Path
import os

os.environ["DATABASE_URL"] = "sqlite:///./e2e.db"
os.environ["TESTING"] = "True"
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import User  # noqa: E402
from app.routers.auth import hash_password  # noqa: E402


db_path = (Path(__file__).resolve().parent / "e2e.db").resolve()
expected_parent = Path(__file__).resolve().parent
if db_path.parent != expected_parent or db_path.name != "e2e.db":
    raise RuntimeError("Refusing to prepare an unexpected E2E database path")

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

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

print("E2E database prepared with deterministic non-production fixtures")
