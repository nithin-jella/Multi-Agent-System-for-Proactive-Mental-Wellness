import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import Header, Cookie

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from passlib.context import CryptContext # type: ignore
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import create_access_token, decrypt_and_validate_token
from app.database import get_async_db
from app.models import User
from app.services.user_normalization import allow_email_checkins as allow_email_checkins_for_user
from app.services.user_service import async_get_user_by_plain_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserLoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    yearOfStudy: Optional[str] = None
    allowEmailCheckins: Optional[bool] = None


class RegisterResponse(BaseModel):
    message: str
    user_id: int


class ForgotPasswordRequest(BaseModel):
    email: str


class OAuthTokenRequest(BaseModel):
    provider: str
    provider_account_id: str
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    role: str | None = None


class ForgotPasswordResponse(BaseModel):
    message: str


def normalize_oauth_role(email: Optional[str], requested_role: Optional[str]) -> str:
    """Restrict accepted roles for OAuth sign-ins."""
    if requested_role in {"user", "guest"}:
        return requested_role
    if email and email.lower().endswith("@ugm.ac.id"):
        return "user"
    return "guest"


def serialize_user(
    user: User,
    *,
    fallback_email: Optional[str] = None,
    fallback_name: Optional[str] = None,
) -> dict:
    """Return a safe representation of the user for API responses."""
    profile_photo_url: Optional[str] = None
    if hasattr(user, "profile") and user.profile is not None:
        profile_photo_url = user.profile.profile_photo_url
    return {
        "id": str(user.id),
        "email": user.email or fallback_email,
        "name": user.name or fallback_name,
        "role": user.role,
        "google_sub": user.google_sub,
        "allow_email_checkins": bool(allow_email_checkins_for_user(user)),
        "profile_photo_url": profile_photo_url,
    }


def build_token_payload(user: User) -> dict[str, str]:
    payload: dict[str, str] = {"sub": str(user.id), "role": user.role}
    if user.google_sub:
        payload["google_sub"] = user.google_sub
    return payload


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _cookie_flags() -> tuple[bool, str]:
    """Cookie flags tuned by env vars.

    Defaults are production-safe (Secure + SameSite=None). Local dev should set:
    - COOKIE_SECURE=false
    - COOKIE_SAMESITE=lax
    """

    secure = _bool_env("COOKIE_SECURE", True)
    samesite = (os.getenv("COOKIE_SAMESITE") or ("none" if secure else "lax")).strip().lower()
    if samesite not in {"lax", "strict", "none"}:
        samesite = "none" if secure else "lax"

    # Browsers reject SameSite=None cookies unless Secure is also set.
    if samesite == "none" and not secure:
        logger.warning("COOKIE_SAMESITE=none requires COOKIE_SECURE=true; falling back to samesite=lax")
        samesite = "lax"

    return secure, samesite


@router.post("/oauth/token", response_model=Token)
async def exchange_oauth_token(
    payload: OAuthTokenRequest,
    response: Response,
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    """Upsert a user coming from an OAuth provider and issue an internal token."""
    if payload.provider.lower() != "google":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported OAuth provider",
        )

    provider_account_id = payload.provider_account_id
    if not provider_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing provider account id",
        )

    encrypted_email = payload.email

    stmt = select(User).where(User.google_sub == provider_account_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user and encrypted_email:
        stmt = select(User).where(User.email == encrypted_email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

    try:
        if user is None:
            role = normalize_oauth_role(payload.email, payload.role)
            user = User(
                google_sub=provider_account_id,
                email=encrypted_email,
                name=payload.name,
                role=role,
                is_active=True,
                email_verified=True,
                created_at=datetime.utcnow(),
                check_in_code=uuid.uuid4().hex,
            )
            db.add(user)
            await db.flush()  # Ensure user.id is available for UserProfile FK

            # Create UserProfile and store OAuth picture on first login
            from app.models import UserProfile
            user_profile = UserProfile(
                user_id=user.id,
                profile_photo_url=payload.picture,
            )
            db.add(user_profile)
        else:
            updated = False
            if user.google_sub != provider_account_id:
                user.google_sub = provider_account_id
                updated = True
            if encrypted_email and user.email != encrypted_email:
                user.email = encrypted_email
                updated = True
            if payload.name:
                if user.name != payload.name:
                    user.name = payload.name
                    updated = True
            if not user.is_active:
                user.is_active = True
                updated = True
            if not user.email_verified:
                user.email_verified = True
                updated = True
            if updated:
                db.add(user)

            # Store OAuth picture only if UserProfile has no photo yet
            if payload.picture:
                from app.models import UserProfile
                from sqlalchemy import select as _select
                profile_result = await db.execute(
                    _select(UserProfile).where(UserProfile.user_id == user.id)
                )
                existing_profile = profile_result.scalar_one_or_none()
                if existing_profile is None:
                    new_profile = UserProfile(
                        user_id=user.id,
                        profile_photo_url=payload.picture,
                    )
                    db.add(new_profile)
                elif not existing_profile.profile_photo_url:
                    existing_profile.profile_photo_url = payload.picture
                    db.add(existing_profile)

        user.last_login = datetime.utcnow()
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to exchange OAuth token for %s", provider_account_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during OAuth sign-in",
        ) from exc

    access_token = create_access_token(build_token_payload(user))

    body = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(
            user,
            fallback_email=payload.email,
            fallback_name=payload.name,
        ),
    }
    # Set cookie for browser-based access (HttpOnly, secure configurable)
    cookie_secure, cookie_samesite = _cookie_flags()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=cookie_secure,
        samesite=cookie_samesite,
        max_age=60*60*24,
        path="/",
    )
    return body


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    return bool(hashed_password and pwd_context.verify(plain_password, hashed_password))


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


@router.post("/token", response_model=Token)
async def login_for_access_token(
    request: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    logger.info("Login attempt for: %s", request.email)

    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = await async_get_user_by_plain_email(db, request.email)

    if (
        not user
        or not user.password_hash
        or not verify_password(request.password, user.password_hash)
    ):
        logger.warning("Authentication failed for: %s", request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        logger.warning("Inactive account attempted login: %s", request.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    user.last_login = datetime.utcnow()
    db.add(user)

    # Retry commit with exponential backoff for transient connection issues
    max_retries = 3
    retry_delay = 0.5
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            await db.commit()
            await db.refresh(user)
            break  # Success
        except Exception as exc:
            last_exception = exc
            await db.rollback()
            
            # Check if it's a connection-related error that we should retry
            exc_str = str(exc).lower()
            is_retryable = any([
                "connection" in exc_str,
                "timeout" in exc_str,
                "closed" in exc_str,
            ])
            
            if attempt < max_retries - 1 and is_retryable:
                logger.warning(
                    "Login commit failed (attempt %d/%d) for %s: %s. Retrying...",
                    attempt + 1, max_retries, request.email, exc
                )
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                # Final attempt failed or non-retryable error
                logger.exception("Failed to finalize login for %s", request.email)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Internal server error during login",
                ) from exc

    access_token = create_access_token(build_token_payload(user))

    logger.info("Login successful for user_id: %s, email: %s, role: %s", user.id, request.email, user.role)
    body = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(user, fallback_email=request.email),
    }
    cookie_secure, cookie_samesite = _cookie_flags()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=cookie_secure,
        samesite=cookie_samesite,
        max_age=60*60*24,
        path="/",
    )
    return body


@router.post("/register", response_model=RegisterResponse)
async def register_user(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    try:
        logger.info("User registration attempt for: %s", request.email)

        stmt = select(User).where(User.email == request.email)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        hashed_password = get_password_hash(request.password)

        date_of_birth = None
        if request.dateOfBirth:
            try:
                date_of_birth = datetime.strptime(request.dateOfBirth, "%Y-%m-%d").date()
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format for dateOfBirth. Please use YYYY-MM-DD.",
                ) from exc

        # Create core User record (auth only)
        new_user = User(
            name=request.name,
            email=request.email,
            password_hash=hashed_password,
            role="user",
            # Keep legacy fields for backward compatibility during migration
            first_name=request.firstName,
            last_name=request.lastName,
            phone=request.phone,
            date_of_birth=date_of_birth,
            gender=request.gender,
            city=request.city,
            university=request.university,
            major=request.major,
            year_of_study=request.yearOfStudy,
            allow_email_checkins=request.allowEmailCheckins,
            check_in_code=uuid.uuid4().hex,
        )

        db.add(new_user)
        await db.flush()  # Get user.id without committing

        # Create UserProfile (normalized table)
        from app.models import UserProfile
        user_profile = UserProfile(
            user_id=new_user.id,
            first_name=request.firstName,
            last_name=request.lastName,
            phone=request.phone,
            date_of_birth=date_of_birth,
            gender=request.gender,
            city=request.city,
            country="Indonesia",  # Default for UGM
            university=request.university,
            major=request.major,
            year_of_study=int(request.yearOfStudy) if request.yearOfStudy and request.yearOfStudy.isdigit() else None,
        )
        db.add(user_profile)

        # Create UserPreferences (normalized table)
        from app.models import UserPreferences
        user_preferences = UserPreferences(
            user_id=new_user.id,
            preferred_language="id",  # Default Indonesian
            preferred_timezone="Asia/Jakarta",  # Default Indonesian timezone
            allow_email_checkins=request.allowEmailCheckins if request.allowEmailCheckins is not None else True,
            theme="system",
            aika_personality="empathetic",  # Default AI personality
            aika_response_length="balanced",
        )
        db.add(user_preferences)

        # Create initial consent ledger entries (GDPR/HIPAA compliance)
        from app.models import UserConsentLedger
        
        # Data sharing consent (default: not granted, user can opt-in later)
        data_sharing_consent = UserConsentLedger(
            user_id=new_user.id,
            consent_type="data_sharing",
            granted=False,
            consent_version="v1.0",
            consent_language="id",
            consent_method="registration",
            timestamp=datetime.now(),
        )
        db.add(data_sharing_consent)

        # Research consent (default: not granted, user can opt-in later)
        research_consent = UserConsentLedger(
            user_id=new_user.id,
            consent_type="research",
            granted=False,
            consent_version="v1.0",
            consent_language="id",
            consent_method="registration",
            timestamp=datetime.now(),
        )
        db.add(research_consent)

        # Commit all changes
        await db.commit()
        await db.refresh(new_user)

        logger.info("User registered successfully: user_id=%s", new_user.id)

        return {
            "message": "User registered successfully",
            "user_id": new_user.id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error("User registration error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during user registration",
        ) from exc


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_async_db)
) -> ForgotPasswordResponse:
    """Initiate password reset process."""
    try:
        logger.info("Password reset request for: %s", request.email)

        from app.utils.password_reset import create_password_reset_token
        
        # Create password reset token and send email
        await create_password_reset_token(db, request.email)

        # Always return the same message for security (don't reveal if email exists)
        return ForgotPasswordResponse(
            message="If an account with this email exists, a password reset link has been sent."
        )
    except Exception as exc:
        logger.error("Password reset error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during password reset",
        ) from exc


@router.post("/validate-reset-token")
async def validate_reset_token(
    request: dict,
    db: AsyncSession = Depends(get_async_db)
) -> dict:
    """Validate a password reset token."""
    try:
        token = request.get("token")
        if not token or not isinstance(token, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid token is required"
            )

        from app.utils.password_reset import is_token_expired
        from sqlalchemy import select
        from app.models.user import User
        
        # Find user by reset token
        result = await db.execute(
            select(User).where(User.password_reset_token == token)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return {
                "valid": False,
                "message": "Invalid reset token"
            }
            
        # Check if token is expired
        if is_token_expired(user.password_reset_expires):
            return {
                "valid": False,
                "message": "Reset token has expired"
            }
            
        return {
            "valid": True,
            "message": "Token is valid",
            "email": user.email
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Token validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token validation",
        ) from exc


@router.post("/reset-password")
async def reset_password(
    request: dict,
    db: AsyncSession = Depends(get_async_db)
) -> dict:
    """Reset password using a valid reset token."""
    try:
        token = request.get("token")
        new_password = request.get("new_password")
        confirm_password = request.get("confirm_password")
        
        if not all([token, new_password, confirm_password]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token, new password, and confirmation password are required"
            )
            
        # Type validation
        if not isinstance(token, str) or not isinstance(new_password, str) or not isinstance(confirm_password, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data types provided"
            )
            
        if new_password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password confirmation does not match"
            )
            
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )

        from app.utils.password_reset import reset_password_with_token
        
        # Reset the password
        result = await reset_password_with_token(db, token, new_password)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
            
        return result
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Password reset error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during password reset",
        ) from exc


@router.get("/me")
async def get_current_user_info(request: Request, db: AsyncSession = Depends(get_async_db)) -> dict:
    """Return the currently authenticated user's public info (role, id, email, name).

    Tries Authorization: Bearer <token> header first, then falls back to common cookie keys.
    This is consumed by the frontend AccessGuard. Returns 401 if credentials are missing/invalid.
    """
    # Extract Authorization header safely (case-insensitive) and fall back to cookies
    auth_header = request.headers.get("authorization")
    token: str | None = None
    if auth_header and isinstance(auth_header, str) and auth_header.lower().startswith("bearer "):
        parts = auth_header.split(" ", 1)
        if len(parts) == 2 and parts[1].strip():
            token = parts[1].strip()
    if not token:
        cookies = request.cookies or {}
        token = (
            cookies.get("access_token")
            or cookies.get("token")
            or cookies.get("auth")
            or cookies.get("next-auth.session-token")
        )
    if not token:
        logger.warning("/auth/me missing credentials (no header/cookies)")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    payload = decrypt_and_validate_token(token)
    if not payload.sub:
        logger.warning("/auth/me token missing subject claim")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    try:
        user_id = int(payload.sub)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("/auth/me user id %s not found", payload.sub)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    logger.debug("/auth/me success user_id=%s role=%s", user.id, user.role)

    return serialize_user(user)


@router.get("/debug-cookies")
async def debug_cookies(request: Request):
    """Return auth-related cookies (names and first 8 chars of value) for debugging.

    Do NOT expose in production unless gated; kept lightweight here.
    """
    interesting = [
        "access_token",
        "token",
        "auth",
        "next-auth.session-token",
        "__Secure-next-auth.session-token",
    ]
    found = {}
    for name in interesting:
        if name in request.cookies:
            val = request.cookies.get(name) or ""
            found[name] = val[:8] + ("..." if len(val) > 8 else "")
    return {"cookies": found, "count": len(found)}


