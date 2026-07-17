# backend/app/core/scheduler.py
"""
Proactive Wellness Scheduler

This module implements the scheduling system for proactive mental health interventions:
1. Risk-weighted check-ins based on screening profile severity
2. Trend detection for deteriorating mental health indicators
3. Personalized outreach based on primary concerns
4. Weekly IA report generation

Key Features:
- Uses APScheduler with AsyncIOScheduler for FastAPI compatibility
- Risk-weighted inactivity thresholds (severe=1 day, moderate=2 days, mild=3 days, none=5 days)
- Tracks check-in history to avoid spamming users
- Screening-aware message personalization
"""
from __future__ import annotations

from typing import Optional, Dict, List, Any, TYPE_CHECKING
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import joinedload
from app.database import AsyncSessionLocal
from app.models import User, UserPreferences, UserProfile
from app.domains.mental_health.models.assessments import UserScreeningProfile
from app.utils.email_utils import send_email
from app.domains.mental_health.services.proactive_checkins import (
    queue_checkin_execution,
    proactive_checkins_require_review,
    build_checkin_message,
)
from app.services.user_normalization import current_risk_level as current_risk_level_for_user
from app.services.user_normalization import display_name as display_name_for_user
from app.domains.mental_health.services.insights_service import InsightsService
from app.services.retention_service import compute_retention_cohorts
from datetime import datetime, timedelta, date
import random
import os
import logging
import asyncio
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
logger = logging.getLogger(__name__)

# Use AsyncIOScheduler to work properly with FastAPI's event loop
scheduler = AsyncIOScheduler(timezone="Asia/Jakarta")

# Job IDs
CHECKIN_JOB_ID = "proactive_checkin_job"
TREND_DETECTION_JOB_ID = "trend_detection_job"
WEEKLY_IA_REPORT_JOB_ID = "weekly_ia_report_job"
RETENTION_COHORT_JOB_ID = "retention_cohort_job"
COUNSELOR_REMINDER_JOB_ID = "counselor_reminder_job"


def _parse_bool_env(name: str, default: bool = True) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_day_n_values(raw: str | None) -> list[int]:
    if not raw:
        return [1, 7, 30]
    values: list[int] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            value = int(item)
        except ValueError:
            continue
        if value >= 0:
            values.append(value)
    normalized = sorted(set(values))
    return normalized or [1, 7, 30]

# =============================================================================
# RISK-WEIGHTED THRESHOLDS
# =============================================================================

# Inactivity thresholds based on risk level (in days)
RISK_INACTIVITY_THRESHOLDS: Dict[str, int] = {
    "critical": 1,   # Check in after 1 day of inactivity
    "severe": 1,     # Check in after 1 day of inactivity
    "moderate": 2,   # Check in after 2 days of inactivity
    "mild": 3,       # Check in after 3 days of inactivity
    "none": 5,       # Check in after 5 days of inactivity (default)
}

# Minimum hours between check-ins to avoid spamming
MIN_HOURS_BETWEEN_CHECKINS = 48  # At least 48 hours between check-ins


# =============================================================================
# PERSONALIZED MESSAGE TEMPLATES
# =============================================================================

def get_personalized_message(
    user_name: str,
    risk_level: str,
    primary_concerns: list[str],
    app_url: str,
) -> tuple[str, str]:
    """Build a conservative check-in email message.

    This delegates to the shared template in `proactive_checkins` to avoid
    embedding raw conversation content.
    """
    return build_checkin_message(
        user_name=user_name,
        risk_level=risk_level,
        primary_concerns=primary_concerns or [],
        app_url=app_url,
    )


# =============================================================================
# PROACTIVE CHECK-IN JOB
# =============================================================================

async def send_proactive_checkins() -> None:
    """Scheduled job to find inactive users and send personalized check-in emails.
    
    Features:
    - Risk-weighted inactivity thresholds
    - Range-based query (not exact date match)
    - Excludes recently contacted users
    - Screening-aware message personalization
    - Tracks check-in history
    """
    logger.info("Scheduler: Running proactive check-in job...")
    async with AsyncSessionLocal() as db:
        try:
            app_url = os.getenv('NEXTAUTH_URL', 'http://localhost:4000')
            require_review = proactive_checkins_require_review(
                os.getenv("PROACTIVE_CHECKINS_REQUIRE_REVIEW")
            )
            today = date.today()
            now = datetime.now()
            
            # Get all users with their screening profiles
            stmt = (
                select(User, UserScreeningProfile)
                .outerjoin(UserScreeningProfile, User.id == UserScreeningProfile.user_id)
                .outerjoin(UserPreferences, User.id == UserPreferences.user_id)
                .outerjoin(UserProfile, User.id == UserProfile.user_id)
                .options(
                    joinedload(User.profile),
                    joinedload(User.preferences),
                    joinedload(User.clinical_record),
                )
                .where(
                    func.coalesce(UserPreferences.allow_email_checkins, User.allow_email_checkins, True) == True,
                    User.email != None,
                    User.is_active == True,
                )
            )
            result = await db.execute(stmt)
            users_with_profiles = result.all()
            
            eligible_count = 0
            sent_count = 0
            
            for user, screening_profile in users_with_profiles:
                # Determine risk level from screening profile
                risk_level = "none"
                primary_concerns: List[str] = []
                
                if screening_profile:
                    risk_level = screening_profile.overall_risk or "none"
                    if screening_profile.profile_data:
                        primary_concerns = screening_profile.profile_data.get("primary_concerns", [])
                
                # Also check user's clinical record as fallback during migration
                if risk_level == "none":
                    risk_level = current_risk_level_for_user(user) or "none"
                
                # Get threshold for this risk level
                threshold_days = RISK_INACTIVITY_THRESHOLDS.get(risk_level, 5)
                threshold_date = today - timedelta(days=threshold_days)
                
                # Check if user is inactive enough to warrant check-in
                last_activity = user.profile.last_activity_date if user.profile else getattr(user, "last_activity_date", None)
                if last_activity is None:
                    # User has never been active, check based on account creation
                    if user.created_at:
                        creation_date = user.created_at.date() if isinstance(user.created_at, datetime) else user.created_at
                        if creation_date > threshold_date:
                            continue  # Account too new
                    else:
                        continue  # No activity data, skip
                elif last_activity > threshold_date:
                    continue  # User has been active recently
                
                # Check if we've already sent a check-in recently
                if user.last_checkin_sent_at:
                    hours_since_checkin = (now - user.last_checkin_sent_at).total_seconds() / 3600
                    if hours_since_checkin < MIN_HOURS_BETWEEN_CHECKINS:
                        logger.debug(f"Scheduler: Skipping user {user.id}, check-in sent {hours_since_checkin:.1f}h ago")
                        continue
                
                eligible_count += 1
                
                # Get email (stored as plaintext, encryption removed for performance)
                if not user.email:
                    continue
                    
                user_email = user.email
                
                # Get personalized message
                user_name = display_name_for_user(user)
                subject, html_body = get_personalized_message(
                    user_name=user_name,
                    primary_concerns=primary_concerns,
                    risk_level=risk_level,
                    app_url=app_url
                )
                
                # Send email (or queue for human review)
                try:
                    if require_review:
                        await queue_checkin_execution(
                            db=db,
                            user=user,
                            screening_profile=screening_profile,
                            now=now,
                            app_url=app_url,
                            risk_level=risk_level,
                            primary_concerns=primary_concerns,
                        )
                        logger.info(
                            f"Scheduler: Check-in queued for user {user.id} "
                            f"(risk={risk_level}, concerns={primary_concerns[:2]})"
                        )
                    else:
                        await asyncio.to_thread(send_email, recipient_email=user_email, subject=subject, html_content=html_body)
                        logger.info(
                            f"Scheduler: Check-in sent to user {user.id} "
                            f"(risk={risk_level}, concerns={primary_concerns[:2]})"
                        )
                    
                    # Update check-in tracking
                    user.last_checkin_sent_at = now
                    user.checkin_count = (user.checkin_count or 0) + 1
                    
                    sent_count += 1
                    
                    
                    # Rate limit to avoid email service issues
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Scheduler: Failed to send check-in to user {user.id}: {e}")
            
            # Commit all check-in tracking updates
            await db.commit()
            
            logger.info(
                f"Scheduler: Proactive check-in job complete. "
                f"Evaluated: {len(users_with_profiles)}, Eligible: {eligible_count}, Sent: {sent_count}"
            )
            
        except Exception as e:
            logger.error(f"Scheduler: Error during check-in job: {e}", exc_info=True)
            await db.rollback()


# =============================================================================
# TREND DETECTION JOB
# =============================================================================

async def detect_screening_trends() -> None:
    """Scheduled job to detect deteriorating mental health trends.
    
    Analyzes screening profile changes over time to identify:
    - Users whose scores are worsening
    - New entries into moderate/severe categories
    - Patterns requiring proactive intervention
    
    Creates alerts for admin dashboard and triggers early outreach.
    """
    logger.info("Scheduler: Running screening trend detection job...")
    async with AsyncSessionLocal() as db:
        try:
            # Get all screening profiles with significant indicators
            stmt = (
                select(UserScreeningProfile, User)
                .join(User, UserScreeningProfile.user_id == User.id)
                .where(
                    User.is_active == True,
                    or_(
                        UserScreeningProfile.overall_risk.in_(["moderate", "severe", "critical"]),
                        UserScreeningProfile.requires_attention == True,
                    )
                )
            )
            result = await db.execute(stmt)
            profiles_to_check = result.all()
            
            deterioration_count = 0
            alerts_created = 0
            
            for profile, user in profiles_to_check:
                if not profile.profile_data:
                    continue
                
                dimension_scores = profile.profile_data.get("dimension_scores", {})
                
                # Check for deterioration patterns
                deteriorating_dimensions: List[Dict[str, Any]] = []
                for dim_key, score_data in dimension_scores.items():
                    if isinstance(score_data, dict):
                        trend = score_data.get("trend", "stable")
                        current_score = score_data.get("current_score", 0)
                        severity = score_data.get("severity_label", "none")
                        
                        # Flag if worsening and above mild threshold
                        if trend == "worsening" and current_score > 0.3:
                            deteriorating_dimensions.append({
                                "dimension": dim_key,
                                "score": current_score,
                                "severity": severity,
                            })
                
                if deteriorating_dimensions:
                    deterioration_count += 1
                    
                    # Check if user needs immediate attention
                    if profile.overall_risk in ("severe", "critical"):
                        # Create alert for admin
                        try:
                            from app.services.alert_service import get_alert_service
                            from app.models.alerts import AlertType, AlertSeverity
                            
                            alert_service = get_alert_service(db)
                            await alert_service.create_alert(
                                alert_type=AlertType.SYSTEM_NOTIFICATION,
                                severity=AlertSeverity.HIGH if profile.overall_risk == "severe" else AlertSeverity.CRITICAL,
                                title="Deteriorating Mental Health Trend Detected",
                                message=(
                                    f"User {user.id} showing worsening trend in "
                                    f"{len(deteriorating_dimensions)} dimension(s): "
                                    f"{', '.join([d['dimension'] for d in deteriorating_dimensions[:3]])}. "
                                    f"Overall risk: {profile.overall_risk}."
                                ),
                                alert_metadata={
                                    "user_id": user.id,
                                    "risk_level": profile.overall_risk,
                                    "deteriorating_dimensions": deteriorating_dimensions,
                                    "detection_type": "trend_analysis",
                                },
                            )
                            alerts_created += 1
                            logger.warning(
                                f"Scheduler: Created alert for user {user.id} with deteriorating trend"
                            )
                        except Exception as e:
                            logger.error(f"Scheduler: Failed to create alert for user {user.id}: {e}")
                    
                    # Mark profile as requiring attention if not already
                    if not profile.requires_attention:
                        profile.requires_attention = True
                        logger.info(f"Scheduler: Marked user {user.id} profile as requiring attention")
            
            await db.commit()
            
            logger.info(
                f"Scheduler: Trend detection complete. "
                f"Profiles checked: {len(profiles_to_check)}, "
                f"Deteriorating: {deterioration_count}, "
                f"Alerts created: {alerts_created}"
            )
            
        except Exception as e:
            logger.error(f"Scheduler: Error during trend detection: {e}", exc_info=True)
            await db.rollback()



# =============================================================================
# COUNSELOR REMINDER JOB
# =============================================================================

async def send_counselor_reminders() -> None:
    """Scheduled job to remind assigned counselors about cases that need attention.

    Finds active Cases (new/in_progress) that have an assigned counselor but
    haven't been updated in 3+ days. Sends both an in-app alert and an email
    to the assigned counselor.
    """
    logger.info("Scheduler: Running counselor reminder job...")
    async with AsyncSessionLocal() as db:
        try:
            from app.services.alert_service import get_alert_service
            from app.models.alerts import AlertType, AlertSeverity
            from app.domains.mental_health.models.cases import Case, CaseStatusEnum
            from app.domains.mental_health.models.appointments import Psychologist
            from app.models.user import User
            from sqlalchemy.orm import joinedload as _joinedload

            now = datetime.now()
            stale_threshold = now - timedelta(days=3)

            # Query active cases with an assigned counselor that have gone stale
            stmt = (
                select(Case)
                .where(
                    Case.status.in_([CaseStatusEnum.new, CaseStatusEnum.in_progress]),
                    Case.assigned_to.isnot(None),
                    Case.updated_at < stale_threshold,
                )
            )
            result = await db.execute(stmt)
            stale_cases = result.scalars().all()

            if not stale_cases:
                logger.info("Scheduler: No stale cases found for counselor reminders.")
                return

            app_url = os.getenv("NEXTAUTH_URL", "http://localhost:4000")
            reminders_sent = 0
            alert_service = get_alert_service(db)

            for case in stale_cases:
                try:
                    # Resolve counselor email: assigned_to (str) -> Psychologist.id ->
                    # Psychologist.user_id -> User.email
                    psych_stmt = (
                        select(Psychologist)
                        .options(_joinedload(Psychologist.user))
                        .where(Psychologist.id == int(case.assigned_to))
                    )
                    psych_result = await db.execute(psych_stmt)
                    psychologist = psych_result.scalar_one_or_none()

                    if not psychologist or not psychologist.user:
                        logger.warning(
                            f"Scheduler: Cannot resolve counselor for case {case.id} "
                            f"(assigned_to={case.assigned_to}) - skipping."
                        )
                        continue

                    counselor_user = psychologist.user
                    days_stale = max(1, int((now - case.updated_at).days))

                    # --- In-app alert ---
                    await alert_service.create_alert(
                        alert_type=AlertType.SYSTEM_NOTIFICATION,
                        severity=AlertSeverity.MEDIUM,
                        title="Case Requires Your Attention",
                        message=(
                            f"Case {str(case.id)[:8]} (status: {case.status.value}, "
                            f"severity: {case.severity.value}) has not been updated in "
                            f"{days_stale} day(s). Please review and follow up with the student."
                        ),
                        alert_metadata={
                            "case_id": str(case.id),
                            "case_status": case.status.value,
                            "case_severity": case.severity.value,
                            "days_stale": days_stale,
                            "counselor_id": case.assigned_to,
                            "reminder_type": "counselor_case_reminder",
                        },
                    )

                    # --- Email reminder ---
                    if counselor_user.email:
                        counselor_name = getattr(counselor_user, 'name', None) or psychologist.name or "Counselor"
                        subject = f"[AICare] Reminder: Case {str(case.id)[:8]} needs follow-up"
                        html_body = (
                            f"<p>Dear {counselor_name},</p>"
                            f"<p>This is a reminder that case <strong>{str(case.id)[:8]}</strong> "
                            f"(severity: <strong>{case.severity.value}</strong>) assigned to you "
                            f"has not been updated in <strong>{days_stale} day(s)</strong>.</p>"
                            f"<p>Please log in to review and follow up with the student:</p>"
                            f"<p><a href='{app_url}/admin/cases'>View Cases &rarr;</a></p>"
                            f"<p>Thank you,<br/>UGM AICare System</p>"
                        )
                        await asyncio.to_thread(
                            send_email,
                            recipient_email=counselor_user.email,
                            subject=subject,
                            html_content=html_body,
                        )

                    reminders_sent += 1
                    logger.info(
                        f"Scheduler: Sent counselor reminder for case {case.id} "
                        f"to counselor {case.assigned_to} ({days_stale}d stale)."
                    )

                except Exception as e:
                    logger.error(
                        f"Scheduler: Failed to send reminder for case {case.id}: {e}",
                        exc_info=True,
                    )

            logger.info(
                f"Scheduler: Counselor reminder job complete. "
                f"Stale cases: {len(stale_cases)}, Reminders sent: {reminders_sent}"
            )

        except Exception as e:
            logger.error(f"Scheduler: Error during counselor reminder job: {e}", exc_info=True)
            await db.rollback()

# =============================================================================
# WEEKLY IA REPORT JOB
# =============================================================================

async def generate_weekly_ia_report() -> None:
    """Scheduled job to generate weekly IA insights report."""
    logger.info("Scheduler: Running weekly IA report generation...")
    async with AsyncSessionLocal() as db:
        try:
            insights_service = InsightsService(db)
            
            # Generate report for the past week (with LLM analysis enabled)
            report = await insights_service.generate_weekly_report(
                period_start=None,  # Defaults to 7 days ago
                period_end=None,    # Defaults to now
                use_llm=True
            )
            
            logger.info(
                f"Scheduler: Successfully generated weekly IA report {report.id}. "
                f"Assessments: {report.assessment_count}, High risk: {report.high_risk_count}"
            )
            
            # TODO: Send email notification to admins
            
        except Exception as e:
            logger.error(f"Scheduler: Error during IA report generation: {e}", exc_info=True)


# =============================================================================
# RETENTION COHORT JOB
# =============================================================================

async def compute_retention_cohort_metrics() -> None:
    """Scheduled job to materialize retention cohort points."""
    logger.info("Scheduler: Running retention cohort materialization job...")
    async with AsyncSessionLocal() as db:
        try:
            cohort_days = int(os.getenv("RETENTION_COHORT_DAYS", "30"))
            day_ns = _parse_day_n_values(os.getenv("RETENTION_DAY_N_VALUES"))
            inserted = await compute_retention_cohorts(
                db,
                cohort_days=cohort_days,
                day_n_values=day_ns,
            )
            await db.commit()
            logger.info(
                "Scheduler: Retention cohorts updated. rows=%s cohort_days=%s day_ns=%s",
                inserted,
                cohort_days,
                day_ns,
            )
        except Exception as e:
            await db.rollback()
            logger.error("Scheduler: Error during retention cohort job: %s", e, exc_info=True)


# =============================================================================
# SCHEDULER LIFECYCLE
# =============================================================================

def start_scheduler() -> None:
    """Adds all scheduled jobs and starts the scheduler."""
    if scheduler.running:
        logger.info("APScheduler already running.")
        return

    # Schedule proactive check-in (twice daily: 10:00 AM and 7:00 PM WIB)
    scheduler.add_job(
        send_proactive_checkins,
        trigger='cron',
        hour=10,
        minute=0,
        id=CHECKIN_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600
    )
    logger.info(f"Scheduled job '{CHECKIN_JOB_ID}' with trigger: cron[hour=10, minute=0]")
    
    # Schedule evening check-in for high-risk users
    scheduler.add_job(
        send_proactive_checkins,
        trigger='cron',
        hour=19,
        minute=0,
        id=f"{CHECKIN_JOB_ID}_evening",
        replace_existing=True,
        misfire_grace_time=3600
    )
    logger.info(f"Scheduled job '{CHECKIN_JOB_ID}_evening' with trigger: cron[hour=19, minute=0]")
    
    # Schedule trend detection (every 6 hours)
    scheduler.add_job(
        detect_screening_trends,
        trigger='cron',
        hour='0,6,12,18',  # Every 6 hours
        minute=30,
        id=TREND_DETECTION_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600
    )
    logger.info(f"Scheduled job '{TREND_DETECTION_JOB_ID}' with trigger: cron[hour=0,6,12,18, minute=30]")
    
    # Schedule weekly IA report (every Sunday at 2:00 AM WIB)
    scheduler.add_job(
        generate_weekly_ia_report,
        trigger='cron',
        day_of_week='sun',
        hour=2,
        minute=0,
        id=WEEKLY_IA_REPORT_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600
    )
    logger.info(f"Scheduled job '{WEEKLY_IA_REPORT_JOB_ID}' with trigger: cron[day_of_week=sun, hour=2, minute=0]")

    if _parse_bool_env("ENABLE_RETENTION_COHORT_JOB", True):
        scheduler.add_job(
            compute_retention_cohort_metrics,
            trigger='cron',
            hour=1,
            minute=30,
            id=RETENTION_COHORT_JOB_ID,
            replace_existing=True,
            misfire_grace_time=3600,
        )
        logger.info(
            "Scheduled job '%s' with trigger: cron[hour=1, minute=30]",
            RETENTION_COHORT_JOB_ID,
        )
    else:
        logger.info("Retention cohort job disabled by ENABLE_RETENTION_COHORT_JOB")

    # Schedule counselor reminders (daily at 9:00 AM WIB)
    scheduler.add_job(
        send_counselor_reminders,
        trigger='cron',
        hour=9,
        minute=0,
        id=COUNSELOR_REMINDER_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info(f"Scheduled job '{COUNSELOR_REMINDER_JOB_ID}' with trigger: cron[hour=9, minute=0]")

    try:
        scheduler.start()
        logger.info("APScheduler started successfully with enhanced proactive features.")
    except Exception as e:
        logger.error(f"Failed to start APScheduler: {e}", exc_info=True)


def shutdown_scheduler() -> None:
    """Shuts down the scheduler gracefully."""
    if scheduler.running:
        logger.info("Shutting down APScheduler...")
        scheduler.shutdown()
        logger.info("APScheduler shut down.")


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def trigger_immediate_checkin(user_id: int, reason: str = "manual") -> bool:
    """Trigger an immediate check-in for a specific user.
    
    Args:
        user_id: User ID to send check-in to
        reason: Reason for triggering (for logging)
        
    Returns:
        bool: True if check-in was sent successfully
    """
    logger.info(f"Scheduler: Triggering immediate check-in for user {user_id} (reason: {reason})")
    
    async with AsyncSessionLocal() as db:
        try:
            app_url = os.getenv('NEXTAUTH_URL', 'http://localhost:4000')
            
            # Get user with screening profile
            stmt = (
                select(User, UserScreeningProfile)
                .outerjoin(UserScreeningProfile, User.id == UserScreeningProfile.user_id)
                .where(User.id == user_id)
            )
            result = await db.execute(stmt)
            row = result.first()
            
            if not row:
                logger.error(f"Scheduler: User {user_id} not found")
                return False
            
            user, profile = row
            
            if not user.email:
                logger.error(f"Scheduler: User {user_id} has no email")
                return False
            
            user_email = user.email  # Stored as plaintext (encryption removed for performance)
            
            # Get screening data
            risk_level = profile.overall_risk if profile else "none"
            primary_concerns: List[str] = []
            if profile and profile.profile_data:
                primary_concerns = profile.profile_data.get("primary_concerns", [])
            
            # Get personalized message
            user_name = user.name or user.preferred_name or 'Teman UGM'
            subject, html_body = get_personalized_message(
                user_name=user_name,
                primary_concerns=primary_concerns,
                risk_level=risk_level,
                app_url=app_url
            )
            
            # Send email
            await asyncio.to_thread(send_email, recipient_email=user_email, subject=subject, html_content=html_body)
            
            # Update tracking
            user.last_checkin_sent_at = datetime.now()
            user.checkin_count = (user.checkin_count or 0) + 1
            await db.commit()
            
            logger.info(f"Scheduler: Immediate check-in sent to user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Scheduler: Failed to send immediate check-in: {e}", exc_info=True)
            await db.rollback()
            return False
