---
id: api-data-contracts
title: API Data Contracts
sidebar_position: 5
---

# API Data Contracts

This document describes the key API interactions, request/response shapes, and streaming contracts for the UGM-AICare backend.

---

## API Route Structure

```mermaid
graph TB
    subgraph "Authentication"
        AUTH["POST /api/v1/auth/oauth/token<br/>POST /api/v1/auth/did-login<br/>POST /api/v1/auth/register<br/>POST /api/v1/auth/forgot-password"]
    end

    subgraph "Mental Health — /api/v1/mental-health/"
        CHAT_EP["POST /chat<br/>Send message, receive response"]
        Aika_EP["POST /aika<br/>Invoke Aika graph"]
        STREAM["GET /aika/stream<br/>SSE chat streaming"]
        AGENTS["POST /agents/graph<br/>Execute agent subgraph"]
        STA_EP["POST /safety-triage/trigger<br/>Manual STA analysis"]
        JOURNAL["GET/POST /journal<br/>Journal entries"]
        APPOINT["GET/POST /appointments<br/>Appointment CRUD"]
        SURVEY["GET/POST /surveys<br/>Survey instruments"]
        QUEST["GET/POST /quests<br/>Quest management"]
        FEEDBACK["POST /feedback<br/>Rate interactions"]
    end

    subgraph "Profile — /api/v1/"
        PROFILE["GET /profile/overview<br/>Full user context"]
        PREFS["PUT /profile/preferences<br/>Update preferences"]
        CONSENT_EP["POST /profile/consent<br/>Manage consent"]
    end

    subgraph "Admin — /api/v1/admin/"
        ADM_DASH["GET /dashboard<br/>System metrics"]
        ADM_USERS["GET/PUT /users<br/>User management"]
        ADM_CASES["GET /cases<br/>Case oversight"]
        ADM_AUTO["GET/POST /autopilot<br/>Autopilot actions"]
        ADM_INSIGHTS["GET /insights<br/>IA analytics"]
        ADM_ANALYTICS["GET /analytics<br/>Population data"]
        ADM_SCREENING["GET /screening<br/>Screening overview"]
        ADM_DECISIONS["GET /agent-decisions<br/>Decision audit"]
    end

    subgraph "Blockchain — /api/v1/"
        PROOF["GET /proof/actions<br/>Attestation timeline"]
        TOKEN["GET/POST /care-token<br/>Token operations"]
    end
```

---

## Chat Streaming Contract (SSE)

The primary interaction pattern for student chat uses Server-Sent Events.

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant AIKA as Aika Graph
    participant DB as PostgreSQL

    FE->>API: POST /api/v1/mental-health/aika/stream
    Note right of FE: Headers:<br/>Authorization: Bearer {jwt}<br/>Content-Type: application/json

    API->>API: Validate JWT + role
    API->>DB: Fetch user context
    API->>AIKA: Invoke graph

    loop Token-by-token streaming
        AIKA-->>API: Partial token
        API-->>FE: SSE: data: {"type": "token", "content": "..."}
    end

    AIKA-->>API: Final response
    API-->>FE: SSE: data: {"type": "done", "message_id": 123}

    API->>DB: Persist message + response (async)
    API-.->>FE: SSE: data: {"type": "activity", "event": "screening_update"}

    Note over FE,API: Connection stays open until<br/>type=done or type=error
```

### SSE Event Types

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `token` | `{ "type": "token", "content": "word" }` | Individual response tokens |
| `done` | `{ "type": "done", "message_id": int }` | Response complete |
| `error` | `{ "type": "error", "message": "..." }` | Error during generation |
| `activity` | `{ "type": "activity", "event": "..." }` | Background event notification |
| `tool_call` | `{ "type": "tool_call", "tool": "..." }` | Agent executing a tool |

---

## Standard Error Response

All API errors follow a consistent shape:

```json
{
  "detail": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 60 seconds.",
    "status": 429
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing JWT |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `LLM_ERROR` | 502 | LLM provider returned an error |
| `LLM_RATE_LIMIT` | 503 | LLM provider rate limit hit |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limits

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Chat (`/aika`, `/chat`) | 20 requests | Per minute per user |
| Auth (`/auth/*`) | 5 requests | Per minute per IP |
| Admin (`/admin/*`) | 60 requests | Per minute per user |
| STA manual trigger | 3 requests | Per minute per user |
| General API | 100 requests | Per minute per user |

---

## Authentication Headers

All authenticated requests require one of:

```
Authorization: Bearer <jwt_access_token>
Cookie: access_token=<jwt_access_token>; HttpOnly; Secure; SameSite=Lax
```

### JWT Payload

```json
{
  "sub": "user_id",
  "email": "student@ugm.ac.id",
  "role": "student",
  "exp": 1740000000,
  "iat": 1739996400,
  "type": "access"
}
```
