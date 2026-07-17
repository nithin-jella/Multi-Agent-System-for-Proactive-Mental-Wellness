"""Redis-based rate limiting service.

This module provides rate limiting functionality to protect expensive LLM API calls
and prevent abuse. It uses Redis for distributed rate limiting with sliding window counters.

Features:
- Role-based rate limits (student, counsellor, admin)
- Multiple time windows (per-minute, per-hour, per-day)
- Admin bypass capability
- Graceful error messages with Retry-After headers
- Audit logging for security monitoring

Usage:
    from app.core.rate_limiter import get_rate_limiter, check_rate_limit_dependency
    
    # In routes:
    @router.post("/chat", dependencies=[Depends(check_rate_limit_dependency)])
    async def chat_endpoint(...):
        ...
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Literal, Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.memory import get_redis_client
from app.core.settings import settings
from app.database import get_async_db
from app.dependencies import get_current_active_user
from app.models import User

logger = logging.getLogger(__name__)

# Type aliases
RateLimitWindow = Literal["minute", "hour", "day"]
RateLimitResult = Tuple[bool, int, int]  # (is_allowed, remaining, reset_timestamp)


class RateLimiter:
    """Redis-based rate limiter with sliding window counters.
    
    This class implements distributed rate limiting using Redis INCR and EXPIRE
    commands. Each user/endpoint combination has separate counters for different
    time windows (minute, hour, day).
    
    Key Pattern:
        rate_limit:{endpoint}:{user_id}:{window}
        Example: rate_limit:chat:123:hour
    
    Attributes:
        enabled: Whether rate limiting is enabled globally
    """
    
    def __init__(self):
        """Initialize rate limiter."""
        self.enabled = settings.rate_limit_enabled
        self._hit_count = 0  # For metrics
        self._block_count = 0  # For metrics
    
    async def check_rate_limit(
        self,
        user_id: int,
        endpoint: str,
        role: str = "student"
    ) -> RateLimitResult:
        """Check if user is within rate limit for endpoint.
        
        Args:
            user_id: User ID to check
            endpoint: Endpoint name (e.g., "chat", "analytics")
            role: User role (student, counsellor, admin)
        
        Returns:
            Tuple of (is_allowed, remaining_requests, reset_timestamp)
            
        Raises:
            ConnectionError: If Redis connection fails
        """
        if not self.enabled:
            # Rate limiting disabled, allow all requests
            return (True, 999999, 0)
        
        # Admin bypass
        if role == "admin" and settings.rate_limit_bypass_admin:
            logger.debug(f"Rate limit bypassed for admin user_id={user_id}")
            return (True, 999999, 0)
        
        # Check all time windows (minute, hour, day)
        # If any window is exceeded, deny the request
        for window in ["minute", "hour", "day"]:
            is_allowed, remaining, reset_ts = await self._check_window(
                user_id, endpoint, role, window  # type: ignore
            )
            
            if not is_allowed:
                self._block_count += 1
                logger.warning(
                    f"Rate limit exceeded: user_id={user_id}, endpoint={endpoint}, "
                    f"role={role}, window={window}, reset_at={reset_ts}"
                )
                return (False, 0, reset_ts)
        
        self._hit_count += 1
        logger.debug(f"Rate limit check passed: user_id={user_id}, endpoint={endpoint}")
        
        # Return the most restrictive remaining count
        minute_result = await self._check_window(user_id, endpoint, role, "minute")
        return minute_result
    
    async def _check_window(
        self,
        user_id: int,
        endpoint: str,
        role: str,
        window: RateLimitWindow
    ) -> RateLimitResult:
        """Check rate limit for a specific time window.
        
        Args:
            user_id: User ID
            endpoint: Endpoint name
            role: User role
            window: Time window (minute, hour, day)
        
        Returns:
            Tuple of (is_allowed, remaining_requests, reset_timestamp)
        """
        # Get limit for this role and window
        limit = self._get_limit_for_role(role, endpoint, window)
        
        # Build Redis key
        key = self._build_key(endpoint, user_id, window)
        
        try:
            redis = await get_redis_client()
            
            # Get current counter value
            current = await redis.get(key)
            current_count = int(current) if current else 0
            
            # Calculate TTL and reset timestamp
            ttl = self._get_window_ttl(window)
            reset_timestamp = int((datetime.now() + timedelta(seconds=ttl)).timestamp())
            
            # Check if limit exceeded
            if current_count >= limit:
                remaining = 0
                return (False, remaining, reset_timestamp)
            
            # Increment counter
            new_count = await redis.incr(key)
            
            # Set expiration if this is the first request in the window
            if new_count == 1:
                await redis.expire(key, ttl)
            
            remaining = max(0, limit - new_count)
            return (True, remaining, reset_timestamp)
            
        except ConnectionError as e:
            logger.error(f"Redis connection error in rate limiter: {e}")
            # Fail open: allow request if Redis is down
            return (True, limit, 0)
        except Exception as e:
            logger.error(f"Unexpected error in rate limiter: {e}", exc_info=True)
            # Fail open: allow request on unexpected errors
            return (True, limit, 0)
    
    def _build_key(self, endpoint: str, user_id: int, window: RateLimitWindow) -> str:
        """Build Redis key for rate limit counter.
        
        Args:
            endpoint: Endpoint name
            user_id: User ID
            window: Time window
        
        Returns:
            Redis key string
        """
        return f"rate_limit:{endpoint}:{user_id}:{window}"
    
    def _get_limit_for_role(
        self,
        role: str,
        endpoint: str,
        window: RateLimitWindow
    ) -> int:
        """Get rate limit for role, endpoint, and time window.
        
        Args:
            role: User role (student, counsellor, admin)
            endpoint: Endpoint name (chat, analytics, etc.)
            window: Time window (minute, hour, day)
        
        Returns:
            Rate limit count
        """
        # Default limits (can be overridden in settings)
        defaults = {
            "student": {"minute": 10, "hour": 100, "day": 500},
            "counsellor": {"minute": 30, "hour": 300, "day": 2000},
            "admin": {"minute": 100, "hour": 1000, "day": 10000},
        }
        
        # Map endpoint to settings attribute
        endpoint_map = {
            "chat": "chat",
            "analytics": "analytics",
        }
        
        endpoint_key = endpoint_map.get(endpoint, "chat")
        
        # Try to get from settings, fall back to defaults
        setting_name = f"rate_limit_{endpoint_key}_per_{window}_{role}"
        limit = getattr(settings, setting_name, None)
        
        if limit is not None:
            return limit
        
        # Fall back to defaults
        return defaults.get(role, defaults["student"]).get(window, 100)
    
    def _get_window_ttl(self, window: RateLimitWindow) -> int:
        """Get TTL in seconds for time window.
        
        Args:
            window: Time window
        
        Returns:
            TTL in seconds
        """
        ttl_map = {
            "minute": 60,
            "hour": 3600,
            "day": 86400,
        }
        return ttl_map[window]
    
    async def reset_limit(
        self,
        user_id: int,
        endpoint: str,
        window: Optional[RateLimitWindow] = None
    ) -> int:
        """Reset rate limit for user (admin/testing purposes).
        
        Args:
            user_id: User ID
            endpoint: Endpoint name
            window: Optional specific window, or None to reset all windows
        
        Returns:
            Number of keys deleted
        """
        try:
            redis = await get_redis_client()
            
            if window:
                # Reset specific window
                key = self._build_key(endpoint, user_id, window)
                deleted = await redis.delete(key)
                logger.info(f"Reset rate limit: user_id={user_id}, endpoint={endpoint}, window={window}")
                return deleted
            else:
                # Reset all windows
                pattern = f"rate_limit:{endpoint}:{user_id}:*"
                keys = await redis.keys(pattern)
                if keys:
                    deleted = await redis.delete(*keys)
                    logger.info(f"Reset all rate limits: user_id={user_id}, endpoint={endpoint}, count={deleted}")
                    return deleted
                return 0
                
        except Exception as e:
            logger.error(f"Error resetting rate limit: {e}", exc_info=True)
            return 0
    
    async def get_stats(self) -> dict:
        """Get rate limiter statistics.
        
        Returns:
            Dictionary with hit_count, block_count, and block_rate (as percentage)
        """
        total = self._hit_count + self._block_count
        return {
            "enabled": self.enabled,
            "total_checks": total,
            "allowed": self._hit_count,
            "blocked": self._block_count,
            "block_rate": (
                (self._block_count / total) * 100
                if total > 0
                else 0.0
            )
        }


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get global rate limiter instance.
    
    Returns:
        RateLimiter instance
    """
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def check_rate_limit_dependency(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
) -> None:
    """FastAPI dependency for rate limiting.
    
    This dependency checks rate limits and raises HTTPException 429 if exceeded.
    Add it to routes like this:
    
        @router.post("/chat", dependencies=[Depends(check_rate_limit_dependency)])
        async def chat_endpoint(...):
            ...
    
    Args:
        request: FastAPI request object
        current_user: Current authenticated user
        db: Database session
    
    Raises:
        HTTPException: 429 Too Many Requests if rate limit exceeded
    """
    rate_limiter = get_rate_limiter()
    
    # Extract endpoint name from path
    endpoint = request.url.path.split("/")[-1] or "unknown"
    
    # Determine user role
    role = "student"  # Default
    if hasattr(current_user, "role"):
        role = current_user.role
    elif current_user.is_admin:
        role = "admin"
    
    # Check rate limit
    is_allowed, remaining, reset_timestamp = await rate_limiter.check_rate_limit(
        user_id=current_user.id,
        endpoint=endpoint,
        role=role
    )
    
    if not is_allowed:
        # Calculate seconds until reset
        now = int(datetime.now().timestamp())
        retry_after = max(1, reset_timestamp - now)
        
        # Log blocked request
        logger.warning(
            f"Rate limit blocked request: user_id={current_user.id}, "
            f"endpoint={endpoint}, role={role}, retry_after={retry_after}s"
        )
        
        # Raise 429 with Retry-After header
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "message": f"Too many requests. Please try again in {retry_after} seconds.",
                "retry_after": retry_after,
                "reset_at": reset_timestamp,
            },
            headers={"Retry-After": str(retry_after)}
        )
    
    # Add rate limit info to request state for logging
    request.state.rate_limit_remaining = remaining
    request.state.rate_limit_reset = reset_timestamp
