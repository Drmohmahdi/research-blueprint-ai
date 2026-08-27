"""add research design intelligence — collaboration, protocol, review, state

Revision ID: e0f1a2b3c4d5
Revises: 4d5e6f7a8b9c
"""
import sqlalchemy as sa
from alembic import op

revision = "e0f1a2b3c4d5"
down_revision = "4d5e6f7a8b9c"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {t for t in inspector.get_table_names()}

    if "research_project_members" not in existing:
        op.create_table(
            "research_project_members",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("relationship", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
            sa.Column("assigned_sections", sa.JSON(), nullable=True),
            sa.Column("invited_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("ended_at", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("project_id", "user_id", "relationship", name="uq_project_member_relationship"),
        )
        op.create_index("ix_project_member_org_project", "research_project_members", ["organization_id", "project_id"])

    if "research_protocols" not in existing:
        op.create_table(
            "research_protocols",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("fingerprint", sa.String(), nullable=False),
            sa.Column("snapshot_json", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="DRAFT"),
            sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("submitted_at", sa.String(), nullable=True),
            sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("approved_at", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("project_id", "version_number", name="uq_research_protocol_version"),
        )
        op.create_index("ix_protocol_org_project", "research_protocols", ["organization_id", "project_id"])

    if "methodology_reviews" not in existing:
        op.create_table(
            "methodology_reviews",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("protocol_id", sa.String(), sa.ForeignKey("research_protocols.id", ondelete="CASCADE"), nullable=False),
            sa.Column("protocol_version", sa.Integer(), nullable=False),
            sa.Column("reviewer_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="DRAFT"),
            sa.Column("findings_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json") if bind.dialect.name == "postgresql" else sa.text("'[]'")),
            sa.Column("recommendation", sa.String(), nullable=True),
            sa.Column("visibility", sa.String(), nullable=False, server_default="CONFIDENTIAL_TO_RESEARCHER"),
            sa.Column("submitted_at", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("protocol_id", "reviewer_id", name="uq_methodology_review_reviewer"),
        )
        op.create_index("ix_review_org_project", "methodology_reviews", ["organization_id", "project_id"])

    if "research_design_states" not in existing:
        default_json = sa.text("'{}'::json") if bind.dialect.name == "postgresql" else sa.text("'{}'")
        op.create_table(
            "research_design_states",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("idea_json", sa.JSON(), nullable=True),
            sa.Column("problem_json", sa.JSON(), nullable=True),
            sa.Column("gap_json", sa.JSON(), nullable=True),
            sa.Column("objectives_json", sa.JSON(), nullable=True),
            sa.Column("question_ext_json", sa.JSON(), nullable=True),
            sa.Column("hypothesis_ext_json", sa.JSON(), nullable=True),
            sa.Column("variable_registry_json", sa.JSON(), nullable=True),
            sa.Column("conceptual_framework_json", sa.JSON(), nullable=True),
            sa.Column("theoretical_framework_json", sa.JSON(), nullable=True),
            sa.Column("methodology_json", sa.JSON(), nullable=True),
            sa.Column("sampling_json", sa.JSON(), nullable=True),
            sa.Column("measurement_json", sa.JSON(), nullable=True),
            sa.Column("procedure_json", sa.JSON(), nullable=True),
            sa.Column("analysis_json", sa.JSON(), nullable=True),
            sa.Column("protocol_status", sa.String(), nullable=False, server_default="NO_PROTOCOL"),
            sa.Column("current_protocol_id", sa.String(), nullable=True),
            sa.Column("protocol_review_due", sa.Boolean(), nullable=False,
                      server_default=sa.text("false") if bind.dialect.name == "postgresql" else sa.text("0")),
            sa.Column("updated_by", sa.String(), nullable=True),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("project_id", name="uq_research_design_state_project"),
        )
        op.create_index("ix_design_state_org_project", "research_design_states", ["organization_id", "project_id"])


def downgrade():
    op.drop_table("methodology_reviews")
    op.drop_table("research_protocols")
    op.drop_table("research_project_members")
    op.drop_table("research_design_states")