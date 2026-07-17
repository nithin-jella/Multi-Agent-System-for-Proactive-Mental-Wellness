"""Campaign trigger evaluation engine for automated campaign execution."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignTrigger

logger = logging.getLogger(__name__)


class TriggerEvaluator:
    """Evaluates campaign trigger conditions against IA insights and system metrics."""

    @staticmethod
    async def create_trigger(
        db: AsyncSession,
        campaign_id: UUID,
        condition_type: str,
        condition_value: dict,
        evaluation_frequency: str = "daily",
    ) -> CampaignTrigger:
        """Create a new campaign trigger.
        
        Args:
            db: Database session
            campaign_id: Associated campaign UUID
            condition_type: Type of condition (ia_insight, manual, scheduled, threshold_breach)
            condition_value: JSON condition definition
            evaluation_frequency: How often to evaluate (hourly, daily, weekly)
            
        Returns:
            Created CampaignTrigger instance
        """
        trigger = CampaignTrigger(
            campaign_id=campaign_id,
            condition_type=condition_type,
            condition_value=condition_value,
            evaluation_frequency=evaluation_frequency,
            match_count=0,
        )
        
        db.add(trigger)
        await db.commit()
        await db.refresh(trigger)
        
        logger.info(f"Created trigger for campaign {campaign_id}: {condition_type}")
        return trigger

    @staticmethod
    async def get_triggers_for_campaign(
        db: AsyncSession,
        campaign_id: UUID,
    ) -> List[CampaignTrigger]:
        """Get all triggers for a campaign.
        
        Args:
            db: Database session
            campaign_id: Campaign UUID
            
        Returns:
            List of CampaignTrigger instances
        """
        result = await db.execute(
            select(CampaignTrigger).where(CampaignTrigger.campaign_id == campaign_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def evaluate_triggers(
        db: AsyncSession,
        ia_insights: Optional[Dict[str, Any]] = None,
        system_metrics: Optional[Dict[str, Any]] = None,
    ) -> List[UUID]:
        """Evaluate all active campaign triggers and return matched campaign IDs.
        
        This method is called periodically (e.g., daily) to check all trigger conditions.
        
        Args:
            db: Database session
            ia_insights: Optional IA report insights data
            system_metrics: Optional system metrics data
            
        Returns:
            List of campaign UUIDs that matched their trigger conditions
        """
        matched_campaigns = []
        
        # Get all active campaigns with triggers
        result = await db.execute(
            select(Campaign).where(Campaign.status == "active")
        )
        active_campaigns = list(result.scalars().all())
        
        for campaign in active_campaigns:
            # Get triggers for this campaign
            triggers = await TriggerEvaluator.get_triggers_for_campaign(db, campaign.id)
            
            for trigger in triggers:
                # Update last_evaluated_at
                trigger.last_evaluated_at = datetime.utcnow()
                
                # Evaluate the trigger condition
                is_match = TriggerEvaluator._evaluate_condition(
                    trigger.condition_type,
                    trigger.condition_value,
                    ia_insights,
                    system_metrics,
                )
                
                if is_match:
                    logger.info(f"Trigger matched for campaign {campaign.id}: {trigger.condition_type}")
                    
                    trigger.last_match_at = datetime.utcnow()
                    trigger.match_count += 1
                    
                    if campaign.id not in matched_campaigns:
                        matched_campaigns.append(campaign.id)
        
        await db.commit()
        
        logger.info(f"Evaluated triggers: {len(matched_campaigns)} campaigns matched")
        return matched_campaigns

    @staticmethod
    def _evaluate_condition(
        condition_type: str,
        condition_value: dict,
        ia_insights: Optional[Dict[str, Any]],
        system_metrics: Optional[Dict[str, Any]],
    ) -> bool:
        """Evaluate a single trigger condition.
        
        Args:
            condition_type: Type of condition
            condition_value: Condition definition (JSON DSL)
            ia_insights: IA report insights
            system_metrics: System metrics
            
        Returns:
            True if condition matches, False otherwise
        """
        try:
            if condition_type == "ia_insight":
                return TriggerEvaluator._evaluate_ia_insight(condition_value, ia_insights)
            
            elif condition_type == "threshold_breach":
                return TriggerEvaluator._evaluate_threshold(condition_value, system_metrics)
            
            elif condition_type == "manual":
                # Manual triggers don't auto-execute
                return False
            
            elif condition_type == "scheduled":
                # Scheduled triggers always match on their schedule
                return True
            
            else:
                logger.warning(f"Unknown condition type: {condition_type}")
                return False
                
        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False

    @staticmethod
    def _evaluate_ia_insight(
        condition: dict,
        ia_insights: Optional[Dict[str, Any]],
    ) -> bool:
        """Evaluate IA insight condition.
        
        Expected condition format:
        {
            "metric": "topic_frequency",
            "topic": "financial stress",
            "operator": ">=",
            "value": 20
        }
        OR:
        {
            "metric": "high_risk_count",
            "operator": ">=",
            "value": 10
        }
        
        Args:
            condition: Condition definition
            ia_insights: IA report insights data
            
        Returns:
            True if condition matches
        """
        if not ia_insights:
            return False
        
        metric = condition.get("metric")
        operator = condition.get("operator")
        threshold = condition.get("value")
        
        if not all([metric, operator, threshold]):
            logger.warning(f"Invalid IA insight condition: {condition}")
            return False
        
        # Type check to satisfy Pylance
        if not isinstance(operator, str) or not isinstance(metric, str):
            logger.warning(f"Invalid operator or metric type: {condition}")
            return False
        
        # Extract metric value from insights
        metric_value = None
        
        if metric == "high_risk_count":
            metric_value = ia_insights.get("high_risk_count", 0)
        
        elif metric == "topic_frequency":
            topic = condition.get("topic")
            if not topic:
                return False
            
            # Check if topic appears in trending topics
            trending_topics = ia_insights.get("trending_topics", [])
            for topic_data in trending_topics:
                if topic_data.get("topic", "").lower() == topic.lower():
                    metric_value = topic_data.get("frequency", 0)
                    break
        
        elif metric == "sentiment_trend":
            metric_value = ia_insights.get("overall_sentiment", 0.0)
        
        else:
            logger.warning(f"Unknown IA metric: {metric}")
            return False
        
        if metric_value is None:
            return False
        
        # Evaluate operator
        return TriggerEvaluator._compare_values(metric_value, operator, threshold)

    @staticmethod
    def _evaluate_threshold(
        condition: dict,
        system_metrics: Optional[Dict[str, Any]],
    ) -> bool:
        """Evaluate system threshold condition.
        
        Expected condition format:
        {
            "metric": "active_critical_cases",
            "operator": ">=",
            "value": 5
        }
        
        Args:
            condition: Condition definition
            system_metrics: System metrics data
            
        Returns:
            True if condition matches
        """
        if not system_metrics:
            return False
        
        metric = condition.get("metric")
        operator = condition.get("operator")
        threshold = condition.get("value")
        
        if not all([metric, operator, threshold]):
            logger.warning(f"Invalid threshold condition: {condition}")
            return False
        
        # Type check to satisfy Pylance
        if not isinstance(operator, str) or not isinstance(metric, str):
            logger.warning(f"Invalid operator or metric type: {condition}")
            return False
        
        # Extract metric value from system metrics
        metric_value = system_metrics.get(metric)
        
        if metric_value is None:
            return False
        
        # Evaluate operator
        return TriggerEvaluator._compare_values(metric_value, operator, threshold)

    @staticmethod
    def _compare_values(value: Any, operator: str, threshold: Any) -> bool:
        """Compare two values using an operator.
        
        Args:
            value: Actual value
            operator: Comparison operator (>=, <=, >, <, ==, !=)
            threshold: Threshold value
            
        Returns:
            True if comparison matches
        """
        try:
            if operator == ">=":
                return value >= threshold
            elif operator == "<=":
                return value <= threshold
            elif operator == ">":
                return value > threshold
            elif operator == "<":
                return value < threshold
            elif operator == "==":
                return value == threshold
            elif operator == "!=":
                return value != threshold
            else:
                logger.warning(f"Unknown operator: {operator}")
                return False
        except Exception as e:
            logger.error(f"Error comparing values: {e}")
            return False

    @staticmethod
    async def delete_trigger(db: AsyncSession, trigger_id: UUID) -> bool:
        """Delete a campaign trigger.
        
        Args:
            db: Database session
            trigger_id: Trigger UUID
            
        Returns:
            True if deleted, False if not found
        """
        result = await db.execute(
            select(CampaignTrigger).where(CampaignTrigger.id == trigger_id)
        )
        trigger = result.scalar_one_or_none()
        
        if not trigger:
            return False
        
        await db.delete(trigger)
        await db.commit()
        
        logger.info(f"Deleted trigger: {trigger_id}")
        return True
