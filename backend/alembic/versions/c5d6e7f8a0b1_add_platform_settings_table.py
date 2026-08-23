"""add platform_settings table for admin-managed settings and feature flags

Revision ID: c5d6e7f8a0b1
Revises: d6e7f8a9b0c1
Create Date: 2026-08-24 01:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c5d6e7f8a0b1'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'platform_settings',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value_type', sa.String(), nullable=False, server_default='string'),
        sa.Column('value_json', sa.JSON(), nullable=True),
        sa.Column('description_ar', sa.String(), nullable=True),
        sa.Column('description_en', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )
    op.create_index('ix_platform_settings_key', 'platform_settings', ['key'])
    op.create_index('ix_platform_settings_updated_at', 'platform_settings', ['updated_at'])


def downgrade() -> None:
    op.drop_index('ix_platform_settings_updated_at', table_name='platform_settings')
    op.drop_index('ix_platform_settings_key', table_name='platform_settings')
    op.drop_table('platform_settings')