"""Add demo_requests table

Revision ID: 20251231_demo_requests
Revises:
Create Date: 2025-12-31

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251231_demo_requests'
down_revision = '8173f94ee140'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'demo_requests',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, index=True),
        sa.Column('company', sa.String(255), nullable=False),
        sa.Column('role', sa.String(255), nullable=True),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now(), index=True),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('demo_requests')
