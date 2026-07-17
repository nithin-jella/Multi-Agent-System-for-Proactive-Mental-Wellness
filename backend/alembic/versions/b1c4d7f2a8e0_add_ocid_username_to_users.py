"""add ocid_username to users

Revision ID: b1c4d7f2a8e0
Revises: a3f1e9c2d0b7
Create Date: 2025-01-01 00:00:00.000000

Adds the `ocid_username` column to the `users` table so that an Open Campus ID
can be associated with a user account. The column is nullable, unique, and
indexed — consistent with `google_sub` and `twitter_id`.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "b1c4d7f2a8e0"
down_revision = "a3f1e9c2d0b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ocid_username", sa.String(), nullable=True),
    )
    op.create_unique_constraint("uq_users_ocid_username", "users", ["ocid_username"])
    op.create_index("ix_users_ocid_username", "users", ["ocid_username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_ocid_username", table_name="users")
    op.drop_constraint("uq_users_ocid_username", "users", type_="unique")
    op.drop_column("users", "ocid_username")
