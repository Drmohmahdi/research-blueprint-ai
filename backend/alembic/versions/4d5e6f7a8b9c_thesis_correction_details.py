"""add thesis correction operational details

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
"""
import sqlalchemy as sa
from alembic import op

revision = "4d5e6f7a8b9c"
down_revision = "3c4d5e6f7a8b"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("thesis_corrections")}
    if "details_json" not in columns:
        default = sa.text("'{}'::json") if bind.dialect.name == "postgresql" else sa.text("'{}'")
        op.add_column(
            "thesis_corrections",
            sa.Column("details_json", sa.JSON(), nullable=False, server_default=default),
        )
    uniques = {constraint["name"] for constraint in inspector.get_unique_constraints("thesis_final_versions")}
    indexes = {index["name"] for index in inspector.get_indexes("thesis_final_versions")}
    if "uq_thesis_final_version_type" not in uniques and "uq_thesis_final_version_type" not in indexes:
        op.create_unique_constraint("uq_thesis_final_version_type", "thesis_final_versions", ["thesis_id", "version_type"])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    uniques = {constraint["name"] for constraint in inspector.get_unique_constraints("thesis_final_versions")}
    if "uq_thesis_final_version_type" in uniques:
        op.drop_constraint("uq_thesis_final_version_type", "thesis_final_versions", type_="unique")
    columns = {column["name"] for column in inspector.get_columns("thesis_corrections")}
    if "details_json" in columns:
        op.drop_column("thesis_corrections", "details_json")
