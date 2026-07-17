"""fix cases table structure to match model

Revision ID: fix_cases_table_001
Revises: 042b575a9fe3
Create Date: 2025-10-15 05:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'fix_cases_table_001'
down_revision = '042b575a9fe3'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'cases' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('cases')}
        
        # Drop columns that shouldn't exist
        columns_to_drop = ['user_id', 'title', 'description', 'metadata', 'closed_at']
        for col in columns_to_drop:
            if col in existing_columns:
                op.drop_column('cases', col)
        
        # Add missing columns
        if 'user_hash' not in existing_columns:
            op.add_column('cases', sa.Column('user_hash', sa.String(), nullable=True))
        
        if 'session_id' not in existing_columns:
            op.add_column('cases', sa.Column('session_id', sa.String(), nullable=True))
        
        if 'summary_redacted' not in existing_columns:
            op.add_column('cases', sa.Column('summary_redacted', sa.Text(), nullable=True))
        
        if 'sla_breach_at' not in existing_columns:
            op.add_column('cases', sa.Column('sla_breach_at', sa.DateTime(timezone=True), nullable=True))
        
        if 'closure_reason' not in existing_columns:
            op.add_column('cases', sa.Column('closure_reason', sa.Text(), nullable=True))
        
        # Make user_hash NOT NULL after adding it (if there's data, would need to update first)
        # For now, keeping it nullable to avoid issues with existing data


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'cases' in inspector.get_table_names():
        existing_columns = {col['name'] for col in inspector.get_columns('cases')}
        
        # Remove added columns
        columns_to_remove = ['user_hash', 'session_id', 'summary_redacted', 'sla_breach_at', 'closure_reason']
        for col in columns_to_remove:
            if col in existing_columns:
                op.drop_column('cases', col)
        
        # Re-add original columns
        if 'user_id' not in existing_columns:
            op.add_column('cases', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True))
        
        if 'title' not in existing_columns:
            op.add_column('cases', sa.Column('title', sa.String(255), nullable=True))
        
        if 'description' not in existing_columns:
            op.add_column('cases', sa.Column('description', sa.Text(), nullable=True))
        
        if 'metadata' not in existing_columns:
            op.add_column('cases', sa.Column('metadata', sa.JSON(), nullable=True))
        
        if 'closed_at' not in existing_columns:
            op.add_column('cases', sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True))
