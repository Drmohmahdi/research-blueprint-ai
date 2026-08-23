"""add storage quota usage atomic counter

Revision ID: f6a7b8c9d0e1
Revises: a1b2c3d4e5f6
Create Date: 2026-08-23 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'storage_quota_usage',
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('used_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('organization_id'),
    )
    op.create_index('ix_storage_quota_usage_organization_id', 'storage_quota_usage', ['organization_id'])


def downgrade() -> None:
    op.drop_index('ix_storage_quota_usage_organization_id', table_name='storage_quota_usage')
    op.drop_table('storage_quota_usage')
