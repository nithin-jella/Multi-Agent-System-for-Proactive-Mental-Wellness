"""Tool calling integration for Aika's chat system.

This module handles the tool calling loop:
1. Send request to LLM with tools
2. If LLM requests tool calls, execute them
3. Send tool results back to LLM
4. Repeat until LLM provides final response

Best practices:
- Async/await for all operations
- Comprehensive error handling
- Tool call iteration limits to prevent infinite loops
- Proper logging for debugging and monitoring

MIGRATION NOTE: Migrated from google-generativeai to google-genai SDK
- No more start_chat() API
- Conversation state managed manually in contents array
- Function responses use Part.from_function_call() and Part.from_function_response()
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional, cast

from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal

# New SDK imports
from google import genai
from google.genai import types

# LangChain Core for Custom Events
try:
    from langchain_core.callbacks.manager import adispatch_custom_event
except ImportError:
    # Fallback if langchain_core is not available (should not happen with langgraph)
    async def adispatch_custom_event(*args, **kwargs):
        pass

from app.agents.aika.tools import execute_tool_call, get_aika_tools
from app.agents.execution_tracker import execution_tracker
from app.core import llm
from app.domains.mental_health.schemas.chat import ChatRequest
from app.core.llm_request_tracking import get_prompt_id, prompt_context

logger = logging.getLogger(__name__)

# Type alias for stream callback
StreamCallback = Callable[[str], Any]

# Constants
MAX_TOOL_ITERATIONS = 5
DEFAULT_TOOL_TIMEOUT = 30  # seconds


def _latest_user_message(history: List[Dict[str, str]]) -> str:
    for msg in reversed(history):
        if msg.get("role") == "user" and msg.get("content"):
            return str(msg.get("content") or "")
    return ""


def _select_tool_subset_from_message(message: str) -> Optional[set[str]]:
    """Return a narrowed tool set for obvious intents to reduce latency.

    Returns None when intent is ambiguous, so full toolset remains available.
    """
    text = re.sub(r"\s+", " ", (message or "").strip().lower())
    if not text:
        return None

    profile_keywords = (
        "profil", "profile", "siapa aku", "tentang aku", "data aku", "info aku",
        "nama aku", "umur", "fakultas", "jurusan", "tahun studi",
    )
    appointment_keywords = (
        "appointment", "jadwal", "booking", "book", "counselor", "psikolog",
        "reschedule", "cancel",
    )
    journal_keywords = (
        "jurnal", "journal", "catatan", "diary", "refleksi", "mood",
    )
    intervention_keywords = (
        "intervensi", "intervention", "coping", "rencana", "plan", "progress",
    )

    if any(keyword in text for keyword in profile_keywords):
        return {
            "get_user_profile",
            "get_user_preferences",
            "get_user_consent_status",
            "update_user_profile",
        }

    if any(keyword in text for keyword in appointment_keywords):
        return {
            "get_available_counselors",
            "suggest_appointment_times",
            "book_appointment",
            "reschedule_appointment",
            "cancel_appointment",
            "get_user_profile",
        }

    if any(keyword in text for keyword in journal_keywords):
        return {
            "get_journal_entries",
            "get_activity_streak",
            "get_user_profile",
        }

    if any(keyword in text for keyword in intervention_keywords):
        return {
            "get_intervention_plan_progress",
            "get_user_intervention_plan_progress",
            "create_intervention_plan",
            "get_user_profile",
        }

    return None


def _should_use_tools(message: str, user_role: Optional[str]) -> bool:
    """Conservative gate to avoid unnecessary tool calls.

    Tools are only enabled for account-specific, historical, or transactional intents.
    """
    text = re.sub(r"\s+", " ", (message or "").strip().lower())
    if not text:
        return False

    role = (user_role or "user").strip().lower()
    common_triggers = (
        "profil", "profile", "siapa aku", "data aku", "riwayat",
        "jurnal", "journal", "progress", "rencana", "intervensi",
        "appointment", "jadwal", "booking", "book", "counselor", "psikolog",
        "cancel", "reschedule",
    )

    if any(trigger in text for trigger in common_triggers):
        return True

    from app.core.role_utils import normalize_role, ALLOWED_PRIVILEGED_ROLES
    if normalize_role(role) in ALLOWED_PRIVILEGED_ROLES:
        privileged_triggers = (
            "case", "kasus", "trend", "analytics", "statistik", "conversation stats",
            "risk", "risiko", "escalation", "eskalasi",
        )
        if any(trigger in text for trigger in privileged_triggers):
            return True

    return False


async def generate_with_tools(
    history: List[Dict[str, str]],
    system_prompt: Optional[str],
    request: ChatRequest,
    db: AsyncSession,
    user_id: int,
    stream_callback: Optional[StreamCallback] = None,
    max_tool_iterations: int = MAX_TOOL_ITERATIONS,
    execution_id: Optional[str] = None,
    user_role: Optional[str] = None,
) -> tuple[str, List[Dict[str, Any]]]:
    """Generate response with tool calling support.
    
    Implements the tool calling loop where the LLM can request tool executions,
    receive the results, and use them to formulate better responses.
    
    Args:
        history: Conversation history
        system_prompt: System instruction for the LLM
        request: Chat request configuration
        db: Database session for tool execution
        user_id: User ID for scoping tool queries
        stream_callback: Optional callback for streaming responses
        max_tool_iterations: Maximum number of tool calling iterations
        execution_id: Optional execution ID for tracking tool calls
        user_role: Optional caller role (student/counselor/admin) for tool policy
        
    Returns:
        Tuple of (final_response_text, list_of_tool_calls_executed)
    """
    model_name = request.model or "gemini_google"
    if model_name == "gemini_google":
        model_name = llm.select_gemini_model(
            intent=None,
            role=None,
            has_tools=True,
            preferred_model=None,
        )
    zai_openrouter_requested = llm.is_zai_model_name(model_name)
    zai_direct_requested = llm.is_zai_direct_model_name(model_name)
    zai_requested = zai_openrouter_requested or zai_direct_requested
    zai_provider = "zai_openrouter" if zai_openrouter_requested else "zai_direct"
    
    conversation_history = list(history)
    iterations = 0
    tool_calls_executed: List[Dict[str, Any]] = []

    latest_message = _latest_user_message(conversation_history)

    if not _should_use_tools(latest_message, user_role):
        logger.info("Tool calling skipped: request does not require tools")
        if zai_requested:
            response = await llm.generate_response(
                history=conversation_history,
                model=zai_provider,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                system_prompt=system_prompt,
                preferred_gemini_model=model_name,
            )
        else:
            response = await llm.generate_gemini_response_with_fallback(
                history=conversation_history,
                model=model_name,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                system_prompt=system_prompt,
                tools=None,
                allow_retry_sleep=False,
                return_full_response=False,
            )
        response_text = cast(str, response)

        if stream_callback:
            for char in response_text:
                await stream_callback(char)

        return response_text, tool_calls_executed

    if zai_requested:
        logger.info(
            "Tool calling bypassed for model '%s': using direct Z.AI response path (%s).",
            model_name,
            zai_provider,
        )
        response_text = await llm.generate_response(
            history=conversation_history,
            model=zai_provider,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            system_prompt=system_prompt,
            preferred_gemini_model=model_name,
        )

        if stream_callback:
            for char in response_text:
                await stream_callback(char)

        return response_text, tool_calls_executed
    
    # Get available tools (optionally narrowed by user intent for latency)
    tool_subset = _select_tool_subset_from_message(latest_message)
    tools = get_aika_tools(allowed_tool_names=tool_subset, user_role=user_role)
    tool_declaration_count = sum(len(getattr(tool, "function_declarations", []) or []) for tool in tools)
    if tool_subset is None:
        logger.info("Tool calling enabled with %d declaration(s) (full set)", tool_declaration_count)
    else:
        logger.info(
            "Tool calling enabled with %d declaration(s) (intent-filtered subset)",
            tool_declaration_count,
        )

    # Defensive: if this function is used outside the LangGraph chat entrypoint,
    # we still want per-prompt request counting.
    local_prompt_cm = None
    if get_prompt_id() is None:
        local_prompt_cm = prompt_context(
            prompt_id=str(uuid4()),
            user_id=user_id,
            execution_id=execution_id,
        )
        local_prompt_cm.__enter__()
    
    try:
        while iterations < max_tool_iterations:
            iterations += 1
            logger.info(f"Tool calling iteration {iterations}/{max_tool_iterations}")

            try:
                # For streaming mode
                if stream_callback:
                    response_text = await _generate_streaming_with_tools(
                        conversation_history=conversation_history,
                        system_prompt=system_prompt,
                        request=request,
                        model_name=model_name,
                        tools=tools,
                        db=db,
                        user_id=user_id,
                        stream_callback=stream_callback,
                        execution_id=execution_id,
                    )
                    # Note: Gemini's streaming mode with tools is complex
                    # For now, we return after first iteration for streaming
                    logger.info("Streaming response completed")
                    return response_text, tool_calls_executed

                # For non-streaming mode (default)
                # Get full response object for tool calling (with automatic fallback on rate limits)
                planning_max_tokens = max(128, min(int(request.max_tokens), 384))
                response_obj = await llm.generate_gemini_response_with_fallback(
                    history=conversation_history,
                    model=model_name,
                    max_tokens=planning_max_tokens,
                    temperature=request.temperature,
                    system_prompt=system_prompt,
                    tools=tools,
                    allow_retry_sleep=False,
                    return_full_response=True,  # Get full response to check for function calls
                )
                response_obj_any = cast(Any, response_obj)
                
                # Check if response contains tool call requests
                tool_results = await _check_and_execute_tool_calls(
                    response=response_obj_any,  # Pass full response object
                    db=db,
                    user_id=user_id,
                    execution_id=execution_id,
                    previous_tool_calls=tool_calls_executed,
                )
                
                if not tool_results:
                    # No tool calls detected, return final response
                    try:
                        response_text = response_obj_any.text  # type: ignore[attr-defined]
                        if response_text is None:
                            response_text = "I've processed your request."
                    except (ValueError, AttributeError):
                        # Fallback if can't extract text
                        response_text = "I've processed your request."
                    
                    # If we used tools in previous iterations, add indicator
                    if tool_calls_executed:
                        tool_names = [tc["tool_name"] for tc in tool_calls_executed]
                        tool_indicator = f"_🔧 Menggunakan: {', '.join(tool_names)}_\n\n"
                        response_text = tool_indicator + response_text
                    
                    logger.info("No tool calls detected, returning final response")
                    return response_text, tool_calls_executed
                
                # Tool calls were executed, add to tracking
                tool_calls_executed.extend(tool_results)
                logger.info(f"✓ Executed {len(tool_results)} tool(s): {', '.join([r['tool_name'] for r in tool_results])}")
                
                # NEW SDK: Build contents array with function call and response
                # This replaces the old chat.send_message_async pattern
                
                # Start with conversation history
                contents = llm._convert_history_to_contents(conversation_history)
                
                # Add the model's original function_call parts from the response.
                # IMPORTANT: keep raw parts to preserve Gemini thought_signature.
                if hasattr(response_obj_any, 'candidates') and response_obj_any.candidates:
                    candidate = response_obj_any.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content and getattr(candidate.content, 'parts', None):
                        function_call_parts = [
                            part
                            for part in candidate.content.parts
                            if hasattr(part, 'function_call') and part.function_call
                        ]
                        if function_call_parts:
                            contents.append(types.Content(role='model', parts=function_call_parts))
                
                # Add function responses from tool execution
                function_response_parts = []
                for result in tool_results:
                    function_response_parts.append(
                        types.Part.from_function_response(
                            name=result["tool_name"],
                            response=result["result"]
                        )
                    )
                
                if function_response_parts:
                    contents.append(types.Content(role='user', parts=function_response_parts))
                
                # Update conversation history for the next iteration
                # This is CRITICAL: We must append the tool interactions to the history
                # so that the next generate_content call sees them.
                
                # 1. Add model's tool call request
                # We can't easily reconstruct the exact protobuf, so we use a representation
                tool_names = [r['tool_name'] for r in tool_results]
                conversation_history.append({
                    "role": "assistant",
                    "content": "", # Content is empty for tool calls in some models, or we can add a description
                })
                
                # 2. Add tool results (simulated as user message for history tracking, 
                # but for the API call we use the structured contents above)
                # Note: The 'contents' variable is what actually gets sent to Gemini.
                # The 'conversation_history' is just for our internal state tracking.
                
                # Make another API call with the updated contents to get final response
                logger.info(f"Sending tool results back to LLM (iteration {iterations})")
                normalized_tools = llm._normalize_tools_for_generate_config(tools)
                response_max_tokens = max(256, min(int(request.max_tokens), 1024))
                final_response_obj = await llm.generate_gemini_content_with_fallback(
                    contents=contents,
                    model=model_name,
                    config=types.GenerateContentConfig(
                        temperature=request.temperature,
                        max_output_tokens=response_max_tokens,
                        system_instruction=system_prompt if system_prompt else None,
                        tools=normalized_tools,
                    ),
                    allow_retry_sleep=False,
                    return_full_response=True,
                )
                
                # Check if there are more function calls (nested tool calling)
                # For safety, limit to max_iterations
                response_obj_any = cast(Any, final_response_obj)
                
                # Check if the new response has tool calls
                new_tool_results = await _check_and_execute_tool_calls(
                    response=response_obj_any,
                    db=db,
                    user_id=user_id,
                    execution_id=execution_id,
                    previous_tool_calls=tool_calls_executed,
                )
                
                if new_tool_results:
                    logger.info(f"🔄 Nested tool calls detected: {len(new_tool_results)}")
                    # Loop will continue and handle these new calls
                    continue
                else:
                    # No more tool calls, we have the final response
                    try:
                        response_text = response_obj_any.text
                        if response_text is None:
                            response_text = "I've processed your request."
                    except (ValueError, AttributeError):
                        response_text = "I've processed your request."
                        
                    # If we used tools, add indicator
                    if tool_calls_executed:
                        tool_names = [tc["tool_name"] for tc in tool_calls_executed]
                        tool_indicator = f"_🔧 Menggunakan: {', '.join(tool_names)}_\n\n"
                        response_text = tool_indicator + response_text
                        
                    return response_text, tool_calls_executed
                
            except Exception as e:
                logger.error(f"Error in tool calling iteration {iterations}: {e}", exc_info=True)
                if iterations == 1:
                    raise
                else:
                    error_msg = f"Tool calling encountered an error: {str(e)}"
                    return error_msg, tool_calls_executed
    
        # Reached max iterations
        logger.warning(f"Reached max tool calling iterations ({max_tool_iterations})")
        final_msg = (
            "I've gathered information but need to stop here. "
            "The information I found might help answer your question."
        )
        return final_msg, tool_calls_executed
    finally:
        if local_prompt_cm is not None:
            local_prompt_cm.__exit__(None, None, None)


async def _generate_streaming_with_tools(
    conversation_history: List[Dict[str, str]],
    system_prompt: Optional[str],
    request: ChatRequest,
    model_name: str,
    tools: List[Any],
    db: AsyncSession,
    user_id: int,
    stream_callback: StreamCallback,
    execution_id: Optional[str] = None,
) -> str:
    """Generate streaming response with tool calling support.
    
    Handles both streaming text and function calls. When a function call
    is detected, executes it and continues the conversation.
    
    Args:
        conversation_history: Conversation history
        system_prompt: System instruction
        request: Chat request
        model_name: Model to use
        tools: Available tools
        db: Database session
        user_id: User ID
        stream_callback: Callback for streaming chunks
        execution_id: Optional execution ID for tracking
        
    Returns:
        Complete response text
    """
    # For streaming with tools, we need to use non-streaming mode first
    # to check if there's a function call, then stream the final response
    
    try:
        # First, get the response to check for function calls (with automatic fallback on rate limits)
        response_obj = await llm.generate_gemini_response_with_fallback(
            history=conversation_history,
            model=model_name,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            system_prompt=system_prompt,
            tools=tools,
            allow_retry_sleep=False,
            return_full_response=True,
        )
        response_obj_any = cast(Any, response_obj)
        
        # Check if response contains tool call requests
        tool_results = await _check_and_execute_tool_calls(
            response=response_obj_any,
            db=db,
            user_id=user_id,
            execution_id=execution_id,
        )
        
        if tool_results:
            # 1. Check for and emit any initial text (explanation) from the model
            # This allows "Explain -> Act" behavior like ChatGPT
            if hasattr(response_obj_any, 'candidates') and response_obj_any.candidates:
                candidate = response_obj_any.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    initial_text = ""
                    for part in candidate.content.parts:
                        if hasattr(part, 'text') and part.text:
                            initial_text += part.text
                    
                    if initial_text:
                        # Emit custom event for LangGraph streaming
                        await adispatch_custom_event(
                            "partial_response",
                            {"text": initial_text},
                        )
                        # Also use callback if provided (legacy)
                        if stream_callback:
                            await stream_callback(initial_text + "\n\n")

            # Emit tool usage event
            tool_names = [result["tool_name"] for result in tool_results]
            await adispatch_custom_event(
                "tool_use",
                {"tools": tool_names},
            )

            # Send tool indicator as a special event (not regular text)
            # The frontend should handle this specially
            tool_indicator_msg = f"🔧 _Menggunakan: {', '.join(tool_names)}_\n\n"
            if stream_callback:
                await stream_callback(tool_indicator_msg)
            
            # NEW SDK: Build contents array with function call and response
            # This replaces the old chat.send_message_async pattern
            
            # Start with conversation history
            contents = llm._convert_history_to_contents(conversation_history)
            
            # Add the model's original function_call parts from the response.
            # IMPORTANT: keep raw parts to preserve Gemini thought_signature.
            if hasattr(response_obj_any, 'candidates') and response_obj_any.candidates:
                candidate = response_obj_any.candidates[0]
                if hasattr(candidate, 'content') and candidate.content and getattr(candidate.content, 'parts', None):
                    function_call_parts = [
                        part
                        for part in candidate.content.parts
                        if hasattr(part, 'function_call') and part.function_call
                    ]
                    if function_call_parts:
                        contents.append(types.Content(role='model', parts=function_call_parts))
            
            # Add function responses from tool execution
            function_response_parts = []
            for result in tool_results:
                function_response_parts.append(
                    types.Part.from_function_response(
                        name=result["tool_name"],
                        response=result["result"]
                    )
                )
                logger.info(f"✓ Tool {result['tool_name']} executed in streaming mode")
            
            if function_response_parts:
                contents.append(types.Content(role='user', parts=function_response_parts))
            
            # Make API call to get final response (non-streaming for now after tool execution)
            # Streaming after tool execution is complex and may not work well
            final_response_obj = await llm.generate_gemini_content_with_fallback(
                contents=contents,
                model=model_name,
                config=types.GenerateContentConfig(
                    temperature=request.temperature,
                    max_output_tokens=request.max_tokens,
                    system_instruction=system_prompt if system_prompt else None,
                ),
                allow_retry_sleep=False,
                return_full_response=True,
            )
            final_response_obj_any = cast(Any, final_response_obj)
            
            # Extract final text
            final_response = final_response_obj_any.text
            
            # Stream the final response character by character for smooth UX
            full_text = tool_indicator_msg
            for char in final_response:
                full_text += char
                await stream_callback(char)
            
            return full_text
        
        else:
            # No function calls, extract and stream text normally
            try:
                response_text = response_obj_any.text  # type: ignore[attr-defined]
            except (ValueError, AttributeError):
                response_text = "I've processed your request."
            
            # Stream the response
            full_text = ""
            for char in response_text:
                full_text += char
                await stream_callback(char)
            
            return full_text
    
    except Exception as e:
        logger.error(f"Error in streaming with tools: {e}", exc_info=True)
        error_chunk = f"\n\n[Error: {str(e)}]"
        try:
            await stream_callback(error_chunk)
        except:
            pass
        return error_chunk


async def _check_and_execute_tool_calls(
    response: Any,  # Full Gemini response object
    db: AsyncSession,
    user_id: int,
    execution_id: Optional[str] = None,
    previous_tool_calls: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Check if response contains tool calls and execute them.
    
    Parses Gemini's function_call objects from the response and executes them.
    
    Args:
        response: Full response object from Gemini
        db: Database session
        user_id: User ID
        execution_id: Optional execution ID for tracking
        previous_tool_calls: List of previously executed tool calls for retry tracking
        
    Returns:
        List of executed tool calls with their results
    """
    tool_results: List[Dict[str, Any]] = []

    async def _execute_one_tool_call(
        tool_name: str,
        tool_args: Dict[str, Any],
        *,
        use_isolated_session: bool,
    ) -> Dict[str, Any]:
        local_db: AsyncSession | None = None
        execution_db: AsyncSession = db
        try:
            if use_isolated_session:
                local_db = AsyncSessionLocal()
                execution_db = local_db

            result = await asyncio.wait_for(
                execute_tool_call(
                    tool_name=tool_name,
                    args=tool_args,
                    db=execution_db,
                    user_id=str(user_id),
                ),
                timeout=DEFAULT_TOOL_TIMEOUT,
            )
            return {
                "tool_name": tool_name,
                "arguments": tool_args,
                "result": result,
                "success": not (isinstance(result, dict) and bool(result.get("error"))),
            }
        except asyncio.TimeoutError:
            logger.error(
                "Tool execution timed out: %s (timeout=%ss)",
                tool_name,
                DEFAULT_TOOL_TIMEOUT,
            )
            return {
                "tool_name": tool_name,
                "arguments": tool_args,
                "result": {"status": "failed", "success": False, "error": "Tool execution timed out"},
                "success": False,
            }
        except Exception as tool_error:
            logger.error(f"Error executing tool {tool_name}: {tool_error}", exc_info=True)
            return {
                "tool_name": tool_name,
                "arguments": tool_args,
                "result": {"status": "failed", "success": False, "error": str(tool_error)},
                "success": False,
            }
        finally:
            if local_db is not None:
                await local_db.close()
    
    try:
        # Check if response has candidates
        if not hasattr(response, 'candidates') or not response.candidates:
            return tool_results
        
        # Check first candidate for function calls
        candidate = response.candidates[0]
        if not hasattr(candidate, 'content') or not candidate.content:
            return tool_results
        
        content = candidate.content
        if not hasattr(content, 'parts') or not content.parts:
            return tool_results
        
        # NEW: Check for initial text (explanation) and emit event
        # This ensures "Explain -> Act" works even in non-streaming graph nodes
        initial_text = ""
        for part in content.parts:
            if hasattr(part, 'text') and part.text:
                initial_text += part.text
        
        if initial_text:
            await adispatch_custom_event("partial_response", {"text": initial_text})

        pending_calls: List[tuple[str, Dict[str, Any]]] = []
        for part in content.parts:
            if not (hasattr(part, 'function_call') and part.function_call):
                continue
            function_call = part.function_call
            tool_name = function_call.name

            tool_args: Dict[str, Any] = {}
            if hasattr(function_call, 'args') and function_call.args:
                tool_args = dict(function_call.args)

            logger.info(f"Executing tool call: {tool_name} with args: {tool_args}")
            pending_calls.append((tool_name, tool_args))

            if execution_id:
                retry_count = 0
                if previous_tool_calls:
                    retry_count = sum(1 for tc in previous_tool_calls if tc["tool_name"] == tool_name)
                execution_tracker.start_node(
                    execution_id,
                    f"tool::{tool_name}",
                    "tool_executor",
                    input_data=tool_args,
                    node_type="tool",
                    retry_count=retry_count,
                )

        if not pending_calls:
            return tool_results

        can_parallelize = all(name.startswith("get_") for name, _ in pending_calls) and len(pending_calls) > 1

        if can_parallelize:
            logger.info("⚡ Executing %d read-only tool calls in parallel", len(pending_calls))
            executed = await asyncio.gather(
                *[
                    _execute_one_tool_call(name, args, use_isolated_session=True)
                    for name, args in pending_calls
                ],
                return_exceptions=False,
            )
        else:
            executed = []
            for name, args in pending_calls:
                executed.append(
                    await _execute_one_tool_call(name, args, use_isolated_session=False)
                )

        for item in executed:
            tool_results.append({
                "tool_name": item["tool_name"],
                "arguments": item["arguments"],
                "result": item["result"],
            })

            if execution_id:
                if item["success"]:
                    execution_tracker.complete_node(
                        execution_id,
                        f"tool::{item['tool_name']}",
                        output_data={"result": str(item["result"])[:500]},
                    )
                else:
                    error_message = "Tool execution failed"
                    if isinstance(item.get("result"), dict):
                        error_message = str(item["result"].get("error") or error_message)
                    execution_tracker.fail_node(
                        execution_id,
                        f"tool::{item['tool_name']}",
                        error_message,
                    )

            if item["success"]:
                logger.info("✓ Tool %s executed successfully", item["tool_name"])
            else:
                logger.warning("⚠️ Tool %s returned error result", item["tool_name"])
    
    except Exception as e:
        logger.error(f"Error parsing function calls from response: {e}", exc_info=True)
    
    return tool_results


async def execute_manual_tool_call(
    tool_name: str,
    tool_args: Dict[str, Any],
    db: AsyncSession,
    user_id: int,
) -> Dict[str, Any]:
    """Execute a tool call manually (for testing or explicit invocation).
    
    This function allows direct tool execution without going through
    the LLM tool calling loop. Useful for testing and debugging.
    
    Args:
        tool_name: Name of the tool to execute
        tool_args: Arguments for the tool
        db: Database session
        user_id: User ID
        
    Returns:
        Tool execution result
    """
    logger.info(f"Manual tool execution: {tool_name} for user {user_id}")
    
    try:
        result = await asyncio.wait_for(
            execute_tool_call(
                tool_name=tool_name,
                args=tool_args,  # Correct parameter name is 'args'
                db=db,
                user_id=str(user_id),  # Convert to string as expected by execute_tool_call
            ),
            timeout=DEFAULT_TOOL_TIMEOUT,
        )
        
        logger.info(f"✓ Manual tool execution completed: {tool_name}")
        return result
        
    except asyncio.TimeoutError:
        logger.error(
            "Manual tool execution timed out: %s (timeout=%ss)",
            tool_name,
            DEFAULT_TOOL_TIMEOUT,
        )
        return {
            "success": False,
            "error": "Tool execution timed out",
        }
    except Exception as e:
        logger.error(f"Error in manual tool execution: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }
