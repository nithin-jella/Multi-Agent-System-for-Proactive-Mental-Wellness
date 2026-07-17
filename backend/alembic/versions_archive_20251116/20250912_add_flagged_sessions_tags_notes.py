"""add flagged_sessions tags and notes

Revision ID: add_flagged_sessions_tags_notes
Revises: 92227960c1f8
Create Date: 2025-09-12
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_flagged_sessions_tags_notes'
down_revision = '92227960c1f8'  # Fixed: was None, now points to users table creation
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'flagged_sessions' not in tables:
        op.create_table(
            'flagged_sessions',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
            sa.Column('session_id', sa.String(), nullable=False, index=True),
            sa.Column('user_id', sa.Integer(), nullable=True, index=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('tags', sa.JSON(), nullable=True),
            sa.Column('status', sa.String(), nullable=False, server_default='open'),
            sa.Column('flagged_by_admin_id', sa.Integer(), nullable=True, index=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )
    else:
        cols = {c['name'] for c in inspector.get_columns('flagged_sessions')}
        if 'notes' not in cols:
            op.add_column('flagged_sessions', sa.Column('notes', sa.Text(), nullable=True))
        if 'tags' not in cols:
            op.add_column('flagged_sessions', sa.Column('tags', sa.JSON(), nullable=True))


def downgrade():
    # Non-destructive downgrade: drop added columns if exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if 'flagged_sessions' in tables:
        cols = {c['name'] for c in inspector.get_columns('flagged_sessions')}
        if 'tags' in cols:
            op.drop_column('flagged_sessions', 'tags')
        if 'notes' in cols:
            op.drop_column('flagged_sessions', 'notes')
