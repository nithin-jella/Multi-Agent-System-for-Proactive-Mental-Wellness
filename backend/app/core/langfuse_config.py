"""
Langfuse integration for LLM observability and agent tracing.
Provides detailed trace-level monitoring for LangGraph agents.
"""
import os
from typing import Optional
from functools import wraps
from langfuse import Langfuse, observe

# Initialize Langfuse client
def get_langfuse_client() -> Optional[Langfuse]:
    """
    Initialize and return Langfuse client if enabled.
    
    Returns:
        Langfuse client or None if disabled
    """
    if not os.getenv("LANGFUSE_ENABLED", "false").lower() == "true":
        return None
    
    try:
        client = Langfuse(
            public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
            secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
            host=os.getenv("LANGFUSE_HOST", "http://localhost:8262"),
        )
        return client
    except Exception as e:
        print(f"Failed to initialize Langfuse: {e}")
        return None


# Global client instance
langfuse_client = get_langfuse_client()


def trace_agent(agent_name: str):
    """
    Decorator to trace agent execution with Langfuse.
    
    Usage:
        @trace_agent("STA")
        async def assess_message(message: str):
            # Your agent logic
            pass
    
    Args:
        agent_name: Name of the agent (STA, TCA, CMA, IA)
    """
    def decorator(func):
        if not langfuse_client:
            # If Langfuse is disabled, return function as-is
            return func
        
        @observe(name=f"{agent_name}_{func.__name__}")
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Add agent context to trace
            if langfuse_client:
                langfuse_client.update_current_trace(
                    name=agent_name,
                    metadata={
                        "agent": agent_name,
                        "function": func.__name__
                    },
                    tags=[agent_name, "agent", "langgraph"]
                )
            
            result = await func(*args, **kwargs)
            
            # Update trace with result metadata
            if hasattr(result, '__dict__') and langfuse_client:
                langfuse_client.update_current_span(
                    output=str(result)
                )
            
            return result
        
        return wrapper
    return decorator


def trace_llm_call(model_name: str):
    """
    Decorator to trace LLM API calls with Langfuse.
    
    Usage:
        @trace_llm_call("gemini-2.0-flash")
        async def call_llm(prompt: str):
            # Your LLM call
            pass
    
    Args:
        model_name: Name of the LLM model
    """
    def decorator(func):
        if not langfuse_client:
            return func
        
        @observe(as_type="generation", name=f"LLM_{model_name}")
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if langfuse_client:
                langfuse_client.update_current_generation(
                    model=model_name,
                    metadata={"provider": "google-genai"}
                )
            
            result = await func(*args, **kwargs)
            
            # Track token usage if available
            if hasattr(result, 'usage_metadata') and langfuse_client:
                langfuse_client.update_current_generation(
                    usage_details={
                        "input": getattr(result.usage_metadata, 'prompt_token_count', 0),
                        "output": getattr(result.usage_metadata, 'candidates_token_count', 0),
                        "total": getattr(result.usage_metadata, 'total_token_count', 0)
                    }
                )
            
            return result
        
        return wrapper
    return decorator


def trace_tool_call(tool_name: str):
    """
    Decorator to trace tool/function calls with Langfuse.
    
    Usage:
        @trace_tool_call("get_user_profile")
        async def get_user_profile(user_id: int):
            # Your tool logic
            pass
    
    Args:
        tool_name: Name of the tool
    """
    def decorator(func):
        if not langfuse_client:
            return func
        
        @observe(name=f"Tool_{tool_name}")
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if langfuse_client:
                langfuse_client.update_current_span(
                    metadata={
                        "tool": tool_name,
                        "type": "function_call"
                    }
                )
            
            result = await func(*args, **kwargs)
            return result
        
        return wrapper
    return decorator


# Context manager for manual tracing
class LangfuseTrace:
    """
    Context manager for manual trace creation.
    
    Usage:
        async with LangfuseTrace("process_message", user_id="123") as trace:
            # Your code here
            trace.update(output="completed")
    """
    def __init__(self, name: str, **kwargs):
        self.name = name
        self.metadata = kwargs
        self.span = None
    
    async def __aenter__(self):
        if langfuse_client:
            self.span = langfuse_client.start_span(
                name=self.name,
                metadata=self.metadata
            )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.span:
            self.span.end()
            if langfuse_client:
                langfuse_client.flush()
        return False
    
    def update(self, **kwargs):
        """Update trace with additional metadata"""
        if self.span:
            self.span.update(**kwargs)


def flush_langfuse():
    """Flush pending Langfuse events (call before app shutdown)"""
    if langfuse_client:
        langfuse_client.flush()
