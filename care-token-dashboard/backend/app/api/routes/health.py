"""
Health check endpoint
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime

from app.db.session import get_db
from app.services.scheduler import revenue_scheduler
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint
    
    Returns service status, database connectivity, blockchain connectivity, and scheduler status
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "care-token-dashboard",
        "version": "1.0.0",
        "checks": {}
    }
    
    # Database check
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        health_status["checks"]["database"] = {
            "status": "healthy",
            "message": "Database connection successful"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}"
        }
    
    # Blockchain check
    try:
        from app.services.revenue_tracker import revenue_tracker
        
        if revenue_tracker.w3.is_connected():
            block_number = revenue_tracker.w3.eth.block_number
            health_status["checks"]["blockchain"] = {
                "status": "healthy",
                "message": f"Connected to SOMNIA (block: {block_number})",
                "block_number": block_number
            }
        else:
            health_status["checks"]["blockchain"] = {
                "status": "unhealthy",
                "message": "Not connected to SOMNIA network"
            }
    except Exception as e:
        health_status["checks"]["blockchain"] = {
            "status": "unhealthy",
            "message": f"Blockchain check failed: {str(e)}"
        }
    
    # Scheduler check
    try:
        scheduler_status = revenue_scheduler.get_status()
        health_status["checks"]["scheduler"] = {
            "status": "healthy" if scheduler_status["running"] else "disabled",
            **scheduler_status
        }
    except Exception as e:
        health_status["checks"]["scheduler"] = {
            "status": "unhealthy",
            "message": f"Scheduler check failed: {str(e)}"
        }
    
    return health_status
