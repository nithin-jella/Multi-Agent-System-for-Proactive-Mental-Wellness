# backend/app/dependencies.py
from __future__ import annotations

import hashlib
import logging
import time
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, status  # type: ignore
from app.core.cache import get_cache_service
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, lazyload, load_only, selectinload

from app.auth_utils import decrypt_and_validate_token
from app.core.role_utils import ALLOWED_ADMIN_ROLES, normalize_role
from app.database import get_async_db
from app.models import User

logger = logging.getLogger(__name__)

_AUTH_CACHE: dict[int, tuple[float, User]] = {}
_AUTH_CACHE_TTL = 60  # seconds

def invalidate_auth_cache(user_id: int) -> None:
    """Remove cached auth data for a user. Call on profile/role changes."""
    _AUTH_CACHE.pop(user_id, None)


def get_token_from_request(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None),
    token_cookie: str | None = Cookie(default=None, alias="token"),
    auth_cookie: str | None = Cookie(default=None, alias="auth"),
    nextauth_session: str | None = Cookie(default=None, alias="next-auth.session-token"),
) -> str:
    """Obtain bearer token from Authorization header or known cookies.

    Order of precedence: Authorization header > access_token > token > auth > nextauth_session
    """
    candidate: str | None = None
    source = "none"
    
    if authorization and authorization.lower().startswith("bearer "):
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[1].strip():
            candidate = parts[1].strip()
            source = "Authorization header"
    
    if not candidate:
        if access_token:
            candidate = access_token
            source = "access_token cookie"
        elif token_cookie:
            candidate = token_cookie
            source = "token cookie"
        elif auth_cookie:
            candidate = auth_cookie
            source = "auth cookie"
        elif nextauth_session:
            candidate = nextauth_session
            source = "next-auth.session-token cookie"
    
    if not candidate:
        logger.warning("No authentication token found in request (checked: Authorization header, cookies: access_token, token, auth, next-auth.session-token)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    
    logger.debug("Token found in: %s", source)
    return candidate


async def get_current_active_user(
    request: Request,
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_async_db),
) -> User:
    """Dependency to return the authenticated and active user for a valid JWT."""
    return await _resolve_current_active_user(
        token=token,
        db=db,
        request=request,
        eager_normalized_relations=False,
    )


async def get_current_active_user_with_normalized_relations(
    request: Request,
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_async_db),
) -> User:
    """Authenticated active user with normalized relations eagerly loaded.

    Use this dependency only for routes that read/write normalized user tables
    (e.g., profile/preferences/clinical views) to avoid async lazy-load issues.
    """
    return await _resolve_current_active_user(
        token=token,
        db=db,
        request=request,
        eager_normalized_relations=True,
    )


def _build_auth_user_query(user_id: int, eager_normalized_relations: bool):
    if eager_normalized_relations:
        return (
            select(User)
            .options(
                joinedload(User.profile),
                joinedload(User.preferences),
                selectinload(User.clinical_record),
                selectinload(User.emergency_contacts),
            )
            .where(User.id == user_id)
        )

    return (
        select(User)
        .options(
            lazyload("*"),
            load_only(
                User.id,
                User.is_active,
                User.role,
                User.google_sub,
                User.preferred_name,
                User.first_name,
                User.name,
            ),
        )
        .where(User.id == user_id)
    )


async def _resolve_current_active_user(
    token: str,
    db: AsyncSession,
    request: Request,
    eager_normalized_relations: bool,
) -> User:
    """Resolve authenticated active user with optional eager relation loading."""
    payload = decrypt_and_validate_token(token)

    try:
        user_id = int(payload.sub)
    except (TypeError, ValueError):
        logger.error("JWT subject is not a valid user identifier: %s", payload.sub)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )

    user = None

    # Only use cache for standard (non-eager) auth lookups
    if not eager_normalized_relations:
        now = time.monotonic()
        cached_entry = _AUTH_CACHE.get(user_id)
        if cached_entry is not None:
            cached_at, cached_user = cached_entry
            if now - cached_at < _AUTH_CACHE_TTL and cached_user.is_active:
                user = cached_user
            else:
                _AUTH_CACHE.pop(user_id, None)

    if user is None:
        auth_user_query = _build_auth_user_query(
            user_id=user_id,
            eager_normalized_relations=eager_normalized_relations,
        )

        try:
            result = await db.execute(auth_user_query)
            user = result.unique().scalar_one_or_none()
        except DBAPIError as exc:
            logger.warning(
                "Transient DB error while resolving current user id=%s; retrying once: %s",
                user_id,
                exc,
            )
            await db.rollback()
            result = await db.execute(auth_user_query)
            user = result.unique().scalar_one_or_none()

        if not user:
            logger.warning("JWT resolved to missing user id=%s", user_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
            )

        if not eager_normalized_relations:
            _AUTH_CACHE[user_id] = (time.monotonic(), user)

    if not user.is_active:
        logger.warning("Inactive user %s attempted to access protected route", user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    if payload.role and payload.role != user.role:
        logger.warning(
            "Token role mismatch for user %s: token=%s, db=%s",
            user_id,
            payload.role,
            user.role,
        )

    if payload.google_sub and user.google_sub and payload.google_sub != user.google_sub:
        logger.warning(
            "Token google_sub mismatch for user %s: token=%s, db=%s",
            user_id,
            payload.google_sub,
            user.google_sub,
        )

    # Expose request-scoped context for non-DI layers (e.g., middleware).
    # Never store raw tokens; use a deterministic hash.
    try:
        request.state.user_id = int(user.id)
        request.state.session_id = hashlib.sha256(token.encode("utf-8")).hexdigest()
        request.state.analytics_allowed = True
    except Exception:
        # Non-fatal; auth should still succeed.
        pass

    return user


async def get_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Dependency to ensure the current user is an admin, counselor, or read-only admin viewer.

    Role aliases (e.g. 'administrator') are resolved via normalize_role before
    the allow-list check.  This dependency is read-only: it never mutates the
    user object or commits to the database.
    """
    raw_role = getattr(current_user, "role", "") or ""
    effective_role = normalize_role(raw_role)

    # admin_viewer is permitted here so GET routes pass through; the
    # router-level get_admin_readonly_user gate already blocks non-GET requests.
    if effective_role not in ALLOWED_ADMIN_ROLES:
        logger.warning(
            "Access denied: user %s role='%s' (effective='%s') not in %s",
            getattr(current_user, "id", "?"),
            raw_role,
            effective_role,
            ALLOWED_ADMIN_ROLES,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin, counselor, or admin_viewer access required",
        )

    if not getattr(current_user, "is_active", True):
        logger.warning(
            "Inactive privileged user %s attempted to access admin endpoint",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return current_user


async def get_admin_readonly_user(
    request: Request,
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Router-level gate for all admin routes.

    - admin / counselor: full read + write access.
    - admin_viewer: read-only access (GET / HEAD / OPTIONS only).
      Any other HTTP method returns 403 before the route handler is reached.
    """
    raw_role = getattr(current_user, "role", "") or ""
    effective_role = normalize_role(raw_role)

    if effective_role not in ALLOWED_ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    if not getattr(current_user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    if effective_role == "admin_viewer" and request.method.upper() not in {"GET", "HEAD", "OPTIONS"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only admin access. This action requires full admin or counselor privileges.",
        )

    return current_user
