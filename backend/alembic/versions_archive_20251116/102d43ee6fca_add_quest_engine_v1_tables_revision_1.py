"""Add quest engine v1 tables - revision 1

Revision ID: 102d43ee6fca
Revises: 0809146a517c
Create Date: 2025-10-24 08:48:28.857072
"""

from __future__ import annotations

from typing import Any

from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '102d43ee6fca'
down_revision: str | None = '0809146a517c'
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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    from sqlalchemy import inspect
    from sqlalchemy.dialects.postgresql import ENUM
    
    # Create enums using PostgreSQL-safe approach (only if they don't exist)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE questcategoryenum AS ENUM ('wellness', 'reflection', 'social', 'support', 'learning');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE questdifficultyenum AS ENUM ('easy', 'standard', 'challenge');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE queststatusenum AS ENUM ('active', 'completed', 'expired', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE attestationstatusenum AS ENUM ('pending', 'queued', 'confirmed', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Define enum columns using ENUM type that won't try to recreate
    # Use postgresql.ENUM explicitly and ensure create_type=False
    quest_category_enum_col = ENUM(
        "wellness",
        "reflection",
        "social",
        "support",
        "learning",
        name="questcategoryenum",
        create_type=False,
        schema=None,
    )
    quest_difficulty_enum_col = ENUM(
        "easy",
        "standard",
        "challenge",
        name="questdifficultyenum",
        create_type=False,
        schema=None,
    )
    quest_status_enum_col = ENUM(
        "active",
        "completed",
        "expired",
        "cancelled",
        name="queststatusenum",
        create_type=False,
        schema=None,
    )
    attestation_status_enum_col = ENUM(
        "pending",
        "queued",
        "confirmed",
        "failed",
        name="attestationstatusenum",
        create_type=False,
    )

    # Create tables only if they don't exist
    if "quest_templates" not in existing_tables:
        op.create_table(
            "quest_templates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("code", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("short_description", sa.String(length=255), nullable=False),
            sa.Column("long_description", sa.Text(), nullable=True),
            sa.Column("category", quest_category_enum_col, nullable=False, server_default="wellness"),
            sa.Column("difficulty", quest_difficulty_enum_col, nullable=False, server_default="standard"),
            sa.Column("recommended_duration_minutes", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("base_xp", sa.Integer(), nullable=False, server_default="25"),
            sa.Column("base_joy", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("base_harmony", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("extra_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column("requires_counselor", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.UniqueConstraint("code", name="uq_quest_templates_code"),
        )

    if "player_wellness_state" not in existing_tables:
        op.create_table(
            "player_wellness_state",
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("compassion_mode_active", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("compassion_activated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("harmony_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("joy_balance", sa.Float(), nullable=False, server_default="0"),
            sa.Column("extra_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        )

    if "quest_instances" not in existing_tables:
        op.create_table(
            "quest_instances",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "template_id",
                sa.Integer(),
                sa.ForeignKey("quest_templates.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("status", quest_status_enum_col, nullable=False, server_default="active"),
            sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completion_payload", sa.JSON(), nullable=True),
            sa.Column("streak_snapshot", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("compassion_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.create_index(
            "ix_quest_instances_user_status",
            "quest_instances",
            ["user_id", "status"],
        )
        op.create_index(
            "ix_quest_instances_expires_at",
            "quest_instances",
            ["expires_at"],
        )

    if "reward_ledger_entries" not in existing_tables:
        op.create_table(
            "reward_ledger_entries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "quest_instance_id",
                sa.Integer(),
                sa.ForeignKey("quest_instances.id", ondelete="CASCADE"),
                nullable=True,
            ),
            sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("joy_awarded", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("harmony_delta", sa.Float(), nullable=False, server_default="0"),
            sa.Column("care_pending", sa.Float(), nullable=False, server_default="0"),
            sa.Column("extra_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("quest_instance_id", name="uq_reward_ledger_quest_instance"),
        )

    if "attestation_records" not in existing_tables:
        op.create_table(
            "attestation_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "quest_instance_id",
                sa.Integer(),
                sa.ForeignKey("quest_instances.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("counselor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("hashed_payload", sa.String(length=256), nullable=False),
            sa.Column("status", attestation_status_enum_col, nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("extra_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        )
        op.create_index("ix_attestation_status", "attestation_records", ["status"])

    if "compliance_audit_log" not in existing_tables:
        op.create_table(
            "compliance_audit_log",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("actor_role", sa.String(length=64), nullable=True),
            sa.Column("action", sa.String(length=120), nullable=False),
            sa.Column("entity_type", sa.String(length=120), nullable=True),
            sa.Column("entity_id", sa.String(length=120), nullable=True),
            sa.Column("extra_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    if "quest_analytics_events" not in existing_tables:
        op.create_table(
            "quest_analytics_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("event_type", sa.String(length=64), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "quest_instance_id",
                sa.Integer(),
                sa.ForeignKey("quest_instances.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_quest_analytics_events_user_id", "quest_analytics_events", ["user_id"])
        op.create_index("ix_quest_analytics_events_instance_id", "quest_analytics_events", ["quest_instance_id"])
        op.create_index("ix_reward_ledger_entries_user_id", "reward_ledger_entries", ["user_id"])
        op.create_index(
            "ix_reward_ledger_entries_quest_instance_id",
            "reward_ledger_entries",
            ["quest_instance_id"],
        )


def schema_downgrade() -> None:
    op.drop_index("ix_reward_ledger_entries_quest_instance_id", table_name="reward_ledger_entries")
    op.drop_index("ix_reward_ledger_entries_user_id", table_name="reward_ledger_entries")
    op.drop_index("ix_quest_analytics_events_instance_id", table_name="quest_analytics_events")
    op.drop_index("ix_quest_analytics_events_user_id", table_name="quest_analytics_events")
    op.drop_index("ix_quest_instances_expires_at", table_name="quest_instances")
    op.drop_index("ix_quest_instances_user_status", table_name="quest_instances")
    op.drop_index("ix_attestation_status", table_name="attestation_records")

    op.drop_table("quest_analytics_events")
    op.drop_table("compliance_audit_log")
    op.drop_table("attestation_records")
    op.drop_table("reward_ledger_entries")
    op.drop_table("quest_instances")
    op.drop_table("player_wellness_state")
    op.drop_table("quest_templates")

    bind = op.get_bind()
    attestation_status_enum = sa.Enum(
        "pending",
        "queued",
        "confirmed",
        "failed",
        name="attestationstatusenum",
    )
    quest_status_enum = sa.Enum(
        "active",
        "completed",
        "expired",
        "cancelled",
        name="queststatusenum",
    )
    quest_difficulty_enum = sa.Enum(
        "easy",
        "standard",
        "challenge",
        name="questdifficultyenum",
    )
    quest_category_enum = sa.Enum(
        "wellness",
        "reflection",
        "social",
        "support",
        "learning",
        name="questcategoryenum",
    )

    attestation_status_enum.drop(bind, checkfirst=True)
    quest_status_enum.drop(bind, checkfirst=True)
    quest_difficulty_enum.drop(bind, checkfirst=True)
    quest_category_enum.drop(bind, checkfirst=True)


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


