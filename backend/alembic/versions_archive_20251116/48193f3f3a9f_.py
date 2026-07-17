"""A Mako template for creating Alembic migration scripts.

This template is used by the ``alembic revision`` command to generate
a new migration script.

"""
from alembic import op
from alembic.operations import Operations
import sqlalchemy as sa
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '48193f3f3a9f'
down_revision = ('add_flagged_sessions_tags_notes', 'e574b9ff31e8')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
