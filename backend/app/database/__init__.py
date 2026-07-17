from __future__ import annotations

from typing import AsyncGenerator, Optional
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv, find_dotenv
import logging
from urllib.parse import parse_qs, urlparse, urlencode, urlunparse

# Load environment variables from .env file (supports running from subdirectories)
load_dotenv(find_dotenv())

logger = logging.getLogger(__name__)

# Determine the database URL from environment variables (should be using Dockerized setup)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./aika.db")


def get_database_endpoint_summary() -> str:
    """Return a safe DB endpoint summary for diagnostics (no credentials)."""
    try:
        parsed = urlparse(DATABASE_URL)
        scheme = parsed.scheme or "unknown"
        host = parsed.hostname or "local"
        if parsed.port is not None:
            host = f"{host}:{parsed.port}"
        db_name = (parsed.path or "").lstrip("/") or "-"
        return f"{scheme}://{host}/{db_name}"
    except Exception:
        return "<unavailable>"


def _redact_database_url(database_url: str) -> str:
    """Redact secrets in a DB URL for logging."""
    try:
        parsed = urlparse(database_url)
        if parsed.username is None:
            return database_url
        netloc = parsed.hostname or ""
        if parsed.port is not None:
            netloc = f"{netloc}:{parsed.port}"
        auth = parsed.username
        if parsed.password is not None:
            auth = f"{auth}:***"
        netloc = f"{auth}@{netloc}"
        return urlunparse(parsed._replace(netloc=netloc))
    except Exception:
        return "<redacted>"


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


def _ssl_required_from_database_url(database_url: str) -> Optional[bool]:
    """Infer SSL preference from DATABASE_URL query string.

    NeonDB and many managed Postgres providers require SSL. They typically provide
    connection strings with sslmode=require (or verify-*).
    """
    try:
        query = urlparse(database_url).query
        if not query:
            return None
        sslmode = (parse_qs(query).get("sslmode", [None])[0] or "").strip().lower()
        if not sslmode:
            return None
        if sslmode in {"require", "verify-ca", "verify-full"}:
            return True
        if sslmode in {"disable"}:
            return False
        return None
    except Exception:
        return None


def _sanitize_asyncpg_database_url(database_url: str) -> str:
    """Remove libpq-only params that SQLAlchemy will forward to asyncpg.connect().

    asyncpg does not understand libpq parameters like `sslmode` or `channel_binding`.
    If they remain in the URL, SQLAlchemy's asyncpg dialect will pass them as
    keyword arguments to asyncpg.connect(), raising `TypeError`.
    """
    try:
        parsed = urlparse(database_url)
        if not parsed.query:
            return database_url

        query_map = parse_qs(parsed.query, keep_blank_values=True)
        for key in ("sslmode", "channel_binding"):
            query_map.pop(key, None)

        # Keep remaining query params.
        new_query = urlencode(query_map, doseq=True)
        return urlunparse(parsed._replace(query=new_query))
    except Exception:
        return database_url

# Ensure we're using asyncpg for PostgreSQL connections
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
elif DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
elif DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql+asyncpg://")

# Create async engine with optimal asyncpg configuration
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    # Use PostgreSQL with asyncpg - optimized for high performance
    db_ssl = _parse_bool_env("DB_SSL")
    if db_ssl is None:
        db_ssl = _ssl_required_from_database_url(DATABASE_URL)

    # Strip libpq-only params after we've derived any settings from them.
    DATABASE_URL = _sanitize_asyncpg_database_url(DATABASE_URL)

    connect_args = {
        "server_settings": {
            "jit": "off",  # Disable JIT for better compatibility
            "application_name": "ugm_aicare",  # Identify our application in pg_stat_activity
        },
        "command_timeout": 120,  # Timeout for individual commands (increased for eval workload)
        "timeout": 30,  # Connection establishment timeout
    }
    if db_ssl is not None:
        connect_args["ssl"] = db_ssl

    async_engine = create_async_engine(
        DATABASE_URL,
        echo=False,  # Set to True for SQL logging
        future=True,
        # asyncpg-specific optimizations
        pool_size=20,           # Number of connections to maintain in the pool
        max_overflow=10,        # Additional connections beyond pool_size
        pool_pre_ping=True,     # Validate connections before use
        pool_recycle=1800,      # Recycle connections every 30 min (reduced from 1 hour)
        pool_timeout=30,        # Timeout for getting a connection from the pool
        # Connection arguments for asyncpg
        connect_args=connect_args,
    )
else:
    # Use SQLite with aiosqlite for development/testing
    async_engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True,
        # No specific connect_args needed for aiosqlite in this context
    )

# Avoid leaking DB credentials in logs
logger.debug(f"Using async database: {_redact_database_url(DATABASE_URL)}")

# Create async session factory.
# Prefer SQLAlchemy 2.x's async_sessionmaker when available, but fall back to
# sessionmaker for compatibility (e.g., when alembic is executed in a different env).
try:
    from sqlalchemy.ext.asyncio import async_sessionmaker  # type: ignore

    AsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )
except Exception:
    from sqlalchemy.orm import sessionmaker

    AsyncSessionLocal = sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

Base = declarative_base()

async def init_db():
    """Initialize database tables asynchronously"""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.debug(f"Database initialized with asyncpg: {_redact_database_url(DATABASE_URL)}")

    from app.services.admin_bootstrap import ensure_default_admin, ensure_default_counselor

    async with AsyncSessionLocal() as session:
        try:
            await ensure_default_admin(session)
            await ensure_default_counselor(session)
        except Exception as exc:
            await session.rollback()
            logger.error(f"Failed to ensure default users: {exc}")

    from app.domains.mental_health.services.quest_engine_service import QuestEngineService

    async with AsyncSessionLocal() as session:
        try:
            quest_service = QuestEngineService(session)
            await quest_service.ensure_default_templates()
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error(f"Failed to seed default quest templates: {exc}")

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """Async database dependency for FastAPI"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except asyncio.CancelledError:
            try:
                await asyncio.shield(session.rollback())
            except Exception:
                pass
            logger.debug("Database session cancelled; rolled back safely")
            raise
        except Exception as e:
            await asyncio.shield(session.rollback())
            logger.error(f"Database session error: {e}")
            raise
        finally:
            try:
                await asyncio.shield(session.close())
            except asyncio.CancelledError:
                logger.debug("Database session close cancelled by request scope")
            except Exception as close_err:
                logger.debug("Database session close encountered non-fatal error: %s", close_err)

async def close_db():
    """Gracefully close database connections"""
    await async_engine.dispose()
    logger.debug("Database connections closed")

# Connection health check
async def check_db_health() -> bool:
    """Check if database connection is healthy"""
    try:
        from sqlalchemy import text
        async with async_engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

