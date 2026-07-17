"""Align case workflow models with agent assignments

Revision ID: 202502010001
Revises: 43029bbefb9d
Create Date: 2025-02-01
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op  # type: ignore[attr-defined]
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "202502010001"
down_revision: Union[str, None] = "43029bbefb9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    # Extend case status enum to include resolved
    if dialect == "postgresql":
        op.execute("ALTER TYPE case_status_enum ADD VALUE IF NOT EXISTS 'resolved'")

    # Capture existing assignee identifiers prior to schema changes
    assignee_ids: set[str] = set()
    cases_result = conn.execute(sa.text("SELECT DISTINCT assigned_to FROM cases WHERE assigned_to IS NOT NULL"))
    for row in cases_result:
        assignee_ids.add(str(row[0]))
    assignments_result = conn.execute(
        sa.text("SELECT DISTINCT assigned_to FROM case_assignments WHERE assigned_to IS NOT NULL")
    )
    for row in assignments_result:
        assignee_ids.add(str(row[0]))

    if assignee_ids:
        if dialect == "postgresql":
            upsert_stmt = sa.text(
                "INSERT INTO agent_users (id, role) VALUES (:id, :role) "
                "ON CONFLICT (id) DO NOTHING"
            )
        else:
            upsert_stmt = sa.text(
                "INSERT OR IGNORE INTO agent_users (id, role) VALUES (:id, :role)"
            )
        for agent_id in assignee_ids:
            conn.execute(upsert_stmt, {"id": agent_id, "role": "counselor"})

    if dialect == "postgresql":
        op.execute("ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_assigned_to_fkey")

    with op.batch_alter_table("cases") as batch:
        batch.alter_column(
            "assigned_to",
            existing_type=sa.Integer(),
            type_=sa.String(length=255),
            existing_nullable=True,
            nullable=True,
            postgresql_using="assigned_to::text",
        )
        batch.alter_column(
            "created_at",
            existing_type=sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )
        batch.alter_column(
            "updated_at",
            existing_type=sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )
        batch.create_foreign_key(
            "cases_assigned_to_agent_users_fkey",
            "agent_users",
            ["assigned_to"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("case_assignments") as batch:
        batch.alter_column(
            "assigned_to",
            existing_type=sa.String(length=255),
            nullable=True,
        )
        batch.alter_column(
            "assigned_at",
            existing_type=sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )
        batch.create_foreign_key(
            "case_assignments_assigned_to_agent_users_fkey",
            "agent_users",
            ["assigned_to"],
            ["id"],
            ondelete="SET NULL",
        )

    # Check if case_notes table exists before altering it
    inspector = sa.inspect(conn)
    if 'case_notes' in inspector.get_table_names():
        with op.batch_alter_table("case_notes") as batch:
            batch.alter_column(
                "created_at",
                existing_type=sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )
            batch.create_foreign_key(
                "case_notes_author_id_fkey",
                "users",
                ["author_id"],
                ["id"],
                ondelete="SET NULL",
            )

    # Check if agent_users table exists before altering it
    if 'agent_users' in inspector.get_table_names():
        with op.batch_alter_table("agent_users") as batch:
            batch.alter_column(
                "created_at",
                existing_type=sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )

    # Check if system_settings table exists before altering it
    if 'system_settings' in inspector.get_table_names():
        with op.batch_alter_table("system_settings") as batch:
            batch.alter_column(
                "updated_at",
                existing_type=sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )

    # Check if agent_health_logs table exists before altering it
    if 'agent_health_logs' in inspector.get_table_names():
        with op.batch_alter_table("agent_health_logs") as batch:
            batch.alter_column(
                "created_at",
                existing_type=sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )


def downgrade() -> None:
    raise NotImplementedError(
        "Downgrade is not supported for case workflow alignment migration."
    )
