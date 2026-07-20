"""add project measurement plan

Revision ID: e1a4b18c9d2f
Revises: 8322d39fc0aa
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1a4b18c9d2f'
down_revision: Union[str, Sequence[str], None] = '8322d39fc0aa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    columns = {column['name'] for column in sa.inspect(connection).get_columns('research_projects')}
    if 'objectives' not in columns:
        op.add_column('research_projects', sa.Column('objectives', sa.String(), nullable=True))
    if 'timeline' not in columns:
        op.add_column('research_projects', sa.Column('timeline', sa.String(), nullable=True))
    if 'ethics' not in columns:
        op.add_column('research_projects', sa.Column('ethics', sa.String(), nullable=True))
    if 'measurementInstruments' not in columns:
        op.add_column('research_projects', sa.Column('measurementInstruments', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('research_projects') as batch_op:
        batch_op.drop_column('measurementInstruments')
        batch_op.drop_column('ethics')
        batch_op.drop_column('timeline')
        batch_op.drop_column('objectives')