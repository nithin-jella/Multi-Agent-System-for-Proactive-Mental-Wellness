"""Merge Alembic heads.

Revision ID: 61c26307ac64
Revises: ('add_ai_memory', 'add_llm_req_tracking')
Create Date: 2026-01-07
"""


# revision identifiers, used by Alembic.
revision = "61c26307ac64"
down_revision = ("add_ai_memory", "add_llm_req_tracking")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge revisions only; no schema changes.
    pass


def downgrade() -> None:
    # No downgrade behavior for merge revision.
    pass

