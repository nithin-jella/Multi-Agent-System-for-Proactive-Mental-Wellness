"""
Monthly Revenue Report Scheduler

Automatically submits monthly revenue reports on the 1st of each month at 1 AM UTC.

This scheduler runs as a background task when the FastAPI app starts.
It uses APScheduler to trigger the revenue tracker service.

Schedule:
- Runs on 1st of every month at 1:00 AM UTC
- Retries up to 3 times if submission fails
- Logs all submissions for audit trail

Usage:
- Automatically started by FastAPI lifespan event
- Can be disabled via ENABLE_REVENUE_SCHEDULER=false env var
"""

import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from contextlib import asynccontextmanager
import os

from app.domains.finance.revenue_tracker import revenue_tracker

logger = logging.getLogger(__name__)


# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


async def monthly_revenue_job():
    """
    Job that runs monthly to submit revenue report
    """
    try:
        logger.info("\n" + "="*60)
        logger.info("🔄 Monthly Revenue Report Scheduler Triggered")
        logger.info(f"   Timestamp: {datetime.utcnow().isoformat()}")
        logger.info("="*60 + "\n")
        
        # Submit report for previous month
        success = await revenue_tracker.auto_submit_last_month()
        
        if success:
            logger.info("\n✅ Monthly revenue report submitted successfully!\n")
        else:
            logger.error("\n❌ Monthly revenue report submission failed. Check logs.\n")
        
        logger.info("="*60 + "\n")
        
    except Exception as e:
        logger.error(f"❌ Error in monthly revenue job: {str(e)}")


def start_scheduler():
    """
    Start the monthly revenue scheduler
    """
    global scheduler
    
    # Check if scheduler is enabled
    enabled = os.getenv("ENABLE_REVENUE_SCHEDULER", "true").lower() == "true"
    
    if not enabled:
        logger.info("⏸️  Revenue scheduler disabled (ENABLE_REVENUE_SCHEDULER=false)")
        return
    
    logger.info("\n🚀 Starting Monthly Revenue Scheduler...")
    
    # Create scheduler
    scheduler = AsyncIOScheduler()
    
    # Schedule monthly job
    # Runs on 1st of every month at 1:00 AM UTC
    trigger = CronTrigger(
        day=1,           # 1st of month
        hour=1,          # 1 AM
        minute=0,        # 0 minutes
        second=0,        # 0 seconds
        timezone='UTC'
    )
    
    scheduler.add_job(
        monthly_revenue_job,
        trigger=trigger,
        id='monthly_revenue_report',
        name='Monthly Revenue Report Submission',
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
    )
    
    # Start scheduler
    scheduler.start()
    
    logger.info("✅ Monthly Revenue Scheduler started")
    logger.info("   Schedule: 1st of every month at 1:00 AM UTC")
    
    # Safe access to next_run_time
    job = scheduler.get_job('monthly_revenue_report')
    if job and job.next_run_time:
        logger.info("   Next run: " + str(job.next_run_time))
    else:
        logger.info("   Next run: Not scheduled")
    
    logger.info("")
    
    # Optional: Add test job for debugging (runs every minute)
    if os.getenv("REVENUE_SCHEDULER_TEST_MODE", "false").lower() == "true":
        logger.info("⚠️  TEST MODE: Adding test job (runs every minute)")
        test_trigger = CronTrigger(
            minute='*',      # Every minute
            timezone='UTC'
        )
        scheduler.add_job(
            monthly_revenue_job,
            trigger=test_trigger,
            id='test_revenue_report',
            name='Test Revenue Report (Every Minute)',
            replace_existing=True,
        )


def stop_scheduler():
    """
    Stop the monthly revenue scheduler
    """
    global scheduler
    
    if scheduler and scheduler.running:
        logger.info("🛑 Stopping Monthly Revenue Scheduler...")
        scheduler.shutdown(wait=True)
        logger.info("✅ Scheduler stopped")


@asynccontextmanager
async def revenue_scheduler_lifespan(app):
    """
    FastAPI lifespan context manager for scheduler
    
    Usage in main.py:
    ```python
    from app.domains.finance.revenue_scheduler import revenue_scheduler_lifespan
    
    app = FastAPI(lifespan=revenue_scheduler_lifespan)
    ```
    """
    # Startup
    logger.info("🚀 FastAPI startup: Initializing revenue scheduler...")
    start_scheduler()
    
    yield
    
    # Shutdown
    logger.info("🛑 FastAPI shutdown: Stopping revenue scheduler...")
    stop_scheduler()


# Manual triggers for testing
async def trigger_now():
    """
    Manually trigger the monthly revenue job (for testing)
    """
    logger.info("🔧 Manually triggering revenue report job...")
    await monthly_revenue_job()


def get_scheduler_status() -> dict:
    """
    Get current scheduler status
    """
    global scheduler
    
    if not scheduler:
        return {
            "status": "not_initialized",
            "running": False,
            "jobs": []
        }
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger),
        })
    
    return {
        "status": "running" if scheduler.running else "stopped",
        "running": scheduler.running,
        "jobs": jobs
    }
