---
id: insights-agent
title: Insights Agent
sidebar_position: 5
---

# Insights Agent

## IA - Insights Agent

## What Is the IA?

The Insights Agent (IA) serves as the system's analytics layer. While other agents manage individual student interactions, the IA operates at a population level. It addresses broader inquiries, such as the proportion of students exhibiting stress indicators or identifying departments with increased anxiety-related conversations. Population-level mental health analytics provide significant value beyond direct student support. Aggregated and anonymized trend data enables counseling services to allocate resources more effectively, identify at-risk cohorts early, and assess intervention success.

The IA exists because the value of a mental health support platform is not limited to the students it helps directly. Aggregated, anonymised trend data helps counselling services allocate resources, identify at-risk cohorts early, and evaluate the effectiveness of their interventions.

---

## The Privacy Challenge

Population-level mental health analytics present a privacy challenge due to the sensitivity of the data. Even aggregated statistics can potentially reveal individual information if group sizes are small. The IA mitigates this risk using two primary mechanisms. First, k-anonymity ensures that every analytics query enforces a minimum group size. If a query result involves fewer than k individuals (where k defaults to 5), the result is suppressed or generalized. This prevents the reverse-engineering of individual identities from small-group data. Second, differential privacy adds calibrated statistical noise to aggregate statistics, such as means and percentages, before returning results. The magnitude of this noise is controlled by a privacy budget parameter. These combined mechanisms ensure that individual mental health status cannot be inferred from IA outputs, providing strong privacy guarantees even against informed adversaries.

The IA addresses this with two complementary privacy mechanisms:

### k-Anonymity

Every analytics query enforces a minimum group size. If a query would return a result representing fewer than **k individuals** (default k = 5), the result is suppressed or generalised. For example:

- *"How many Computer Science students reported depression indicators this week?"* → If the answer is 3, the IA returns `< 5` rather than the precise count.
- This prevents an administrator from reverse-engineering individual students from small-group queries.

### Differential Privacy

For aggregate statistics (means, percentages, score distributions), the IA adds calibrated statistical noise before returning results. The noise magnitude is tuned via a privacy budget parameter (epsilon, ε). Smaller ε = more noise = stronger privacy guarantee, at the cost of slightly less precise statistics.

These two mechanisms together mean the IA can honestly say: **no individual student's mental health status can be inferred from its outputs**, even by an adversary with knowledge of the general population.

---

## IA LangGraph Flow

The IA is implemented as a privacy-preserving LangGraph pipeline with four sequential nodes:

```mermaid
flowchart TD
    START([Analytics Query<br/>from Admin/Counselor]) --> INGEST["ingest_query_node<br/>Parse NL query → SQL template<br/>+ parameters"]
    INGEST --> CONSENT["validate_consent_node<br/>Check UserConsentLedger<br/>for all affected users"]
    CONSENT --> CONSENT_OK{Consent<br/>coverage ≥ threshold?}
    CONSENT_OK --> |No| DENIED["Query Denied<br/>Insufficient consent<br/>Log audit event"]
    CONSENT_OK --> |Yes| K_ANON["apply_k_anonymity_node<br/>Add GROUP BY + HAVING COUNT ≥ 5<br/>Suppress small cells"]
    K_ANON --> EXECUTE["Execute Parameterized Query<br/>Against PostgreSQL"]
    EXECUTE --> DP["Apply Differential Privacy<br/>Laplace noise injection<br/>(if aggregate stats)"]
    DP --> INTERPRET["LLM Interpretation<br/>Natural language summary<br/>of results"]
    INTERPRET --> FORMAT["Format Output<br/>Structured JSON + text<br/>for dashboard rendering"]
    FORMAT --> PDF_CHECK{PDF requested?}
    PDF_CHECK --> |Yes| PDF["Generate PDF Report<br/>via pdf_generator"]
    PDF_CHECK --> |No| DELIVER
    PDF --> DELIVER["Deliver to Dashboard<br/>+ Persist InsightsReport"]
    DELIVER --> END([Return to Synthesis])

    style DENIED fill:#ff6b6b,color:#fff
    style K_ANON fill:#51cf66,color:#fff
    style CONSENT fill:#ffd93d,color:#333
```

### IA Node Details

| Node | Function | Privacy Control |
|------|----------|-----------------|
| `ingest_query_node` | Parse natural language to SQL template | Parameterized queries only — no raw SQL |
| `validate_consent_node` | Check consent coverage for affected users | Rejects queries without sufficient consent |
| `apply_k_anonymity_node` | Enforce minimum group size in results | Suppresses cells with count < k |
| LLM Interpreter | Generate natural language summary | Operates on already-anonymized data |

---

## Privacy Enforcement Pipeline

```mermaid
flowchart LR
    subgraph "Input"
        Q["Raw Analytics Query<br/>'Show PHQ-9 trends<br/>by faculty'"]
    end

    subgraph "Step 1: Consent Check"
        C1["Query UserConsentLedger"]
        C2["Filter to<br/>consented users only"]
    end

    subgraph "Step 2: Pseudonymization"
        P1["Replace user_id<br/>with user_hash"]
        P2["Use only redacted<br/>conversation text"]
    end

    subgraph "Step 3: k-Anonymity"
        K1["GROUP BY on<br/>quasi-identifiers"]
        K2["HAVING COUNT ≥ 5"]
        K3["Suppress cells<br/>below threshold"]
    end

    subgraph "Step 4: Differential Privacy"
        D1["Calculate<br/>query sensitivity"]
        D2["Generate Laplace<br/>noise (ε budget)"]
        D3["Add noise to<br/>aggregate values"]
    end

    subgraph "Output"
        R["Privacy-preserving<br/>analytics result"]
    end

    Q --> C1 --> C2 --> P1 --> P2 --> K1 --> K2 --> K3 --> D1 --> D2 --> D3 --> R

    style K2 fill:#51cf66,color:#fff
    style D3 fill:#51cf66,color:#fff
```

---

## Dashboard Data Delivery

```mermaid
sequenceDiagram
    participant ADM as Admin/Counselor
    participant FE as Frontend Dashboard
    participant API as Backend API
    participant IA as IA Graph
    participant DB as PostgreSQL

    ADM->>FE: Navigate to Insights
    FE->>API: GET /api/v1/admin/insights
    API->>IA: Execute allow-listed query
    IA->>IA: validate_consent_node
    IA->>IA: apply_k_anonymity_node
    IA->>DB: Execute parameterized SQL
    DB-->>IA: Raw results
    IA->>IA: Apply DP noise
    IA-->>API: Privacy-preserving results
    API-->>FE: JSON data payload
    FE->>FE: Render charts<br/>Heatmap, trend lines, funnel
    FE-->>ADM: Visual analytics dashboard

    Note over ADM,FE: Alternative: Ask Aika
    ADM->>FE: "Show me risk trends by faculty"
    FE->>API: POST /api/v1/aika (message)
    API->>IA: Natural language → SQL
    IA-->>API: NL summary + structured data
    API-->>FE: Stream via SSE
    FE-->>ADM: Chart + text explanation
```

---

## What the IA Can Answer

The IA is invoked when an administrator or counsellor asks a question through Aika that requires population-level data. Representative queries:

| Query Type | Example | Data Source |
| --- | --- | --- |
| **Trend analysis** | "How has the average risk score changed over the past 4 weeks?" | `ConversationRiskAssessment` aggregates |
| **Cohort comparison** | "Which faculties show the highest proportion of high-risk conversations?" | Cross-join with user faculty field |
| **Screening distributions** | "What is the distribution of PHQ-9 indicators across active students?" | `ScreeningProfile` table, k-anonymised |
| **Intervention effectiveness** | "Do students who completed a TCA plan show lower risk scores in subsequent conversations?" | Longitudinal join across `UserInterventionPlan` and `ConversationRiskAssessment` |
| **Counsellor workload** | "How many open cases does each counsellor currently have?" | `CaseManagement` table (not anonymised - counsellor data is not sensitive in this context) |

---

## How the IA Works Inside LangGraph

The IA node is reached when Aika's intent classifier routes a message to `analytics`. The node:

1. Parses the natural language query to identify the required metric, time range, and cohort filter
2. Translates this to a parameterised SQL query (never raw user input - all parameters are sanitised)
3. Applies k-anonymity enforcement and differential privacy noise
4. Formats the result as a natural language summary plus a structured JSON object (which the frontend renders as a chart)

```mermaid
flowchart LR
 A[Analytics intent\ndetected by Aika] --> B[IA Node\nparse query intent]
 B --> C[Build parameterised\nSQL query]
 C --> D[Execute against\nread replica DB]
 D --> E[k-anonymity\nenforcement]
 E --> F[Differential privacy\nnoise injection]
 F --> G[Format result\ntext + JSON]
 G --> H[Synthesis node\nAika delivers answer]
```

---

## Dashboard Integration

The IA feeds data to the **counsellor and administrator dashboard**, which visualises:

- **Population risk heatmap** - risk level distribution by faculty and week
- **Screening trend lines** - PHQ-9, GAD-7, DASS-21 community scores over time
- **Intervention funnel** - how many conversations → STA flags → TCA plans → CMA cases → resolved cases
- **Counsellor performance metrics** - average time to case acceptance, SLA compliance rates

All charts are rendered client-side in the Next.js dashboard. The IA provides the data; the frontend handles visualisation.

---

## Access Control

IA queries are only available to users with `counsellor` or `admin` roles. This is enforced at two layers:

1. **Aika's tool allowlist**: The `counsellor` and `admin` role allowlists include analytics-capable tools; the `user` role does not.
2. **API endpoint RBAC**: The backend endpoints that serve IA data explicitly check the caller's role before processing.

A student cannot ask Aika for population-level data and receive a meaningful response - even indirectly.
