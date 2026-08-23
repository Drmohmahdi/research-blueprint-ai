"""add ai_runs table for governed academic AI audit

Revision ID: b4c5d6e7f8a0
Revises: a3b4c5d6e7f8
Create Date: 2026-08-23 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b4c5d6e7f8a0'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_runs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('use_case', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('prompt_version', sa.Integer(), nullable=True),
        sa.Column('input_token_count', sa.Integer(), nullable=True),
        sa.Column('output_token_count', sa.Integer(), nullable=True),
        sa.Column('estimated_tokens', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='COMPLETED'),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('retrieval_count', sa.Integer(), nullable=True),
        sa.Column('idempotency_key', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ai_runs_id', 'ai_runs', ['id'])
    op.create_index('ix_ai_runs_org', 'ai_runs', ['organization_id'])
    op.create_index('ix_ai_runs_user', 'ai_runs', ['user_id'])
    op.create_index('ix_ai_runs_use_case', 'ai_runs', ['use_case'])
    op.create_index('ix_ai_runs_idempotency_key', 'ai_runs', ['idempotency_key'])
    op.create_index('ix_ai_runs_created_at', 'ai_runs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_ai_runs_created_at', table_name='ai_runs')
    op.drop_index('ix_ai_runs_idempotency_key', table_name='ai_runs')
    op.drop_index('ix_ai_runs_use_case', table_name='ai_runs')
    op.drop_index('ix_ai_runs_user', table_name='ai_runs')
    op.drop_index('ix_ai_runs_org', table_name='ai_runs')
    op.drop_index('ix_ai_runs_id', table_name='ai_runs')
    op.drop_table('ai_runs')