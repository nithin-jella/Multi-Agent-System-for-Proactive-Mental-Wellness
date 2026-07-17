"""Campaign management API endpoints for Phase 5."""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models.user import User
from app.schemas.admin.campaigns import (
    CampaignCreate,
    CampaignExecutionHistoryListResponse,
    CampaignExecutionHistoryResponse,
    CampaignExecutionRequest,
    CampaignExecutionResponse,
    CampaignListResponse,
    CampaignMetricsList,
    CampaignMetricsResponse,
    CampaignResponse,
    CampaignSummary,
    CampaignTriggerCreate,
    CampaignTriggerResponse,
    CampaignUpdate,
    TargetAudiencePreviewRequest,
    TargetAudiencePreviewResponse,
    UserEngagementRecord,
)
from app.domains.mental_health.services.campaign_execution_service import CampaignExecutionService
from app.domains.mental_health.services.campaign_service import CampaignService
from app.domains.mental_health.services.campaign_trigger_evaluator import TriggerEvaluator

router = APIRouter(prefix="/campaigns", tags=["Admin - Campaigns"])


# ============================================================================
# Campaign CRUD Endpoints
# ============================================================================

@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignResponse:
    """Create a new campaign.
    
    Creates a campaign in draft status. Use /campaigns/{id}/launch to activate.
    """
    campaign = await CampaignService.create_campaign(
        db=db,
        name=payload.name,
        description=payload.description,
        message_template=payload.message_template,
        trigger_rules=payload.trigger_rules,
        target_audience=payload.target_audience,
        status=payload.status,
        priority=payload.priority,
        created_by=admin_user.id,
    )
    
    return CampaignResponse.model_validate(campaign)


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum records to return"),
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignListResponse:
    """List all campaigns with filtering and pagination."""
    campaigns, total = await CampaignService.list_campaigns(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        priority=priority,
    )
    
    return CampaignListResponse(
        items=[CampaignResponse.model_validate(c) for c in campaigns],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/summary", response_model=CampaignSummary)
async def get_campaigns_summary(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignSummary:
    """Get campaign statistics summary."""
    summary = await CampaignService.get_campaign_summary(db)
    return CampaignSummary(**summary)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignResponse:
    """Get campaign details by ID."""
    campaign = await CampaignService.get_campaign(db, campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found"
        )
    
    return CampaignResponse.model_validate(campaign)


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignResponse:
    """Update campaign fields."""
    campaign = await CampaignService.update_campaign(
        db=db,
        campaign_id=campaign_id,
        name=payload.name,
        description=payload.description,
        message_template=payload.message_template,
        trigger_rules=payload.trigger_rules,
        target_audience=payload.target_audience,
        status=payload.status,
        priority=payload.priority,
    )
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found"
        )
    
    return CampaignResponse.model_validate(campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> None:
    """Delete (soft delete) a campaign."""
    deleted = await CampaignService.delete_campaign(db, campaign_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found"
        )


# ============================================================================
# Campaign Lifecycle Endpoints
# ============================================================================

@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
async def launch_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignResponse:
    """Launch a campaign (change status from draft to active)."""
    campaign = await CampaignService.launch_campaign(db, campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch campaign {campaign_id} (not found or already launched)"
        )
    
    return CampaignResponse.model_validate(campaign)


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
async def pause_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignResponse:
    """Pause an active campaign."""
    campaign = await CampaignService.pause_campaign(db, campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot pause campaign {campaign_id} (not found or not active)"
        )
    
    return CampaignResponse.model_validate(campaign)


@router.post("/{campaign_id}/resume", response_model=CampaignResponse)
async def resume_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignResponse:
    """Resume a paused campaign."""
    campaign = await CampaignService.resume_campaign(db, campaign_id)
    
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resume campaign {campaign_id} (not found or not paused)"
        )
    
    return CampaignResponse.model_validate(campaign)


# ============================================================================
# Campaign Execution Endpoints
# ============================================================================

@router.post("/execute", response_model=CampaignExecutionResponse)
async def execute_campaign(
    payload: CampaignExecutionRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignExecutionResponse:
    """Execute a campaign: target audience and send messages.
    
    Set dry_run=true to preview targets without actually sending messages.
    """
    result = await CampaignExecutionService.execute_campaign(
        db=db,
        campaign_id=payload.campaign_id,
        dry_run=payload.dry_run,
    )
    
    return CampaignExecutionResponse(**result)


@router.post("/preview-targets", response_model=TargetAudiencePreviewResponse)
async def preview_target_audience(
    payload: TargetAudiencePreviewRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> TargetAudiencePreviewResponse:
    """Preview target audience for given criteria without executing campaign."""
    result = await CampaignExecutionService.get_campaign_targets_preview(
        db=db,
        target_criteria=payload.target_criteria,
        limit=payload.limit,
    )
    
    return TargetAudiencePreviewResponse(**result)


@router.post("/record-engagement", status_code=status.HTTP_204_NO_CONTENT)
async def record_user_engagement(
    payload: UserEngagementRecord,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> None:
    """Record user engagement with campaign message.
    
    Called when a user replies to a campaign message.
    """
    await CampaignExecutionService.record_user_engagement(
        db=db,
        campaign_id=payload.campaign_id,
        user_id=payload.user_id,
        engaged=payload.engaged,
    )


# ============================================================================
# Campaign Metrics Endpoints
# ============================================================================

@router.get("/{campaign_id}/metrics", response_model=CampaignMetricsList)
async def get_campaign_metrics(
    campaign_id: UUID,
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignMetricsList:
    """Get campaign performance metrics for a date range."""
    metrics = await CampaignService.get_campaign_metrics(
        db=db,
        campaign_id=campaign_id,
        start_date=start_date,
        end_date=end_date,
    )
    
    # Calculate totals
    total_sent = sum(m.messages_sent for m in metrics)
    total_targeted = sum(m.users_targeted for m in metrics)
    total_engaged = sum(m.users_engaged for m in metrics)
    
    avg_success = None
    if metrics:
        success_rates = [m.success_rate for m in metrics if m.success_rate is not None]
        if success_rates:
            avg_success = sum(success_rates) / len(success_rates)
    
    return CampaignMetricsList(
        campaign_id=campaign_id,
        metrics=[CampaignMetricsResponse.model_validate(m) for m in metrics],
        total_messages_sent=total_sent,
        total_users_targeted=total_targeted,
        total_users_engaged=total_engaged,
        average_success_rate=avg_success,
    )


# ============================================================================
# Campaign Execution History Endpoints
# ============================================================================

@router.get("/{campaign_id}/history", response_model=CampaignExecutionHistoryListResponse)
async def get_campaign_execution_history(
    campaign_id: UUID,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum records to return"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignExecutionHistoryListResponse:
    """Get execution history for a campaign.
    
    Returns a paginated list of all campaign executions with details:
    - When the campaign was executed
    - Who executed it
    - How many users were targeted
    - Success/failure metrics
    - The actual message content sent
    - List of targeted user IDs
    """
    from sqlalchemy import desc, select
    from app.models.campaign import SCACampaignExecution
    
    # Get total count
    count_query = select(SCACampaignExecution).where(SCACampaignExecution.campaign_id == campaign_id)
    result = await db.execute(count_query)
    total = len(result.scalars().all())
    
    # Get paginated results
    query = (
        select(SCACampaignExecution)
        .where(SCACampaignExecution.campaign_id == campaign_id)
        .order_by(desc(SCACampaignExecution.executed_at))
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    executions = result.scalars().all()
    
    return CampaignExecutionHistoryListResponse(
        items=[CampaignExecutionHistoryResponse.model_validate(e) for e in executions],
        total=total,
        skip=skip,
        limit=limit,
    )


# ============================================================================
# Campaign Trigger Endpoints
# ============================================================================

@router.post("/triggers", response_model=CampaignTriggerResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign_trigger(
    payload: CampaignTriggerCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CampaignTriggerResponse:
    """Create a new campaign trigger condition."""
    trigger = await TriggerEvaluator.create_trigger(
        db=db,
        campaign_id=payload.campaign_id,
        condition_type=payload.condition_type,
        condition_value=payload.condition_value,
        evaluation_frequency=payload.evaluation_frequency,
    )
    
    return CampaignTriggerResponse.model_validate(trigger)


@router.get("/{campaign_id}/triggers", response_model=list[CampaignTriggerResponse])
async def get_campaign_triggers(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> list[CampaignTriggerResponse]:
    """Get all triggers for a campaign."""
    triggers = await TriggerEvaluator.get_triggers_for_campaign(db, campaign_id)
    return [CampaignTriggerResponse.model_validate(t) for t in triggers]


@router.delete("/triggers/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign_trigger(
    trigger_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> None:
    """Delete a campaign trigger."""
    deleted = await TriggerEvaluator.delete_trigger(db, trigger_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trigger {trigger_id} not found"
        )


# ============================================================================
# AI-Powered Campaign Generation
# ============================================================================

@router.post("/generate-with-ai", response_model=dict, status_code=status.HTTP_200_OK)
async def generate_campaign_with_ai(
    campaign_name: str = Query(..., description="Campaign name/title"),
    campaign_description: str = Query(..., description="Campaign purpose and goals"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict:
    """Generate complete campaign configuration using AI.
    
    Provide only a campaign name and description, and Gemini AI will generate:
    - Target audience selection
    - Personalized message template with variables
    - Appropriate trigger rules
    - Priority level
    - Recommended schedule (if applicable)
    
    This is a preview endpoint - no campaign is created yet.
    Use the returned configuration to create the campaign via POST /campaigns.
    """
    from app.domains.mental_health.services.ai_campaign_generator import AICampaignGenerator
    
    # Initialize generator with client
    generator = AICampaignGenerator()
    config = await generator.generate_campaign_config(
        campaign_name=campaign_name,
        campaign_description=campaign_description
    )
    
    return {
        "campaign_name": campaign_name,
        "campaign_description": campaign_description,
        "generated_config": config,
        "message": "✨ AI-generated campaign configuration ready! Review and create campaign."
    }


@router.post("/generate-from-insights", response_model=dict, status_code=status.HTTP_200_OK)
async def generate_campaign_from_insights(
    insights_summary: str = Query(..., description="IA summary from dashboard"),
    trending_topics: Optional[str] = Query(None, description="Comma-separated trending topics"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict:
    """Generate campaign configuration based on Insight Agent analysis.
    
    Uses the IA summary and trending topics from the admin dashboard to automatically
    suggest a targeted campaign that addresses identified student concerns.
    
    The AI will analyze the insights to determine:
    - Which user groups are most affected
    - What intervention message would be most helpful
    - Appropriate timing and triggers
    - Priority level based on severity
    
    This is a preview endpoint - no campaign is created yet.
    Use the returned configuration to create the campaign via POST /campaigns.
    """
    from app.domains.mental_health.services.ai_campaign_generator import AICampaignGenerator
    
    # Generate campaign name based on insights
    campaign_name = f"Insights-Driven Campaign - {date.today().strftime('%Y-%m-%d')}"
    
    # Construct comprehensive description for AI
    description_parts = [f"Based on Insight Agent analysis: {insights_summary}"]
    if trending_topics:
        topics_list = trending_topics.split(',')
        description_parts.append(f"Key concerns: {', '.join(topics_list)}")
    description_parts.append("Create a supportive campaign to address these identified issues.")
    
    campaign_description = " ".join(description_parts)
    
    # Initialize generator with client
    generator = AICampaignGenerator()
    config = await generator.generate_campaign_config(
        campaign_name=campaign_name,
        campaign_description=campaign_description
    )
    
    return {
        "campaign_name": campaign_name,
        "campaign_description": campaign_description,
        "insights_summary": insights_summary,
        "trending_topics": trending_topics,
        "generated_config": config,
        "message": "✨ Campaign generated from Insight Agent analysis! Review and create."
    }
