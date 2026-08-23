"""add search text columns and indexes for unified search

Revision ID: a3b4c5d6e7f8
Revises: f6a7b8c9d0e1
Create Date: 2026-08-23 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add normalized search_text columns for Unified Search domains
    with op.batch_alter_table('research_projects') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_research_projects_search_text', ['search_text'])

    with op.batch_alter_table('project_literature_studies') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_literature_studies_search_text', ['search_text'])
        batch_op.create_index('ix_literature_studies_org_year', ['organizationId', 'year'])

    with op.batch_alter_table('core_scholarly_assets') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_scholarly_assets_search_text', ['search_text'])
        batch_op.create_index('ix_scholarly_assets_org_asset_type', ['organization_id', 'asset_type'])

    with op.batch_alter_table('core_unified_academic_profiles') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_profiles_search_text', ['search_text'])
        batch_op.create_index('ix_profiles_org_visibility', ['organization_id', 'visibility_status'])

    with op.batch_alter_table('promotion_applications') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_promotion_search_text', ['search_text'])
        batch_op.create_index('ix_promotion_org_status', ['organization_id', 'status'])

    with op.batch_alter_table('peer_review_cases') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_peer_review_search_text', ['search_text'])
        batch_op.create_index('ix_peer_review_org_status', ['organization_id', 'status'])

    with op.batch_alter_table('uploaded_files') as batch_op:
        batch_op.add_column(sa.Column('search_text', sa.String(), nullable=True))
        batch_op.create_index('ix_uploaded_files_search_text', ['search_text'])

    # 2. Backfill existing records with normalized search_text
    import sys
    import os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from app.services.search.normalization import normalize_search_text
    from app.services.search.backfill import backfill_all_search_text

    conn = op.get_bind()
    backfill_all_search_text(conn, normalize_search_text)


def downgrade() -> None:
    with op.batch_alter_table('uploaded_files') as batch_op:
        batch_op.drop_index('ix_uploaded_files_search_text')
        batch_op.drop_column('search_text')

    with op.batch_alter_table('peer_review_cases') as batch_op:
        batch_op.drop_index('ix_peer_review_org_status')
        batch_op.drop_index('ix_peer_review_search_text')
        batch_op.drop_column('search_text')

    with op.batch_alter_table('promotion_applications') as batch_op:
        batch_op.drop_index('ix_promotion_org_status')
        batch_op.drop_index('ix_promotion_search_text')
        batch_op.drop_column('search_text')

    with op.batch_alter_table('core_unified_academic_profiles') as batch_op:
        batch_op.drop_index('ix_profiles_org_visibility')
        batch_op.drop_index('ix_profiles_search_text')
        batch_op.drop_column('search_text')

    with op.batch_alter_table('core_scholarly_assets') as batch_op:
        batch_op.drop_index('ix_scholarly_assets_org_asset_type')
        batch_op.drop_index('ix_scholarly_assets_search_text')
        batch_op.drop_column('search_text')

    with op.batch_alter_table('project_literature_studies') as batch_op:
        batch_op.drop_index('ix_literature_studies_org_year')
        batch_op.drop_index('ix_literature_studies_search_text')
        batch_op.drop_column('search_text')

    with op.batch_alter_table('research_projects') as batch_op:
        batch_op.drop_index('ix_research_projects_search_text')
        batch_op.drop_column('search_text')
