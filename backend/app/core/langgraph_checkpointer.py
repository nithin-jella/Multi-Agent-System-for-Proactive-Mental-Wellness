"""LangGraph checkpointer initialization (Postgres-backed).

Goal:
- Use durable Postgres-backed checkpointing for LangGraph conversations.
- Create a single app-lifetime saver instance (avoid per-request MemorySaver).

Configuration:
- Uses `LANGGRAPH_CHECKPOINTER_URL` if set, else falls back to `DATABASE_URL`.
- Only initializes when using PostgreSQL.

Notes:
- The saver uses psycopg (v3) under the hood, separate from SQLAlchemy.
"""

from __future__ import annotations

import inspect
import logging
import os
from typing import Any, Optional

from app.database import DATABASE_URL

logger = logging.getLogger(__name__)

_checkpointer: Optional[Any] = None
_checkpointer_ctx: Optional[Any] = None


def _to_postgres_dsn(url: str) -> str:
    """Convert a SQLAlchemy async URL to a psycopg-compatible Postgres DSN."""
    # SQLAlchemy async URLs like: postgresql+asyncpg://user:pass@host/db
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql://", 1)
    return url


async def init_langgraph_checkpointer() -> Optional[Any]:
    global _checkpointer, _checkpointer_ctx

    if _checkpointer is not None:
        return _checkpointer

    raw_url = os.getenv("LANGGRAPH_CHECKPOINTER_URL") or DATABASE_URL
    dsn = _to_postgres_dsn(raw_url)

    if not dsn.startswith("postgresql://"):
        logger.info("LangGraph checkpointer not initialized (non-Postgres DATABASE_URL)")
        _checkpointer = None
        return None

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver  # type: ignore[import-not-found]
    except Exception:
        logger.warning(
            "LangGraph Postgres saver not available. Install 'langgraph-checkpoint-postgres' and 'psycopg'.",
            exc_info=True,
        )
        _checkpointer = None
        return None

    try:
        factory_result = AsyncPostgresSaver.from_conn_string(dsn)
        saver: Any
        saver_ctx: Any | None = None

        # Newer LangGraph versions return an async context manager here,
        # while older versions may return an awaitable saver directly.
        if hasattr(factory_result, "__aenter__") and hasattr(factory_result, "__aexit__"):
            saver_ctx = factory_result
            saver = await saver_ctx.__aenter__()
        elif inspect.isawaitable(factory_result):
            saver = await factory_result
        else:
            saver = factory_result

        setup_result = saver.setup()
        if inspect.isawaitable(setup_result):
            await setup_result

        _checkpointer_ctx = saver_ctx
        _checkpointer = saver
        logger.info("✅ LangGraph Postgres checkpointer initialized")
        return _checkpointer
    except Exception:
        logger.error("Failed to initialize LangGraph Postgres checkpointer", exc_info=True)
        _checkpointer_ctx = None
        _checkpointer = None
        return None


def get_langgraph_checkpointer() -> Optional[Any]:
    return _checkpointer


async def close_langgraph_checkpointer() -> None:
    global _checkpointer, _checkpointer_ctx
    saver = _checkpointer
    saver_ctx = _checkpointer_ctx
    _checkpointer = None
    _checkpointer_ctx = None

    if saver is None:
        return

    if saver_ctx is not None:
        try:
            exit_result = saver_ctx.__aexit__(None, None, None)
            if inspect.isawaitable(exit_result):
                await exit_result
            return
        except Exception:
            logger.warning("Failed to exit LangGraph checkpointer context cleanly", exc_info=True)

    # Best-effort close (API varies by version)
    try:
        aclose = getattr(saver, "aclose", None)
        if aclose is not None:
            result = aclose()
            if inspect.isawaitable(result):
                await result
            return
    except Exception:
        logger.warning("Failed to close LangGraph checkpointer cleanly", exc_info=True)
