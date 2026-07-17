"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision}
Create Date: ${create_date}

IMPORTANT: All migrations should be IDEMPOTENT.
- Use migration_helpers for existence checks
- Never assume table/column state
- Test both upgrade() and downgrade()
- Document any data transformations
"""

from __future__ import annotations

from typing import Any

from alembic import context, op
import sqlalchemy as sa
${imports if imports else ""}

# Import migration helpers for idempotent operations
try:
    from alembic import migration_helpers as mh
except ImportError:
    # Fallback if helpers not available
    mh = None

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: str | None = ${repr(down_revision)}
branch_labels: tuple[str, ...] | None = ${repr(branch_labels)}
depends_on: tuple[str, ...] | str | None = ${repr(depends_on)}


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
    """
    Apply schema changes with idempotent checks.
    
    Example patterns:
    
    # Creating tables
    if mh and not mh.table_exists('my_table'):
        op.create_table('my_table', ...)
    
    # Adding columns
    if mh and not mh.column_exists('my_table', 'my_column'):
        op.add_column('my_table', sa.Column('my_column', ...))
    
    # Creating indexes
    if mh and not mh.index_exists('idx_name', 'my_table'):
        op.create_index('idx_name', 'my_table', ['column'])
    
    # Or use helper functions directly:
    if mh:
        mh.add_column_if_not_exists('my_table', sa.Column('my_column', ...))
    """
    ${upgrades if upgrades else "pass"}


def schema_downgrade() -> None:
    """
    Revert schema changes with idempotent checks.
    
    Example patterns:
    
    # Dropping columns
    if mh and mh.column_exists('my_table', 'my_column'):
        op.drop_column('my_table', 'my_column')
    
    # Dropping tables
    if mh and mh.table_exists('my_table'):
        op.drop_table('my_table')
    
    # Or use helper functions:
    if mh:
        mh.drop_column_if_exists('my_table', 'my_column')
    """
    ${downgrades if downgrades else "pass"}


def data_upgrade() -> None:
    """
    Idempotent data migrations executed with --x data=true.
    
    Use this for:
    - Populating new columns with computed values
    - Migrating data between tables
    - Seeding initial data
    
    IMPORTANT: Make this idempotent by checking for existing data first.
    
    Example:
        conn = op.get_bind()
        result = conn.execute(sa.text("SELECT COUNT(*) FROM my_table WHERE ..."))
        if result.scalar() == 0:
            # Safe to insert/update
            pass
    """
    pass


def data_downgrade() -> None:
    """
    Rollback for data migrations executed with --x data=true.
    
    IMPORTANT: Be careful with data downgrades - they can cause data loss.
    Consider logging or backing up before deletion.
    """
    pass


def _should_run_data_migrations() -> bool:
    """Return True when the revision is invoked with ``--x data=true``."""
    x_args: dict[str, Any] = context.get_x_argument(as_dictionary=True)
    flag = x_args.get("data")
    if isinstance(flag, str):
        return flag.lower() in {"1", "true", "yes", "on"}
    return bool(flag)


# Helper function for manual idempotency checks if migration_helpers unavailable
def _table_exists(table_name: str) -> bool:
    """Fallback table existence check."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    """Fallback column existence check."""
    if not _table_exists(table_name):
        return False
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col['name'] for col in inspector.get_columns(table_name)}
    return column_name in columns

