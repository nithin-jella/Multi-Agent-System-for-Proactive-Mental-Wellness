# UGM-AICare: Agentic Mental Health Support with Autonomous Onchain Actions

**Live Demo:** https://aicare.sumbu.xyz &nbsp;|&nbsp; **Proof Timeline:** https://aicare.sumbu.xyz/proof &nbsp;|&nbsp; **Admin Panel:** https://aicare.sumbu.xyz/admin

Welcome to the hackathon showcase of UGM-AICare! This document highlights the specific innovations built for the competition, particularly our policy-gated autonomous actions and on-chain verification ledger.

---

## The Problem

University counseling services are structurally reactive. Students must recognize their own distress, decide to seek help, navigate an appointment system, and wait — often weeks. By the time a student reaches a counselor, the opportunity for early intervention has already passed.

The counselor-to-student ratio at most universities sits around 1:1000. No amount of hiring closes that gap. The tools need to change.

**UGM-AICare reframes the problem:** instead of waiting for students to ask for help, the system proactively identifies distress signals, intervenes early, and hands off to human counselors only when it matters most.

---

## What We Built

We developed a full-stack, production-deployed ecosystem that bridges advanced AI orchestration with secure blockchain verification:

- A **multi-agent AI orchestration layer** built on LangGraph, coordinating four specialized agents under a meta-agent (Aika).
- A **covert mental health screening engine** that passively maps natural conversation to nine clinically validated instruments (PHQ-9, GAD-7, DASS-21, C-SSRS, and five others).
- A **policy-gated autopilot** that governs when AI agents can act autonomously versus when a human must approve.
- An **on-chain attestation ledger** recording every consequential AI action as a verifiable proof with transaction hashes.
- An **NFT achievement system** (ERC1155) that gives students tamper-proof ownership of their wellness milestones.
- A comprehensive **counselor and admin dashboard** for case management, agent decision auditing, and population-level insights.

Everything is live. The backend serves real users at [api.aicare.sumbu.xyz](https://api.aicare.sumbu.xyz). Smart contracts are deployed on BSC Testnet. The proof timeline at `/proof` shows actual transaction hashes.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend  ·  Next.js 15, Tailwind CSS 4, Framer Motion          │
│  https://aicare.sumbu.xyz                                        │
├──────────────────────────────────────────────────────────────────┤
│  Backend  ·  FastAPI, SQLAlchemy 2 (Async), Redis                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                   Aika  (Meta-Agent)                    │     │
│  │   Intent routing · Screening synthesis · Escalation     │     │
│  └────────────┬──────────────┬──────────────┬─────────────┘     │
│               │              │              │                     │
│           ┌───┴───┐      ┌───┴───┐      ┌───┴───┐               │
│           │  STA  │      │  TCA  │      │  CMA  │               │
│           │Safety │      │ Coach │      │ Cases │               │
│           └───────┘      └───────┘      └───────┘               │
│                                                                  │
│  Policy Engine  ──►  Autopilot Worker  ──►  Onchain Actions      │
├──────────────────────────────────────────────────────────────────┤
│  Blockchain Layer  ·  BSC Testnet                                │
│  UGMJournalBadges (ERC1155)  ·  BSCAttestationRegistry          │
└──────────────────────────────────────────────────────────────────┘
```

---



### C4 Architecture Model

The following diagrams provide a formal C4 model representation of the system.

#### C4 Context Diagram

Illustrates the high-level boundaries of the UGM-AICare ecosystem, demonstrating how students and counselors interact with the main system, and how the system delegates data persistence, caching, reasoning (LLM), and blockchain attestations to external providers.

```mermaid
C4Context
title System Context diagram for UGM-AICare
Person(student, "Student", "A university student seeking mental health support.")
Person(counselor, "Counselor / Admin", "University staff managing cases and system operations.")
System(aicare, "UGM-AICare", "Proactive agentic mental health support ecosystem.")
System_Ext(db, "PostgreSQL", "Stores user profiles, screening history, cases, and logs.")
System_Ext(cache, "Redis", "Session cache and background task queue.")
System_Ext(genai, "Google GenAI (Gemini)", "Provides LLM capabilities for semantic analysis and reasoning.")
System_Ext(educhain, "EDU Chain", "Blockchain for storing verifiable wellness achievement badges.")

Rel(student, aicare, "Seeks support, chats with agents, views badges")
Rel(counselor, aicare, "Manages escalations, views insights, approves actions")
Rel(aicare, db, "Reads and writes relational data")
Rel(aicare, cache, "Stores transient state and queues background tasks")
Rel(aicare, genai, "Sends prompts, receives generated responses")
Rel(aicare, educhain, "Mints badges (ERC1155), writes attestations")
```

#### C4 Container Diagram

Drills down into the specific application containers and components. It emphasizes the Multi-Agent LangGraph orchestration layer, showing the routing dynamics between the Aika Meta-Agent and the specialized STA, TCA, CMA, and IA sub-agents.

```mermaid
C4Container
title Container diagram for UGM-AICare
Person(student, "Student", "A university student.")
Person(counselor, "Counselor / Admin", "Staff managing operations.")

System_Boundary(c1, "UGM-AICare") {
    Container(frontend, "Frontend App", "Next.js 15, React", "Provides the user interface for students and counselors.")
    Container(backend, "Backend API", "FastAPI, Python", "Handles API requests, orchestrates AI agents, manages system state.")

    Container_Boundary(ai, "Multi-Agent System (LangGraph)") {
        Component(aika, "Aika (Meta-Agent)", "Agent", "Intent recognition, routing, and conversation state management.")
        Component(sta, "STA (Safety Triage Agent)", "Agent", "Risk assessment and covert mental health screening extraction.")
        Component(tca, "TCA (Therapeutic Coach Agent)", "Agent", "Provides evidence-based therapeutic support (CBT).")
        Component(cma, "CMA (Case Management Agent)", "Agent", "Handles human escalation and resource coordination.")
        Component(ia, "IA (Insights Agent)", "Agent", "Provides privacy-preserving population analytics.")
    }

    Container(autopilot, "Policy Engine & Worker", "Python", "Governs onchain actions, queues pending tasks, and executes them.")
}

System_Ext(db, "PostgreSQL", "Relational Database")
System_Ext(cache, "Redis", "In-Memory Store")
System_Ext(genai, "Google GenAI", "LLM Provider")
System_Ext(educhain, "EDU Chain", "Blockchain Network")

Rel(student, frontend, "Visits aicare.sumbu.xyz", "HTTPS")
Rel(counselor, frontend, "Visits /admin dashboard", "HTTPS")
Rel(frontend, backend, "Makes API calls to", "JSON/HTTPS")

Rel(backend, aika, "Routes user messages to")
Rel(aika, sta, "Delegates safety check to")
Rel(aika, tca, "Delegates coaching to")
Rel(aika, cma, "Delegates escalation to")
Rel(aika, ia, "Delegates analytics queries to")

Rel(backend, autopilot, "Sends proposed actions to")
Rel(autopilot, educhain, "Submits transactions (minting/attestations)")

Rel(backend, db, "Reads/writes data", "SQL/TCP")
Rel(backend, cache, "Caches state/queues", "TCP")
Rel(backend, genai, "Performs inference via", "HTTPS")
```

## Aika and the Agent Network

Aika is not a chatbot. She is a **meta-agent orchestrator** that classifies every incoming message, routes it to the right specialized agent, synthesizes a response, and updates a persistent screening profile — all within a single LangGraph StateGraph execution.

| Agent | Role | What it actually does |
|-------|------|-----------------------|
| **Aika** | Meta-Agent Orchestrator | Intent classification, agent routing, response synthesis, longitudinal profile updates |
| **STA** | Safety Triage Agent | Two-tier risk scoring (regex in <5ms, then Gemini 2.5 semantic analysis). Outputs risk levels 0–3. |
| **TCA** | Therapeutic Coach Agent | CBT-based interventions — cognitive restructuring, behavioral activation, guided relaxation |
| **CMA** | Case Management Agent | Creates escalation cases, routes to counselors by specialty and workload, schedules follow-ups |
| **IA** | Insights Agent | k-anonymous population analytics with differential privacy guarantees |

**Risk escalation path:**

- Level 0 — Normal conversation. Aika engages naturally.
- Level 1 — Mild distress detected. Aika monitors and offers light support.
- Level 2 — Moderate risk. TCA activates with evidence-based interventions.
- Level 3 — Crisis signal. CMA immediately escalates to a human counselor. No AI responses are generated at this level without human oversight.

---

## Covert Screening Engine

Every conversation passively updates a structured screening profile using nine validated psychological instruments. Users are not told they are being assessed — this intentional design reduces social desirability bias and surfaces authentic signals that self-report forms miss.

| Instrument | Domains Tracked |
|------------|-----------------|
| PHQ-9 | Depression, anhedonia, suicidal ideation |
| GAD-7 | Generalized anxiety, uncontrollable worry |
| DASS-21 | Stress, nervous arousal, irritability |
| PSQI | Sleep quality, efficiency, daytime dysfunction |
| UCLA Loneliness Scale v3 | Social and emotional isolation |
| Rosenberg Self-Esteem Scale | Self-worth, self-acceptance |
| AUDIT | Alcohol use patterns, coping drinking |
| C-SSRS | Suicidality spectrum from ideation through planning |
| SSI (adapted) | Academic stress, thesis pressure, fear of failure |

Scores update using exponential decay — `new = old × 0.95 + extracted × 0.05` — so recent signals carry more weight without discarding longitudinal history. The screening admin dashboard (`/admin/screening`) surfaces population trends anonymized to k≥5 groups.

---

## Policy-Gated Autopilot

The autopilot layer is where this project moves beyond a conversational AI. Aika does not execute onchain actions directly. Every proposed action passes through a policy engine that classifies it by risk tier:

| Tier | Disposition | Example actions |
|------|-------------|-----------------|
| **Low** | Auto-approved, executes immediately | Minting a streak badge after 7 consecutive days |
| **Moderate** | Queued for admin review | Creating a counseling case for a student |
| **High** | Denied by default | Any action touching financial contracts or personal data export |

Approved actions are dispatched to an async worker that handles submission, retry scheduling, and dead-letter tracking. The transaction hash and chain ID are stored against the original action record. This creates a full audit trail from Aika's decision through to on-chain confirmation.

**Verification surfaces for judges:**

- Admin queue: https://aicare.sumbu.xyz/admin/autopilot
- Proof timeline: https://aicare.sumbu.xyz/proof
- REST API: `/api/v1/admin/autopilot/actions`, `…/approve`, `…/reject`
- Replay script: `python scripts/replay_autopilot_demo.py`
- Demo artifact: `docs/autopilot_demo_artifact.json`

> **Note on demo mode:** If `AUTOPILOT_ONCHAIN_PLACEHOLDER=true`, transaction hashes are synthetic. Backend startup logs include explicit warnings whenever a placeholder hash is generated. Switching to live onchain submission requires replacing the placeholder handlers in the autopilot execution paths.

---

## Onchain Layer

### Achievement Badges — `UGMJournalBadges.sol` (ERC1155)

Wellness milestones are minted as NFTs students actually own. Streaks (3, 7, 14, 30 days), journal milestones, and extended chat sessions each correspond to a distinct token ID.

- **Contract:** `0x8c251c055BC712246392C8229e5ad95859c48AFe`
- **Network:** BSC Testnet (Chain ID: 97)
- **Explorer:** https://testnet.bscscan.com/address/0x8c251c055BC712246392C8229e5ad95859c48AFe
- **Sync your badges:** https://aicare.sumbu.xyz/dashboard → Achievements → "Sync badges"

### Attestation Registry — `BSCAttestationRegistry.sol`

Every confirmed autopilot action writes an attestation record onchain: what happened, who authorized it, and when. This satisfies the accountability requirement for a system acting on behalf of vulnerable users.

- **Contract:** `0x6F91e908833FcECEbAdFEEC5Ee6576916E34e09F`
- **Network:** BSC Testnet (Chain ID: 97)
- **Explorer:** https://testnet.bscscan.com/address/0x6F91e908833FcECEbAdFEEC5Ee6576916E34e09F

---

## Privacy and Clinical Governance

This is not a toy. The system processes sensitive mental health data for real students, so governance is not optional.

- **k-Anonymity (k≥5):** The Insights Agent refuses to return any aggregate smaller than five individuals. Population queries cannot be narrowed to identify specific users.
- **Differential Privacy:** Noise injection (ε-δ budgets) is applied before serving trend data to the admin dashboard.
- **PII Redaction:** All conversation text is scrubbed of names, phone numbers, and email addresses before storage or downstream analysis.
- **Human-in-the-Loop at Level 3:** No AI response is generated for crisis-level signals. CMA routes to a human counselor immediately.
- **Consent Ledger:** User consent grants and withdrawals are recorded as immutable audit entries.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Agent orchestration | LangGraph (StateGraph, conditional edges) |
| LLM backbone | Google Gemini 2.5 (chain-of-thought reasoning) |
| Backend | FastAPI, SQLAlchemy 2 (async), Alembic, Redis |
| Frontend | Next.js 15, TypeScript, Tailwind CSS 4, Framer Motion |
| Smart contracts | Solidity, Hardhat, ERC1155, BSC Testnet |
| Auth | NextAuth.js (UGM SSO integration) |
| Infrastructure | Docker Compose, PostgreSQL, Redis |

---

## Why This Fits the Agent Track

Most AI agent demos stop at tool calling. UGM-AICare goes further on three dimensions:

**1. Real-world stakes.** The system handles mental health triage for university students. A missed escalation or a hallucinated intervention has consequences. The architecture reflects that — covert screening, validated instruments, risk-tiered routing, and mandatory human oversight at the crisis level.

**2. Verifiable autonomy.** Aika's decisions are not black boxes. Every consequential action passes through a policy engine, gets recorded in the autopilot queue, and writes an attestation onchain. Judges can verify the proof timeline at `/proof` with actual transaction hashes.

**3. Longitudinal intelligence.** Unlike a stateless chatbot, Aika maintains a persistent screening profile per user, updated across every session using nine validated instruments. The system gets more accurate over time, not just more conversational.

---

## Links

| Resource | URL |
|----------|-----|
| Live application | https://aicare.sumbu.xyz |
| Proof timeline | https://aicare.sumbu.xyz/proof |
| Admin autopilot queue | https://aicare.sumbu.xyz/admin/autopilot |
| GitHub repository | https://github.com/gigahidjrikaaa/UGM-AICare |
| Badges contract (BSCScan) | https://testnet.bscscan.com/address/0x8c251c055BC712246392C8229e5ad95859c48AFe |
| Attestation contract (BSCScan) | https://testnet.bscscan.com/address/0x6F91e908833FcECEbAdFEEC5Ee6576916E34e09F |

---

*Built for the UGM student community. Maintained by [Giga Hidjrika Aura Adkhy](https://linkedin.com/in/gigahidjrikaaa).*
