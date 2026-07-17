from __future__ import annotations

import logging
from datetime import datetime, timedelta
import json

from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables import RunnableConfig
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai import types

from app.models.user import User as AppUser

from app.agents.graph_state import CMAState
from app.agents.execution_tracker import execution_tracker
from app.core.settings import get_settings
from app.core.llm import get_gemini_client, GEMINI_FLASH_MODEL
from app.domains.mental_health.models import Case, CaseSeverityEnum, CaseStatusEnum
from app.domains.mental_health.models.appointments import Psychologist, Appointment
from app.models.system import CaseAssignment
from app.services.event_bus import EventType, publish_event
from app.core.langfuse_config import trace_agent

logger = logging.getLogger(__name__)
settings = get_settings()


@trace_agent("CMA_Ingest")
async def ingest_escalation_node(state: CMAState) -> CMAState:
    """Node: Ingest escalation signal from STA.
    
    Validates that this is a high/critical severity case requiring
    CMA intervention.
    
    Args:
        state: Current graph state with STA outputs
        
    Returns:
        Updated state with execution_path appended
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "cma::ingest_escalation", "cma")
    
    # Validate this should be escalated
    severity = state.get("sta_context", {}).get("severity", "low")
    if severity not in ("high", "critical"):
        errors = state.get("errors", [])
        errors.append(
            f"CMA should only handle high/critical cases, got severity={severity}"
        )
        state["errors"] = errors
        if execution_id:
            execution_tracker.fail_node(
                execution_id, 
                "cma::ingest_escalation", 
                f"Invalid severity: {severity}"
            )
        return state
    
    execution_path = state.get("execution_path", [])
    execution_path.append("ingest_escalation")
    state["execution_path"] = execution_path
    
    if execution_id:
        execution_tracker.complete_node(execution_id, "cma::ingest_escalation")
    
    logger.info(
        f"CMA ingested escalation: severity={severity}, "
        f"user_hash={state.get('user_hash')}"
    )
    return state


@trace_agent("CMA_CreateCase")
async def create_case_node(state: CMAState, config: RunnableConfig) -> CMAState:
    """Node: Create case record for manual intervention.
    
    Creates Case in database with appropriate severity and metadata.
    
    Args:
        state: Current graph state
        config: LangGraph runtime config carrying ``db`` under ``config["configurable"]["db"]``
        
    Returns:
        Updated state with case_id and case_created=True
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "cma::create_case", "cma")
    
    try:
        # Map severity to CaseSeverityEnum
        severity_map = {
            "low": CaseSeverityEnum.low,
            "moderate": CaseSeverityEnum.med,
            "high": CaseSeverityEnum.high,
            "critical": CaseSeverityEnum.critical
        }
        case_severity = severity_map.get(
            state.get("sta_context", {}).get("severity", "high").lower(),
            CaseSeverityEnum.high
        )
        
        # Generate case summary
        risk_score = state.get("sta_context", {}).get("risk_score", 0.0)
        intent = state.get("sta_context", {}).get("intent", "unknown")
        summary_redacted = (
            f"Risk score: {risk_score:.2f}, Intent: {intent}, "
            f"Severity: {state.get("sta_context", {}).get("severity", 'unknown')}"
        )
        
        # Create case
        case = Case(
            status=CaseStatusEnum.new,
            severity=case_severity,
            user_hash=state.get("user_hash", ""),
            session_id=state.get("session_id", ""),
            conversation_id=state.get("conversation_id"),
            summary_redacted=summary_redacted,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.add(case)
        await db.flush()  # Get case.id
        await db.refresh(case)  # Ensure id is loaded
        
        state.setdefault("cma_context", {})["case_id"] = str(case.id)  # Cast UUID to string for state
        state.setdefault("cma_context", {})["case_severity"] = case_severity.value
        state.setdefault("cma_context", {})["case_created"] = True
        execution_path = state.get("execution_path", [])
        execution_path.append("create_case")
        state["execution_path"] = execution_path
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "cma::create_case",
                metrics={
                    "case_id": str(case.id),
                    "severity": case_severity.value
                }
            )
        
        logger.info(f"CMA created case: ID={case.id}, severity={case_severity.value}")
        
    except Exception as e:
        error_msg = f"Case creation failed: {str(e)}"
        errors = state.get("errors", [])
        errors.append(error_msg)
        state["errors"] = errors
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "cma::create_case", str(e))
    
    return state


@trace_agent("CMA_CalculateSLA")
async def calculate_sla_node(state: CMAState, config: RunnableConfig) -> CMAState:
    """Node: Calculate SLA breach time based on severity.
    
    Critical cases: 30 minutes (default from settings)
    High cases: 60 minutes
    
    Args:
        state: Current graph state
        config: LangGraph runtime config carrying ``db`` under ``config["configurable"]["db"]``
        
    Returns:
        Updated state with sla_breach_at timestamp
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "cma::calculate_sla", "cma")
    
    try:
        if not state.get("cma_context", {}).get("case_id"):
            raise ValueError("No case_id found")
        
        severity = state.get("cma_context", {}).get("case_severity", "high")
        
        # Calculate SLA based on severity
        if severity == "critical":
            sla_minutes = settings.sda_sla_minutes  # From settings (default 30)
        else:
            sla_minutes = 60  # 1 hour for high severity
        
        sla_breach_at = datetime.now() + timedelta(minutes=sla_minutes)
        
        # Update case in DB
        case_id = state.get("cma_context", {}).get("case_id")
        if case_id:
            case = await db.get(Case, case_id)
            if case:
                case.sla_breach_at = sla_breach_at  # type: ignore[assignment]
                case.updated_at = datetime.now()  # type: ignore[assignment]
                db.add(case)
                await db.flush()
        
        state.setdefault("cma_context", {})["sla_breach_at"] = sla_breach_at.isoformat()
        execution_path = state.get("execution_path", [])
        execution_path.append("calculate_sla")
        state["execution_path"] = execution_path
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "cma::calculate_sla",
                metrics={"sla_minutes": sla_minutes}
            )
        
        logger.info(f"CMA calculated SLA: breach at {sla_breach_at} ({sla_minutes} min)")
        
    except Exception as e:
        error_msg = f"SLA calculation failed: {str(e)}"
        errors = state.get("errors", [])
        errors.append(error_msg)
        state["errors"] = errors
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "cma::calculate_sla", str(e))
    
    return state


@trace_agent("CMA_AutoAssign")
async def auto_assign_node(state: CMAState, config: RunnableConfig) -> CMAState:
    """Node: Auto-assign case to available counsellor with workload balancing.
    
    Assignment algorithm:
    1. Query all counsellors (role='counselor')
    2. Count active cases per counsellor (status in new/in_progress/waiting)
    3. Assign to counsellor with lowest workload
    4. Create CaseAssignment record for audit trail
    5. Update Case.assigned_to and status to 'in_progress'
    
    If no counsellors available, case remains in 'new' status for manual assignment.
    
    Args:
        state: Current graph state with case_id
        config: LangGraph runtime config carrying ``db`` under ``config["configurable"]["db"]``
        
    Returns:
        Updated state with assigned_to (if successful) and assignment_id
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "cma::auto_assign", "cma")
    
    try:
        case_id = state.get("cma_context", {}).get("case_id")
        if not case_id:
            raise ValueError("No case_id found for assignment")
        
        # Step 1: Query all available counsellors from psychologists table.
        # Guard: only include profiles whose linked User account is active with
        # a counselor or admin role. Profiles without a linked user_id are kept
        # to support legacy/standalone records — they should be rare in production.
        counsellors_stmt = (
            select(Psychologist)
            .join(AppUser, AppUser.id == Psychologist.user_id, isouter=True)
            .where(
                Psychologist.is_available == True,  # noqa: E712
                or_(
                    Psychologist.user_id.is_(None),
                    AppUser.role.in_(["counselor", "admin"]),
                ),
            )
        )
        counsellors_result = await db.execute(counsellors_stmt)
        counsellors = counsellors_result.scalars().all()
        
        if not counsellors:
            logger.warning("No counsellors available for auto-assignment")
            execution_path = state.get("execution_path", [])
            execution_path.append("auto_assign")
            state["execution_path"] = execution_path
            state.setdefault("cma_context", {})["assigned_to"] = None
            state.setdefault("cma_context", {})["assignment_reason"] = "no_counsellors_available"
            
            if execution_id:
                execution_tracker.complete_node(
                    execution_id, 
                    "cma::auto_assign",
                    metrics={
                        "assigned": False,
                        "reason": "no_counsellors_available"
                    }
                )
            return state
        
        # Step 2: Count active cases per counsellor
        # Active cases = status in (new, in_progress, waiting)
        active_statuses = [
            CaseStatusEnum.new,
            CaseStatusEnum.in_progress,
            CaseStatusEnum.waiting
        ]
        
        counsellor_workload = {}
        for counsellor in counsellors:
            # Convert psychologist.id to string for comparison with Case.assigned_to (String field)
            counsellor_id_str = str(counsellor.id)
            workload_stmt = select(func.count(Case.id)).where(
                Case.assigned_to == counsellor_id_str,
                Case.status.in_(active_statuses)
            )
            workload_result = await db.execute(workload_stmt)
            workload_count = workload_result.scalar_one()
            counsellor_workload[counsellor.id] = workload_count
        
        # Step 3: Select counsellor with lowest workload
        # If tie, pick the first one (could be randomized or round-robin in future)
        assigned_counsellor_id = min(
            counsellor_workload.keys(),
            key=lambda cid: counsellor_workload[cid]
        )
        assigned_workload = counsellor_workload[assigned_counsellor_id]
        
        # Convert to string for storage (Case.assigned_to is String type)
        assigned_counsellor_id_str = str(assigned_counsellor_id)
        
        # Step 4-5: Create CaseAssignment + update Case inside a savepoint.
        # This prevents a single FK issue from poisoning the whole request session.
        async with db.begin_nested():
            # Ensure corresponding agent_users row exists.
            # Case.assigned_to references agent_users.id, but we store psychologist.id as str.
            from app.models.agent_user import AgentUser, AgentRoleEnum

            agent_user = await db.get(AgentUser, assigned_counsellor_id_str)
            if agent_user is None:
                db.add(AgentUser(id=assigned_counsellor_id_str, role=AgentRoleEnum.counselor))
                await db.flush()

            assignment = CaseAssignment(
                case_id=case_id,
                assigned_to=assigned_counsellor_id_str,
                assigned_by=None,  # System auto-assignment (no user)
                assigned_at=datetime.now(),
                reassignment_reason=None,  # First assignment, not a reassignment
                previous_assignee=None,
            )
            db.add(assignment)
            await db.flush()  # Get assignment.id

            case = await db.get(Case, case_id)
            if case:
                case.assigned_to = assigned_counsellor_id_str  # type: ignore[assignment]
                case.status = CaseStatusEnum.in_progress  # type: ignore[assignment]
                case.updated_at = datetime.now()  # type: ignore[assignment]
                db.add(case)
                await db.flush()
        
        # Update state
        state.setdefault("cma_context", {})["assigned_to"] = assigned_counsellor_id_str
        state.setdefault("cma_context", {})["assignment_id"] = str(assignment.id)
        state.setdefault("cma_context", {})["assignment_reason"] = "auto_assigned_lowest_workload"
        state.setdefault("cma_context", {})["assigned_workload"] = assigned_workload

        await publish_event(
            event_type=EventType.CASE_ASSIGNED,
            source_agent="cma",
            data={
                "case_id": str(case_id),
                "assigned_to": assigned_counsellor_id_str,
                "assigned_by": None,
                "is_reassignment": False,
                "previous_assignee": None,
            },
        )

        # Record an immutable audit trail for this system-driven assignment.
        # AttestationRecord requires a human counselor_id, so the CMA tier uses
        # ComplianceAuditLog (actor_id=None, actor_role="cma") for the DB layer
        # and enqueues an AutopilotAction(publish_attestation) to anchor the
        # assignment hash on-chain — providing full traceability without
        # misattributing a system action to a human actor.
        try:
            from app.services.compliance_service import record_audit_event
            from app.domains.mental_health.services.autopilot_action_service import (
                enqueue_action,
                hash_payload,
                build_idempotency_key,
            )
            from app.domains.mental_health.models.autopilot_actions import (
                AutopilotActionType,
            )

            severity_val = state.get("cma_context", {}).get("case_severity", "high")
            att_payload: dict = {
                "schema": "aicare.case.auto_assignment.v1",
                "attestation_type": "case_auto_assignment",
                "case_id": str(case_id),
                "assigned_to": assigned_counsellor_id_str,
                "assignment_id": str(assignment.id),
                "severity": severity_val,
                "user_hash": state.get("user_hash", ""),
                "session_id": state.get("session_id"),
                "assigned_at": datetime.now().isoformat(),
                "assignment_reason": "auto_assigned_lowest_workload",
                "workload_at_assignment": int(assigned_workload),
                "agent": "cma",
            }
            payload_hash = hash_payload(att_payload)

            att_action = await enqueue_action(
                db,
                action_type=AutopilotActionType.publish_attestation,
                risk_level=severity_val,
                idempotency_key=build_idempotency_key(
                    f"cma-auto-assignment:{case_id}:{assignment.id}"
                ),
                payload_json={
                    **att_payload,
                    "payload_hash": f"0x{payload_hash}",
                    "metadata_uri": "",
                },
                commit=False,
            )

            await record_audit_event(
                db,
                actor_id=None,
                actor_role="cma",
                action="cma.case_auto_assigned",
                entity_type="case",
                entity_id=str(case_id),
                extra_data={
                    "assignment_id": str(assignment.id),
                    "assigned_to": assigned_counsellor_id_str,
                    "severity": severity_val,
                    "autopilot_action_id": int(att_action.id),
                    "payload_hash": payload_hash,
                },
            )

            state["assignment_attestation_action_id"] = int(att_action.id)
            logger.info(
                "CMA assignment audit + attestation action queued: action_id=%s, case=%s",
                att_action.id,
                case_id,
            )
        except Exception as att_err:
            # Attestation pipeline failure must never block the core assignment.
            logger.warning(
                "Failed to queue CMA assignment attestation for case %s: %s",
                case_id,
                att_err,
            )

        execution_path = state.get("execution_path", [])
        execution_path.append("auto_assign")
        state["execution_path"] = execution_path
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "cma::auto_assign",
                metrics={
                    "assigned": True,
                    "counsellor_id": assigned_counsellor_id,
                    "workload": assigned_workload,
                    "total_counsellors": len(counsellors)
                }
            )
        
        logger.info(
            f"CMA auto-assigned case {case_id} to counsellor {assigned_counsellor_id} "
            f"(workload: {assigned_workload} active cases)"
        )
        
    except Exception as e:
        error_msg = f"Auto-assignment failed: {str(e)}"
        errors = state.get("errors", [])
        errors.append(error_msg)
        state["errors"] = errors
        logger.error(error_msg, exc_info=True)

        # If an error happened after a flush attempt, the session may be in a
        # failed transaction state. Best-effort rollback keeps the outer request
        # usable (e.g., for saving the final conversation).
        try:
            await db.rollback()
        except Exception:
            pass
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "cma::auto_assign", str(e))
    
    return state


@trace_agent("CMA_NotifyCounsellor")
async def notify_counsellor_node(state: CMAState) -> CMAState:
    """Node: Emit event to notify counsellors of new case.
    
    Publishes event to event bus for real-time dashboard updates.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state after notification
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "cma::notify_counsellor", "cma")
    
    try:
        if not state.get("cma_context", {}).get("case_id"):
            raise ValueError("No case_id found")
        
        # Publish event for counsellor dashboard
        severity = state.get("cma_context", {}).get("case_severity", "high")
        event_type = (
            EventType.CRITICAL_RISK_DETECTED 
            if severity == "critical" 
            else EventType.HIGH_RISK_DETECTED
        )
        
        await publish_event(
            event_type=event_type,
            source_agent="cma",
            data={
                "case_id": str(state.get("cma_context", {}).get("case_id")),
                "assigned_to": state.get("cma_context", {}).get("assigned_to"),
                "severity": severity,
                "user_hash": state.get("user_hash"),
                "session_id": state.get("session_id"),
                "sla_breach_at": state.get("cma_context", {}).get("sla_breach_at"),
                "triage_assessment_id": state.get("sta_context", {}).get("triage_assessment_id")
            }
        )
        
        execution_path = state.get("execution_path", [])
        execution_path.append("notify_counsellor")
        state["execution_path"] = execution_path
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "cma::notify_counsellor")
        
        logger.info(f"CMA notified counsellors of case {state.get("cma_context", {}).get("case_id")}")
        
    except Exception as e:
        error_msg = f"Counsellor notification failed: {str(e)}"
        errors = state.get("errors", [])
        errors.append(error_msg)
        state["errors"] = errors
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "cma::notify_counsellor", str(e))
    
    return state


@trace_agent("CMA_ScheduleAppointment")
async def schedule_appointment_node(state: CMAState, config: RunnableConfig) -> CMAState:
    """Node: Schedule appointment with counselor (LLM-powered).
    
    This node uses Gemini 2.5 Flash to intelligently schedule appointments
    based on student preferences, counselor availability, and case context.
    
    Workflow:
    1. Check if scheduling is requested (via state["schedule_appointment"])
    2. Use LLM to analyze scheduling preferences and context
    3. Find optimal counselor based on case severity and availability
    4. Query available time slots
    5. Use LLM to select best slot matching student preferences
    6. Create Appointment record
    7. Update state with appointment details
    
    Args:
        state: Current graph state with scheduling request
        config: LangGraph runtime config carrying ``db`` under ``config["configurable"]["db"]``
        
    Returns:
        Updated state with appointment_id and confirmation
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "cma::schedule_appointment", "cma")
    
    try:
        # Check if scheduling is requested
        if not state.get("cma_context", {}).get("schedule_appointment", False):
            logger.info("Scheduling not requested, skipping appointment node")
            if execution_id:
                execution_tracker.complete_node(execution_id, "cma::schedule_appointment")
            return state
        
        user_id = state.get("user_id")
        assigned_counsellor_id = state.get("cma_context", {}).get("assigned_counsellor_id")
        severity = state.get("sta_context", {}).get("severity", "high")
        preferred_time = state.get("cma_context", {}).get("preferred_time")
        scheduling_context = state.get("cma_context", {}).get("scheduling_context", {})
        
        if not user_id:
            raise ValueError("user_id required for scheduling")
        
        # Step 1: Determine which psychologist to book with
        # Priority: assigned counselor > LLM-selected based on availability
        psychologist_id = state.get("cma_context", {}).get("psychologist_id")
        
        if not psychologist_id and assigned_counsellor_id:
            # Try to find psychologist profile for assigned counselor
            counselor_result = await db.execute(
                select(AppUser).where(AppUser.id == assigned_counsellor_id)
            )
            counselor = counselor_result.scalar_one_or_none()
            
            if counselor and counselor.user_id:
                # Check if counselor has psychologist profile
                psych_result = await db.execute(
                    select(Psychologist).where(Psychologist.user_id == counselor.user_id)
                )
                psychologist = psych_result.scalar_one_or_none()
                if psychologist:
                    psychologist_id = psychologist.id
        
        # If no psychologist found yet, use LLM to select best available
        if not psychologist_id:
            logger.info("No psychologist assigned, using LLM to select best match")
            psychologist_id = await _select_optimal_psychologist(
                db=db,
                severity=severity,
                preferences=scheduling_context or {}
            )
        
        if not psychologist_id:
            raise ValueError("No available psychologist found for appointment")
        
        # Step 2: Get psychologist details
        psych_result = await db.execute(
            select(Psychologist).where(Psychologist.id == psychologist_id)
        )
        psychologist = psych_result.scalar_one_or_none()
        
        if not psychologist or not psychologist.is_available:
            raise ValueError(f"Psychologist {psychologist_id} not available")
        
        # Step 3: Use LLM to find optimal appointment time
        appointment_datetime = await _find_optimal_appointment_time(
            db=db,
            psychologist=psychologist,
            preferred_time=preferred_time,
            severity=severity,
            scheduling_context=scheduling_context or {}
        )
        
        if not appointment_datetime:
            raise ValueError("No suitable appointment time found")
        
        # Step 4: Create appointment
        # Determine appointment type based on severity
        appointment_type_id = 3 if severity == "critical" else 1  # 3=Crisis, 1=Initial
        
        new_appointment = Appointment(
            user_id=user_id,
            psychologist_id=psychologist_id,
            appointment_type_id=appointment_type_id,
            appointment_datetime=appointment_datetime,
            notes=f"Auto-scheduled by CMA. Case severity: {severity}. Case ID: {state.get("cma_context", {}).get("case_id")}",
            status="scheduled"
        )
        
        db.add(new_appointment)
        await db.commit()
        await db.refresh(new_appointment)
        
        # Update state
        state.setdefault("cma_context", {})["appointment_id"] = new_appointment.id
        state.setdefault("cma_context", {})["appointment_datetime"] = appointment_datetime.isoformat()
        state.setdefault("cma_context", {})["appointment_confirmed"] = True
        state.setdefault("cma_context", {})["psychologist_id"] = psychologist_id
        execution_path = state.get("execution_path", [])
        execution_path.append("schedule_appointment")
        state["execution_path"] = execution_path
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "cma::schedule_appointment")
        
        logger.info(
            f"CMA scheduled appointment {new_appointment.id} for user {user_id} "
            f"with psychologist {psychologist.name} at {appointment_datetime}"
        )
        
    except Exception as e:
        error_msg = f"Appointment scheduling failed: {str(e)}"
        errors = state.get("errors", [])
        errors.append(error_msg)
        state["errors"] = errors
        state.setdefault("cma_context", {})["appointment_confirmed"] = False
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "cma::schedule_appointment", str(e))
    
    return state


async def _select_optimal_psychologist(
    db: AsyncSession,
    severity: str,
    preferences: dict
) -> int | None:
    """Use LLM to select optimal psychologist based on case context.
    
    Args:
        db: Database session
        severity: Case severity level
        preferences: Student preferences (specialization, language, etc.)
        
    Returns:
        Psychologist ID or None if not found
    """
    try:
        # Get available psychologists
        result = await db.execute(
            select(Psychologist).where(Psychologist.is_available)
        )
        psychologists = result.scalars().all()
        
        if not psychologists:
            return None
        
        # If only one available, return it
        if len(psychologists) == 1:
            return psychologists[0].id
        
        # Use LLM to select best match
        client = await get_gemini_client()
        
        psych_profiles = []
        for p in psychologists:
            psych_profiles.append({
                "id": p.id,
                "name": p.name,
                "specialization": p.specialization,
                "experience_years": p.years_of_experience,
                "languages": p.languages,
                "rating": p.rating,
                "has_schedule": bool(p.availability_schedule)
            })
        
        prompt = f"""Kamu adalah koordinator appointment kesehatan mental. Pilih psikolog yang PALING COCOK untuk case ini.

Konteks Case:
- Severity: {severity}
- Preferensi Mahasiswa: {json.dumps(preferences)}

Psikolog yang Available:
{json.dumps(psych_profiles, indent=2)}

Kriteria Pemilihan:
1. Untuk case CRITICAL: Prioritas experience dan high ratings
2. Match specialization kalau student punya concern spesifik
3. Consider preferensi bahasa
4. Prefer psikolog dengan jadwal availability yang defined

Return HANYA psychologist ID (integer) dari pilihan kamu.
"""
        
        response = client.models.generate_content(
            model=GEMINI_FLASH_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,  # Lower temp for consistent selection
            )
        )
        
        if not response or not response.text:
            logger.warning("No response from LLM for psychologist selection")
            return psych_profiles[0]["id"]  # Default to first available
        
        # Extract ID from response
        selected_id = int(response.text.strip())
        
        # Validate selection
        if any(p.id == selected_id for p in psychologists):
            logger.info(f"LLM selected psychologist ID {selected_id}")
            return selected_id
        
        # Fallback to first available
        return psychologists[0].id
        
    except Exception as e:
        logger.error(f"Error selecting psychologist: {e}")
        # Fallback to first available psychologist
        result = await db.execute(
            select(Psychologist).where(Psychologist.is_available).limit(1)
        )
        psych = result.scalar_one_or_none()
        return psych.id if psych else None


async def _find_optimal_appointment_time(
    db: AsyncSession,
    psychologist: Psychologist,
    preferred_time: str | None,
    severity: str,
    scheduling_context: dict
) -> datetime | None:
    """Use LLM to find optimal appointment time.
    
    Args:
        db: Database session
        psychologist: Psychologist model
        preferred_time: Student's time preference
        severity: Case severity
        scheduling_context: Additional context
        
    Returns:
        Optimal datetime or None
    """
    available_slots = []  # Initialize to avoid unbound variable
    try:
        # Generate available slots (simplified - implement inline)
        # Note: Original _generate_time_slots doesn't exist in scheduling_tools
        # Using simplified slot generation for now
        schedule = psychologist.availability_schedule or {}
        start_date = datetime.now()
        end_date = start_date + timedelta(days=14)
        
        # For critical cases, prefer ASAP (next 3 days)
        if severity == "critical":
            end_date = start_date + timedelta(days=3)
        
        # Generate simple slots (this should be replaced with proper scheduling logic)
        available_slots = []
        current = start_date
        while current < end_date:
            # Generate slots from 9 AM to 5 PM, every hour
            for hour in range(9, 17):
                slot_time = current.replace(hour=hour, minute=0, second=0, microsecond=0)
                if slot_time > datetime.now():  # Only future slots
                    available_slots.append({
                        "datetime": slot_time.isoformat(),
                        "display": slot_time.strftime("%A, %d %B %Y at %I:%M %p")
                    })
            current += timedelta(days=1)
        
        if not available_slots:
            logger.warning(f"No slots available for psychologist {psychologist.id}")
            return None
        
        # Check for conflicts
        conflicts_result = await db.execute(
            select(Appointment.appointment_datetime).where(
                Appointment.psychologist_id == psychologist.id,
                Appointment.appointment_datetime >= start_date,
                Appointment.appointment_datetime <= end_date,
                Appointment.status.in_(["scheduled", "confirmed"])
            )
        )
        booked_times = {apt.strftime("%Y-%m-%dT%H:%M:%S") for apt in conflicts_result.scalars().all()}
        
        # Filter out booked slots
        available_slots = [
            slot for slot in available_slots
            if slot["datetime"] not in booked_times
        ]
        
        if not available_slots:
            logger.warning("All slots are booked")
            return None
        
        # Use LLM to select best slot
        client = await get_gemini_client()
        
        slots_text = "\n".join([
            f"{i+1}. {slot['display']} ({slot['datetime']})"
            for i, slot in enumerate(available_slots[:20])  # Limit to 20 for tokens
        ])
        
        urgency_text = ""
        if severity == "critical":
            urgency_text = "\n⚠️ CASE CRITICAL: Pilih slot PALING AWAL yang available (dalam 24-48 jam ke depan kalau bisa)."
        elif severity == "high":
            urgency_text = "\n⚠️ HIGH PRIORITY: Prefer slots dalam 3-5 hari ke depan."
        
        prompt = f"""Kamu lagi schedule appointment kesehatan mental yang urgent.

Case Severity: {severity}
{urgency_text}
Preferensi Mahasiswa: {preferred_time or 'Nggak ada yang specified'}
Konteks Tambahan: {json.dumps(scheduling_context)}

Slot yang Available:
{slots_text}

Pilih SATU time slot yang PALING BAIK yang balance:
1. Urgency (critical cases butuh ASAP)
2. Preferensi student (kalau ada)
3. Optimal timing (avoid very late evening kecuali memang perlu)

Return HANYA datetime string dalam ISO format (YYYY-MM-DDTHH:MM:SS) dari list di atas.
"""
        
        response = client.models.generate_content(
            model=GEMINI_FLASH_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=50  # Just need datetime string
            )
        )
        
        if not response or not response.text:
            logger.warning("No response from LLM for time selection")
            return datetime.fromisoformat(available_slots[0]["datetime"])
        
        selected_datetime_str = response.text.strip()
        
        # Validate and parse
        selected_datetime = datetime.fromisoformat(selected_datetime_str)
        
        # Verify it's in our available slots
        valid_datetimes = {slot["datetime"] for slot in available_slots}
        if selected_datetime_str in valid_datetimes:
            logger.info(f"LLM selected appointment time: {selected_datetime}")
            return selected_datetime
        
        # Fallback to first available slot
        fallback = datetime.fromisoformat(available_slots[0]["datetime"])
        logger.warning(f"LLM selection invalid, using fallback: {fallback}")
        return fallback
        
    except Exception as e:
        logger.error(f"Error finding optimal time: {e}", exc_info=True)
        # Last resort: return earliest slot if available
        # Note: available_slots might not be defined if error occurred early
        try:
            if 'available_slots' in locals() and available_slots:
                return datetime.fromisoformat(available_slots[0]["datetime"])
        except Exception:
            pass
        return None


def _build_cma_graph() -> CompiledStateGraph:
    """Build and compile the CMA LangGraph state machine.

    Graph structure:
        START → ingest_escalation → create_case → calculate_sla →
        auto_assign → schedule_appt (conditional) → notify_counsellor → END

    The schedule_appt node is conditional based on state["schedule_appointment"] flag.
    If scheduling is not requested, it passes through without creating appointment.

    Returns:
        Compiled StateGraph ready for execution
    """
    workflow = StateGraph(CMAState)

    # Add nodes (no wrappers needed — nodes read db from config)
    workflow.add_node("ingest_escalation", ingest_escalation_node)
    workflow.add_node("create_case", create_case_node)
    workflow.add_node("calculate_sla", calculate_sla_node)
    workflow.add_node("auto_assign", auto_assign_node)
    workflow.add_node("schedule_appt", schedule_appointment_node)
    workflow.add_node("notify_counsellor", notify_counsellor_node)

    # Define flow with conditional scheduling
    workflow.set_entry_point("ingest_escalation")
    workflow.add_edge("ingest_escalation", "create_case")
    workflow.add_edge("create_case", "calculate_sla")
    workflow.add_edge("calculate_sla", "auto_assign")
    workflow.add_edge("auto_assign", "schedule_appt")
    workflow.add_edge("schedule_appt", "notify_counsellor")
    workflow.add_edge("notify_counsellor", END)

    return workflow.compile()  # type: ignore[return-value]


# Module-level cached compiled graph
_cma_graph: CompiledStateGraph | None = None


def get_cma_graph() -> CompiledStateGraph:
    """Return the cached CMA compiled graph, building it on first call."""
    global _cma_graph
    if _cma_graph is None:
        _cma_graph = _build_cma_graph()
    return _cma_graph
