"""add retention tracking and profile telegram

Revision ID: b7f2c1d9e6a0
Revises: a3d1a4b2c9f1
Create Date: 2026-01-09

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7f2c1d9e6a0"
down_revision = "a3d1a4b2c9f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Normalize Telegram username into user_profiles
    op.add_column("user_profiles", sa.Column("telegram_username", sa.String(length=100), nullable=True))

    # Best-effort backfill from legacy users.telegram_username
    op.execute(
        """
        UPDATE user_profiles
        SET telegram_username = u.telegram_username
        FROM users u
        WHERE user_profiles.user_id = u.id
          AND user_profiles.telegram_username IS NULL
          AND u.telegram_username IS NOT NULL
        """
    )

    # 2) User daily activity (DAU/WAU/MAU building block)
    # Ensure normalized clinical record can fully replace legacy users.therapy_notes
    op.add_column("user_clinical_records", sa.Column("therapy_notes", sa.Text(), nullable=True))

    # Ensure normalized preferences can fully replace legacy users.*_preferences blobs
    op.add_column("user_preferences", sa.Column("communication_preferences", sa.Text(), nullable=True))
    op.add_column("user_preferences", sa.Column("interface_preferences", sa.Text(), nullable=True))

    op.create_table(
        "user_daily_activity",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("request_count", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.UniqueConstraint("user_id", "activity_date", name="uq_user_daily_activity_user_date"),
    )
    op.create_index("ix_user_daily_activity_user_id", "user_daily_activity", ["user_id"], unique=False)
    op.create_index("ix_user_daily_activity_activity_date", "user_daily_activity", ["activity_date"], unique=False)
    op.create_index(
        "ix_user_daily_activity_date_user",
        "user_daily_activity",
        ["activity_date", "user_id"],
        unique=False,
    )

    # 3) Optional coarse event log
    op.create_table(
        "user_events",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_name", sa.String(length=100), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
    )
    op.create_index("ix_user_events_user_id", "user_events", ["user_id"], unique=False)
    op.create_index("ix_user_events_event_name", "user_events", ["event_name"], unique=False)
    op.create_index("ix_user_events_occurred_at", "user_events", ["occurred_at"], unique=False)
    op.create_index("ix_user_events_session_id", "user_events", ["session_id"], unique=False)

    # 4) Precomputed cohort retention points
    op.create_table(
        "retention_cohort_daily",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("cohort_date", sa.Date(), nullable=False),
        sa.Column("day_n", sa.Integer(), nullable=False),
        sa.Column("cohort_size", sa.Integer(), nullable=False),
        sa.Column("retained_users", sa.Integer(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("cohort_date", "day_n", name="uq_retention_cohort_date_day"),
    )
    op.create_index("ix_retention_cohort_daily_cohort_date", "retention_cohort_daily", ["cohort_date"], unique=False)
    op.create_index("ix_retention_cohort_daily_day_n", "retention_cohort_daily", ["day_n"], unique=False)
    op.create_index(
        "ix_retention_cohort_date_day",
        "retention_cohort_daily",
        ["cohort_date", "day_n"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_retention_cohort_date_day", table_name="retention_cohort_daily")
    op.drop_index("ix_retention_cohort_daily_day_n", table_name="retention_cohort_daily")
    op.drop_index("ix_retention_cohort_daily_cohort_date", table_name="retention_cohort_daily")
    op.drop_table("retention_cohort_daily")

    op.drop_index("ix_user_events_session_id", table_name="user_events")
    op.drop_index("ix_user_events_occurred_at", table_name="user_events")
    op.drop_index("ix_user_events_event_name", table_name="user_events")
    op.drop_index("ix_user_events_user_id", table_name="user_events")
    op.drop_table("user_events")

    op.drop_index("ix_user_daily_activity_date_user", table_name="user_daily_activity")
    op.drop_index("ix_user_daily_activity_activity_date", table_name="user_daily_activity")
    op.drop_index("ix_user_daily_activity_user_id", table_name="user_daily_activity")
    op.drop_table("user_daily_activity")

    op.drop_column("user_preferences", "interface_preferences")
    op.drop_column("user_preferences", "communication_preferences")

    op.drop_column("user_clinical_records", "therapy_notes")

    op.drop_column("user_profiles", "telegram_username")
