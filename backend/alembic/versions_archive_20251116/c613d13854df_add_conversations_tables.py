"""add conversations and user_summaries tables

Revision ID: c613d13854df
Revises: c613d13854de
Create Date: 2025-01-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c613d13854df'
down_revision = 'c613d13854de'
branch_labels = None
depends_on = None


def upgrade():
    # Get inspector for idempotent checks
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Create conversations table if it doesn't exist
    if 'conversations' not in existing_tables:
        op.create_table('conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('response', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
        op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)
        op.create_index(op.f('ix_conversations_session_id'), 'conversations', ['session_id'], unique=False)
        op.create_index(op.f('ix_conversations_conversation_id'), 'conversations', ['conversation_id'], unique=False)

    # Create user_summaries table if it doesn't exist
    if 'user_summaries' not in existing_tables:
        op.create_table('user_summaries',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('summarized_session_id', sa.String(), nullable=True),
        sa.Column('summary_text', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
        op.create_index(op.f('ix_user_summaries_user_id'), 'user_summaries', ['user_id'], unique=False)
        op.create_index(op.f('ix_user_summaries_summarized_session_id'), 'user_summaries', ['summarized_session_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_user_summaries_summarized_session_id'), table_name='user_summaries')
    op.drop_index(op.f('ix_user_summaries_user_id'), table_name='user_summaries')
    op.drop_table('user_summaries')
    
    op.drop_index(op.f('ix_conversations_conversation_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_session_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_id'), table_name='conversations')
    op.drop_table('conversations')
