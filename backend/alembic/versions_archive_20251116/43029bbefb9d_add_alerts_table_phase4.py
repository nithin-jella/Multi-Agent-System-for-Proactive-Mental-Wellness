"""add_alerts_table_phase4

Revision ID: 43029bbefb9d
Revises: link_psych_users_001
Create Date: 2025-10-17 02:05:05.520677

Phase 4: Real-Time Alerts Infrastructure
- Creates alerts table for system notifications
- Supports real-time SSE broadcasting
- Tracks alert status (seen/unseen)
"""

from __future__ import annotations

from typing import Any

from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


# revision identifiers, used by Alembic.
revision: str = '43029bbefb9d'
down_revision: str | None = 'link_psych_users_001'
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
    """Create alerts table for real-time notifications."""
    # Get inspector for idempotent checks
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Create alerts table if it doesn't exist
    if 'alerts' not in existing_tables:
        op.create_table(
        'alerts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('context_data', JSONB, nullable=True),
        sa.Column('is_seen', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('seen_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )
        
        # Create indexes for efficient queries
        op.create_index('ix_alerts_alert_type', 'alerts', ['alert_type'])
        op.create_index('ix_alerts_severity', 'alerts', ['severity'])
        op.create_index('ix_alerts_entity_id', 'alerts', ['entity_id'])
        op.create_index('ix_alerts_is_seen', 'alerts', ['is_seen'])
        op.create_index('ix_alerts_created_at', 'alerts', ['created_at'])
        
        # Composite index for common query (unseen alerts ordered by time)
        op.create_index('ix_alerts_seen_created', 'alerts', ['is_seen', 'created_at'])


def schema_downgrade() -> None:
    """Drop alerts table and indexes."""
    op.drop_index('ix_alerts_seen_created', table_name='alerts')
    op.drop_index('ix_alerts_created_at', table_name='alerts')
    op.drop_index('ix_alerts_is_seen', table_name='alerts')
    op.drop_index('ix_alerts_entity_id', table_name='alerts')
    op.drop_index('ix_alerts_severity', table_name='alerts')
    op.drop_index('ix_alerts_alert_type', table_name='alerts')
    op.drop_table('alerts')


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
