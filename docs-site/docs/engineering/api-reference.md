---
sidebar_position: 1
---

# Backend - API Overview

## Structure

The backend is a **FastAPI** application organised around the Domain-Driven Design (DDD) principle: each business domain lives in its own directory with its own routes, schemas, services, and models.

```
backend/app/
├── agents/ # All AI agent graphs and logic
│ ├── aika/ # Aika identity, tools, activity logger
│ ├── sta/ # Safety Triage Agent graph
│ ├── tca/ # Therapeutic Coach Agent graph
│ ├── cma/ # Case Management Agent graph
│ ├── ia/ # Insights Agent graph
│ └── shared/ # Tool registry, shared utilities
├── domains/
│ ├── mental_health/ # Appointments, cases, conversations
│ ├── finance/ # CARE token, blockchain
│ └── blockchain/ # Contract interaction layer
├── auth_utils.py # JWT verification, role extraction
├── dependencies.py # FastAPI dependency injection
├── main.py # Application entrypoint, router registration
└── middleware/ # Rate limiting, CORS, logging
```

---

## Authentication

All API endpoints (except `/health` and the auth endpoints) require a **JWT bearer token**. Tokens are issued by the `/auth/login` endpoint and verified on every request via the `verify_token` dependency.

Roles are encoded in the JWT payload:

```json
{
 "sub": "1203",
 "role": "user",
 "email": "student@mail.ugm.ac.id",
 "exp": 1740700000
}
```

The `role` field determines which API endpoints are accessible and which Aika tools are available.

---

## Core Endpoints

### Chat

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/aika` | Send a message and receive SSE stream response |
| `GET` | `/api/v1/history` | Fetch authenticated user's conversation history |

### Appointments

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/appointments` | List user's appointments |
| `POST` | `/api/v1/appointments` | Create new appointment |
| `PATCH` | `/api/v1/appointments/{id}` | Reschedule or cancel |

### Cases (Counsellor/Admin only)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/cases` | List all active cases |
| `GET` | `/api/v1/cases/{id}` | Get case details |
| `PATCH` | `/api/v1/cases/{id}/status` | Update case status |
| `POST` | `/api/v1/cases/{id}/attest` | Submit blockchain attestation |

### Analytics (Admin/Counsellor only)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/analytics/risk-trends` | Population risk trend data |
| `GET` | `/api/v1/analytics/screening` | Aggregate screening indicators |
| `GET` | `/api/v1/analytics/intervention-funnel` | Stage funnel metrics |

### STA (Manual triggers - Counsellor/Admin only)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/admin/conversation-assessments/{conversation_id}/trigger` | Manually trigger STA analysis |
| `GET` | `/api/v1/admin/conversation-assessments/{conversation_id}` | Fetch STA report for a conversation |

---

## Rate Limiting

API endpoints are rate-limited via Redis to prevent abuse:

| Endpoint Group | Limit |
| --- | --- |
| Aika (`/api/v1/aika`) | 30 requests / minute per user |
| Analytics | 60 requests / minute per user |
| Auth | 10 requests / minute per IP |
| All others | 120 requests / minute per user |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included in every response.

---

## Error Handling

All errors follow a consistent JSON structure:

```json
{
 "detail": {
 "code": "RATE_LIMIT_EXCEEDED",
 "message": "You have exceeded the request limit. Try again in 45 seconds.",
 "retry_after": 45
 }
}
```

HTTP status codes follow standard conventions: `400` for validation errors, `401` for missing/invalid tokens, `403` for role-permission failures, `429` for rate limits, and `500` for unexpected server errors (with no stack trace exposed to the client).
