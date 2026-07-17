"""Campaign management service for proactive outreach (Phase 5)."""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignMetrics, CampaignTrigger
from app.models.user import User

logger = logging.getLogger(__name__)


class CampaignService:
    """Service layer for campaign management operations."""

    @staticmethod
    async def create_campaign(
        db: AsyncSession,
        name: str,
        message_template: str,
        created_by: Optional[int] = None,
        description: Optional[str] = None,
        trigger_rules: Optional[dict] = None,
        target_audience: Optional[dict] = None,
        status: str = "draft",
        priority: str = "medium",
    ) -> Campaign:
        """Create a new campaign.
        
        Args:
            db: Database session
            name: Campaign name
            message_template: Message template for TCA
            created_by: User ID of campaign creator
            description: Optional campaign description
            trigger_rules: Optional JSON trigger configuration
            target_audience: Optional JSON audience targeting
            status: Campaign status (draft, active, paused, completed)
            priority: Campaign priority (low, medium, high)
            
        Returns:
            Created Campaign instance
        """
        campaign = Campaign(
            name=name,
            description=description,
            message_template=message_template,
            trigger_rules=trigger_rules,
            target_audience=target_audience,
            status=status,
            priority=priority,
            created_by=created_by,
        )
        
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        
        logger.info(f"Created campaign: {campaign.id} - {campaign.name}")
        return campaign

    @staticmethod
    async def get_campaign(db: AsyncSession, campaign_id: UUID) -> Optional[Campaign]:
        """Get campaign by ID.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            
        Returns:
            Campaign instance or None
        """
        result = await db.execute(
            select(Campaign).where(Campaign.id == campaign_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_campaigns(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> tuple[List[Campaign], int]:
        """List campaigns with filtering and pagination.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum records to return
            status: Optional status filter (draft, active, paused, completed)
            priority: Optional priority filter (low, medium, high)
            
        Returns:
            Tuple of (campaigns list, total count)
        """
        # Build query with filters
        query = select(Campaign)
        
        if status:
            query = query.where(Campaign.status == status)
        if priority:
            query = query.where(Campaign.priority == priority)
        
        # Get total count
        count_query = select(func.count()).select_from(Campaign)
        if status:
            count_query = count_query.where(Campaign.status == status)
        if priority:
            count_query = count_query.where(Campaign.priority == priority)
            
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Get paginated results
        query = query.order_by(desc(Campaign.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        campaigns = list(result.scalars().all())
        
        return campaigns, total

    @staticmethod
    async def update_campaign(
        db: AsyncSession,
        campaign_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        message_template: Optional[str] = None,
        trigger_rules: Optional[dict] = None,
        target_audience: Optional[dict] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> Optional[Campaign]:
        """Update campaign fields.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            name: Optional new name
            description: Optional new description
            message_template: Optional new message template
            trigger_rules: Optional new trigger rules
            target_audience: Optional new target audience
            status: Optional new status
            priority: Optional new priority
            
        Returns:
            Updated Campaign instance or None
        """
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if not campaign:
            return None
        
        # Update fields
        if name is not None:
            campaign.name = name
        if description is not None:
            campaign.description = description
        if message_template is not None:
            campaign.message_template = message_template
        if trigger_rules is not None:
            campaign.trigger_rules = trigger_rules
        if target_audience is not None:
            campaign.target_audience = target_audience
        if status is not None:
            campaign.status = status
        if priority is not None:
            campaign.priority = priority
        
        campaign.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(campaign)
        
        logger.info(f"Updated campaign: {campaign.id} - {campaign.name}")
        return campaign

    @staticmethod
    async def delete_campaign(db: AsyncSession, campaign_id: UUID) -> bool:
        """Delete (soft delete - mark as completed) a campaign.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            
        Returns:
            True if deleted, False if not found
        """
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if not campaign:
            return False
        
        # Soft delete by setting status to completed
        campaign.status = "completed"
        campaign.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info(f"Deleted (soft) campaign: {campaign.id} - {campaign.name}")
        return True

    @staticmethod
    async def launch_campaign(db: AsyncSession, campaign_id: UUID) -> Optional[Campaign]:
        """Launch a campaign (change status from draft to active).
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            
        Returns:
            Updated Campaign instance or None
        """
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if not campaign:
            return None
        
        if campaign.status != "draft":
            logger.warning(f"Cannot launch campaign {campaign_id}: status is {campaign.status}")
            return None
        
        campaign.status = "active"
        campaign.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(campaign)
        
        logger.info(f"Launched campaign: {campaign.id} - {campaign.name}")
        return campaign

    @staticmethod
    async def pause_campaign(db: AsyncSession, campaign_id: UUID) -> Optional[Campaign]:
        """Pause an active campaign.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            
        Returns:
            Updated Campaign instance or None
        """
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if not campaign:
            return None
        
        if campaign.status != "active":
            logger.warning(f"Cannot pause campaign {campaign_id}: status is {campaign.status}")
            return None
        
        campaign.status = "paused"
        campaign.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(campaign)
        
        logger.info(f"Paused campaign: {campaign.id} - {campaign.name}")
        return campaign

    @staticmethod
    async def resume_campaign(db: AsyncSession, campaign_id: UUID) -> Optional[Campaign]:
        """Resume a paused campaign.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            
        Returns:
            Updated Campaign instance or None
        """
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if not campaign:
            return None
        
        if campaign.status != "paused":
            logger.warning(f"Cannot resume campaign {campaign_id}: status is {campaign.status}")
            return None
        
        campaign.status = "active"
        campaign.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(campaign)
        
        logger.info(f"Resumed campaign: {campaign.id} - {campaign.name}")
        return campaign

    @staticmethod
    async def get_campaign_metrics(
        db: AsyncSession,
        campaign_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[CampaignMetrics]:
        """Get campaign metrics for a date range.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of CampaignMetrics
        """
        query = select(CampaignMetrics).where(CampaignMetrics.campaign_id == campaign_id)
        
        if start_date:
            query = query.where(CampaignMetrics.execution_date >= start_date)
        if end_date:
            query = query.where(CampaignMetrics.execution_date <= end_date)
        
        query = query.order_by(desc(CampaignMetrics.execution_date))
        
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def record_campaign_execution(
        db: AsyncSession,
        campaign_id: UUID,
        execution_date: date,
        messages_sent: int = 0,
        users_targeted: int = 0,
        users_engaged: int = 0,
    ) -> CampaignMetrics:
        """Record campaign execution metrics for a specific date.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            execution_date: Date of execution
            messages_sent: Number of messages sent
            users_targeted: Number of users targeted
            users_engaged: Number of users who engaged
            
        Returns:
            CampaignMetrics instance
        """
        # Check if metrics already exist for this date
        result = await db.execute(
            select(CampaignMetrics).where(
                CampaignMetrics.campaign_id == campaign_id,
                CampaignMetrics.execution_date == execution_date
            )
        )
        metrics = result.scalar_one_or_none()
        
        if metrics:
            # Update existing metrics
            metrics.messages_sent += messages_sent
            metrics.users_targeted += users_targeted
            metrics.users_engaged += users_engaged
            
            if metrics.users_targeted > 0:
                metrics.success_rate = metrics.users_engaged / metrics.users_targeted
        else:
            # Create new metrics
            metrics = CampaignMetrics(
                campaign_id=campaign_id,
                execution_date=execution_date,
                messages_sent=messages_sent,
                users_targeted=users_targeted,
                users_engaged=users_engaged,
                success_rate=users_engaged / users_targeted if users_targeted > 0 else 0.0,
            )
            db.add(metrics)
        
        # Update campaign's last_executed_at
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if campaign:
            campaign.last_executed_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(metrics)
        
        logger.info(f"Recorded metrics for campaign {campaign_id} on {execution_date}")
        return metrics

    @staticmethod
    async def get_campaign_summary(db: AsyncSession) -> Dict[str, int]:
        """Get summary statistics for all campaigns.
        
        Args:
            db: Database session
            
        Returns:
            Dictionary with campaign statistics
        """
        # Count campaigns by status
        result = await db.execute(
            select(
                Campaign.status,
                func.count(Campaign.id).label('count')
            ).group_by(Campaign.status)
        )
        
        rows = result.all()
        status_counts: Dict[str, int] = {row[0]: int(row[1]) for row in rows}
        
        return {
            "total": sum(status_counts.values()),
            "draft": status_counts.get("draft", 0),
            "active": status_counts.get("active", 0),
            "paused": status_counts.get("paused", 0),
            "completed": status_counts.get("completed", 0),
        }
