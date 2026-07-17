"""Campaign execution service for automated message delivery via TCA."""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign import SCACampaignExecution
from app.domains.mental_health.models import Case
from app.models.user import User
from app.domains.mental_health.services.campaign_service import CampaignService
from app.services.user_normalization import current_risk_level as current_risk_level_for_user
from app.services.user_normalization import display_name as display_name_for_user

logger = logging.getLogger(__name__)


class CampaignExecutionService:
    """Handles campaign execution: audience targeting and message delivery."""

    @staticmethod
    async def execute_campaign(
        db: AsyncSession,
        campaign_id: UUID,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Execute a campaign by targeting audience and sending messages.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID to execute
            dry_run: If True, only calculate targets without sending
            
        Returns:
            Execution results dictionary
        """
        from time import time
        start_time = time()
        
        campaign = await CampaignService.get_campaign(db, campaign_id)
        if not campaign:
            logger.error(f"Campaign not found: {campaign_id}")
            return {
                "success": False,
                "error": "Campaign not found",
                "targets_count": 0,
                "messages_sent": 0,
                "execution_time_seconds": 0.0,
            }
        
        if campaign.status != "active":
            logger.warning(f"Cannot execute campaign {campaign_id}: status is {campaign.status}")
            return {
                "success": False,
                "error": f"Campaign is not active (status: {campaign.status})",
                "targets_count": 0,
                "messages_sent": 0,
                "execution_time_seconds": time() - start_time,
            }
        
        # Step 1: Get target audience
        target_users = await CampaignExecutionService._get_target_audience(
            db, campaign.target_audience
        )
        
        targets_count = len(target_users)
        logger.info(f"Campaign {campaign_id}: {targets_count} users targeted")
        
        if dry_run:
            execution_time = time() - start_time
            return {
                "success": True,
                "dry_run": True,
                "targets_count": targets_count,
                "target_user_ids": [user.id for user in target_users],
                "messages_sent": 0,
                "execution_time_seconds": execution_time,
            }
        
        # Step 2: Send messages via TCA
        messages_sent = 0
        messages_failed = 0
        users_targeted = set()
        
        for user in target_users:
            try:
                # Send message to user via TCA
                success = await CampaignExecutionService._send_campaign_message(
                    db, campaign, user
                )
                
                if success:
                    messages_sent += 1
                    users_targeted.add(user.id)
                else:
                    messages_failed += 1
                    
            except Exception as e:
                logger.error(f"Error sending message to user {user.id}: {e}")
                messages_failed += 1
        
        # Step 3: Record metrics
        if messages_sent > 0:
            await CampaignService.record_campaign_execution(
                db=db,
                campaign_id=campaign_id,
                execution_date=date.today(),
                messages_sent=messages_sent,
                users_targeted=len(users_targeted),
                users_engaged=0,  # Updated later when users reply
            )
        
        execution_time = time() - start_time
        
        # Step 4: Log execution history for audit trail
        execution_record = SCACampaignExecution(
            campaign_id=campaign_id,
            executed_at=datetime.utcnow(),
            executed_by=None,  # TODO: Pass current user from auth context
            campaign_name=campaign.name,
            message_content=campaign.message_template,
            total_targeted=targets_count,
            messages_sent=messages_sent,
            messages_failed=messages_failed,
            execution_time_seconds=execution_time,
            dry_run=False,
            targeted_user_ids=[user.id for user in target_users],
            error_message=None if messages_failed == 0 else f"{messages_failed} messages failed",
        )
        db.add(execution_record)
        await db.commit()
        
        logger.info(
            f"Campaign {campaign_id} executed: "
            f"{messages_sent} sent, {messages_failed} failed"
        )
        
        return {
            "success": True,
            "dry_run": False,
            "targets_count": targets_count,
            "messages_sent": messages_sent,
            "messages_failed": messages_failed,
            "users_targeted": len(users_targeted),
            "execution_time_seconds": execution_time,
        }

    @staticmethod
    async def _get_target_audience(
        db: AsyncSession,
        target_criteria: Optional[Dict[str, Any]],
    ) -> List[User]:
        """Get list of users matching target criteria.
        
        Target criteria format:
        {
            "segment": "first_year_students",
            "risk_level": "high",
            "has_open_case": true,
            "exclude_recent_contact": 7  // days
        }
        
        Args:
            db: Database session
            target_criteria: JSON targeting criteria
            
        Returns:
            List of User instances
        """
        if not target_criteria:
            # No criteria = all users (be careful with this!)
            logger.warning("No target criteria specified, targeting ALL users")
            result = await db.execute(select(User).where(User.is_active == True))
            return list(result.scalars().all())
        
        # Build query based on criteria
        query = select(User).where(User.is_active == True)
        
        # Filter by segment (e.g., first_year_students, sophomores, etc.)
        segment = target_criteria.get("segment")
        if segment:
            # This would need to be customized based on your User model
            # Example: filter by student year or program
            pass  # TODO: Implement segment filtering
        
        # Filter by risk level (requires checking active cases)
        risk_level = target_criteria.get("risk_level")
        if risk_level:
            # Get users with open cases at specified risk level
            from app.domains.mental_health.models import Case
            
            subquery = (
                select(Case.user_id)
                .where(
                    and_(
                        Case.status.in_(["open", "in_progress"]),
                        Case.severity == risk_level,
                    )
                )
                .scalar_subquery()
            )
            
            query = query.where(User.id.in_(subquery))
        
        # Filter by has_open_case
        has_open_case = target_criteria.get("has_open_case")
        if has_open_case is not None:
            from app.domains.mental_health.models import Case
            
            subquery = (
                select(Case.user_id)
                .where(Case.status.in_(["open", "in_progress"]))
                .distinct()
                .scalar_subquery()
            )
            
            if has_open_case:
                query = query.where(User.id.in_(subquery))
            else:
                query = query.where(User.id.not_in(subquery))
        
        # Exclude users contacted recently
        exclude_recent_contact = target_criteria.get("exclude_recent_contact")
        if exclude_recent_contact:
            # This would check last campaign execution date per user
            # TODO: Implement recent contact exclusion
            pass
        
        # Execute query
        result = await db.execute(query)
        users = list(result.scalars().all())
        
        logger.info(f"Target audience: {len(users)} users")
        return users

    @staticmethod
    async def _send_campaign_message(
        db: AsyncSession,
        campaign: Campaign,
        user: User,
    ) -> bool:
        """Send campaign message to a user via TCA email.
        
        Sends a personalized HTML email to the target user. The message template
        supports the following variables:
        
        - {user_name} or {name}: Student's full name or first name
        - {sentiment_score}: Current sentiment score (0-100)
        - {risk_score}: Highest risk level from active cases (LOW/MEDIUM/HIGH/CRITICAL)
        - {case_count}: Number of active cases
        - {days_inactive}: Days since last activity on platform
        
        Args:
            db: Database session
            campaign: Campaign instance
            user: Target user
            
        Returns:
            True if message sent successfully
        """
        try:
            from app.utils.email_utils import send_email
            from app.core.settings import get_settings
            
            settings = get_settings()
            frontend_url = settings.frontend_url
            
            # Get user email (stored as plaintext, encryption removed for performance)
            user_email = user.email
            if not user_email:
                logger.error(f"No email found for user {user.id}")
                return False
            
            # Get user's name for personalization
            user_name = display_name_for_user(user) or user_email.split("@")[0]
            
            # Get user's profile data for personalization
            # Note: Cases use user_hash for privacy, can't directly link to user.id
            case_count = 0
            risk_score = current_risk_level_for_user(user) or "N/A"
            days_inactive = 0
            
            # Calculate days since last activity with proper type handling
            last_activity_date = getattr(user, "last_activity_date", None)
            if getattr(user, "profile", None) is not None:
                last_activity_date = user.profile.last_activity_date or last_activity_date

            if last_activity_date:
                from datetime import datetime as DateTimeType
                today = date.today()
                # Ensure last_activity_date is a date object
                if isinstance(last_activity_date, date):
                    days_inactive = (today - last_activity_date).days
                elif isinstance(last_activity_date, DateTimeType):
                    # Handle datetime objects - use .date() method
                    last_activity = last_activity_date.date()  # datetime to date
                    days_inactive = (today - last_activity).days
                else:
                    # Fallback if unexpected type
                    days_inactive = 0
            
            # Personalize message template with all available variables
            message_text = campaign.message_template
            message_text = message_text.replace("{name}", user_name)
            message_text = message_text.replace("{user_name}", user_name)
            message_text = message_text.replace("{sentiment_score}", f"{user.sentiment_score:.2f}")
            message_text = message_text.replace("{risk_score}", risk_score)
            message_text = message_text.replace("{case_count}", str(case_count))
            message_text = message_text.replace("{days_inactive}", str(days_inactive))
            
            # Create HTML email content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }}
                    .header {{
                        background: linear-gradient(135deg, #00153a 0%, #001f5c 100%);
                        color: white;
                        padding: 30px;
                        border-radius: 10px 10px 0 0;
                        text-align: center;
                    }}
                    .content {{
                        background: white;
                        padding: 30px;
                        border: 1px solid #e0e0e0;
                        border-top: none;
                    }}
                    .message {{
                        white-space: pre-wrap;
                        background: #f5f5f5;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                    }}
                    .footer {{
                        background: #f9f9f9;
                        padding: 20px;
                        border-radius: 0 0 10px 10px;
                        text-align: center;
                        font-size: 0.9em;
                        color: #666;
                        border: 1px solid #e0e0e0;
                        border-top: none;
                    }}
                    .cta-button {{
                        display: inline-block;
                        padding: 12px 30px;
                        background: #FFCA40;
                        color: #00153a;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: bold;
                        margin: 20px 0;
                    }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🌟 UGM AI-Care Outreach</h1>
                    <p>Proactive Mental Health Support</p>
                </div>
                <div class="content">
                    <h2>Hello {user_name},</h2>
                    <div class="message">
                        {message_text}
                    </div>
                    <p>We're here to support your mental health and well-being. If you'd like to talk, we're available 24/7.</p>
                    <center>
                        <a href="{frontend_url}/chat" class="cta-button">Start a Conversation</a>
                    </center>
                </div>
                <div class="footer">
                    <p><strong>Campaign:</strong> {campaign.name}</p>
                    <p>This is an automated message from UGM AI-Care Support System.</p>
                    <p>If you need immediate assistance, please contact your campus counseling center.</p>
                </div>
            </body>
            </html>
            """
            
            # Send email
            subject = f"UGM AI-Care: {campaign.name}"
            success = send_email(
                recipient_email=user_email,  # Use decrypted email
                subject=subject,
                html_content=html_content
            )
            
            if success:
                logger.info(f"✅ Campaign email sent to {user_email} (User ID: {user.id})")
            else:
                logger.error(f"❌ Failed to send campaign email to {user_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to send message to user {user.id}: {e}")
            return False

    @staticmethod
    async def get_campaign_targets_preview(
        db: AsyncSession,
        target_criteria: Optional[Dict[str, Any]],
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Preview target audience without executing campaign.
        
        Args:
            db: Database session
            target_criteria: JSON targeting criteria
            limit: Maximum users to return in preview
            
        Returns:
            Dictionary with preview data
        """
        users = await CampaignExecutionService._get_target_audience(db, target_criteria)
        
        total_count = len(users)
        preview_users = users[:limit]
        
        return {
            "total_targets": total_count,
            "preview_limit": limit,
            "preview": [
                {
                    "id": user.id,
                    "name": (
                        user.preferred_name or 
                        user.name or 
                        (f"{user.first_name} {user.last_name}".strip() if user.first_name or user.last_name else None) or
                        (user.email or "").split("@")[0]
                    ),
                    "email": user.email or "",  # Plaintext (encryption removed)
                }
                for user in preview_users
            ],
        }

    @staticmethod
    async def record_user_engagement(
        db: AsyncSession,
        campaign_id: UUID,
        user_id: int,
        engaged: bool = True,
    ) -> None:
        """Record user engagement with campaign message.
        
        Called when a user replies to a campaign message.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            user_id: User ID
            engaged: Whether user engaged (replied) or not
        """
        if not engaged:
            return
        
        # Get today's metrics for this campaign
        from app.models.campaign import CampaignMetrics
        
        result = await db.execute(
            select(CampaignMetrics).where(
                and_(
                    CampaignMetrics.campaign_id == campaign_id,
                    CampaignMetrics.execution_date == date.today(),
                )
            )
        )
        metrics = result.scalar_one_or_none()
        
        if metrics:
            metrics.users_engaged += 1
            
            if metrics.users_targeted > 0:
                metrics.success_rate = metrics.users_engaged / metrics.users_targeted
            
            await db.commit()
            logger.info(f"Recorded engagement for campaign {campaign_id}, user {user_id}")
        else:
            logger.warning(
                f"No metrics found for campaign {campaign_id} on {date.today()}"
            )
