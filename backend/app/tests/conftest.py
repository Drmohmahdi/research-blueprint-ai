import os
import pytest

# The shared test fixtures must never point at the developer or production
# database. Set the isolated URL before importing app.db, which constructs the
# SQLAlchemy engine at import time.
os.environ["TESTING"] = "True"
POSTGRES_TESTING = os.getenv("POSTGRES_TESTING", "").lower() == "true"
if not POSTGRES_TESTING:
    os.environ["DATABASE_URL"] = "sqlite:///./test_suite.db"
elif not os.getenv("DATABASE_URL", "").startswith(("postgresql://", "postgresql+psycopg2://")):
    raise RuntimeError("POSTGRES_TESTING requires an explicit PostgreSQL DATABASE_URL")
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.db import Base, engine, SessionLocal

@pytest.fixture(scope="session", autouse=True)
def setup_test_suite_db():
    if not POSTGRES_TESTING:
        # SQLite regression remains isolated and intentionally uses metadata.
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    # PostgreSQL test databases are migrated by Alembic before pytest starts;
    # never let create_all conceal migration drift in that gate.
    yield


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
