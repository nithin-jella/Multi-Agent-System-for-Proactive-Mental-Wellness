---
id: case-management-agent
title: Case Management Agent
sidebar_position: 4
---

# Case Management Agent

## CMA - Case Management Agent

## What Is the CMA?

The Case Management Agent (CMA) serves as the primary connection between artificial intelligence and human care. When the STA determines that a student's risk level necessitates professional clinical support, the CMA manages the operational requirements. These include initiating a formal case, identifying an appropriate counselor, scheduling appointments, and monitoring follow-up care. In clinical terms, the CMA facilitates care coordination, managing the logistical requirements that typically involve administrative staff.

In clinical terms, the CMA handles **care coordination** - the logistical layer that, in a traditional service, would involve receptionists, administrative staff, and phone tag.

---

## CMA LangGraph Flow

The CMA is implemented as a compiled LangGraph for case management operations:

```mermaid
flowchart TD
    START([CMA Invoked]) --> TRIGGER["Determine Trigger<br/>crisis path / student request<br/>/ STA recommendation"]
    TRIGGER --> CASE_EXISTS{Active case<br/>exists?}
    CASE_EXISTS --> |Yes| UPDATE_CASE["Update Existing Case<br/>Append risk data"]
    CASE_EXISTS --> |No| CREATE_CASE["Create New Case<br/>Set status = OPEN<br/>Set SLA deadline"]

    CREATE_CASE --> ASSIGNMENT["Run Assignment Algorithm"]
    ASSIGNMENT --> SCORE["Score Counselors<br/>1. Specialty match<br/>2. Current caseload (ASC)<br/>3. Availability (next 72h)<br/>4. Language preference"]
    SCORE --> RANK["Rank candidates"]
    RANK --> PRESENT["Present top 2-3<br/>to student"]
    PRESENT --> STUDENT_PICK{Student<br/>selects?}
    STUDENT_PICK --> |Yes| BOOK["Book Appointment<br/>see flow below"]
    STUDENT_PICK --> |No / Auto| AUTO_ASSIGN["Auto-assign top<br/>ranked counselor"]

    BOOK --> NOTIFY["Notify Counselor<br/>Dashboard + optional email"]
    AUTO_ASSIGN --> NOTIFY
    UPDATE_CASE --> NOTIFY

    NOTIFY --> PERSIST["Persist to DB<br/>Case + CaseAssignment<br/>+ Appointment records"]
    PERSIST --> END([Return to Synthesis])

    style ASSIGNMENT fill:#a855f7,color:#fff
    style SCORE fill:#a855f7,color:#fff
```

---

## SLA Enforcement Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CaseOpen: CMA creates case
    CaseOpen --> SLARunning: SLA timer starts
    SLARunning --> WithinSLA: Counselor accepts<br/>before deadline
    SLARunning --> SLAWarning: 50% of SLA elapsed
    SLAWarning --> WithinSLA: Counselor accepts
    SLAWarning --> SLABreached: Deadline passed
    SLABreached --> AlertAdmin: Admin dashboard alert
    AlertAdmin --> Reassigned: Auto-reassign or<br/>admin intervention
    WithinSLA --> Scheduled: Appointment booked
    Reassigned --> SLARunning: New counselor assigned
    Scheduled --> InSession: Session starts
    InSession --> PendingAttestation: Session ends
    PendingAttestation --> Closed: Attestation submitted
    Closed --> [*]
```

---

## When Is the CMA Invoked?

The CMA is triggered when:

1. **Risk level ≥ 2 (HIGH/CRITICAL)**: Automatically invoked in parallel with the TCA.
2. **Student explicitly requests counselling**: Detected by Aika's intent classifier (`appointment_scheduling` intent).
3. **STA post-conversation analysis recommends referral**: The STA's background analysis can write a `counsellor_recommendation` field, which a counsellor sees in their dashboard and can act on.

---

## The Case Lifecycle

```mermaid
stateDiagram-v2
 [*] --> Open: CMA creates case
 Open --> Assigned: Counsellor accepts
 Assigned --> AppointmentScheduled: CMA books slot
 AppointmentScheduled --> InSession: Counsellor marks session started
 InSession --> PendingAttestation: Session ends
 PendingAttestation --> Closed: Counsellor submits attestation
 Closed --> [*]
 Open --> Closed: Student cancels / resolved without session
 Assigned --> Reassigned: Original counsellor unavailable
 Reassigned --> AppointmentScheduled
```

Each state transition is persisted to the database and visible to both the student (simplified view) and the counsellor (full case details).

---

## Counsellor Assignment

CMA selects counselors using a priority scoring algorithm. The system first matches specializations based on identified intents, such as academic stress. It then prioritizes counselors with lower active caseloads to ensure balanced distribution. Finally, it considers counselor availability within the next 72 hours and language preferences. Students are presented with the top two or three counselor options for confirmation to ensure consent throughout the process.

1. **Specialisation match**: If the STA's `intent` suggests a particular area (e.g., `academic_stress`), counsellors with matching specialisations are ranked higher.
2. **Current caseload**: Counsellors with fewer active cases are preferred, distributing load fairly.
3. **Availability**: Only counsellors with open appointment slots in the next 72 hours are considered.
4. **Language preference**: Students can specify a preference for Bahasa Indonesia or English, filtered before ranking.

The student is shown the top two to three counsellor options and asked to confirm, rather than having a counsellor assigned without consent.

---

## Appointment Booking Flow

The CMA orchestrates a multi-step booking flow through Aika's tool-calling interface:

```
1. get_available_counselors() → Returns ranked list of counsellors
2. suggest_appointment_times() → Returns available slots for chosen counsellor
3. book_appointment() → Creates appointment record in DB
4. (Optional) Sends confirmation notification via SSE to frontend
```

The entire flow happens conversationally. The student does not navigate to a separate booking page. Aika says something like:

> *"I found two counsellors available this week - Bu Ratna specialises in academic stress, and Pak Andri has experience with anxiety. Which feels right? And would 10am tomorrow or 2pm Thursday work for you?"*

---

## Service Level Agreement (SLA)

The CMA enforces a soft SLA on case response times:

| Risk Level | Target Time to First Counsellor Contact |
| --- | --- |
| CRITICAL | Within 4 hours |
| HIGH | Within 24 hours |
| MODERATE | Within 72 hours |
| LOW (student-initiated) | Within 5 business days |

If a case is not picked up within its SLA window, the system generates an alert visible to the administrator dashboard.

---

## Blockchain Attestation

When a counselor closes a case, they submit a session attestation, which is a signed summary of the delivered intervention. This attestation is hashed using SHA-256 and submitted as a transaction to the CARE token smart contract. The resulting transaction hash is stored in the `CaseAttestation` table. This process establishes an immutable audit trail, allowing institutions to verify that a session occurred without accessing clinical details. Actual session notes are maintained within the encrypted PostgreSQL database.

1. Hashed (SHA-256)
2. Submitted as a transaction to the CARE token smart contract on Ethereum
3. The transaction hash is stored in the `CaseAttestation` table alongside the case record

This creates an immutable audit trail. Institutions can verify that a session occurred without accessing any clinical details - they only see the hash and the timestamp. The actual session notes remain in the encrypted PostgreSQL database.

```mermaid
sequenceDiagram
 participant CNS as Counsellor
 participant API as Backend API
 participant DB as PostgreSQL
 participant SC as CARE Token Contract

 CNS->>API: Submit session attestation
 API->>DB: Save attestation record
 API->>API: Hash attestation content
 API->>SC: attest(caseId, hash, timestamp)
 SC-->>API: Transaction hash
 API->>DB: Store tx_hash in CaseAttestation
 API-->>CNS: Attestation confirmed
```

---

## What the CMA Does Not Do

The CMA does not:

- Conduct therapy or psychological assessment
- Override a student's appointment preferences without confirmation
- Store clinical notes - those are written exclusively by the human counsellor
- Access any blockchain identity that could link to the student's personal data
