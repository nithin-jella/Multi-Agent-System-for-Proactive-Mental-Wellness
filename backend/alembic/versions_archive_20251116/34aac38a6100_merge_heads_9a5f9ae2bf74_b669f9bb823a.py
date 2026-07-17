"""A Mako template for creating Alembic migration scripts.

This template is used by the ``alembic revision`` command to generate
a new migration script.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '34aac38a6100'
down_revision = ('9a5f9ae2bf74', 'b669f9bb823a')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
