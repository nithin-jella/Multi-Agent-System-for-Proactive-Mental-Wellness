"""User context tools for agent system.

Provides tools for retrieving user profile, preferences, mental health summaries,
and consent status. Essential for all agents to understand who they're supporting.

Tools:
- get_user_profile: Basic demographics and profile info
- update_user_profile: Update user profile information
- get_user_mental_health_summary: Mental health context (risk, diagnoses)
- get_user_preferences: Communication preferences
- get_user_consent_status: Check consent for specific operations
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User  # Core models
from app.domains.mental_health.models import Consent, ConsentScopeEnum, UserSummary

from .registry import register_tool

logger = logging.getLogger(__name__)


@register_tool(
    name="get_user_profile",
    description="""Get user's profile information including demographics, faculty, year of study.
Use when you need to understand who the user is for personalized support.
Does NOT include sensitive mental health data.""",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "integer",
                "description": "The user's ID (optional, defaults to current user if not provided)"
            }
        },
        "required": []
    },
    category="user",
    requires_db=True,
    requires_user_id=True
)
async def get_user_profile(
    db: AsyncSession,
    user_id: int,
    **kwargs
) -> Dict[str, Any]:
    """Get user profile information."""
    try:
        # If user_id is passed as string in kwargs (from tool call), convert it
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)
            
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return {
                "error": "User not found",
                "user_id": user_id
            }
        
        # Calculate age from date_of_birth
        age = None
        if user.date_of_birth:
            today = datetime.now().date()
            age = today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))

        return {
            "user_id": user.id,
            "email": user.email,
            "full_name": user.name or f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "age": age,
            "gender": user.gender,
            "faculty": user.major,  # Mapping major to faculty as it's the closest field
            "year_of_study": user.year_of_study,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "is_active": user.is_active,
        }
    except Exception as e:
        logger.error(f"Error fetching user profile for user {user_id}: {e}")
        return {
            "error": str(e),
            "user_id": user_id
        }


@register_tool(
    name="update_user_profile",
    description="""Update user's profile information.
Use this when the user explicitly asks to change their details (e.g., "panggil aku Budi", "aku sekarang semester 5").
Only update fields that are explicitly provided.""",
    parameters={
        "type": "object",
        "properties": {
            "full_name": {
                "type": "string",
                "description": "New full name or nickname"
            },
            "age": {
                "type": "integer",
                "description": "User's age"
            },
            "gender": {
                "type": "string",
                "enum": ["male", "female", "other"],
                "description": "User's gender"
            },
            "faculty": {
                "type": "string",
                "description": "User's faculty/department"
            },
            "year_of_study": {
                "type": "integer",
                "description": "Current year of study (1-7)"
            }
        },
        "required": []
    },
    category="user",
    requires_db=True,
    requires_user_id=True
)
async def update_user_profile(
    db: AsyncSession,
    user_id: int,
    full_name: Optional[str] = None,
    age: Optional[int] = None,
    gender: Optional[str] = None,
    faculty: Optional[str] = None,
    year_of_study: Optional[int] = None,
    **kwargs
) -> Dict[str, Any]:
    """Update user profile information."""
    try:
        # Build update dictionary
        updates = {}
        if full_name:
            updates["name"] = full_name
        # Age cannot be updated directly as it's calculated from DOB
        # if age:
        #     updates["age"] = age
        if gender:
            updates["gender"] = gender
        if faculty:
            updates["major"] = faculty
        if year_of_study:
            updates["year_of_study"] = str(year_of_study)  # Ensure string as per model
            
        if not updates:
            return {
                "status": "skipped",
                "message": "No changes provided"
            }
            
        # Execute update
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(**updates)
        )
        await db.commit()
        
        return {
            "status": "success",
            "message": "Profile updated successfully",
            "updated_fields": list(updates.keys())
        }
        
    except Exception as e:
        logger.error(f"Error updating user profile for user {user_id}: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@register_tool(
    name="get_user_mental_health_summary",
    description="""Get user's mental health summary including key concerns and current state.
SENSITIVE DATA - only use when necessary for safety assessment or intervention planning.
Check consent before using.""",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "integer",
                "description": "The user's ID (optional)"
            }
        },
        "required": []
    },
    category="user",
    requires_db=True,
    requires_user_id=True
)
async def get_user_mental_health_summary(
    db: AsyncSession,
    user_id: int,
    **kwargs
) -> Dict[str, Any]:
    """Get user's mental health summary."""
    try:
        result = await db.execute(
            select(UserSummary)
            .where(UserSummary.user_id == user_id)
            .order_by(UserSummary.created_at.desc())
            .limit(1)
        )
        summary = result.scalar_one_or_none()
        
        if not summary:
            return {
                "user_id": user_id,
                "has_summary": False,
                "message": "No mental health summary available"
            }
        
        return {
            "user_id": user_id,
            "has_summary": True,
            "summary_text": summary.summary_text,
            "key_concerns": summary.key_concerns or [],
            "created_at": summary.created_at.isoformat() if summary.created_at else None,
            "updated_at": summary.updated_at.isoformat() if summary.updated_at else None,
        }
    except Exception as e:
        logger.error(f"Error fetching mental health summary for user {user_id}: {e}")
        return {
            "error": str(e),
            "user_id": user_id
        }


@register_tool(
    name="get_user_preferences",
    description="""Get user's communication preferences including language, timezone,
and notification settings. Use for personalizing communication style.""",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "integer",
                "description": "The user's ID (optional)"
            }
        },
        "required": []
    },
    category="user",
    requires_db=True,
    requires_user_id=True
)
async def get_user_preferences(
    db: AsyncSession,
    user_id: int,
    **kwargs
) -> Dict[str, Any]:
    """Get user's communication preferences."""
    try:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return {
                "error": "User not found",
                "user_id": user_id
            }
        
        # Return basic preferences
        return {
            "user_id": user.id,
            "language": "id",  # Default to Indonesian
            "timezone": "Asia/Jakarta",  # Default for UGM
            "has_preferences": False,
            "message": "Using default preferences (preferences model not yet implemented)"
        }
    except Exception as e:
        logger.error(f"Error fetching preferences for user {user_id}: {e}")
        return {
            "error": str(e),
            "user_id": user_id
        }


@register_tool(
    name="get_user_consent_status",
    description="""Check if user has granted consent for a specific operation.
IMPORTANT: Always check before analytics, data sharing, or intervention tracking.
Valid scopes: analytics, data_sharing, intervention_tracking.""",
    parameters={
        "type": "object",
        "properties": {
            "scope": {
                "type": "string",
                "description": "Consent scope to check",
                "enum": ["analytics", "data_sharing", "intervention_tracking"]
            },
            "user_id": {
                "type": "integer",
                "description": "The user's ID (optional)"
            }
        },
        "required": ["scope"]
    },
    category="user",
    requires_db=True,
    requires_user_id=True
)
async def get_user_consent_status(
    db: AsyncSession,
    user_id: int,
    scope: str,
    **kwargs
) -> Dict[str, Any]:
    """Check user's consent status for a specific operation."""
    try:
        # Convert string to enum
        try:
            scope_enum = ConsentScopeEnum[scope.upper()]
        except KeyError:
            return {
                "error": f"Invalid consent scope: {scope}",
                "user_id": user_id,
                "valid_scopes": [s.name for s in ConsentScopeEnum]
            }
        
        result = await db.execute(
            select(Consent)
            .where(
                Consent.user_id == user_id,
                Consent.scope == scope_enum
            )
            .order_by(Consent.timestamp.desc())
            .limit(1)
        )
        consent = result.scalar_one_or_none()
        
        if not consent:
            return {
                "user_id": user_id,
                "scope": scope,
                "granted": False,
                "message": "No consent record found"
            }
        
        return {
            "user_id": user_id,
            "scope": scope,
            "granted": consent.granted,
            "timestamp": consent.timestamp.isoformat() if consent.timestamp else None,
            "withdrawn": consent.withdrawn,
            "withdrawn_at": consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
        }
    except Exception as e:
        logger.error(f"Error checking consent for user {user_id}, scope {scope}: {e}")
        return {
            "error": str(e),
            "user_id": user_id,
            "scope": scope
        }
