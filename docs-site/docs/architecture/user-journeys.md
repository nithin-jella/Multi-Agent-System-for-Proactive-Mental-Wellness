---
id: user-journeys
title: User Journey Maps
sidebar_position: 5
---

# User Journey Maps

This document maps the end-to-end experience of each primary user role through the UGM-AICare system, showing touchpoints with agents, emotional states, and key metrics at each phase.

---

## 1. Student Journey

The student journey spans six phases from initial discovery through long-term engagement.

```mermaid
flowchart LR
    subgraph P1["🔍 Discovery"]
        D1["Learn about AICare"] --> D2["Visit landing page"]
        D2 --> D3["Read about features"]
    end

    subgraph P2["📝 Onboarding"]
        O1["Register account"] --> O2["Verify email"]
        O2 --> O3["Complete profile"]
        O3 --> O4["Set preferences + consent"]
    end

    subgraph P3["💬 Engagement"]
        E1["First chat with Aika"] --> E2["Daily check-ins"]
        E2 --> E3["Journal writing"]
        E3 --> E4["Complete activities"]
    end

    subgraph P4["🆘 Support"]
        S1["Express distress"] --> S2["Crisis detected by STA"]
        S2 --> S3["Immediate coping plan<br/>from TCA"]
        S3 --> S4["Case created by CMA"]
        S4 --> S5["Counselor session booked"]
    end

    subgraph P5["🌿 Recovery"]
        R1["Attend session"] --> R2["Follow treatment plan"]
        R2 --> R3["Track progress via<br/>screening profile"]
        R3 --> R4["Earn tokens & badges"]
    end

    subgraph P6["📣 Advocacy"]
        A1["Share experience"] --> A2["Refer peers"]
        A2 --> A3["Become community<br/>ambassador"]
    end

    P1 --> P2 --> P3 --> P4 --> P5 --> P6
```

### Emotional States & System Touchpoints

| Phase | Emotional State | System Touchpoint | Agent Involved |
|-------|----------------|-------------------|----------------|
| Discovery | Curious, cautious | Landing page, features page | None |
| Onboarding | Hopeful, uncertain | Registration form, consent UI | None |
| Engagement — first chat | Vulnerable, testing | Chat interface, SSE streaming | Aika (direct response) |
| Engagement — daily | Comfortable, trusting | Check-in notifications, journal | Aika + STA (background) |
| Support — distress | Anxious, fearful | Crisis keyword triggers immediate response | STA (Tier 1) + Aika (routing) |
| Support — intervention | Relieved, supported | Coping plan delivery, appointment booking | TCA + CMA (parallel) |
| Recovery — session | Open, engaged | Counselor session (human) | CMA (scheduling) |
| Recovery — follow-up | Improving, motivated | Treatment plan, wellness activities | TCA (activities) |
| Advocacy | Empowered, grateful | Care tokens, badges, sharing | Blockchain (attestations) |

### Student Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Registration completion rate | ≥ 70% | Profiles created / registrations started |
| First chat within 24h of signup | ≥ 50% | First message timestamp - account creation |
| Weekly active engagement | ≥ 3 sessions/week | Sessions per active student per week |
| Journal entry frequency | ≥ 1 per week | Journal entries / active students |
| Crisis response satisfaction | ≥ 4.0/5.0 | Post-crisis feedback rating |

---

## 2. Counselor Journey

```mermaid
flowchart LR
    subgraph P1["🔑 Access"]
        C1["Login to portal"] --> C2["View case queue"]
        C2 --> C3["Filter by priority<br/>and risk level"]
    end

    subgraph P2["📋 Preparation"]
        C4["Select case"] --> C5["Review STA assessment<br/>+ screening profile"]
        C5 --> C6["Read conversation<br/>summary"]
        C6 --> C7["Review treatment plan<br/>+ history"]
    end

    subgraph P3["🤝 Session"]
        C8["Start session"] --> C9["Conduct counseling<br/>(human-to-human)"]
        C9 --> C10["Update session notes"]
    end

    subgraph P4["📋 Follow-up"]
        C11["Submit attestation<br/>→ Blockchain"] --> C12["Update treatment plan"]
        C12 --> C13["Schedule follow-up<br/>or close case"]
        C13 --> C14["Track patient<br/>progress over time"]
    end

    P1 --> P2 --> P3 --> P4
```

### Counselor System Touchpoints

| Phase | Primary Interface | Data Sources | Agent Interaction |
|-------|------------------|--------------|-------------------|
| Access | Counselor portal login | User session, role verification | None (auth layer) |
| Preparation | Case detail view | ConversationRiskAssessment, ScreeningProfile, Conversation summary | STA reports (read) |
| Session | External (video/phone) | Session notes editor | CMA (case status updates) |
| Follow-up | Attestation form + calendar | CaseAttestation, Appointment | CMA + Blockchain |

### Counselor Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Case pickup within SLA | ≥ 90% | Time from assignment to first action |
| Attestation submission rate | 100% | Sessions with on-chain attestation |
| Case resolution rate | ≥ 75% | Cases closed / cases opened |
| Patient risk improvement | Measured per case | Pre/post screening profile delta |

### Counselor Pain Points & Mitigations

| Pain Point | Mitigation |
|------------|------------|
| High caseload during peak periods | Load-balanced assignment algorithm; admin escalation alerts |
| Incomplete patient history | STA auto-generates conversation summaries and risk reports |
| Scheduling conflicts | TherapistSchedule integration; conflict detection before booking |
| Manual attestation overhead | One-click attestation with automatic hash + on-chain submission |

---

## 3. Administrator Journey

```mermaid
flowchart LR
    subgraph P1["📊 Monitoring"]
        A1["Dashboard overview"] --> A2["Review active alerts"]
        A2 --> A3["Check agent health<br/>+ performance metrics"]
    end

    subgraph P2["🔍 Analysis"]
        A4["Run population analytics"] --> A5["IA processes with<br/>k-anonymity"]
        A5 --> A6["Review trend reports<br/>+ export PDF"]
    end

    subgraph P3["⚙️ Action"]
        A7["Configure autopilot<br/>policies"] --> A8["Approve/reject queued<br/>autopilot actions"]
        A8 --> A9["Manage campaigns<br/>+ outreach"]
        A9 --> A10["Adjust screening<br/>thresholds"]
    end

    subgraph P4["📋 Review"]
        A11["Audit agent decisions"] --> A12["Review consent<br/>compliance"]
        A12 --> A13["Generate compliance<br/>report"]
    end

    P1 --> P2 --> P3 --> P4
```

### Administrator System Touchpoints

| Phase | Primary Interface | Data Sources | Agent Interaction |
|-------|------------------|--------------|-------------------|
| Monitoring | Admin dashboard | LangGraphExecution, Alert, AgentHealthLog | All agents (read metrics) |
| Analysis | Insights + Analytics views | InsightsReport, analytics queries | IA (query execution) |
| Action | Autopilot + Campaign management | AutopilotAction, Campaign | Aika (policy evaluation) |
| Review | Agent Decisions + Audit Logs | LangGraphNodeExecution, UserAuditLog | All agents (audit trail) |

### Administrator Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Alert response time | < 4 hours | Time from alert creation to admin action |
| Autopilot approval latency | < 24 hours | Time from action queued to approved/rejected |
| Analytics query success rate | ≥ 95% | Successful queries / total queries |
| System uptime | ≥ 99.5% | Uptime percentage per month |

---

## Cross-Journey Interactions

The three user journeys are not independent. The following diagram shows how actions by one role trigger responses visible to others.

```mermaid
flowchart TD
    STU_ACT["Student sends<br/>distress message"] --> AIKA_ROUTE["Aika routes to<br/>crisis path"]
    AIKA_ROUTE --> TCA_ACT["TCA generates<br/>coping plan"]
    AIKA_ROUTE --> CMA_ACT["CMA creates case<br/>+ assigns counselor"]
    CMA_ACT --> CNS_SEE["Counselor sees<br/>new case in queue"]
    CNS_SEE --> CNS_ACT["Counselor accepts<br/>and conducts session"]
    CNS_ACT --> ATTEST["Attestation submitted<br/>to blockchain"]
    ATTEST --> ADM_SEE["Admin sees<br/>attestation on dashboard"]
    ADM_SEE --> TREND["Population trends<br/>updated via IA"]
    TREND --> CAMPAIGN["Admin launches<br/>targeted campaign"]
    CAMPAIGN --> STU_SEE["Student receives<br/>check-in message"]

    style STU_ACT fill:#4dabf7,color:#fff
    style CNS_SEE fill:#51cf66,color:#fff
    style ADM_SEE fill:#ffd43b,color:#333
    style STU_SEE fill:#4dabf7,color:#fff
```
