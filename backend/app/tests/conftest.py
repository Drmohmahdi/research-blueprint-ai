import os
import pytest

# The shared test fixtures must never point at the developer or production
# database. Set the isolated URL before importing app.db, which constructs the
# SQLAlchemy engine at import time.
os.environ["TESTING"] = "True"
os.environ["DATABASE_URL"] = "sqlite:///./test_suite.db"
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.db import Base, engine, SessionLocal

@pytest.fixture(scope="session", autouse=True)
def setup_test_suite_db():
    # Ensure fresh schema for the test run so newly added columns and tables are cleanly synced
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
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
