"""add academic promotion engine tables and schema

Revision ID: d7f1b2c3e4a5
Revises: c5e8a91f3b4d
Create Date: 2026-08-22 19:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7f1b2c3e4a5'
down_revision: Union[str, Sequence[str], None] = 'c5e8a91f3b4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    # 1. Create promotion_policies
    if 'promotion_policies' not in existing_tables:
        op.create_table(
            'promotion_policies',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name_ar', sa.String(), nullable=False),
            sa.Column('name_en', sa.String(), nullable=False),
            sa.Column('description_ar', sa.String(), nullable=True),
            sa.Column('description_en', sa.String(), nullable=True),
            sa.Column('target_rank', sa.String(), nullable=False),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('status', sa.String(), server_default='ACTIVE', nullable=False),
            sa.Column('is_default', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('rules_json', sa.JSON(), nullable=True),
            sa.Column('created_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
        )
        op.create_index('ix_promotion_policies_id', 'promotion_policies', ['id'])
        op.create_index('ix_promotion_policies_organization_id', 'promotion_policies', ['organization_id'])
        op.create_index('ix_promotion_policies_target_rank', 'promotion_policies', ['target_rank'])

    # 2. Create promotion_criteria
    if 'promotion_criteria' not in existing_tables:
        op.create_table(
            'promotion_criteria',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('policy_id', sa.String(), sa.ForeignKey('promotion_policies.id', ondelete='CASCADE'), nullable=False),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('code', sa.String(), nullable=False),
            sa.Column('title_ar', sa.String(), nullable=False),
            sa.Column('title_en', sa.String(), nullable=False),
            sa.Column('criterion_type', sa.String(), server_default='RESEARCH_OUTPUT', nullable=False),
            sa.Column('required_points', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('min_asset_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('rule_definition_json', sa.JSON(), nullable=False),
            sa.Column('weight', sa.Float(), server_default='1.0', nullable=False),
            sa.Column('is_mandatory', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('sort_order', sa.Integer(), server_default='1', nullable=False),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_promotion_criteria_id', 'promotion_criteria', ['id'])
        op.create_index('ix_promotion_criteria_policy_id', 'promotion_criteria', ['policy_id'])
        op.create_index('ix_promotion_criteria_organization_id', 'promotion_criteria', ['organization_id'])

    # 3. Create promotion_applications
    if 'promotion_applications' not in existing_tables:
        op.create_table(
            'promotion_applications',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('policy_id', sa.String(), sa.ForeignKey('promotion_policies.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('policy_version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('current_rank', sa.String(), nullable=True),
            sa.Column('target_rank', sa.String(), nullable=False),
            sa.Column('status', sa.String(), server_default='DRAFT', nullable=False),
            sa.Column('readiness_percentage', sa.Integer(), server_default='0', nullable=False),
            sa.Column('total_calculated_points', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('evaluation_summary_json', sa.JSON(), nullable=True),
            sa.Column('evaluation_fingerprint', sa.String(), nullable=True),
            sa.Column('human_review_decision', sa.String(), nullable=True),
            sa.Column('human_review_notes', sa.String(), nullable=True),
            sa.Column('reviewer_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('reviewed_at', sa.String(), nullable=True),
            sa.Column('submitted_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
        )
        op.create_index('ix_promotion_applications_id', 'promotion_applications', ['id'])
        op.create_index('ix_promotion_applications_organization_id', 'promotion_applications', ['organization_id'])
        op.create_index('ix_promotion_applications_user_id', 'promotion_applications', ['user_id'])
        op.create_index('ix_promotion_applications_policy_id', 'promotion_applications', ['policy_id'])

    # 4. Create promotion_evaluation_snapshots
    if 'promotion_evaluation_snapshots' not in existing_tables:
        op.create_table(
            'promotion_evaluation_snapshots',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('application_id', sa.String(), sa.ForeignKey('promotion_applications.id', ondelete='CASCADE'), nullable=False),
            sa.Column('policy_id', sa.String(), sa.ForeignKey('promotion_policies.id', ondelete='SET NULL'), nullable=True),
            sa.Column('policy_version', sa.Integer(), nullable=False),
            sa.Column('readiness_percentage', sa.Integer(), nullable=False),
            sa.Column('total_points', sa.Float(), nullable=False),
            sa.Column('criteria_results_json', sa.JSON(), nullable=False),
            sa.Column('evaluation_fingerprint', sa.String(), nullable=False),
            sa.Column('evaluated_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('evaluated_at', sa.String(), nullable=False),
        )
        op.create_index('ix_promotion_evaluation_snapshots_id', 'promotion_evaluation_snapshots', ['id'])
        op.create_index('ix_promotion_evaluation_snapshots_application_id', 'promotion_evaluation_snapshots', ['application_id'])

    # 5. Extend core_promotion_asset_selections columns if needed
    if 'core_promotion_asset_selections' in existing_tables:
        existing_cols = {c['name'] for c in inspector.get_columns('core_promotion_asset_selections')}
        with op.batch_alter_table('core_promotion_asset_selections', schema=None) as batch_op:
            if 'criterion_id' not in existing_cols:
                batch_op.add_column(sa.Column('criterion_id', sa.String(), nullable=True))
            if 'evidence_snapshot_json' not in existing_cols:
                batch_op.add_column(sa.Column('evidence_snapshot_json', sa.JSON(), nullable=True))
            if 'verification_status' not in existing_cols:
                batch_op.add_column(sa.Column('verification_status', sa.String(), server_default='UNVERIFIED', nullable=True))
            if 'created_at' not in existing_cols:
                batch_op.add_column(sa.Column('created_at', sa.String(), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    if 'promotion_evaluation_snapshots' in existing_tables:
        op.drop_index('ix_promotion_evaluation_snapshots_application_id', table_name='promotion_evaluation_snapshots')
        op.drop_index('ix_promotion_evaluation_snapshots_id', table_name='promotion_evaluation_snapshots')
        op.drop_table('promotion_evaluation_snapshots')

    if 'promotion_applications' in existing_tables:
        op.drop_index('ix_promotion_applications_policy_id', table_name='promotion_applications')
        op.drop_index('ix_promotion_applications_user_id', table_name='promotion_applications')
        op.drop_index('ix_promotion_applications_organization_id', table_name='promotion_applications')
        op.drop_index('ix_promotion_applications_id', table_name='promotion_applications')
        op.drop_table('promotion_applications')

    if 'promotion_criteria' in existing_tables:
        op.drop_index('ix_promotion_criteria_organization_id', table_name='promotion_criteria')
        op.drop_index('ix_promotion_criteria_policy_id', table_name='promotion_criteria')
        op.drop_index('ix_promotion_criteria_id', table_name='promotion_criteria')
        op.drop_table('promotion_criteria')

    if 'promotion_policies' in existing_tables:
        op.drop_index('ix_promotion_policies_target_rank', table_name='promotion_policies')
        op.drop_index('ix_promotion_policies_organization_id', table_name='promotion_policies')
        op.drop_index('ix_promotion_policies_id', table_name='promotion_policies')
        op.drop_table('promotion_policies')
