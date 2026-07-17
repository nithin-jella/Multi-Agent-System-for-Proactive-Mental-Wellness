"""A Mako template for creating Alembic migration scripts.

This template is used by the ``alembic revision`` command to generate
a new migration script.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9d8d0d55a48a'
down_revision = ('48193f3f3a9f', 'd2f6c9f0d7a5')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
