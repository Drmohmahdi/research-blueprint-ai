"""Fresh PostgreSQL Alembic upgrade, previous-head upgrade, and roundtrip."""
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.config import settings
from app.db import Base
from app import models  # noqa: F401
from app.tests.test_thesis_postgres import _resolve_url


PREVIOUS_HEAD = "b2c3d4e5f607"
CURRENT_HEAD = "c8d9e0f1a2b3"
BACKEND_DIR = Path(__file__).resolve().parents[2]


def _alembic(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    settings.DATABASE_URL = url
    return config


def _admin_url(url: str) -> str:
    return url.rsplit("/", 1)[0] + "/postgres"


def _recreate_database(url: str, name: str) -> str:
    admin = create_engine(_admin_url(url), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{name}' AND pid <> pg_backend_pid()"))
        connection.execute(text(f"DROP DATABASE IF EXISTS {name}"))
        connection.execute(text(f"CREATE DATABASE {name}"))
    admin.dispose()
    return url.rsplit("/", 1)[0] + f"/{name}"


@pytest.fixture(scope="module")
def pg_url():
    return _resolve_url()


def test_postgres_fresh_alembic_upgrade_head(pg_url):
    url = _recreate_database(pg_url, "thesis_alembic_fresh")
    command.upgrade(_alembic(url), "head")
    engine = create_engine(url)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert "thesis_records" in tables and "thesis_final_versions" in tables and "thesis_corrections" in tables
    columns = {column["name"] for column in inspector.get_columns("thesis_corrections")}
    assert "details_json" in columns
    with engine.connect() as connection:
        current = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert current == CURRENT_HEAD
    engine.dispose()


def test_postgres_upgrade_from_previous_thesis_revision(pg_url):
    url = _recreate_database(pg_url, "thesis_alembic_upgrade")
    command.upgrade(_alembic(url), PREVIOUS_HEAD)
    command.upgrade(_alembic(url), "head")
    engine = create_engine(url)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == CURRENT_HEAD
    engine.dispose()


def test_postgres_alembic_roundtrip(pg_url):
    url = _recreate_database(pg_url, "thesis_alembic_roundtrip")
    cfg = _alembic(url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, PREVIOUS_HEAD)
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == CURRENT_HEAD
    inspector = inspect(engine)
    assert "details_json" in {column["name"] for column in inspector.get_columns("thesis_corrections")}
    engine.dispose()


def test_alembic_single_head_and_schema_alignment(pg_url):
    from alembic.script import ScriptDirectory
    script = ScriptDirectory.from_config(_alembic(pg_url))
    heads = script.get_heads()
    assert heads == [CURRENT_HEAD], heads
    assert len(list(script.walk_revisions())) >= 20
    mapped = {table.name for table in Base.metadata.sorted_tables}
    metadata_tables = set(Base.metadata.tables)
    assert mapped == metadata_tables
    engine = create_engine(pg_url)
    from app.db import Base as AppBase
    AppBase.metadata.create_all(bind=engine)
    pg_tables = set(inspect(engine).get_table_names())
    thesis_mapped = {name for name in mapped if name.startswith("thesis_")}
    assert thesis_mapped <= pg_tables
    engine.dispose()
    sqlite = create_engine("sqlite:///:memory:")
    AppBase.metadata.create_all(bind=sqlite)
    sqlite_tables = set(inspect(sqlite).get_table_names())
    assert thesis_mapped <= sqlite_tables
    sqlite.dispose()
