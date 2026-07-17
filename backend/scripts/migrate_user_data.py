"""
Data Migration Script: Populate Normalized User Tables

This script migrates data from the existing `users` table to the new
normalized tables created by migration 202511050001.

Run this AFTER running the Alembic migration.

Usage:
    docker exec ugm_aicare_backend_dev python scripts/migrate_user_data.py
    
Or directly:
    cd backend && python scripts/migrate_user_data.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_maker
from app.models import User
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def migrate_user_data():
    """
    Migrate data from users table to normalized tables.
    
    This is IDEMPOTENT: Can be run multiple times safely.
    """
    
    print("=" * 80)
    print("🔄 USER DATA MIGRATION TO NORMALIZED TABLES")
    print("=" * 80)
    
    async with async_session_maker() as db:
        try:
            # Count total users
            result = await db.execute(select(func.count(User.id)))
            total_users = result.scalar() or 0
            
            logger.info(f"📊 Found {total_users} users to migrate")
            
            if total_users == 0:
                logger.warning("⚠️  No users found in database")
                return
            
            # Fetch all users
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            migrated_count = 0
            error_count = 0
            
            for user in users:
                try:
                    await migrate_single_user(db, user)
                    migrated_count += 1
                    
                    if migrated_count % 10 == 0:
                        logger.info(f"   Progress: {migrated_count}/{total_users} users migrated")
                
                except Exception as e:
                    error_count += 1
                    logger.error(f"❌ Failed to migrate user {user.id} ({user.email}): {e}")
                    continue
            
            # Commit all changes
            await db.commit()
            
            print("\n" + "=" * 80)
            print("📊 MIGRATION SUMMARY")
            print("=" * 80)
            print(f"✅ Successfully migrated: {migrated_count} users")
            if error_count > 0:
                print(f"❌ Errors: {error_count} users")
            print(f"📈 Success rate: {(migrated_count/total_users)*100:.1f}%")
            print("=" * 80)
            
            logger.info("✅ Data migration completed successfully")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}", exc_info=True)
            await db.rollback()
            raise


async def migrate_single_user(db: AsyncSession, user: User):
    """
    Migrate a single user's data to normalized tables.
    
    Args:
        db: Database session
        user: User object to migrate
    """
    
    # =====================================================================
    # 1. Migrate to user_profiles
    # =====================================================================
    
    # Check if profile already exists
    result = await db.execute(
        select(func.count()).select_from(
            db.bind.dialect.get_table_names(bind=db.bind, schema=None).__contains__('user_profiles')
        )
    )
    
    # Create user_profiles entry
    await db.execute(
        """
        INSERT INTO user_profiles (
            user_id, first_name, last_name, preferred_name, pronouns,
            phone, alternate_phone, date_of_birth, gender, city,
            university, major, year_of_study, student_id,
            profile_photo_url, current_streak, longest_streak,
            last_activity_date, sentiment_score,
            created_at, updated_at
        ) VALUES (
            :user_id, :first_name, :last_name, :preferred_name, :pronouns,
            :phone, :alternate_phone, :date_of_birth, :gender, :city,
            :university, :major, :year_of_study, NULL,
            :profile_photo_url, :current_streak, :longest_streak,
            :last_activity_date, :sentiment_score,
            :created_at, :updated_at
        )
        ON CONFLICT (user_id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            preferred_name = EXCLUDED.preferred_name,
            updated_at = EXCLUDED.updated_at
        """,
        {
            "user_id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "preferred_name": user.preferred_name,
            "pronouns": user.pronouns,
            "phone": user.phone,
            "alternate_phone": user.alternate_phone,
            "date_of_birth": user.date_of_birth,
            "gender": user.gender,
            "city": user.city,
            "university": user.university,
            "major": user.major,
            "year_of_study": user.year_of_study,
            "profile_photo_url": user.profile_photo_url,
            "current_streak": user.current_streak or 0,
            "longest_streak": user.longest_streak or 0,
            "last_activity_date": user.last_activity_date,
            "sentiment_score": user.sentiment_score or 0.0,
            "created_at": user.created_at or datetime.now(),
            "updated_at": user.updated_at or datetime.now(),
        }
    )
    
    # =====================================================================
    # 2. Migrate to user_clinical_records (if has clinical data)
    # =====================================================================
    
    has_clinical_data = (
        user.risk_level or 
        user.clinical_summary or 
        user.primary_concerns or 
        user.safety_plan_notes
    )
    
    if has_clinical_data:
        await db.execute(
            """
            INSERT INTO user_clinical_records (
                user_id, current_risk_level, clinical_summary, 
                primary_concerns, safety_plan_notes,
                is_in_external_therapy, external_therapist_name, 
                external_therapist_contact, therapy_modality, therapy_frequency,
                is_on_medication, aicare_team_notes,
                created_at, updated_at
            ) VALUES (
                :user_id, :risk_level, :clinical_summary,
                :primary_concerns, :safety_plan_notes,
                FALSE, :therapist_name, :therapist_contact, 
                :therapy_modality, :therapy_frequency,
                FALSE, :team_notes,
                :created_at, :updated_at
            )
            ON CONFLICT (user_id) DO UPDATE SET
                current_risk_level = EXCLUDED.current_risk_level,
                clinical_summary = EXCLUDED.clinical_summary,
                updated_at = EXCLUDED.updated_at
            """,
            {
                "user_id": user.id,
                "risk_level": user.risk_level,
                "clinical_summary": user.clinical_summary,
                "primary_concerns": user.primary_concerns,
                "safety_plan_notes": user.safety_plan_notes,
                "therapist_name": user.current_therapist_name,
                "therapist_contact": user.current_therapist_contact,
                "therapy_modality": user.therapy_modality,
                "therapy_frequency": user.therapy_frequency,
                "team_notes": user.aicare_team_notes,
                "created_at": user.created_at or datetime.now(),
                "updated_at": user.updated_at or datetime.now(),
            }
        )
    
    # =====================================================================
    # 3. Migrate to user_preferences
    # =====================================================================
    
    await db.execute(
        """
        INSERT INTO user_preferences (
            user_id, preferred_language, preferred_timezone,
            allow_email_checkins, check_in_code,
            accessibility_notes,
            created_at, updated_at
        ) VALUES (
            :user_id, :language, :timezone,
            :allow_email, :check_in_code,
            :accessibility_notes,
            :created_at, :updated_at
        )
        ON CONFLICT (user_id) DO UPDATE SET
            preferred_language = EXCLUDED.preferred_language,
            updated_at = EXCLUDED.updated_at
        """,
        {
            "user_id": user.id,
            "language": user.preferred_language or "id",
            "timezone": user.preferred_timezone or "Asia/Jakarta",
            "allow_email": user.allow_email_checkins if hasattr(user, 'allow_email_checkins') else True,
            "check_in_code": user.check_in_code if hasattr(user, 'check_in_code') else None,
            "accessibility_notes": user.accessibility_needs if hasattr(user, 'accessibility_needs') else None,
            "created_at": user.created_at or datetime.now(),
            "updated_at": user.updated_at or datetime.now(),
        }
    )
    
    # =====================================================================
    # 4. Migrate to user_emergency_contacts (if exists)
    # =====================================================================
    
    has_emergency_contact = (
        hasattr(user, 'emergency_contact_name') and 
        user.emergency_contact_name
    )
    
    if has_emergency_contact:
        await db.execute(
            """
            INSERT INTO user_emergency_contacts (
                user_id, full_name, relationship, phone, email,
                priority, consent_to_contact, consent_granted_date,
                created_at, updated_at
            ) VALUES (
                :user_id, :name, :relationship, :phone, :email,
                1, :consent, :consent_date,
                :created_at, :updated_at
            )
            ON CONFLICT DO NOTHING
            """,
            {
                "user_id": user.id,
                "name": user.emergency_contact_name,
                "relationship": user.emergency_contact_relationship or "unknown",
                "phone": user.emergency_contact_phone or "",
                "email": user.emergency_contact_email,
                "consent": user.consent_emergency_contact if hasattr(user, 'consent_emergency_contact') else False,
                "consent_date": datetime.now() if (hasattr(user, 'consent_emergency_contact') and user.consent_emergency_contact) else None,
                "created_at": user.created_at or datetime.now(),
                "updated_at": user.updated_at or datetime.now(),
            }
        )
    
    # =====================================================================
    # 5. Migrate to user_consent_ledger (create initial entries)
    # =====================================================================
    
    # Migrate existing consent fields as initial ledger entries
    consent_types = []
    
    if hasattr(user, 'consent_data_sharing'):
        consent_types.append(("data_sharing", user.consent_data_sharing))
    if hasattr(user, 'consent_research'):
        consent_types.append(("research", user.consent_research))
    if hasattr(user, 'consent_emergency_contact'):
        consent_types.append(("emergency_contact", user.consent_emergency_contact))
    if hasattr(user, 'consent_marketing'):
        consent_types.append(("marketing", user.consent_marketing))
    
    for consent_type, granted in consent_types:
        await db.execute(
            """
            INSERT INTO user_consent_ledger (
                user_id, consent_type, granted, consent_version,
                consent_language, timestamp
            ) VALUES (
                :user_id, :consent_type, :granted, 'v1.0_migration',
                'id', :timestamp
            )
            ON CONFLICT DO NOTHING
            """,
            {
                "user_id": user.id,
                "consent_type": consent_type,
                "granted": granted,
                "timestamp": user.created_at or datetime.now(),
            }
        )
    
    # =====================================================================
    # 6. Create audit log entry for migration
    # =====================================================================
    
    await db.execute(
        """
        INSERT INTO user_audit_log (
            user_id, action, table_name, changed_by_role, timestamp
        ) VALUES (
            :user_id, 'migrated', 'users', 'system', :timestamp
        )
        """,
        {
            "user_id": user.id,
            "timestamp": datetime.now(),
        }
    )
    
    logger.debug(f"✅ Migrated user {user.id} ({user.email})")


if __name__ == "__main__":
    print("Starting user data migration...\n")
    asyncio.run(migrate_user_data())
    print("\n✅ Migration script completed")
