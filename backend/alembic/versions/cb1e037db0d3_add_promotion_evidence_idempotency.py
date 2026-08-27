"""add promotion evidence selection idempotency constraint

Revision ID: cb1e037db0d3
Revises: e5f6a7b8c9d0
"""
from alembic import op

revision = "cb1e037db0d3"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(
        "uq_promotion_evidence_selection",
        "core_promotion_asset_selections",
        ["promotion_application_id", "scholarly_asset_id"],
    )


def downgrade():
    op.drop_constraint("uq_promotion_evidence_selection", "core_promotion_asset_selections", type_="unique")
