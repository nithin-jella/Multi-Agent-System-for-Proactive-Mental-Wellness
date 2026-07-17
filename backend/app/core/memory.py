from __future__ import annotations

from typing import Any, Optional, Tuple
import redis.asyncio as redis # type: ignore
import logging
import os
import time

# Load environment variables from .env file
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

logger = logging.getLogger(__name__)

# --- Redis Client Setup ---
# Global client instance (or use a dependency injection pattern)
redis_pool = None
mock_redis_instance = None
redis_retry_not_before = 0.0


def _parse_bool_env(var_name: str) -> Optional[bool]:
    raw = os.getenv(var_name)
    if raw is None:
        return None
    raw = raw.strip().lower()
    if raw in {"1", "true", "t", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "f", "no", "n", "off"}:
        return False
    raise ValueError(f"Invalid boolean for {var_name}: {raw!r}")


def _normalize_redis_host_port(host_raw: str, port_raw: Optional[str]) -> Tuple[str, Optional[int]]:
    """Normalize REDIS_HOST / REDIS_PORT.

    Users sometimes set REDIS_HOST to "host:port". This function strips the port
    into REDIS_PORT to avoid passing an invalid host string to redis-py.
    """
    host = host_raw.strip()

    # If host looks like a URL, it's not a host. Let caller treat it as REDIS_URL.
    if "://" in host:
        return host, None

    # IPv6 in brackets like [::1]:6379
    if host.startswith("[") and "]" in host:
        if ":" in host.split("]", 1)[1]:
            host_part, port_part = host.rsplit(":", 1)
            try:
                return host_part, int(port_part)
            except ValueError:
                return host, None
        return host, int(port_raw) if port_raw else None

    # Common case: hostname:port
    if ":" in host:
        host_part, port_part = host.rsplit(":", 1)
        try:
            return host_part, int(port_part)
        except ValueError:
            return host, int(port_raw) if port_raw else None

    return host, int(port_raw) if port_raw else None

class MockRedis:
    """
    A simple in-memory mock for Redis to allow the application to run without a Redis server.
    Note: Data is not persistent and is shared only within the same process.
    """
    def __init__(self):
        self.data = {}
        self.expiries = {}
        logger.warning("Using MockRedis. Data will be lost on restart and is not shared across workers.")

    async def get(self, key):
        self._check_expiry(key)
        return self.data.get(key)

    async def set(self, key, value, ex=None):
        self.data[key] = value
        if ex:
            self.expiries[key] = time.time() + ex
        elif key in self.expiries:
            del self.expiries[key]
        return True

    async def incr(self, key):
        self._check_expiry(key)
        val = self.data.get(key, 0)
        try:
            val = int(val) + 1
        except (ValueError, TypeError):
            val = 1
        self.data[key] = str(val)
        return val

    async def expire(self, key, seconds):
        if key in self.data:
            self.expiries[key] = time.time() + seconds
            return True
        return False

    async def delete(self, key):
        if key in self.data:
            del self.data[key]
            if key in self.expiries:
                del self.expiries[key]
            return 1
        return 0

    async def ping(self):
        return True
    
    async def close(self):
        pass

    def _check_expiry(self, key):
        if key in self.expiries and time.time() > self.expiries[key]:
            if key in self.data:
                del self.data[key]
            del self.expiries[key]

async def get_redis_client() -> Any:
    """
    Gets a connection from the Redis connection pool.
    Initializes the pool if it doesn't exist.
    Returns a MockRedis instance if REDIS_HOST is not set.
    """
    global redis_pool, mock_redis_instance, redis_retry_not_before

    redis_url = os.getenv("REDIS_URL")
    redis_host_env = os.getenv("REDIS_HOST")
    redis_port_env = os.getenv("REDIS_PORT")
    redis_db_env = os.getenv("REDIS_DB", "0")
    redis_username_env = os.getenv("REDIS_USERNAME")
    redis_password_env = os.getenv("REDIS_PASSWORD")
    redis_ssl_env = _parse_bool_env("REDIS_SSL")
    redis_fail_open = _parse_bool_env("REDIS_FAIL_OPEN")
    if redis_fail_open is None:
        redis_fail_open = True
    retry_cooldown_s = int(os.getenv("REDIS_RETRY_COOLDOWN_SECONDS", "60"))

    # Convenience: allow REDIS_HOST to be a full URL.
    if not redis_url and redis_host_env and "://" in redis_host_env:
        redis_url = redis_host_env

    # Check if Redis is configured
    if not redis_url and not redis_host_env:
        if mock_redis_instance is None:
            mock_redis_instance = MockRedis()
        return mock_redis_instance

    now_ts = time.time()
    if redis_fail_open and now_ts < redis_retry_not_before:
        if mock_redis_instance is None:
            mock_redis_instance = MockRedis()
        return mock_redis_instance

    if redis_pool is None:
        try:
            if redis_url:
                logger.info("Initializing Redis connection pool from REDIS_URL")
                redis_pool = redis.ConnectionPool.from_url(redis_url, decode_responses=True)
            else:
                assert redis_host_env is not None
                host_normalized, port_from_host = _normalize_redis_host_port(redis_host_env, redis_port_env)
                port_effective = port_from_host if port_from_host is not None else None
                if port_effective is None:
                    raise ValueError("REDIS_PORT must be set if REDIS_HOST is set.")

                connection_args = {
                    "host": host_normalized,
                    "port": int(port_effective),
                    "db": int(redis_db_env),
                    "decode_responses": True,
                }

                # Only add username and password if they are provided
                if redis_username_env:
                    connection_args["username"] = redis_username_env
                if redis_password_env:
                    connection_args["password"] = redis_password_env
                if redis_ssl_env is not None:
                    connection_args["ssl"] = redis_ssl_env

                logger.info("Initializing Redis connection pool with explicit host/port config")
                redis_pool = redis.ConnectionPool(**connection_args)
        except Exception as e:
            redis_retry_not_before = time.time() + retry_cooldown_s
            if redis_fail_open:
                logger.warning(
                    "Redis pool init failed, using MockRedis for %ss: %s",
                    retry_cooldown_s,
                    e,
                )
                if mock_redis_instance is None:
                    mock_redis_instance = MockRedis()
                return mock_redis_instance
            logger.error(f"Failed to initialize Redis connection pool: {e}", exc_info=True)
            raise ConnectionError("Could not connect to Redis") from e

    try:
        # Create a client instance from the pool
        client = redis.Redis(connection_pool=redis_pool)
        await client.ping() # Verify connection
        return client
    except Exception as e:
        redis_retry_not_before = time.time() + retry_cooldown_s
        # Force pool re-init on next attempt after cooldown.
        redis_pool = None
        if redis_fail_open:
            logger.warning(
                "Redis ping failed, switching to MockRedis for %ss: %s",
                retry_cooldown_s,
                e,
            )
            if mock_redis_instance is None:
                mock_redis_instance = MockRedis()
            return mock_redis_instance
        logger.error(f"Failed to get Redis client or ping failed: {e}", exc_info=True)
        raise ConnectionError("Could not connect to Redis client or ping failed") from e



