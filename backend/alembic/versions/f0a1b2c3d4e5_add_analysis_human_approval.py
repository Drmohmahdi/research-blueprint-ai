"""add analysis human approval

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
"""
from alembic import op
import sqlalchemy as sa


revision = "f0a1b2c3d4e5"
down_revision = "e9f0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("research_analyses") as batch:
        batch.add_column(sa.Column("approved_by", sa.String(), nullable=True))
        batch.add_column(sa.Column("approved_at", sa.String(), nullable=True))
        batch.create_foreign_key("fk_research_analysis_approved_by", "users", ["approved_by"], ["id"], ondelete="SET NULL")


def downgrade():
    with op.batch_alter_table("research_analyses") as batch:
        batch.drop_constraint("fk_research_analysis_approved_by", type_="foreignkey")
        batch.drop_column("approved_at")
        batch.drop_column("approved_by")
