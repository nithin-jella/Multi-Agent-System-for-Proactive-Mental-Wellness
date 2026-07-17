"""add admin badge templates and issuances

Revision ID: c2a1f8e1d1a0
Revises: b7f2c1d9e6a0
Create Date: 2026-01-09

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c2a1f8e1d1a0"
down_revision = "b7f2c1d9e6a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "badge_templates",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("contract_address", sa.String(length=64), nullable=False),
        sa.Column("token_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_cid", sa.String(length=128), nullable=True),
        sa.Column("image_mime", sa.String(length=64), nullable=True),
        sa.Column("image_filename", sa.String(length=255), nullable=True),
        sa.Column("metadata_cid", sa.String(length=128), nullable=True),
        sa.Column("metadata_uri", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'DRAFT'"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("contract_address", "token_id", name="uq_badge_templates_contract_token"),
    )
    op.create_index("ix_badge_templates_contract_address", "badge_templates", ["contract_address"], unique=False)
    op.create_index("ix_badge_templates_token_id", "badge_templates", ["token_id"], unique=False)
    op.create_index("ix_badge_templates_status", "badge_templates", ["status"], unique=False)

    op.create_table(
        "badge_issuances",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("badge_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "requested_by_admin_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("wallet_address", sa.String(length=64), nullable=False),
        sa.Column("amount", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("tx_hash", sa.String(length=128), unique=True, nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column("error_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("template_id", "user_id", name="uq_badge_issuances_template_user"),
    )
    op.create_index("ix_badge_issuances_template_id", "badge_issuances", ["template_id"], unique=False)
    op.create_index("ix_badge_issuances_user_id", "badge_issuances", ["user_id"], unique=False)
    op.create_index("ix_badge_issuances_wallet_address", "badge_issuances", ["wallet_address"], unique=False)
    op.create_index("ix_badge_issuances_requested_by_admin_id", "badge_issuances", ["requested_by_admin_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_badge_issuances_requested_by_admin_id", table_name="badge_issuances")
    op.drop_index("ix_badge_issuances_wallet_address", table_name="badge_issuances")
    op.drop_index("ix_badge_issuances_user_id", table_name="badge_issuances")
    op.drop_index("ix_badge_issuances_template_id", table_name="badge_issuances")
    op.drop_table("badge_issuances")

    op.drop_index("ix_badge_templates_status", table_name="badge_templates")
    op.drop_index("ix_badge_templates_token_id", table_name="badge_templates")
    op.drop_index("ix_badge_templates_contract_address", table_name="badge_templates")
    op.drop_table("badge_templates")
