"""Add user_screening_profiles table for conversational intelligence extraction.

Revision ID: add_screening_profiles
Revises: 5f0351a53f67
Create Date: 2024-12-02

This migration adds the user_screening_profiles table which stores
longitudinal mental health screening data gathered seamlessly during
natural conversations with Aika.

IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# Import migration helpers for idempotent operations
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from migration_helpers import (
        table_exists, column_exists, index_exists,
        create_table_if_not_exists, create_index_if_not_exists,
        drop_table_if_exists, drop_index_if_exists
    )
    HAS_HELPERS = True
except ImportError:
    HAS_HELPERS = False

# revision identifiers, used by Alembic.
revision = 'add_screening_profiles'
down_revision = '5f0351a53f67'
branch_labels = None
depends_on = None


def upgrade() -> None:
    if HAS_HELPERS and table_exists('user_screening_profiles'):
        # Table already exists, skip creation
        return
    
    op.create_table(
        'user_screening_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('profile_data', JSON(), nullable=True),
        sa.Column('overall_risk', sa.String(32), nullable=False, server_default='none'),
        sa.Column('requires_attention', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('total_messages_analyzed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_sessions_analyzed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('last_intervention_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Create indexes (idempotent)
    if HAS_HELPERS:
        create_index_if_not_exists('ix_user_screening_profiles_user_id', 'user_screening_profiles', ['user_id'], unique=True)
        create_index_if_not_exists('ix_user_screening_profiles_overall_risk', 'user_screening_profiles', ['overall_risk'])
        create_index_if_not_exists('ix_user_screening_profiles_requires_attention', 'user_screening_profiles', ['requires_attention'])
    else:
        op.create_index('ix_user_screening_profiles_user_id', 'user_screening_profiles', ['user_id'], unique=True)
        op.create_index('ix_user_screening_profiles_overall_risk', 'user_screening_profiles', ['overall_risk'])
        op.create_index('ix_user_screening_profiles_requires_attention', 'user_screening_profiles', ['requires_attention'])


def downgrade() -> None:
    if HAS_HELPERS:
        drop_index_if_exists('ix_user_screening_profiles_requires_attention', 'user_screening_profiles')
        drop_index_if_exists('ix_user_screening_profiles_overall_risk', 'user_screening_profiles')
        drop_index_if_exists('ix_user_screening_profiles_user_id', 'user_screening_profiles')
        drop_table_if_exists('user_screening_profiles')
    else:
        op.drop_index('ix_user_screening_profiles_requires_attention', 'user_screening_profiles')
        op.drop_index('ix_user_screening_profiles_overall_risk', 'user_screening_profiles')
        op.drop_index('ix_user_screening_profiles_user_id', 'user_screening_profiles')
        op.drop_table('user_screening_profiles')
