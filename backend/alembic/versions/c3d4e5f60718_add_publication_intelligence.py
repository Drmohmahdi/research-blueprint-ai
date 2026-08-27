"""add publication intelligence — authorship, guidelines, references, acceptance

Revision ID: c3d4e5f60718
Revises: b2c3d4e5f607
"""
import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f60718"
down_revision = "b2c3d4e5f607"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {t for t in sa.inspect(bind).get_table_names()}
    if "publication_manuscript_authorships" not in existing:
        op.create_table(
            "publication_manuscript_authorships",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("display_name", sa.String(), nullable=True),
            sa.Column("affiliation", sa.String(), nullable=True),
            sa.Column("orcid", sa.String(), nullable=True),
            sa.Column("author_order", sa.Integer(), nullable=False),
            sa.Column("is_corresponding_author", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("credit_roles", sa.JSON(), nullable=False, server_default=sa.text("'[]'") if bind.dialect.name == "postgresql" else sa.text("'[]'")),
            sa.Column("confirmed_at", sa.String(), nullable=True),
            sa.Column("source", sa.String(), nullable=False, server_default="MANUAL"),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("manuscript_version_id", "user_id", name="uq_manuscript_authorship_user"),
        )
        op.create_index("ix_manuscript_authorship_org", "publication_manuscript_authorships", ["organization_id", "manuscript_version_id"])
    if "publication_reporting_guidelines" not in existing:
        op.create_table(
            "publication_reporting_guidelines",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("version", sa.String(), nullable=False, server_default="1.0"),
            sa.Column("short_name", sa.String(), nullable=True),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("url", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name", name="uq_guideline_name"),
        )
        op.create_index("ix_guideline_short_name", "publication_reporting_guidelines", ["short_name"])
    if "publication_reporting_guideline_items" not in existing:
        op.create_table(
            "publication_reporting_guideline_items",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("guideline_id", sa.String(), sa.ForeignKey("publication_reporting_guidelines.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_number", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=False),
            sa.Column("section", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("guideline_id", "item_number", name="uq_guideline_item_number"),
        )
    if "publication_manuscript_guideline_checks" not in existing:
        op.create_table(
            "publication_manuscript_guideline_checks",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("guideline_id", sa.String(), sa.ForeignKey("publication_reporting_guidelines.id", ondelete="CASCADE"), nullable=False),
            sa.Column("guideline_version", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="IN_PROGRESS"),
            sa.Column("applied_at", sa.String(), nullable=False),
            sa.Column("applied_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("manuscript_version_id", "guideline_id", name="uq_manuscript_guideline_check"),
        )
    if "publication_manuscript_guideline_item_statuses" not in existing:
        op.create_table(
            "publication_manuscript_guideline_item_statuses",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("check_id", sa.String(), sa.ForeignKey("publication_manuscript_guideline_checks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_id", sa.String(), sa.ForeignKey("publication_reporting_guideline_items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="NOT_STARTED"),
            sa.Column("notes", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("check_id", "item_id", name="uq_guideline_item_status"),
        )
    if "publication_references" not in existing:
        op.create_table(
            "publication_references",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("citation_key", sa.String(), nullable=True),
            sa.Column("author", sa.String(), nullable=True),
            sa.Column("title", sa.String(), nullable=True),
            sa.Column("journal", sa.String(), nullable=True),
            sa.Column("year", sa.String(), nullable=True),
            sa.Column("doi", sa.String(), nullable=True),
            sa.Column("doi_canonical", sa.String(), nullable=True),
            sa.Column("volume", sa.String(), nullable=True),
            sa.Column("issue", sa.String(), nullable=True),
            sa.Column("pages", sa.String(), nullable=True),
            sa.Column("publisher", sa.String(), nullable=True),
            sa.Column("reference_type", sa.String(), nullable=False, server_default="JOURNAL_ARTICLE"),
            sa.Column("verification_status", sa.String(), nullable=False, server_default="UNVERIFIED"),
            sa.Column("verified_provider", sa.String(), nullable=True),
            sa.Column("verified_at", sa.String(), nullable=True),
            sa.Column("duplicate_of", sa.String(), sa.ForeignKey("publication_references.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("manuscript_version_id", "doi", name="uq_manuscript_reference_doi"),
        )
        op.create_index("ix_reference_doi_canonical", "publication_references", ["doi_canonical"])
    if "publication_acceptances" not in existing:
        op.create_table(
            "publication_acceptances",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("asset_id", sa.String(), sa.ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False),
            sa.Column("submission_id", sa.String(), sa.ForeignKey("publication_submissions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("manuscript_version_id", sa.String(), sa.ForeignKey("publication_manuscript_versions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("accepted_at", sa.String(), nullable=False),
            sa.Column("evidence", sa.String(), nullable=True),
            sa.Column("recorded_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("submission_id", name="uq_acceptance_submission"),
        )


def downgrade():
    op.drop_table("publication_acceptances")
    op.drop_table("publication_references")
    op.drop_table("publication_manuscript_guideline_item_statuses")
    op.drop_table("publication_manuscript_guideline_checks")
    op.drop_table("publication_reporting_guideline_items")
    op.drop_table("publication_reporting_guidelines")
    op.drop_table("publication_manuscript_authorships")