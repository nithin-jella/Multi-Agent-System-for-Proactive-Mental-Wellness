"""Core schemas only. Domain-specific schemas are in app.domains.mental_health.schemas."""
from .docs import ModuleDoc, EndpointDoc, EndpointExample

# Import from domain for backward compatibility with existing code
from app.domains.mental_health.schemas.agents import (
    TriageRequest,
    TriageResponse,
    TriageMessage,
    TriageClassifyRequest,
    TriageClassifyResponse,
    LangGraphNode,
    LangGraphEdge,
    LangGraphState,
)

__all__ = [
    # Agent Schemas (from mental_health domain)
    "TriageRequest",
    "TriageResponse",
    "TriageMessage",
    "TriageClassifyRequest",
    "TriageClassifyResponse",
    "LangGraphNode",
    "LangGraphEdge",
    "LangGraphState",

    # Documentation Schemas (core)
    "ModuleDoc",
    "EndpointDoc",
    "EndpointExample",
]
