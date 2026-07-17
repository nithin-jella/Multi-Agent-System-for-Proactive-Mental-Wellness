---
id: ci-cd-pipeline
title: CI/CD Pipeline
sidebar_position: 3
---

# CI/CD Pipeline

This document describes the continuous integration and deployment pipeline for UGM-AICare.

---

## Pipeline Overview

```mermaid
flowchart LR
    PUSH["Git Push"] --> VALIDATE["Environment<br/>Validation"]
    VALIDATE --> DETECT["Change Detection<br/>Backend / Frontend / Docs"]
    DETECT --> BUILD["Build & Test"]
    BUILD --> SECURITY["Security Scanning"]
    SECURITY --> DEPLOY["Deploy"]
    DEPLOY --> VERIFY["Health Check"]
    VERIFY --> DONE["✅ Live"]

    BUILD --> |Fail| NOTIFY_FAIL["Notify:<br/>Build Failed"]
    SECURITY --> |Fail| NOTIFY_SEC["Notify:<br/>Security Issue"]
    DEPLOY --> |Fail| ROLLBACK["Rollback to<br/>previous version"]
    ROLLBACK --> NOTIFY_ROLLBACK["Notify:<br/>Deploy Rolled Back"]

    style DONE fill:#51cf66,color:#fff
    style ROLLBACK fill:#ff6b6b,color:#fff
    style NOTIFY_FAIL fill:#ff6b6b,color:#fff
    style NOTIFY_SEC fill:#ff6b6b,color:#fff
```

---

## Detailed Pipeline Stages

```mermaid
flowchart TD
    START([Push to branch]) --> STAGE1["Stage 1: Environment Validation"]
    STAGE1 --> CHECK_ENV{Env vars<br/>present?}
    CHECK_ENV --> |No| FAIL_ENV["❌ Fail: Missing env vars"]
    CHECK_ENV --> |Yes| STAGE2["Stage 2: Change Detection"]

    STAGE2 --> DIFF["Detect changed paths<br/>backend/** → backend pipeline<br/>frontend/** → frontend pipeline<br/>docs-site/** → docs pipeline"]

    DIFF --> STAGE3["Stage 3: Build"]

    subgraph "Backend Build"
        BE_DEPS["pip install dependencies"]
        BE_LINT["ruff / flake8 linting"]
        BE_TEST["pytest test suite"]
        BE_TYPE["mypy type checking"]
    end

    subgraph "Frontend Build"
        FE_DEPS["npm install"]
        FE_LINT["eslint + prettier"]
        FE_BUILD["next build"]
        FE_TYPE["tsc --noEmit"]
    end

    STAGE3 --> STAGE4["Stage 4: Security Scanning"]

    subgraph "Security"
        TRIVY["Trivy dependency scan"]
        SECRETS["Secret detection<br/>(no API keys in code)"]
        DEP["Dependency audit"]
    end

    STAGE4 --> STAGE5["Stage 5: Deploy"]

    subgraph "Deployment"
        DOCKER_BUILD["Docker build<br/>backend + frontend images"]
        PUSH_IMAGES["Push to registry"]
        DEPLOY_SCRIPT["Execute deploy-prod.sh<br/>or docker compose up"]
    end

    STAGE5 --> STAGE6["Stage 6: Verification"]
    STAGE6 --> HEALTH["GET /health<br/>GET /health/db<br/>GET /health/redis"]
    HEALTH --> |Pass| LIVE([✅ Deployment Live])
    HEALTH --> |Fail| ROLLBACK["Rollback:<br/>Previous image version"]
    ROLLBACK --> ALERT["Alert team"]

    style LIVE fill:#51cf66,color:#fff
    style ROLLBACK fill:#ff6b6b,color:#fff
    style FAIL_ENV fill:#ff6b6b,color:#fff
```

---

## Promotion Flow

```mermaid
flowchart LR
    subgraph "Development"
        DEV["dev branch<br/>docker-compose.dev.yml<br/>Hot-reload enabled<br/>Local DB + Redis"]
    end

    subgraph "Pre-production"
        PRE["preprod branch<br/>docker-compose.preprod.yml<br/>Production builds<br/>No hot-reload<br/>Staging data"]
    end

    subgraph "Production"
        PROD["main branch<br/>docker-compose.prod.yml<br/>Optimized builds<br/>Managed services<br/>Nginx reverse proxy"]
    end

    DEV --> |"PR + review"| PRE
    PRE --> |"Manual approval<br/>+ health check"| PROD

    style DEV fill:#4dabf7,color:#fff
    style PRE fill:#ffd93d,color:#333
    style PROD fill:#51cf66,color:#fff
```

---

## Deployment Strategy

| Environment | Branch | Command | Database |
|-------------|--------|---------|----------|
| Local Dev | `feature/*` | `docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up` | Local PostgreSQL |
| Pre-production | `preprod` | `docker compose -f docker-compose.base.yml -f docker-compose.preprod.yml up` | Staging DB |
| Production | `main` | `./deploy-prod.sh` or `docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d` | Managed PostgreSQL |

### Rollback Procedure

1. Identify the failing deployment from health checks
2. Pull the previous known-good image version
3. Redeploy with `docker compose up -d` using previous image tag
4. Verify health checks pass
5. Investigate the failed deployment in logs

---

## Failure Scenarios

| Scenario | Detection | Response |
|----------|-----------|----------|
| Build fails | Non-zero exit from build step | Block deployment, notify via GitHub |
| Test failure | pytest / jest non-zero exit | Block deployment, report failures |
| Security vulnerability | Trivy CRITICAL finding | Block deployment, create issue |
| Health check failure | `/health` returns non-200 | Auto-rollback to previous image |
| Database migration fails | Alembic exit code | Block deployment, manual intervention |
| Docker build fails | Build step non-zero exit | Block deployment, notify |
