from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models.interventions import CampaignExecution, InterventionCampaign
from app.models.user import User
from app.domains.mental_health.models.assessments import UserScreeningProfile
from app.utils.email_utils import send_email
from app.services.user_normalization import display_name as display_name_for_user

CHECKIN_CAMPAIGN_TYPE = "proactive_checkin_email"
CHECKIN_DELIVERY_METHOD = "email"


def _parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "t", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "f", "no", "n", "off"}:
        return False
    return default


def build_checkin_message(
    *,
    user_name: str,
    primary_concerns: list[str],
    risk_level: str,
    app_url: str,
) -> tuple[str, str]:
    """Generate a check-in email subject + HTML body.

    This template is intended for production outreach, so it should remain conservative
    and avoid clinical claims. It should also avoid embedding raw conversation text.
    """

    concern_map = {
        "depression": "mood",
        "anxiety": "anxiety",
        "stress": "stress",
        "sleep": "sleep",
        "social": "social support",
        "academic": "academic pressure",
    }

    mapped = [concern_map.get(c, c) for c in (primary_concerns or [])]

    if risk_level in {"critical", "severe"}:
        subject = f"Checking in with you, {user_name}"
        intro = "We noticed you might be going through a difficult period."
    elif risk_level == "moderate":
        subject = f"A gentle check-in, {user_name}"
        intro = "Just checking in and offering support if you need it."
    else:
        subject = f"Hi {user_name}, how are you doing lately?"
        intro = "A short check-in from Aika."

    if mapped:
        focus_line = f"If things related to {', '.join(mapped[:2])} have been heavy lately, you don’t have to handle it alone."
    else:
        focus_line = "If things have been heavy lately, you don’t have to handle it alone."

    html_body = f"""
    <html>
    <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">
        <p>Hi {user_name},</p>
        <p>{intro}</p>
        <p>{focus_line}</p>
        <p>
            You can talk to Aika anytime to get coping ideas, resources, or help finding the right next step.
        </p>
        <p style=\"margin-top: 24px;\">
            <a href=\"{app_url}/aika\" style=\"background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;\">
                Chat with Aika
            </a>
        </p>
        <hr style=\"margin-top: 32px; border: none; border-top: 1px solid #eee;\">
        <p style=\"font-size: 12px; color: #999; margin-top: 16px;\">
            You received this email because check-ins are enabled. You can disable them in
            <a href=\"{app_url}/settings\" style=\"color: #666;\">settings</a>.
        </p>
    </body>
    </html>
    """

    return subject, html_body


async def get_or_create_checkin_campaign(db: AsyncSession) -> InterventionCampaign:
    stmt = (
        select(InterventionCampaign)
        .where(InterventionCampaign.campaign_type == CHECKIN_CAMPAIGN_TYPE)
        .order_by(InterventionCampaign.updated_at.desc())
        .limit(1)
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        return existing

    now = datetime.utcnow()
    campaign = InterventionCampaign(
        campaign_type=CHECKIN_CAMPAIGN_TYPE,
        title="Proactive check-in emails",
        description="System-generated check-in emails queued for human review.",
        content={},
        target_criteria=None,
        target_audience_size=0,
        priority="medium",
        status="active",
        start_date=now,
        end_date=None,
        executions_delivered=0,
        executions_failed=0,
        created_at=now,
        updated_at=now,
    )
    db.add(campaign)
    await db.flush()
    return campaign


async def queue_checkin_execution(
    *,
    db: AsyncSession,
    user: User,
    screening_profile: UserScreeningProfile | None,
    now: datetime,
    app_url: str,
    risk_level: str,
    primary_concerns: list[str],
) -> CampaignExecution:
    campaign = await get_or_create_checkin_campaign(db)

    subject, _ = build_checkin_message(
        user_name=display_name_for_user(user),
        primary_concerns=primary_concerns,
        risk_level=risk_level,
        app_url=app_url,
    )

    trigger_data: dict[str, Any] = {
        "type": CHECKIN_CAMPAIGN_TYPE,
        "risk_level": risk_level,
        "primary_concerns": primary_concerns,
        "app_url": app_url,
        "subject_preview": subject,
        "template_version": "v1",
    }

    execution = CampaignExecution(
        campaign_id=campaign.id,
        user_id=user.id,
        status="pending_review",
        scheduled_at=now,
        executed_at=None,
        delivery_method=CHECKIN_DELIVERY_METHOD,
        error_message=None,
        engagement_score=None,
        trigger_data=trigger_data,
        notes="Queued proactive check-in for human review",
        is_manual=False,
        created_at=now,
        updated_at=now,
    )
    db.add(execution)
    await db.flush()
    return execution


async def send_checkin_execution(
    *,
    db: AsyncSession,
    execution: CampaignExecution,
    now: datetime,
) -> None:
    user = (await db.execute(select(User).where(User.id == execution.user_id))).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    if not user.email:
        raise ValueError("User has no email")

    trigger = execution.trigger_data or {}
    app_url = str(trigger.get("app_url") or "")
    risk_level = str(trigger.get("risk_level") or "none")
    primary_concerns = trigger.get("primary_concerns")
    if not isinstance(primary_concerns, list):
        primary_concerns = []

    user_name = display_name_for_user(user)
    subject, html_body = build_checkin_message(
        user_name=user_name,
        primary_concerns=[str(x) for x in primary_concerns],
        risk_level=risk_level,
        app_url=app_url,
    )

    send_email(recipient_email=user.email, subject=subject, html_content=html_body)

    execution.status = "completed"
    execution.executed_at = now
    execution.updated_at = now

    user.last_checkin_sent_at = now
    user.checkin_count = (user.checkin_count or 0) + 1


def proactive_checkins_require_review(env_value: Optional[str]) -> bool:
    return _parse_bool(env_value, default=True)
