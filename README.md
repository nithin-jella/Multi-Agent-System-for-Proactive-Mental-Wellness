# UGM-AICare: Agentic Mental Health Support System 🌟

![UGM-AICare Logo](frontend/public/aicare_logo.png)

**Live Demo:** [https://aicare.sumbu.xyz](https://aicare.sumbu.xyz) | **API:** [https://api.aicare.sumbu.xyz](https://api.aicare.sumbu.xyz)

---

## 🔒 Security Notice

**Critical Security Update (Dec 8, 2025):** This project has been patched against **CVE-2025-66478** (CVSS 10.0) and **CVE-2025-55182** - critical Remote Code Execution vulnerabilities affecting React Server Components and Next.js App Router.

✅ **Current Versions (Patched):**

- Next.js: **16.0.7** (was 16.0.0)

### 🐳 Docker Compose

This repository uses an **app-only** Docker Compose setup (backend + frontend). Database/Redis/S3 are treated as **external managed services** configured via `.env`.

```bash
# Dev (hot reload)
docker compose --env-file .env -f docker-compose.base.yml -f docker-compose.dev.yml up -d

# Preprod (production builds, no hot reload)
docker compose --env-file .env -f docker-compose.base.yml -f docker-compose.preprod.yml up -d

# Prod (production config)
docker compose --env-file .env -f docker-compose.base.yml -f docker-compose.prod.yml up -d
```

If you prefer scripts, `./dev.sh` wraps the common local commands.

### Development and split-subdomain deployment

The repository is commonly deployed with distinct subdomains:

- Frontend: `https://aicare.sumbu.xyz`
- Backend: `https://api.aicare.sumbu.xyz`

For local development, a typical configuration is `NEXTAUTH_URL=http://localhost:22000` and `NEXT_PUBLIC_API_URL=http://localhost:22001`.

### 1.1 The Challenge

University mental health services globally face a "reactive capacity crisis." Traditional support systems are:

- **Reactive:** Waiting for students to reach crisis points before intervention.
- **Under-Resourced:** High counselor-to-student ratios (often 1:1000+).
- **Data-Constrained:** Lacking real-time insights into population-level mental health trends.

### 1.2 Mission & Solution Goal

**UGM-AICare** aims to transform university mental health support from a reactive service to a **proactive, agentic ecosystem**.

- **Proactive Intervention:** Early detection of distress signals using semantic analysis.
- **Agentic Automation:** Coordinated AI agents handling triage, coaching, and case management.
- **Privacy-First:** Institution-grade privacy with k-anonymity and differential privacy.

---

## 🧠 Chapter 2: Multi-Agent Architecture

### 2.1 Agentic Architecture Principles

Unlike traditional chatbots, UGM-AICare uses a **Multi-Agent System (MAS)** based on the **Belief-Desire-Intention (BDI)** model.

- **Belief (State):** What the agent knows (User Profile, Conversation History, Risk Level).
- **Desire (Goal):** What the agent wants to achieve (Ensure Safety, Reduce Anxiety).
- **Intention (Action):** What the agent decides to do (Execute Triage, Generate Plan).



### 2.2 System Architecture (C4 Model)

The UGM-AICare architecture is designed to orchestrate complex agentic interactions while maintaining strict data flow control and external service integration. Below are the Context and Container level diagrams of the system.

#### C4 Context Diagram

The Context diagram shows the high-level interactions between the users (Students and Counselors) and the UGM-AICare system, as well as the external dependencies like databases, caching, LLM providers, and blockchain networks for secure attestations.

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

The Container diagram drills down into the internal components of UGM-AICare, showing how the Frontend Next.js app communicates with the Python FastAPI Backend. Crucially, it maps out the internal Multi-Agent System orchestration, detailing how the Meta-Agent (Aika) routes traffic to specialized sub-agents. It also illustrates the Autopilot Policy Engine which governs on-chain actions.

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

### 2.3 Agent Orchestration with Aika

The system is orchestrated by **Aika**, a Meta-Agent that coordinates four specialized sub-agents using LangGraph. Each agent has a distinct responsibility, ensuring separation of concerns and efficient resource utilization.

```bash
                    ┌─────────────────────────────────────────────────────┐
                    │                  USER MESSAGE                       │
                    └─────────────────────────────────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────────────────┐
                    │              🤖 AIKA (Meta-Agent)                   │
                    │  ─────────────────────────────────────────────────  │
                    │  • Intent Recognition & Routing                     │
                    │  • Conversation State Management                    │
                    │  • Covert Mental Health Screening                   │
                    │  • Response Synthesis                               │
                    └─────────────────────────────────────────────────────┘
                         │           │            │            │
           ┌─────────────┘           │            │            └─────────────┐
           ▼                         ▼            ▼                          ▼
    ┌─────────────┐           ┌─────────────┐  ┌─────────────┐        ┌─────────────┐
    │  🛡️STA     │           │  🧠 TCA    │  │  📋 CMA     │        │  📊 IA      │
    │  Safety     │           │  Therapeutic│  │  Case       │        │  Insights   │
    │  Triage     │           │  Coach      │  │  Management │        │  Analytics  │
    └─────────────┘           └─────────────┘  └─────────────┘        └─────────────┘
```

### 2.4 Specialized Agent Roles & Responsibilities

| Agent | Full Name | Primary Responsibility | Key Functions |
|-------|-----------|------------------------|---------------|
| **🤖 Aika** | Meta-Agent Orchestrator | Central coordination and user interface | Intent classification, agent routing, response synthesis, screening profile updates |
| **🛡️ STA** | Safety Triage Agent | Risk assessment and crisis detection | Message-level risk scoring (0-3), conversation-level analysis, covert screening extraction, PII redaction |
| **🧠 TCA** | Therapeutic Coach Agent | Evidence-based therapeutic support | CBT-based interventions, coping strategies, psychoeducation, wellness activities |
| **📋 CMA** | Case Management Agent | Human escalation and resource coordination | Case creation, counselor assignment, appointment scheduling, follow-up tracking |
| **📊 IA** | Insights Agent | Privacy-preserving analytics | K-anonymous queries, trend analysis, population health dashboards |

### 2.5 Agent Workflow Details

#### 🛡️ STA (Safety Triage Agent)

The first line of defense, STA analyzes every incoming message for risk indicators:

1. **Tier 1 - Regex Rules (0-5ms):** Immediate keyword detection for crisis terms.
2. **Tier 2 - LLM Semantic Analysis (200ms):** Deep context understanding using Gemini 2.5.
3. **Screening Extraction:** Covertly extracts mental health indicators based on validated instruments.

**Risk Levels:**

- **Level 0:** No risk detected - normal conversation.
- **Level 1:** Mild distress - monitor and provide support.
- **Level 2:** Moderate risk - activate TCA for therapeutic intervention.
- **Level 3:** Crisis/Severe - immediate CMA escalation to human counselor.

#### 🧠 TCA (Therapeutic Coach Agent)

Provides evidence-based therapeutic support using CBT principles:

- **Cognitive Restructuring:** Helps identify and challenge negative thought patterns.
- **Behavioral Activation:** Suggests activities to improve mood.
- **Relaxation Techniques:** Guided breathing, grounding exercises.
- **Psychoeducation:** Explains mental health concepts in accessible terms.

#### 📋 CMA (Case Management Agent)

Handles high-risk situations requiring human intervention:

- **Case Creation:** Documents situation with risk assessment and context.
- **Smart Assignment:** Routes to available counselors based on specialty and workload.
- **Appointment Management:** Schedules sessions and sends reminders.
- **Follow-up Tracking:** Monitors case progress and outcomes.

#### 📊 IA (Insights Agent)

Provides anonymized analytics for institutional decision-making:

- **Population Health Trends:** Aggregated stress levels by faculty, semester.
- **Resource Optimization:** Identifies peak demand periods.
- **Privacy Guarantees:** All queries enforce k≥5 anonymity.

---

## 🔬 Chapter 3: Covert Screening & Validated Instruments

### 3.1 Covert Screening Approach

UGM-AICare implements a **covert mental health screening system** that passively extracts psychological indicators from natural conversation. Users are not aware they are being screened, which reduces social desirability bias and captures authentic mental states.

The STA agent performs dual analysis on every message:

1. **Risk Assessment:** Immediate safety evaluation.
2. **Screening Extraction:** Maps conversation content to validated instrument domains.

### 3.2 Validated Psychological Instruments

All screening dimensions are based on internationally validated instruments with established psychometric properties:

| Dimension | Instrument | Reference | Domains Assessed |
|-----------|------------|-----------|------------------|
| **Depression** | PHQ-9 (Patient Health Questionnaire-9) | Kroenke et al. (2001) | Anhedonia, depressed mood, sleep, fatigue, appetite, worthlessness, concentration, psychomotor changes, suicidal ideation |
| **Anxiety** | GAD-7 (Generalized Anxiety Disorder-7) | Spitzer et al. (2006) | Nervousness, uncontrollable worry, excessive worry, trouble relaxing, restlessness, irritability, fear of awful events |
| **Stress** | DASS-21 Stress Subscale | Lovibond & Lovibond (1995) | Difficulty relaxing, nervous energy, agitation, irritability, impatience, overwhelm, intolerance |
| **Sleep Quality** | PSQI (Pittsburgh Sleep Quality Index) | Buysse et al. (1989) | Sleep quality, latency, duration, efficiency, disturbances, medication use, daytime dysfunction |
| **Social Isolation** | UCLA Loneliness Scale (Version 3) | Russell (1996) | Social loneliness, emotional loneliness, perceived isolation, social withdrawal, companionship |
| **Self-Esteem** | RSES (Rosenberg Self-Esteem Scale) | Rosenberg (1965) | Self-worth, self-acceptance, self-competence, comparative worth, self-respect |
| **Substance Use** | AUDIT (Alcohol Use Disorders Identification Test) | Saunders et al. (1993) | Hazardous use, dependence symptoms, harmful use, coping drinking |
| **Crisis/Suicidality** | C-SSRS (Columbia Suicide Severity Rating Scale) | Posner et al. (2011) | Wish to be dead, suicidal thoughts, intent, plan, self-harm, preparatory behavior |
| **Academic Stress** | SSI (Student Stress Inventory) | Lakaev (2009), adapted | Academic pressure, fear of failure, thesis stress, peer comparison, future anxiety |

### 3.3 Scoring & Severity Thresholds

Each dimension uses instrument-specific thresholds normalized to a 0-1 scale:

```bash
Severity:    None     Mild     Moderate    Severe    Critical
             │        │        │           │         │
PHQ-9:       0───────0.19────0.37────────0.56──────0.74───────1.0
GAD-7:       0───────0.24────0.48────────0.71──────0.90───────1.0
DASS-21:     0───────0.19────0.29────────0.38──────0.60───────1.0
```

**Severity Labels:**

- **None:** Score below clinical threshold.
- **Mild:** Subclinical symptoms present.
- **Moderate:** Clinical attention recommended.
- **Severe:** Professional intervention needed.
- **Critical:** Immediate crisis response required.

### 3.4 Longitudinal Tracking

Screening profiles are updated with each conversation using exponential decay:

```bash
new_score = old_score × decay_factor + extracted_weight × update_factor
```

Where `decay_factor = 0.95` ensures recent indicators are weighted more heavily while maintaining longitudinal history.

---

## 🔒 Chapter 4: Research Questions & Governance

### 4.1 Research Questions (RQ)

This project is guided by three core research questions:

- **RQ1 (Proactive Safety):** Can an agentic system detect crisis signals with high sensitivity (>90%) and low false negatives?
- **RQ2 (Functional Correctness):** Can a LangGraph-based orchestrator reliably route intents without hallucinations?
- **RQ3 (Output Quality & Privacy):** Can the system generate clinically valid CBT responses while maintaining k-anonymity?

### 4.2 Clinical Governance

- **Human-in-the-Loop:** Critical risks (Level 3) are strictly escalated to human counselors via CMA.
- **Evidence-Based:** Interventions are grounded in CBT (Cognitive Behavioral Therapy) principles.
- **Consent Ledger:** Immutable audit trail of user consents and withdrawals.

### 4.3 Privacy & Compliance

- **k-Anonymity (k≥5):** Analytics queries never return data sets smaller than 5 individuals.
- **Differential Privacy:** Noise injection (ε-δ budgets) to prevent re-identification.
- **PII Redaction:** All text is scrubbed of names/phones/emails before storage or analysis.

---

## 🛠️ Chapter 5: Implementation Details

### 5.1 Technical Stack

- **Orchestration:** LangGraph (StateGraph, Conditional Edges).
- **Intelligence:** Google Gemini 2.5 (Chain-of-Thought Reasoning).
- **Backend:** FastAPI (Python), SQLAlchemy 2 (Async), Redis.
- **Frontend:** Next.js 15, Tailwind CSS 4, Framer Motion.
- **Blockchain:** EDU Chain (ERC1155) for Achievement Badges.

### 5.2 Project Structure

```bash
├── backend/
│   ├── app/
│   │   ├── agents/                    # LangGraph Agent Implementations
│   │   │   ├── aika/                  # Meta-Agent Orchestrator
│   │   │   │   ├── aika_graph.py      # Main orchestration logic
│   │   │   │   └── screening_awareness.py  # Screening gap analysis
│   │   │   ├── sta/                   # Safety Triage Agent
│   │   │   │   ├── sta_graph.py       # Risk assessment workflow
│   │   │   │   └── conversation_analyzer.py  # Deep analysis + screening
│   │   │   ├── tca/                   # Therapeutic Coach Agent
│   │   │   ├── cma/                   # Case Management Agent
│   │   │   └── ia/                    # Insights Agent
│   │   ├── domains/
│   │   │   └── mental_health/
│   │   │       └── screening/         # Validated instrument definitions
│   │   │           ├── instruments.py # PHQ-9, GAD-7, DASS-21, etc.
│   │   │           └── engine.py      # Profile update logic
│   │   └── routes/                    # API Endpoints
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── admin/                 # Admin Dashboard
│   │   │       └── screening/         # Screening monitoring interface
│   │   └── components/                # UI Components
│   └── package.json
└── docs/                              # Architecture Documentation
```

---

## 🏁 Hackathon Focus: Aika Autopilot + Onchain Attestation Ledger

This section summarizes the exact feature set implemented for hackathon judging.

### What the system does

- **Policy-governed autonomy:** Aika routes operational actions into an autopilot control plane with explicit decisions (`allow`, `require_approval`, `deny`).
- **Human approval gates:** High-risk paths are queued for admin review before execution (`/admin/autopilot`).
- **Durable execution worker:** Queued actions run with retry scheduling and dead-letter handling to preserve execution traceability.
- **Onchain attestation path:** Confirmed autopilot actions store `tx_hash` and `chain_id` for ledger-style verification.
- **Proof timeline:** User-facing and admin-facing proof views expose lifecycle states from queue to confirmation (`/proof`).
- **Replayable evidence:** Deterministic replay script exports artifact JSON for reproducible demo checks (`docs/autopilot_demo_artifact.json`).

### Verification surfaces for judges

- **Admin queue UI:** `/admin/autopilot` (approval and status transition visibility).
- **Proof UI:** `/proof` (status, tx hash, explorer link visibility).
- **Admin APIs:** `/api/v1/admin/autopilot/actions`, `/api/v1/admin/autopilot/actions/{id}/approve`, `/api/v1/admin/autopilot/actions/{id}/reject`.
- **Proof API:** `/api/v1/proof/actions`.
- **Demo runbook:** `docs/AUTOPILOT_DEMO_RUNBOOK.md`.

### Safety note on current demo mode

- If `AUTOPILOT_ONCHAIN_PLACEHOLDER=true`, tx hashes are synthetic placeholders and no real chain submission occurs.
- Backend startup and worker logs include explicit warnings for placeholder tx generation.
- Switching to real onchain submission requires replacing placeholder handlers in autopilot execution paths.

## 🤖 Autopilot Demo Replay

UGM-AICare includes a deterministic replay harness for the Aika Autopilot flow.

Quick steps:

```bash
cd backend
alembic upgrade head
cd ..
python scripts/replay_autopilot_demo.py
```

This generates:

- Terminal artifact JSON output.
- File artifact at `docs/autopilot_demo_artifact.json`.

Reference runbook: `docs/AUTOPILOT_DEMO_RUNBOOK.md`.

Important:

- If `AUTOPILOT_ONCHAIN_PLACEHOLDER=true`, tx hashes are synthetic placeholders for demo stability.
- Backend logs include warnings whenever placeholder tx hashes are produced.
- Set `AUTOPILOT_DEMO_USER_ID` or `AUTOPILOT_DEMO_EMAIL` to an existing account before running replay.
- Replay uses API auth for approval/proof checks, so backend must be running and demo auth/token env vars must be available.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL & Redis

### Local Development

```bash
# 1. Clone Repository
git clone https://github.com/gigahidjrikaaa/UGM-AICare.git

# 2. Start Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 3. Start Frontend
cd frontend
npm install && npm run dev
```

---

## 🤝 Contributing & License

**Maintainer:** [Giga Hidjrika Aura Adkhy](https://linkedin.com/in/gigahidjrikaaa)  
**License:** MIT License. See [LICENSE](LICENSE) for details.

*Built with ❤️ for UGM Students.*
