"""add research lifecycle integration

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
"""
from alembic import op
import sqlalchemy as sa


revision = "e9f0a1b2c3d4"
down_revision = "d8e9f0a1b2c3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "research_lifecycles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_key", sa.String(), nullable=False),
        sa.Column("template_version", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.UniqueConstraint("project_id", name="uq_research_lifecycle_project"),
    )
    op.create_index("ix_lifecycle_org_project", "research_lifecycles", ["organization_id", "project_id"])

    op.create_table(
        "research_variable_mappings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("research_variable_id", sa.String(), sa.ForeignKey("research_variables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_variable_id", sa.String(), sa.ForeignKey("dataset_variables.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mapping_role", sa.String(), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.UniqueConstraint("research_variable_id", "dataset_variable_id", name="uq_research_dataset_variable_mapping"),
    )
    op.create_index("ix_variable_mapping_org_project", "research_variable_mappings", ["organization_id", "project_id"])

    op.create_table(
        "academic_handoffs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("handoff_type", sa.String(), nullable=False),
        sa.Column("source_entity_type", sa.String(), nullable=False),
        sa.Column("source_entity_id", sa.String(), nullable=False),
        sa.Column("source_version", sa.String()),
        sa.Column("source_fingerprint", sa.String()),
        sa.Column("target_domain", sa.String(), nullable=False),
        sa.Column("target_entity_type", sa.String()),
        sa.Column("target_entity_id", sa.String()),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("idempotency_key", sa.String(), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("accepted_at", sa.String()),
        sa.Column("stale_at", sa.String()),
        sa.UniqueConstraint("idempotency_key", name="uq_academic_handoff_idempotency"),
    )
    op.create_index("ix_handoff_org_project_status", "academic_handoffs", ["organization_id", "project_id", "status"])

    op.create_table(
        "analysis_asset_dependencies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", sa.String(), sa.ForeignKey("research_analyses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("scholarly_asset_id", sa.String(), sa.ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_engine_version", sa.String(), nullable=False),
        sa.Column("dataset_version_id", sa.String(), sa.ForeignKey("dataset_versions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("needs_review_at", sa.String()),
        sa.UniqueConstraint("analysis_id", "scholarly_asset_id", name="uq_analysis_asset_dependency"),
    )
    op.create_index("ix_analysis_asset_org_project", "analysis_asset_dependencies", ["organization_id", "project_id"])

    op.create_table(
        "research_lineage_edges",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_entity_type", sa.String(), nullable=False),
        sa.Column("source_entity_id", sa.String(), nullable=False),
        sa.Column("source_version", sa.String()),
        sa.Column("relationship_type", sa.String(), nullable=False),
        sa.Column("target_entity_type", sa.String(), nullable=False),
        sa.Column("target_entity_id", sa.String(), nullable=False),
        sa.Column("target_version", sa.String()),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.UniqueConstraint("relationship_type", "source_entity_type", "source_entity_id", "target_entity_type", "target_entity_id", name="uq_research_lineage_edge"),
    )
    op.create_index("ix_lineage_org_project", "research_lineage_edges", ["organization_id", "project_id"])


def downgrade():
    op.drop_table("research_lineage_edges")
    op.drop_table("analysis_asset_dependencies")
    op.drop_table("academic_handoffs")
    op.drop_table("research_variable_mappings")
    op.drop_table("research_lifecycles")
