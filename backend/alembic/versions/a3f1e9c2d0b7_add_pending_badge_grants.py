"""add_pending_badge_grants

Revision ID: a3f1e9c2d0b7
Revises: e1a6d9c4b2f3
Create Date: 2026-02-25 00:00:00.000000

Creates the ``pending_badge_grants`` table which stores badge eligibility for users
who have no linked wallet at the time they qualify.  On wallet linkage the rows are
drained and each badge is retroactively minted on-chain.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "a3f1e9c2d0b7"
down_revision = "e1a6d9c4b2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_badge_grants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("badge_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("qualified_at", sa.DateTime(), nullable=False),
        sa.Column("action_context", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "badge_id", name="_user_pending_badge_uc"),
    )
    op.create_index(op.f("ix_pending_badge_grants_id"), "pending_badge_grants", ["id"], unique=False)
    op.create_index(op.f("ix_pending_badge_grants_user_id"), "pending_badge_grants", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_pending_badge_grants_user_id"), table_name="pending_badge_grants")
    op.drop_index(op.f("ix_pending_badge_grants_id"), table_name="pending_badge_grants")
    op.drop_table("pending_badge_grants")
