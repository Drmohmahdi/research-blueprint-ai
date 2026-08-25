"""close thesis examination and completion operations

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
"""
from alembic import op
try:
    from app.db import Base
    from app import models  # noqa: F401
except ModuleNotFoundError:
    from backend.app.db import Base
    from backend.app import models  # noqa: F401

revision = "3c4d5e6f7a8b"
down_revision = "2b3c4d5e6f7a"
branch_labels = None
depends_on = None

TABLES = ["thesis_examiner_assignments", "thesis_examiner_tokens", "thesis_examiner_reports", "thesis_defense_sessions", "thesis_final_versions", "thesis_final_approvals", "thesis_deposits"]


def upgrade():
    bind = op.get_bind()
    for name in TABLES:
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade():
    bind = op.get_bind()
    for name in reversed(TABLES):
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
