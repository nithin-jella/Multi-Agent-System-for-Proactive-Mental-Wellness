---
id: observability
title: Monitoring & Observability
sidebar_position: 5
---

# Monitoring & Observability

UGM-AICare implements multi-layer observability through structured logging, Prometheus metrics, Langfuse LLM tracing, and agent execution tracking.

---

## Observability Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        FAST["FastAPI Backend"]
        AGENTS["Agent Layer<br/>Aika + STA + TCA + CMA + IA"]
    end

    subgraph "Metrics Collection"
        PROM["Prometheus<br/>/metrics + /metrics/fastapi"]
        CUSTOM["Custom Metrics<br/>Agent latency, risk distribution,<br/>token usage, tool calls"]
    end

    subgraph "LLM Tracing"
        LANGFUSE["Langfuse<br/>Prompt tracing<br/>Token tracking<br/>Cost analysis"]
    end

    subgraph "Agent Telemetry"
        EXEC["LangGraphExecution<br/>Graph-level tracking"]
        NODE["LangGraphNodeExecution<br/>Node-level tracking"]
        EDGE["LangGraphEdgeExecution<br/>Routing decisions"]
        PERF["LangGraphPerformanceMetric<br/>Aggregated stats"]
        ALERT["LangGraphAlert<br/>Anomaly detection"]
    end

    subgraph "Visualization"
        GRAF["Grafana Dashboards<br/>System + Agent metrics"]
        ADMIN_UI["Admin Dashboard<br/>Built-in UI metrics"]
        LF_UI["Langfuse UI<br/>LLM trace viewer"]
    end

    FAST --> PROM
    AGENTS --> CUSTOM --> PROM
    AGENTS --> LANGFUSE
    AGENTS --> EXEC --> NODE & EDGE & PERF & ALERT

    PROM --> GRAF
    EXEC --> ADMIN_UI
    LANGFUSE --> LF_UI
```

---

## Prometheus Metrics

### FastAPI Auto-instrumented Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, status, endpoint |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `http_requests_in_progress` | Gauge | Currently processing requests |

### Custom Agent Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agent_invocation_total` | Counter | Agent invocations by agent_role, intent, routing_decision |
| `agent_latency_ms` | Histogram | Execution time per agent node |
| `agent_tokens_used` | Counter | LLM token consumption by model, agent |
| `agent_errors_total` | Counter | Errors by agent_role, error_type |
| `risk_level_distribution` | Counter | Risk level assignments (0-3) |
| `tool_call_total` | Counter | Tool invocations by tool_name, success/failure |
| `autopilot_actions_total` | Counter | Autopilot decisions by policy_result |

---

## Agent Execution Tracking

```mermaid
flowchart LR
    subgraph "Per Request"
        REQ["HTTP Request"] --> GRAPH_EXEC["Create LangGraphExecution<br/>thread_id, graph_name, status=running"]
        GRAPH_EXEC --> NODE_EXEC["For each node:<br/>Create LangGraphNodeExecution<br/>node_name, latency_ms, tokens"]
        NODE_EXEC --> EDGE_EXEC["For each edge:<br/>Create LangGraphEdgeExecution<br/>from_node → to_node, condition"]
        EDGE_EXEC --> COMPLETE["Update LangGraphExecution<br/>status=completed, total_tokens"]
    end

    subgraph "Aggregated (Periodic)"
        PERF_CALC["Calculate<br/>LangGraphPerformanceMetric<br/>avg_latency, p95, success_rate"]
        PERF_CALC --> ALERT_CHECK["Check thresholds<br/>If p95 > 2s or success_rate &lt; 95%"]
        ALERT_CHECK --> CREATE_ALERT["Create LangGraphAlert<br/>alert_type, severity"]
    end

    subgraph "Dashboard"
        CHART1["Agent latency heatmap"]
        CHART2["Risk level distribution"]
        CHART3["Token usage trends"]
        CHART4["Error rate by agent"]
    end

    COMPLETE -.-> PERF_CALC
    CREATE_ALERT -.-> CHART4
    COMPLETE -.-> CHART1 & CHART2 & CHART3
```

---

## Structured Logging

All application logs use structured JSON format:

```json
{
  "timestamp": "2026-04-23T14:23:11.456Z",
  "level": "INFO",
  "module": "aika.decision_node",
  "function": "aika_decision_node",
  "message": "Routing decision completed",
  "user_id": 1203,
  "conversation_id": 4812,
  "intent": "academic_stress",
  "risk_level": 1,
  "routing": "execute_sca",
  "latency_ms": 342,
  "tokens_used": 847,
  "request_id": "req_abc123"
}
```

### Log Levels

| Level | Usage |
|-------|-------|
| `DEBUG` | Detailed agent state, tool call inputs/outputs |
| `INFO` | Request processing, routing decisions, agent invocations |
| `WARNING` | Fallback activations, rate limit approaches, retry attempts |
| `ERROR` | Agent failures, LLM errors, database connection issues |
| `CRITICAL` | System startup failures, security events |

---

## Langfuse Integration

```mermaid
sequenceDiagram
    participant AGENT as Any Agent
    participant LF_SDK as Langfuse SDK
    participant LF as Langfuse Cloud

    AGENT->>LF_SDK: Start trace (conversation_id)
    LF_SDK->>LF: Create trace

    AGENT->>LF_SDK: Start span (node_name)
    LF_SDK->>LF: Create span

    AGENT->>LF_SDK: Log generation (prompt, response, tokens)
    LF_SDK->>LF: Store generation

    AGENT->>LF_SDK: End span
    LF_SDK->>LF: Update span with latency

    AGENT->>LF_SDK: End trace
    LF_SDK->>LF: Finalize trace

    Note over LF: Dashboard shows:<br/>- Full prompt chain<br/>- Token costs<br/>- Latency breakdown<br/>- Quality scores
```

### What Langfuse Tracks

| Entity | Fields Tracked |
|--------|---------------|
| **Trace** | conversation_id, user_id, agent_version, total_tokens, total_cost |
| **Span** | node_name, agent_role, input/output tokens, latency_ms |
| **Generation** | model, prompt_template, completion, temperature, token counts |
| **Event** | tool_name, tool_args, tool_result, success/failure |
