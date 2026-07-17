---
id: data-flow
title: Data Flow Diagrams
sidebar_position: 7
---

# Data Flow Diagrams

This document traces how data enters, transforms, persists, and exits the UGM-AICare system using structured Data Flow Diagrams (DFD).

---

## Level 0 — Context Diagram

The context diagram shows the system as a single process with all external entities and major data flows.

```mermaid
graph LR
    STU["👤 Students"]
    CNS["👩‍⚕️ Counselors"]
    ADM["🏛️ Administrators"]
    GEM["🌐 Gemini API"]
    ETH["⛓️ Blockchain<br/>SOMNIA / EDU Chain"]

    SYS["🔄 UGM-AICare<br/>System"]

    STU -->|"Chat messages,<br/>Journal entries,<br/>Survey responses"| SYS
    SYS -->|"SSE responses,<br/>Appointments,<br/>Tokens & Badges"| STU

    CNS -->|"Session notes,<br/>Attestations"| SYS
    SYS -->|"Risk assessments,<br/>Case assignments,<br/>Screening profiles"| CNS

    ADM -->|"Analytics queries,<br/>Policy configs"| SYS
    SYS -->|"Dashboards,<br/>Reports,<br/>Alerts"| ADM

    SYS <-->|"LLM prompts<br/>+ responses"| GEM
    SYS -->|"Hash attestations,<br/>Token transactions"| ETH

    style SYS fill:#4dabf7,color:#fff
```

---

## Level 1 — Process Decomposition

The system decomposes into eight major processes, each with defined inputs, outputs, and data stores.

```mermaid
graph TB
    subgraph External
        STU["👤 Students"]
        CNS["👩‍⚕️ Counselors"]
        ADM["🏛️ Admins"]
        GEM["🌐 Gemini API"]
        ETH["⛓️ Blockchain"]
    end

    subgraph Data Stores
        D1[("D1: Users & Profiles")]
        D2[("D2: Conversations")]
        D3[("D3: Risk Assessments")]
        D4[("D4: Cases")]
        D5[("D5: Appointments")]
        D6[("D6: Screening Profiles")]
        D7[("D7: Analytics Cache")]
    end

    P1["P1: Message Ingestion<br/>& Routing"]
    P2["P2: Agent Orchestration<br/>(Aika Decision)"]
    P3["P3: Safety Triage<br/>& Screening (STA)"]
    P4["P4: Therapeutic<br/>Intervention (TCA)"]
    P5["P5: Case & Appointment<br/>Management (CMA)"]
    P6["P6: Analytics &<br/>Insights (IA)"]
    P7["P7: Data Persistence<br/>& State Mgmt"]
    P8["P8: Blockchain<br/>Operations"]

    STU -->|"messages"| P1
    P1 -->|"classified intent + risk"| P2
    P2 -->|"risk context"| P3
    P2 -->|"moderate risk"| P4
    P2 -->|"high risk"| P5
    ADM -->|"analytics queries"| P6

    P1 --> P7
    P2 --> P7
    P3 --> P7
    P4 --> P7
    P5 --> P7
    P6 --> P7
    P5 --> P8

    P7 --> D1
    P7 --> D2
    P7 --> D3
    P7 --> D4
    P7 --> D5
    P7 --> D6
    P7 --> D7

    P2 <-->|"LLM calls"| GEM
    P3 <-->|"LLM calls"| GEM
    P4 <-->|"LLM calls"| GEM
    P6 <-->|"LLM calls"| GEM

    P8 -->|"attestations, tokens"| ETH

    P7 -->|"SSE responses"| STU
    P7 -->|"cases, assessments"| CNS
    P7 -->|"dashboards, reports"| ADM

    D3 --> P5
    D6 --> P5
    D4 --> CNS
    D3 --> CNS
    D7 --> ADM
```

---

## Chat Message Data Flow

Detailed trace of a single message from the student pressing "send" to receiving Aika's response.

```mermaid
flowchart TD
    START([Student presses Send]) --> FE["Frontend: POST /api/v1/aika<br/>message + session token"]
    FE --> AUTH["Backend: Validate JWT<br/>+ Load user role"]
    AUTH --> CTX["Load Context<br/>User profile + conversation history<br/>+ screening profile"]
    CTX --> GRAPH["Invoke Aika Graph<br/>(compiled singleton)"]

    GRAPH --> DECISION["aika_decision_node<br/>1. Keyword scan &lt; 5ms<br/>2. Small-talk check<br/>3. LLM intent + risk classification"]

    DECISION --> ROUTE{Routing}

    ROUTE --> |"risk HIGH/CRITICAL"| CRISIS["parallel_crisis_node<br/>TCA + CMA async"]
    ROUTE --> |"risk MODERATE"| TCA["execute_sca_subgraph<br/>TCA only"]
    ROUTE --> |"analytics query"| IA["execute_ia_subgraph<br/>IA with k-anonymity"]
    ROUTE --> |"direct response"| DIRECT["generate_direct_response<br/>ReAct tool loop"]

    CRISIS --> SYNTH["synthesize_final_response"]
    TCA --> SYNTH
    IA --> SYNTH
    DIRECT --> SYNTH

    SYNTH --> SSE["Stream response via SSE<br/>token-by-token"]
    SSE --> RENDER([Frontend renders<br/>response in chat])

    RENDER -.-> |"async, non-blocking"| BG["Background Tasks"]
    BG --> PERSIST["Persist message + response<br/>to DB"]
    BG --> STA["Trigger STA<br/>deep analysis"]

    subgraph "Background (2-10s)"
        STA --> REDACT["PII Redaction"]
        REDACT --> CLASSIFY["Gemini deep analysis<br/>+ screening extraction"]
        CLASSIFY --> ASSESS["Create ConversationRiskAssessment"]
        ASSESS --> PROFILE["Update ScreeningProfile<br/>with decay scoring"]
    end

    style DECISION fill:#ffd93d,color:#333
    style CRISIS fill:#ff6b6b,color:#fff
    style BG fill:#868e96,color:#fff
```

---

## Screening Data Flow

How covert psychological screening data flows from raw conversation through to counselor-visible reports.

```mermaid
flowchart LR
    subgraph "Input"
        MSG["Raw Message<br/>'I can't sleep and<br/>feel worthless'"]
    end

    subgraph "STA Message-Level Analysis"
        KW["Keyword Scan<br/>Crisis term check"]
        SEM["Semantic Analysis<br/>Gemini classification"]
        IND["Indicator Extraction<br/>Map to instruments"]
    end

    subgraph "Score Normalization"
        NORM["Normalize to 0-1 scale<br/>per instrument"]
        BAND["Apply severity bands<br/>None/Mild/Moderate/<br/>Severe/Critical"]
    end

    subgraph "Profile Update"
        DECAY["Apply exponential decay<br/>old × 0.95 + new × factor"]
        MERGE["Merge into<br/>ScreeningProfile"]
        COMPARE["Compare with<br/>previous scores"]
    end

    subgraph "Output"
        DASH["Counselor Dashboard<br/>Visual charts"]
        ALERT["Risk Alert<br/>If threshold exceeded"]
        TRIGGER["Case Trigger<br/>If risk HIGH+"]
        REPORT["Assessment Report<br/>Psychologist-ready"]
    end

    MSG --> KW --> SEM --> IND --> NORM --> BAND --> DECAY --> MERGE
    MERGE --> COMPARE
    COMPARE --> DASH
    COMPARE --> ALERT
    COMPARE --> TRIGGER
    MERGE --> REPORT

    style KW fill:#ff6b6b,color:#fff
    style TRIGGER fill:#ff6b6b,color:#fff
```

### Instrument Mapping

| Extracted Indicator | Mapped Instrument | Field in ScreeningProfile |
|--------------------|--------------------|--------------------------|
| Depressed mood, anhedonia, fatigue | PHQ-9 | `phq9_score` |
| Nervousness, uncontrollable worry | GAD-7 | `gad7_score` |
| Difficulty relaxing, agitation | DASS-21 Stress | `dass21_stress` |
| Sleep disturbance, daytime dysfunction | PSQI | `psqi_score` |
| Social withdrawal, loneliness | UCLA Loneliness | `ucla_loneliness` |
| Self-worth, self-acceptance | RSES | `rsss_score` |
| Suicidal ideation, self-harm | C-SSRS | `csrss_score` |
| Academic pressure, fear of failure | SSI | `ssi_score` |

---

## Analytics Query Data Flow

How an analytics query travels through the IA with privacy enforcement at every stage.

```mermaid
flowchart TD
    START([Admin/Counselor<br/>submits query]) --> API["API Layer: Parse query<br/>+ Authenticate user"]
    API --> IA_GRAPH["IA Graph: ingest_query_node"]
    IA_GRAPH --> CONSENT{Consent check<br/>All affected users<br/>consented?}
    CONSENT --> |No| DENIED["Query Denied<br/>Insufficient consent<br/>coverage"]
    CONSENT --> |Yes| VALIDATE["validate_consent_node<br/>Log consent verification"]

    VALIDATE --> BUILD["Build SQL Query<br/>from template"]
    BUILD --> K_ANON["apply_k_anonymity_node<br/>GROUP BY + HAVING COUNT ≥ 5"]
    K_ANON --> EXECUTE["Execute against DB<br/>Pseudonymized data"]

    EXECUTE --> CHECK_K{Results pass<br/>k-anonymity?}
    CHECK_K --> |No| SUPPRESS["Suppress small<br/>cell counts"]
    CHECK_K --> |Yes| DP["Apply Differential Privacy<br/>Laplace noise injection"]

    SUPPRESS --> DP
    DP --> INTERPRET["LLM Interpretation<br/>Natural language summary"]
    INTERPRET --> FORMAT["Format for Dashboard<br/>Charts + tables"]
    FORMAT --> DELIVER([Deliver to<br/>Admin Dashboard])

    DP --> PDF["Optional: Generate<br/>PDF Report"]
    PDF --> DOWNLOAD([Download Report])

    style DENIED fill:#ff6b6b,color:#fff
    style K_ANON fill:#51cf66,color:#fff
    style DP fill:#51cf66,color:#fff
```

---

## Tool Calling Data Flow

How Aika's tool-calling loop interacts with real data sources.

```mermaid
sequenceDiagram
    participant AIKA as Aika
    participant GEM as Gemini API
    participant REG as Tool Registry
    participant DB as PostgreSQL
    participant FE as Frontend

    AIKA->>GEM: Send message + tool schemas
    GEM-->>AIKA: Function call: get_available_counselors()

    AIKA->>REG: Execute get_available_counselors()
    REG->>DB: SELECT counselors WHERE specialty match<br/>ORDER BY caseload ASC
    DB-->>REG: Ranked counselor list
    REG-->>AIKA: Tool result: counselors data

    AIKA->>GEM: Re-prompt with tool result
    GEM-->>AIKA: Function call: suggest_appointment_times(counselor_id)

    AIKA->>REG: Execute suggest_appointment_times()
    REG->>DB: SELECT slots FROM TherapistSchedule<br/>WHERE available AND next 72h
    DB-->>REG: Available time slots
    REG-->>AIKA: Tool result: slots data

    AIKA->>GEM: Re-prompt with slot data
    GEM-->>AIKA: Natural language response<br/>"Bu Ratna has slots at..."

    AIKA->>FE: Stream response via SSE

    Note over AIKA,GEM: Max iterations per intent type:<br/>casual_chat=1, info=2, scheduling=4, other=3
```
