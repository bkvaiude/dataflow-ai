"""add_processing_history_table

Revision ID: 9b0255c1cbef
Revises: 
Create Date: 2025-12-24 18:36:19.999282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b0255c1cbef'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'processing_history',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('user_id', sa.String(255), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('connector_id', sa.String(50), nullable=False),
        sa.Column('customer_id', sa.String(100), nullable=True),
        sa.Column('date_range', sa.String(100), nullable=True),
        sa.Column('campaigns_count', sa.Integer, nullable=False, default=0),
        sa.Column('processed_at', sa.DateTime, nullable=True, index=True),
        sa.Column('batch_id', sa.String(255), nullable=True),
        sa.Column('reprocessed', sa.Boolean, default=False),
        sa.Column('metadata_json', sa.JSON, nullable=True),
    )
    op.create_index('idx_processing_lookup', 'processing_history', ['user_id', 'connector_id', 'processed_at'])


def downgrade() -> None:
    op.drop_index('idx_processing_lookup', table_name='processing_history')
    op.drop_table('processing_history')
