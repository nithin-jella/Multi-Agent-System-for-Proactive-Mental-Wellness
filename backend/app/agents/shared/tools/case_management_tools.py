"""
Case Management Tools - Clinical Case Coordination

This module provides tools for managing clinical cases, counselor coordination,
and case notes. Used primarily by CMA agent.

Tools:
- get_case_details: Get details of a specific case
- get_user_cases: Get all cases for a user

Privacy: Case data is HIGHLY SENSITIVE - clinical information.
"""

from typing import Dict, Any, Optional, List
import hashlib
from datetime import datetime
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models import (
    Case,
    CaseStatusEnum,
    CaseSeverityEnum
)
from app.agents.shared.tools.registry import register_tool

import logging

logger = logging.getLogger(__name__)

MAX_CASES = 20


def _to_user_hash_candidates(user_id: str) -> list[str]:
    raw = str(user_id).strip()
    if not raw:
        return []
    candidates = {raw, f"user_{raw}"}
    candidates.add(hashlib.sha256(f"user_{raw}".encode()).hexdigest()[:16])
    return list(candidates)


def _normalize_case_status(status: Optional[str]) -> Optional[CaseStatusEnum]:
    if not status:
        return None
    normalized = str(status).strip().lower()
    alias_map = {
        "open": "new",
        "new": "new",
        "in_progress": "in_progress",
        "waiting": "waiting",
        "resolved": "resolved",
        "closed": "closed",
    }
    mapped = alias_map.get(normalized)
    if not mapped:
        return None
    try:
        return CaseStatusEnum(mapped)
    except ValueError:
        return None


@register_tool(
    name="get_case_details",
    description="Get details of a specific clinical case including severity, status, and timeline. HIGHLY SENSITIVE.",
    parameters={
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "description": "Case ID"
            }
        },
        "required": ["case_id"]
    },
    category="case_management",
    requires_db=True,
    requires_user_id=False
)
async def get_case_details(
    db: AsyncSession,
    case_id: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Get details of a specific case.
    
    Returns case information, status, severity, and timeline.
    HIGHLY SENSITIVE - clinical case data.
    """
    try:
        # Get case
        query = select(Case).where(Case.id == case_id)
        result = await db.execute(query)
        case = result.scalar_one_or_none()
        
        if not case:
            logger.warning(f"⚠️ Case {case_id} not found")
            return {
                "success": False,
                "error": f"Case {case_id} not found",
                "case_id": case_id
            }
        
        logger.info(f"✅ Retrieved case details for {case_id}")
        
        return {
            "success": True,
            "case_id": case_id,
            "user_hash": str(case.user_hash),
            "session_id": case.session_id,
            "conversation_id": case.conversation_id,
            "severity": case.severity.value if isinstance(case.severity, CaseSeverityEnum) else str(case.severity),
            "status": case.status.value if isinstance(case.status, CaseStatusEnum) else str(case.status),
            "summary_redacted": case.summary_redacted,
            "assigned_to": str(case.assigned_to) if case.assigned_to else None,
            "sla_breach_at": case.sla_breach_at.isoformat() if case.sla_breach_at else None,
            "closure_reason": case.closure_reason,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "updated_at": case.updated_at.isoformat() if case.updated_at else None,
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting case details for {case_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "case_id": case_id
        }


@register_tool(
    name="get_user_cases",
    description="Get all cases for a user with optional status filter. Returns case history. HIGHLY SENSITIVE.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "User ID"
            },
            "status": {
                "type": "string",
                "description": "Optional status filter (new, in_progress, waiting, resolved, closed)",
                "enum": ["new", "in_progress", "waiting", "resolved", "closed"]
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of cases to return (default 20, max 20)",
                "default": 20
            }
        },
        "required": ["user_id"]
    },
    category="case_management",
    requires_db=True,
    requires_user_id=False
)
async def get_user_cases(
    db: AsyncSession,
    user_id: str,
    status: Optional[str] = None,
    limit: int = MAX_CASES,
    **kwargs
) -> Dict[str, Any]:
    """
    Get all cases for a user.
    
    Returns list of cases with optional status filter.
    HIGHLY SENSITIVE - clinical case history.
    """
    try:
        if limit > MAX_CASES:
            limit = MAX_CASES
        if limit < 1:
            limit = 1

        user_hash_candidates = _to_user_hash_candidates(user_id)
        if not user_hash_candidates:
            return {
                "success": False,
                "error": "Invalid user_id",
                "user_id": user_id,
            }
            
        # Query cases
        query = select(Case).where(Case.user_hash.in_(user_hash_candidates))
        if status:
            normalized_status = _normalize_case_status(status)
            if normalized_status is None:
                return {
                    "success": False,
                    "error": f"Invalid status filter: {status}",
                    "user_id": user_id,
                }
            query = query.where(Case.status == normalized_status)
        query = query.order_by(desc(Case.created_at)).limit(limit)
        
        result = await db.execute(query)
        cases = result.scalars().all()
        
        case_list = []
        for case in cases:
            updated_at_value = None
            if case.updated_at is not None:
                updated_at_value = case.updated_at.isoformat()
                
            case_list.append({
                "case_id": str(case.id),
                "severity": case.severity.value if isinstance(case.severity, CaseSeverityEnum) else str(case.severity),
                "status": case.status.value if isinstance(case.status, CaseStatusEnum) else str(case.status),
                "summary_redacted": case.summary_redacted,
                "assigned_to": str(case.assigned_to) if case.assigned_to else None,
                "session_id": case.session_id,
                "conversation_id": case.conversation_id,
                "created_at": case.created_at.isoformat() if case.created_at else None,
                "updated_at": updated_at_value
            })
        
        logger.info(f"✅ Retrieved {len(case_list)} cases for user {user_id}")
        
        return {
            "success": True,
            "user_id": user_id,
            "status_filter": status,
            "total_cases": len(case_list),
            "cases": case_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting cases for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id
        }
