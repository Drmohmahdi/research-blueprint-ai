"""add preregistration history

Revision ID: b4d7e51f2a3c
Revises: a3c6d40e1f2b
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4d7e51f2a3c'
down_revision: Union[str, Sequence[str], None] = 'a3c6d40e1f2b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    columns = {column['name'] for column in sa.inspect(connection).get_columns('research_projects')}
    if 'preRegistrationHistory' not in columns:
        op.add_column('research_projects', sa.Column('preRegistrationHistory', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('research_projects') as batch_op:
        batch_op.drop_column('preRegistrationHistory')