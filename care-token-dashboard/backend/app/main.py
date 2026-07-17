"""
FastAPI Application Entry Point for CARE Token Dashboard

This backend service provides:
- Revenue tracking and blockchain submission
- Multi-sig approval workflow
- Staking analytics
- Finance team authentication
- Monthly automated reporting
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os

from app.core.config import settings
from app.api.routes import auth, revenue, staking, approvals, health
from app.services.scheduler import revenue_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("🚀 Starting CARE Token Dashboard Backend...")
    
    # Start scheduler if enabled
    if settings.ENABLE_MONTHLY_SCHEDULER:
        revenue_scheduler.start()
        logger.info("✅ Monthly revenue scheduler started")
    else:
        logger.info("ℹ️  Monthly scheduler disabled (ENABLE_MONTHLY_SCHEDULER=false)")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down CARE Token Dashboard Backend...")
    if settings.ENABLE_MONTHLY_SCHEDULER:
        revenue_scheduler.shutdown()
        logger.info("✅ Monthly revenue scheduler stopped")


# Create FastAPI app
app = FastAPI(
    title="CARE Token Dashboard API",
    description="Finance and tokenomics management API for CARE token ecosystem",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(revenue.router, prefix="/api/v1/revenue", tags=["Revenue"])
app.include_router(staking.router, prefix="/api/v1/staking", tags=["Staking"])
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["Approvals"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CARE Token Dashboard API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "INTERNAL_ERROR"
            }
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
