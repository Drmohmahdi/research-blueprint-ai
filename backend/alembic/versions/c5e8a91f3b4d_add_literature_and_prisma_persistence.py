"""add literature and prisma persistence tables

Revision ID: c5e8a91f3b4d
Revises: b4d7e51f2a3c
Create Date: 2026-08-22 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e8a91f3b4d'
down_revision: Union[str, Sequence[str], None] = 'b4d7e51f2a3c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    if 'project_literature_studies' not in existing_tables:
        op.create_table(
            'project_literature_studies',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('projectId', sa.String(), sa.ForeignKey('research_projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('organizationId', sa.String(), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
            sa.Column('author', sa.String(), nullable=False),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('sampleSize', sa.Integer(), nullable=False),
            sa.Column('effectSize', sa.Float(), nullable=False),
            sa.Column('ciLower', sa.Float(), nullable=False),
            sa.Column('ciUpper', sa.Float(), nullable=False),
            sa.Column('source', sa.String(), server_default='manual', nullable=True),
            sa.Column('doi', sa.String(), nullable=True),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('createdAt', sa.String(), nullable=False),
            sa.Column('updatedAt', sa.String(), nullable=False),
        )
        op.create_index('ix_project_literature_studies_id', 'project_literature_studies', ['id'])
        op.create_index('ix_project_literature_studies_projectId', 'project_literature_studies', ['projectId'])
        op.create_index('ix_project_literature_studies_organizationId', 'project_literature_studies', ['organizationId'])

    if 'project_prisma_flows' not in existing_tables:
        op.create_table(
            'project_prisma_flows',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('projectId', sa.String(), sa.ForeignKey('research_projects.id', ondelete='CASCADE'), unique=True, nullable=False),
            sa.Column('organizationId', sa.String(), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
            sa.Column('identified', sa.Integer(), server_default='0', nullable=False),
            sa.Column('duplicates', sa.Integer(), server_default='0', nullable=False),
            sa.Column('excludedScreening', sa.Integer(), server_default='0', nullable=False),
            sa.Column('excludedEligibility', sa.Integer(), server_default='0', nullable=False),
            sa.Column('source', sa.String(), server_default='manual', nullable=True),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('createdAt', sa.String(), nullable=False),
            sa.Column('updatedAt', sa.String(), nullable=False),
        )
        op.create_index('ix_project_prisma_flows_id', 'project_prisma_flows', ['id'])
        op.create_index('ix_project_prisma_flows_projectId', 'project_prisma_flows', ['projectId'])
        op.create_index('ix_project_prisma_flows_organizationId', 'project_prisma_flows', ['organizationId'])


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    if 'project_prisma_flows' in existing_tables:
        op.drop_table('project_prisma_flows')

    if 'project_literature_studies' in existing_tables:
        op.drop_table('project_literature_studies')
