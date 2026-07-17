---
id: deployment-topology
title: Deployment Topology
sidebar_position: 10
---

# Deployment Topology

UGM-AICare is deployed as a split-subdomain architecture with the frontend and backend running as separate services behind a reverse proxy.

---

## Infrastructure Layout

```mermaid
graph TB
    subgraph "DNS Layer"
        DNS_FE["aicare.sumbu.xyz<br/>→ Frontend Server"]
        DNS_API["api.aicare.sumbu.xyz<br/>→ Backend Server"]
    end

    subgraph "Reverse Proxy — Nginx"
        NGINX["Nginx<br/>SSL Termination<br/>Rate Limiting<br/>Static File Serving"]
    end

    subgraph "Application Servers"
        subgraph "Frontend Container"
            NEXT["Next.js 16<br/>Node.js 18+<br/>Port: 22000"]
            AUTH_FE["NextAuth.js<br/>Session Cookies"]
        end

        subgraph "Backend Container"
            FAST["FastAPI + Uvicorn<br/>Python 3.9+<br/>Port: 22001"]
            METRICS["Prometheus Metrics<br/>/metrics + /metrics/fastapi"]
            SCALAR["Scalar API Docs<br/>/docs"]
        end
    end

    subgraph "Agent Runtime"
        AIKA_RT["Aika Compiled Graph<br/>Singleton - compiled at startup"]
        CHECK["AsyncPostgresSaver<br/>LangGraph Checkpointing"]
        SCHED["APScheduler<br/>Background Jobs<br/>Check-ins, Retention, Cleanup"]
        AUTO_W["Autopilot Worker<br/>Action Queue Processor"]
    end

    subgraph "Managed Data Services"
        PG[("PostgreSQL<br/>Primary Database<br/>+ Alembic Migrations")]
        REDIS[("Redis<br/>Cache + Rate Limiting<br/>+ Session Store")]
        S3["Object Storage<br/>Avatars + Media"]
    end

    subgraph "External AI Services"
        GEM["Google Gemini 2.5<br/>Primary LLM"]
        GEM_F["Gemini Flash<br/>Fast responses"]
        GEM_P["Gemini Pro<br/>Complex reasoning"]
        LF["Langfuse<br/>LLM Tracing + Observability"]
    end

    subgraph "Blockchain Networks"
        SOMNIA["SOMNIA Chain<br/>CARE Token + Staking"]
        EDU["EDU Chain<br/>NFT Badges"]
        BNB["BNB Smart Chain<br/>NFT Badges (alt)"]
    end

    DNS_FE --> NGINX
    DNS_API --> NGINX
    NGINX --> NEXT
    NGINX --> FAST

    FAST --> AIKA_RT
    FAST --> CHECK
    FAST --> SCHED
    FAST --> AUTO_W
    FAST --> METRICS
    FAST --> SCALAR

    FAST --> PG
    FAST --> REDIS
    FAST --> S3

    AIKA_RT --> GEM
    AIKA_RT --> GEM_F
    AIKA_RT --> GEM_P
    FAST --> LF

    FAST --> SOMNIA
    FAST --> EDU
    FAST --> BNB

    NEXT --> AUTH_FE
    NEXT --> |"API calls"| FAST

    style PG fill:#336791,color:#fff
    style REDIS fill:#dc382d,color:#fff
    style GEM fill:#4285f4,color:#fff
```

---

## Network Architecture

```mermaid
graph LR
    subgraph "Public Internet"
        USERS["👤 Users<br/>Students, Counselors, Admins"]
    end

    subgraph "DMZ — Ports 443/80"
        NGINX["Nginx Reverse Proxy<br/>SSL Termination"]
    end

    subgraph "Application Network — Internal"
        FE["Frontend<br/>:22000"]
        BE["Backend<br/>:22001"]
    end

    subgraph "Data Network — Internal"
        PG[("PostgreSQL<br/>:5432")]
        RD[("Redis<br/>:6379")]
    end

    subgraph "External APIs"
        GEM["Gemini API<br/>HTTPS"]
        ETH["Blockchain RPC<br/>HTTPS"]
        LF["Langfuse<br/>HTTPS"]
    end

    USERS --> |"HTTPS"| NGINX
    NGINX --> |"Proxy Pass"| FE
    NGINX --> |"Proxy Pass"| BE
    FE --> |"HTTP"| BE
    BE --> |"TCP"| PG
    BE --> |"TCP"| RD
    BE --> |"HTTPS"| GEM
    BE --> |"HTTPS"| ETH
    BE --> |"HTTPS"| LF
```

---

## Docker Compose Configuration

```mermaid
flowchart TD
    subgraph "docker-compose.base.yml"
        FE_SVC["frontend service<br/>build: ./frontend<br/>port: 22000"]
        BE_SVC["backend service<br/>build: ./backend<br/>port: 22001<br/>depends_on: none"]
    end

    subgraph "docker-compose.dev.yml (overlay)"
        DEV_FE["volumes: ./frontend/src → /app/src<br/>hot-reload enabled"]
        DEV_BE["volumes: ./backend/app → /app/app<br/>uvicorn --reload"]
    end

    subgraph "docker-compose.preprod.yml (overlay)"
        PRE_FE["production build<br/>no hot-reload"]
        PRE_BE["production build<br/>no volume mounts"]
    end

    subgraph "docker-compose.prod.yml (overlay)"
        PROD_FE["optimized production build<br/>static export where possible"]
        PROD_BE["optimized production build<br/>gunicorn + uvicorn workers"]
    end

    base --> dev_overlay
    base --> preprod_overlay
    base --> prod_overlay
```

### Environment Configuration

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/aicare` |
| `REDIS_URL` | Redis connection string | `redis://host:6379/0` |
| `JWT_SECRET_KEY` | Token signing key | (generated secret) |
| `NEXTAUTH_SECRET` | NextAuth encryption key | (generated secret) |
| `GEMINI_API_KEY` | Primary Gemini API key | `AIza...` |
| `GEMINI_API_KEYS` | Additional keys (rotation) | `key1,key2,key3` |
| `NEXTAUTH_URL` | Frontend base URL | `https://aicare.sumbu.xyz` |
| `NEXT_PUBLIC_API_URL` | Backend base URL | `https://api.aicare.sumbu.xyz` |
| `LANGFUSE_PUBLIC_KEY` | LLM tracing key | `pk-...` |
| `AUTOPILOT_ONCHAIN_PLACEHOLDER` | Demo mode toggle | `true` / `false` |

---

## Startup Sequence

```mermaid
sequenceDiagram
    participant DOCKER as Docker Compose
    participant APP as FastAPI Lifespan
    participant DB as PostgreSQL
    participant LG as LangGraph
    participant AIKA as Aika Agent
    participant BC as Blockchain
    participant SCHED as Scheduler
    participant SSE as SSE Bridge

    DOCKER->>APP: Start application
    APP->>APP: Validate auth config (JWT_SECRET, NEXTAUTH_SECRET)
    APP->>DB: Initialize connection pool (with retries)
    DB-->>APP: Connection ready
    APP->>DB: Run Alembic migrations (if configured)
    APP->>LG: Initialize AsyncPostgresSaver
    LG-->>APP: Checkpointer ready
    APP->>AIKA: create_aika_unified_graph() → compile()
    AIKA-->>APP: Compiled singleton cached
    APP->>BC: Initialize blockchain clients (fail-soft)
    BC-->>APP: Clients ready or stubs installed
    APP->>SCHED: Start APScheduler + Autopilot worker
    SCHED-->>APP: Jobs registered
    APP->>SSE: Subscribe event bus bridges
    SSE-->>APP: SSE channels active
    APP-->>DOCKER: Application ready (health check passes)

    Note over APP,SSE: On shutdown: close DB pool,<br/>stop scheduler, clean up resources
```

---

## Health Check Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `GET /health` | Application health | `{"status": "healthy"}` |
| `GET /health/db` | Database connectivity | `{"status": "healthy", "latency_ms": N}` |
| `GET /health/redis` | Redis connectivity | `{"status": "healthy", "latency_ms": N}` |
| `GET /health/frontend` | Frontend reachability | `{"status": "healthy"}` |
| `GET /metrics` | Prometheus metrics | Standard prometheus format |
| `GET /metrics/fastapi` | FastAPI-specific metrics | Request counts, latencies, errors |
