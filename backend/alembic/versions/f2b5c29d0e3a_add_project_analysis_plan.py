"""add project analysis plan

Revision ID: f2b5c29d0e3a
Revises: e1a4b18c9d2f
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2b5c29d0e3a'
down_revision: Union[str, Sequence[str], None] = 'e1a4b18c9d2f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    columns = {column['name'] for column in sa.inspect(connection).get_columns('research_projects')}
    if 'hypothesisAnalysisPlans' not in columns:
        op.add_column('research_projects', sa.Column('hypothesisAnalysisPlans', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('research_projects') as batch_op:
        batch_op.drop_column('hypothesisAnalysisPlans')