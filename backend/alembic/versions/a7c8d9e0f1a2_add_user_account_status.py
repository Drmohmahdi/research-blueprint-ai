"""add user account_status for platform-wide disable

Revision ID: a7c8d9e0f1a2
Revises: f1a2b3c4d5e6
"""
import sqlalchemy as sa
from alembic import op

revision = "a7c8d9e0f1a2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "account_status" not in columns:
        op.add_column(
            "users",
            sa.Column("account_status", sa.String(), nullable=False, server_default="ACTIVE"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "account_status" in columns:
        op.drop_column("users", "account_status")
