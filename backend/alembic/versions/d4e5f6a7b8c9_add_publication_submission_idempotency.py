"""add publication submission idempotency constraint

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f60718
"""
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f60718"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(
        "uq_publication_submission_target",
        "publication_submissions",
        ["asset_id", "journal_id", "manuscript_version_id"],
    )


def downgrade():
    op.drop_constraint("uq_publication_submission_target", "publication_submissions", type_="unique")
