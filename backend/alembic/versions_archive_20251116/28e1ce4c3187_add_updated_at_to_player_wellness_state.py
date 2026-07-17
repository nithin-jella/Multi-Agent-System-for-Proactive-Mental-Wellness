"""add_updated_at_to_player_wellness_state

Revision ID: 28e1ce4c3187
Revises: 4b77dfea8799
Create Date: 2025-10-30 09:37:06.525250
"""

from __future__ import annotations

from typing import Any

from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28e1ce4c3187'
down_revision: str | None = '4b77dfea8799'
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
    """Add updated_at column to player_wellness_state table (idempotent)."""
    # Check if column exists before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('player_wellness_state')]
    
    if 'updated_at' not in columns:
        op.add_column(
            'player_wellness_state',
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
        )
    else:
        # Column already exists, skip migration
        pass


def schema_downgrade() -> None:
    """Remove updated_at column from player_wellness_state table (idempotent)."""
    # Check if column exists before dropping
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('player_wellness_state')]
    
    if 'updated_at' in columns:
        op.drop_column('player_wellness_state', 'updated_at')
    else:
        # Column doesn't exist, skip downgrade
        pass


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
