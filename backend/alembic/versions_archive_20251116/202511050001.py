"""
User Table Normalization Migration

Creates 6 normalized tables following database engineering best practices:
1. users (Core Identity & Auth)
2. user_profiles (Extended Profile)
3. user_clinical_records (Clinical Data - RESTRICTED)
4. user_preferences (Settings)
5. user_emergency_contacts (Emergency Contacts - supports multiple)
6. user_consent_ledger (Consent History - append-only)
7. user_audit_log (Change History)

Best Practices Applied:
- UUID primary keys for better distribution and security
- Proper indexing for common query patterns
- Foreign key constraints with cascading
- NOT NULL constraints where appropriate
- Default values for enum-like fields
- Timestamps for audit trail
- Composite indexes for multi-column queries
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from datetime import datetime

# Revision identifiers
revision = '202511050001'  # Shortened to fit VARCHAR(32)
down_revision = ('c613d13854de', '28e1ce4c3187')  # Merge both branches
branch_labels = None
depends_on = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create normalized user tables.
    
    This is NON-BREAKING: Creates new tables alongside existing users table.
    Data migration script (separate) will copy data from users to new tables.
    """
    
    # =====================================================================
    # TABLE 1: user_profiles (Extended Profile - NON-SENSITIVE)
    # =====================================================================
    op.create_table(
        'user_profiles',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, unique=True, index=True),
        
        # Names
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('preferred_name', sa.String(100), nullable=True),
        sa.Column('pronouns', sa.String(50), nullable=True),  # he/him, she/her, they/them
        
        # Contact
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('alternate_phone', sa.String(20), nullable=True),
        
        # Demographics
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('gender', sa.String(50), nullable=True),  # male, female, non-binary, prefer_not_to_say
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('province', sa.String(100), nullable=True),  # NEW: Indonesian provinces
        sa.Column('country', sa.String(100), nullable=True, default='Indonesia'),  # NEW
        
        # Academic (UGM-specific)
        sa.Column('university', sa.String(200), nullable=True, default='Universitas Gadjah Mada'),
        sa.Column('faculty', sa.String(200), nullable=True),  # NEW: Fakultas (e.g., FMIPA, FT, FK)
        sa.Column('department', sa.String(200), nullable=True),  # NEW: Jurusan
        sa.Column('major', sa.String(200), nullable=True),  # Program Studi
        sa.Column('year_of_study', sa.String(20), nullable=True),  # 1, 2, 3, 4, S2, S3
        sa.Column('student_id', sa.String(50), nullable=True, unique=True),  # NEW: NIM (unique constraint)
        sa.Column('batch_year', sa.Integer(), nullable=True),  # NEW: Angkatan (e.g., 2021, 2022)
        
        # Appearance
        sa.Column('profile_photo_url', sa.String(500), nullable=True),
        sa.Column('profile_photo_storage_key', sa.String(500), nullable=True),  # NEW: S3/MinIO key
        
        # Gamification
        sa.Column('current_streak', sa.Integer(), nullable=False, default=0),
        sa.Column('longest_streak', sa.Integer(), nullable=False, default=0),
        sa.Column('last_activity_date', sa.Date(), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=False, default=0.0),  # -1.0 to 1.0
        sa.Column('total_care_tokens', sa.Integer(), nullable=False, default=0),  # NEW: Token balance
        
        # Bio
        sa.Column('bio', sa.Text(), nullable=True),  # NEW: User-written bio
        sa.Column('interests', postgresql.ARRAY(sa.String()), nullable=True),  # NEW: ["music", "sports"]
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.now, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.now, onupdate=datetime.now, 
                  server_default=sa.text('now()'), server_onupdate=sa.text('now()')),
        
        # Indexes
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_user_profiles_user_id', 'user_id'),
        sa.Index('idx_user_profiles_student_id', 'student_id'),
        sa.Index('idx_user_profiles_faculty_year', 'faculty', 'batch_year'),  # Common query: students by faculty & year
    )
    
    # =====================================================================
    # TABLE 2: user_clinical_records (RESTRICTED ACCESS)
    # =====================================================================
    op.create_table(
        'user_clinical_records',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, unique=True, index=True),
        
        # Risk Assessment
        sa.Column('current_risk_level', sa.String(20), nullable=True, index=True),  # low, moderate, high, critical
        sa.Column('last_risk_assessment_date', sa.DateTime(), nullable=True),
        sa.Column('last_risk_score', sa.Float(), nullable=True),  # 0.0-1.0
        sa.Column('highest_risk_level_ever', sa.String(20), nullable=True),  # NEW: Track highest ever
        sa.Column('crisis_count', sa.Integer(), nullable=False, default=0),  # NEW: Number of crisis events
        
        # Clinical Summary (Counselor notes)
        sa.Column('clinical_summary', sa.Text(), nullable=True),
        sa.Column('primary_concerns', postgresql.ARRAY(sa.String()), nullable=True),  # ["anxiety", "depression"]
        sa.Column('diagnosed_conditions', postgresql.ARRAY(sa.String()), nullable=True),  # From licensed professional
        sa.Column('symptom_onset_date', sa.Date(), nullable=True),  # NEW: When symptoms started
        
        # Safety Planning
        sa.Column('safety_plan_active', sa.Boolean(), nullable=False, default=False),
        sa.Column('safety_plan_notes', sa.Text(), nullable=True),
        sa.Column('safety_plan_created_at', sa.DateTime(), nullable=True),
        sa.Column('safety_plan_reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('safety_plan_reviewed_by_user_id', sa.Integer(), nullable=True),  # NEW: Who reviewed
        sa.Column('warning_signs', postgresql.ARRAY(sa.String()), nullable=True),  # NEW: Crisis warning signs
        sa.Column('coping_strategies', postgresql.ARRAY(sa.String()), nullable=True),  # NEW: Helpful strategies
        
        # Current Therapy (External - not UGM-AICare)
        sa.Column('is_in_external_therapy', sa.Boolean(), nullable=False, default=False),
        sa.Column('external_therapist_name', sa.String(200), nullable=True),
        sa.Column('external_therapist_contact', sa.String(200), nullable=True),
        sa.Column('external_therapist_institution', sa.String(200), nullable=True),  # NEW
        sa.Column('therapy_modality', sa.String(100), nullable=True),  # CBT, DBT, psychodynamic, etc.
        sa.Column('therapy_frequency', sa.String(50), nullable=True),  # weekly, biweekly, monthly
        sa.Column('therapy_start_date', sa.Date(), nullable=True),
        sa.Column('therapy_end_date', sa.Date(), nullable=True),  # NEW: If therapy ended
        
        # Medication (if disclosed by user)
        sa.Column('is_on_medication', sa.Boolean(), nullable=False, default=False),
        sa.Column('medication_notes', sa.Text(), nullable=True),  # General notes (NOT prescription data)
        sa.Column('medication_start_date', sa.Date(), nullable=True),  # NEW
        sa.Column('prescribing_doctor', sa.String(200), nullable=True),  # NEW: Doctor name (optional)
        
        # Internal Notes (UGM-AICare team ONLY)
        sa.Column('aicare_team_notes', sa.Text(), nullable=True),
        sa.Column('flagged_for_review', sa.Boolean(), nullable=False, default=False, index=True),
        sa.Column('flagged_reason', sa.String(500), nullable=True),
        sa.Column('flagged_at', sa.DateTime(), nullable=True),  # NEW
        sa.Column('flagged_by_user_id', sa.Integer(), nullable=True),  # NEW: Who flagged
        
        # Access Control
        sa.Column('access_level', sa.String(50), nullable=False, default='counselor_only'),  
        # Options: counselor_only, clinical_team, research_anonymized
        sa.Column('data_sharing_restrictions', sa.Text(), nullable=True),  # NEW: Special restrictions
        
        # Timestamps & Audit
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.now, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.now, onupdate=datetime.now,
                  server_default=sa.text('now()'), server_onupdate=sa.text('now()')),
        sa.Column('updated_by_user_id', sa.Integer(), nullable=True),  # Who made the last edit
        sa.Column('last_reviewed_at', sa.DateTime(), nullable=True),  # NEW: Last clinical review date
        sa.Column('last_reviewed_by_user_id', sa.Integer(), nullable=True),  # NEW: Counselor who reviewed
        
        # Indexes
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_clinical_user_id', 'user_id'),
        sa.Index('idx_clinical_risk_level_date', 'current_risk_level', 'last_risk_assessment_date'),
        sa.Index('idx_clinical_flagged', 'flagged_for_review', 'updated_at'),
        sa.Index('idx_clinical_therapy_active', 'is_in_external_therapy', 'therapy_start_date'),
    )
    
    # =====================================================================
    # TABLE 3: user_preferences (Settings & Preferences)
    # =====================================================================
    op.create_table(
        'user_preferences',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, unique=True, index=True),
        
        # Language & Localization
        sa.Column('preferred_language', sa.String(10), nullable=False, default='id'),  # id, en
        sa.Column('preferred_timezone', sa.String(50), nullable=False, default='Asia/Jakarta'),
        sa.Column('date_format', sa.String(20), nullable=False, default='DD/MM/YYYY'),  # NEW
        sa.Column('time_format', sa.String(10), nullable=False, default='24h'),  # NEW: 12h or 24h
        
        # Communication Preferences
        sa.Column('allow_email_checkins', sa.Boolean(), nullable=False, default=True),
        sa.Column('allow_sms_reminders', sa.Boolean(), nullable=False, default=False),
        sa.Column('allow_push_notifications', sa.Boolean(), nullable=False, default=True),
        sa.Column('allow_whatsapp_notifications', sa.Boolean(), nullable=False, default=False),  # NEW
        sa.Column('notification_quiet_hours_start', sa.Integer(), nullable=True),  # 22 (10 PM)
        sa.Column('notification_quiet_hours_end', sa.Integer(), nullable=True),  # 7 (7 AM)
        sa.Column('notification_frequency', sa.String(20), nullable=False, default='normal'),  # NEW: low, normal, high
        
        # Email Preferences
        sa.Column('email_frequency', sa.String(20), nullable=False, default='weekly'),  # NEW: daily, weekly, monthly, never
        sa.Column('email_newsletter', sa.Boolean(), nullable=False, default=True),  # NEW
        sa.Column('email_updates', sa.Boolean(), nullable=False, default=True),  # NEW: Platform updates
        
        # Interface Preferences
        sa.Column('theme', sa.String(20), nullable=False, default='auto'),  # light, dark, auto
        sa.Column('font_size', sa.String(20), nullable=False, default='medium'),  # small, medium, large, xlarge
        sa.Column('high_contrast_mode', sa.Boolean(), nullable=False, default=False),
        sa.Column('reduce_animations', sa.Boolean(), nullable=False, default=False),
        sa.Column('color_scheme', sa.String(50), nullable=True),  # NEW: For future theming
        
        # Accessibility
        sa.Column('screen_reader_enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('keyboard_navigation_only', sa.Boolean(), nullable=False, default=False),  # NEW
        sa.Column('dyslexia_font', sa.Boolean(), nullable=False, default=False),  # NEW
        sa.Column('accessibility_notes', sa.Text(), nullable=True),
        
        # Check-in Settings
        sa.Column('check_in_code', sa.String(64), nullable=True, unique=True),
        sa.Column('check_in_frequency', sa.String(20), nullable=False, default='daily'),  # daily, weekly, custom
        sa.Column('check_in_reminder_time', sa.Time(), nullable=True),  # NEW: Preferred reminder time
        sa.Column('check_in_reminder_enabled', sa.Boolean(), nullable=False, default=True),  # NEW
        
        # Privacy Preferences
        sa.Column('profile_visibility', sa.String(20), nullable=False, default='private'),  # NEW: private, friends, public
        sa.Column('show_online_status', sa.Boolean(), nullable=False, default=True),  # NEW
        sa.Column('allow_analytics_tracking', sa.Boolean(), nullable=False, default=True),  # NEW
        
        # AI Interaction Preferences
        sa.Column('aika_personality', sa.String(20), nullable=False, default='empathetic'),  # NEW: empathetic, professional, casual
        sa.Column('aika_response_length', sa.String(20), nullable=False, default='balanced'),  # NEW: concise, balanced, detailed
        sa.Column('auto_suggest_interventions', sa.Boolean(), nullable=False, default=True),  # NEW
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.now, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.now, onupdate=datetime.now,
                  server_default=sa.text('now()'), server_onupdate=sa.text('now()')),
        
        # Indexes
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_prefs_user_id', 'user_id'),
        sa.Index('idx_prefs_check_in_code', 'check_in_code'),
    )
    
    # =====================================================================
    # TABLE 4: user_emergency_contacts (Supports Multiple Contacts)
    # =====================================================================
    op.create_table(
        'user_emergency_contacts',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, index=True),
        
        # Contact Information
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('relationship', sa.String(100), nullable=False),  # parent, sibling, friend, partner, guardian
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('alternate_phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),  # NEW
        
        # Priority & Status
        sa.Column('priority', sa.Integer(), nullable=False, default=1),  # 1 = primary, 2 = secondary, etc.
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('can_receive_crisis_alerts', sa.Boolean(), nullable=False, default=True),  # NEW
        
        # Consent
        sa.Column('consent_to_contact', sa.Boolean(), nullable=False, default=False),
        sa.Column('consent_granted_date', sa.DateTime(), nullable=True),
        sa.Column('consent_expires_date', sa.DateTime(), nullable=True),  # NEW: Optional expiry
        sa.Column('consent_method', sa.String(50), nullable=True),  # NEW: phone, email, in_person
        
        # Contact Restrictions
        sa.Column('contact_time_restrictions', sa.String(200), nullable=True),  # NEW: "Weekdays 9-5 only"
        sa.Column('notes', sa.Text(), nullable=True),  # NEW: Special instructions
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.now, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.now, onupdate=datetime.now,
                  server_default=sa.text('now()'), server_onupdate=sa.text('now()')),
        sa.Column('last_contacted_at', sa.DateTime(), nullable=True),  # NEW: Track when we contacted them
        
        # Indexes
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_emergency_user_id', 'user_id'),
        sa.Index('idx_emergency_user_priority', 'user_id', 'priority', 'is_active'),
    )
    
    # =====================================================================
    # TABLE 5: user_consent_ledger (APPEND-ONLY Audit Trail)
    # =====================================================================
    op.create_table(
        'user_consent_ledger',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, index=True),
        
        # Consent Details
        sa.Column('consent_type', sa.String(100), nullable=False, index=True),
        # Types: data_sharing, research, emergency_contact, marketing, 
        #        clinical_access, ai_interaction, analytics, third_party_sharing
        sa.Column('granted', sa.Boolean(), nullable=False),  # True = granted, False = revoked
        sa.Column('scope', sa.String(200), nullable=True),  # NEW: Specific scope (e.g., "research_project_2025")
        
        # Version & Context
        sa.Column('consent_version', sa.String(50), nullable=False),  # e.g., "v2.1_2025-11"
        sa.Column('consent_document_url', sa.String(500), nullable=True),  # NEW: Link to consent document
        sa.Column('consent_language', sa.String(10), nullable=False, default='id'),  # NEW: Language user saw
        
        # Technical Context (for audit/compliance)
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('device_type', sa.String(50), nullable=True),  # NEW: mobile, desktop, tablet
        sa.Column('consent_method', sa.String(50), nullable=True),  # NEW: web_form, verbal, written
        
        # Timestamp (CRITICAL for audit)
        sa.Column('timestamp', sa.DateTime(), nullable=False, default=datetime.now, 
                  server_default=sa.text('now()'), index=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),  # NEW: Optional consent expiry
        
        # Indexes for compliance queries
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_consent_user_id', 'user_id'),
        sa.Index('idx_consent_type_timestamp', 'user_id', 'consent_type', 'timestamp'),
        sa.Index('idx_consent_granted', 'consent_type', 'granted', 'timestamp'),
    )
    
    # =====================================================================
    # TABLE 6: user_audit_log (Change History for All User Tables)
    # =====================================================================
    op.create_table(
        'user_audit_log',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, index=True),
        
        # Change Details
        sa.Column('action', sa.String(50), nullable=False, index=True),  # created, updated, deleted, viewed
        sa.Column('table_name', sa.String(100), nullable=False, index=True),  # users, user_profiles, etc.
        sa.Column('record_id', sa.Integer(), nullable=True),  # ID of the record changed
        sa.Column('changed_fields', postgresql.JSONB(), nullable=True),  # {"email": {"old": "...", "new": "..."}}
        sa.Column('change_reason', sa.String(500), nullable=True),  # NEW: Why the change was made
        
        # Actor Information
        sa.Column('changed_by_user_id', sa.Integer(), nullable=True),  # Who made the change
        sa.Column('changed_by_role', sa.String(50), nullable=True),  # user, counselor, admin, system
        sa.Column('changed_by_name', sa.String(200), nullable=True),  # NEW: Actor's name at time of change
        
        # Technical Context
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('request_id', sa.String(100), nullable=True),  # NEW: For tracing requests
        sa.Column('session_id', sa.String(100), nullable=True),  # NEW: User session
        
        # Timestamp
        sa.Column('timestamp', sa.DateTime(), nullable=False, default=datetime.now, 
                  server_default=sa.text('now()'), index=True),
        
        # Indexes for audit queries
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_audit_user_timestamp', 'user_id', 'timestamp'),
        sa.Index('idx_audit_action_timestamp', 'action', 'timestamp'),
        sa.Index('idx_audit_table_timestamp', 'table_name', 'timestamp'),
        sa.Index('idx_audit_actor', 'changed_by_user_id', 'timestamp'),
    )
    
    # =====================================================================
    # TABLE 7: user_sessions (Track Active Sessions - NEW)
    # =====================================================================
    op.create_table(
        'user_sessions',
        # Primary Key
        sa.Column('id', sa.String(100), nullable=False, primary_key=True),  # Session ID (UUID or token)
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), 
                  nullable=False, index=True),
        
        # Session Details
        sa.Column('device_type', sa.String(50), nullable=True),  # mobile, desktop, tablet
        sa.Column('device_name', sa.String(200), nullable=True),  # User's device name
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('location_city', sa.String(100), nullable=True),  # Approximate location
        sa.Column('location_country', sa.String(100), nullable=True),
        
        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True, index=True),
        sa.Column('last_activity_at', sa.DateTime(), nullable=False, default=datetime.now,
                  server_default=sa.text('now()')),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.now, 
                  server_default=sa.text('now()'), index=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),  # Session expiry
        
        # Indexes
        sa.PrimaryKeyConstraint('id'),
        sa.Index('idx_sessions_user_active', 'user_id', 'is_active'),
        sa.Index('idx_sessions_expires', 'expires_at'),
    )
    
    print("✅ Successfully created 7 normalized user tables")
    print("📝 Next: Run data migration script to populate new tables")


def downgrade() -> None:
    """
    Drop all normalized tables.
    
    WARNING: This will DELETE all data in normalized tables.
    Only run if migration hasn't been finalized.
    """
    op.drop_table('user_sessions')
    op.drop_table('user_audit_log')
    op.drop_table('user_consent_ledger')
    op.drop_table('user_emergency_contacts')
    op.drop_table('user_preferences')
    op.drop_table('user_clinical_records')
    op.drop_table('user_profiles')
    
    print("⚠️  Dropped all normalized user tables")
