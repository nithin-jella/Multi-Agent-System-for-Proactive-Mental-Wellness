import json
import logging
import asyncio
from fastapi import FastAPI, Request as FastAPIRequest # type: ignore
from scalar_fastapi import get_scalar_api_reference
from datetime import datetime, timezone
from app.database import init_db, close_db
from sqlalchemy import text
from app.core.logging_config import configure_logging, get_logger
# Cross-cutting routes (auth, user, internal, admin, system)
from app.routes import (
    auth,
    link_did,
    link_ocid,
    internal,
    profile,
    admin,
    proof,
    system,
)
from app.routes.admin import insights as admin_insights
from app.routes.admin import counselors as admin_counselors
from app.routes.admin import analytics as admin_analytics

# ... (other imports)



# Mental health domain routes
from app.domains.mental_health.routes import (
    chat,
    feedback,
    journal,
    journal_prompts,
    summary,
    session_events,
    appointments,
    quests,
    counselor,
    agents,
    agents_command,
    agents_graph,
    surveys,
    # cbt_modules - DEPRECATED: Use TCA intervention plans instead
    safety_triage,
    clinical_analytics_routes,
    intervention_plans,
    langgraph_analytics,
    aika_stream,
)

# Finance domain routes (commented out - domain incomplete)
# from app.domains.finance import finance_router
from app.domains.blockchain import blockchain_router  # Blockchain domain routes
from app.agents.sta.router import router as sta_router
from app.agents.tca.router import router as tca_router
from app.agents.cma.router import router as cma_router
from app.agents.ia.router import router as ia_router
# app.include_router(aika_router)  # Aika Meta-Agent orchestrator - REMOVED (Legacy)
from contextlib import asynccontextmanager
from app.core.scheduler import start_scheduler, shutdown_scheduler
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from app.utils.env_check import check_env
import os
from dotenv import load_dotenv, find_dotenv

from app.core.memory import get_redis_client

# Prometheus metrics
from prometheus_client import make_asgi_app
from prometheus_fastapi_instrumentator import Instrumentator

from app.middleware.performance import PerformanceTrackingMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.user_activity import UserActivityMiddleware

load_dotenv(find_dotenv())

# This call is being moved to the lifespan event handler to avoid race conditions.
# init_db()

import httpx
import inspect

# Set up structured logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
APP_ENV = os.getenv("APP_ENV", "development")
STARTUP_VERBOSE_LOGS = os.getenv("STARTUP_VERBOSE_LOGS", "false").strip().lower() in {"1", "true", "yes", "on"}

# Use JSON format in production, human-readable in development
configure_logging(
    log_level=LOG_LEVEL,
    json_format=(APP_ENV == "production"),
    log_to_file=(APP_ENV != "production"),
    log_file_path="logs/app.log"
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
    # Initialize the database (handle both sync and async implementations)
    db_max_retries = max(1, int(os.getenv("STARTUP_DB_MAX_RETRIES", "3")))
    db_retry_delay_seconds = max(1.0, float(os.getenv("STARTUP_DB_RETRY_DELAY_SECONDS", "2")))
    db_init_error: Exception | None = None

    # Validate auth configuration before the server accepts any requests.
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

    # Initialize LangGraph durable checkpointer (Postgres)
    try:
        from app.core.langgraph_checkpointer import init_langgraph_checkpointer
        await init_langgraph_checkpointer()
    except Exception:
        logger.warning("LangGraph checkpointer init failed (non-blocking)", exc_info=True)

    # Compile the Aika agent ONCE here so every request reuses the same
    # compiled graph.  The per-request db session is injected later via
    # config["configurable"]["db"], not baked in at compile time.
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

    # Initialize blockchain connections (NFT + attestation registries)
    from app.domains.blockchain import init_nft_client
    nft_result = init_nft_client()
    if inspect.isawaitable(nft_result):
        await nft_result

    try:
        from app.domains.blockchain.attestation import AttestationClientFactory

        await AttestationClientFactory.init_all()
    except Exception:
        logger.warning("Attestation client initialization failed (non-blocking)", exc_info=True)

    # Start the background scheduler
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
    # Start the finance revenue scheduler
    from app.domains.finance import start_scheduler as start_finance_scheduler
    start_finance_scheduler()
    startup_log("Finance revenue scheduler started")
    # Initialize event bus subscriptions for SSE broadcasting
    from app.services.event_sse_bridge import initialize_event_subscriptions
    sub_result = initialize_event_subscriptions()
    if inspect.isawaitable(sub_result):
        await sub_result
    yield
    # Clean up resources on shutdown
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
    # Stop the finance revenue scheduler
    from app.domains.finance import stop_scheduler as stop_finance_scheduler
    stop_finance_scheduler()
    startup_log("Finance revenue scheduler stopped")
    # Close database connections
    try:
        from app.core.langgraph_checkpointer import close_langgraph_checkpointer
        await close_langgraph_checkpointer()
    except Exception:
        logger.warning("LangGraph checkpointer shutdown failed (non-blocking)", exc_info=True)
    await close_db()

# You will need to add the lifespan manager to your FastAPI app instance.
# Find the line where you create your `app` and add `lifespan=lifespan`.
# For example, if you have `app = FastAPI()`, change it to:
app = FastAPI(
    title="Aika Chatbot API", 
    description="API for Aika Chatbot - UGM AI Care. Uses FastAPI.",
    version="0.1",
    lifespan=lifespan, # Use the async context manager for startup/shutdown
    docs_url=None, # Disable default Swagger UI to use Scalar
    redoc_url=None, # Disable ReDoc
)

# ============================================
# REQUEST CONTEXT + PERFORMANCE MIDDLEWARE
# ============================================

# Propagate a per-request correlation id (X-Request-ID)
app.add_middleware(RequestContextMiddleware)

# Record daily activity rows for retention analytics.
# This relies on auth dependencies setting request.state.user_id.
app.add_middleware(UserActivityMiddleware)

# Track endpoint performance (adds X-Response-Time and in-memory analytics)
app.add_middleware(
    PerformanceTrackingMiddleware,
    exclude_paths=[
        "/docs",
        "/redoc",
        "/openapi.json",
        "/health",
        "/favicon.ico",
        "/metrics",
        "/metrics/fastapi",
    ],
)

# ============================================
# PROMETHEUS METRICS SETUP
# ============================================

# Instrument FastAPI app with default metrics (request duration, count, etc.)
Instrumentator().instrument(app).expose(app, endpoint="/metrics/fastapi")

# Mount prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

startup_log("Prometheus metrics enabled at /metrics and /metrics/fastapi")

# ============================================
# CORS MIDDLEWARE
# ============================================

# Add CORS middleware
origins_env = os.getenv("ALLOWED_ORIGINS")
if origins_env:
    origins = [origin.strip() for origin in origins_env.split(",")]
else:
    # Fallback origins for development - ensure all possible origins are covered
    origins = [
        "http://localhost:4000",
        "http://127.0.0.1:4000", 
        "http://localhost:22000",
        "http://127.0.0.1:22000",
        "http://localhost:22001",
        "http://127.0.0.1:22001",
        "http://frontend:4000",  # Docker internal
        "http://backend:22001",    # Docker internal
        "https://aicare.ina17.com",
        "https://api.aicare.ina17.com"
    ]

startup_log(f"CORS configured with origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    # Enumerate concrete headers rather than wildcard to avoid leaking
    # server-side headers and to satisfy strict CORS policy audits.
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Request-ID",
        "X-Requested-With",
        "Accept",
    ],
    expose_headers=[
        "X-Request-ID",
        "X-Response-Time",
        "Content-Length",
        "Content-Type",
    ],
)

startup_log("Including API routers...")

# ============================================
# ROUTER REGISTRATION CONVENTION
# ============================================
# Prefix strategy — two patterns exist; follow whichever is already set for a
# given router and document the exception inline:
#
# A) Prefix defined INSIDE the router module (most domain routers):
#      app.include_router(chat.router)          # prefix lives in routes/chat.py
#
# B) Prefix injected HERE at registration (used when a router is owned by a
#    third-party agent module or when the prefix must vary per environment):
#      app.include_router(sta_router, prefix="/api/v1/agents/sta")
#
# New routers should prefer pattern A so the full route path is visible in
# one place (the router module), not split across two files.
# ============================================

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(feedback.router)
app.include_router(link_did.router)
app.include_router(link_ocid.router)

app.include_router(journal.router)
app.include_router(journal_prompts.router)
app.include_router(internal.router)
app.include_router(session_events.session_event_router) # This will have prefix /api/v1/chat
app.include_router(summary.activity_router) # This will have prefix /api/v1/activity-summary
app.include_router(summary.user_data_router)  # This will have prefix /api/v1/user
app.include_router(profile.router)
app.include_router(proof.router)
app.include_router(quests.router)
app.include_router(admin_counselors.router, prefix="/api/v1")  # Admin counselor management (MUST be before admin.router to avoid route conflicts)
app.include_router(counselor.router, prefix="/api/v1")  # Counselor self-management
app.include_router(admin.router)  # Admin endpoints (includes /admin/counselors and other admin routes)
app.include_router(admin_insights.router)  # Admin insights endpoints
app.include_router(admin_analytics.router)  # Admin analytics endpoints
app.include_router(agents.router)
app.include_router(agents_command.router)
app.include_router(agents_graph.router)  # LangGraph agent execution endpoints
app.include_router(langgraph_analytics.router)  # LangGraph monitoring and analytics endpoints
app.include_router(safety_triage.router)
app.include_router(system.router)  # System diagnostics endpoints
# TODO: wire new agent routers once services are implemented
app.include_router(sta_router)
app.include_router(tca_router)
app.include_router(cma_router)
app.include_router(ia_router)
# app.include_router(aika_router)  # Aika Meta-Agent orchestrator
app.include_router(aika_stream.router, prefix="/api/v1")  # Aika Streaming Endpoint
app.include_router(intervention_plans.router)  # Intervention plan records
# app.include_router(sca_admin.router)  # REMOVED (Legacy)
app.include_router(appointments.router)
app.include_router(surveys.router)
app.include_router(surveys.user_router)
# app.include_router(cbt_modules.router) - DEPRECATED: Use /api/v1/agents/sca for CBT-based intervention plans
app.include_router(clinical_analytics_routes.router)  # New clinical analytics endpoints
# app.include_router(finance_router, prefix="/api/v1/finance", tags=["Finance"])  # Finance domain routes (commented out - domain incomplete)
app.include_router(blockchain_router, prefix="/api/v1/blockchain", tags=["Blockchain"])  # Blockchain domain routes
# logger.info(f"List of routers (/api/v1): {app.routes}")
startup_log(f"Allowed origins: {origins}")

# Check environment variables
check_env(verbose=STARTUP_VERBOSE_LOGS)

# Add custom OpenAPI generation with error handling
@app.get("/openapi.json", include_in_schema=False)
async def custom_openapi():
    """Custom OpenAPI endpoint with detailed error reporting"""
    try:
        if app.openapi_schema:
            return app.openapi_schema
        openapi_schema = app.openapi()
        app.openapi_schema = openapi_schema
        return openapi_schema
    except Exception as e:
        import traceback
        logger.error(f"OpenAPI generation failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"error": str(e), "traceback": traceback.format_exc()}


@app.get("/docs", include_in_schema=False)
async def scalar_html():
    """Scalar API Reference"""
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
        servers=[
            {"url": "http://localhost:22001", "description": "Local Development"},
            {"url": "https://api.aicare.ina17.com", "description": "Production"},
        ]
    )


@app.get("/")
async def root():
    """Root endpoint for the API"""
    logger.info("Root endpoint accessed")
    return {
        "message": "Welcome to the Aika Chatbot API!",
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc"
        },
        "api_base_url": "/api/v1"
    }

@app.get("/cors-test")
async def cors_test():
    """Test endpoint to verify CORS configuration"""
    logger.info("CORS test endpoint accessed")
    return {
        "message": "CORS test successful",
        "origins": os.getenv("ALLOWED_ORIGINS", "*").split(","),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    logger.info("Health check endpoint accessed")
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),  # UTC timestamp (timezone-aware)
        "version": "0.1",
        "description": "Aika Chatbot API - UGM AI Care",
        "api_version": "v1",
        "api_base_url": "/api/v1",
        "allowed_origins": os.getenv("ALLOWED_ORIGINS", "*").split(","),
        "environment": os.getenv("APP_ENV", "development"),
        "database": {
            # Never surface the raw DATABASE_URL — it contains credentials.
            "status": "configured" if os.getenv("DATABASE_URL") else "not configured",
        },
    }

@app.get("/health/db")
async def db_health_check():
    """Database health check endpoint"""
    logger.info("Database health check endpoint accessed")
    from app.database import check_db_health
    try:
        is_healthy = await check_db_health()
        if is_healthy:
            return {"status": "healthy", "db_status": "connected"}
        return {"status": "unhealthy", "db_status": "not connected"}
    except Exception as e:
        logger.error("Database health check failed: %s", e)
        return {"status": "unhealthy", "db_status": "check failed"}

@app.get("/health/redis")
async def redis_health_check():
    """Redis health check endpoint with rate limiter and cache metrics"""
    logger.info("Redis health check endpoint accessed")
    try:
        # Check Redis connection
        redis_client = await get_redis_client()
        pong = await redis_client.ping()
        
        if not pong:
            return {"status": "unhealthy", "redis_status": "not connected"}
        
        # Get rate limiter stats
        from app.core.rate_limiter import get_rate_limiter
        rate_limiter = get_rate_limiter()
        rate_limiter_stats = await rate_limiter.get_stats()
        
        # Get cache stats
        from app.core.cache import get_cache_service
        cache_service = get_cache_service()
        cache_stats = await cache_service.get_stats()

        # Get API performance summary from Redis if available
        from app.services.api_performance import get_performance_service
        performance_service = get_performance_service()
        performance_summary = await performance_service.get_redis_summary()
        
        return {
            "status": "healthy",
            "redis_status": "connected",
            "rate_limiter": rate_limiter_stats,
            "cache": cache_stats,
            "api_performance": performance_summary,
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {"status": "unhealthy", "redis_status": str(e)}

@app.get("/health/frontend")
async def frontend_health_check():
    """Frontend health check endpoint"""
    logger.info("Frontend health check endpoint accessed")
    try:
        # Assuming you have a way to check the frontend's health
        # This could be a simple HTTP request to the frontend URL
        frontend_url = os.getenv("FRONTEND_URL")
        if not frontend_url:
            raise ValueError("FRONTEND_URL is not set.")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(frontend_url)
        if response.status_code == 200:
            return {"status": "healthy", "frontend_status": "connected"}
        else:
            return {"status": "unhealthy", "frontend_status": f"HTTP {response.status_code}"}
    except Exception as e:
        logger.error(f"Frontend health check failed: {e}")
        return {"status": "unhealthy", "frontend_status": str(e)}

# For Render deployment
if __name__ == "__main__":
    import os
    import uvicorn
    import multiprocessing
    
    try:
        port = int(os.getenv("PORT", 8000))
        workers = min(multiprocessing.cpu_count() + 1, 4)  # A common practice: workers = CPU cores + 1
        
        uvicorn.run(
            "app.main:app", 
            host="0.0.0.0", 
            port=port, 
            reload=False,
            workers=workers,
            proxy_headers=True,
            forwarded_allow_ips="*"
        )
    except Exception as e:
        print(f"Failed to start server: {e}")
        exit(1)
