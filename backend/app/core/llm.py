# backend/app/core/llm.py

import os
import httpx
import asyncio
import time
from typing import Any, AsyncIterator, cast

# NEW SDK imports
from google import genai
from google.genai import types
from dotenv import load_dotenv, find_dotenv
import logging

from app.core.gemini_key_tracker import gemini_tracker
from typing import List, Dict, Literal, Optional

# Langfuse Tracing
from app.core.langfuse_config import trace_llm_call
from app.core import llm_request_tracking
from app.core.zai_chat_completion import request_chat_completion
from app.core.llm_active_model_registry import (
    ActiveChatModelRegistry,
    build_supported_chat_models,
    is_zai_direct_model_name as _is_zai_direct_model_name,
    is_zai_model_name as _is_zai_model_name,
    normalize_active_chat_model as _normalize_active_chat_model_impl,
    normalize_openrouter_model_alias as _normalize_openrouter_model_alias_impl,
    normalize_zai_direct_model_alias as _normalize_zai_direct_model_alias_impl,
    resolve_zai_direct_model_name as _resolve_zai_direct_model_name_impl,
    resolve_zai_model_name as _resolve_zai_model_name_impl,
)
from app.core.llm_dispatch import classify_dispatch_target, resolve_dispatch_request
from app.core.llm_gemini_fallback_policy import (
    extract_error_code,
    is_invalid_model_error,
    is_resource_exhausted_error,
    parse_retry_after_s,
    should_fallback_on_error,
)
from app.core.llm_gemini_circuit_breaker import GeminiCircuitBreaker
from app.core.llm_gemini_fallback_runner import run_gemini_fallback_chain

# Load environment variables
load_dotenv(find_dotenv())

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
# Load primary key and any additional keys (GOOGLE_GENAI_API_KEY_2, _3, etc.)
GEMINI_API_KEYS = []
if os.environ.get("GOOGLE_GENAI_API_KEY"):
    GEMINI_API_KEYS.append(os.environ.get("GOOGLE_GENAI_API_KEY"))

# Check for additional keys (up to 5)
for i in range(2, 6):
    key = os.environ.get(f"GOOGLE_GENAI_API_KEY_{i}")
    if key:
        GEMINI_API_KEYS.append(key)

logger.info(f"Loaded {len(GEMINI_API_KEYS)} Gemini API keys for rotation.")

# Backward compatibility for legacy call sites that still reference GOOGLE_API_KEY.
# Keep as a nullable string so older guards like `if llm.GOOGLE_API_KEY` continue to work.
GOOGLE_API_KEY: Optional[str] = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else None

# Gemini models for different use cases
# NOTE: These are constrained to models confirmed usable in your AI Studio project.
GEMMA_4_31B_MODEL = os.environ.get("GEMMA_4_31B_MODEL", "gemma-4-31b-it")
GEMMA_4_26B_MODEL = os.environ.get("GEMMA_4_26B_MODEL", "gemma-4-26b-a4b-it")
GEMINI_BACKSTOP_MODEL = os.environ.get("GEMINI_BACKSTOP_MODEL", "gemini-3.1-flash-lite-preview")

# Prioritize Gemma-family models by default, while keeping a Gemini model as final backstop.
DEFAULT_GEMINI_MODEL = GEMMA_4_31B_MODEL
GEMINI_LITE_MODEL = GEMMA_4_26B_MODEL
GEMINI_FLASH_MODEL = GEMMA_4_26B_MODEL
GEMINI_PRO_MODEL = GEMMA_4_31B_MODEL  # Legacy name kept for compatibility with existing call sites

# Circuit breaker tuning
_MODEL_FAILURE_WINDOW_S = 60.0
_MODEL_FAILURE_THRESHOLD = 5
_MODEL_COOLDOWN_S = 60.0
_gemini_circuit_breaker = GeminiCircuitBreaker(
    failure_window_s=_MODEL_FAILURE_WINDOW_S,
    failure_threshold=_MODEL_FAILURE_THRESHOLD,
    cooldown_s=_MODEL_COOLDOWN_S,
)

# Fallback chain for Gemini models (in order of preference)
# Keep this list limited to models you can actually call; otherwise the chain may abort early.
GEMINI_FALLBACK_CHAIN = [
    GEMMA_4_31B_MODEL,
    GEMMA_4_26B_MODEL,
    GEMINI_BACKSTOP_MODEL,
]

DEFAULT_GEMMA_LOCAL_MODEL = "gemma-3-12b-it-gguf"  # Local inference via Ollama/vLLM

# OpenRouter (for Z.AI model family)
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_TIMEOUT_S = float(os.environ.get("OPENROUTER_TIMEOUT_S", "90"))
OPENROUTER_ZAI_MODEL = os.environ.get("OPENROUTER_ZAI_MODEL", "z-ai/glm-4.7")

# Direct Z.AI Coding endpoint (GLM Coding Plan compatible)
ZAI_API_KEY = os.environ.get("ZAI_API_KEY")
ZAI_BASE_URL = os.environ.get("ZAI_BASE_URL", "https://api.z.ai/api/coding/paas/v4").rstrip("/")
ZAI_TIMEOUT_S = float(os.environ.get("ZAI_TIMEOUT_S", "90"))
ZAI_DIRECT_MODEL = os.environ.get("ZAI_DIRECT_MODEL", "glm-4.7")
ZAI_ACCEPT_LANGUAGE = os.environ.get("ZAI_ACCEPT_LANGUAGE", "en-US,en")

GEMINI_AUTO_MODEL_ALIAS = "gemini:auto"
SUPPORTED_ZAI_CHAT_MODELS: tuple[str, ...] = (
    "z-ai/glm-4.7",
    "z-ai/glm-4.7-flash",
)
SUPPORTED_ZAI_DIRECT_MODELS: tuple[str, ...] = (
    "glm-4.7",
    "glm-4.7-flash",
    "glm-4.6",
    "glm-4.5",
    "glm-4.5-air",
)

# --- Client Management ---
_gemini_client: Optional[genai.Client] = None
_gemini_client_by_key: dict[int, genai.Client] = {}
_gemini_key_cooldowns: dict[int, float] = {}
_current_key_index: int = 0
_gemini_client_lock = asyncio.Lock()


def _select_gemini_key_index(force_rotate: bool) -> int:
    global _current_key_index

    if not GEMINI_API_KEYS:
        logger.error("No GOOGLE_GENAI_API_KEYs found. Gemini API will not be available.")
        raise ValueError("Google API keys not configured.")

    start_idx = (_current_key_index + 1) % len(GEMINI_API_KEYS) if force_rotate else _current_key_index
    now = time.monotonic()
    chosen_idx: Optional[int] = None

    for offset in range(len(GEMINI_API_KEYS)):
        idx = (start_idx + offset) % len(GEMINI_API_KEYS)
        if _gemini_key_cooldowns.get(idx, 0.0) <= now:
            chosen_idx = idx
            break

    if chosen_idx is None:
        earliest_idx = min(range(len(GEMINI_API_KEYS)), key=lambda i: _gemini_key_cooldowns.get(i, 0.0))
        wait_s = max(0.0, _gemini_key_cooldowns.get(earliest_idx, now) - now)
        logger.warning(
            "All Gemini API keys are in cooldown. Selecting index %s (ready in %.2fs).",
            earliest_idx,
            wait_s,
        )
        chosen_idx = earliest_idx

    _current_key_index = int(chosen_idx)
    return _current_key_index


def _get_or_create_gemini_client(key_index: int) -> genai.Client:
    if key_index in _gemini_client_by_key:
        return _gemini_client_by_key[key_index]
    try:
        client = genai.Client(api_key=GEMINI_API_KEYS[key_index])
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
        raise
    _gemini_client_by_key[key_index] = client
    return client


def select_gemini_model(
    *,
    intent: str | None,
    role: str | None,
    has_tools: bool,
    preferred_model: str | None = None,
) -> str:
    """Select a Gemini model based on intent/role and tool usage.

    This is a lightweight routing policy to reduce cost/latency for low-risk tasks.
    """
    if preferred_model:
        return preferred_model

    active_model = get_active_chat_model()
    if active_model != GEMINI_AUTO_MODEL_ALIAS:
        return active_model

    normalized_intent = (intent or "").lower()
    normalized_role = (role or "").lower()

    if normalized_role in ("admin", "counselor") and normalized_intent in (
        "analytics_query",
        "crisis_intervention",
        "emergency_escalation",
    ):
        return GEMINI_PRO_MODEL

    if normalized_intent in ("crisis_intervention", "emergency_escalation"):
        return GEMINI_PRO_MODEL

    if has_tools or normalized_intent in (
        "emotional_support",
        "appointment_scheduling",
        "information_inquiry",
    ):
        return GEMINI_FLASH_MODEL

    return GEMINI_LITE_MODEL


def _record_model_failure(model: str) -> None:
    _gemini_circuit_breaker.record_failure(model)


def _record_model_success(model: str) -> None:
    _gemini_circuit_breaker.record_success(model)


def _is_model_open(model: str) -> bool:
    return _gemini_circuit_breaker.is_open(model)


def get_gemini_circuit_breaker_status(models: Optional[list[str]] = None) -> list[dict[str, Any]]:
    """Return circuit breaker status for observability."""
    if models is None:
        models = list({
            DEFAULT_GEMINI_MODEL,
            GEMINI_LITE_MODEL,
            GEMINI_FLASH_MODEL,
            GEMINI_PRO_MODEL,
            *GEMINI_FALLBACK_CHAIN,
        })

    return _gemini_circuit_breaker.get_status(models)


async def _mark_gemini_key_cooldown(retry_after_s: float | None) -> None:
    if not GEMINI_API_KEYS:
        return

    min_cooldown_s = 5.0
    max_cooldown_s = 120.0
    cooldown_s = retry_after_s if retry_after_s is not None else min_cooldown_s
    cooldown_s = max(min_cooldown_s, min(cooldown_s, max_cooldown_s))
    key_idx, key_last4 = _current_gemini_key_fingerprint()

    async with _gemini_client_lock:
        _gemini_key_cooldowns[key_idx] = time.monotonic() + cooldown_s

    logger.warning(
        "Cooling down Gemini API key index %s (last4=%s) for %.2fs.",
        key_idx,
        key_last4,
        cooldown_s,
    )


async def get_gemini_client(force_rotate: bool = False) -> genai.Client:
    """Get Gemini client, optionally rotating to the next API key.
    
    Args:
        force_rotate: If True, switches to the next available API key before returning client.
        
    Returns:
        genai.Client: Initialized Gemini client
        
    Raises:
        ValueError: If no API keys are configured
    """
    global _gemini_client

    async with _gemini_client_lock:
        prev_idx = _current_key_index
        selected_idx = _select_gemini_key_index(force_rotate)

        if force_rotate:
            logger.info(
                "Rotating Gemini API key: %s -> %s (key ending in ...%s)",
                prev_idx,
                selected_idx,
                GEMINI_API_KEYS[selected_idx][-4:],
            )
        client = _get_or_create_gemini_client(selected_idx)
        _gemini_client = client
        return client

# --- Provider Type ---
LLMProvider = Literal['gemini', 'gemma_local', 'zai_openrouter', 'zai_direct']


def _normalize_openrouter_model_alias(model_name: str) -> str:
    """Normalize common Z.AI aliases into OpenRouter model IDs."""
    return _normalize_openrouter_model_alias_impl(model_name, OPENROUTER_ZAI_MODEL)


def is_zai_model_name(model_name: Optional[str]) -> bool:
    """Return True when ``model_name`` points to a Z.AI model on OpenRouter."""
    return _is_zai_model_name(model_name, OPENROUTER_ZAI_MODEL)


def _normalize_zai_direct_model_alias(model_name: str) -> str:
    """Normalize direct Z.AI model aliases used by Coding endpoint."""
    return _normalize_zai_direct_model_alias_impl(model_name, ZAI_DIRECT_MODEL)


def is_zai_direct_model_name(model_name: Optional[str]) -> bool:
    """Return True when model name maps to a direct Z.AI Coding endpoint model."""
    return _is_zai_direct_model_name(model_name, ZAI_DIRECT_MODEL)


def _normalize_active_chat_model(model_name: Optional[str]) -> str:
    """Normalize admin-selected active chat model into a canonical value."""
    return _normalize_active_chat_model_impl(
        model_name,
        has_zai_api_key=bool(ZAI_API_KEY),
        direct_default_model=ZAI_DIRECT_MODEL,
        openrouter_default_model=OPENROUTER_ZAI_MODEL,
        gemini_auto_alias=GEMINI_AUTO_MODEL_ALIAS,
    )


default_active_chat_model = GEMINI_AUTO_MODEL_ALIAS
try:
    _ACTIVE_CHAT_MODEL = _normalize_active_chat_model(
        os.environ.get("ACTIVE_CHAT_MODEL", default_active_chat_model)
    )
except ValueError as exc:
    logger.warning(
        "Invalid ACTIVE_CHAT_MODEL value. Falling back to %s. Error: %s",
        default_active_chat_model,
        exc,
    )
    _ACTIVE_CHAT_MODEL = default_active_chat_model

_active_chat_model_registry = ActiveChatModelRegistry(_ACTIVE_CHAT_MODEL)


def _sync_active_model_from_legacy_global() -> None:
    """Support legacy direct overrides of llm._ACTIVE_CHAT_MODEL in tests/tools."""
    global _ACTIVE_CHAT_MODEL
    registry_value = _active_chat_model_registry.get()
    if _ACTIVE_CHAT_MODEL == registry_value:
        return

    try:
        normalized = _normalize_active_chat_model(_ACTIVE_CHAT_MODEL)
    except ValueError:
        _ACTIVE_CHAT_MODEL = registry_value
        return

    _active_chat_model_registry.set(normalized)
    _ACTIVE_CHAT_MODEL = normalized


def get_active_chat_model() -> str:
    """Get the runtime-active chat model used when request does not specify a model."""
    _sync_active_model_from_legacy_global()
    return _active_chat_model_registry.get()


def get_active_chat_provider() -> str:
    """Get the provider implied by the current active chat model."""
    active_model = get_active_chat_model()
    if is_zai_direct_model_name(active_model):
        return "zai_coding_plan"
    if is_zai_model_name(active_model):
        return "zai_openrouter"
    return "gemini_google"


def set_active_chat_model(model_name: str) -> str:
    """Set runtime-active chat model and return normalized value."""
    normalized = _normalize_active_chat_model(model_name)
    global _ACTIVE_CHAT_MODEL
    _active_chat_model_registry.set(normalized)
    _ACTIVE_CHAT_MODEL = normalized
    return normalized


def get_supported_chat_models() -> List[str]:
    """Return deduplicated supported model list for admin controls."""
    return build_supported_chat_models(
        gemini_auto_alias=GEMINI_AUTO_MODEL_ALIAS,
        direct_default_model=ZAI_DIRECT_MODEL,
        supported_direct_models=SUPPORTED_ZAI_DIRECT_MODELS,
        openrouter_default_model=OPENROUTER_ZAI_MODEL,
        supported_openrouter_models=SUPPORTED_ZAI_CHAT_MODELS,
        normalizer=_normalize_active_chat_model,
    )


def _resolve_zai_model_name(preferred_model: Optional[str]) -> str:
    """Resolve target Z.AI model, falling back to the configured default."""
    return _resolve_zai_model_name_impl(
        preferred_model,
        active_model=get_active_chat_model(),
        openrouter_default_model=OPENROUTER_ZAI_MODEL,
    )


def _resolve_zai_direct_model_name(preferred_model: Optional[str]) -> str:
    """Resolve target Z.AI direct model for Coding endpoint usage."""
    return _resolve_zai_direct_model_name_impl(
        preferred_model,
        active_model=get_active_chat_model(),
        direct_default_model=ZAI_DIRECT_MODEL,
    )


@trace_llm_call("openrouter-zai")
async def generate_openrouter_response(
    history: List[Dict[str, str]],
    model: str = OPENROUTER_ZAI_MODEL,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
    json_schema: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate a response via OpenRouter (Z.AI model family)."""
    if not OPENROUTER_API_KEY:
        return "Error: OPENROUTER_API_KEY is not configured."

    resolved_model = _resolve_zai_model_name(model)
    endpoint = f"{OPENROUTER_BASE_URL}/chat/completions"
    return await request_chat_completion(
        endpoint=endpoint,
        api_key=OPENROUTER_API_KEY,
        timeout_s=OPENROUTER_TIMEOUT_S,
        model=resolved_model,
        history=history,
        max_tokens=max_tokens,
        temperature=temperature,
        system_prompt=system_prompt,
        json_mode=json_mode,
        empty_response_error="Received empty response from Z.AI model.",
        request_failed_prefix="OpenRouter request failed",
        connection_failed_prefix="Failed to connect to OpenRouter",
        rate_limit_prefix="OpenRouter rate limit",
        unexpected_failed_prefix="Z.AI request failed",
        json_schema=json_schema,
    )


@trace_llm_call("zai-direct-coding")
async def generate_zai_direct_response(
    history: List[Dict[str, str]],
    model: str = ZAI_DIRECT_MODEL,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
    json_schema: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate a response via direct Z.AI Coding endpoint."""
    if not ZAI_API_KEY:
        return "Error: ZAI_API_KEY is not configured."

    resolved_model = _resolve_zai_direct_model_name(model)
    endpoint = f"{ZAI_BASE_URL}/chat/completions"
    return await request_chat_completion(
        endpoint=endpoint,
        api_key=ZAI_API_KEY,
        timeout_s=ZAI_TIMEOUT_S,
        model=resolved_model,
        history=history,
        max_tokens=max_tokens,
        temperature=temperature,
        system_prompt=system_prompt,
        json_mode=json_mode,
        empty_response_error="Received empty response from Z.AI direct endpoint.",
        request_failed_prefix="Z.AI direct endpoint request failed",
        connection_failed_prefix="Failed to connect to Z.AI direct endpoint",
        rate_limit_prefix="Z.AI direct endpoint rate limit",
        unexpected_failed_prefix="Z.AI direct request failed",
        accept_language=ZAI_ACCEPT_LANGUAGE,
    )

# --- Helper: Convert Generic History to New SDK Format ---
def _convert_history_to_contents(history: List[Dict[str, str]]) -> List[types.Content]:
    """Convert generic history format to new SDK Content objects.
    
    Args:
        history: List of {'role': 'user'|'assistant', 'content': str}
        
    Returns:
        List of types.Content objects
    """
    contents: List[types.Content] = []
    for msg in history:
        role = msg.get("role")
        content = msg.get("content")
        if not content:
            continue

        # System instructions should be passed via config.system_instruction.
        if role == "system":
            continue
        
        # Map 'assistant' to 'model' for Gemini
        gemini_role = "model" if role == "assistant" else "user"
        
        contents.append(
            types.Content(
                role=gemini_role,
                parts=[types.Part.from_text(text=content)]  # keyword argument
            )
        )
    return contents


def _convert_tool_schemas_for_new_sdk(tool_wrappers: List[Dict[str, Any]]) -> List[types.Tool]:
    """Convert tool schemas to new google-genai SDK format.
    
    The new SDK uses:
    - types.Tool with function_declarations
    - types.FunctionDeclaration for each tool
    - Lowercase type names: "object", "string", "integer" (not "OBJECT", "STRING")
    - Pydantic-based validation
    
    Expected input format: [{"function_declarations": [{"name": ..., "description": ..., "parameters": ...}]}]
    
    Args:
        tool_wrappers: List of tool wrapper dicts containing function_declarations
        
    Returns:
        List of types.Tool objects compatible with new SDK
    """
    # Fields allowed in Schema (parameters and nested properties)
    SCHEMA_ALLOWED_FIELDS = {"type", "description", "properties", "required", "items", "enum", "format"}
    # Fields allowed in FunctionDeclaration
    FUNCTION_ALLOWED_FIELDS = {"name", "description", "parameters"}
    
    def convert_types_to_lowercase(obj: Any) -> Any:
        """Recursively convert type strings to lowercase (new SDK requirement)."""
        if isinstance(obj, dict):
            result = {}
            for key, value in obj.items():
                if key == "type" and isinstance(value, str):
                    # Convert "STRING" -> "string", "OBJECT" -> "object"
                    result[key] = value.lower()
                else:
                    result[key] = convert_types_to_lowercase(value)
            return result
        elif isinstance(obj, list):
            return [convert_types_to_lowercase(item) for item in obj]
        else:
            return obj
    
    def clean_schema(schema: Any, path: str = "") -> Any:
        """Recursively clean schema objects, removing non-standard fields."""
        if isinstance(schema, dict):
            cleaned = {}
            for key, value in schema.items():
                if key in SCHEMA_ALLOWED_FIELDS:
                    # Recursively clean nested schemas
                    if key == "properties" and isinstance(value, dict):
                        cleaned[key] = {k: clean_schema(v, f"{path}.{k}") for k, v in value.items()}
                    elif key == "items" and isinstance(value, dict):
                        cleaned[key] = clean_schema(value, f"{path}.items")
                    else:
                        cleaned[key] = value
                else:
                    logger.debug(f"Removing non-standard Schema field '{key}' from {path or 'root'}")
            return cleaned
        elif isinstance(schema, list):
            return [clean_schema(item, path) for item in schema]
        else:
            return schema
    
    def clean_function_declaration(func_decl: Dict[str, Any]) -> Dict[str, Any]:
        """Remove non-standard fields from function declaration."""
        cleaned = {}
        tool_name = func_decl.get('name', 'unknown')
        
        for key, value in func_decl.items():
            if key in FUNCTION_ALLOWED_FIELDS:
                if key == "parameters" and isinstance(value, dict):
                    # Deep clean the parameters schema
                    cleaned[key] = clean_schema(value, f"tool:{tool_name}")
                else:
                    cleaned[key] = value
            else:
                logger.debug(f"Removing non-standard FunctionDeclaration field '{key}' from tool '{tool_name}'")
        
        return cleaned
    
    # Process each tool wrapper and convert to new SDK format
    result: List[types.Tool] = []
    for wrapper in tool_wrappers:
        if "function_declarations" not in wrapper:
            logger.warning(f"Tool wrapper missing 'function_declarations': {wrapper}")
            continue
        
        func_decls_list: List[types.FunctionDeclaration] = []
        for decl in wrapper["function_declarations"]:
            # Convert types to lowercase and clean
            converted = convert_types_to_lowercase(decl)
            cleaned = clean_function_declaration(converted)
            
            # Create FunctionDeclaration object
            try:
                func_decl = types.FunctionDeclaration(
                    name=cleaned["name"],
                    description=cleaned.get("description", ""),
                    parameters=cleaned.get("parameters", {})
                )
                func_decls_list.append(func_decl)
            except Exception as e:
                logger.error(f"Failed to create FunctionDeclaration for {cleaned.get('name')}: {e}")
                continue
        
        if func_decls_list:
            result.append(types.Tool(function_declarations=func_decls_list))
    
    logger.debug(f"Converted {len(tool_wrappers)} tool wrappers to {len(result)} Tool objects for new SDK")
    return result


def _normalize_tools_for_generate_config(tools: Optional[List[Any]]) -> Optional[List[types.Tool]]:
    if not tools:
        return None
    if isinstance(tools[0], types.Tool):
        return cast(List[types.Tool], tools)
    return _convert_tool_schemas_for_new_sdk(tools)


def _is_invalid_model_error(status_code: int, error_msg: str) -> bool:
    """Best-effort detection for "model not available / not found" errors.

    We treat these as a signal to try the next fallback model (not a hard failure),
    because AI Studio projects can have per-model allowlists.
    """
    return is_invalid_model_error(status_code, error_msg)


def _current_gemini_key_fingerprint() -> tuple[int, str]:
    """Return (index, last4) for the currently-selected Gemini API key.

    This is for log attribution only; it never returns the full key.
    """

    global _current_key_index
    idx = int(_current_key_index)
    try:
        key = GEMINI_API_KEYS[idx]
    except Exception:
        return idx, "????"
    key_str = str(key or "")
    return idx, (key_str[-4:] if len(key_str) >= 4 else "????")


def _parse_retry_after_s(error_msg: str) -> float | None:
    """Best-effort parse for SDK messages like: "Please retry in 45.63s"."""
    return parse_retry_after_s(error_msg)


def _extract_error_code(error: Exception) -> int:
    """Best-effort extract HTTP-like error code from SDK exceptions/messages."""
    return extract_error_code(error)


def _is_resource_exhausted_error(status_code: int, error_msg: str) -> bool:
    return is_resource_exhausted_error(status_code, error_msg)


class GeminiResourceExhaustedError(RuntimeError):
    """Raised when Gemini returns RESOURCE_EXHAUSTED and we cannot recover.

    This exception carries safe attribution (model name and API key fingerprint)
    so upstream code can log once and clients (e.g. notebook evaluators) can
    pause/resume.
    """

    def __init__(
        self,
        *,
        model: str,
        api_key_index: int,
        api_key_last4: str,
        retry_after_s: float | None,
        message: str,
    ) -> None:
        super().__init__(message)
        self.model = model
        self.api_key_index = api_key_index
        self.api_key_last4 = api_key_last4
        self.retry_after_s = retry_after_s



# --- Gemini API Function (Async) - Migrated to new SDK ---
@trace_llm_call("gemini-genai-sdk")
async def generate_gemini_response(
    history: List[Dict[str, str]],
    model: str = DEFAULT_GEMINI_MODEL,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None,
    tools: Optional[List[Any]] = None,
    return_full_response: bool = False,
    json_mode: bool = False,
    json_schema: Optional[Dict[str, Any]] = None,
) -> str | Any:
    """Generates a response using the Google Gemini API with new google-genai SDK.
    
    This function has been migrated from google-generativeai to google-genai.
    Key changes:
    - Uses client.models.generate_content() instead of GenerativeModel
    - No more start_chat() - uses contents array with full history
    - System prompt via config.system_instruction
    - Tools via config.tools
    - Types are lowercase ("string" not "STRING")
    
    Args:
        history: Conversation history with role and content
        model: Gemini model to use
        max_tokens: Maximum tokens in response
        temperature: Sampling temperature
        system_prompt: Optional system instruction
        tools: Optional list of Tool objects for function calling
        return_full_response: If True, returns full response object for tool calling
        json_mode: If True, forces the model to output valid JSON
        json_schema: Optional JSON schema to enforce when json_mode=True
        
    Returns:
        Generated response text, or full response object if return_full_response=True
    """
    try:
        call_index = llm_request_tracking.increment_request(model=model)
        client = await get_gemini_client()
        logger.info(
            f"Sending request to Gemini API (Model: {model}, Tools: {bool(tools)}, JSON: {json_mode}, Schema: {bool(json_schema)})",
            extra={
                "user_id": llm_request_tracking.get_user_id(),
                "session_id": llm_request_tracking.get_session_id(),
                "prompt_id": llm_request_tracking.get_prompt_id(),
                "llm_call_index": call_index,
                "llm_model": model,
                "llm_phase": "generate_gemini_response",
                "llm_has_tools": bool(tools),
            },
        )
        if system_prompt:
            logger.info(f"🤖 System prompt applied: {system_prompt[:100]}...")

        # Validate history
        if not history or history[-1]['role'] != 'user':
            return "Error: Conversation history must end with a user message."

        # Convert history to new SDK Content format
        contents = _convert_history_to_contents(history)

        # Build generation config
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        if json_mode:
            config.response_mime_type = "application/json"
            if json_schema is not None:
                config.response_schema = cast(Any, json_schema)
        
        # Add system prompt if provided
        if system_prompt:
            config.system_instruction = system_prompt
        
        # Add tools if provided
        normalized_tools = _normalize_tools_for_generate_config(tools)
        if normalized_tools:
            config.tools = normalized_tools
            logger.debug(f"Enabled {len(normalized_tools)} tool(s) for this request")
        
        # Add safety settings
        # Note: Use enum values to satisfy typing (Pylance).
        config.safety_settings = [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
        ]

        # Generate content with new SDK
        # Run blocking call in executor to avoid blocking the event loop
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model=model,
                contents=cast(Any, contents),
                config=config
            )
        )

        # Return full response if requested (for tool calling)
        if return_full_response:
            return response
        
        # Extract text from response
        try:
            if hasattr(response, 'text') and response.text:
                return response.text.strip()
            
            # If we get here, response.text is None or empty, or doesn't exist
            logger.warning("Gemini response text is missing or empty.")

            # Try to provide a more specific error when available.
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                if hasattr(response.prompt_feedback, 'block_reason') and response.prompt_feedback.block_reason:
                    reason = str(response.prompt_feedback.block_reason)
                    logger.warning(f"Gemini request blocked. Reason: {reason}")
                    return f"Error: Request blocked by safety filters ({reason}). Please rephrase your prompt."

            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if hasattr(candidate, 'finish_reason') and candidate.finish_reason:
                    reason = str(candidate.finish_reason)
                    if reason != 'STOP':
                        logger.warning(f"Gemini generation stopped unexpectedly. Reason: {reason}")
                        return f"Error: Generation stopped ({reason})."

            return "Error: Received an empty or invalid response from Gemini."
            
        except (ValueError, AttributeError) as e:
            # Check if this is a function call (not an error)
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'function_call') and part.function_call:
                            # This is a function call, not an error
                            if return_full_response:
                                return response
                            logger.error("Function call received but return_full_response=False")
                            return "Error: Function calling is not properly configured."
            
            # This is actually an error or blocked content
            logger.warning(f"Gemini response might be blocked or empty: {e}")
            
            # Check for blocked content
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                if hasattr(response.prompt_feedback, 'block_reason') and response.prompt_feedback.block_reason:
                    reason = str(response.prompt_feedback.block_reason)
                    logger.warning(f"Gemini request blocked. Reason: {reason}")
                    return f"Error: Request blocked by safety filters ({reason}). Please rephrase your prompt."
            
            # Check finish reason
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if hasattr(candidate, 'finish_reason') and candidate.finish_reason:
                    reason = str(candidate.finish_reason)
                    if reason != 'STOP':
                        logger.warning(f"Gemini generation stopped unexpectedly. Reason: {reason}")
                        return f"Error: Generation stopped ({reason})."
            
            logger.warning("Gemini returned empty or invalid response.")
            return "Error: Received an empty or invalid response from Gemini."
        
    except ValueError as e:
        logger.error(f"ValueError calling Gemini API: {e}")
        return f"Error: Invalid configuration or request. {e}"
    except Exception as e:
        # Let fallback handlers decide what to do; keep expected provider errors concise.
        try:
            from google.genai.errors import ClientError, ServerError
            is_provider_error = isinstance(e, (ClientError, ServerError))
        except Exception:
            is_provider_error = False

        error_code = _extract_error_code(e)
        error_msg = str(e)
        if is_provider_error and _is_resource_exhausted_error(error_code, error_msg):
            logger.warning(
                "Gemini quota/throttle event detected (code=%s): %s",
                error_code,
                error_msg[:300],
            )
            raise

        if is_provider_error:
            logger.warning("Gemini provider error (code=%s): %s", error_code, error_msg[:300])
            raise

        logger.error(f"Error calling Gemini API: {e}", exc_info=True)
        raise


@trace_llm_call("gemini-genai-sdk-content")
async def generate_gemini_content(
    *,
    contents: List[types.Content],
    model: str,
    config: types.GenerateContentConfig,
    return_full_response: bool = False,
) -> str | Any:
    """Generate a response using pre-built Content objects.

    This is used by the tool-calling loop, where we must send structured
    function_call and function_response parts back to Gemini.
    """
    try:
        call_index = llm_request_tracking.increment_request(model=model)
        client = await get_gemini_client()
        loop = asyncio.get_running_loop()

        logger.info(
            "Sending request to Gemini API (contents mode)",
            extra={
                "user_id": llm_request_tracking.get_user_id(),
                "session_id": llm_request_tracking.get_session_id(),
                "prompt_id": llm_request_tracking.get_prompt_id(),
                "llm_call_index": call_index,
                "llm_model": model,
                "llm_phase": "generate_gemini_content",
                "llm_has_tools": bool(getattr(config, "tools", None)),
            },
        )

        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model=model,
                contents=cast(Any, contents),
                config=config,
            ),
        )

        if return_full_response:
            return response

        if hasattr(response, "text") and response.text:
            return response.text.strip()

        return "Error: Received an empty or invalid response from Gemini."
    except Exception as e:
        try:
            from google.genai.errors import ClientError, ServerError
            is_provider_error = isinstance(e, (ClientError, ServerError))
        except Exception:
            is_provider_error = False

        error_code = _extract_error_code(e)
        error_msg = str(e)
        if is_provider_error and _is_resource_exhausted_error(error_code, error_msg):
            logger.warning(
                "Gemini quota/throttle event detected (contents mode, code=%s): %s",
                error_code,
                error_msg[:300],
            )
            raise

        if is_provider_error:
            logger.warning("Gemini provider error in contents mode (code=%s): %s", error_code, error_msg[:300])
            raise

        logger.error(f"Error calling Gemini API (contents): {e}", exc_info=True)
        raise


@trace_llm_call("gemini-fallback-chain-content")
async def generate_gemini_content_with_fallback(
    *,
    contents: List[types.Content],
    model: str = DEFAULT_GEMINI_MODEL,
    config: Optional[types.GenerateContentConfig] = None,
    return_full_response: bool = False,
    allow_retry_sleep: bool = True,
) -> str | Any:
    """Generate Gemini response with automatic fallback, using pre-built contents."""
    if config is None:
        config = types.GenerateContentConfig(max_output_tokens=2048, temperature=0.7)

    return await run_gemini_fallback_chain(
        model=model,
        fallback_chain=GEMINI_FALLBACK_CHAIN,
        key_count=len(GEMINI_API_KEYS),
        allow_retry_sleep=allow_retry_sleep,
        contents_mode=True,
        call_model=lambda current_model: generate_gemini_content(
            contents=contents,
            model=current_model,
            config=config,
            return_full_response=return_full_response,
        ),
        is_model_open=_is_model_open,
        record_model_success=_record_model_success,
        record_model_failure=_record_model_failure,
        record_request=gemini_tracker.record_request,
        current_key_fingerprint=_current_gemini_key_fingerprint,
        parse_retry_after_s=_parse_retry_after_s,
        extract_error_code=_extract_error_code,
        is_invalid_model_error=_is_invalid_model_error,
        is_resource_exhausted_error=_is_resource_exhausted_error,
        should_fallback_on_error=should_fallback_on_error,
        mark_key_cooldown=_mark_gemini_key_cooldown,
        rotate_key=lambda: get_gemini_client(force_rotate=True),
        exhausted_error_factory=GeminiResourceExhaustedError,
        logger=logger,
    )


@trace_llm_call("gemini-fallback-chain")
async def generate_gemini_response_with_fallback(
    history: List[Dict[str, str]],
    model: str = DEFAULT_GEMINI_MODEL,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None,
    tools: Optional[List[Any]] = None,
    return_full_response: bool = False,
    json_mode: bool = False,
    json_schema: Optional[Dict[str, Any]] = None,
    allow_retry_sleep: bool = True,
) -> str | Any:
    """Generate Gemini response with automatic fallback to alternative models.
    
    This function tries the specified model first, then falls back through
    GEMINI_FALLBACK_CHAIN if quota/rate limit errors occur.
    
    Fallback triggers:
    - 429 RESOURCE_EXHAUSTED (quota exceeded)
    - 503 UNAVAILABLE (model overloaded)
    
    Args:
        Same as generate_gemini_response
        allow_retry_sleep: If False, skip retry-after sleeps for interactive UX.
        
    Returns:
        Generated response or raises exception if all models fail
    """
    return await run_gemini_fallback_chain(
        model=model,
        fallback_chain=GEMINI_FALLBACK_CHAIN,
        key_count=len(GEMINI_API_KEYS),
        allow_retry_sleep=allow_retry_sleep,
        contents_mode=False,
        call_model=lambda current_model: generate_gemini_response(
            history=history,
            model=current_model,
            max_tokens=max_tokens,
            temperature=temperature,
            system_prompt=system_prompt,
            tools=tools,
            return_full_response=return_full_response,
            json_mode=json_mode,
            json_schema=json_schema,
        ),
        is_model_open=_is_model_open,
        record_model_success=_record_model_success,
        record_model_failure=_record_model_failure,
        record_request=gemini_tracker.record_request,
        current_key_fingerprint=_current_gemini_key_fingerprint,
        parse_retry_after_s=_parse_retry_after_s,
        extract_error_code=_extract_error_code,
        is_invalid_model_error=_is_invalid_model_error,
        is_resource_exhausted_error=_is_resource_exhausted_error,
        should_fallback_on_error=should_fallback_on_error,
        mark_key_cooldown=_mark_gemini_key_cooldown,
        rotate_key=lambda: get_gemini_client(force_rotate=True),
        exhausted_error_factory=GeminiResourceExhaustedError,
        logger=logger,
    )



async def stream_gemini_response(
    history: List[Dict[str, str]],
    model: str = DEFAULT_GEMINI_MODEL,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None,
    tools: Optional[List[Any]] = None,
) -> AsyncIterator[str]:
    """Stream response chunks from the Gemini API with new google-genai SDK.
    
    This function has been migrated to use client.models.generate_content_stream().
    Key changes:
    - No more start_chat() with stream=True
    - Uses generate_content_stream() method directly
    - Contents array includes full history
    
    Args:
        history: Conversation history with role and content
        model: Gemini model to use
        max_tokens: Maximum tokens in response
        temperature: Sampling temperature
        system_prompt: Optional system instruction
        tools: Optional list of Tool objects for function calling
        
    Yields:
        Response text chunks
    """
    try:
        call_index = llm_request_tracking.increment_request(model=model)
        client = await get_gemini_client()

        logger.info(
            "Sending streaming request to Gemini API",
            extra={
                "user_id": llm_request_tracking.get_user_id(),
                "session_id": llm_request_tracking.get_session_id(),
                "prompt_id": llm_request_tracking.get_prompt_id(),
                "llm_call_index": call_index,
                "llm_model": model,
                "llm_phase": "stream_gemini_response",
                "llm_has_tools": bool(tools),
            },
        )

        if not history or history[-1]["role"] != "user":
            yield "Error: Conversation history must end with a user message."
            return

        # Convert history to new SDK Content format
        contents = _convert_history_to_contents(history)

        # Build generation config
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        # Add system prompt if provided
        if system_prompt:
            config.system_instruction = system_prompt
        
        normalized_tools = _normalize_tools_for_generate_config(tools)
        if normalized_tools:
            config.tools = normalized_tools
            logger.debug(f"Enabled {len(normalized_tools)} tool(s) for streaming request")

        # Add safety settings
        # Note: Use enum values to satisfy typing (Pylance).
        config.safety_settings = [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
        ]

        # Stream content with new SDK (note: this is NOT async, returns regular generator)
        # The new SDK's generate_content_stream returns a synchronous generator
        stream = client.models.generate_content_stream(
            model=model,
            contents=cast(Any, contents),
            config=config
        )

        yielded = False
        # Use regular for loop (not async for) as SDK returns sync generator
        for chunk in stream:
            try:
                if hasattr(chunk, 'text') and chunk.text:
                    yielded = True
                    yield chunk.text
            except (ValueError, AttributeError) as e:
                # Chunk might not have text (could be function call or empty)
                logger.debug(f"Gemini stream chunk parse issue: {e}")
                continue

        # If nothing was yielded, try non-streaming as fallback
        if not yielded:
            logger.warning("No chunks yielded, falling back to non-streaming")
            fallback = await generate_gemini_response(
                history=history,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system_prompt=system_prompt,
                tools=tools,
            )
            if fallback:
                yield fallback

    except Exception as exc:
        try:
            from google.genai.errors import ClientError, ServerError

            if isinstance(exc, (ClientError, ServerError)):
                error_code = getattr(exc, "status_code", 0)
                error_msg = str(exc)
                if _is_resource_exhausted_error(int(error_code), error_msg):
                    key_idx, key_last4 = _current_gemini_key_fingerprint()
                    logger.debug(
                        "Gemini streaming quota exhausted: model=%s code=%s key_idx=%s key_last4=%s",
                        model,
                        error_code,
                        key_idx,
                        key_last4,
                    )
                    raise GeminiResourceExhaustedError(
                        model=model,
                        api_key_index=key_idx,
                        api_key_last4=key_last4,
                        retry_after_s=_parse_retry_after_s(error_msg),
                        message=error_msg,
                    ) from exc
        except Exception:
            pass

        logger.error("Error streaming from Gemini API: %s", exc, exc_info=True)
        yield f"Error: An unexpected error occurred with Gemini API. {exc}"

# --- Local Gemma 3 API Function (Async) ---
async def generate_gemma_local_response(
    history: List[Dict[str, str]],
    model: str = DEFAULT_GEMMA_LOCAL_MODEL, # Model name is for logging
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None
) -> str:
    """Generates a response using the self-hosted Gemma 3 API."""
    # The URL uses the Docker service name, which acts as a hostname.
    gemma_api_url = "http://gemma_service:6666/v1/generate"
    
    # Construct a single prompt from history. Llama-based models often work best this way.
    # You may need to experiment with the prompt templating for your fine-tuned model.
    prompt_lines = []
    if system_prompt:
        prompt_lines.append(f"<|system|>\n{system_prompt}")
    for msg in history:
        role = msg.get("role")
        content = msg.get("content")
        if role == 'user':
            prompt_lines.append(f"<|user|>\n{content}")
        elif role == 'assistant':
            prompt_lines.append(f"<|assistant|>\n{content}")
            
    # Combine into a single string
    full_prompt = "\n".join(prompt_lines)

    data = {
        "prompt": full_prompt,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=120.0) as client: # Longer timeout for local generation
        try:
            logger.info(f"Sending request to local Gemma API (Model: {model})")
            response = await client.post(gemma_api_url, json=data)
            response.raise_for_status()
            result = response.json()
            
            if "generated_text" in result:
                logger.info("Received response from local Gemma API.")
                return result["generated_text"].strip()
            else:
                logger.warning(f"Unexpected response structure from local Gemma API: {result}")
                return "Error: Could not parse response from local Gemma API."

        except httpx.RequestError as e:
            logger.error(f"HTTP error calling local Gemma API: {e}")
            return "Error: Failed to connect to local Gemma API. Ensure the 'gemma_service' container is running and healthy."
        except httpx.HTTPStatusError as e:
             logger.error(f"Local Gemma API returned error status {e.response.status_code}: {e.response.text}")
             return f"Error: Local Gemma API failed ({e.response.status_code}). Please check its logs."
        except Exception as e:
            logger.error(f"An unexpected error occurred with local Gemma API: {e}", exc_info=True)
            return f"Error: An unexpected error occurred. {e}"

# --- Unified Generation Function (Async) ---
async def generate_response(
    history: List[Dict[str, str]],
    model: Optional[str] = None,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    system_prompt: Optional[str] = None, # Pass system prompt through
    preferred_gemini_model: Optional[str] = None,  # Allow specifying exact Gemini model
    json_mode: bool = False,
    json_schema: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generates a response using the specified LLM provider with automatic fallback.

    Args:
        history: The conversation history (list of {'role': str, 'content': str}).
                 Must end with a 'user' message.
        model: The LLM model ('gemma_local', 'gemini_google', 'zai_openrouter', or 'zai_direct').
        max_tokens: Maximum number of tokens to generate.
        temperature: Controls randomness (0.0-1.0+).
        system_prompt: An optional system prompt.
        preferred_gemini_model: Preferred model identifier. For Gemini this is a Gemini model ID,
                       while Z.AI requests can pass an OpenRouter model ID such as
                       'z-ai/glm-4.7' or a direct coding model such as 'glm-4.7'.
        json_mode: If True, asks the provider to return JSON where supported.

    Returns:
        The generated text response string or an error message.
    """
    resolved_request = resolve_dispatch_request(
        model=model,
        preferred_model=preferred_gemini_model,
        active_model=get_active_chat_model(),
        gemini_auto_alias=GEMINI_AUTO_MODEL_ALIAS,
        is_zai_direct=is_zai_direct_model_name,
        is_zai_openrouter=is_zai_model_name,
    )
    model = resolved_request.model
    effective_preferred_model = resolved_request.effective_preferred_model

    logger.info(
        "Generating response using model: %s, preferred model: %s",
        model,
        effective_preferred_model,
    )

    if not history or history[-1].get('role') != 'user':
        logger.error("Invalid history: Must not be empty and end with a 'user' message.")
        return "Error: Invalid conversation history provided."

    if model == "gemma_local":
        gemma_model = model if model else DEFAULT_GEMMA_LOCAL_MODEL
        logger.info(f"Direct request: Using gemma_local (Model: {gemma_model})")
        return await generate_gemma_local_response(
            history=history, model=gemma_model, max_tokens=max_tokens, temperature=temperature, system_prompt=system_prompt
        )

    is_zai_direct_requested, is_zai_openrouter_requested = classify_dispatch_target(
        model=model,
        preferred_model=effective_preferred_model,
        is_zai_direct=is_zai_direct_model_name,
        is_zai_openrouter=is_zai_model_name,
    )
    requested_model = (effective_preferred_model or "").strip()

    if is_zai_direct_requested and not is_zai_openrouter_requested:
        zai_direct_model = _resolve_zai_direct_model_name(requested_model)
        logger.info("Direct request: Using Z.AI Coding endpoint model (Model: %s)", zai_direct_model)
        return await generate_zai_direct_response(
            history=history,
            model=zai_direct_model,
            max_tokens=max_tokens,
            temperature=temperature,
            system_prompt=system_prompt,
            json_mode=json_mode,
            json_schema=json_schema,
        )

    if is_zai_openrouter_requested:
        zai_model = _resolve_zai_model_name(requested_model)
        logger.info("Direct request: Using OpenRouter Z.AI model (Model: %s)", zai_model)
        return await generate_openrouter_response(
            history=history,
            model=zai_model,
            max_tokens=max_tokens,
            temperature=temperature,
            system_prompt=system_prompt,
            json_mode=json_mode,
        )

    elif model == "gemini_google":
        # Use preferred model or default
        gemini_model = effective_preferred_model or DEFAULT_GEMINI_MODEL
        logger.info(f"Direct request: Using gemini with fallback chain (Primary: {gemini_model})")
        try:
            return await generate_gemini_response_with_fallback(
                history=history, model=gemini_model, max_tokens=max_tokens, temperature=temperature, system_prompt=system_prompt, json_mode=json_mode
            )
        except Exception as e:
            # If all fallbacks fail, return error message
            logger.error(f"All Gemini models failed: {e}")
            return f"Error: All Gemini models are currently unavailable. {str(e)[:200]}"
    
    else:
        # This case should ideally be prevented by Pydantic/FastAPI validation
        error_msg = (
            f"Invalid LLM model: {model}. "
            "Choose 'gemma_local', 'gemini_google', 'zai_openrouter', or 'zai_direct'."
        )
        logger.error(error_msg)
        return error_msg

# --- Constants for default models (can be imported elsewhere) ---
DEFAULT_PROVIDERS = {
    "gemini": DEFAULT_GEMINI_MODEL,
    "gemma_local": DEFAULT_GEMMA_LOCAL_MODEL,
    "zai_direct": ZAI_DIRECT_MODEL,
    "zai_openrouter": OPENROUTER_ZAI_MODEL,
}
