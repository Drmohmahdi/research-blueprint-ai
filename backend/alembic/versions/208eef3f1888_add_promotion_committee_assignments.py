"""add promotion committee assignments (resource-scoped academic authority)

Revision ID: 208eef3f1888
Revises: cb1e037db0d3
"""
import sqlalchemy as sa
from alembic import op

revision = "208eef3f1888"
down_revision = "cb1e037db0d3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "promotion_committee_assignments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("application_id", sa.String(), sa.ForeignKey("promotion_applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("assigned_at", sa.String(), nullable=False),
        sa.Column("revoked_at", sa.String(), nullable=True),
        sa.Column("revoked_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("application_id", "user_id", name="uq_promotion_committee_assignment"),
    )
    op.create_index("ix_promotion_committee_assignments_id", "promotion_committee_assignments", ["id"])
    op.create_index("ix_promotion_committee_assignments_organization_id", "promotion_committee_assignments", ["organization_id"])
    op.create_index("ix_promotion_committee_assignments_application_id", "promotion_committee_assignments", ["application_id"])
    op.create_index("ix_promotion_committee_assignments_user_id", "promotion_committee_assignments", ["user_id"])


def downgrade():
    op.drop_index("ix_promotion_committee_assignments_user_id", table_name="promotion_committee_assignments")
    op.drop_index("ix_promotion_committee_assignments_application_id", table_name="promotion_committee_assignments")
    op.drop_index("ix_promotion_committee_assignments_organization_id", table_name="promotion_committee_assignments")
    op.drop_index("ix_promotion_committee_assignments_id", table_name="promotion_committee_assignments")
    op.drop_table("promotion_committee_assignments")
