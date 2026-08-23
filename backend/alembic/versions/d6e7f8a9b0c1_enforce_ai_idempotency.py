"""enforce organization-scoped AI idempotency

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
"""
from alembic import op
import sqlalchemy as sa

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Preserve the earliest authoritative audit row if historical retries
    # produced duplicate non-null keys before the invariant was enforced.
    op.execute(sa.text("""
        DELETE FROM ai_runs
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY organization_id, idempotency_key
                    ORDER BY created_at, id
                ) AS duplicate_rank
                FROM ai_runs
                WHERE idempotency_key IS NOT NULL
            ) AS ranked_runs
            WHERE duplicate_rank > 1
        )
    """))
    op.create_index(
        "uq_ai_runs_org_idempotency",
        "ai_runs",
        ["organization_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
        sqlite_where=sa.text("idempotency_key IS NOT NULL"),
    )

def downgrade() -> None:
    op.drop_index("uq_ai_runs_org_idempotency", table_name="ai_runs")
