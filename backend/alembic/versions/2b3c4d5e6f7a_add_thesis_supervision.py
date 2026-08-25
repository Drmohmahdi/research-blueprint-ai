"""add thesis supervision and examination

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
"""
from alembic import op
try:
    from app.db import Base
    from app import models  # noqa: F401 - registers the domain tables in metadata
except ModuleNotFoundError:  # Alembic invoked from repository root
    from backend.app.db import Base
    from backend.app import models  # noqa: F401

revision = "2b3c4d5e6f7a"
down_revision = "1a2b3c4d5e6f"
branch_labels = None
depends_on = None

TABLES = [
    "thesis_policies", "thesis_records", "thesis_supervision_assignments",
    "thesis_milestones", "thesis_meetings", "thesis_actions", "thesis_chapters",
    "thesis_chapter_versions", "thesis_feedback", "thesis_committee_members",
    "thesis_examination_rounds", "thesis_corrections",
]


def upgrade():
    bind = op.get_bind()
    for name in TABLES:
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade():
    bind = op.get_bind()
    for name in reversed(TABLES):
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
