"""update content resource storage fields

Revision ID: d2f6c9f0d7a5
Revises: add_flagged_sessions_tags_notes
Create Date: 2025-09-16 06:15:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd2f6c9f0d7a5'
down_revision = 'add_flagged_sessions_tags_notes'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('content_resources', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('content_resources', sa.Column('tags', sa.JSON(), nullable=True, server_default='[]'))
    op.add_column('content_resources', sa.Column('metadata', sa.JSON(), nullable=True, server_default='{}'))
    op.add_column('content_resources', sa.Column('mime_type', sa.String(length=100), nullable=True))
    op.add_column('content_resources', sa.Column('storage_backend', sa.String(length=50), nullable=False, server_default='database'))
    op.add_column('content_resources', sa.Column('object_storage_key', sa.String(length=255), nullable=True))
    op.add_column('content_resources', sa.Column('object_storage_bucket', sa.String(length=255), nullable=True))
    op.add_column('content_resources', sa.Column('embedding_status', sa.String(length=50), nullable=False, server_default='pending'))
    op.add_column('content_resources', sa.Column('embedding_last_processed_at', sa.DateTime(), nullable=True))
    op.add_column('content_resources', sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'))

    # remove server defaults to keep application-level defaults only
    op.alter_column('content_resources', 'tags', server_default=None)
    op.alter_column('content_resources', 'metadata', server_default=None)
    op.alter_column('content_resources', 'storage_backend', server_default=None)
    op.alter_column('content_resources', 'embedding_status', server_default=None)
    op.alter_column('content_resources', 'chunk_count', server_default=None)


def downgrade():
    op.drop_column('content_resources', 'chunk_count')
    op.drop_column('content_resources', 'embedding_last_processed_at')
    op.drop_column('content_resources', 'embedding_status')
    op.drop_column('content_resources', 'object_storage_bucket')
    op.drop_column('content_resources', 'object_storage_key')
    op.drop_column('content_resources', 'storage_backend')
    op.drop_column('content_resources', 'mime_type')
    op.drop_column('content_resources', 'metadata')
    op.drop_column('content_resources', 'tags')
    op.drop_column('content_resources', 'description')
