"""Redis-based caching service.

This module provides a caching layer to reduce database load and improve response times.
It uses Redis for distributed caching with configurable TTL strategies.

Features:
- Automatic JSON serialization/deserialization
- Configurable TTL per data type
- Cache decorator for easy integration
- Pattern-based cache invalidation
- Cache hit/miss metrics
- Fail-safe design (continues on Redis errors)

Usage:
    from app.core.cache import get_cache_service, cached
    
    # Direct usage:
    cache = get_cache_service()
    await cache.set("key", {"data": "value"}, ttl=3600)
    data = await cache.get("key")
    
    # Decorator usage:
    @cached(key_prefix="user_summary", ttl=1800)
    async def get_user_summary(user_id: int):
        # Expensive database query
        return summary
"""
from __future__ import annotations

import functools
import hashlib
import json
import logging
from typing import Any, Callable, Optional, TypeVar, cast

from app.core.memory import get_redis_client
from app.core.settings import settings

logger = logging.getLogger(__name__)

# Type variable for decorator
F = TypeVar('F', bound=Callable[..., Any])


class CacheService:
    """Redis-based caching service with TTL and invalidation support.
    
    This service provides a simple interface for caching data in Redis with
    automatic serialization and configurable TTL strategies. It's designed to
    be fail-safe, meaning cache failures won't break the application.
    
    Key Patterns:
        cache:{prefix}:{identifier}
        Example: cache:user_summary:123
    
    Attributes:
        enabled: Whether caching is enabled globally
    """
    
    def __init__(self):
        """Initialize cache service."""
        self.enabled = settings.cache_enabled
        self._hit_count = 0
        self._miss_count = 0
        self._error_count = 0
    
    async def get(self, key: str) -> Optional[Any]:
        """Get cached value by key.
        
        Args:
            key: Cache key
        
        Returns:
            Cached value if exists and valid, None otherwise
        """
        if not self.enabled:
            return None
        
        try:
            redis = await get_redis_client()
            value = await redis.get(key)
            
            if value:
                self._hit_count += 1
                logger.debug(f"Cache HIT: key={key}")
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to decode JSON from cache key: {key}")
                    await redis.delete(key)  # Remove corrupted data
                    return None
            else:
                self._miss_count += 1
                logger.debug(f"Cache MISS: key={key}")
                return None
                
        except ConnectionError as e:
            self._error_count += 1
            logger.warning(f"Redis connection error in cache get: {e}")
            return None
        except Exception as e:
            self._error_count += 1
            logger.error(f"Unexpected error in cache get: {e}", exc_info=True)
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set cached value with TTL.
        
        Args:
            key: Cache key
            value: Value to cache (must be JSON-serializable)
            ttl: Time-to-live in seconds (uses default if None)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            return False
        
        ttl = ttl or settings.cache_default_ttl
        
        try:
            redis = await get_redis_client()
            serialized = json.dumps(value)
            await redis.setex(key, ttl, serialized)
            logger.debug(f"Cache SET: key={key}, ttl={ttl}s")
            return True
            
        except (TypeError, ValueError) as e:
            logger.error(f"Failed to serialize value for cache key {key}: {e}")
            return False
        except ConnectionError as e:
            self._error_count += 1
            logger.warning(f"Redis connection error in cache set: {e}")
            return False
        except Exception as e:
            self._error_count += 1
            logger.error(f"Unexpected error in cache set: {e}", exc_info=True)
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete cached value by key.
        
        Args:
            key: Cache key to delete
        
        Returns:
            True if key was deleted, False otherwise
        """
        if not self.enabled:
            return False
        
        try:
            redis = await get_redis_client()
            deleted = await redis.delete(key)
            if deleted:
                logger.debug(f"Cache DELETE: key={key}")
            return deleted > 0
            
        except ConnectionError as e:
            self._error_count += 1
            logger.warning(f"Redis connection error in cache delete: {e}")
            return False
        except Exception as e:
            self._error_count += 1
            logger.error(f"Unexpected error in cache delete: {e}", exc_info=True)
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern.
        
        Args:
            pattern: Redis key pattern (e.g., "cache:user:123:*")
        
        Returns:
            Number of keys deleted
        """
        if not self.enabled:
            return 0
        
        try:
            redis = await get_redis_client()
            keys = await redis.keys(pattern)
            
            if keys:
                deleted = await redis.delete(*keys)
                logger.info(f"Cache invalidated: pattern={pattern}, keys_deleted={deleted}")
                return deleted
            
            return 0
            
        except ConnectionError as e:
            self._error_count += 1
            logger.warning(f"Redis connection error in cache delete_pattern: {e}")
            return 0
        except Exception as e:
            self._error_count += 1
            logger.error(f"Unexpected error in cache delete_pattern: {e}", exc_info=True)
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache.
        
        Args:
            key: Cache key
        
        Returns:
            True if key exists, False otherwise
        """
        if not self.enabled:
            return False
        
        try:
            redis = await get_redis_client()
            return await redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Error checking cache key existence: {e}")
            return False
    
    async def get_ttl(self, key: str) -> int:
        """Get remaining TTL for key.
        
        Args:
            key: Cache key
        
        Returns:
            Remaining seconds, -1 if no expiry, -2 if key doesn't exist
        """
        if not self.enabled:
            return -2
        
        try:
            redis = await get_redis_client()
            return await redis.ttl(key)
        except Exception as e:
            logger.error(f"Error getting cache key TTL: {e}")
            return -2
    
    async def clear_all(self) -> int:
        """Clear all cache keys (use with caution!).
        
        Returns:
            Number of keys deleted
        """
        if not self.enabled:
            return 0
        
        try:
            redis = await get_redis_client()
            keys = await redis.keys("cache:*")
            
            if keys:
                deleted = await redis.delete(*keys)
                logger.warning(f"Cache cleared: total_keys_deleted={deleted}")
                return deleted
            
            return 0
            
        except Exception as e:
            logger.error(f"Error clearing cache: {e}", exc_info=True)
            return 0
    
    async def count_keys(self, pattern: str = "cache:*") -> int:
        """Count cache keys matching pattern.
        
        Args:
            pattern: Redis key pattern
        
        Returns:
            Number of keys
        """
        if not self.enabled:
            return 0
        
        try:
            redis = await get_redis_client()
            keys = await redis.keys(pattern)
            return len(keys)
        except Exception as e:
            logger.error(f"Error counting cache keys: {e}")
            return 0
    
    async def get_stats(self) -> dict:
        """Get cache statistics.
        
        Returns:
            Dictionary with hit_count, miss_count, hit_rate, etc.
        """
        total_requests = self._hit_count + self._miss_count
        hit_rate = (
            self._hit_count / total_requests
            if total_requests > 0
            else 0.0
        )
        
        return {
            "enabled": self.enabled,
            "total_requests": total_requests,
            "hits": self._hit_count,
            "misses": self._miss_count,
            "hit_rate": round(hit_rate * 100, 2),  # Percentage
            "errors": self._error_count,
            "total_keys": await self.count_keys(),
        }
    
    def reset_stats(self) -> None:
        """Reset statistics counters."""
        self._hit_count = 0
        self._miss_count = 0
        self._error_count = 0
        logger.info("Cache statistics reset")


# Global cache service instance
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get global cache service instance.
    
    Returns:
        CacheService instance
    """
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


def cached(
    key_prefix: str,
    ttl: Optional[int] = None,
    key_builder: Optional[Callable[..., str]] = None
) -> Callable[[F], F]:
    """Decorator for caching function results.
    
    This decorator automatically caches the result of async functions using Redis.
    The cache key is built from the function name and arguments.
    
    Args:
        key_prefix: Prefix for cache keys (e.g., "user_summary")
        ttl: Time-to-live in seconds (uses default if None)
        key_builder: Optional custom function to build cache key from args
    
    Returns:
        Decorated function
    
    Example:
        @cached(key_prefix="user_summary", ttl=1800)
        async def get_user_summary(user_id: int):
            # Expensive database query
            return summary
        
        # First call: Cache MISS, queries database
        result = await get_user_summary(123)
        
        # Second call: Cache HIT, returns cached result
        result = await get_user_summary(123)
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache = get_cache_service()
            
            if not cache.enabled:
                # Caching disabled, call function directly
                return await func(*args, **kwargs)
            
            # Build cache key
            if key_builder:
                key_suffix = key_builder(*args, **kwargs)
            else:
                key_suffix = _default_key_builder(*args, **kwargs)
            
            cache_key = f"cache:{key_prefix}:{key_suffix}"
            
            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Cache miss, call function
            result = await func(*args, **kwargs)
            
            # Store in cache (fire and forget, don't block on cache errors)
            if result is not None:
                await cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return cast(F, wrapper)
    
    return decorator


def _default_key_builder(*args: Any, **kwargs: Any) -> str:
    """Default cache key builder from function arguments.
    
    Creates a hash of the arguments to use as cache key suffix.
    
    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments
    
    Returns:
        Hash string of arguments
    """
    # Convert args and kwargs to a consistent string representation
    key_parts = []
    
    for arg in args:
        key_parts.append(str(arg))
    
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}={v}")
    
    key_string = "|".join(key_parts)
    
    # Hash for consistent key length
    return hashlib.md5(key_string.encode()).hexdigest()


# Convenience function for cache invalidation
async def invalidate_user_cache(user_id: int) -> int:
    """Invalidate all cached data for a user.
    
    Args:
        user_id: User ID
    
    Returns:
        Number of keys deleted
    """
    cache = get_cache_service()
    patterns = [
        f"cache:user_summary:{user_id}*",
        f"cache:user_profile:{user_id}*",
        f"cache:journals:{user_id}*",
        f"cache:conversation_summaries:{user_id}*",
    ]
    
    total_deleted = 0
    for pattern in patterns:
        deleted = await cache.delete_pattern(pattern)
        total_deleted += deleted
    
    logger.info(f"Invalidated user cache: user_id={user_id}, keys_deleted={total_deleted}")
    return total_deleted
