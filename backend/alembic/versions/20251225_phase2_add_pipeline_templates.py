"""add pipeline_templates table

Revision ID: phase2_templates
Revises: 20251224_222220_add_credentials_and_schemas
Create Date: 2025-12-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'phase2_templates'
down_revision: Union[str, None] = '20251224_222220_add_credentials_and_schemas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create pipeline_templates table
    op.create_table(
        'pipeline_templates',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('user_id', sa.String(255), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('transforms', sa.JSON(), nullable=False),
        sa.Column('anomaly_config', sa.JSON(), nullable=False),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create index on user_id for faster lookups
    op.create_index('ix_pipeline_templates_user_id', 'pipeline_templates', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_pipeline_templates_user_id', table_name='pipeline_templates')
    op.drop_table('pipeline_templates')
