"""Phase 5: Add alert_rules and alert_history tables for anomaly alerting

Revision ID: phase5_alerts
Revises:
Create Date: 2024-12-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'phase5_alerts'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create alert_rules table
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('user_id', sa.String(255), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('pipeline_id', sa.String(255), sa.ForeignKey('pipelines.id', ondelete='CASCADE'), nullable=True, index=True),

        # Alert configuration
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('rule_type', sa.String(50), nullable=False),  # volume_spike, volume_drop, gap_detection, null_ratio
        sa.Column('threshold_config', sa.JSON, nullable=False),

        # Schedule constraints
        sa.Column('enabled_days', sa.JSON, server_default='[4]'),  # [4] = Friday only
        sa.Column('enabled_hours', sa.JSON, nullable=True),
        sa.Column('cooldown_minutes', sa.Integer, server_default='30'),

        # Alert settings
        sa.Column('severity', sa.String(20), server_default='warning'),
        sa.Column('recipients', sa.JSON, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),

        # Tracking
        sa.Column('last_triggered_at', sa.DateTime, nullable=True),
        sa.Column('trigger_count', sa.Integer, server_default='0'),

        # Timestamps
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create index for user/pipeline lookup
    op.create_index('idx_alert_rules_user_pipeline', 'alert_rules', ['user_id', 'pipeline_id'])

    # Create alert_history table
    op.create_table(
        'alert_history',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('rule_id', sa.String(255), sa.ForeignKey('alert_rules.id', ondelete='CASCADE'), nullable=False, index=True),

        # Alert details
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('details', sa.JSON, nullable=True),

        # Email tracking
        sa.Column('email_sent', sa.Boolean, server_default='false'),
        sa.Column('email_sent_at', sa.DateTime, nullable=True),
        sa.Column('email_recipients', sa.JSON, nullable=True),
        sa.Column('email_error', sa.Text, nullable=True),

        # Timestamps
        sa.Column('triggered_at', sa.DateTime, server_default=sa.func.now(), index=True),
    )

    # Create index for rule/time lookup
    op.create_index('idx_alert_history_rule_time', 'alert_history', ['rule_id', 'triggered_at'])


def downgrade() -> None:
    op.drop_index('idx_alert_history_rule_time', 'alert_history')
    op.drop_table('alert_history')
    op.drop_index('idx_alert_rules_user_pipeline', 'alert_rules')
    op.drop_table('alert_rules')
