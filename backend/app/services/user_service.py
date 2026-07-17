# backend/app/services/user_service.py (New File)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status  # type: ignore
from typing import Optional
import logging

from app.models import User # Import User model

logger = logging.getLogger(__name__)

async def async_get_or_create_user(db: AsyncSession, google_sub: str, plain_email: Optional[str] = None) -> User:
    """
    Asynchronously finds a user by google_sub or email, or creates a new one.
    If a user exists with the email but not the google_sub, it links them.
    """
    logger.info("ASYNC_SERVICE: get/create user for sub: %s", google_sub[:10])
    
    # 1. Try to find user by google_sub
    stmt = select(User).where(User.google_sub == google_sub)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    needs_commit = False

    if user:
        logger.info("Found user by google_sub: %s", user.id)
        # If user found by sub, but email is not set, try to set it
        if not user.email and plain_email:
            setattr(user, 'email', plain_email)
            db.add(user)
            needs_commit = True
    else:
        logger.info("User not found by google_sub. Checking by email: %s", plain_email)
        # 2. If not found by sub, try by email
        if plain_email:
            stmt_email = select(User).where(User.email == plain_email)
            result_email = await db.execute(stmt_email)
            user_by_email = result_email.scalar_one_or_none()

            if user_by_email:
                # 3. User exists with this email, link google_sub
                logger.info("User found by email (%s). Linking google_sub.", plain_email)
                user = user_by_email
                setattr(user, 'google_sub', google_sub)
                db.add(user)
                needs_commit = True
            else:
                # 4. No user found by sub or email, create new user
                logger.info("No user found by email. Creating new user for sub %s.", google_sub[:10])
                try:
                    user = User(
                        google_sub=google_sub,
                        email=plain_email,
                    )
                    db.add(user)
                    needs_commit = True
                except Exception as e:
                    logger.error(
                        "ASYNC_SERVICE: Error instantiating User for sub %s: %s",
                        google_sub[:10],
                        e,
                        exc_info=True,
                    )
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to prepare user record.")
        else:
            # Cannot find by email, and no user by sub, so create a new one without email
            logger.info("No plain_email provided. Creating new user for sub %s without email.", google_sub[:10])
            try:
                user = User(google_sub=google_sub)
                db.add(user)
                needs_commit = True
            except Exception as e:
                logger.error(
                    "ASYNC_SERVICE: Error instantiating User for sub %s: %s",
                    google_sub[:10],
                    e,
                    exc_info=True,
                )
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to prepare user record.")


    if needs_commit:
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError as exc:
            await db.rollback()
            # Narrow the conflict check to the email unique index via the
            # underlying driver exception, not fragile string inspection of
            # the wrapper exception type name.
            orig_msg = str(getattr(exc, "orig", exc)).lower()
            if "ix_users_email" in orig_msg or "unique" in orig_msg and "email" in orig_msg:
                logger.warning(
                    "ASYNC_SERVICE: email conflict for sub %s: %s",
                    google_sub[:10],
                    exc,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "An account with this email already exists but could not be linked "
                        "automatically. Please log in with your original method and link "
                        "your account in settings."
                    ),
                )
            logger.error(
                "ASYNC_SERVICE: db.commit() FAILED for user related to sub %s: %s",
                google_sub[:10],
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save user record due to database error.",
            )
        except Exception as exc:
            await db.rollback()
            logger.error(
                "ASYNC_SERVICE: unexpected error committing user for sub %s: %s",
                google_sub[:10],
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save user record due to an unexpected error.",
            )

    return user

async def async_get_user_by_google_sub(db: AsyncSession, google_sub: str) -> Optional[User]:
    stmt = select(User).where(User.google_sub == google_sub)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def async_get_user_by_plain_email(db: AsyncSession, plain_email: str) -> Optional[User]:
    """Lookup by plaintext email."""
    # Since encryption is disabled, we can do a direct DB lookup.
    # We use ILIKE or func.lower() for case-insensitive match if needed, but exact match is faster.
    # For now, let's assume stored emails are normalized or just do exact match.
    
    stmt = select(User).where(User.email == plain_email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()



