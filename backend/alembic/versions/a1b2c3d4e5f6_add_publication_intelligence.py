"""add publication intelligence

Revision ID: 1a2b3c4d5e6f
Revises: f0a1b2c3d4e5
"""
from alembic import op
import sqlalchemy as sa

revision = "1a2b3c4d5e6f"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("publication_manuscript_versions",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", sa.String(), sa.ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("article_type", sa.String(), nullable=False), sa.Column("change_summary", sa.String()), sa.Column("fingerprint", sa.String(), nullable=False),
        sa.Column("source_dependencies_json", sa.JSON(), nullable=False), sa.Column("declarations_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("created_at", sa.String(), nullable=False),
        sa.UniqueConstraint("asset_id", "version_number", name="uq_publication_manuscript_version"))
    op.create_index("ix_publication_manuscript_versions_organization_id", "publication_manuscript_versions", ["organization_id"]); op.create_index("ix_publication_manuscript_versions_asset_id", "publication_manuscript_versions", ["asset_id"])
    op.create_table("publication_manuscript_sections",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="CASCADE"), nullable=False), sa.Column("section_key", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False), sa.Column("content_json", sa.JSON(), nullable=False), sa.Column("dependencies_json", sa.JSON(), nullable=False), sa.Column("stale_at", sa.String()), sa.Column("updated_at", sa.String(), nullable=False),
        sa.UniqueConstraint("manuscript_version_id", "section_key", name="uq_publication_section_key"))
    op.create_index("ix_publication_manuscript_sections_organization_id", "publication_manuscript_sections", ["organization_id"]); op.create_index("ix_publication_manuscript_sections_manuscript_version_id", "publication_manuscript_sections", ["manuscript_version_id"])
    op.create_table("publication_journals",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("canonical_key", sa.String(), nullable=False, unique=True), sa.Column("title", sa.String(), nullable=False), sa.Column("issn", sa.String()), sa.Column("eissn", sa.String()), sa.Column("publisher", sa.String()),
        sa.Column("metadata_json", sa.JSON(), nullable=False), sa.Column("provider_name", sa.String(), nullable=False), sa.Column("provider_record_id", sa.String()), sa.Column("retrieved_at", sa.String(), nullable=False), sa.Column("verified_at", sa.String()), sa.Column("stale_after", sa.String(), nullable=False))
    op.create_index("ix_publication_journals_canonical_key", "publication_journals", ["canonical_key"], unique=True); op.create_index("ix_publication_journals_issn", "publication_journals", ["issn"]); op.create_index("ix_publication_journals_eissn", "publication_journals", ["eissn"])
    op.create_table("publication_journal_requirements",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("journal_id", sa.String(), sa.ForeignKey("publication_journals.id", ondelete="CASCADE"), nullable=False), sa.Column("requirement_type", sa.String(), nullable=False), sa.Column("value_json", sa.JSON(), nullable=False), sa.Column("severity", sa.String(), nullable=False), sa.Column("source_url", sa.String(), nullable=False), sa.Column("verified_at", sa.String(), nullable=False))
    op.create_index("ix_publication_journal_requirements_journal_id", "publication_journal_requirements", ["journal_id"])
    op.create_table("publication_journal_matches",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False), sa.Column("asset_id", sa.String(), sa.ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False), sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="CASCADE"), nullable=False), sa.Column("journal_id", sa.String(), sa.ForeignKey("publication_journals.id", ondelete="CASCADE"), nullable=False), sa.Column("eligibility", sa.String(), nullable=False), sa.Column("score", sa.Float()), sa.Column("factors_json", sa.JSON(), nullable=False), sa.Column("concerns_json", sa.JSON(), nullable=False), sa.Column("metadata_snapshot_json", sa.JSON(), nullable=False), sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("created_at", sa.String(), nullable=False))
    op.create_index("ix_publication_journal_matches_organization_id", "publication_journal_matches", ["organization_id"]); op.create_index("ix_publication_journal_matches_asset_id", "publication_journal_matches", ["asset_id"])
    op.create_table("publication_journal_shortlists",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False), sa.Column("asset_id", sa.String(), sa.ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False), sa.Column("journal_id", sa.String(), sa.ForeignKey("publication_journals.id", ondelete="CASCADE"), nullable=False), sa.Column("position", sa.String(), nullable=False), sa.Column("selected_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("created_at", sa.String(), nullable=False), sa.UniqueConstraint("asset_id", "journal_id", name="uq_publication_shortlist_journal"))
    op.create_index("ix_publication_journal_shortlists_organization_id", "publication_journal_shortlists", ["organization_id"]); op.create_index("ix_publication_journal_shortlists_asset_id", "publication_journal_shortlists", ["asset_id"])
    op.create_table("publication_submissions",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False), sa.Column("asset_id", sa.String(), sa.ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False), sa.Column("journal_id", sa.String(), sa.ForeignKey("publication_journals.id", ondelete="RESTRICT"), nullable=False), sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="RESTRICT"), nullable=False), sa.Column("status", sa.String(), nullable=False), sa.Column("raw_external_status", sa.String()), sa.Column("submission_identifier", sa.String()), sa.Column("package_snapshot_json", sa.JSON(), nullable=False), sa.Column("submitted_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("submitted_at", sa.String()), sa.Column("created_at", sa.String(), nullable=False), sa.Column("updated_at", sa.String(), nullable=False))
    op.create_index("ix_publication_submissions_organization_id", "publication_submissions", ["organization_id"]); op.create_index("ix_publication_submissions_asset_id", "publication_submissions", ["asset_id"])


def downgrade():
    for table in ("publication_submissions", "publication_journal_shortlists", "publication_journal_matches", "publication_journal_requirements", "publication_journals", "publication_manuscript_sections", "publication_manuscript_versions"):
        op.drop_table(table)
