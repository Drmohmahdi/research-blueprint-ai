"""add dataset access grants — resource-scoped sensitive-data authorization

Revision ID: b2c3d4e5f607
Revises: e0f1a2b3c4d5
"""
import sqlalchemy as sa
from alembic import op

revision = "b2c3d4e5f607"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "dataset_access_grants" in {t for t in inspector.get_table_names()}:
        return
    op.create_table(
        "dataset_access_grants",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_id", sa.String(), sa.ForeignKey("research_datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("capability", sa.String(), nullable=False),
        sa.Column("granted_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("expires_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("revoked_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dataset_id", "user_id", "capability", name="uq_dataset_access_grant"),
    )
    op.create_index("ix_dataset_grant_org_dataset", "dataset_access_grants", ["organization_id", "dataset_id"])


def downgrade():
    op.drop_table("dataset_access_grants")