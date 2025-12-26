"""Phase 4: Add enrichment_configs table for ksqlDB stream enrichments

Revision ID: phase4_enrichment
Revises:
Create Date: 2024-12-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'phase4_enrichment'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enrichment_configs table
    op.create_table(
        'enrichment_configs',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('pipeline_id', sa.String(255), sa.ForeignKey('pipelines.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', sa.String(255), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),

        # Enrichment name
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),

        # Source Stream
        sa.Column('source_stream_name', sa.String(255), nullable=False),
        sa.Column('source_topic', sa.String(255), nullable=False),

        # Lookup Tables (JSON array)
        sa.Column('lookup_tables', sa.JSON, nullable=False),

        # Join Configuration
        sa.Column('join_type', sa.String(50), server_default='LEFT'),
        sa.Column('join_keys', sa.JSON, nullable=False),
        sa.Column('output_columns', sa.JSON, nullable=False),

        # Output
        sa.Column('output_stream_name', sa.String(255), nullable=False),
        sa.Column('output_topic', sa.String(255), nullable=False),

        # ksqlDB Query ID (for management)
        sa.Column('ksqldb_query_id', sa.String(255), nullable=True),

        # Status
        sa.Column('status', sa.String(50), server_default='pending'),

        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('activated_at', sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table('enrichment_configs')
