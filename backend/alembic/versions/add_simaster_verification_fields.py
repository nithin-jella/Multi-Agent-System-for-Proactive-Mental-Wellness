"""Add SIMASTER verification fields to user_profiles.

Revision ID: add_simaster_fields
Revises: add_screening_profiles
Create Date: 2025-01-21

This migration adds fields to track SIMASTER verification status
for UGM students. The bookmarklet-based import feature allows
students to securely import their verified academic data from SIMASTER.

Fields added:
- simaster_verified: Boolean flag indicating if student data was imported from SIMASTER
- simaster_verified_at: Timestamp of when the SIMASTER data was imported

IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'add_simaster_fields'
down_revision = 'add_checkin_tracking'
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """Add SIMASTER verification fields to user_profiles table."""
    # Add simaster_verified column if it doesn't exist
    if not column_exists('user_profiles', 'simaster_verified'):
        op.add_column(
            'user_profiles',
            sa.Column('simaster_verified', sa.Boolean(), nullable=False, server_default='false')
        )
    
    # Add simaster_verified_at column if it doesn't exist
    if not column_exists('user_profiles', 'simaster_verified_at'):
        op.add_column(
            'user_profiles',
            sa.Column('simaster_verified_at', sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    """Remove SIMASTER verification fields from user_profiles table."""
    if column_exists('user_profiles', 'simaster_verified_at'):
        op.drop_column('user_profiles', 'simaster_verified_at')
    
    if column_exists('user_profiles', 'simaster_verified'):
        op.drop_column('user_profiles', 'simaster_verified')
