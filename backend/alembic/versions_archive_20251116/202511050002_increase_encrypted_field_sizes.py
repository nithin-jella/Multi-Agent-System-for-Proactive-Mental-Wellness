"""increase_encrypted_field_sizes

Increase VARCHAR sizes for encrypted fields in normalized user tables.
Encrypted data (Fernet) is ~150 characters for short strings.

Revision ID: 202511050002
Revises: 202511050001
Create Date: 2025-11-05 19:26:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202511050002'
down_revision = '202511050001'
branch_labels = None
depends_on = None


def upgrade():
    """Increase column sizes for encrypted data in user_profiles, user_preferences, user_emergency_contacts."""
    
    # user_profiles table - increase encrypted string fields
    op.alter_column('user_profiles', 'first_name', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_profiles', 'last_name', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_profiles', 'preferred_name', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_profiles', 'pronouns', type_=sa.String(200), existing_type=sa.String(50))
    op.alter_column('user_profiles', 'phone', type_=sa.String(200), existing_type=sa.String(20))
    op.alter_column('user_profiles', 'alternate_phone', type_=sa.String(200), existing_type=sa.String(20))
    op.alter_column('user_profiles', 'city', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_profiles', 'province', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_profiles', 'country', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_profiles', 'faculty', type_=sa.String(200), existing_type=sa.String(150))
    op.alter_column('user_profiles', 'department', type_=sa.String(200), existing_type=sa.String(150))
    op.alter_column('user_profiles', 'major', type_=sa.String(200), existing_type=sa.String(150))
    op.alter_column('user_profiles', 'student_id', type_=sa.String(200), existing_type=sa.String(50))
    op.alter_column('user_profiles', 'profile_photo_url', type_=sa.Text(), existing_type=sa.String(500))
    op.alter_column('user_profiles', 'profile_photo_storage_key', type_=sa.String(300), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'bio', type_=sa.Text(), existing_type=sa.String(500))
    
    # user_preferences table - increase encrypted string fields (only fields that exist)
    op.alter_column('user_preferences', 'preferred_language', type_=sa.String(200), existing_type=sa.String(10))
    op.alter_column('user_preferences', 'preferred_timezone', type_=sa.String(200), existing_type=sa.String(50))
    op.alter_column('user_preferences', 'aika_personality', type_=sa.String(200), existing_type=sa.String(20))
    op.alter_column('user_preferences', 'aika_response_length', type_=sa.String(200), existing_type=sa.String(20))
    # accessibility_notes already TEXT
    # No communication_preferences or interface_preferences columns in actual table
    
    # user_emergency_contacts table - increase encrypted string fields
    op.alter_column('user_emergency_contacts', 'full_name', type_=sa.String(250), existing_type=sa.String(200))
    op.alter_column('user_emergency_contacts', 'relationship_to_user', type_=sa.String(200), existing_type=sa.String(100))
    op.alter_column('user_emergency_contacts', 'phone', type_=sa.String(200), existing_type=sa.String(20))
    op.alter_column('user_emergency_contacts', 'alternate_phone', type_=sa.String(200), existing_type=sa.String(20))
    op.alter_column('user_emergency_contacts', 'email', type_=sa.String(300), existing_type=sa.String(255))
    op.alter_column('user_emergency_contacts', 'address', type_=sa.Text(), existing_type=sa.String(500))
    op.alter_column('user_emergency_contacts', 'notes', type_=sa.Text(), existing_type=sa.String(1000))


def downgrade():
    """Revert column sizes back to original (may cause data truncation!)"""
    
    # user_profiles table - revert to original sizes
    op.alter_column('user_profiles', 'first_name', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'last_name', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'preferred_name', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'pronouns', type_=sa.String(50), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'phone', type_=sa.String(20), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'alternate_phone', type_=sa.String(20), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'city', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'province', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'country', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'faculty', type_=sa.String(150), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'department', type_=sa.String(150), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'major', type_=sa.String(150), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'student_id', type_=sa.String(50), existing_type=sa.String(200))
    op.alter_column('user_profiles', 'profile_photo_url', type_=sa.String(500), existing_type=sa.Text())
    op.alter_column('user_profiles', 'profile_photo_storage_key', type_=sa.String(200), existing_type=sa.String(300))
    op.alter_column('user_profiles', 'bio', type_=sa.String(500), existing_type=sa.Text())
    
    # user_preferences table - revert to original sizes
    op.alter_column('user_preferences', 'preferred_language', type_=sa.String(10), existing_type=sa.String(200))
    op.alter_column('user_preferences', 'preferred_timezone', type_=sa.String(50), existing_type=sa.String(200))
    op.alter_column('user_preferences', 'aika_personality', type_=sa.String(20), existing_type=sa.String(200))
    op.alter_column('user_preferences', 'aika_response_length', type_=sa.String(20), existing_type=sa.String(200))
    
    # user_emergency_contacts table - revert to original sizes
    op.alter_column('user_emergency_contacts', 'full_name', type_=sa.String(200), existing_type=sa.String(250))
    op.alter_column('user_emergency_contacts', 'relationship_to_user', type_=sa.String(100), existing_type=sa.String(200))
    op.alter_column('user_emergency_contacts', 'phone', type_=sa.String(20), existing_type=sa.String(200))
    op.alter_column('user_emergency_contacts', 'alternate_phone', type_=sa.String(20), existing_type=sa.String(200))
    op.alter_column('user_emergency_contacts', 'email', type_=sa.String(255), existing_type=sa.String(300))
    op.alter_column('user_emergency_contacts', 'address', type_=sa.String(500), existing_type=sa.Text())
    op.alter_column('user_emergency_contacts', 'notes', type_=sa.String(1000), existing_type=sa.Text())
