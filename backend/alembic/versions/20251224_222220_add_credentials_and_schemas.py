"""add credentials and schemas

Revision ID: 20251224_222220
Revises: 9b0255c1cbef
Create Date: 2025-12-24 22:22:20.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251224_222220'
down_revision: Union[str, None] = '9b0255c1cbef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create credentials table
    op.create_table(
        'credentials',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('encrypted_credentials', sa.LargeBinary(), nullable=False),
        sa.Column('encryption_iv', sa.LargeBinary(), nullable=False),
        sa.Column('encryption_tag', sa.LargeBinary(), nullable=False),
        sa.Column('host', sa.String(length=255), nullable=True),
        sa.Column('database', sa.String(length=255), nullable=True),
        sa.Column('port', sa.Integer(), nullable=True),
        sa.Column('is_valid', sa.Boolean(), nullable=True, default=False),
        sa.Column('last_validated_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credentials_user_id'), 'credentials', ['user_id'], unique=False)

    # Create discovered_schemas table
    op.create_table(
        'discovered_schemas',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('credential_id', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('schema_name', sa.String(length=255), nullable=False),
        sa.Column('table_name', sa.String(length=255), nullable=False),
        sa.Column('columns', sa.JSON(), nullable=False),
        sa.Column('primary_keys', sa.JSON(), nullable=True),
        sa.Column('foreign_keys', sa.JSON(), nullable=True),
        sa.Column('row_count_estimate', sa.BigInteger(), nullable=True),
        sa.Column('has_primary_key', sa.Boolean(), nullable=True, default=False),
        sa.Column('cdc_eligible', sa.Boolean(), nullable=True, default=False),
        sa.Column('cdc_issues', sa.JSON(), nullable=True),
        sa.Column('discovered_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['credential_id'], ['credentials.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discovered_schemas_credential_id'), 'discovered_schemas', ['credential_id'], unique=False)
    op.create_index(op.f('ix_discovered_schemas_user_id'), 'discovered_schemas', ['user_id'], unique=False)
    op.create_index('idx_schema_table', 'discovered_schemas', ['credential_id', 'schema_name', 'table_name'], unique=True)


def downgrade() -> None:
    # Drop discovered_schemas table
    op.drop_index('idx_schema_table', table_name='discovered_schemas')
    op.drop_index(op.f('ix_discovered_schemas_user_id'), table_name='discovered_schemas')
    op.drop_index(op.f('ix_discovered_schemas_credential_id'), table_name='discovered_schemas')
    op.drop_table('discovered_schemas')

    # Drop credentials table
    op.drop_index(op.f('ix_credentials_user_id'), table_name='credentials')
    op.drop_table('credentials')
