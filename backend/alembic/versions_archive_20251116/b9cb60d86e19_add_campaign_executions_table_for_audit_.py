"""Add campaign_executions table for audit trail

Revision ID: b9cb60d86e19
Revises: 87ae07d03632
Create Date: 2025-10-22 20:02:13.068413
"""

from __future__ import annotations

from typing import Any

from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b9cb60d86e19'
down_revision: str | None = '87ae07d03632'
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
    # Get inspector for idempotent checks
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Create sca_campaign_executions table if it doesn't exist
    if 'sca_campaign_executions' not in existing_tables:
        op.create_table(
        'sca_campaign_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('executed_by', sa.Integer(), nullable=True),
        sa.Column('campaign_name', sa.String(255), nullable=False),
        sa.Column('message_content', sa.Text(), nullable=False),
        sa.Column('total_targeted', sa.Integer(), default=0),
        sa.Column('messages_sent', sa.Integer(), default=0),
        sa.Column('messages_failed', sa.Integer(), default=0),
        sa.Column('execution_time_seconds', sa.Float(), default=0.0),
        sa.Column('dry_run', sa.Boolean(), default=False),
        sa.Column('targeted_user_ids', postgresql.JSONB(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['executed_by'], ['users.id'], ondelete='SET NULL'),
    )
        
        # Create indexes for efficient querying
        op.create_index('ix_sca_campaign_executions_campaign_id', 'sca_campaign_executions', ['campaign_id'])
        op.create_index('ix_sca_campaign_executions_executed_at', 'sca_campaign_executions', ['executed_at'])


def schema_downgrade() -> None:
    op.drop_index('ix_sca_campaign_executions_executed_at', table_name='sca_campaign_executions')
    op.drop_index('ix_sca_campaign_executions_campaign_id', table_name='sca_campaign_executions')
    op.drop_table('sca_campaign_executions')


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
