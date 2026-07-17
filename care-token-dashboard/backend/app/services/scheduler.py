"""
APScheduler configuration for monthly revenue automation
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging

from app.core.config import settings
from app.services.revenue_tracker import revenue_tracker

logger = logging.getLogger(__name__)


class RevenueScheduler:
    """Scheduler for automated monthly revenue reporting"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
    
    async def monthly_revenue_job(self):
        """Job function that runs monthly to submit revenue reports"""
        try:
            logger.info("🔔 Monthly revenue job triggered")
            success = await revenue_tracker.auto_submit_last_month()
            
            if success:
                logger.info("✅ Monthly revenue job completed successfully")
            else:
                logger.error("❌ Monthly revenue job failed")
        
        except Exception as e:
            logger.error(f"❌ Monthly revenue job error: {str(e)}", exc_info=True)
    
    def start(self):
        """Start the scheduler"""
        if self.is_running:
            logger.warning("⚠️  Scheduler already running")
            return
        
        # Determine trigger based on test mode
        if settings.SCHEDULER_TEST_MODE:
            # Test mode: Run every minute
            trigger = IntervalTrigger(minutes=1)
            logger.info("🧪 Scheduler in TEST MODE (runs every minute)")
        else:
            # Production mode: Run on 1st of each month at 1 AM UTC
            trigger = CronTrigger(
                day=1,
                hour=1,
                minute=0,
                timezone='UTC'
            )
            logger.info("📅 Scheduler in PRODUCTION MODE (runs 1st of month at 1 AM UTC)")
        
        # Add job
        self.scheduler.add_job(
            self.monthly_revenue_job,
            trigger=trigger,
            id='monthly_revenue_report',
            name='Monthly Revenue Report Submission',
            replace_existing=True
        )
        
        # Start scheduler
        self.scheduler.start()
        self.is_running = True
        
        logger.info("✅ Revenue scheduler started successfully")
        
        # Log next run time
        next_run = self.scheduler.get_job('monthly_revenue_report').next_run_time
        logger.info(f"   Next run: {next_run}")
    
    def shutdown(self):
        """Shutdown the scheduler"""
        if not self.is_running:
            logger.warning("⚠️  Scheduler not running")
            return
        
        self.scheduler.shutdown(wait=True)
        self.is_running = False
        logger.info("✅ Revenue scheduler stopped")
    
    def get_status(self) -> dict:
        """Get scheduler status information"""
        if not self.is_running:
            return {
                "running": False,
                "next_run": None,
                "last_run": None,
                "test_mode": settings.SCHEDULER_TEST_MODE
            }
        
        job = self.scheduler.get_job('monthly_revenue_report')
        
        return {
            "running": True,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "test_mode": settings.SCHEDULER_TEST_MODE,
            "job_name": job.name,
            "job_id": job.id
        }


# Singleton instance
revenue_scheduler = RevenueScheduler()
