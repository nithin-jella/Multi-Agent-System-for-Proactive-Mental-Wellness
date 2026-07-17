import asyncio
import inspect
import os
from contextlib import asynccontextmanager

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI

from app.core.logging_config import configure_logging, get_logger
from app.database import close_db, init_db

load_dotenv(find_dotenv())

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
APP_ENV = os.getenv("APP_ENV", "development")
STARTUP_VERBOSE_LOGS = os.getenv("STARTUP_VERBOSE_LOGS", "false").strip().lower() in {"1", "true", "yes", "on"}

configure_logging(
    log_level=LOG_LEVEL,
    json_format=(APP_ENV == "production"),
    log_to_file=(APP_ENV != "production"),
    log_file_path="logs/app.log",
)

logger = get_logger(__name__)


def startup_log(message: str) -> None:
    if STARTUP_VERBOSE_LOGS:
        logger.info(message)
    else:
        logger.debug(message)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    """
    startup_log("Starting application lifespan...")
    db_max_retries = max(1, int(os.getenv("STARTUP_DB_MAX_RETRIES", "3")))
    db_retry_delay_seconds = max(1.0, float(os.getenv("STARTUP_DB_RETRY_DELAY_SECONDS", "2")))
    db_init_error: Exception | None = None

    from app.auth_utils import validate_auth_config

    try:
        validate_auth_config()
    except ValueError as exc:
        logger.error("Auth configuration is invalid; refusing to start: %s", exc)
        raise

    for attempt in range(1, db_max_retries + 1):
        try:
            db_result = init_db()
            if inspect.isawaitable(db_result):
                await db_result
            db_init_error = None
            break
        except Exception as exc:
            db_init_error = exc
            if attempt >= db_max_retries:
                break
            logger.warning(
                "Database init attempt %s/%s failed. Retrying in %.1fs...",
                attempt,
                db_max_retries,
                db_retry_delay_seconds,
                exc_info=STARTUP_VERBOSE_LOGS,
            )
            await asyncio.sleep(db_retry_delay_seconds)

    if db_init_error is not None:
        logger.error(
            "Database initialization failed after %s attempts: %s",
            db_max_retries,
            str(db_init_error),
        )
        raise db_init_error

    try:
        from app.core.langgraph_checkpointer import init_langgraph_checkpointer

        await init_langgraph_checkpointer()
    except Exception:
        logger.warning("LangGraph checkpointer init failed (non-blocking)", exc_info=True)

    try:
        from app.agents.aika_orchestrator_graph import (
            create_aika_agent_with_checkpointing,
            set_aika_agent,
        )
        from app.core.langgraph_checkpointer import get_langgraph_checkpointer

        _checkpointer = get_langgraph_checkpointer()
        if _checkpointer is None:
            from langgraph.checkpoint.memory import MemorySaver

            _checkpointer = MemorySaver()
            logger.warning(
                "Aika agent using in-memory MemorySaver "
                "(no durable checkpointer — conversation history will not persist across restarts)."
            )
        _compiled_agent = create_aika_agent_with_checkpointing(checkpointer=_checkpointer)
        set_aika_agent(_compiled_agent)
        app.state.aika_agent = _compiled_agent
        startup_log("Aika agent compiled and cached on app.state.aika_agent")
    except Exception:
        logger.error(
            "Aika agent compilation failed at startup (non-blocking — requests will fail until fixed)",
            exc_info=True,
        )

    from app.domains.blockchain import init_nft_client

    nft_result = init_nft_client()
    if inspect.isawaitable(nft_result):
        await nft_result

    try:
        from app.domains.blockchain.attestation import AttestationClientFactory

        await AttestationClientFactory.init_all()
    except Exception:
        logger.warning("Attestation client initialization failed (non-blocking)", exc_info=True)

    from app.core.scheduler import start_scheduler, shutdown_scheduler

    start_scheduler()

    autopilot_enabled = os.getenv("AUTOPILOT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
    autopilot_worker_task: asyncio.Task | None = None
    autopilot_stop_event: asyncio.Event | None = None
    if autopilot_enabled:
        try:
            from app.domains.mental_health.services.autopilot_worker import run_autopilot_worker_loop

            autopilot_stop_event = asyncio.Event()
            autopilot_worker_task = asyncio.create_task(
                run_autopilot_worker_loop(autopilot_stop_event),
                name="autopilot-worker",
            )
            startup_log("Autopilot worker started")
            onchain_placeholder = os.getenv("AUTOPILOT_ONCHAIN_PLACEHOLDER", "true").strip().lower() in {"1", "true", "yes", "on"}
            if onchain_placeholder:
                logger.warning(
                    "AUTOPILOT_ONCHAIN_PLACEHOLDER is enabled. Onchain autopilot actions currently use synthetic tx hashes."
                )
        except Exception:
            logger.warning("Failed to start autopilot worker (non-blocking)", exc_info=True)

    from app.domains.finance import start_scheduler as start_finance_scheduler

    start_finance_scheduler()
    startup_log("Finance revenue scheduler started")

    from app.services.event_sse_bridge import initialize_event_subscriptions

    sub_result = initialize_event_subscriptions()
    if inspect.isawaitable(sub_result):
        await sub_result

    yield

    startup_log("Shutting down application lifespan...")
    shutdown_scheduler()
    if autopilot_worker_task is not None and autopilot_stop_event is not None:
        try:
            autopilot_stop_event.set()
            await asyncio.wait_for(autopilot_worker_task, timeout=10)
            startup_log("Autopilot worker stopped")
        except asyncio.TimeoutError:
            autopilot_worker_task.cancel()
        except Exception:
            logger.warning("Autopilot worker shutdown failed (non-blocking)", exc_info=True)

    from app.domains.finance import stop_scheduler as stop_finance_scheduler

    stop_finance_scheduler()
    startup_log("Finance revenue scheduler stopped")

    try:
        from app.core.langgraph_checkpointer import close_langgraph_checkpointer

        await close_langgraph_checkpointer()
    except Exception:
        logger.warning("LangGraph checkpointer shutdown failed (non-blocking)", exc_info=True)
    await close_db()
