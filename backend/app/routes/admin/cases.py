"""Admin Case Management: comprehensive case CRUD, notes, assignments, and workflows.

Note: This file contains many type: ignore comments for SQLAlchemy ORM patterns.
Pylance sees Column[T] types but at runtime these are actual T values when accessing
attributes on ORM instances. This is expected behavior and safe.

# pyright: reportArgumentType=false, reportAttributeAccessIssue=false, reportGeneralTypeIssues=false
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import CaseAssignment  # Core infrastructure model
from app.domains.mental_health.models import Case, CaseNote, CaseStatusEnum, TriageAssessment, Conversation
from app.schemas.admin.cases import (
    CaseAssignmentSummary,
    CaseAssignmentUpdate,
    CaseDetailResponse,
    CaseListItem,
    CaseListResponse,
    CaseNoteCreate,
    CaseNoteItem,
    CaseNotesListResponse,
    CaseStatusUpdate,
    ConversationMessageSummary,
    TriageAssessmentSummary,
)
from app.domains.mental_health.services.agent_orchestrator import AgentOrchestrator
from app.services.event_bus import EventType, publish_event
from app.models.agent_user import AgentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["Admin - Cases"])


# Helper functions

def _calculate_sla_status(sla_breach_at: datetime | None) -> tuple[bool, int | None, str]:
    """Calculate SLA breach status and minutes until breach.
    
    Returns:
        (is_breached, minutes_until_breach, sla_status)
    """
    if not sla_breach_at:
        return False, None, 'safe'
    
    now = datetime.utcnow()
    is_breached = now >= sla_breach_at
    
    if is_breached:
        return True, None, 'breached'
    
    delta = sla_breach_at - now
    minutes_until = int(delta.total_seconds() / 60)
    
    # Status thresholds
    if minutes_until <= 15:
        sla_status = 'critical'
    elif minutes_until <= 60:
        sla_status = 'warning'
    else:
        sla_status = 'safe'
    
    return False, minutes_until, sla_status


def _to_note_item(row: CaseNote) -> CaseNoteItem:
    return CaseNoteItem(
        id=row.id,
        case_id=str(row.case_id),
        created_at=row.created_at,
        author_id=row.author_id,
        note=row.note,
    )


async def _get_case_or_404(db: AsyncSession, case_id: str) -> Case:
    try:
        uid = UUID(case_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid case_id") from exc

    result = await db.execute(select(Case).where(Case.id == uid))
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case


# === Case List and Management Endpoints ===

@router.get("", response_model=CaseListResponse)
async def list_cases(
    status: str | None = Query(None, description="Filter by status (new, in_progress, resolved, closed)"),
    severity: str | None = Query(None, description="Filter by severity (low, med, high, critical)"),
    assigned_to: str | None = Query(None, description="Filter by assignee"),
    unassigned: bool | None = Query(None, description="Show only unassigned cases"),
    sla_breached: bool | None = Query(None, description="Show only SLA breached cases"),
    search: str | None = Query(None, description="Search in user_hash or summary"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field (created_at, updated_at, severity, sla_breach_at)"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> CaseListResponse:
    """List all cases with comprehensive filtering, pagination, and sorting.
    
    **Admin only** - Requires admin role.
    
    Supports filtering by:
    - Status: new, in_progress, resolved, closed
    - Severity: low, med, high, critical
    - Assigned counselor
    - Unassigned cases
    - SLA breached cases
    - Text search in user_hash or summary
    
    Includes:
    - SLA breach status and countdown
    - Latest triage assessment
    - Related counts (notes, assignments)
    """
    try:
        # Build base query
        stmt = select(Case)
        
        # Apply filters
        if status:
            stmt = stmt.where(Case.status == status)
        
        if severity:
            stmt = stmt.where(Case.severity == severity)
        
        if assigned_to:
            stmt = stmt.where(Case.assigned_to == assigned_to)
        
        if unassigned is True:
            stmt = stmt.where(Case.assigned_to.is_(None))
        
        if sla_breached is True:
            stmt = stmt.where(Case.sla_breach_at < datetime.utcnow())
        
        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Case.user_hash.ilike(search_pattern),
                    Case.summary_redacted.ilike(search_pattern)
                )
            )
        
        # Count total (before pagination)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0
        
        # Apply sorting
        sort_column = getattr(Case, sort_by, Case.created_at)
        if sort_order == 'asc':
            stmt = stmt.order_by(sort_column.asc())
        else:
            stmt = stmt.order_by(sort_column.desc())
        
        # Apply pagination
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        
        # Execute query
        result = await db.execute(stmt)
        cases = result.scalars().all()
        
        # Build response with related data
        case_items = []
        for case in cases:
            # Calculate SLA status  
            # Note: SQLAlchemy ORM instances return actual values, not Column objects at runtime
            is_breached, minutes_until, sla_status = _calculate_sla_status(case.sla_breach_at)  # type: ignore[arg-type]
            
            # Get notes count
            notes_count_stmt = select(func.count()).where(CaseNote.case_id == case.id)
            notes_count = (await db.execute(notes_count_stmt)).scalar() or 0
            
            # Get assignments count
            assignments_count_stmt = select(func.count()).where(CaseAssignment.case_id == case.id)
            assignments_count = (await db.execute(assignments_count_stmt)).scalar() or 0
            
            # Get latest triage assessment
            # Note: Case has user_hash (string) and session_id, but TriageAssessment has user_id (integer)
            # We look up user_id via the Conversation table which links session_id to user_id
            latest_triage = None
            
            if case.session_id:  # type: ignore[truthy-bool]
                # Get user_id from conversations table
                user_stmt = (
                    select(Conversation.user_id)
                    .where(Conversation.session_id == case.session_id)
                    .limit(1)
                )
                user_result = await db.execute(user_stmt)
                user_id = user_result.scalar_one_or_none()
                
                if user_id:
                    triage_stmt = (
                        select(TriageAssessment)
                        .where(TriageAssessment.user_id == user_id)
                        .order_by(TriageAssessment.created_at.desc())
                        .limit(1)
                    )
                    triage_result = await db.execute(triage_stmt)
                    triage = triage_result.scalar_one_or_none()
                    
                    if triage:
                        latest_triage = TriageAssessmentSummary(  # type: ignore[call-arg]
                            id=triage.id,
                            risk_score=triage.risk_score,
                            severity_level=triage.severity_level,
                            confidence_score=triage.confidence_score,
                            risk_factors=triage.risk_factors,
                            created_at=triage.created_at
                        )
            
            # type: ignore comments explain: Pylance sees Column types but at runtime these are actual values
            case_items.append(CaseListItem(  # type: ignore[call-arg]
                id=str(case.id),
                status=str(case.status.value if hasattr(case.status, 'value') else case.status),
                severity=str(case.severity.value if hasattr(case.severity, 'value') else case.severity),
                user_hash=str(case.user_hash),
                session_id=case.session_id,
                conversation_id=int(case.conversation_id) if case.conversation_id else None,
                summary_redacted=str(case.summary_redacted) if case.summary_redacted else None,
                assigned_to=str(case.assigned_to) if case.assigned_to else None,
                created_at=case.created_at,
                updated_at=case.updated_at,
                sla_breach_at=case.sla_breach_at,
                is_sla_breached=is_breached,
                minutes_until_breach=minutes_until,
                sla_status=sla_status,
                notes_count=notes_count,
                assignments_count=assignments_count,
                latest_triage=latest_triage
            ))
        
        return CaseListResponse(
            cases=case_items,
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
            has_prev=page > 1
        )
    
    except Exception as e:
        logger.error(f"Failed to list cases: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,  # Use integer constant
            detail=f"Failed to retrieve cases: {str(e)}"
        )


@router.get("/{case_id}/notes", response_model=CaseNotesListResponse)
async def list_notes(
    case_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> CaseNotesListResponse:
    case = await _get_case_or_404(db, case_id)
    notes = (
        await db.execute(select(CaseNote).where(CaseNote.case_id == case.id).order_by(CaseNote.created_at.desc()))
    ).scalars().all()
    items = [_to_note_item(n) for n in notes]
    return CaseNotesListResponse(items=items)


@router.post("/{case_id}/notes", response_model=CaseNoteItem, status_code=status.HTTP_201_CREATED)
async def add_note(
    case_id: str,
    payload: CaseNoteCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> CaseNoteItem:
    await _get_case_or_404(db, case_id)

    note = CaseNote(case_id=UUID(case_id), note=payload.note, author_id=getattr(admin_user, "id", None))
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _to_note_item(note)


# === Detailed Case View ===

@router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case_detail(
    case_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> CaseDetailResponse:
    """Get comprehensive case details with all related data.
    
    **Admin only** - Requires admin role.
    
    Includes:
    - Full case information
    - All notes
    - Assignment history
    - All triage assessments
    - Conversation preview (if conversation_id exists)
    - SLA breach status
    """
    try:
        case = await _get_case_or_404(db, case_id)
        
        # Calculate SLA status
        is_breached, minutes_until, sla_status = _calculate_sla_status(case.sla_breach_at)  # type: ignore[arg-type]
        
        # Get notes
        notes_result = await db.execute(
            select(CaseNote)
            .where(CaseNote.case_id == case.id)
            .order_by(CaseNote.created_at.desc())
        )
        notes = [_to_note_item(n) for n in notes_result.scalars().all()]
        
        # Get assignment history
        assignments_result = await db.execute(
            select(CaseAssignment)
            .options(selectinload(CaseAssignment.assignee))
            .where(CaseAssignment.case_id == case.id)
            .order_by(CaseAssignment.assigned_at.desc())
        )
        assignments = [
            CaseAssignmentSummary(  # type: ignore[call-arg]
                id=str(a.id),
                assigned_to=a.assigned_to,
                assigned_by=a.assigned_by,
                assigned_at=a.assigned_at,
                previous_assignee=a.previous_assignee,
                reassignment_reason=a.reassignment_reason,
                assignee_role=a.assignee.role if a.assignee else None,
            )
            for a in assignments_result.scalars().all()
        ]
        
        # Get all triage assessments for this user
        triage_assessments = []
        if case.session_id:  # type: ignore[truthy-bool]
            # Query via Conversation table to get user_id (integer) from session_id (string)
            user_id_stmt = select(Conversation.user_id).where(Conversation.session_id == case.session_id).limit(1)
            user_id_result = await db.execute(user_id_stmt)
            user_id = user_id_result.scalar_one_or_none()
            
            if user_id:
                triage_result = await db.execute(
                    select(TriageAssessment)
                    .where(TriageAssessment.user_id == user_id)
                    .order_by(TriageAssessment.created_at.desc())
                )
                triage_assessments = [
                    TriageAssessmentSummary(
                        id=t.id,
                        risk_score=t.risk_score,
                        severity_level=t.severity_level,
                        confidence_score=t.confidence_score,
                        risk_factors=t.risk_factors,
                        created_at=t.created_at
                    )
                    for t in triage_result.scalars().all()
                ]
        
        # Get conversation preview if conversation_id exists
        conversation_preview = None
        if case.conversation_id:  # type: ignore[truthy-bool]
            try:
                # Get first 5 conversation pairs (10 messages total: user + assistant)
                conv_result = await db.execute(
                    select(Conversation)
                    .where(Conversation.conversation_id == case.conversation_id)
                    .order_by(Conversation.timestamp.asc())
                    .limit(5)  # First 5 message/response pairs
                )
                conversations = conv_result.scalars().all()
                
                # Convert to alternating user/assistant messages
                conversation_preview = []
                for conv in conversations:
                    # User message
                    conversation_preview.append(ConversationMessageSummary(
                        id=f"{conv.id}-user",
                        role="user",
                        content=conv.message,
                        timestamp=conv.timestamp
                    ))
                    # Assistant response
                    conversation_preview.append(ConversationMessageSummary(
                        id=f"{conv.id}-assistant",
                        role="assistant",
                        content=conv.response,
                        timestamp=conv.timestamp
                    ))
            except Exception as e:
                logger.warning(f"Failed to fetch conversation for case {case_id}: {e}")
        
        return CaseDetailResponse(  # type: ignore[call-arg]
            id=str(case.id),
            status=case.status.value,
            severity=case.severity.value,
            user_hash=case.user_hash,
            session_id=case.session_id,
            conversation_id=case.conversation_id,
            summary_redacted=case.summary_redacted,
            assigned_to=case.assigned_to,
            created_at=case.created_at,
            updated_at=case.updated_at,
            sla_breach_at=case.sla_breach_at,
            is_sla_breached=is_breached,
            minutes_until_breach=minutes_until,
            sla_status=sla_status,
            notes=notes,
            assignments=assignments,
            triage_assessments=triage_assessments,
            conversation_preview=conversation_preview
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get case detail {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve case details: {str(e)}"
        )


# === Case Status Workflow ===

@router.put("/{case_id}/status")
async def update_case_status(
    case_id: str,
    payload: CaseStatusUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Update case status with workflow validation.
    
    **Admin only** - Requires admin role.
    
    Valid status transitions:
    - new → in_progress → resolved → closed
    - Any status → closed (emergency closure)
    
    Emits CASE_STATUS_CHANGED event for monitoring.
    """
    try:
        case = await _get_case_or_404(db, case_id)
        
        # Validate status value
        valid_statuses = ['new', 'in_progress', 'resolved', 'closed']
        if payload.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        old_status = case.status.value
        
        # Validate workflow transitions (except emergency close)
        if payload.status != 'closed':
            valid_transitions = {
                'new': ['waiting', 'in_progress'],
                'waiting': ['in_progress'],
                'in_progress': ['resolved'],
                'resolved': ['closed'],
                'closed': []  # Cannot transition from closed
            }
            
            if case.status.value == 'closed':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change status of closed case"
                )
            
            if payload.status not in valid_transitions.get(case.status.value, []):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid transition from {case.status.value} to {payload.status}"
                )
        
        # Update status
        case.status = CaseStatusEnum[payload.status]  # type: ignore[assignment]
        
        # Add note if provided
        if payload.note:
            note = CaseNote(
                case_id=case.id,
                note=f"Status changed to {payload.status}: {payload.note}",
                author_id=getattr(admin_user, "id", None)
            )
            db.add(note)
        
        await db.commit()
        await db.refresh(case)
        
        # Emit event
        await publish_event(
            event_type=EventType.CASE_STATUS_CHANGED,
            source_agent='sda',
            data={
                'case_id': str(case.id),
                'old_status': old_status,
                'new_status': payload.status,
                'changed_by': getattr(admin_user, "id", None)
            }
        )
        
        logger.info(f"Case {case_id} status changed from {old_status} to {payload.status}")
        
        return {
            "case_id": str(case.id),
            "status": case.status.value,
            "message": f"Status updated to {payload.status}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update case status {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update case status: {str(e)}"
        )


# === Case Assignment ===

@router.put("/{case_id}/assign")
async def assign_case(
    case_id: str,
    payload: CaseAssignmentUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Assign or reassign case to a counselor.
    
    **Admin only** - Requires admin role.
    
    Creates audit record in case_assignments table.
    Emits CASE_ASSIGNED event for monitoring.
    """
    try:
        case = await _get_case_or_404(db, case_id)
        
        previous_assignee = case.assigned_to
        is_reassignment = previous_assignee is not None

        raw_assignee = (payload.assigned_to or "").strip()
        assignee_id: str | None
        if not raw_assignee or raw_assignee.lower() in {"unassigned", "none", "null"}:
            assignee_id = None
            assignee_model = None
        else:
            assignee_result = await db.execute(
                select(AgentUser).where(AgentUser.id == raw_assignee)
            )
            assignee_model = assignee_result.scalar_one_or_none()
            if assignee_model is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown assignee '{raw_assignee}'",
                )
            assignee_id: str | None = assignee_model.id  # type: ignore[assignment]

        # Update case assignment
        case.assigned_to = assignee_id

        # Create assignment audit record
        assignment = CaseAssignment(
            case_id=case.id,
            assigned_to=assignee_id,
            assigned_by=getattr(admin_user, "id", None),
            previous_assignee=previous_assignee,
            reassignment_reason=payload.reason if is_reassignment else None,
        )
        db.add(assignment)

        # Add note
        action = "reassigned" if is_reassignment else "assigned"
        if assignee_id is None:
            action = "unassigned" if is_reassignment else "set to unassigned"
        target_label = assignee_id or "Unassigned"
        note_text = f"Case {action} to {target_label}"
        if payload.reason:
            note_text += f": {payload.reason}"

        note = CaseNote(
            case_id=case.id,
            note=note_text,
            author_id=getattr(admin_user, "id", None)
        )
        db.add(note)

        await db.commit()
        await db.refresh(case)

        # Emit event
        await publish_event(
            event_type=EventType.CASE_ASSIGNED,
            source_agent='sda',
            data={
                'case_id': str(case.id),
                'assigned_to': assignee_id,
                'assigned_by': getattr(admin_user, "id", None),
                'is_reassignment': is_reassignment,
                'previous_assignee': previous_assignee
            }
        )

        logger.info(f"Case {case_id} assigned to {target_label}")

        return {
            "case_id": str(case.id),
            "assigned_to": case.assigned_to,
            "message": f"Case {action} successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to assign case {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign case: {str(e)}"
        )


# === Conversation Retrieval ===

@router.get("/{case_id}/conversation")
async def get_case_conversation(
    case_id: str,
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Retrieve the conversation that triggered this case.
    
    **Admin only** - Requires admin role.
    
    Returns the conversation messages with proper anonymization.
    """
    try:
        case = await _get_case_or_404(db, case_id)
        
        if not case.conversation_id:  # type: ignore[truthy-bool]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No conversation linked to this case"
            )
        
        # Get conversations (message/response pairs) for this conversation_id
        conv_result = await db.execute(
            select(Conversation)
            .where(Conversation.conversation_id == case.conversation_id)
            .order_by(Conversation.timestamp.asc())
            .limit(limit)
        )
        conversations = conv_result.scalars().all()
        
        if not conversations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        # Convert message/response pairs into alternating messages
        messages = []
        for conv in conversations:
            # User message
            messages.append({
                "id": f"{conv.id}-user",
                "role": "user",
                "content": conv.message,
                "timestamp": conv.timestamp.isoformat()
            })
            # Assistant response
            messages.append({
                "id": f"{conv.id}-assistant",
                "role": "assistant",
                "content": conv.response,
                "timestamp": conv.timestamp.isoformat()
            })
        
        return {
            "case_id": str(case.id),
            "conversation_id": case.conversation_id,
            "messages": messages,
            "total_messages": len(messages),
            "conversation_created_at": conversations[0].timestamp.isoformat() if conversations else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation for case {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve conversation: {str(e)}"
        )
