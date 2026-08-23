"""add legacy academic identity profile and channel tables

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a0
"""
from alembic import op
import sqlalchemy as sa

revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a0"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "core_academic_identity_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=False),
        sa.Column("preferredNameAr", sa.String(), nullable=True),
        sa.Column("preferredNameEn", sa.String(), nullable=True),
        sa.Column("nameVariants", sa.String(), nullable=True),
        sa.Column("discipline", sa.String(), nullable=True),
        sa.Column("researchInterests", sa.String(), nullable=True),
        sa.Column("keywords", sa.String(), nullable=True),
        sa.Column("shortBio", sa.String(), nullable=True),
        sa.Column("fullBio", sa.String(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_core_academic_identity_profiles_id"), "core_academic_identity_profiles", ["id"], unique=False)
    op.create_table(
        "core_academic_channels",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("profileId", sa.String(), nullable=False),
        sa.Column("channelName", sa.String(), nullable=False),
        sa.Column("profileUrl", sa.String(), nullable=True),
        sa.Column("externalId", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("completenessScore", sa.Integer(), nullable=True),
        sa.Column("lastSync", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["profileId"], ["core_academic_identity_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_core_academic_channels_id"), "core_academic_channels", ["id"], unique=False)

def downgrade() -> None:
    op.drop_index(op.f("ix_core_academic_channels_id"), table_name="core_academic_channels")
    op.drop_table("core_academic_channels")
    op.drop_index(op.f("ix_core_academic_identity_profiles_id"), table_name="core_academic_identity_profiles")
    op.drop_table("core_academic_identity_profiles")
