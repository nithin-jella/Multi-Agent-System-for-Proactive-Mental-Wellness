
"""Create users table

Revision ID: 92227960c1f8
Revises: 
Create Date: 2025-08-25 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '92227960c1f8'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Get inspector for idempotent checks
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Create users table if it doesn't exist
    if 'users' not in existing_tables:
        op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('google_sub', sa.String(), nullable=True),
        sa.Column('twitter_id', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('first_name', sa.String(), nullable=True),
        sa.Column('last_name', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('university', sa.String(), nullable=True),
        sa.Column('major', sa.String(), nullable=True),
        sa.Column('year_of_study', sa.String(), nullable=True),
        sa.Column('sentiment_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('wallet_address', sa.String(), nullable=True),
        sa.Column('role', sa.String(), server_default='user', nullable=False),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('email_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('current_streak', sa.Integer(), server_default='0', nullable=False),
        sa.Column('longest_streak', sa.Integer(), server_default='0', nullable=False),
        sa.Column('last_activity_date', sa.Date(), nullable=True),
        sa.Column('allow_email_checkins', sa.Boolean(), server_default='true', nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_google_sub'), 'users', ['google_sub'], unique=True)
        op.create_index(op.f('ix_users_twitter_id'), 'users', ['twitter_id'], unique=True)
        op.create_index(op.f('ix_users_wallet_address'), 'users', ['wallet_address'], unique=True)
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)


def downgrade():
    op.drop_table('users')
