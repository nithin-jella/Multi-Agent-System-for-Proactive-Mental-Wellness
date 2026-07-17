"""add agent_runs and agent_messages tables

Revision ID: 20250922a1c6e
Revises: e574b9ff31e8_add_cbt_module_steps_table
Create Date: 2025-09-22
"""
from typing import Sequence, Union
from alembic import op  # type: ignore[attr-defined]
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20250922a1c6e'
# IMPORTANT: down_revision must be the prior migration's revision id, not its filename slug
down_revision: Union[str, None] = 'e574b9ff31e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    created_runs = False
    if 'agent_runs' not in existing_tables:
        op.create_table(
            'agent_runs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('agent_name', sa.String(length=64), nullable=False),
            sa.Column('action', sa.String(length=64), nullable=False),
            sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
            sa.Column('started_at', sa.DateTime(), nullable=False),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('input_payload', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('output_payload', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('correlation_id', sa.String(length=128), nullable=False),
            sa.Column('triggered_by_user_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['triggered_by_user_id'], ['users.id']),
        )
        created_runs = True

    created_messages = False
    if 'agent_messages' not in existing_tables:
        op.create_table(
            'agent_messages',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('run_id', sa.Integer(), nullable=False),
            sa.Column('agent_name', sa.String(length=64), nullable=False),
            sa.Column('role', sa.String(length=32), nullable=False, server_default='system'),
            sa.Column('message_type', sa.String(length=32), nullable=False, server_default='event'),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        )
        created_messages = True

    # Refresh inspector for newly created tables
    inspector = sa.inspect(conn)

    def ensure_index(table: str, name: str, columns: list[str]):
        if table not in inspector.get_table_names():
            return
        existing_index_names = {ix['name'] for ix in inspector.get_indexes(table)}
        if name not in existing_index_names:
            op.create_index(name, table, columns)

    # Create indexes (idempotent) for agent_runs
    ensure_index('agent_runs', 'ix_agent_runs_agent_name', ['agent_name'])
    ensure_index('agent_runs', 'ix_agent_runs_action', ['action'])
    ensure_index('agent_runs', 'ix_agent_runs_status', ['status'])
    ensure_index('agent_runs', 'ix_agent_runs_correlation_id', ['correlation_id'])
    ensure_index('agent_runs', 'ix_agent_runs_triggered_by_user_id', ['triggered_by_user_id'])
    # indexes for agent_messages
    ensure_index('agent_messages', 'ix_agent_messages_run_id', ['run_id'])
    ensure_index('agent_messages', 'ix_agent_messages_agent_name', ['agent_name'])
    ensure_index('agent_messages', 'ix_agent_messages_created_at', ['created_at'])


def downgrade() -> None:
    op.drop_table('agent_messages')
    op.drop_table('agent_runs')
