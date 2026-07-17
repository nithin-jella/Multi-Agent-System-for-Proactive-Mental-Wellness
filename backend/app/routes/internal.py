# backend/app/routes/internal.py

from fastapi import APIRouter, Depends, HTTPException, Security, status, Body # type: ignore
from fastapi.security import APIKeyHeader # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import Optional, List, Tuple

from app.database import get_async_db
from app.schemas.internal import UserInternalResponse, UserSyncPayload, UserSyncResponse
from app.models import User
from app.services.user_normalization import allow_email_checkins as allow_email_checkins_for_user
from app.services.user_service import async_get_or_create_user # Import the user service function
import os
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/internal", tags=["Internal"])

# --- Security Setup ---
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY") # Set this in your .env!
if not INTERNAL_API_KEY:
    print("WARNING: INTERNAL_API_KEY is not set. Internal endpoints are insecure.")

api_key_header = APIKeyHeader(name="X-Internal-API-Key", auto_error=False)

#? Helper for inconsistent UUIDs (Google Sub)
# --- Helper to check UUID format (keep as is) ---
def is_uuid_like(text: Optional[str]) -> bool:
    if not text: return False
    pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    return bool(re.match(pattern, text, re.IGNORECASE))

# --- Define Allowed Email Domains ---
#! Disallow Gmail in production, but allow for now
ALLOWED_EMAIL_DOMAINS: Tuple[str, ...] = (
    "@mail.ugm.ac.id",
    "@ugm.ac.id",
    "@gmail.com", # <-- ALLOW GMAIL FOR NOW
)

# --- Modified Helper to check allowed email domains ---
def is_allowed_email_domain(email: Optional[str]) -> bool:
    """Checks if the email belongs to one of the allowed domains."""
    if not email:
        return False
    # Ensure case-insensitive check
    email_lower = email.lower()
    for domain in ALLOWED_EMAIL_DOMAINS:
        if email_lower.endswith(domain):
            return True
    return False

async def get_api_key(api_key: str = Security(api_key_header)):
    # if not INTERNAL_API_KEY: # Allow access if key is not set (for local dev maybe)
    #     print("Allowing access to internal API without key (INTERNAL_API_KEY not set)")
    #     return "dummy_key_allowed"
    if api_key == INTERNAL_API_KEY:
        return api_key
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing Internal API Key"
        )
# --- End Security Setup ---

@router.get("/user-by-sub/{google_sub}", response_model=UserInternalResponse, dependencies=[Security(get_api_key)])
async def get_user_by_google_sub(google_sub: str, db: AsyncSession = Depends(get_async_db)):
    """
    Internal endpoint to fetch user details by Google SUB ID.
    Requires X-Internal-API-Key header.
    """
    logger.info(f"Internal API: Fetching user by sub: {google_sub}")
    result = await db.execute(
        select(User)
        .options(selectinload(User.preferences))
        .filter(User.google_sub == google_sub)
    )
    db_user = result.scalar_one_or_none()
    if not db_user: # type: ignore
        print(f"Internal API: User not found for sub: {google_sub}")
        raise HTTPException(status_code=404, detail="User not found")

    #! Decrypt email IF needed only
    #! Be careful returning PII even on internal APIs
    #! Check with project lead if this is necessary
    # if db_user.email:
    #     plain_email = decrypt_data(db_user.email)
    #     db_user.email = plain_email # Set decrypted email for response (if needed)

    return UserInternalResponse(
        id=db_user.id, # type: ignore
        google_sub=str(db_user.google_sub),
        email=str(db_user.email) if db_user.email is not None else None,  # Convert Column to str for proper typing
        wallet_address=str(db_user.wallet_address) if db_user.wallet_address is not None else None,
        role=None,
        allow_email_checkins=bool(allow_email_checkins_for_user(db_user)),
    )

# --- POST Endpoint for User Sync ---
@router.post("/sync-user", response_model=UserSyncResponse, dependencies=[Security(get_api_key)])
async def sync_user_on_login(
    payload: UserSyncPayload = Body(...),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Called internally by NextAuth after login.
    Ensures user exists or creates a new one if not found.
    """
    logger.info(f"Sync user request received for google_sub: {payload.google_sub[:10]}...")

    # Always use the service to get or create the user
    try:
        db_user = await async_get_or_create_user(db, google_sub=payload.google_sub, plain_email=payload.email)
    except HTTPException as e:
        logger.error(f"User sync failed: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during user sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error processing user sync.")

    return UserSyncResponse(
        message="User synced successfully",
        user_id=db_user.id, # type: ignore
        google_sub=str(db_user.google_sub),
        email_stored=(db_user.email is not None)
    )