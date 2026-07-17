"""Add AI memory consent and user_ai_memory_facts table.

Revision ID: add_ai_memory
Revises: add_simaster_fields
Create Date: 2025-12-19

This migration introduces:
- users.consent_ai_memory: explicit opt-in for cross-conversation AI memory
- user_ai_memory_facts: user-controlled fact memory store (list + forget)

IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times.
"""

from alembic import op
import sqlalchemy as sa

# Import migration helpers for idempotent operations
import sys
import os
from typing import Any, Callable


def _missing_helper(*_args: Any, **_kwargs: Any) -> None:
    raise RuntimeError(
        "migration_helpers could not be imported; idempotent helper was referenced unexpectedly"
    )


# Default definitions for type-checkers; overwritten on successful import.
table_exists: Callable[..., bool] = _missing_helper  # type: ignore[assignment]
column_exists: Callable[..., bool] = _missing_helper  # type: ignore[assignment]
index_exists: Callable[..., bool] = _missing_helper  # type: ignore[assignment]
create_table_if_not_exists: Callable[..., Any] = _missing_helper  # type: ignore[assignment]
create_index_if_not_exists: Callable[..., Any] = _missing_helper  # type: ignore[assignment]
drop_table_if_exists: Callable[..., Any] = _missing_helper  # type: ignore[assignment]
drop_index_if_exists: Callable[..., Any] = _missing_helper  # type: ignore[assignment]
add_column_if_not_exists: Callable[..., Any] = _missing_helper  # type: ignore[assignment]
drop_column_if_exists: Callable[..., Any] = _missing_helper  # type: ignore[assignment]

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from migration_helpers import (
        table_exists,
        column_exists,
        index_exists,
        create_table_if_not_exists,
        create_index_if_not_exists,
        drop_table_if_exists,
        drop_index_if_exists,
        add_column_if_not_exists,
        drop_column_if_exists,
    )

    HAS_HELPERS = True
except ImportError:
    HAS_HELPERS = False


# revision identifiers, used by Alembic.
revision = "add_ai_memory"
down_revision = "add_simaster_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add users.consent_ai_memory
    if HAS_HELPERS:
        add_column_if_not_exists(
            "users",
            sa.Column("consent_ai_memory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    else:
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "consent_ai_memory" not in columns:
            op.add_column(
                "users",
                sa.Column("consent_ai_memory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            )

    # 2) Create user_ai_memory_facts table
    if HAS_HELPERS:
        create_table_if_not_exists(
            "user_ai_memory_facts",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("fact_encrypted", sa.Text(), nullable=False),
            sa.Column("fact_hash", sa.String(length=64), nullable=False),
            sa.Column("category", sa.String(length=64), nullable=True),
            sa.Column("source", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("user_id", "fact_hash", name="uq_user_ai_memory_fact_hash"),
        )

        create_index_if_not_exists(
            "ix_user_ai_memory_facts_user_id",
            "user_ai_memory_facts",
            ["user_id"],
            unique=False,
        )
        create_index_if_not_exists(
            "ix_user_ai_memory_facts_created_at",
            "user_ai_memory_facts",
            ["created_at"],
            unique=False,
        )
    else:
        # Best-effort non-helper fallback
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        tables = set(inspector.get_table_names())
        if "user_ai_memory_facts" not in tables:
            op.create_table(
                "user_ai_memory_facts",
                sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
                sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
                sa.Column("fact_encrypted", sa.Text(), nullable=False),
                sa.Column("fact_hash", sa.String(length=64), nullable=False),
                sa.Column("category", sa.String(length=64), nullable=True),
                sa.Column("source", sa.String(length=64), nullable=True),
                sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
                sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
                sa.UniqueConstraint("user_id", "fact_hash", name="uq_user_ai_memory_fact_hash"),
            )

        indexes = {idx["name"] for t in inspector.get_table_names() for idx in inspector.get_indexes(t)}
        if "ix_user_ai_memory_facts_user_id" not in indexes:
            op.create_index("ix_user_ai_memory_facts_user_id", "user_ai_memory_facts", ["user_id"], unique=False)
        if "ix_user_ai_memory_facts_created_at" not in indexes:
            op.create_index(
                "ix_user_ai_memory_facts_created_at",
                "user_ai_memory_facts",
                ["created_at"],
                unique=False,
            )


def downgrade() -> None:
    # Drop indexes/table first
    if HAS_HELPERS:
        drop_index_if_exists("ix_user_ai_memory_facts_created_at", table_name="user_ai_memory_facts")
        drop_index_if_exists("ix_user_ai_memory_facts_user_id", table_name="user_ai_memory_facts")
        drop_table_if_exists("user_ai_memory_facts")
        drop_column_if_exists("users", "consent_ai_memory")
    else:
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        tables = set(inspector.get_table_names())
        if "user_ai_memory_facts" in tables:
            try:
                op.drop_index("ix_user_ai_memory_facts_created_at", table_name="user_ai_memory_facts")
            except Exception:
                pass
            try:
                op.drop_index("ix_user_ai_memory_facts_user_id", table_name="user_ai_memory_facts")
            except Exception:
                pass
            op.drop_table("user_ai_memory_facts")

        columns = {col["name"] for col in inspector.get_columns("users")}
        if "consent_ai_memory" in columns:
            op.drop_column("users", "consent_ai_memory")
