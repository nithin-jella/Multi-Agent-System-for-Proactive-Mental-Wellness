"""add appointments tables

Revision ID: 196e622e299
Revises: 9d8d0d55a48a
Create Date: 2025-10-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '196e622e2990'
down_revision = '9d8d0d55a48a'
branch_labels = None
depends_on = None


def upgrade():
    # Get inspector for idempotent checks
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Create psychologists table if it doesn't exist
    if 'psychologists' not in existing_tables:
        op.create_table('psychologists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('specialization', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('is_available', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
        op.create_index(op.f('ix_psychologists_id'), 'psychologists', ['id'], unique=False)
    
    # Create appointment_types table if it doesn't exist
    if 'appointment_types' not in existing_tables:
        op.create_table('appointment_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
        op.create_index(op.f('ix_appointment_types_id'), 'appointment_types', ['id'], unique=False)
    
    # Create appointments table if it doesn't exist
    if 'appointments' not in existing_tables:
        op.create_table('appointments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('psychologist_id', sa.Integer(), nullable=False),
        sa.Column('appointment_type_id', sa.Integer(), nullable=False),
        sa.Column('appointment_datetime', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['psychologist_id'], ['psychologists.id'], ),
        sa.ForeignKeyConstraint(['appointment_type_id'], ['appointment_types.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
        op.create_index(op.f('ix_appointments_id'), 'appointments', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_appointments_id'), table_name='appointments')
    op.drop_table('appointments')
    op.drop_index(op.f('ix_appointment_types_id'), table_name='appointment_types')
    op.drop_table('appointment_types')
    op.drop_index(op.f('ix_psychologists_id'), table_name='psychologists')
    op.drop_table('psychologists')
