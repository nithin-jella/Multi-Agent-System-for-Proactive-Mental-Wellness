---
id: safety-triage-agent
title: Safety Triage Agent
sidebar_position: 2
---

# Safety Triage Agent

## STA - Safety Triage Agent

## What Is the STA?

The Safety Triage Agent (STA) functions as the system's clinical risk layer. It assesses mental health risks within student conversations, analyzing both individual messages in real-time and completed conversations post-hoc. A significant design feature of the STA is its asynchronous execution. It runs after a conversation concludes, ensuring that comprehensive clinical analysis does not introduce latency to the student's experience.

One design decision defines the STA more than any other: it runs **after** the conversation ends, not inside it. This means the STA never adds latency to a student's experience, and it can take as much time as it needs to do a thorough clinical analysis.

---

## STA LangGraph State Machine

The STA is implemented as a LangGraph `StateGraph` with four sequential nodes:

```mermaid
stateDiagram-v2
    [*] --> IngestMessage: Conversation ends / Manual trigger
    IngestMessage --> ApplyRedaction: Load full transcript
    ApplyRedaction --> AssessRisk: PII stripped
    AssessRisk --> DecideRouting: Risk scored

    state DecideRouting {
        [*] --> HighCritical: risk ≥ 2
        [*] --> Moderate: risk = 1
        [*] --> Low: risk = 0
    }

    HighCritical --> EscalateCMA: route_sda
    Moderate --> RouteTCA: route_sca
    Low --> End: no escalation

    EscalateCMA --> [*]
    RouteTCA --> [*]
    End --> [*]
```

### STA Node Details

| Node | Function | Input | Output |
|------|----------|-------|--------|
| `ingest_message_node` | Load conversation messages from DB | `conversation_id` | Full message transcript |
| `apply_redaction_node` | Strip PII using regex patterns | Raw messages | Redacted messages |
| `assess_risk_node` | Two-tier risk assessment | Redacted messages | `risk_level`, `risk_score`, `severity`, `screening_indicators` |
| `decide_routing` | Determine escalation path | Risk assessment | Routing decision (`escalate_sda`, `route_sca`, or `end`) |

---

## STA Classifier Pipeline

```mermaid
flowchart TD
    MSG["Raw Message<br/>'I don't want to<br/>live anymore'"] --> T1["Tier 1: Rule-Based<br/>Pre-Screen"]

    T1 --> RULES["Regex patterns<br/>Indonesian + English<br/>crisis terms"]
    RULES --> RULE_HIT{Match?}
    RULE_HIT --> |Yes<br/>&lt; 5ms| INSTANT["Immediate risk elevation<br/>risk = HIGH/CRITICAL<br/>Bypass LLM"]

    RULE_HIT --> |No| T2["Tier 2: Gemini LLM<br/>Semantic Analysis"]

    T2 --> GEMINI["Gemini Classifier<br/>Structured JSON output<br/>~200ms"]
    GEMINI --> CACHE{Cache<br/>hit?}
    CACHE --> |Yes| CACHED["Return cached<br/>classification"]
    CACHE --> |No| PARSE["Parse risk_level<br/>+ intent + screening"]

    INSTANT --> OUTPUT["Write to SafetyAgentState"]
    CACHED --> OUTPUT
    PARSE --> OUTPUT
    OUTPUT --> PERSIST["Persist<br/>ConversationRiskAssessment<br/>+ ScreeningProfile update"]

    style INSTANT fill:#ff6b6b,color:#fff
    style T2 fill:#4dabf7,color:#fff
```

### Classification Optimization

- **Caching:** Previously classified message patterns are cached to avoid redundant LLM calls
- **Conversation State:** The classifier maintains conversation-level state to track risk trajectory across messages
- **Batching:** Post-conversation analysis processes the full transcript in a single LLM call rather than per-message

---

## Screening Extraction Data Flow

```mermaid
sequenceDiagram
    participant STA as STA Background Task
    participant REDACT as PII Redaction
    participant LLM as Gemini API
    participant ENGINE as Screening Engine
    participant DB as PostgreSQL

    STA->>DB: Load conversation messages
    DB-->>STA: Full transcript
    STA->>REDACT: Apply regex redaction
    REDACT-->>STA: Redacted text

    STA->>LLM: Analyze + extract indicators
    LLM-->>STA: JSON with risk + indicators

    Note over STA,LLM: Indicator extraction maps to instruments:
    Note over STA,LLM: depression → PHQ-9 domains
    Note over STA,LLM: anxiety → GAD-7 domains
    Note over STA,LLM: stress → DASS-21 domains

    STA->>ENGINE: Update ScreeningProfile
    ENGINE->>ENGINE: Apply decay: old × 0.95 + new × factor
    ENGINE->>ENGINE: Normalize to 0-1 scale
    ENGINE->>ENGINE: Apply severity bands
    ENGINE->>DB: Persist updated ScreeningProfile

    STA->>DB: Persist ConversationRiskAssessment
    STA->>DB: Persist counsellor_recommendation
```

---

## Two Modes of Operation

### Mode 1 - Real-Time Signal Detection (embedded in Aika)

Before the STA even runs as a standalone agent, Aika itself performs the fastest possible risk checks:

1. **Keyword scan** (< 1 ms): Regex match against a list of crisis terms in English and Indonesian. A hit immediately escalates risk to `HIGH`.
2. **LLM semantic classification** (~150 ms): Handled by the `aika_decision_node` using Gemini, which rapidly classifies intent and real-time risk level to ensure safe immediate routing.

The result is a `risk_level` integer from 0 to 3 that is written to the shared `AikaOrchestratorState` and used to route the message through the orchestrator graph.

### Mode 2 - Post-Conversation Deep Analysis (background task)

After a conversation ends (or at a counsellor's manual request), the full STA graph runs as an async background task. This is a multi-step pipeline:

```mermaid
flowchart LR
 A[Load conversation\nfull transcript] --> B[PII Redaction\nnames, IDs, phones stripped]
 B --> C[Gemini semantic\nrisk analysis]
 C --> D[Clinical instrument\nindicator extraction]
 D --> E[Longitudinal trend\nanalysis across history]
 E --> F[Psychologist report\ngeneration]
 F --> G[CMA referral\nrecommendation]
 G --> H[Persist to DB\nConversationRiskAssessment\nScreeningProfile]
```

---

## Risk Scoring

The STA produces three risk artefacts per conversation:

| Artefact | Type | Description |
| --- | --- | --- |
| `risk_level` | Integer 0–3 | Categorical severity score |
| `risk_score` | Float 0.0–1.0 | Continuous probability estimate |
| `severity` | String | Human-readable label |

| Level | Score Range | Label | System Response |
| --- | --- | --- | --- |
| 0 | 0.0–0.29 | `low` | No sub-agent invocation |
| 1 | 0.30–0.59 | `moderate` | TCA invoked for coaching |
| 2 | 0.60–0.79 | `high` | TCA + CMA parallel fan-out |
| 3 | 0.80–1.0 | `critical` | TCA + CMA + immediate escalation |

---

## Covert Clinical Screening

The STA extracts indicators corresponding to three validated clinical instruments from natural conversation. Students are not required to complete formal questionnaires. Instead, the STA infers potential responses based on conversational content. These indicators are recorded in the student's `ScreeningProfile` over time, providing a longitudinal perspective on their mental health trajectory. This data is then presented to counselors as trend charts within their dashboard. Covert screening is intended to be indicative rather than diagnostic. The STA's outputs are designed to assist counselors in prioritization and should not replace formal clinical assessments.

| Instrument | Measures | Items Tracked |
| --- | --- | --- |
| **PHQ-9** | Depression severity | Interest loss, hopelessness, sleep, concentration, energy |
| **GAD-7** | Anxiety severity | Worry frequency, restlessness, irritability, control difficulty |
| **DASS-21** | Depression, Anxiety, and Stress | Combined 21-item indicator set |

These extracted indicators are accumulated in the student's `ScreeningProfile` table over time, building a longitudinal view of their mental health trajectory. Counsellors see this as a trend chart in their dashboard.:::info Note on validity

### Full Instrument Coverage

| Instrument | Measures | Items Tracked |
| --- | --- | --- |
| **PHQ-9** | Depression severity | Anhedonia, hopelessness, sleep disturbance, concentration difficulty, energy loss |
| **GAD-7** | Anxiety severity | Worry frequency, restlessness, irritability, control difficulty |
| **DASS-21** | Depression, Anxiety, and Stress | Combined 21-item indicator set across three subscales |
| **PSQI** | Sleep quality | Sleep latency, duration, efficiency, disturbances, daytime dysfunction |
| **UCLA Loneliness** | Social isolation | Social loneliness, emotional loneliness, perceived isolation |
| **RSES** | Self-esteem | Self-worth, self-acceptance, self-competence |
| **C-SSRS** | Suicidality | Wish to be dead, suicidal thoughts, intent, plan, self-harm |
| **AUDIT** | Substance use | Hazardous use, dependence symptoms, coping drinking |
| **SSI** | Academic stress | Academic pressure, fear of failure, thesis stress, future anxiety |

:::info Note on validity
Covert screening from conversational text is **indicative, not diagnostic**. The STA's screening outputs are intended to assist counsellors in prioritisation, not to replace formal clinical assessment.
:::

---

## Privacy: PII Redaction

Before any conversation text is passed to an LLM for analysis, the STA applies a PII redaction step. The following categories are detected and replaced with placeholders:

- Full names → `[NAME]`
- Student ID numbers (NIM) → `[ID]`
- Phone numbers → `[PHONE]`
- Email addresses → `[EMAIL]`
- Specific dormitory or address details → `[LOCATION]`

This ensures that even if conversation logs are used for model fine-tuning or analytics in the future, raw PII cannot be extracted from them.

---

## Manual Trigger

Counsellors and administrators can manually trigger the STA analysis on any conversation via Aika's `trigger_conversation_analysis` tool, or directly through the admin API at:

```
POST /api/v1/admin/conversation-assessments/{conversation_id}/trigger
```

This is useful when a counsellor is reviewing a historical conversation and wants a fresh clinical summary without waiting for the automated background task.

---

## Output: The Clinical Report

The STA produces a structured `ConversationRiskAssessment` record:

```json
{
 "conversation_id": 4812,
 "user_hash": "u_a3f8c1b2",
 "risk_level": 2,
 "risk_score": 0.71,
 "severity": "high",
 "intent": "academic_stress_with_hopelessness",
 "phq9_indicators": ["anhedonia", "low_energy", "concentration_difficulty"],
 "gad7_indicators": ["excessive_worry", "restlessness"],
 "trend": "worsening",
 "counsellor_recommendation": "Priority referral to clinical psychologist within 48h",
 "summary": "Student expressed persistent hopelessness about academic performance...",
 "analysed_at": "2026-02-27T14:23:11Z"
}
```

This record is visible to the assigned counsellor in their dashboard. The `user_hash` is a one-way hash of the student's ID - counsellors with the right access level can dereference the hash, but it appears anonymised in all IA analytics queries.
