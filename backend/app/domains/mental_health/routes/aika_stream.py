"""
Aika Streaming Endpoint - Progressive Agent Execution Updates
Provides GitHub Copilot-style thinking indicators during agent execution.
"""

import json
import asyncio
import hashlib
import logging
import uuid
from datetime import datetime
from typing import AsyncGenerator, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.exc import PendingRollbackError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_current_active_user
from app.models import User
from app.domains.mental_health.models import Conversation
from app.domains.mental_health.models.messages import Message, MessageRoleEnum
from app.domains.mental_health.models.cases import Case
from app.core.redaction import sanitize_text
from app.domains.mental_health.schemas.chat import AikaRequest
from app.agents.aika_orchestrator_graph import get_aika_agent  # compiled once at startup
from app.core.rate_limiter import check_rate_limit_dependency
from app.agents.execution_tracker import execution_tracker
from app.services.ai_memory_facts_service import list_user_fact_texts_for_agent, remember_from_user_message
from app.core.events import AgentEvent, emit_agent_event
from app.domains.mental_health.models import AgentNameEnum
from app.core.llm_request_tracking import get_stats, prompt_context
from app.core.llm import GeminiResourceExhaustedError
from app.services.user_event_service import record_user_event

logger = logging.getLogger(__name__)

router = APIRouter()


# Agent status messages for streaming updates
AGENT_STATUS_MESSAGES = {
    "aika_decision": "🤔 Aika sedang menganalisis permintaanmu...",
    "sta_subgraph": "🧠 Menilai keamanan emosional...",
    "tca_subgraph": "🤝 Menyusun rencana dukungan...",
    "cma_subgraph": "🚨 Mengatur jadwal dan dokumentasi...",
    "synthesize_response": "✨ Menyusun respons akhir...",
}

AGENT_NAMES = {
    "STA": {"name": "🧠 Suicide & Threat Assessment", "desc": "Menilai risiko dan keamanan emosional"},
    "TCA": {"name": "🤝 Support & Care Agent", "desc": "Menyusun rencana dukungan"},
    "CMA": {"name": "🚨 Scheduling & Documentation Agent", "desc": "Mengatur appointment"},
}


def _sanitize_reasoning_text(value: Any, max_len: int = 220) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = " ".join(value.strip().split())
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[: max_len - 1].rstrip()}…"


def _build_reasoning_payload(node_name: str, node_state: Dict[str, Any]) -> Dict[str, Any] | None:
    stage_map = {
        "aika_decision": "intent_assessment",
        "sta_subgraph": "risk_assessment",
        "tca_subgraph": "support_planning",
        "tca_subgraph": "support_planning",
        "cma_subgraph": "resource_coordination",
        "cma_subgraph": "resource_coordination",
        "ia_subgraph": "insight_analysis",
        "synthesize_response": "response_synthesis",
    }

    stage = stage_map.get(node_name)
    if stage is None:
        return None

    summary = ""
    if node_name == "aika_decision":
        summary = _sanitize_reasoning_text(node_state.get("agent_reasoning"))
        if not summary:
            intent = node_state.get("intent") or "unknown"
            needs_agents = bool(node_state.get("needs_agents", False))
            summary = (
                f"Menilai intent '{intent}' dan memutuskan {'perlu' if needs_agents else 'tidak perlu'} agen tambahan."
            )
    elif node_name in {"sta_subgraph", "tca_subgraph", "tca_subgraph", "cma_subgraph", "cma_subgraph", "ia_subgraph"}:
        summary = AGENT_STATUS_MESSAGES.get(node_name, "Menjalankan langkah agen khusus.")
    elif node_name == "synthesize_response":
        summary = "Menggabungkan hasil analisis menjadi respons akhir yang konsisten."

    summary = _sanitize_reasoning_text(summary)
    if not summary:
        return None

    payload: Dict[str, Any] = {
        "stage": stage,
        "summary": summary,
        "source_node": node_name,
        "timestamp": datetime.utcnow().isoformat(),
    }

    intent = node_state.get("intent")
    if isinstance(intent, str) and intent:
        payload["intent"] = intent

    intent_confidence = node_state.get("intent_confidence")
    if isinstance(intent_confidence, (int, float)):
        payload["confidence"] = float(intent_confidence)

    needs_agents = node_state.get("needs_agents")
    if isinstance(needs_agents, bool):
        payload["needs_agents"] = needs_agents

    risk_level = node_state.get("severity")
    if isinstance(risk_level, str) and risk_level:
        payload["risk_level"] = risk_level

    return payload


async def _chunk_response_text(text: str, chunk_size: int = 3) -> AsyncGenerator[str, None]:
    """Simulate token streaming by yielding small chunks of pre-computed text.

    Yields ~``chunk_size`` characters per iteration with a tiny sleep so the
    client can render progressive message bubbles.  Word boundaries are
    respected when possible to avoid splitting mid-word.
    """
    if not text:
        return

    i = 0
    while i < len(text):
        end = min(i + chunk_size, len(text))

        # Extend to the next word boundary if we're in the middle of a word
        if end < len(text) and text[end - 1].isalpha() and text[end].isalpha():
            next_space = text.find(' ', end)
            if next_space != -1 and next_space - i <= chunk_size * 3:
                end = next_space + 1

        yield text[i:end]
        await asyncio.sleep(0.02)
        i = end


async def stream_aika_execution(
    request: AikaRequest,
    current_user: User,
    db: AsyncSession,
    request_id: str | None,
    http_request: Request,
) -> AsyncGenerator[str, None]:
    """
    Stream progressive updates during Aika agent execution.
    
    Yields SSE (Server-Sent Events) formatted messages:
    - type: 'thinking' - Thinking/processing indicator
    - type: 'status' - Node execution status
    - type: 'agent' - Agent invocation notification
    - type: 'intervention_plan' - Intervention plan data
    - type: 'appointment' - Appointment scheduling data
    - type: 'complete' - Final response with metadata
    - type: 'error' - Error occurred
    """
    execution_id = None
    prompt_id = str(uuid.uuid4())
    tracking_cm = None
    try:
        # Initial thinking indicator
        thinking_data = {'type': 'thinking', 'message': 'Memproses...'}
        yield f"data: {json.dumps(thinking_data)}\n\n"
        await asyncio.sleep(0.05)
        
        # Start execution tracking
        execution_id = execution_tracker.start_execution(
            graph_id="aika_unified_graph",
            agent_name="aika",
            input_data={"message": request.message, "role": request.role}
        )

        # Prepare initial state
        user_hash = hashlib.sha256(f"user_{current_user.id}".encode()).hexdigest()[:16]
        remembered_facts = await list_user_fact_texts_for_agent(db, current_user, limit=20)
        initial_state = {
            "user_id": current_user.id,
            "user_role": request.role,
            "user_hash": user_hash,
            "message": request.message,
            "conversation_history": request.conversation_history or [],
            "session_id": request.session_id or f"sess_{current_user.id}_{int(datetime.now().timestamp())}",
            "personal_context": {
                "remembered_facts": remembered_facts,
            },
            "execution_id": execution_id,  # Inject execution_id for tracking
            "request_id": request_id,
            "execution_path": [],
            "agents_invoked": [],
            "errors": [],
            "preferred_model": request.preferred_model,  # Pass user's preferred model
        }

        # Track outbound Gemini requests for this single user prompt.
        tracking_cm = prompt_context(
            prompt_id=prompt_id,
            user_id=current_user.id,
            session_id=initial_state["session_id"],
            execution_id=execution_id,
        )
        tracking_cm.__enter__()
        
        logger.info(f"🌊 Starting streaming execution for user {current_user.id} with model: {request.preferred_model or 'default'} (exec_id={execution_id})")
        
        # Retrieve the app-lifetime compiled agent (compiled once in lifespan).
        # db is NOT baked in at compile time — it is injected per-request so
        # sessions are properly scoped and the graph can be safely reused.
        aika_agent = get_aika_agent()
        if aika_agent is None:
            raise RuntimeError(
                "Aika agent is not initialised yet. "
                "The FastAPI lifespan startup may still be in progress."
            )
        
        config: dict = {
            "configurable": {
                "thread_id": f"user_{current_user.id}_session_{request.session_id or 'default'}",
                "db": db,
            }
        }
        
        # Track what we've already sent
        sent_agents = set()
        sent_tools: set[str] = set()
        sent_reasoning_nodes: set[str] = set()
        current_node = None
        current_node_started = None
        start_time = datetime.now()
        final_state = {}  # Accumulate final state from streaming

        # Emit a single "run started" event for correlation in DB
        try:
            await emit_agent_event(
                AgentEvent(
                    agent=AgentNameEnum.AIKA,
                    step="run_started",
                    payload={
                        "user_hash": user_hash,
                        "session_id": initial_state["session_id"],
                        "intent": "aika_stream",
                        "resource_id": execution_id,
                        "trace_id": request_id,
                    },
                    ts=datetime.utcnow(),
                )
            )
        except Exception as e:
            logger.warning(f"Failed to persist run_started event: {e}")
        
        ASTREAM_TIMEOUT_SECONDS = 300
        astream_gen = aika_agent.astream(initial_state, config)  # type: ignore

        while True:
            if await http_request.is_disconnected():
                logger.info("Client disconnected during Aika streaming for user %s, aborting.", current_user.id)
                break
            try:
                event = await asyncio.wait_for(astream_gen.__anext__(), timeout=ASTREAM_TIMEOUT_SECONDS)
            except StopAsyncIteration:
                break
            except asyncio.TimeoutError:
                logger.error("Aika astream timed out after %ds for user %s", ASTREAM_TIMEOUT_SECONDS, current_user.id)
                yield f"data: {json.dumps({'type': 'error', 'message': 'Response generation timed out.'})}\n\n"
                break

            for node_name, node_state in event.items():
                # Skip __start__ and __end__ nodes
                if node_name.startswith("__"):
                    continue
                
                # Merge node_state into final_state (accumulate results)
                if isinstance(node_state, dict):
                    final_state.update(node_state)
                
                # Send status update for new node
                if node_name != current_node and node_name in AGENT_STATUS_MESSAGES:
                    # Close previous node timing (best-effort)
                    if current_node and current_node_started and execution_id:
                        try:
                            execution_tracker.complete_node(execution_id, current_node)
                        except Exception:
                            pass

                    current_node = node_name
                    current_node_started = node_name

                    # Start node timing in tracker
                    try:
                        execution_tracker.start_node(
                            execution_id,
                            node_name,
                            agent_id="aika",
                            input_data={"status": "started"},
                            node_type="graph_node",
                        )
                    except Exception:
                        pass

                    # Persist node_started event (safe summary)
                    try:
                        await emit_agent_event(
                            AgentEvent(
                                agent=AgentNameEnum.AIKA,
                                step=f"node_started::{node_name}",
                                payload={
                                    "user_hash": user_hash,
                                    "session_id": initial_state["session_id"],
                                    "resource_id": execution_id,
                                    "trace_id": request_id,
                                },
                                ts=datetime.utcnow(),
                            )
                        )
                    except Exception:
                        pass

                    status_data = {
                        'type': 'status',
                        'node': node_name,
                        'message': AGENT_STATUS_MESSAGES[node_name]
                    }
                    yield f"data: {json.dumps(status_data)}\n\n"
                    await asyncio.sleep(0.05)

                if isinstance(node_state, dict) and node_name not in sent_reasoning_nodes:
                    reasoning_payload = _build_reasoning_payload(node_name, node_state)
                    if reasoning_payload is not None:
                        sent_reasoning_nodes.add(node_name)
                        reasoning_data = {
                            "type": "reasoning",
                            "message": reasoning_payload["summary"],
                            "data": reasoning_payload,
                        }
                        yield f"data: {json.dumps(reasoning_data)}\n\n"
                        await asyncio.sleep(0.03)
                
                # Check for newly invoked agents
                if isinstance(node_state, dict) and "agents_invoked" in node_state:
                    for agent in node_state["agents_invoked"]:
                        if agent not in sent_agents:
                            sent_agents.add(agent)
                            agent_info = AGENT_NAMES.get(agent, {"name": agent, "desc": ""})
                            agent_data = {
                                'type': 'agent',
                                'agent': agent,
                                'name': agent_info['name'],
                                'description': agent_info['desc']
                            }
                            yield f"data: {json.dumps(agent_data)}\n\n"
                            await asyncio.sleep(0.05)

                if isinstance(node_state, dict):
                    current_actions = node_state.get("actions_taken", [])
                    if isinstance(current_actions, list):
                        for action in current_actions:
                            if isinstance(action, str) and action not in sent_tools:
                                sent_tools.add(action)
                                yield f"data: {json.dumps({'type': 'tool_start', 'tool': action})}\n\n"
                                await asyncio.sleep(0.02)
                                yield f"data: {json.dumps({'type': 'tool_end', 'tool': action})}\n\n"
                                await asyncio.sleep(0.02)
        
        # Use accumulated state from astream instead of calling ainvoke again
        result = final_state

        # Best-effort memory write (consent-gated)
        try:
            await remember_from_user_message(db, current_user, request.message, source="conversation")
        except PendingRollbackError as tx_err:
            logger.warning("Skipping memory write due to aborted transaction state; recovering session: %s", tx_err)
            await db.rollback()
        except Exception as memory_err:
            logger.warning("Best-effort memory write failed (non-blocking): %s", memory_err)
        
        processing_time_ms = (datetime.now() - start_time).total_seconds() * 1000

        # Close last node timing if we have one
        if current_node and execution_id:
            try:
                execution_tracker.complete_node(execution_id, current_node)
            except Exception:
                pass
        
        # Send intervention plan if available (check both old and new keys)
        intervention_plan = result.get("tca_intervention_plan") or result.get("intervention_plan")
        if intervention_plan:
            plan_data = {
                'type': 'intervention_plan',
                'data': intervention_plan
            }
            yield f"data: {json.dumps(plan_data)}\n\n"
            await asyncio.sleep(0.05)
        
        # Send appointment if available (check multiple keys and fetch from DB if needed)
        appointment = result.get("cma_appointment")
        appointment_id = result.get("appointment_id")
        
        if appointment:
            # Full appointment object already in state
            appointment_data = {
                'type': 'appointment',
                'data': appointment
            }
            yield f"data: {json.dumps(appointment_data)}\n\n"
            await asyncio.sleep(0.05)
        elif appointment_id:
            # Only ID available, fetch from database
            try:
                from app.domains.mental_health.models.appointments import Appointment
                
                stmt = select(Appointment).where(Appointment.id == appointment_id)
                db_result = await db.execute(stmt)
                appt_record = db_result.scalar_one_or_none()
                
                if appt_record:
                    # Load relationships for complete data
                    await db.refresh(appt_record, ["psychologist", "appointment_type"])
                    
                    appt_dict = {
                        "id": appt_record.id,
                        "student_id": appt_record.user_id,
                        "psychologist_id": appt_record.psychologist_id,
                        "appointment_datetime": appt_record.appointment_datetime.isoformat(),
                        "appointment_type_id": appt_record.appointment_type_id,
                        "status": appt_record.status,
                        "notes": appt_record.notes,
                        "psychologist": {
                            "id": appt_record.psychologist.id,
                            "full_name": appt_record.psychologist.full_name,
                            "specialization": appt_record.psychologist.specialization,
                            "languages": appt_record.psychologist.languages,
                        } if appt_record.psychologist else None,
                        "appointment_type": {
                            "id": appt_record.appointment_type.id,
                            "name": appt_record.appointment_type.name,
                            "description": appt_record.appointment_type.description,
                        } if appt_record.appointment_type else None,
                    }
                    
                    appointment_data = {
                        'type': 'appointment',
                        'data': appt_dict
                    }
                    yield f"data: {json.dumps(appointment_data)}\n\n"
                    await asyncio.sleep(0.05)
            except Exception as e:
                logger.error(f"Failed to fetch appointment {appointment_id}: {e}")

        
        # Send agent activity data
        agent_activity = {
            "execution_path": result.get("execution_path", []),
            "agents_invoked": result.get("agents_invoked", []),
            "intent": result.get("intent", "unknown"),
            "intent_confidence": result.get("intent_confidence", 0.0),
            "needs_agents": result.get("needs_agents", False),
            "agent_reasoning": result.get("agent_reasoning", ""),
            "response_source": result.get("response_source", "unknown"),
            "processing_time_ms": processing_time_ms,
        }

        # Add risk info when available.
        # Note: the orchestrator graph often stores STA output under `severity` / `risk_score`,
        # while older callers used `sta_risk_assessment`.
        sta_ra = result.get("sta_risk_assessment")
        risk_level = None
        risk_score = None
        if isinstance(sta_ra, dict):
            risk_level = sta_ra.get("risk_level")
            risk_score = sta_ra.get("risk_score")

        if not risk_level:
            risk_level = result.get("severity")
        if risk_level is not None:
            agent_activity["risk_level"] = risk_level

        if risk_score is None:
            risk_score = result.get("risk_score")
        if risk_score is not None:
            agent_activity["risk_score"] = risk_score
        
        activity_data = {
            'type': 'agent_activity',
            'data': agent_activity
        }
        yield f"data: {json.dumps(activity_data)}\n\n"
        await asyncio.sleep(0.05)
        
        # Send final complete message
        final_response = result.get("final_response", "Maaf, terjadi kesalahan.")
        session_id = result.get('session_id', request.session_id) or f"sess_{current_user.id}_{int(datetime.now().timestamp())}"

        llm_stats = get_stats()

        # Best-effort extraction of tool usage from the graph state.
        # Some tool-calling paths append entries with a `tool_calls` field.
        tools_used: list[str] = []
        try:
            conversation_history = result.get("conversation_history") or []
            if isinstance(conversation_history, list):
                for item in conversation_history:
                    if not isinstance(item, dict):
                        continue
                    tool_calls = item.get("tool_calls")
                    if isinstance(tool_calls, list):
                        for call in tool_calls:
                            if isinstance(call, dict) and isinstance(call.get("tool_name"), str):
                                tools_used.append(call["tool_name"])
            # De-duplicate while preserving order
            tools_used = list(dict.fromkeys(tools_used))
        except Exception:
            tools_used = []

        metadata_dict = {
            'session_id': session_id,
            'execution_id': execution_id,  # Return execution_id for evaluation
            'request_id': request_id,
            'user_role': request.role,
            'intent': result.get('intent', 'unknown'),
            'agents_invoked': result.get('agents_invoked', []),
            'actions_taken': result.get('actions_taken', []),
            'response_source': result.get('response_source', 'unknown'),
            'processing_time_ms': processing_time_ms,
            # Stable testing fields: prefer explicit risk_level/risk_score when available.
            'risk_level': (result.get('sta_risk_assessment') or {}).get('risk_level') if isinstance(result.get('sta_risk_assessment'), dict) else None,
            'risk_score': (result.get('sta_risk_assessment') or {}).get('risk_score') if isinstance(result.get('sta_risk_assessment'), dict) else None,
            'risk_assessment': result.get('sta_risk_assessment'),
            'escalation_triggered': bool(result.get('escalation_triggered', False)),
            'case_id': result.get('case_id'),
            'activity_logs': result.get('activity_logs'),
            'llm_prompt_id': prompt_id,
            'llm_request_count': llm_stats.total_requests,
            'llm_requests_by_model': llm_stats.requests_by_model,
            'tools_used': tools_used,
            # Fallback signalling — consumed by the frontend to render warning bubbles.
            'is_fallback': result.get('is_fallback', False),
            'fallback_type': result.get('fallback_type'),
            'retry_after_ms': result.get('retry_after_ms', 0),
        }
        if not metadata_dict.get('risk_level'):
            metadata_dict['risk_level'] = result.get('severity')
        if metadata_dict.get('risk_score') is None:
            metadata_dict['risk_score'] = result.get('risk_score')

        # Stream the pre-computed final response as progressive text_chunk events
        try:
            async for chunk in _chunk_response_text(final_response):
                yield f"data: {json.dumps({'type': 'text_chunk', 'text': chunk})}\n\n"
        except Exception as stream_err:
            logger.warning("text_chunk streaming failed, falling back to single complete event: %s", stream_err)

        yield f"data: {json.dumps({'type': 'complete', 'response': final_response, 'metadata': metadata_dict})}\n\n"
        
        # Save conversation to database
        try:
            # 1. Count total prior conversations for this user (for chat.first event)
            total_user_convs = (
                await db.execute(
                    select(func.count()).select_from(Conversation).where(Conversation.user_id == current_user.id)
                )
            ).scalar() or 0

            # 2. Find conversation_ids already persisted for this session (de-duplication)
            existing_ids_result = await db.execute(
                select(Conversation.conversation_id).where(
                    Conversation.user_id == current_user.id,
                    Conversation.session_id == session_id,
                )
            )
            existing_conv_ids: set[str] = {row[0] for row in existing_ids_result.all()}

            # 3. Backfill prior history turns that are not yet in DB.
            #    conversation_history alternates [user, assistant, user, assistant, ...]
            #    The current request.message is NOT included in this list.
            history: list[dict[str, str]] = request.conversation_history or []
            i = 0
            while i + 1 < len(history):
                user_item = history[i]
                asst_item = history[i + 1]
                if user_item.get("role") == "user" and asst_item.get("role") == "assistant":
                    user_msg = user_item.get("content", "")
                    asst_msg = asst_item.get("content", "")
                    # Deterministic stable ID prevents duplicate rows on retries
                    stable_id = hashlib.sha256(
                        f"{session_id}:{user_msg}:{asst_msg}".encode()
                    ).hexdigest()[:32]
                    if stable_id not in existing_conv_ids:
                        db.add(Conversation(
                            user_id=current_user.id,
                            session_id=session_id,
                            conversation_id=stable_id,
                            message=user_msg,
                            response=asst_msg,
                            timestamp=datetime.now(),
                            llm_prompt_id=None,
                            llm_request_count=None,
                            llm_requests_by_model=None,
                        ))
                        # Persist PII-redacted Message rows for history pair
                        hist_user_redacted, _ = sanitize_text(user_msg)
                        hist_asst_redacted, _ = sanitize_text(asst_msg)
                        db.add(Message(
                            session_id=session_id,
                            role=MessageRoleEnum.user,
                            content_redacted=hist_user_redacted,
                            tools_used=None,
                            trace_id=request_id,
                            ts=datetime.utcnow(),
                        ))
                        db.add(Message(
                            session_id=session_id,
                            role=MessageRoleEnum.assistant,
                            content_redacted=hist_asst_redacted,
                            tools_used=None,
                            trace_id=request_id,
                            ts=datetime.utcnow(),
                        ))
                i += 2

            # 4. Persist current turn
            current_conv_id = str(uuid.uuid4())
            conversation_entry = Conversation(
                user_id=current_user.id,
                session_id=session_id,
                conversation_id=current_conv_id,
                message=request.message,
                response=final_response,
                timestamp=datetime.now(),
                llm_prompt_id=prompt_id,
                llm_request_count=llm_stats.total_requests,
                llm_requests_by_model=llm_stats.requests_by_model,
            )
            db.add(conversation_entry)

            # 5. Persist PII-redacted Message rows for current turn
            cur_user_redacted, _ = sanitize_text(request.message)
            cur_asst_redacted, _ = sanitize_text(final_response)
            db.add(Message(
                session_id=session_id,
                role=MessageRoleEnum.user,
                content_redacted=cur_user_redacted,
                tools_used=None,
                trace_id=request_id,
                ts=datetime.utcnow(),
            ))
            db.add(Message(
                session_id=session_id,
                role=MessageRoleEnum.assistant,
                content_redacted=cur_asst_redacted,
                tools_used=tools_used or None,
                trace_id=request_id,
                ts=datetime.utcnow(),
            ))

            # 6. Fire chat.first event if this is the user's very first conversation
            if total_user_convs == 0:
                await record_user_event(
                    db,
                    user_id=current_user.id,
                    event_name="chat.first",
                    session_id=session_id,
                    request_id=request_id,
                    ip_address=None,
                    user_agent=None,
                    metadata={
                        "source": "aika",
                        "preferred_model": request.preferred_model,
                    },
                )

            # 7. Flush to obtain conversation_entry.id, then link Case if CMA created one
            await db.flush()
            case_id_from_result = result.get("case_id")
            if case_id_from_result and conversation_entry.id:
                await db.execute(
                    update(Case)
                    .where(Case.id == case_id_from_result)
                    .values(conversation_id=conversation_entry.id),
                )

            await db.commit()
            logger.debug(f"\U0001f4be Saved conversation to database for user {current_user.id}")
        except Exception as save_error:
            logger.error(f"Failed to save conversation: {save_error}")
            try:
                await db.rollback()
            except Exception:
                pass
            # Don't fail the request if DB save fails
        
        execution_tracker.complete_execution(execution_id, success=True)

        # Persist completion event with latency and outcome (redacted)
        try:
            await emit_agent_event(
                AgentEvent(
                    agent=AgentNameEnum.AIKA,
                    step="run_completed",
                    payload={
                        "user_hash": user_hash,
                        "session_id": session_id,
                        "resource_id": execution_id,
                        "trace_id": request_id,
                        "latency_ms": int(processing_time_ms),
                        "outcome": result.get("response_source", "unknown"),
                    },
                    ts=datetime.utcnow(),
                )
            )
        except Exception:
            pass

        logger.info(
            f"✅ Streaming complete: user={current_user.id}, "
            f"agents={result.get('agents_invoked', [])}, time={processing_time_ms:.2f}ms"
        )
        
    except HTTPException:
        if execution_id:
            execution_tracker.complete_execution(execution_id, success=False)
        raise
    except GeminiResourceExhaustedError as exc:
        if execution_id:
            execution_tracker.complete_execution(execution_id, success=False)

        logger.warning(
            "Gemini quota exhausted during /aika stream: user=%s exec_id=%s model=%s key_idx=%s key_last4=%s retry_after_s=%s",
            current_user.id,
            execution_id,
            getattr(exc, "model", None),
            getattr(exc, "api_key_index", None),
            getattr(exc, "api_key_last4", None),
            getattr(exc, "retry_after_s", None),
        )

        error_data: dict[str, Any] = {
            "type": "error",
            "code": "RESOURCE_EXHAUSTED",
            "message": "LLM quota exhausted. Please retry later.",
            "provider": "gemini",
            "model": getattr(exc, "model", None),
            "api_key_index": getattr(exc, "api_key_index", None),
            "api_key_last4": getattr(exc, "api_key_last4", None),
            "retry_after_s": getattr(exc, "retry_after_s", None),
        }
        yield f"data: {json.dumps(error_data)}\n\n"
    except Exception as exc:
        if execution_id:
            execution_tracker.complete_execution(execution_id, success=False)
        logger.error(f"❌ Streaming error for user {current_user.id}: {exc}", exc_info=True)
        error_data = {
            'type': 'error',
            'message': 'Terjadi kesalahan saat memproses permintaan.',
            'error': str(exc)[:200]
        }
        yield f"data: {json.dumps(error_data)}\n\n"

    finally:
        if tracking_cm is not None:
            tracking_cm.__exit__(None, None, None)


@router.post("/aika", dependencies=[Depends(check_rate_limit_dependency)])
async def aika_stream_endpoint(
    request: AikaRequest,
    http_request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    **Streaming Aika Endpoint** - Progressive agent execution with thinking indicators.
    
    Returns Server-Sent Events (SSE) stream with progressive updates:
    1. Thinking indicator
    2. Node execution status
    3. Agent invocation notifications
    4. Intervention plans / appointments (if generated)
    5. Agent activity metadata
    6. Final response
    
    **Use this endpoint for better UX** - shows users what Aika is doing in real-time.
    """
    logger.info(f"📡 Streaming request from user {current_user.id}: {request.message[:50]}...")
    
    request_id = getattr(http_request.state, "request_id", None)

    return StreamingResponse(
        stream_aika_execution(request, current_user, db, request_id, http_request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Request-ID": request_id or "",
        }
    )
