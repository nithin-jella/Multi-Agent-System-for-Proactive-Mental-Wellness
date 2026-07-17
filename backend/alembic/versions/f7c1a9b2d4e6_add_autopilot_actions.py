"""add autopilot actions control plane table

Revision ID: f7c1a9b2d4e6
Revises: 9e1c2b7d4f10
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa


revision = "f7c1a9b2d4e6"
down_revision = "9e1c2b7d4f10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    action_type_enum = sa.Enum(
        "create_checkin",
        "create_case",
        "mint_badge",
        "publish_attestation",
        name="autopilot_action_type",
        native_enum=False,
    )
    policy_decision_enum = sa.Enum(
        "allow",
        "require_approval",
        "deny",
        name="autopilot_policy_decision",
        native_enum=False,
    )
    status_enum = sa.Enum(
        "queued",
        "awaiting_approval",
        "approved",
        "running",
        "confirmed",
        "failed",
        "dead_letter",
        name="autopilot_action_status",
        native_enum=False,
    )

    op.create_table(
        "autopilot_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("action_type", action_type_enum, nullable=False),
        sa.Column("risk_level", sa.String(length=16), nullable=False),
        sa.Column("policy_decision", policy_decision_enum, nullable=False),
        sa.Column("status", status_enum, nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("requires_human_review", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approval_notes", sa.Text(), nullable=True),
        sa.Column("tx_hash", sa.String(length=255), nullable=True),
        sa.Column("chain_id", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_autopilot_actions_idempotency_key"),
    )

    op.create_index("ix_autopilot_actions_id", "autopilot_actions", ["id"], unique=False)
    op.create_index("ix_autopilot_actions_action_type", "autopilot_actions", ["action_type"], unique=False)
    op.create_index("ix_autopilot_actions_risk_level", "autopilot_actions", ["risk_level"], unique=False)
    op.create_index("ix_autopilot_actions_policy_decision", "autopilot_actions", ["policy_decision"], unique=False)
    op.create_index("ix_autopilot_actions_status", "autopilot_actions", ["status"], unique=False)
    op.create_index("ix_autopilot_actions_idempotency_key", "autopilot_actions", ["idempotency_key"], unique=False)
    op.create_index("ix_autopilot_actions_payload_hash", "autopilot_actions", ["payload_hash"], unique=False)
    op.create_index("ix_autopilot_actions_requires_human_review", "autopilot_actions", ["requires_human_review"], unique=False)
    op.create_index("ix_autopilot_actions_approved_by", "autopilot_actions", ["approved_by"], unique=False)
    op.create_index("ix_autopilot_actions_tx_hash", "autopilot_actions", ["tx_hash"], unique=False)
    op.create_index("ix_autopilot_actions_chain_id", "autopilot_actions", ["chain_id"], unique=False)
    op.create_index("ix_autopilot_actions_next_retry_at", "autopilot_actions", ["next_retry_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_autopilot_actions_next_retry_at", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_chain_id", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_tx_hash", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_approved_by", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_requires_human_review", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_payload_hash", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_idempotency_key", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_status", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_policy_decision", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_risk_level", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_action_type", table_name="autopilot_actions")
    op.drop_index("ix_autopilot_actions_id", table_name="autopilot_actions")
    op.drop_table("autopilot_actions")
