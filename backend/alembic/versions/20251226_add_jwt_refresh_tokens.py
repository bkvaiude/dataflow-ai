"""Add JWT refresh tokens table

Revision ID: 20251226_jwt_refresh
Revises: 20251226_add_pipeline_soft_delete
Create Date: 2025-12-26
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '20251226_jwt_refresh'
down_revision = 'add_pipeline_soft_delete'
branch_labels = None
depends_on = None


def upgrade():
    # Create refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('user_id', sa.String(255), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(), default=datetime.utcnow),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), default=False, index=True),
    )

    # Create indexes
    op.create_index('idx_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('idx_refresh_tokens_expires_at', 'refresh_tokens', ['expires_at'])
    op.create_index('idx_refresh_tokens_is_revoked', 'refresh_tokens', ['is_revoked'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_refresh_tokens_is_revoked', 'refresh_tokens')
    op.drop_index('idx_refresh_tokens_expires_at', 'refresh_tokens')
    op.drop_index('idx_refresh_tokens_user_id', 'refresh_tokens')

    # Drop table
    op.drop_table('refresh_tokens')
