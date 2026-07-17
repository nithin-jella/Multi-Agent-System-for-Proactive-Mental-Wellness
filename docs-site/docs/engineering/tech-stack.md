---
sidebar_position: 3
---

# Technology Stack

## Overview

UGM-AICare is built across five distinct layers, each with a deliberate set of technology choices. The guiding principle was **pragmatic simplicity**: pick a technology that is production-proven, well-documented, and suited to a small team.

---

## Layer-by-Layer Breakdown

### 1. Frontend

| Technology | Version | Role |
| --- | --- | --- |
| **Next.js** | 16.x | React framework - handles routing, SSR, and API proxy |
| **TypeScript** | 5.x | Type safety across all components |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **NextAuth.js** | 4.x | Authentication with JWT sessions |
| **React Hook Form + Zod** | - | Form handling with schema validation |

The frontend communicates with the backend over HTTPS REST and uses **Server-Sent Events (SSE)** to stream Aika's responses token-by-token, giving users the "typing" experience.

---

### 2. Backend

| Technology | Version | Role |
| --- | --- | --- |
| **FastAPI** | 0.115.x | Async Python web framework |
| **SQLAlchemy** | 2.x | Async ORM for database access |
| **Alembic** | 1.x | Database schema migrations |
| **Pydantic** | 2.x | Request/response schema validation |
| **Celery / asyncio tasks** | - | Background task execution (e.g., post-conversation STA) |

FastAPI was chosen specifically for its native **async/await** support, which is critical given that every chat message triggers multiple concurrent LLM API calls. A synchronous framework like Flask would block the event loop and degrade performance significantly at modest concurrency.

---

### 3. AI Agent Layer

| Technology | Role |
| --- | --- |
| **LangGraph** | Agent workflow graph - defines nodes, edges, and conditional routing |
| **Google Gemini 2.5 Flash/Pro** | Core LLM for all agents |
| **Google GenAI SDK** | Python client for Gemini API (function calling, streaming) |
| **Langfuse** | Observability - traces every LLM call, tool invocation, and agent node |

#### Why LangGraph?

LangGraph was chosen over a simpler "chain" approach because it supports:
- **Cyclic graphs** - agents can loop (e.g., tool call → result → another tool call) without manual recursion
- **Parallel fan-out** - TCA and CMA can run concurrently using `asyncio.gather`
- **State persistence** - the shared `SafetyAgentState` dict flows cleanly through every node
- **Checkpointing** - the graph saves conversational state durably via `AsyncPostgresSaver`, allowing the graph to pause or recover without data loss

#### Why Gemini?
Gemini 2.5 Flash was selected for the real-time conversational path due to its low latency and strong Indonesian language support (important for culturally appropriate responses). Gemini 2.5 Pro is used for the post-conversation STA deep analysis where quality matters more than speed.

---

### 4. Data Layer

| Technology | Role |
| --- | --- |
| **PostgreSQL (Supabase)** | Primary relational database AND LangGraph persistent Checkpointer (`AsyncPostgresSaver`) |
| **Redis** | Runtime cache, rate limiting, and ephemeral session tracking |
| **S3-compatible storage** | PDF report storage (STA clinical reports, IA exports) |

PostgreSQL is the system's absolute source of truth. Rather than storing conversational state in Redis, UGM-AICare leverages LangGraph's native `AsyncPostgresSaver` to durably persist the orchestrator's state (including conversation history) directly to the database. Redis is reserved strictly for high-speed ephemeral tasks (for example, rate limiting and short-lived runtime/session keys).
---

### 5. Infrastructure & Deployment

| Technology | Role |
| --- | --- |
| **Docker + Docker Compose** | Containerisation for all services |
| **Railway / VPS** | Cloud hosting - backend and frontend run as separate containers |
| **Nginx** | Reverse proxy, TLS termination |
| **GitHub Actions** | CI/CD - lint, test, build, and deploy on push to `main` |
| **Grafana** | Infrastructure monitoring dashboards |

---

### 6. Blockchain (CARE Token)

| Technology | Role |
| --- | --- |
| **Solidity** | Smart contract language |
| **Hardhat** | Ethereum development environment |
| **Ethers.js** | Frontend contract interaction |
| **OpenZeppelin** | Audited contract base classes (ERC-20) |

The CARE token is an ERC-20 token used for counsellor attestation. When a counsellor closes a case with a verified session note, a transaction is recorded on-chain, creating a tamper-evident audit trail without storing any patient data on-chain.

---

## Architecture Decision Log

### Why not a single LLM prompt instead of agents?

A single prompt attempting to do triage, coaching, case management, and analytics simultaneously would:
1. Exceed context window limits on longer conversations
2. Produce unpredictable behaviour - the model might prioritise one role at the expense of another
3. Be untestable - you cannot unit-test a monolith prompt

Separate agents mean each component can be tested, upgraded, and benchmarked independently.

### Why FastAPI over Django?

Django's ORM is synchronous by default. Every database query would block the Python event loop, which is incompatible with streaming LLM responses. FastAPI with async SQLAlchemy allows database queries and LLM calls to run concurrently in the same event loop.

### Why PostgreSQL over a vector database?

At the current scale (a single university), a relational database with `pgvector` extension for embeddings is sufficient. Introducing a dedicated vector database (e.g., Pinecone, Weaviate) would add operational complexity without a demonstrated need.
