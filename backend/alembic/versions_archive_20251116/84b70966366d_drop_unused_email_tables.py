"""drop_unused_email_tables

Revision ID: 84b70966366d
Revises: b9cb60d86e19
Create Date: 2025-10-23 09:08:26.239206
"""

from __future__ import annotations

from typing import Any

from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84b70966366d'
down_revision: str | None = 'b9cb60d86e19'
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | str | None = None


def upgrade() -> None:
    """Apply schema (and optional data) upgrades."""
    schema_upgrade()
    if _should_run_data_migrations():
        data_upgrade()


def downgrade() -> None:
    """Revert schema (and optional data) upgrades."""
    if _should_run_data_migrations():
        data_downgrade()
    schema_downgrade()


def schema_upgrade() -> None:
    """Drop unused email tables."""
    # Get database connection to check for table existence
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # Drop email tables if they exist (in reverse order due to foreign key constraints)
    if 'email_logs' in existing_tables:
        op.drop_table('email_logs')
    
    if 'email_recipients' in existing_tables:
        op.drop_table('email_recipients')
    
    if 'email_groups' in existing_tables:
        op.drop_table('email_groups')
    
    if 'email_templates' in existing_tables:
        op.drop_table('email_templates')


def schema_downgrade() -> None:
    """Recreate email tables (for rollback - tables will be empty)."""
    # Note: This is a minimal recreation for rollback purposes.
    # The original table structures had more columns and constraints.
    
    # Recreate tables in dependency order
    op.create_table('email_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('email_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('email_recipients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['email_groups.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('email_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('recipients', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('scheduled_time', sa.DateTime(), nullable=True),
        sa.Column('sent_time', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['email_templates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def data_upgrade() -> None:
    """Idempotent data migrations executed with --x data=true."""
    pass


def data_downgrade() -> None:
    """Rollback for data migrations executed with --x data=true."""
    pass


def _should_run_data_migrations() -> bool:
    """Return True when the revision is invoked with ``--x data=true``."""
    x_args: dict[str, Any] = context.get_x_argument(as_dictionary=True)
    flag = x_args.get("data")
    if isinstance(flag, str):
        return flag.lower() in {"1", "true", "yes", "on"}
    return bool(flag)
