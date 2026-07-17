"""add auto-award fields to badge templates

Revision ID: 9e1c2b7d4f10
Revises: d4e2f7a8b1c3
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "9e1c2b7d4f10"
down_revision = "d4e2f7a8b1c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "badge_templates",
        sa.Column("auto_award_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "badge_templates",
        sa.Column("auto_award_action", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "badge_templates",
        sa.Column("auto_award_criteria", sa.JSON(), nullable=True),
    )
    op.create_index(
        "ix_badge_templates_auto_award_action",
        "badge_templates",
        ["auto_award_action"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_badge_templates_auto_award_action", table_name="badge_templates")
    op.drop_column("badge_templates", "auto_award_criteria")
    op.drop_column("badge_templates", "auto_award_action")
    op.drop_column("badge_templates", "auto_award_enabled")
