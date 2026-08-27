"""add peer review editor assignment and publication exact-version binding

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""
import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {c["name"] for c in sa.inspect(bind).get_columns("peer_review_cases")}
    if "editor_user_id" not in columns:
        op.add_column("peer_review_cases", sa.Column("editor_user_id", sa.String(), nullable=True))
        with op.batch_alter_table("peer_review_cases") as batch_op:
            batch_op.create_foreign_key("fk_peer_review_cases_editor_user_id", "users", ["editor_user_id"], ["id"], ondelete="SET NULL")
    if "manuscript_version_id" not in columns:
        op.add_column("peer_review_cases", sa.Column("manuscript_version_id", sa.String(), nullable=True))
        with op.batch_alter_table("peer_review_cases") as batch_op:
            batch_op.create_foreign_key("fk_peer_review_cases_manuscript_version_id", "publication_manuscript_versions", ["manuscript_version_id"], ["id"], ondelete="SET NULL")
        op.create_index("ix_peer_review_cases_manuscript_version_id", "peer_review_cases", ["manuscript_version_id"])
    if "manuscript_fingerprint" not in columns:
        op.add_column("peer_review_cases", sa.Column("manuscript_fingerprint", sa.String(), nullable=True))
    if "publication_submission_id" not in columns:
        op.add_column("peer_review_cases", sa.Column("publication_submission_id", sa.String(), nullable=True))
        with op.batch_alter_table("peer_review_cases") as batch_op:
            batch_op.create_foreign_key("fk_peer_review_cases_publication_submission_id", "publication_submissions", ["publication_submission_id"], ["id"], ondelete="SET NULL")

    # Reviewer invitation idempotency: NULL columns never conflict with each
    # other under UNIQUE (standard SQL semantics), so an internal-reviewer row
    # (external_email always NULL) never collides with the external-reviewer
    # constraint, and vice versa — each half only guards its own reviewer type.
    existing_constraints = {c["name"] for c in sa.inspect(bind).get_unique_constraints("reviewer_assignments")}
    if "uq_reviewer_assignment_internal" not in existing_constraints:
        with op.batch_alter_table("reviewer_assignments") as batch_op:
            batch_op.create_unique_constraint("uq_reviewer_assignment_internal", ["round_id", "reviewer_user_id"])
    if "uq_reviewer_assignment_external" not in existing_constraints:
        with op.batch_alter_table("reviewer_assignments") as batch_op:
            batch_op.create_unique_constraint("uq_reviewer_assignment_external", ["round_id", "external_email"])

    revision_constraints = {c["name"] for c in sa.inspect(bind).get_unique_constraints("manuscript_revisions")}
    if "uq_manuscript_revision_version" not in revision_constraints:
        with op.batch_alter_table("manuscript_revisions") as batch_op:
            batch_op.create_unique_constraint("uq_manuscript_revision_version", ["case_id", "version_number"])


def downgrade():
    with op.batch_alter_table("manuscript_revisions") as batch_op:
        batch_op.drop_constraint("uq_manuscript_revision_version", type_="unique")
    with op.batch_alter_table("reviewer_assignments") as batch_op:
        batch_op.drop_constraint("uq_reviewer_assignment_external", type_="unique")
        batch_op.drop_constraint("uq_reviewer_assignment_internal", type_="unique")
    with op.batch_alter_table("peer_review_cases") as batch_op:
        batch_op.drop_constraint("fk_peer_review_cases_publication_submission_id", type_="foreignkey")
        batch_op.drop_constraint("fk_peer_review_cases_manuscript_version_id", type_="foreignkey")
        batch_op.drop_constraint("fk_peer_review_cases_editor_user_id", type_="foreignkey")
    op.drop_index("ix_peer_review_cases_manuscript_version_id", table_name="peer_review_cases")
    op.drop_column("peer_review_cases", "publication_submission_id")
    op.drop_column("peer_review_cases", "manuscript_fingerprint")
    op.drop_column("peer_review_cases", "manuscript_version_id")
    op.drop_column("peer_review_cases", "editor_user_id")
