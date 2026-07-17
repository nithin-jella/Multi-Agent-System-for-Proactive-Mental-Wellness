"""Graph specifications for the Safety Agent suite visualization."""

from __future__ import annotations

from typing import Dict, List, TypedDict, cast


class GraphNode(TypedDict):
    """Node properties for the admin LangGraph viewer."""

    id: str
    label: str
    description: str
    column: int
    row: int


class _GraphEdgeBase(TypedDict):
    source: str
    target: str


class GraphEdge(_GraphEdgeBase, total=False):
    """Directional edges with optional condition/label metadata."""

    condition: str
    label: str


class GraphSpec(TypedDict):
    """Full graph definition consumed by the frontend graph viewer."""

    id: str
    name: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]


STA_GRAPH_SPEC: GraphSpec = {
    "id": "sta",
    "name": "Safety Triage Agent",
    "nodes": [
        {
            "id": "ingest_message",
            "label": "Ingest Message",
            "description": "Receive live chat payloads and normalize context for analysis.",
            "column": 0,
            "row": 0,
        },
        {
            "id": "apply_redaction",
            "label": "Apply Redaction",
            "description": "Strip personally identifiable information using policy guards before scoring.",
            "column": 1,
            "row": 0,
        },
        {
            "id": "assess_risk",
            "label": "Assess Risk",
            "description": "Run multi-signal classification to derive severity score and recommended posture.",
            "column": 2,
            "row": 0,
        },
        {
            "id": "decide_routing",
            "label": "Decide Routing",
            "description": "Blend risk score, consent, and cooldown rules to determine the next action.",
            "column": 3,
            "row": 0,
        },
        {
            "id": "escalate_sca",
            "label": "Escalate to Coaching",
            "description": "Forward context to TCA for guided outreach when human follow-up is needed.",
            "column": 4,
            "row": -1,
        },
        {
            "id": "escalate_sda",
            "label": "Escalate to Desk",
            "description": "Open a manual case in Safety Desk when SLA-backed intervention is required.",
            "column": 4,
            "row": 0,
        },
        {
            "id": "respond_user",
            "label": "Respond to User",
            "description": "Send tailored reassurance or guided CBT prompts back to Aika chat.",
            "column": 4,
            "row": 1,
        },
    ],
    "edges": [
        {"source": "ingest_message", "target": "apply_redaction"},
        {"source": "apply_redaction", "target": "assess_risk"},
        {"source": "assess_risk", "target": "decide_routing"},
        {
            "source": "decide_routing",
            "target": "escalate_sca",
            "condition": "routing == 'sca'",
            "label": "Human-led coaching",
        },
        {
            "source": "decide_routing",
            "target": "escalate_sda",
            "condition": "routing == 'sda'",
            "label": "Manual escalation",
        },
        {
            "source": "decide_routing",
            "target": "respond_user",
            "condition": "routing == 'auto'",
            "label": "Safe automation",
        },
    ],
}

TCA_GRAPH_SPEC = {
    "id": "tca",
    "name": "Safety Coaching Agent",
    "nodes": [
        {
            "id": "ingest_triage_signal",
            "label": "Ingest Triage Signal",
            "description": "Receive routed cases plus historical CBT context from STA and Redis.",
            "column": 0,
            "row": 0,
        },
        {
            "id": "retrieve_history",
            "label": "Retrieve History",
            "description": "Collect recent journaling, consent state, and prior outreach results.",
            "column": 1,
            "row": 0,
        },
        {
            "id": "compose_plan",
            "label": "Compose Plan",
            "description": "Generate personalized action card bundle and CBT guidance with guardrails.",
            "column": 2,
            "row": 0,
        },
        {
            "id": "safety_review",
            "label": "Safety Review",
            "description": "Apply escalation, cooldown, and consent checks before activation.",
            "column": 3,
            "row": 0,
        },
        {
            "id": "schedule_followup",
            "label": "Schedule Follow-up",
            "description": "Queue outreach tasks and reminders, respecting office hours and throttles.",
            "column": 4,
            "row": 0,
        },
        {
            "id": "sync_case",
            "label": "Sync Case State",
            "description": "Update case ledger so CMA can track execution and SLA timers.",
            "column": 5,
            "row": 0,
        },
    ],
    "edges": [
        {"source": "ingest_triage_signal", "target": "retrieve_history"},
        {"source": "retrieve_history", "target": "compose_plan"},
        {"source": "compose_plan", "target": "safety_review"},
        {
            "source": "safety_review",
            "target": "schedule_followup",
            "condition": "checks_passed",
            "label": "Ready to send",
        },
        {
            "source": "safety_review",
            "target": "sync_case",
            "condition": "requires_manual_review",
            "label": "Flag for CMA",
        },
        {"source": "schedule_followup", "target": "sync_case"},
    ],
}

CMA_GRAPH_SPEC = {
    "id": "cma",
    "name": "Safety Desk Agent",
    "nodes": [
        {
            "id": "ingest_case",
            "label": "Ingest Case",
            "description": "Create or update a case when STA/TCA escalations arrive or counsellors intervene.",
            "column": 0,
            "row": 0,
        },
        {
            "id": "assign_counsellor",
            "label": "Assign Counsellor",
            "description": "Match priority cases with available counsellors using workload heuristics.",
            "column": 1,
            "row": 0,
        },
        {
            "id": "monitor_sla",
            "label": "Monitor SLA",
            "description": "Track follow-up timers and trigger alerts when thresholds are at risk.",
            "column": 2,
            "row": 0,
        },
        {
            "id": "capture_updates",
            "label": "Capture Updates",
            "description": "Log counsellor notes, interventions, and consent changes for auditing.",
            "column": 3,
            "row": 0,
        },
        {
            "id": "resolve_case",
            "label": "Resolve Case",
            "description": "Close the case once SLA satisfied and feedback loop to STA/TCA recorded.",
            "column": 4,
            "row": 0,
        },
    ],
    "edges": [
        {"source": "ingest_case", "target": "assign_counsellor"},
        {"source": "assign_counsellor", "target": "monitor_sla"},
        {"source": "monitor_sla", "target": "capture_updates"},
        {"source": "capture_updates", "target": "resolve_case"},
        {
            "source": "monitor_sla",
            "target": "assign_counsellor",
            "condition": "requires_reassignment",
            "label": "Reassign",
        },
    ],
}

IA_GRAPH_SPEC = {
    "id": "ia",
    "name": "Insights Agent",
    "nodes": [
        {
            "id": "ingest_events",
            "label": "Ingest Events",
            "description": "Capture redacted events, messages, and case telemetry from operational stores.",
            "column": 0,
            "row": 0,
        },
        {
            "id": "enforce_privacy",
            "label": "Enforce Privacy",
            "description": "Apply differential privacy budgets, consent filters, and allow-listed templates.",
            "column": 1,
            "row": 0,
        },
        {
            "id": "run_templates",
            "label": "Run Templates",
            "description": "Execute allow-listed SQL/DSL queries to compute safety insights.",
            "column": 2,
            "row": 0,
        },
        {
            "id": "compose_dashboard",
            "label": "Compose Dashboard",
            "description": "Aggregate trend, cohort, and SLA metrics for administrators.",
            "column": 3,
            "row": 0,
        },
        {
            "id": "feedback_loop",
            "label": "Feedback Loop",
            "description": "Publish signals to STA/TCA for threshold tuning and content updates.",
            "column": 4,
            "row": 0,
        },
    ],
    "edges": [
        {"source": "ingest_events", "target": "enforce_privacy"},
        {"source": "enforce_privacy", "target": "run_templates"},
        {"source": "run_templates", "target": "compose_dashboard"},
        {"source": "compose_dashboard", "target": "feedback_loop"},
    ],
}

AGENT_GRAPH_SPECS: Dict[str, GraphSpec] = cast(
    Dict[str, GraphSpec],
    {
        "sta": STA_GRAPH_SPEC,
        "tca": TCA_GRAPH_SPEC,
        "cma": CMA_GRAPH_SPEC,
        "ia": IA_GRAPH_SPEC,
    },
)

__all__ = [
    "GraphEdge",
    "GraphNode",
    "GraphSpec",
    "AGENT_GRAPH_SPECS",
    "STA_GRAPH_SPEC",
    "TCA_GRAPH_SPEC",
    "CMA_GRAPH_SPEC",
    "IA_GRAPH_SPEC",
]
