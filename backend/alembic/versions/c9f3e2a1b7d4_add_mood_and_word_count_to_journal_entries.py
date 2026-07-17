"""add mood and word_count to journal_entries

Revision ID: c9f3e2a1b7d4
Revises: b1c4d7f2a8e0
Create Date: 2026-03-03
"""

from alembic import op
import sqlalchemy as sa


revision = "c9f3e2a1b7d4"
down_revision = "b1c4d7f2a8e0"
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade() -> None:
    if not _column_exists("journal_entries", "mood"):
        op.add_column("journal_entries", sa.Column("mood", sa.Integer(), nullable=True))

    if not _column_exists("journal_entries", "word_count"):
        op.add_column(
            "journal_entries",
            sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        )
        op.execute("UPDATE journal_entries SET word_count = 0 WHERE word_count IS NULL")
        op.alter_column("journal_entries", "word_count", server_default=None)


def downgrade() -> None:
    if _column_exists("journal_entries", "word_count"):
        op.drop_column("journal_entries", "word_count")

    if _column_exists("journal_entries", "mood"):
        op.drop_column("journal_entries", "mood")
