"""
Safety Tools - Risk Assessment and Crisis Management

This module provides tools for monitoring user safety, tracking risk levels,
and accessing crisis intervention resources. Used primarily by STA and TCA agents.

Tools:
- get_risk_assessment_history: Get user's past risk assessments from STA
- get_active_safety_cases: Get open crisis cases for user
- get_crisis_resources: Get emergency hotlines and resources
- check_risk_level: Get current risk status
- get_escalation_protocol: Get action steps for risk level

Privacy: All risk data is HIGHLY SENSITIVE and requires consent.
"""

from typing import Dict, Any, Optional, List
import hashlib
from datetime import datetime, timedelta
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User  # Core model
from app.domains.mental_health.models import (
    TriageAssessment,
    Case,
    CaseStatusEnum,
    CaseSeverityEnum,
    ContentResource,
)
from app.agents.shared.tools.registry import register_tool

import logging

logger = logging.getLogger(__name__)

# Constants
MAX_ASSESSMENTS = 10
MAX_CASES = 5
MAX_RESOURCES = 10


def _coerce_user_id_int(user_id: str) -> Optional[int]:
    try:
        return int(str(user_id).strip())
    except (TypeError, ValueError):
        return None


def _to_user_hash_candidates(user_id: str) -> list[str]:
    raw = str(user_id).strip()
    if not raw:
        return []
    candidates = {raw, f"user_{raw}"}
    candidates.add(hashlib.sha256(f"user_{raw}".encode()).hexdigest()[:16])
    return list(candidates)


@register_tool(
    name="get_risk_assessment_history",
    description="Get user's risk assessment history from Safety Triage Agent. Returns recent risk classifications and concerns. SENSITIVE DATA.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "User ID to get risk history for"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of assessments to return (default 10, max 10)",
                "default": 10
            }
        },
        "required": ["user_id"]
    },
    category="safety",
    requires_db=True,
    requires_user_id=False
)
async def get_risk_assessment_history(
    db: AsyncSession,
    user_id: str,
    limit: int = MAX_ASSESSMENTS,
    **kwargs
) -> Dict[str, Any]:
    """
    Get user's risk assessment history from Safety Triage Agent.
    
    Returns recent risk classifications, concerns detected, and timestamps.
    SENSITIVE DATA - requires consent check.
    """
    try:
        normalized_user_id = _coerce_user_id_int(user_id)
        if normalized_user_id is None:
            return {
                "success": False,
                "error": "Invalid user_id",
                "user_id": user_id,
            }

        if limit > MAX_ASSESSMENTS:
            limit = MAX_ASSESSMENTS
            
        # Query recent assessments
        query = (
            select(TriageAssessment)
            .where(TriageAssessment.user_id == normalized_user_id)
            .order_by(desc(TriageAssessment.created_at))
            .limit(limit)
        )
        
        result = await db.execute(query)
        assessments = result.scalars().all()
        
        assessment_list = []
        for assessment in assessments:
            assessment_list.append({
                "assessment_id": str(assessment.id),
                "conversation_id": str(assessment.conversation_id) if assessment.conversation_id else None,
                "risk_score": assessment.risk_score,
                "confidence_score": assessment.confidence_score,
                "severity_level": assessment.severity_level,
                "risk_factors": assessment.risk_factors or [],
                "recommended_action": assessment.recommended_action,
                "created_at": assessment.created_at.isoformat(),
            })
            
        logger.info(f"✅ Retrieved {len(assessment_list)} risk assessments for user {user_id}")
        
        return {
            "success": True,
            "user_id": user_id,
            "total_assessments": len(assessment_list),
            "assessments": assessment_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting risk assessment history for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id
        }


@register_tool(
    name="get_active_safety_cases",
    description="Get user's active crisis cases managed by Case Management Agent. Returns open cases requiring follow-up. HIGHLY SENSITIVE.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "User ID to get active cases for"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of cases to return (default 5, max 5)",
                "default": 5
            }
        },
        "required": ["user_id"]
    },
    category="safety",
    requires_db=True,
    requires_user_id=False
)
async def get_active_safety_cases(
    db: AsyncSession,
    user_id: str,
    limit: int = MAX_CASES,
    **kwargs
) -> Dict[str, Any]:
    """
    Get user's active crisis cases managed by Case Management Agent.
    
    Returns open cases requiring follow-up or intervention.
    HIGHLY SENSITIVE - safety-critical data.
    """
    try:
        if limit > MAX_CASES:
            limit = MAX_CASES
            
        user_hash_candidates = _to_user_hash_candidates(user_id)
        if not user_hash_candidates:
            return {
                "success": False,
                "error": "Invalid user_id",
                "user_id": user_id,
            }

        # Query active cases for user-hash variants
        query = (
            select(Case)
            .where(
                and_(
                    Case.user_hash.in_(user_hash_candidates),
                    Case.status.in_([CaseStatusEnum.new, CaseStatusEnum.in_progress, CaseStatusEnum.waiting])
                )
            )
            .order_by(desc(Case.created_at))
            .limit(limit)
        )
        
        result = await db.execute(query)
        cases = result.scalars().all()
        
        case_list = []
        for case in cases:
            # Safe datetime checks
            updated_at_str = None
            if case.updated_at is not None:
                updated_at_str = case.updated_at.isoformat()
                
            case_list.append({
                "case_id": str(case.id),
                "severity": case.severity.value if isinstance(case.severity, CaseSeverityEnum) else str(case.severity),
                "status": case.status.value if isinstance(case.status, CaseStatusEnum) else str(case.status),
                "summary_redacted": case.summary_redacted,
                "assigned_to": str(case.assigned_to) if case.assigned_to else None,
                "session_id": case.session_id,
                "conversation_id": case.conversation_id,
                "created_at": case.created_at.isoformat(),
                "updated_at": updated_at_str,
            })
            
        logger.info(f"✅ Retrieved {len(case_list)} active safety cases for user {user_id}")
        
        return {
            "success": True,
            "user_id": user_id,
            "total_cases": len(case_list),
            "cases": case_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting active safety cases for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id
        }


@register_tool(
    name="get_crisis_resources",
    description="Get emergency mental health resources like hotlines and clinics. Returns PUBLIC safety resources for immediate help.",
    parameters={
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "Geographic location for resources (default 'Indonesia')",
                "default": "Indonesia"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of resources to return (default 10, max 10)",
                "default": 10
            }
        },
        "required": []
    },
    category="safety",
    requires_db=True,
    requires_user_id=False
)
async def get_crisis_resources(
    db: AsyncSession,
    location: str = "Indonesia",
    limit: int = MAX_RESOURCES,
    **kwargs
) -> Dict[str, Any]:
    """
    Get emergency mental health resources (hotlines, clinics).
    
    Returns crisis hotlines and professional resources for immediate help.
    This is PUBLIC DATA for safety.
    """
    try:
        if limit > MAX_RESOURCES:
            limit = MAX_RESOURCES
            
        # Query crisis resources filtered by location
        # Note: Using string literal since ResourceTypeEnum not available
        query = (
            select(ContentResource)
            .where(
                and_(
                    ContentResource.resource_type == "crisis_hotline",  # Use string instead of enum
                    ContentResource.metadata.contains({"location": location})
                )
            )
            .limit(limit)
        )
        
        result = await db.execute(query)
        resources = result.scalars().all()
        
        resource_list = []
        for resource in resources:
            resource_list.append({
                "resource_id": str(resource.id),
                "title": resource.title,
                "description": resource.description,
                "content": resource.content,  # Hotline numbers, clinic addresses
                "url": resource.url,
                "resource_type": resource.resource_type,
                "metadata": resource.metadata,
            })
            
        logger.info(f"✅ Retrieved {len(resource_list)} crisis resources for {location}")
        
        return {
            "success": True,
            "location": location,
            "total_resources": len(resource_list),
            "resources": resource_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting crisis resources for {location}: {e}")
        return {
            "success": False,
            "error": str(e),
            "location": location
        }


@register_tool(
    name="check_risk_level",
    description="Get user's current risk level from most recent assessment. Returns latest risk classification. SENSITIVE DATA.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "User ID to check risk level for"
            }
        },
        "required": ["user_id"]
    },
    category="safety",
    requires_db=True,
    requires_user_id=False
)
async def check_risk_level(
    db: AsyncSession,
    user_id: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Get user's current risk level from most recent assessment.
    
    Returns latest risk classification and whether intervention is needed.
    SENSITIVE DATA - safety monitoring.
    """
    try:
        normalized_user_id = _coerce_user_id_int(user_id)
        if normalized_user_id is None:
            return {
                "success": False,
                "error": "Invalid user_id",
                "user_id": user_id,
            }

        # Get most recent assessment
        query = (
            select(TriageAssessment)
            .where(TriageAssessment.user_id == normalized_user_id)
            .order_by(desc(TriageAssessment.created_at))
            .limit(1)
        )
        
        result = await db.execute(query)
        latest_assessment = result.scalar_one_or_none()
        
        if not latest_assessment:
            logger.info(f"ℹ️ No risk assessments found for user {user_id}")
            return {
                "success": True,
                "user_id": user_id,
                "has_assessment": False,
                "risk_level": None,
                "message": "No risk assessments available"
            }
        
        # Check how recent the assessment is
        age_hours = (datetime.utcnow() - latest_assessment.created_at).total_seconds() / 3600
        is_recent = age_hours < 24  # Consider recent if within 24 hours
        
        logger.info(f"✅ Current risk level for user {user_id}: {latest_assessment.severity_level}")
        
        return {
            "success": True,
            "user_id": user_id,
            "has_assessment": True,
            "risk_score": latest_assessment.risk_score,
            "confidence_score": latest_assessment.confidence_score,
            "severity_level": latest_assessment.severity_level,
            "risk_factors": latest_assessment.risk_factors or [],
            "recommended_action": latest_assessment.recommended_action,
            "assessment_age_hours": round(age_hours, 1),
            "is_recent": is_recent,
            "assessed_at": latest_assessment.created_at.isoformat(),
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking risk level for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id
        }


@register_tool(
    name="get_escalation_protocol",
    description="Get recommended actions for a given risk level. Returns escalation steps and timelines. PROTOCOL DATA.",
    parameters={
        "type": "object",
        "properties": {
            "risk_level": {
                "type": "string",
                "description": "Risk level to get protocol for (LOW, MODERATE, HIGH, CRITICAL)",
                "enum": ["LOW", "MODERATE", "HIGH", "CRITICAL"]
            }
        },
        "required": ["risk_level"]
    },
    category="safety",
    requires_db=True,
    requires_user_id=False
)
async def get_escalation_protocol(
    db: AsyncSession,
    risk_level: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Get recommended actions for a given risk level.
    
    Returns escalation steps, timelines, and who should be involved.
    This is PROTOCOL DATA for safety decision-making.
    """
    try:
        # Define escalation protocols (could be from database in future)
        protocols = {
            "LOW": {
                "risk_level": "LOW",
                "description": "User shows no significant risk indicators",
                "actions": [
                    "Continue normal supportive conversation",
                    "Monitor for changes in mood or behavior",
                    "Encourage healthy coping strategies"
                ],
                "response_time": "No immediate action required",
                "escalate_to": None,
                "resources_needed": ["General mental health tips", "Self-care guides"]
            },
            "MODERATE": {
                "risk_level": "MODERATE",
                "description": "User shows some concerning patterns",
                "actions": [
                    "Provide targeted coping strategies",
                    "Suggest professional consultation",
                    "Check in more frequently",
                    "Monitor for escalation to HIGH risk"
                ],
                "response_time": "Within 24 hours",
                "escalate_to": "Therapeutic Coach Agent (TCA)",
                "resources_needed": ["CBT exercises", "Professional referral list"]
            },
            "HIGH": {
                "risk_level": "HIGH",
                "description": "User shows significant risk indicators",
                "actions": [
                    "Immediately create safety case (CMA)",
                    "Provide crisis resources",
                    "Strongly recommend professional help",
                    "Notify counselor if consent given",
                    "Daily check-ins required"
                ],
                "response_time": "Within 2 hours",
                "escalate_to": "Case Management Agent (CMA)",
                "resources_needed": ["Crisis hotlines", "Emergency contacts", "Counseling services"]
            },
            "CRITICAL": {
                "risk_level": "CRITICAL",
                "description": "User shows immediate danger signs",
                "actions": [
                    "IMMEDIATE escalation to human counselor",
                    "Create urgent safety case (CMA)",
                    "Provide emergency hotline numbers",
                    "Consider emergency contact notification",
                    "Continuous monitoring required"
                ],
                "response_time": "IMMEDIATE (within 30 minutes)",
                "escalate_to": "Emergency Response Team",
                "resources_needed": [
                    "Emergency hotlines (119, suicide prevention)",
                    "Campus security contact",
                    "Hospital emergency numbers"
                ]
            }
        }
        
        protocol = protocols.get(risk_level.upper())
        
        if not protocol:
            logger.warning(f"⚠️ Unknown risk level requested: {risk_level}")
            return {
                "success": False,
                "error": f"Unknown risk level: {risk_level}",
                "valid_levels": list(protocols.keys())
            }
        
        logger.info(f"✅ Retrieved escalation protocol for risk level: {risk_level}")
        
        return {
            "success": True,
            "protocol": protocol
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting escalation protocol for {risk_level}: {e}")
        return {
            "success": False,
            "error": str(e),
            "risk_level": risk_level
        }
