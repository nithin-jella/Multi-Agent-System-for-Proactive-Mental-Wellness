# backend/app/routes/summary.py (New File)
from fastapi import APIRouter, Depends, HTTPException, Query, status # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from datetime import date, timedelta, datetime, time
from typing import Dict, List, Set, Optional, Any, cast # Import Any and cast

from app.core import llm
from app.database import get_async_db
from app.models import User, UserBadge  # Core models
from app.domains.mental_health.models import JournalEntry, Conversation, UserSummary
from app.domains.mental_health.schemas.summary import LatestSummaryResponse, ActivitySummaryResponse, ActivityData, GreetingHookRequest, GreetingHookResponse
from app.schemas.user import EarnedBadgeInfo
from app.dependencies import get_current_active_user
from app.services.user_normalization import ensure_user_normalized_tables
import logging
import os

logger = logging.getLogger(__name__)

# Router for Activity Summary (monthly view, streaks)
activity_router = APIRouter( # Renamed to be more specific
    prefix="/api/v1/activity-summary",
    tags=["Activity & Streak Summary"], # Updated tag
    dependencies=[Depends(get_current_active_user)]
)

# New Router for general user data, including chat summaries and badges
user_data_router = APIRouter(
    prefix="/api/v1/user", # Common prefix for user-specific data
    tags=["User Profile & Data"], # New tag
    dependencies=[Depends(get_current_active_user)]
)

# --- API Endpoint ---
@activity_router.get("/", response_model=ActivitySummaryResponse)
async def get_activity_summary(
    month_query: str = Query(..., alias="month", regex=r"^\d{4}-\d{2}$", description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Provides a summary of user activity (journal entries, conversations)
    for a given month, updates the user's activity streak data in the database,
    and returns the summary along with current streak info.
    """
    logger.info(f"Fetching activity summary and updating streak for user ID: {current_user.id}, month: {month_query}")
    try:
        year, month_num = map(int, month_query.split('-'))
        start_date = date(year, month_num, 1)

        if month_num == 12:
            next_month_start = date(year + 1, 1, 1)
        else:
            next_month_start = date(year, month_num + 1, 1)
        end_date_of_month = next_month_start - timedelta(days=1) # Last day of the query month

        logger.debug(f"Date range for summary: {start_date} to {end_date_of_month}")
    except ValueError:
        logger.warning(f"Invalid month format received: {month_query}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month format. Use YYYY-MM.")

    try:
        # Fetch all-time activity dates for streak calculation
        all_journal_dates_stmt = select(func.distinct(JournalEntry.entry_date))\
            .where(JournalEntry.user_id == current_user.id, JournalEntry.entry_date.isnot(None))
        journal_result = await db.execute(all_journal_dates_stmt)
        all_journal_dates: Set[date] = set()
        for r in journal_result.all():
            if isinstance(r[0], str):
                try:
                    all_journal_dates.add(datetime.strptime(r[0], "%Y-%m-%d").date())
                except ValueError:
                    logger.warning(f"Skipping invalid date string from journal_entries: {r[0]}")
            elif isinstance(r[0], date):
                all_journal_dates.add(r[0])

        all_conv_timestamps_stmt = select(func.distinct(func.date(Conversation.timestamp)))\
            .where(Conversation.user_id == current_user.id, Conversation.timestamp.isnot(None))
        conv_result = await db.execute(all_conv_timestamps_stmt)
        all_conv_dates: Set[date] = set()
        for r in conv_result.all():
            if isinstance(r[0], str): # Should ideally be a date object due to func.date()
                try:
                    all_conv_dates.add(datetime.strptime(r[0], "%Y-%m-%d").date())
                except ValueError:
                     logger.warning(f"Skipping invalid date string from conversation timestamps: {r[0]}")
            elif isinstance(r[0], date):
                all_conv_dates.add(r[0])


        all_activity_dates_ever = all_journal_dates.union(all_conv_dates)

        # Filter for the requested month (for the summary response)
        journal_dates_this_month = {d for d in all_journal_dates if isinstance(d, date) and start_date <= d <= end_date_of_month}
        conv_dates_this_month = {d for d in all_conv_dates if isinstance(d, date) and start_date <= d <= end_date_of_month}
        all_activity_dates_this_month = journal_dates_this_month.union(conv_dates_this_month)

        # Load normalized profile for canonical streak storage
        user_for_calc = (
            await db.execute(
                select(User)
                .options(selectinload(User.profile))
                .where(User.id == current_user.id)
            )
        ).scalar_one()
        await ensure_user_normalized_tables(db, user_for_calc)

        profile = user_for_calc.profile

        # Streak Calculation
        today = date.today()
        yesterday = today - timedelta(days=1)
        activity_today = today in all_activity_dates_ever

        # Explicitly cast attributes from profile to help Pylance
        _cs_any = cast(Any, profile.current_streak if profile else None)
        _cs_opt_int: Optional[int] = _cs_any
        current_db_streak_val: int = _cs_opt_int if _cs_opt_int is not None else 0

        _ls_any = cast(Any, profile.longest_streak if profile else None)
        _ls_opt_int: Optional[int] = _ls_any
        longest_db_streak_val: int = _ls_opt_int if _ls_opt_int is not None else 0

        _lad_any = cast(Any, profile.last_activity_date if profile else None)
        last_activity_db_val: Optional[date] = _lad_any

        new_streak_val = current_db_streak_val
        new_last_activity_val = last_activity_db_val

        if activity_today:
            if last_activity_db_val == yesterday:
                new_streak_val = current_db_streak_val + 1
            elif last_activity_db_val != today:
                new_streak_val = 1
            new_last_activity_val = today
        else:
            if last_activity_db_val is not None and last_activity_db_val < yesterday:
                new_streak_val = 0
        
        new_longest_streak_val = max(longest_db_streak_val, new_streak_val)

        if (new_streak_val != current_db_streak_val or
            new_longest_streak_val != longest_db_streak_val or
            new_last_activity_val != last_activity_db_val):

            if profile:
                profile.current_streak = new_streak_val
                profile.longest_streak = new_longest_streak_val
                profile.last_activity_date = new_last_activity_val

            # Keep legacy columns in sync during migration window.
            user_any = cast(Any, user_for_calc)
            user_any.current_streak = new_streak_val
            user_any.longest_streak = new_longest_streak_val
            user_any.last_activity_date = new_last_activity_val
            
            try:
                db.add(user_for_calc)
                if profile:
                    db.add(profile)
                await db.commit()
                await db.refresh(user_for_calc)
                if profile:
                    await db.refresh(profile)
                logger.info(
                    f"User {user_for_calc.id} streak data updated: "
                    f"Current={new_streak_val}, Longest={new_longest_streak_val}, LastActivity={new_last_activity_val}"
                )
            except Exception as e:
                await db.rollback()
                logger.error(f"Database error saving user streak update for user {user_for_calc.id}: {e}", exc_info=True)

        summary_data: Dict[str, ActivityData] = {}
        # Iterate through all days of the queried month to ensure all days are present in summary
        current_day_in_month = start_date
        while current_day_in_month <= end_date_of_month:
            date_str = current_day_in_month.isoformat()
            summary_data[date_str] = ActivityData(
                hasJournal=(current_day_in_month in journal_dates_this_month),
                hasConversation=(current_day_in_month in conv_dates_this_month)
            )
            current_day_in_month += timedelta(days=1)


        # For Pydantic model instantiation, ensure the values are Python types
        final_current_streak = cast(Optional[int], profile.current_streak if profile else None)
        final_longest_streak = cast(Optional[int], profile.longest_streak if profile else None)

        return ActivitySummaryResponse(
            summary=summary_data,
            currentStreak=final_current_streak if final_current_streak is not None else 0,
            longestStreak=final_longest_streak if final_longest_streak is not None else 0
        )

    except Exception as e:
        logger.error(f"Unexpected error in get_activity_summary for user {current_user.id}, month {month_query}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate activity summary")


# --- NEW: Endpoint to Fetch Earned Badges ---
@user_data_router.get("/my-badges", response_model=List[EarnedBadgeInfo])
async def get_my_earned_badges(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user) # Use dependency to get user
):
    """Fetches the list of badges earned by the current authenticated user."""
    logger.info(f"Fetching earned badges for user {current_user.id}")
    try:
        stmt = select(UserBadge)\
            .where(UserBadge.user_id == current_user.id)\
            .order_by(UserBadge.awarded_at.desc()) # Show newest badges first
        result = await db.execute(stmt)
        earned_badges = result.scalars().all()
        logger.info(f"Found {len(earned_badges)} earned badges for user {current_user.id}")
        # FastAPI will automatically serialize the list of UserBadge objects
        # into a list of EarnedBadgeInfo objects based on the response_model
        return earned_badges
    except Exception as e:
        logger.error(f"Error fetching earned badges for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve earned badges")
    
# --- Endpoint to Generate Greeting Hook ---
GREETING_HOOK_PROMPT_TEMPLATE = """
Anda adalah Aika, AI chatbot pendamping kesehatan mental dari UGM AICare yang sangat ramah, empatik, dan suportif.
Tugas Anda adalah membuat SATU kalimat sapaan pembuka yang sangat singkat dan alami berdasarkan ringkasan detail dari percakapan terakhir dengan pengguna.
Sapaan ini harus merujuk secara halus ke salah satu topik utama atau perasaan penting pengguna dari sesi terakhir, dan mengajak pengguna untuk melanjutkan percakapan.
Fokus untuk membuat pengguna merasa didengar dan diingat.

CONTOH SAPAAN YANG DIINGINKAN:

Halo! Di sesi terakhir kita bicara soal [topik utama], bagaimana kelanjutannya?
Hai, apa kabar? Kemarin kita sempat diskusi tentang [perasaan utama] kamu. Mau cerita lagi hari ini?
Selamat datang kembali! Terakhir kita ngobrolin [isu spesifik], ada perkembangan baru?
Halo, gimana kabar skripsimu kemarin? ada progres? atau kamu mau nyampein hal lain?
ATURAN PENTING:

Sapaan HARUS dalam Bahasa Indonesia yang santai dan akrab. Jika sebelumnya pengguna menggunakan bahasa selain bahasa Indonesia, gunakan bahasa tersebut.
Sapaan HARUS dalam gaya bahasa yang akrab dan bersahabat, seperti berbicara dengan teman dekat.
Sapaan HARUS sangat singkat, idealnya tidak lebih dari 1-2 kalimat pendek (maksimal sekitar 20-25 kata).
JANGAN mengulang detail panjang dari ringkasan.
JANGAN menyertakan bagian seperti "Key points:", "User's feelings:", dll. Langsung ke kalimat sapaannya.
Jika ringkasan tidak memberikan cukup info untuk sapaan spesifik, berikan sapaan umum yang ramah seperti "Halo! Senang bertemu lagi. Ada yang ingin kamu ceritakan hari ini?"
Berikut adalah ringkasan detail dari percakapan terakhir pengguna:
{detailed_summary_text}
SAPAAN PEMBUKA SINGKAT UNTUK PENGGUNA:"""

@user_data_router.post("/generate-greeting-hook", response_model=GreetingHookResponse)
async def generate_greeting_hook_from_summary(
    request: GreetingHookRequest,
    current_user: User = Depends(get_current_active_user) # Optional: if you want to log it against user
):
    logger.info(f"Generating greeting hook for user {current_user.id} based on provided summary.")
    if not request.detailed_summary_text or len(request.detailed_summary_text) < 10: # Basic validation
        logger.warning("Detailed summary text is too short or missing for greeting hook generation.")
        return GreetingHookResponse(greeting_hook=None)

    try:
        prompt_for_llm = GREETING_HOOK_PROMPT_TEMPLATE.format(detailed_summary_text=request.detailed_summary_text)
        
        # Use your existing llm.generate_response function
        # The history for this call is just a single user message containing the full prompt
        greeting_hook_llm_history = [{"role": "user", "content": prompt_for_llm}]
        
        hook_text = await llm.generate_response(
              history=greeting_hook_llm_history,
              model="gemini_google", # Explicitly specify Gemini model
              max_tokens=60, # Short response needed
              temperature=0.6, # Allow some creativity but not too much
              system_prompt=None # The main instruction is in the user prompt
        )

        if hook_text.startswith("Error:") or not hook_text.strip():
            logger.error(f"LLM failed to generate greeting hook or returned empty: {hook_text}")
            return GreetingHookResponse(greeting_hook=None)

        logger.info(f"Generated greeting hook: {hook_text.strip()}")
        return GreetingHookResponse(greeting_hook=hook_text.strip())

    except Exception as e:
        logger.error(f"Error generating greeting hook: {e}", exc_info=True)
        return GreetingHookResponse(greeting_hook=None) # Fallback

# --- Endpoint to Fetch Latest Summary ---
@user_data_router.get("/latest-summary", response_model=LatestSummaryResponse)
async def get_latest_user_summary(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user)
):
    logger.info(f"Fetching latest summary for user ID: {current_user.id}")
    stmt = (
        select(UserSummary)
        .where(UserSummary.user_id == current_user.id)
        .order_by(UserSummary.timestamp.desc(), UserSummary.id.desc())
        .limit(1)
    )
    try:
        result = await db.execute(stmt)
        latest_summary_instance: Optional[UserSummary] = result.scalars().first()
    except Exception as e:
        logger.error(f"Failed fetching latest summary for user {current_user.id}: {e}")
        latest_summary_instance = None

    if not latest_summary_instance:
        logger.info(f"No summary found for user ID: {current_user.id}")
        return LatestSummaryResponse(summary_text=None, timestamp=None)

    logger.info(f"Found summary for user ID: {current_user.id} from {latest_summary_instance.timestamp}")
    
    # Explicitly cast attributes from latest_summary_instance for Pydantic model
    summary_text_val = cast(Optional[str], latest_summary_instance.summary_text)
    timestamp_val = cast(Optional[datetime], latest_summary_instance.timestamp)

    return LatestSummaryResponse(
        summary_text=summary_text_val,
        timestamp=timestamp_val
    )