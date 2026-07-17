"""add telegram username to users

Revision ID: a3d1a4b2c9f1
Revises: 61c26307ac64
Create Date: 2026-01-09

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a3d1a4b2c9f1"
down_revision = "61c26307ac64"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_username", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "telegram_username")
