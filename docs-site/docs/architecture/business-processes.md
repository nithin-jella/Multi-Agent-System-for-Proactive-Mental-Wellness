---
id: business-processes
title: Business Process Flows
sidebar_position: 4
---

# Business Process Flows

This document maps the core operational processes of UGM-AICare from trigger to completion, showing how system agents, human actors, and external services coordinate.

---

## 1. Student Onboarding

```mermaid
flowchart TD
    START([Student discovers UGM-AICare]) --> REG[Registration Form]
    REG --> |"email + password or OAuth"| VERIFY{Email verified?}
    VERIFY --> |No| RESEND[Resend verification]
    RESEND --> VERIFY
    VERIFY --> |Yes| PROFILE[Complete Profile]
    PROFILE --> |"faculty, semester, language"| PREFS[Set Preferences]
    PREFS --> |"notifications, consent"| CONSENT[Review & Accept Consent]
    CONSENT --> |"recorded in ConsentLedger"| WELCOME[Welcome Screen]
    WELCOME --> FIRST[First Chat with Aika]
    FIRST --> |"Aika introduces herself"| BASELINE[Initial Screening Baseline]
    BASELINE --> |"STA background analysis"| ACTIVE([Account Active])

    subgraph "System Actions"
        direction TB
        S1["Create User record"]
        S2["Create UserProfile"]
        S3["Initialize empty ScreeningProfile"]
        S4["Log consent event"]
        S5["Trigger first STA analysis"]
    end

    REG -.-> S1
    PROFILE -.-> S2
    PREFS -.-> S3
    CONSENT -.-> S4
    FIRST -.-> S5
```

The onboarding process creates all necessary records and establishes an initial screening baseline through the student's first conversation. The consent ledger entry at this stage is the foundation for all subsequent data processing — no analytics or screening data is generated without a valid consent record.

---

## 2. Crisis Intervention Workflow

This is the highest-priority business process in the system. When a student expresses distress, the system must respond within seconds while simultaneously initiating human escalation.

```mermaid
flowchart TD
    MSG([Student sends message]) --> SCAN["🛡️ Tier 1: Keyword Scan<br/>&lt; 5ms"]
    SCAN --> KW{Crisis keyword<br/>detected?}
    KW --> |Yes| FORCE_HIGH["Force risk = HIGH/CRITICAL<br/>bypass LLM"]
    KW --> |No| LLM["🤖 LLM Intent Classification<br/>+ Risk Assessment"]

    FORCE_HIGH --> ROUTE
    LLM --> ROUTE{Routing Decision}

    ROUTE --> |"risk = HIGH/CRITICAL"| PARALLEL["⚡ Parallel Fan-out<br/>TCA + CMA simultaneously"]
    ROUTE --> |"risk = MODERATE"| TCA_ONLY["🧠 TCA Only<br/>Therapeutic coaching"]
    ROUTE --> |"risk = LOW"| DIRECT["💬 Direct Response<br/>Empathetic reply"]
    ROUTE --> |"intent = analytics"| IA["📊 IA Analytics<br/>k-anonymous query"]

    PARALLEL --> TCA_PLAN["TCA: Generate coping plan<br/>CBT-based intervention"]
    PARALLEL --> CMA_CASE["CMA: Create case<br/>+ Assign counselor"]
    TCA_PLAN --> SYNTH["Synthesize Response"]
    CMA_CASE --> SYNTH
    SYNTH --> HOLDING["Send holding response<br/>with coping strategies"]
    HOLDING --> STUDENT_SEE([Student receives<br/>immediate support])

    CMA_CASE --> ASSIGN["Counselor Assignment<br/>Scoring Algorithm"]
    ASSIGN --> NOTIFY["Notify Counselor<br/>via Dashboard"]
    NOTIFY --> ACCEPT{Counselor<br/>accepts?}
    ACCEPT --> |Yes| BOOK["Book Appointment<br/>within SLA window"]
    ACCEPT --> |No / Timeout| REASSIGN["Reassign to next<br/>ranked counselor"]
    REASSIGN --> NOTIFY
    BOOK --> SESSION["Conduct Session"]
    SESSION --> ATTEST["Submit Attestation<br/>SHA-256 → Blockchain"]
    ATTEST --> CLOSE["Close Case"]
    CLOSE --> FOLLOWUP["Schedule Follow-up<br/>+ Reassess risk"]

    subgraph "Background (Non-blocking)"
        STA_BG["🛡️ STA Deep Analysis<br/>Post-conversation<br/>2-10s async"]
        STA_BG --> SCREEN["Update ScreeningProfile<br/>+ ConversationRiskAssessment"]
        SCREEN --> DASH["Visible on Counselor<br/>Dashboard"]
    end

    MSG -.-> |"after response"| STA_BG

    style FORCE_HIGH fill:#ff6b6b,color:#fff
    style PARALLEL fill:#ff6b6b,color:#fff
    style HOLDING fill:#ffd93d,color:#333
```

### SLA Targets

| Risk Level | Target Time to First Counselor Contact | Escalation if Breached |
|------------|---------------------------------------|----------------------|
| CRITICAL | 4 hours | Admin alert + auto-reassignment |
| HIGH | 24 hours | Admin alert after 12 hours |
| MODERATE | 72 hours | Admin alert after 48 hours |
| LOW (student-initiated) | 5 business days | No escalation |

---

## 3. Routine Check-in Flow

```mermaid
flowchart TD
    SCHED([Scheduler triggers<br/>check-in]) --> SELECT["Select eligible students<br/>based on last activity"]
    SELECT --> FILTER{Has valid<br/>consent?}
    FILTER --> |No| SKIP[Skip student]
    FILTER --> |Yes| GENERATE["Generate personalized<br/>check-in message"]
    GENERATE --> SEND["Send via Aika<br/>in-app notification"]
    SEND --> RESPOND{Student<br/>responds?}

    RESPOND --> |Yes| CHAT["Chat with Aika<br/>Normal message flow"]
    RESPOND --> |No - 24h| REMINDER["Gentle reminder<br/>if preferences allow"]
    REMINDER --> RESPOND2{Student<br/>responds?}
    RESPOND2 --> |Yes| CHAT
    RESPOND2 --> |No| LOG["Log non-response<br/>Update activity record"]

    CHAT --> STA_BG["STA Background Analysis"]
    STA_BG --> UPDATE["Update ScreeningProfile"]
    UPDATE --> CHECK{Risk level<br/>changed?}
    CHECK --> |"Elevated to MODERATE+"| FLAG["Flag for counselor<br/>review"]
    CHECK --> |Stable or improved| CONTINUE["Continue routine<br/>monitoring"]

    FLAG --> REVIEW["Counselor reviews<br/>updated assessment"]
    REVIEW --> DECIDE{Action needed?}
    DECIDE --> |Yes| PROACTIVE["Proactive outreach<br/>or case creation"]
    DECIDE --> |No| CONTINUE

    style FLAG fill:#ffd93d,color:#333
    style PROACTIVE fill:#6bcb77,color:#fff
```

---

## 4. Counselor Case Handling

```mermaid
flowchart LR
    START([Case assigned]) --> REVIEW["Review Risk Assessment<br/>STA report"]
    REVIEW --> SUMMARY["Read Conversation<br/>Summary"]
    SUMMARY --> PREPARE["Prepare for Session<br/>Review treatment plan"]
    PREPARE --> SESSION["Conduct Counseling<br/>Session"]
    SESSION --> NOTES["Write Session Notes<br/>Clinical observations"]
    NOTES --> ATTEST["Submit Attestation<br/>Hash → Blockchain"]
    ATTEST --> UPDATE_PLAN["Update Treatment Plan<br/>+ Follow-up actions"]
    UPDATE_PLAN --> SCHEDULE["Schedule Next Session<br/>or Close Case"]

    SCHEDULE --> CLOSE{Case resolved?}
    CLOSE --> |Yes| CLOSED([Case Closed])
    CLOSE --> |No| FOLLOWUP["Follow-up Session<br/>Scheduled"]
    FOLLOWUP --> SESSION

    subgraph "Blockchain Layer"
        HASH["SHA-256 Hash<br/>of session notes"]
        TX["Submit Transaction<br/>to Smart Contract"]
        STORE["Store tx_hash in<br/>CaseAttestation table"]
    end

    ATTEST -.-> HASH --> TX --> STORE
```

---

## 5. Admin Analytics Review

```mermaid
flowchart TD
    LOGIN([Admin logs in]) --> DASH["View Dashboard<br/>Real-time metrics"]
    DASH --> ALERTS{Active<br/>alerts?}
    ALERTS --> |Yes| REVIEW_ALERT["Review Alert<br/>+ Take action"]
    ALERTS --> |No| EXPLORE

    REVIEW_ALERT --> EXPLORE["Explore Analytics"]
    EXPLORE --> QUERY["Run Analytics Query<br/>via Aika or Dashboard"]
    QUERY --> IA["📊 IA Processes Query"]
    IA --> CONSENT_CHECK{Consent<br/>check passed?}
    CONSENT_CHECK --> |No| DENIED["Query denied<br/>Insufficient consent coverage"]
    CONSENT_CHECK --> |Yes| K_ANON["Enforce k-anonymity<br/>HAVING COUNT ≥ 5"]
    K_ANON --> EXECUTE["Execute SQL Query"]
    EXECUTE --> DP["Apply Differential Privacy<br/>noise if needed"]
    DP --> RESULTS["Display Results<br/>on Dashboard"]
    RESULTS --> EXPORT["Export PDF Report<br/>Optional"]

    RESULTS --> TREND["Review Population Trends"]
    TREND --> DECIDE{Action needed?}
    DECIDE --> |Yes| CAMPAIGN["Create Campaign<br/>or Adjust Outreach"]
    DECIDE --> |No| MONITOR([Continue Monitoring])

    style DENIED fill:#ff6b6b,color:#fff
    style K_ANON fill:#6bcb77,color:#fff
```

---

## 6. Appointment Booking Flow

```mermaid
flowchart TD
    START([Student expresses need<br/>for counselor]) --> AIKA["Aika detects<br/>appointment_scheduling intent"]
    AIKA --> TOOL1["Tool: get_available_counselors<br/>Ranked by specialty + load"]
    TOOL1 --> SELECT["Student selects<br/>preferred counselor"]
    SELECT --> TOOL2["Tool: suggest_appointment_times<br/>Next 72h availability"]
    TOOL2 --> PICK["Student picks<br/>time slot"]
    PICK --> TOOL3["Tool: book_appointment<br/>Create DB record"]
    TOOL3 --> CONFIRM["Confirm booking<br/>via chat response"]
    CONFIRM --> NOTIFY_CNS["Notify Counselor<br/>Dashboard + optional email"]

    CONFIRM --> REMINDER_PRE["24h before:<br/>Send reminder"]
    REMINDER_PRE --> REMINDER_1H["1h before:<br/>Send reminder"]
    REMINDER_1H --> SESSION([Session starts])

    SESSION --> POST["Post-session:<br/>Feedback request + Token reward"]

    subgraph "Data Operations"
        D1["Query TherapistSchedule"]
        D2["Check CaseAssignment load"]
        D3["Create Appointment record"]
        D4["Update Case status"]
        D5["Create CareTokenTransaction"]
    end

    TOOL1 -.-> D1
    TOOL1 -.-> D2
    TOOL3 -.-> D3
    TOOL3 -.-> D4
    POST -.-> D5
```
