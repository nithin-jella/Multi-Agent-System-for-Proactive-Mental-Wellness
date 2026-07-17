"""
Tool Registry System with Decorator Pattern

This module provides a centralized registry for all Aika tools, eliminating redundancy
and providing a single source of truth for tool definitions.

Architecture:
- Tools are registered using @register_tool decorator
- Schema definitions are co-located with implementations
- Auto-generates Gemini function calling schemas
- Auto-routes tool execution in orchestrator

Usage:
    @register_tool(
        name="book_appointment",
        description="Book a counseling appointment",
        parameters={...}
    )
    async def book_appointment(db, user_id, appointment_datetime, **kwargs):
        # Implementation
        pass
"""
from __future__ import annotations

import logging
import difflib
from typing import Any, Callable, Dict, Optional
from functools import wraps

logger = logging.getLogger(__name__)


# ============================================================================
# GLOBAL TOOL REGISTRY
# ============================================================================

_TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# DECORATOR: @register_tool
# ============================================================================

def register_tool(
    name: str,
    description: str,
    parameters: Dict[str, Any],
    category: str = "general",
    requires_db: bool = True,
    requires_user_id: bool = True,
):
    """
    Decorator to register a tool with the Aika tool system.
    
    Args:
        name: Tool name (must be unique)
        description: Detailed description for Gemini to understand when to use
        parameters: JSON Schema for tool parameters
        category: Tool category (agent, scheduling, user, analytics, etc.)
        requires_db: Whether tool needs database session
        requires_user_id: Whether tool needs user_id
        
    Returns:
        Decorated function registered in global tool registry
        
    Example:
        @register_tool(
            name="book_appointment",
            description="Book counseling appointment",
            parameters={
                "type": "object",
                "properties": {
                    "appointment_datetime": {
                        "type": "string",
                        "description": "ISO datetime"
                    }
                },
                "required": ["appointment_datetime"]
            }
        )
        async def book_appointment(db, user_id, appointment_datetime, **kwargs):
            # Implementation
            return {"success": True, "appointment": {...}}
    """
    def decorator(func: Callable) -> Callable:
        # Validate tool name is unique
        if name in _TOOL_REGISTRY:
            logger.warning(f"Tool '{name}' is already registered. Overwriting...")
        
        # Register tool
        _TOOL_REGISTRY[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
            "category": category,
            "requires_db": requires_db,
            "requires_user_id": requires_user_id,
            "handler": func,
        }
        
        logger.debug(f"✅ Registered tool: {name} (category: {category})")
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        
        return wrapper
    
    return decorator


# ============================================================================
# REGISTRY ACCESS FUNCTIONS
# ============================================================================

def get_tool(name: str) -> Optional[Dict[str, Any]]:
    """Get tool configuration by name."""
    return _TOOL_REGISTRY.get(name)


def get_all_tools() -> Dict[str, Dict[str, Any]]:
    """Get all registered tools."""
    return _TOOL_REGISTRY.copy()


def get_tools_by_category(category: str) -> Dict[str, Dict[str, Any]]:
    """Get all tools in a specific category."""
    return {
        name: config
        for name, config in _TOOL_REGISTRY.items()
        if config["category"] == category
    }


def get_tool_names() -> list[str]:
    """Get list of all registered tool names."""
    return list(_TOOL_REGISTRY.keys())


def get_tool_count() -> int:
    """Get total number of registered tools."""
    return len(_TOOL_REGISTRY)


# ============================================================================
# GEMINI FUNCTION CALLING SCHEMA GENERATION
# ============================================================================

def generate_gemini_tools():
    """
    Generate Gemini function calling schemas from registered tools.
    
    Returns:
        List of Gemini Tool objects ready for API calls
    """
    from google.genai import types
    
    gemini_tools = []
    
    for tool_name, tool_config in _TOOL_REGISTRY.items():
        gemini_tools.append(
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name=tool_config["name"],
                        description=tool_config["description"],
                        parameters=tool_config["parameters"]
                    )
                ]
            )
        )
    
    logger.info(f"📡 Generated {len(gemini_tools)} Gemini tool schemas")
    return gemini_tools


def get_tool_schema(name: str) -> Optional[Dict[str, Any]]:
    """
    Get tool schema (for LangGraph integration).
    
    Returns schema dict with name, description, parameters.
    """
    tool = get_tool(name)
    if not tool:
        return None
    
    return {
        "name": tool["name"],
        "description": tool["description"],
        "parameters": tool["parameters"]
    }


def _resolve_tool_name(tool_name: str) -> str:
    """Resolve incoming tool names to a registered canonical name.

    Supports:
    - exact matches
    - common alias prefix (`get_user_*` -> `get_*`)
    - close-match typo recovery
    """
    if tool_name in _TOOL_REGISTRY:
        return tool_name

    if tool_name.startswith("get_user_"):
        candidate = "get_" + tool_name[len("get_user_"):]
        if candidate in _TOOL_REGISTRY:
            return candidate

    close = difflib.get_close_matches(tool_name, _TOOL_REGISTRY.keys(), n=1, cutoff=0.86)
    if close:
        return close[0]

    return tool_name


def _is_expected_type(expected: str, value: Any) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    return True


def _validate_tool_args(schema: Dict[str, Any], args: Dict[str, Any]) -> list[str]:
    errors: list[str] = []

    schema_type = schema.get("type")
    if schema_type == "object":
        if not isinstance(args, dict):
            return ["Arguments must be an object"]

        required = schema.get("required", [])
        for key in required:
            if key not in args:
                errors.append(f"Missing required field: {key}")

        properties = schema.get("properties", {})
        for key, value in args.items():
            prop = properties.get(key)
            if not prop:
                continue
            expected = prop.get("type")
            if expected and not _is_expected_type(expected, value):
                errors.append(f"Invalid type for {key}: expected {expected}")
            if "enum" in prop and value not in prop["enum"]:
                errors.append(f"Invalid value for {key}: must be one of {prop['enum']}")
            if expected == "array" and isinstance(value, list):
                item_type = (prop.get("items") or {}).get("type")
                if item_type:
                    for idx, item in enumerate(value):
                        if not _is_expected_type(item_type, item):
                            errors.append(
                                f"Invalid type for {key}[{idx}]: expected {item_type}"
                            )
                            break
    elif schema_type:
        if not _is_expected_type(schema_type, args):
            errors.append(f"Invalid argument type: expected {schema_type}")

    return errors


# ============================================================================
# TOOL EXECUTION
# ============================================================================

async def execute_tool(
    tool_name: str,
    args: Dict[str, Any],
    db: Any = None,
    user_id: Optional[int] = None,
    **context
) -> Dict[str, Any]:
    """
    Execute a registered tool by name.
    
    Args:
        tool_name: Name of the tool to execute
        args: Arguments to pass to the tool
        db: Database session (if tool requires_db)
        user_id: User ID (if tool requires_user_id)
        **context: Additional context to pass to tool
        
    Returns:
        Dict with execution result
        
    Raises:
        ValueError: If tool not found or missing required parameters
    """
    resolved_name = _resolve_tool_name(tool_name)
    tool = get_tool(resolved_name)
    
    if not tool:
        logger.error(f"❌ Tool not found: {tool_name}")
        return {
            "status": "failed",
            "error": f"Unknown tool: {tool_name}"
        }

    if resolved_name != tool_name:
        logger.info("🔁 Resolved tool alias '%s' -> '%s'", tool_name, resolved_name)
    
    # Validate required parameters
    if tool["requires_db"] and db is None:
        return {
            "status": "failed",
            "error": f"Tool {tool_name} requires database session"
        }
    
    if tool["requires_user_id"] and user_id is None:
        return {
            "status": "failed",
            "error": f"Tool {tool_name} requires user_id"
        }

    schema = tool.get("parameters") or {}
    validation_errors = _validate_tool_args(schema, args)
    if validation_errors:
        return {
            "status": "failed",
            "error": "Invalid tool arguments",
            "details": validation_errors,
        }
    
    # Prepare function arguments
    func_kwargs = args.copy()
    
    if tool["requires_db"]:
        func_kwargs["db"] = db
    
    if tool["requires_user_id"]:
        func_kwargs["user_id"] = user_id
    
    # Add additional context
    func_kwargs.update(context)
    
    # Execute tool
    try:
        logger.info(f"🔧 Executing tool: {resolved_name}")
        handler = tool["handler"]
        result = await handler(**func_kwargs)

        # Normalize response envelope for consistent downstream logging/handling.
        if isinstance(result, dict):
            has_error = bool(result.get("error"))
            if has_error:
                if db is not None and hasattr(db, "rollback"):
                    try:
                        await db.rollback()
                    except Exception:
                        pass
                normalized_result = dict(result)
                normalized_result.setdefault("status", "failed")
                normalized_result.setdefault("success", False)
                normalized_result.setdefault("tool_name", resolved_name)
                logger.warning("⚠️ Tool returned logical failure: %s", resolved_name)
                return normalized_result

            normalized_result = dict(result)
            normalized_result.setdefault("status", "completed")
            normalized_result.setdefault("success", True)
            normalized_result.setdefault("tool_name", resolved_name)
            logger.info(f"✅ Tool executed successfully: {resolved_name}")
            return normalized_result

        logger.info(f"✅ Tool executed successfully: {resolved_name}")
        return {
            "status": "completed",
            "success": True,
            "tool_name": resolved_name,
            "data": result,
        }
    
    except Exception as e:
        if db is not None and hasattr(db, "rollback"):
            try:
                await db.rollback()
            except Exception:
                pass
        logger.error(f"❌ Tool execution failed: {resolved_name} - {e}", exc_info=True)
        return {
            "status": "failed",
            "success": False,
            "error": str(e),
            "tool_name": resolved_name,
        }


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def print_registry_summary():
    """Print summary of registered tools (for debugging)."""
    print("\n" + "="*80)
    print("AIKA TOOL REGISTRY SUMMARY")
    print("="*80)
    
    categories = {}
    for name, config in _TOOL_REGISTRY.items():
        category = config["category"]
        if category not in categories:
            categories[category] = []
        categories[category].append(name)
    
    for category, tools in sorted(categories.items()):
        print(f"\n📦 {category.upper()} ({len(tools)} tools)")
        for tool_name in sorted(tools):
            print(f"  ✓ {tool_name}")
    
    print(f"\n📊 Total: {len(_TOOL_REGISTRY)} tools registered")
    print("="*80 + "\n")


# ============================================================================
# INITIALIZATION CHECK
# ============================================================================

def validate_registry():
    """
    Validate tool registry on startup.
    Checks for:
    - Duplicate tool names
    - Missing required fields
    - Invalid parameter schemas
    """
    issues = []
    
    for name, config in _TOOL_REGISTRY.items():
        # Check required fields
        required_fields = ["name", "description", "parameters", "handler"]
        for field in required_fields:
            if field not in config:
                issues.append(f"Tool '{name}' missing required field: {field}")
        
        # Check parameter schema
        params = config.get("parameters", {})
        if not isinstance(params, dict):
            issues.append(f"Tool '{name}' has invalid parameters (must be dict)")
        
        if "type" not in params:
            issues.append(f"Tool '{name}' parameters missing 'type' field")
    
    if issues:
        logger.warning(f"⚠️ Tool registry validation found {len(issues)} issues:")
        for issue in issues:
            logger.warning(f"  - {issue}")
    else:
        logger.info(f"✅ Tool registry validated: {len(_TOOL_REGISTRY)} tools OK")
    
    return len(issues) == 0
