---
id: autopilot-architecture
title: Autopilot Architecture
sidebar_position: 3
---

# Autopilot Architecture

The Aika Autopilot system enables policy-governed autonomous actions, allowing Aika to perform operational tasks (appointment booking, follow-up scheduling, check-in triggers) without human intervention — subject to configurable safety policies.

---

## Autopilot Action Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Evaluated: Aika proposes action
    Evaluated --> Allowed: Policy = allow
    Evaluated --> RequireApproval: Policy = require_approval
    Evaluated --> Denied: Policy = deny

    Allowed --> Queued: Enqueue for execution
    RequireApproval --> PendingApproval: Queue for admin review
    Denied --> [*]: Action blocked, logged

    PendingApproval --> Approved: Admin approves
    PendingApproval --> Rejected: Admin rejects
    Rejected --> [*]: Action cancelled

    Approved --> Queued: Enqueue for execution
    Queued --> Executing: Worker picks up
    Executing --> Completed: Success
    Executing --> Failed: Error occurred
    Failed --> Retrying: Retryable error
    Retrying --> Executing: Retry attempt
    Retrying --> DeadLetter: Max retries exceeded
    DeadLetter --> [*]: Logged for investigation

    Completed --> OnChain: tx_hash recorded
    OnChain --> [*]: Immutable audit trail
    Completed --> [*]: Action complete
```

---

## Policy Evaluation Flow

```mermaid
flowchart TD
    ACTION["Aika proposes action<br/>e.g., book_appointment,<br/>schedule_followup,<br/>trigger_checkin"] --> META["Extract action metadata<br/>action_type, risk_level,<br/>user_id, idempotency_key"]

    META --> LOOKUP["Lookup policy matrix<br/>for (action_type, risk_level)"]
    LOOKUP --> DECISION{Policy<br/>decision}

    DECISION --> |"allow"| PRE_CHECK["Pre-execution checks<br/>1. Idempotency: already executed?<br/>2. Rate limit: not too frequent?<br/>3. User consent: action permitted?"]
    DECISION --> |"require_approval"| QUEUE["Queue for admin review<br/>Create AutopilotAction<br/>status = pending_approval<br/>Notify admin dashboard"]
    DECISION --> |"deny"| BLOCK["Block action<br/>Log denial reason<br/>Return denial message to Aika"]

    PRE_CHECK --> CHECK_OK{Checks<br/>passed?}
    CHECK_OK --> |Yes| EXECUTE["Execute action<br/>via tool registry"]
    CHECK_OK --> |No (idempotent)| SKIP["Skip: already executed<br/>Return previous result"]
    CHECK_OK --> |No (rate limit)| DELAY["Delay action<br/>Schedule for later"]
    CHECK_OK --> |No (consent)| BLOCK

    EXECUTE --> EXEC_OK{Execution<br/>succeeded?}
    EXEC_OK --> |Yes| RECORD["Record result<br/>+ optional on-chain attestation"]
    EXEC_OK --> |No| RETRY_QUEUE["Queue for retry<br/>with backoff"]

    QUEUE --> ADMIN_REVIEW["Admin reviews<br/>via /admin/autopilot"]
    ADMIN_REVIEW --> |Approve| PRE_CHECK
    ADMIN_REVIEW --> |Reject| BLOCK

    style DECISION fill:#ffd93d,color:#333
    style BLOCK fill:#ff6b6b,color:#fff
    style EXECUTE fill:#51cf66,color:#fff
```

---

## Policy Matrix

The policy matrix defines which actions are permitted at each risk level:

```mermaid
graph LR
    subgraph "Action Types"
        A1["book_appointment"]
        A2["schedule_followup"]
        A3["trigger_checkin"]
        A4["send_resources"]
        A5["update_screening"]
    end

    subgraph "Risk Levels"
        R0["LOW (0)"]
        R1["MODERATE (1)"]
        R2["HIGH (2)"]
        R3["CRITICAL (3)"]
    end

    subgraph "Policy Decisions"
        ALLOW["✅ allow"]
        APPROVAL["⚠️ require_approval"]
        DENY["❌ deny"]
    end
```

### Default Policy Configuration

| Action | LOW | MODERATE | HIGH | CRITICAL |
|--------|-----|----------|------|----------|
| `book_appointment` | allow | allow | require_approval | require_approval |
| `schedule_followup` | allow | allow | allow | require_approval |
| `trigger_checkin` | allow | allow | require_approval | deny |
| `send_resources` | allow | allow | allow | allow |
| `update_screening` | allow | allow | allow | require_approval |

---

## Execution Worker Architecture

```mermaid
flowchart TD
    subgraph "Queue"
        Q["AutopilotAction Queue<br/>status = queued<br/>Ordered by priority + created_at"]
    end

    subgraph "Worker Loop"
        POLL["Poll queue<br/>SELECT next action<br/>WHERE status = queued"]
        LOCK["Lock action<br/>SET status = executing"]
        EXEC["Execute action<br/>via tool registry"]
        RESULT{Success?}
        SUCCESS["SET status = completed<br/>Record tx_hash if on-chain"]
        FAIL["SET status = failed<br/>Increment retry_count"]
        RETRY_CHECK{retry_count<br/>&lt; max?}
        REQUEUE["RE-SET status = queued<br/>with exponential backoff"]
        DEAD["SET status = dead_letter<br/>Create alert"]
    end

    Q --> POLL --> LOCK --> EXEC --> RESULT
    RESULT --> |Yes| SUCCESS
    RESULT --> |No| FAIL --> RETRY_CHECK
    RETRY_CHECK --> |Yes| REQUEUE --> Q
    RETRY_CHECK --> |No| DEAD

    subgraph "Attestation (Optional)"
        HASH["SHA-256 hash of<br/>action + result"]
        TX["Submit to blockchain<br/>if not placeholder mode"]
        STORE["Store tx_hash in<br/>AutopilotAction record"]
    end

    SUCCESS -.-> HASH --> TX --> STORE

    style SUCCESS fill:#51cf66,color:#fff
    style DEAD fill:#ff6b6b,color:#fff
```

---

## Idempotency

Each action includes an idempotency key computed from:

```
idempotency_key = hash(action_type + user_id + target_resource_id + time_window)
```

This prevents duplicate execution of the same logical action (e.g., double-booking an appointment) even if the proposal is made multiple times due to retries or re-processing.

---

## Admin Approval Interface

```mermaid
sequenceDiagram
    participant AIKA as Aika
    participant QUEUE as Action Queue
    participant DB as PostgreSQL
    participant ADMIN as Admin Dashboard
    participant WORKER as Autopilot Worker

    AIKA->>QUEUE: Propose action (require_approval)
    QUEUE->>DB: INSERT AutopilotAction<br/>status = pending_approval
    DB-->>ADMIN: Dashboard shows pending action

    ADMIN->>DB: POST /admin/autopilot/{id}/approve
    DB->>DB: UPDATE status = queued

    WORKER->>DB: SELECT next queued action
    DB-->>WORKER: Approved action
    WORKER->>WORKER: Execute action
    WORKER->>DB: UPDATE status = completed

    Note over ADMIN,DB: Alternative: Reject
    ADMIN->>DB: POST /admin/autopilot/{id}/reject
    DB->>DB: UPDATE status = rejected
```

---

## Verification Surfaces

| Surface | URL/API | What It Shows |
|---------|---------|---------------|
| Admin queue | `/admin/autopilot` | All actions with status, risk level, policy decision |
| Proof timeline | `/proof` | User-facing proof of actions + on-chain attestations |
| Admin API | `GET /api/v1/admin/autopilot/actions` | Full action list with filtering |
| Approve API | `POST /api/v1/admin/autopilot/actions/{id}/approve` | Approve pending action |
| Reject API | `POST /api/v1/admin/autopilot/actions/{id}/reject` | Reject pending action |
| Proof API | `GET /api/v1/proof/actions` | User-facing action proof list |
