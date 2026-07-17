"""Add LLM request tracking fields to conversations.

Revision ID: add_llm_req_tracking
Revises: (add_events_trace_id, add_simaster_fields)
Create Date: 2026-01-07

Adds lightweight per-user-prompt accounting fields:
- llm_prompt_id
- llm_request_count
- llm_requests_by_model

These are intended as an interim solution; future improvement can normalize
into a dedicated LLMRequestLog table.
"""

from alembic import op
import sqlalchemy as sa

# Import migration helpers for idempotent operations
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from migration_helpers import add_column_if_not_exists

    HAS_HELPERS = True
except ImportError:
    HAS_HELPERS = False


# revision identifiers, used by Alembic.
revision = "add_llm_req_tracking"
down_revision = ("add_events_trace_id", "add_simaster_fields")
branch_labels = None
depends_on = None


def upgrade() -> None:
    if HAS_HELPERS:
        add_column_if_not_exists("conversations", sa.Column("llm_prompt_id", sa.String(), nullable=True))
        add_column_if_not_exists("conversations", sa.Column("llm_request_count", sa.Integer(), nullable=True))
        add_column_if_not_exists("conversations", sa.Column("llm_requests_by_model", sa.JSON(), nullable=True))
        return

    op.add_column("conversations", sa.Column("llm_prompt_id", sa.String(), nullable=True))
    op.add_column("conversations", sa.Column("llm_request_count", sa.Integer(), nullable=True))
    op.add_column("conversations", sa.Column("llm_requests_by_model", sa.JSON(), nullable=True))


def downgrade() -> None:
    # Best-effort (drop columns if they exist)
    try:
        op.drop_column("conversations", "llm_requests_by_model")
    except Exception:
        pass
    try:
        op.drop_column("conversations", "llm_request_count")
    except Exception:
        pass
    try:
        op.drop_column("conversations", "llm_prompt_id")
    except Exception:
        pass
