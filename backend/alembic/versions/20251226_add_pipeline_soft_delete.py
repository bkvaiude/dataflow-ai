"""Add deleted_at column to pipelines for soft delete

Revision ID: add_pipeline_soft_delete
Revises: phase5_alerts
Create Date: 2024-12-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_pipeline_soft_delete'
down_revision = 'phase5_alerts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add deleted_at column for soft delete
    op.add_column('pipelines', sa.Column('deleted_at', sa.DateTime, nullable=True))

    # Add index for filtering active pipelines
    op.create_index('idx_pipelines_deleted_at', 'pipelines', ['deleted_at'])


def downgrade() -> None:
    op.drop_index('idx_pipelines_deleted_at', 'pipelines')
    op.drop_column('pipelines', 'deleted_at')
