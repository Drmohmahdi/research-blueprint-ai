"""add project ethics plan

Revision ID: a3c6d40e1f2b
Revises: f2b5c29d0e3a
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c6d40e1f2b'
down_revision: Union[str, Sequence[str], None] = 'f2b5c29d0e3a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    columns = {column['name'] for column in sa.inspect(connection).get_columns('research_projects')}
    if 'ethicsFeasibilityPlan' not in columns:
        op.add_column('research_projects', sa.Column('ethicsFeasibilityPlan', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('research_projects') as batch_op:
        batch_op.drop_column('ethicsFeasibilityPlan')