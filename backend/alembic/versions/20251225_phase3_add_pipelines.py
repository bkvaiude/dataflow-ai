"""Phase 3: Add pipelines and pipeline_events tables

Revision ID: phase3_pipelines
Revises:
Create Date: 2024-12-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'phase3_pipelines'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create pipelines table
    op.create_table(
        'pipelines',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('user_id', sa.String(255), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),

        # Source configuration
        sa.Column('source_credential_id', sa.String(255), sa.ForeignKey('credentials.id'), nullable=False),
        sa.Column('source_tables', sa.JSON, nullable=False),
        sa.Column('source_connector_name', sa.String(255), nullable=True),

        # Sink configuration
        sa.Column('sink_type', sa.String(50), nullable=False),
        sa.Column('sink_config', sa.JSON, nullable=False),
        sa.Column('sink_connector_name', sa.String(255), nullable=True),

        # Transform template
        sa.Column('template_id', sa.String(255), sa.ForeignKey('pipeline_templates.id', ondelete='SET NULL'), nullable=True),

        # Status tracking
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('last_health_check', sa.DateTime, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),

        # Metrics cache
        sa.Column('metrics_cache', sa.JSON, nullable=True),
        sa.Column('metrics_updated_at', sa.DateTime, nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('stopped_at', sa.DateTime, nullable=True),
    )

    # Create pipeline_events table
    op.create_table(
        'pipeline_events',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('pipeline_id', sa.String(255), sa.ForeignKey('pipelines.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('details', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), index=True),
    )

    # Create composite index for pipeline events lookup
    op.create_index(
        'idx_pipeline_events_lookup',
        'pipeline_events',
        ['pipeline_id', 'created_at']
    )


def downgrade() -> None:
    op.drop_index('idx_pipeline_events_lookup', table_name='pipeline_events')
    op.drop_table('pipeline_events')
    op.drop_table('pipelines')
