---
id: data-privacy-lifecycle
title: Data Privacy Lifecycle
sidebar_position: 3
---

# Data Privacy Lifecycle

This document traces the complete lifecycle of personal data in UGM-AICare — from collection through processing, storage, anonymization, retention, and deletion.

---

## Data Lifecycle Overview

```mermaid
flowchart LR
    COLLECT["📥 Collection"] --> PROCESS["⚙️ Processing"]
    PROCESS --> STORE["💾 Storage"]
    STORE --> ANON["🔒 Anonymization"]
    ANON --> ANALYTICS["📊 Analytics"]
    ANALYTICS --> RETAIN["📋 Retention"]
    RETAIN --> DELETE["🗑️ Deletion"]

    STORE --> ACCESS["👁️ Access<br/>(Role-gated)"]
    ACCESS --> AUDIT["📝 Audit Log"]

    style COLLECT fill:#4dabf7,color:#fff
    style ANON fill:#51cf66,color:#fff
    style DELETE fill:#ff6b6b,color:#fff
    style AUDIT fill:#a855f7,color:#fff
```

---

## Data Collection Points

```mermaid
flowchart TD
    subgraph "Explicit Collection"
        REG["Registration<br/>Email, name, role"]
        PROFILE["Profile Setup<br/>Faculty, semester, language"]
        SURVEY["Survey Responses<br/>PHQ-9, GAD-7 explicit scores"]
        CONSENT_FORM["Consent Form<br/>Data processing consent"]
        JOURNAL["Journal Entries<br/>Self-authored content"]
    end

    subgraph "Implicit Collection"
        CHAT["Chat Messages<br/>Conversational text"]
        SCREENING["Covert Screening<br/>Extracted indicators"]
        ACTIVITY["Activity Tracking<br/>Feature usage, sessions"]
        APPOINT["Appointment Data<br/>Bookings, cancellations"]
    end

    subgraph "Derived Data"
        RISK["Risk Assessments<br/>STA-generated scores"]
        SCREEN_PROFILE["Screening Profiles<br/>Longitudinal scores"]
        INTERVENTION["Intervention Plans<br/>TCA-generated plans"]
        ATTESTATION["Attestations<br/>On-chain hashes"]
    end

    REG --> STORE[("PostgreSQL")]
    PROFILE --> STORE
    SURVEY --> STORE
    CONSENT_FORM --> STORE
    JOURNAL --> STORE
    CHAT --> STORE
    SCREENING --> STORE
    ACTIVITY --> STORE
    APPOINT --> STORE
    RISK --> STORE
    SCREEN_PROFILE --> STORE
    INTERVENTION --> STORE
    ATTESTATION --> STORE

    CONSENT_FORM --> LEDGER["Consent Ledger<br/>Required before any<br/>derived data processing"]
    CHAT -.-> |"only after consent"| SCREENING
```

---

## Consent Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NoConsent: User registers
    NoConsent --> Pending: Shown consent form
    Pending --> Granted: User accepts
    Pending --> Declined: User declines
    Granted --> Withdrawn: User withdraws consent
    Withdrawn --> Granted: User re-grants
    Declined --> Granted: User later accepts

    state Granted {
        [*] --> ActiveProcessing
        ActiveProcessing --> AnalyticsIncluded: Data in analytics pool
        ActiveProcessing --> ScreeningActive: STA processes conversations
    }

    state Withdrawn {
        [*] --> ProcessingStopped
        ProcessingStopped --> AnonymizationQueued: Existing data anonymized
    }

    note right of Granted: All derived data processing enabled
    note right of Withdrawn: No new processing;<br/>existing data retained but<br/>excluded from analytics
```

---

## Anonymization Levels

```mermaid
flowchart TD
    subgraph "Level 0: Raw Data (Encrypted at Rest)"
        RAW["Original conversations,<br/>names, emails, NIMs<br/>Encrypted in PostgreSQL<br/>Access: authenticated + role-gated only"]
    end

    subgraph "Level 1: Pseudonymized"
        PSEUDO["user_id → user_hash (SHA-256)<br/>PII fields redacted<br/>Used for: Internal analytics<br/>Access: Admin + Counselor (assigned)"]
    end

    subgraph "Level 2: Anonymized (k-anonymous)"
        ANON["Grouped by quasi-identifiers<br/>Minimum group size k=5<br/>Small cells suppressed<br/>Used for: Population-level reporting<br/>Access: Admin analytics queries"]
    end

    subgraph "Level 3: Differentially Private"
        DP["Aggregate statistics only<br/>Laplace noise injected (ε budget)<br/>Individual records not distinguishable<br/>Used for: Published reports, research<br/>Access: Exported reports"]
    end

    RAW --> |"Hash + Redact"| PSEUDO
    PSEUDO --> |"GROUP BY + HAVING ≥ 5"| ANON
    ANON --> |"Noise injection"| DP

    style RAW fill:#ff6b6b,color:#fff
    style DP fill:#51cf66,color:#fff
```

---

## Data Retention & Deletion

```mermaid
flowchart TD
    subgraph "Active Data"
        A1["Conversations<br/>Retained while account active"]
        A2["Screening Profiles<br/>Updated with decay,<br/>retained indefinitely (active)"]
        A3["Cases<br/>Retained until closed + 1 year"]
        A4["Consent Ledger<br/>Permanent record"]
        A5["Audit Logs<br/>Permanent record"]
        A6["Attestations<br/>Permanent (on-chain)"]
    end

    subgraph "Deletion Triggers"
        T1["Account deactivation"]
        T2["Consent withdrawal"]
        T3["Retention period expiry"]
        T4["User data request"]
    end

    subgraph "Deletion Process"
        D1["Anonymize PII fields<br/>name → [DELETED]<br/>email → [DELETED]"]
        D2["Remove from analytics pool<br/>Exclude from future queries"]
        D3["Retain aggregated data<br/>k-anonymous records persist"]
        D4["Keep audit trail<br/>Action recorded,<br/>PII removed"]
        D5["On-chain data immutable<br/>Hashes cannot be deleted<br/>No PII on chain"]
    end

    T1 --> D1 --> D2 --> D3 --> D4
    T2 --> D2
    T3 --> D1
    T4 --> D1
    D4 --> D5
```

---

## Privacy Controls Summary

| Control | Mechanism | Scope | Enforcement Point |
|---------|-----------|-------|-------------------|
| **PII Redaction** | Regex-based replacement | All conversation text before analytics | STA `apply_redaction_node` |
| **Pseudonymization** | SHA-256 hashing (user_id → user_hash) | Analytics data layer | IA query builder |
| **k-Anonymity** | GROUP BY + HAVING COUNT ≥ 5 | All population queries | IA `apply_k_anonymity_node` |
| **Differential Privacy** | Laplace noise injection (ε budget) | Aggregate statistics | IA post-processing |
| **Consent Enforcement** | UserConsentLedger check | All analytics processing | IA `validate_consent_node` |
| **Role-Based Access** | JWT + RBAC middleware | All API endpoints | FastAPI middleware |
| **Encryption at Rest** | PostgreSQL encryption | Database storage | Infrastructure layer |
| **Audit Logging** | UserAuditLog + LangGraphAlert | All data access events | Middleware + agent tracker |
| **On-chain Immutability** | Smart contract hashes | Attestation records | Blockchain domain |
