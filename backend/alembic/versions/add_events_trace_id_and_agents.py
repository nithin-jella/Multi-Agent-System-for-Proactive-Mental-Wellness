"""Add trace_id to events and extend agent_name_enum.

Revision ID: add_events_trace_id
Revises: add_checkin_tracking
Create Date: 2026-01-05

Notes:
- Adds `trace_id` column to `events` for request correlation.
- Extends the Postgres enum `agent_name_enum` to support AIKA/SCA/SDA.
- Migration is written to be idempotent where practical.
"""

from alembic import op
import sqlalchemy as sa

# Import migration helpers for idempotent operations
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from migration_helpers import add_column_if_not_exists, create_index_if_not_exists

    HAS_HELPERS = True
except ImportError:
    HAS_HELPERS = False


# revision identifiers, used by Alembic.
revision = "add_events_trace_id"
down_revision = "add_checkin_tracking"
branch_labels = None
depends_on = None


def _add_enum_value_if_missing(enum_type: str, value: str) -> None:
    # Postgres supports IF NOT EXISTS (>= 9.1 for ALTER TYPE ADD VALUE, but IF NOT EXISTS is newer).
    # We fall back to a try/except for broad compatibility.
    try:
        op.execute(f"ALTER TYPE {enum_type} ADD VALUE IF NOT EXISTS '{value}'")
    except Exception:
        try:
            op.execute(f"ALTER TYPE {enum_type} ADD VALUE '{value}'")
        except Exception:
            # Value likely already exists or dialect doesn't support this statement.
            pass


def upgrade() -> None:
    # Extend enum values (safe no-ops if already present)
    _add_enum_value_if_missing("agent_name_enum", "AIKA")
    _add_enum_value_if_missing("agent_name_enum", "SCA")
    _add_enum_value_if_missing("agent_name_enum", "SDA")

    # Add trace_id to events
    if HAS_HELPERS:
        add_column_if_not_exists("events", sa.Column("trace_id", sa.String(), nullable=True))
        create_index_if_not_exists("ix_events_trace_id", "events", ["trace_id"])
    else:
        try:
            op.add_column("events", sa.Column("trace_id", sa.String(), nullable=True))
        except Exception:
            pass
        try:
            op.create_index("ix_events_trace_id", "events", ["trace_id"])
        except Exception:
            pass


def downgrade() -> None:
    # Best-effort downgrade: drop index/column. Enum value removal is not supported safely.
    try:
        op.drop_index("ix_events_trace_id", table_name="events")
    except Exception:
        pass
    try:
        op.drop_column("events", "trace_id")
    except Exception:
        pass
