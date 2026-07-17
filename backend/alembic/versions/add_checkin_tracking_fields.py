"""Add check-in tracking fields to users table.

Revision ID: add_checkin_tracking
Revises: add_screening_profiles
Create Date: 2024-12-02

This migration adds fields to track proactive check-in history:
- last_checkin_sent_at: When the last check-in email was sent
- checkin_count: Total number of check-ins sent to this user

IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times.
"""
from alembic import op
import sqlalchemy as sa

# Import migration helpers for idempotent operations
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from migration_helpers import (
        column_exists, add_column_if_not_exists, drop_column_if_exists
    )
    HAS_HELPERS = True
except ImportError:
    HAS_HELPERS = False

# revision identifiers, used by Alembic.
revision = 'add_checkin_tracking'
down_revision = 'add_screening_profiles'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add check-in tracking fields to users table (idempotent)
    if HAS_HELPERS:
        add_column_if_not_exists('users', sa.Column('last_checkin_sent_at', sa.DateTime(), nullable=True))
        add_column_if_not_exists('users', sa.Column('checkin_count', sa.Integer(), nullable=False, server_default='0'))
    else:
        # Fallback: try-except for non-idempotent operation
        try:
            op.add_column('users', sa.Column('last_checkin_sent_at', sa.DateTime(), nullable=True))
        except Exception:
            pass  # Column already exists
        try:
            op.add_column('users', sa.Column('checkin_count', sa.Integer(), nullable=False, server_default='0'))
        except Exception:
            pass  # Column already exists


def downgrade() -> None:
    if HAS_HELPERS:
        drop_column_if_exists('users', 'checkin_count')
        drop_column_if_exists('users', 'last_checkin_sent_at')
    else:
        try:
            op.drop_column('users', 'checkin_count')
        except Exception:
            pass
        try:
            op.drop_column('users', 'last_checkin_sent_at')
        except Exception:
            pass
