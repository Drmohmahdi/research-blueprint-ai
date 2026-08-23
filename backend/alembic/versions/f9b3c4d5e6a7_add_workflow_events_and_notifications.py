"""add workflow events and notifications tables

Revision ID: f9b3c4d5e6a7
Revises: e8a2b3c4d5f6
Create Date: 2026-08-23 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9b3c4d5e6a7'
down_revision: Union[str, Sequence[str], None] = 'e8a2b3c4d5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    # 1. Create workflow_events
    if 'workflow_events' not in existing_tables:
        op.create_table(
            'workflow_events',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('event_type', sa.String(), nullable=False),
            sa.Column('aggregate_type', sa.String(), nullable=False),
            sa.Column('aggregate_id', sa.String(), nullable=False),
            sa.Column('actor_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('payload_json', sa.JSON(), nullable=False),
            sa.Column('idempotency_key', sa.String(), nullable=False),
            sa.Column('status', sa.String(), server_default='PENDING', nullable=False),
            sa.Column('attempt_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('next_attempt_at', sa.String(), nullable=True),
            sa.Column('occurred_at', sa.String(), nullable=False),
            sa.Column('processed_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.UniqueConstraint('idempotency_key', name='uq_workflow_events_idempotency_key')
        )
        op.create_index('ix_workflow_events_id', 'workflow_events', ['id'])
        op.create_index('ix_workflow_events_organization_id', 'workflow_events', ['organization_id'])
        op.create_index('ix_workflow_events_event_type', 'workflow_events', ['event_type'])
        op.create_index('ix_workflow_events_aggregate_type', 'workflow_events', ['aggregate_type'])
        op.create_index('ix_workflow_events_aggregate_id', 'workflow_events', ['aggregate_id'])
        op.create_index('ix_workflow_events_actor_user_id', 'workflow_events', ['actor_user_id'])
        op.create_index('ix_workflow_events_idempotency_key', 'workflow_events', ['idempotency_key'])
        op.create_index('ix_workflow_events_status', 'workflow_events', ['status'])

    # 2. Create notifications
    if 'notifications' not in existing_tables:
        op.create_table(
            'notifications',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('recipient_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('workflow_event_id', sa.String(), sa.ForeignKey('workflow_events.id', ondelete='SET NULL'), nullable=True),
            sa.Column('category', sa.String(), nullable=False),
            sa.Column('title_ar', sa.String(), nullable=False),
            sa.Column('title_en', sa.String(), nullable=False),
            sa.Column('message_ar', sa.String(), nullable=False),
            sa.Column('message_en', sa.String(), nullable=False),
            sa.Column('target_type', sa.String(), nullable=True),
            sa.Column('target_id', sa.String(), nullable=True),
            sa.Column('read_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_notifications_id', 'notifications', ['id'])
        op.create_index('ix_notifications_organization_id', 'notifications', ['organization_id'])
        op.create_index('ix_notifications_recipient_user_id', 'notifications', ['recipient_user_id'])
        op.create_index('ix_notifications_workflow_event_id', 'notifications', ['workflow_event_id'])
        op.create_index('ix_notifications_category', 'notifications', ['category'])
        op.create_index('ix_notifications_read_at', 'notifications', ['read_at'])
        op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # 3. Create notification_preferences
    if 'notification_preferences' not in existing_tables:
        op.create_table(
            'notification_preferences',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('category', sa.String(), nullable=False),
            sa.Column('in_app_enabled', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('email_enabled', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.UniqueConstraint('user_id', 'organization_id', 'category', name='uq_user_org_category_pref')
        )
        op.create_index('ix_notification_preferences_id', 'notification_preferences', ['id'])
        op.create_index('ix_notification_preferences_user_id', 'notification_preferences', ['user_id'])
        op.create_index('ix_notification_preferences_organization_id', 'notification_preferences', ['organization_id'])
        op.create_index('ix_notification_preferences_category', 'notification_preferences', ['category'])

    # 4. Create notification_deliveries
    if 'notification_deliveries' not in existing_tables:
        op.create_table(
            'notification_deliveries',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('notification_id', sa.String(), sa.ForeignKey('notifications.id', ondelete='SET NULL'), nullable=True),
            sa.Column('workflow_event_id', sa.String(), sa.ForeignKey('workflow_events.id', ondelete='CASCADE'), nullable=False),
            sa.Column('channel', sa.String(), nullable=False),
            sa.Column('recipient_address', sa.String(), nullable=True),
            sa.Column('status', sa.String(), server_default='DELIVERED', nullable=False),
            sa.Column('attempt_count', sa.Integer(), server_default='1', nullable=False),
            sa.Column('last_attempt_at', sa.String(), nullable=True),
            sa.Column('failure_code', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_notification_deliveries_id', 'notification_deliveries', ['id'])
        op.create_index('ix_notification_deliveries_organization_id', 'notification_deliveries', ['organization_id'])
        op.create_index('ix_notification_deliveries_notification_id', 'notification_deliveries', ['notification_id'])
        op.create_index('ix_notification_deliveries_workflow_event_id', 'notification_deliveries', ['workflow_event_id'])
        op.create_index('ix_notification_deliveries_status', 'notification_deliveries', ['status'])


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    if 'notification_deliveries' in existing_tables:
        op.drop_table('notification_deliveries')
    if 'notification_preferences' in existing_tables:
        op.drop_table('notification_preferences')
    if 'notifications' in existing_tables:
        op.drop_table('notifications')
    if 'workflow_events' in existing_tables:
        op.drop_table('workflow_events')
