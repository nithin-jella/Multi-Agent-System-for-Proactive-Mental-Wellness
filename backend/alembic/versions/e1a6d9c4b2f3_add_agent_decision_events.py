"""add agent decision audit events table

Revision ID: e1a6d9c4b2f3
Revises: f7c1a9b2d4e6
Create Date: 2026-02-18
"""

from alembic import op
import sqlalchemy as sa


revision = "e1a6d9c4b2f3"
down_revision = "f7c1a9b2d4e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_decision_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("decision_source", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_role", sa.String(length=32), nullable=True),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("intent", sa.String(length=64), nullable=True),
        sa.Column("next_step", sa.String(length=32), nullable=True),
        sa.Column("needs_agents", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("risk_level", sa.String(length=16), nullable=False, server_default="none"),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("raw_decision_json", sa.JSON(), nullable=False),
        sa.Column("autopilot_action_id", sa.Integer(), nullable=True),
        sa.Column("autopilot_action_type", sa.String(length=64), nullable=True),
        sa.Column("autopilot_policy_decision", sa.String(length=32), nullable=True),
        sa.Column("autopilot_requires_human_review", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("attestation_record_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["attestation_record_id"], ["attestation_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["autopilot_action_id"], ["autopilot_actions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_agent_decision_events_id", "agent_decision_events", ["id"], unique=False)
    op.create_index("ix_agent_decision_events_created_at", "agent_decision_events", ["created_at"], unique=False)
    op.create_index("ix_agent_decision_events_decision_source", "agent_decision_events", ["decision_source"], unique=False)
    op.create_index("ix_agent_decision_events_user_id", "agent_decision_events", ["user_id"], unique=False)
    op.create_index("ix_agent_decision_events_user_role", "agent_decision_events", ["user_role"], unique=False)
    op.create_index("ix_agent_decision_events_session_id", "agent_decision_events", ["session_id"], unique=False)
    op.create_index("ix_agent_decision_events_intent", "agent_decision_events", ["intent"], unique=False)
    op.create_index("ix_agent_decision_events_next_step", "agent_decision_events", ["next_step"], unique=False)
    op.create_index("ix_agent_decision_events_needs_agents", "agent_decision_events", ["needs_agents"], unique=False)
    op.create_index("ix_agent_decision_events_risk_level", "agent_decision_events", ["risk_level"], unique=False)
    op.create_index("ix_agent_decision_events_autopilot_action_id", "agent_decision_events", ["autopilot_action_id"], unique=False)
    op.create_index("ix_agent_decision_events_attestation_record_id", "agent_decision_events", ["attestation_record_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_agent_decision_events_attestation_record_id", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_autopilot_action_id", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_risk_level", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_needs_agents", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_next_step", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_intent", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_session_id", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_user_role", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_user_id", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_decision_source", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_created_at", table_name="agent_decision_events")
    op.drop_index("ix_agent_decision_events_id", table_name="agent_decision_events")
    op.drop_table("agent_decision_events")
