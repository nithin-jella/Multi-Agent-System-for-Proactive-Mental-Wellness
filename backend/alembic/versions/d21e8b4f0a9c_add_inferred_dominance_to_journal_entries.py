"""add inferred dominance to journal entries

Revision ID: d21e8b4f0a9c
Revises: c11f5f5333b1
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa


revision = "d21e8b4f0a9c"
down_revision = "c11f5f5333b1"
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade() -> None:
    if not _column_exists("journal_entries", "inferred_dominance"):
        op.add_column("journal_entries", sa.Column("inferred_dominance", sa.Float(), nullable=True))


def downgrade() -> None:
    if _column_exists("journal_entries", "inferred_dominance"):
        op.drop_column("journal_entries", "inferred_dominance")
