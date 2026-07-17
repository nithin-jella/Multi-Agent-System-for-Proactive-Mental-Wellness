---
id: database-best-practices
title: Database Schema & Best Practices
sidebar_position: 2
---

# Backend Database Schema
sidebar_position: 2
---

# Backend - Database Schema

## Overview

UGM-AICare utilizes PostgreSQL, hosted on Supabase, as its primary database. The schema centers on essential mental health support system entities, including users, conversations, risk assessments, cases, appointments, and blockchain records.

All schema migrations are managed via **Alembic**. Never modify the database schema directly; always generate a migration file.

---

## Core Tables

```mermaid
erDiagram
 USERS {
 int id PK
 string email
 string hashed_password
 string role
 string full_name
 string nim
 string faculty
 timestamp created_at
 }

 CONVERSATIONS {
 int id PK
 int user_id FK
 string session_id
 timestamp started_at
 timestamp ended_at
 bool is_active
 }

 MESSAGES {
 int id PK
 int conversation_id FK
 string role
 text content
 timestamp created_at
 }

 CONVERSATIONRISKASSESSMENT {
 int id PK
 int conversation_id FK
 string user_hash
 int risk_level
 float risk_score
 string severity
 string intent
 jsonb phq9_indicators
 jsonb gad7_indicators
 string trend
 text summary
 text counsellor_recommendation
 timestamp analysed_at
 }

 SCREENINGPROFILE {
 int id PK
 int user_id FK
 string user_hash
 jsonb phq9_history
 jsonb gad7_history
 jsonb dass21_history
 timestamp last_updated
 }

 CASES {
 int id PK
 int user_id FK
 int counsellor_id FK
 string status
 int risk_level_at_creation
 timestamp created_at
 timestamp resolved_at
 }

 APPOINTMENTS {
 int id PK
 int case_id FK
 int user_id FK
 int counsellor_id FK
 timestamp scheduled_at
 string status
 string location_type
 }

 CASEATTESTATION {
 int id PK
 int case_id FK
 int counsellor_id FK
 string content_hash
 string tx_hash
 timestamp attested_at
 }

 USERINTERVENTIONPLAN {
 int id PK
 int user_id FK
 string category
 jsonb coping_strategies
 text psychoeducation
 text homework
 timestamp created_at
 bool completed
 }

 USERS ||--o{ CONVERSATIONS: "has"
 CONVERSATIONS ||--o{ MESSAGES: "contains"
 CONVERSATIONS ||--o{ CONVERSATIONRISKASSESSMENT: "assessed by"
 USERS ||--|| SCREENINGPROFILE: "has one"
 USERS ||--o{ CASES: "has"
 CASES ||--o{ APPOINTMENTS: "schedules"
 CASES ||--o{ CASEATTESTATION: "attested by"
 USERS ||--o{ USERINTERVENTIONPLAN: "has"
```

---

## Privacy Design in the Schema

The schema employs a pseudonymization pattern. The `CONVERSATIONRISKASSESSMENT` and `SCREENINGPROFILE` tables store a `user_hash` instead of a `user_id` in columns used for analytics. This `user_hash` is a one-way HMAC-SHA256 hash of the `user_id` using a server-side secret. Analytics queries within the IA layer operate exclusively on the `user_hash` and do not join against the `USERS` table. The clinical layer, including the CMA and counselor dashboard, performs the reverse lookup from `user_hash` to `user_id` only for authorized roles. This design ensures that analytics tables remain disconnected from identifiable user records if accessed without authorization.

- The `CONVERSATIONRISKASSESSMENT` and `SCREENINGPROFILE` tables store `user_hash` instead of `user_id` in the columns used for analytics.
- `user_hash` is a one-way HMAC-SHA256 hash of the `user_id` with a server-side secret.
- Analytics queries (IA layer) operate only on `user_hash` - they never join against the `USERS` table.
- Only the clinical layer (CMA, counsellor dashboard) performs the reverse lookup from `user_hash` to `user_id`, and only for users with the appropriate role.

This means even if the analytics tables are somehow accessed without authorisation, they cannot be directly linked to identifiable user records.

---

## Caching Strategy (Redis)

| Cache Key Pattern | Content | TTL |
| --- | --- | --- |
| `conv:{session_id}:history` | Last 10 turns of conversation | 24 hours |
| `user:{user_id}:profile` | User profile object | 10 minutes |
| `counsellors:available` | Available counsellors list | 5 minutes |
| `ratelimit:{user_id}:{endpoint}` | Request counter | 60 seconds |

Conversation history is the most critical cache - it avoids a database query on every message. The TTL of 24 hours covers a typical day of use; sessions inactive for longer are re-hydrated from PostgreSQL on the next message.
