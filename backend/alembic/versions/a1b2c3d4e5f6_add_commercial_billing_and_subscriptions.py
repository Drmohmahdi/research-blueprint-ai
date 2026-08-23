"""add commercial billing and subscriptions

Revision ID: a1b2c3d4e5f6
Revises: f9b3c4d5e6a7
Create Date: 2026-08-23 00:46:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f9b3c4d5e6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Augment Existing Tables with Commercial / Minor Units columns
    with op.batch_alter_table('plans') as batch_op:
        batch_op.add_column(sa.Column('name_ar', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('name_en', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('description_ar', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('description_en', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('price_minor_units', sa.Integer(), nullable=False, server_default='0'))

    with op.batch_alter_table('subscriptions') as batch_op:
        batch_op.add_column(sa.Column('plan_price_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('unit_amount_minor_units', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('currency', sa.String(), nullable=False, server_default='SAR'))
        batch_op.add_column(sa.Column('billing_interval', sa.String(), nullable=False, server_default='MONTHLY'))

    with op.batch_alter_table('invoices') as batch_op:
        batch_op.add_column(sa.Column('amount_subtotal_minor_units', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('tax_rate_basis_points', sa.Integer(), nullable=False, server_default='1500'))
        batch_op.add_column(sa.Column('amount_tax_minor_units', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('amount_total_minor_units', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('pdf_asset_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('seller_snapshot_json', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('buyer_snapshot_json', sa.JSON(), nullable=True))

    # 2. New Tables for Commercial SaaS
    op.create_table(
        'commercial_plan_prices',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('plan_id', sa.String(), nullable=False),
        sa.Column('billing_interval', sa.String(), nullable=False, server_default='MONTHLY'),
        sa.Column('price_minor_units', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(), nullable=False, server_default='SAR'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('provider_price_ref', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_commercial_plan_prices_id'), 'commercial_plan_prices', ['id'], unique=False)
    op.create_index(op.f('ix_commercial_plan_prices_plan_id'), 'commercial_plan_prices', ['plan_id'], unique=False)

    op.create_table(
        'commercial_plan_entitlements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('plan_id', sa.String(), nullable=False),
        sa.Column('feature_key', sa.String(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('limit_value', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'feature_key', name='uq_plan_feature_entitlement')
    )
    op.create_index(op.f('ix_commercial_plan_entitlements_id'), 'commercial_plan_entitlements', ['id'], unique=False)
    op.create_index(op.f('ix_commercial_plan_entitlements_plan_id'), 'commercial_plan_entitlements', ['plan_id'], unique=False)
    op.create_index(op.f('ix_commercial_plan_entitlements_feature_key'), 'commercial_plan_entitlements', ['feature_key'], unique=False)

    op.create_table(
        'commercial_invoice_lines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('invoice_id', sa.String(), nullable=False),
        sa.Column('description_ar', sa.String(), nullable=False),
        sa.Column('description_en', sa.String(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('unit_amount_minor_units', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('line_total_minor_units', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_commercial_invoice_lines_id'), 'commercial_invoice_lines', ['id'], unique=False)
    op.create_index(op.f('ix_commercial_invoice_lines_invoice_id'), 'commercial_invoice_lines', ['invoice_id'], unique=False)

    op.create_table(
        'payment_transactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('invoice_id', sa.String(), nullable=True),
        sa.Column('provider', sa.String(), nullable=False, server_default='NULL_ADAPTER'),
        sa.Column('provider_transaction_ref', sa.String(), nullable=True),
        sa.Column('amount_minor_units', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default='SAR'),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('failure_code', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('confirmed_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_transactions_id'), 'payment_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_payment_transactions_organization_id'), 'payment_transactions', ['organization_id'], unique=False)
    op.create_index(op.f('ix_payment_transactions_invoice_id'), 'payment_transactions', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_payment_transactions_provider_transaction_ref'), 'payment_transactions', ['provider_transaction_ref'], unique=True)
    op.create_index(op.f('ix_payment_transactions_status'), 'payment_transactions', ['status'], unique=False)

    op.create_table(
        'payment_webhook_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_event_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('received_at', sa.String(), nullable=False),
        sa.Column('processed_at', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='RECEIVED'),
        sa.Column('signature_valid', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('error_details', sa.String(), nullable=True),
        sa.Column('payload_summary_json', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider_event_id', name='uq_payment_webhook_provider_event')
    )
    op.create_index(op.f('ix_payment_webhook_events_id'), 'payment_webhook_events', ['id'], unique=False)
    op.create_index(op.f('ix_payment_webhook_events_provider'), 'payment_webhook_events', ['provider'], unique=False)
    op.create_index(op.f('ix_payment_webhook_events_event_type'), 'payment_webhook_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_payment_webhook_events_status'), 'payment_webhook_events', ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('payment_webhook_events')
    op.drop_table('payment_transactions')
    op.drop_table('commercial_invoice_lines')
    op.drop_table('commercial_plan_entitlements')
    op.drop_table('commercial_plan_prices')

    with op.batch_alter_table('invoices') as batch_op:
        batch_op.drop_column('buyer_snapshot_json')
        batch_op.drop_column('seller_snapshot_json')
        batch_op.drop_column('pdf_asset_id')
        batch_op.drop_column('amount_total_minor_units')
        batch_op.drop_column('amount_tax_minor_units')
        batch_op.drop_column('tax_rate_basis_points')
        batch_op.drop_column('amount_subtotal_minor_units')

    with op.batch_alter_table('subscriptions') as batch_op:
        batch_op.drop_column('billing_interval')
        batch_op.drop_column('currency')
        batch_op.drop_column('unit_amount_minor_units')
        batch_op.drop_column('plan_price_id')

    with op.batch_alter_table('plans') as batch_op:
        batch_op.drop_column('price_minor_units')
        batch_op.drop_column('description_en')
        batch_op.drop_column('description_ar')
        batch_op.drop_column('name_en')
        batch_op.drop_column('name_ar')
