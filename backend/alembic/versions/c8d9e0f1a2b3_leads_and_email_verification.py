"""marketing leads inbox and email verification

Revision ID: c8d9e0f1a2b3
Revises: a7c8d9e0f1a2
"""
import sqlalchemy as sa
from alembic import op

revision = "c8d9e0f1a2b3"
down_revision = "a7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "email_verified_at" not in columns:
        op.add_column("users", sa.Column("email_verified_at", sa.String(), nullable=True))
        op.execute(sa.text("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL"))

    tables = set(inspector.get_table_names())
    if "email_verification_tokens" not in tables:
        op.create_table(
            "email_verification_tokens",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("userId", sa.String(), nullable=False),
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("expiresAt", sa.String(), nullable=False),
            sa.Column("usedAt", sa.String(), nullable=True),
            sa.Column("createdAt", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        op.create_index("ix_email_verification_tokens_userId", "email_verification_tokens", ["userId"])
        op.create_index(
            "ix_email_verification_tokens_token_hash",
            "email_verification_tokens",
            ["token_hash"],
            unique=True,
        )

    if "marketing_leads" not in tables:
        op.create_table(
            "marketing_leads",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("organization", sa.String(), nullable=True),
            sa.Column("intent", sa.String(), nullable=False),
            sa.Column("message", sa.String(), nullable=True),
            sa.Column("source_path", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_marketing_leads_email", "marketing_leads", ["email"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "marketing_leads" in tables:
        op.drop_index("ix_marketing_leads_email", table_name="marketing_leads")
        op.drop_table("marketing_leads")
    if "email_verification_tokens" in tables:
        op.drop_index("ix_email_verification_tokens_token_hash", table_name="email_verification_tokens")
        op.drop_index("ix_email_verification_tokens_userId", table_name="email_verification_tokens")
        op.drop_table("email_verification_tokens")
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "email_verified_at" in columns:
        op.drop_column("users", "email_verified_at")
