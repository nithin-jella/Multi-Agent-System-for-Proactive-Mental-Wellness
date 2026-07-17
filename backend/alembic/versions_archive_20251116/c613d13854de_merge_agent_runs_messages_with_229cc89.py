"""A Mako template for creating Alembic migration scripts.

This template is used by the ``alembic revision`` command to generate
a new migration script.

"""
import sqlalchemy as sa
from alembic import op # type: ignore
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c613d13854de'
down_revision = ('20250922a1c6e', '229cc89f0375')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
