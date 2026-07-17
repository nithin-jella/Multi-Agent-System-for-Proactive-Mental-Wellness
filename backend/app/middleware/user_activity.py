"""User activity tracking middleware.

This records *coarse* activity signals for retention analytics:
- one row per user per day (`user_daily_activity`)

Important:
- This middleware uses its own DB session to avoid interfering with the
  request handler's transaction.
- It respects `user_preferences.allow_analytics_tracking` when available.

The request must provide `request.state.user_id` (and optionally
`request.state.session_id`, `request.state.analytics_allowed`), which is
populated by the auth dependency.
"""

from __future__ import annotations

from datetime import datetime
from typing import Callable, Optional

from fastapi import Request, Response
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import AsyncSessionLocal
from app.models import User, UserDailyActivity
from app.services.user_normalization import ensure_user_normalized_tables, set_profile_last_activity_date
from app.services.user_event_service import record_user_event

try:
    from zoneinfo import ZoneInfo

    _JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
except Exception:  # pragma: no cover
    _JAKARTA_TZ = None  # type: ignore[assignment]


_EXCLUDE_PREFIXES = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    "/favicon.ico",
    "/metrics",
)


def _should_track(request: Request) -> bool:
    path = request.url.path or ""
    if any(path.startswith(p) for p in _EXCLUDE_PREFIXES):
        return False
    if request.method.upper() in {"OPTIONS", "HEAD"}:
        return False
    return True


class UserActivityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        if not _should_track(request):
            return response

        user_id: Optional[int] = getattr(request.state, "user_id", None)
        if not user_id:
            return response

        analytics_allowed: Optional[bool] = getattr(request.state, "analytics_allowed", None)
        if analytics_allowed is False:
            return response

        now = datetime.now(tz=_JAKARTA_TZ) if _JAKARTA_TZ else datetime.utcnow()
        activity_date = now.date()

        try:
            async with AsyncSessionLocal() as db:
                user = (await db.execute(select(User).where(User.id == int(user_id)))).scalar_one_or_none()
                if not user:
                    return response

                # Ensure profile/preferences exist; also keeps legacy->normalized sync best-effort.
                await ensure_user_normalized_tables(db, user)

                # Upsert daily activity.
                stmt = select(UserDailyActivity).where(
                    UserDailyActivity.user_id == user.id,
                    UserDailyActivity.activity_date == activity_date,
                )
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.last_seen_at = now
                    existing.request_count = int(existing.request_count or 0) + 1
                    db.add(existing)
                else:
                    row = UserDailyActivity(
                        user_id=user.id,
                        activity_date=activity_date,
                        first_seen_at=now,
                        last_seen_at=now,
                        source="api",
                        request_count=1,
                    )
                    db.add(row)
                    await record_user_event(
                        db,
                        user_id=user.id,
                        event_name="activity.daily",
                        session_id=getattr(request.state, "session_id", None),
                        request_id=getattr(request.state, "request_id", None),
                        ip_address=getattr(request.client, "host", None) if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        metadata={
                            "source": "api",
                            "path": request.url.path,
                            "method": request.method,
                        },
                    )

                await set_profile_last_activity_date(db, user=user, activity_date=activity_date)

                await db.commit()
        except Exception:
            # Non-blocking by design; analytics should never fail the request.
            return response

        return response
