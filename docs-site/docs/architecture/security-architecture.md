---
id: security-architecture
title: Security Architecture
sidebar_position: 8
---

# Security Architecture

UGM-AICare handles sensitive mental health data and must meet high security and privacy standards. This document describes the security controls, authentication flows, and privacy enforcement mechanisms.

---

## Authentication Flow

The system supports multiple authentication methods, unified under a JWT-based session model.

```mermaid
sequenceDiagram
    actor STU as Student
    participant FE as Next.js Frontend
    participant NA as NextAuth.js
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant DID as DID Wallet

    alt Credentials Login
        STU->>FE: Enter email + password
        FE->>NA: signIn("credentials")
        NA->>API: POST /api/v1/auth/oauth/token
        API->>DB: Verify password hash
        DB-->>API: User verified
        API-->>NA: JWT access + refresh tokens
        NA-->>FE: Session created (cookie)
    else OAuth (Google/GitHub)
        STU->>FE: Click OAuth provider
        FE->>NA: signIn("google")
        NA->>NA: OAuth redirect + callback
        NA->>API: POST /api/v1/auth/oauth/token
        API->>DB: Upsert user from OAuth profile
        API-->>NA: JWT tokens
        NA-->>FE: Session created
    else DID Wallet Login
        STU->>FE: Connect wallet (MetaMask)
        FE->>DID: Sign challenge message
        DID-->>FE: Signed challenge
        FE->>API: POST /api/v1/auth/did-login
        API->>API: Verify signature
        API->>DB: Link DID to account
        API-->>FE: JWT tokens
        FE->>FE: Set session
    end

    Note over FE,API: All subsequent requests use<br/>Bearer token in Authorization header<br/>or httpOnly cookie

    FE->>API: GET /api/v1/profile (with JWT)
    API->>API: Verify JWT signature + expiry
    API->>API: Extract role from payload
    API->>API: Enforce RBAC for requested resource
    API-->>FE: Authorized response
```

---

## Role-Based Access Control

### RBAC Matrix

```mermaid
graph TB
    subgraph "Roles"
        STU["👤 Student"]
        CNS["👩‍⚕️ Counselor"]
        ADM["🏛️ Admin"]
    end

    subgraph "Student Resources"
        R1["Own profile"]
        R2["Own conversations"]
        R3["Own journal"]
        R4["Own appointments"]
        R5["Own tokens/badges"]
        R6["Public resources"]
    end

    subgraph "Counselor Resources"
        R7["Assigned cases"]
        R8["Assigned patient data"]
        R9["Risk assessments<br/>(assigned patients)"]
        R10["Own schedule"]
        R11["Attestation submission"]
    end

    subgraph "Admin Resources"
        R12["All users (CRUD)"]
        R13["All conversations (read)"]
        R14["System configuration"]
        R15["Analytics & insights"]
        R16["Autopilot management"]
        R17["Audit logs"]
        R18["Blockchain admin"]
        R19["Campaign management"]
    end

    STU --> R1 & R2 & R3 & R4 & R5 & R6
    CNS --> R1 & R7 & R8 & R9 & R10 & R11 & R6
    ADM --> R1 & R12 & R13 & R14 & R15 & R16 & R17 & R18 & R19 & R6
```

### Agent Tool Access by Role

| Tool | Student | Counselor | Admin |
|------|---------|-----------|-------|
| `get_user_profile` | Own only | Assigned patients | All |
| `get_journal_entries` | Own only | Assigned patients | All |
| `get_activity_streak` | Own only | Assigned patients | All |
| `create_intervention_plan` | Yes | Yes | Yes |
| `get_available_counselors` | Yes | No | No |
| `suggest_appointment_times` | Yes | No | No |
| `book_appointment` | Own | No | No |
| `cancel_appointment` | Own | Own sessions | All |
| `get_crisis_resources` | Yes | Yes | Yes |
| `get_case_details` | No | Assigned cases | All |
| `get_conversation_summary` | No | Assigned | All |
| `get_risk_assessment_history` | No | Assigned patients | All |
| `trigger_conversation_analysis` | No | Yes | Yes |
| `get_active_safety_cases` | No | Own cases | All |
| `get_escalation_protocol` | No | Yes | Yes |
| `get_conversation_stats` | No | No | Yes |
| `search_conversations` | No | No | Yes |

---

## PII Redaction Pipeline

```mermaid
flowchart LR
    subgraph "Input"
        RAW["Raw message<br/>'I'm Dewi from<br/>Psychology 2022,<br/>my NIM is 21/1234567'"]
    end

    subgraph "Redaction Engine"
        RE1["Regex: Names<br/>Indonesian + English<br/>name patterns"]
        RE2["Regex: Email<br/>[a-z]+@[a-z].[a-z]"]
        RE3["Regex: Phone<br/>+62xxx, 08xxx"]
        RE4["Regex: NIM<br/>Student ID patterns"]
        RE5["Regex: URLs<br/>Social media links"]
    end

    subgraph "Output"
        REDACTED["Redacted text<br/>'I'm [NAME] from<br/>[NAME] [YEAR],<br/>my NIM is [ID]'"]
        ORIGINAL["Original text<br/>(encrypted, DB only)"]
    end

    RAW --> RE1 & RE2 & RE3 & RE4 & RE5 --> REDACTED
    RAW --> ORIGINAL

    REDACTED --> ANALYTICS["Analytics Pipeline<br/>STA + IA processing"]
    ORIGINAL --> STORAGE["Encrypted Storage<br/>Conversation records<br/>Role-gated access only"]

    style REDACTED fill:#51cf66,color:#fff
    style ANALYTICS fill:#51cf66,color:#fff
    style STORAGE fill:#ffd93d,color:#333
```

### Redaction Rules

| Pattern | Regex Example | Replacement | Applied By |
|---------|--------------|-------------|------------|
| Names | Capitalized word sequences | `[NAME]` | STA `redact_pii_regex` |
| Email | `[\w.]+@[\w.]+` | `[EMAIL]` | STA `redact_pii_regex` |
| Phone | `(\+62|08)\d{8,13}` | `[PHONE]` | STA `redact_pii_regex` |
| NIM/Student ID | `\d{2}/\d{7}` | `[ID]` | STA `redact_pii_regex` |
| URLs | `https?://\S+` | `[URL]` | STA `redact_pii_regex` |

---

## Privacy Enforcement Architecture

```mermaid
flowchart TD
    subgraph "Query Entry"
        Q["Analytics Query<br/>from Admin/Counselor"]
    end

    subgraph "Consent Layer"
        C1["Check UserConsentLedger"]
        C2{All affected users<br/>consented?}
        C3["Log consent check<br/>in audit trail"]
    end

    subgraph "Anonymization Layer"
        A1["Replace user_id with<br/>user_hash (SHA-256)"]
        A2["PII already redacted<br/>from text fields"]
    end

    subgraph "k-Anonymity Layer"
        K1["Add GROUP BY on<br/>quasi-identifiers"]
        K2["Add HAVING COUNT ≥ 5"]
        K3{Any cell<br/>count &lt; 5?}
        K4["Suppress small cells<br/>or merge categories"]
    end

    subgraph "Differential Privacy Layer"
        D1["Calculate sensitivity<br/>of query"]
        D2["Generate Laplace noise<br/>scale = sensitivity / epsilon"]
        D3["Add noise to<br/>aggregate values"]
    end

    subgraph "Output"
        OUT["Privacy-preserving<br/>analytics result"]
    end

    Q --> C1 --> C2
    C2 --> |No| DENIED["Query Denied"]
    C2 --> |Yes| C3 --> A1 --> A2
    A2 --> K1 --> K2 --> K3
    K3 --> |Yes| K4 --> D1
    K3 --> |No| D1
    D1 --> D2 --> D3 --> OUT

    style DENIED fill:#ff6b6b,color:#fff
    style OUT fill:#51cf66,color:#fff
```

---

## Blockchain Attestation Security

```mermaid
sequenceDiagram
    participant CNS as Counselor
    participant API as Backend
    participant DB as PostgreSQL
    participant HASH as SHA-256
    participant SC as Smart Contract<br/>SOMNIA Chain
    participant EXPL as Block Explorer

    CNS->>API: Submit session attestation<br/>(case_id, notes, summary)
    API->>DB: Save raw attestation<br/>to CaseAttestation table
    API->>HASH: Hash(session_notes + timestamp + case_id)
    HASH-->>API: SHA-256 digest
    API->>API: Build transaction payload<br/>(caseId, hash, timestamp)
    API->>SC: attest(caseId, hash, timestamp)
    SC-->>API: Transaction hash + block number
    API->>DB: Update CaseAttestation<br/>(tx_hash, chain_id, block_number)
    API-->>CNS: Attestation confirmed

    Note over CNS,EXPL: Verification Path (any time)
    CNS->>API: Request proof
    API->>DB: Fetch attestation record
    API->>HASH: Re-hash session notes
    API-->>CNS: Match confirmed + explorer link
    CNS->>EXPL: View on-chain proof
```

### Attestation Properties

| Property | Implementation |
|----------|---------------|
| **Immutability** | On-chain hash cannot be altered after submission |
| **Verifiability** | Any party can re-hash the notes and compare with on-chain hash |
| **Privacy** | Only the hash is stored on-chain; clinical notes remain in encrypted PostgreSQL |
| **Non-repudiation** | Transaction includes counselor's wallet signature |
| **Auditability** | `CaseAttestation` table links case → attestation → tx_hash → chain |

---

## API Security Controls

| Control | Implementation | Scope |
|---------|---------------|-------|
| **Authentication** | JWT Bearer tokens + httpOnly cookies | All endpoints except `/health` |
| **Rate Limiting** | Redis-based per-IP and per-user limits | Chat: 20/min, Auth: 5/min, Admin: 60/min |
| **Input Validation** | Pydantic request models with strict types | All POST/PUT endpoints |
| **CORS** | Whitelisted origins only | All endpoints |
| **SQL Injection** | SQLAlchemy parameterized queries | All database operations |
| **XSS Prevention** | Input sanitization + CSP headers | All endpoints |
| **CSRF Protection** | SameSite cookies + token validation | State-changing endpoints |
| **Secrets Management** | Environment variables, never committed | All configuration |
| **Dependency Scanning** | Trivy + GitHub Dependabot | CI/CD pipeline |
| **TLS** | HTTPS enforced in production | All traffic |

---

## Threat Model

```mermaid
graph TB
    subgraph "Threats"
        T1["🔓 Data Breach"]
        T2["🤖 LLM Prompt Injection"]
        T3["👤 Unauthorized Access"]
        T4["🔍 Privacy Re-identification"]
        T5["📦 Supply Chain Attack"]
        T6["📡 DDoS Attack"]
        T7["🐛 Application Vulnerability"]
    end

    subgraph "Mitigations"
        M1["Encryption at rest<br/>+ RBAC + Audit logs"]
        M2["Input sanitization<br/>+ Guardrails + Output validation"]
        M3["JWT + RBAC + Rate limiting<br/>+ Session management"]
        M4["k-Anonymity + Differential Privacy<br/>+ PII Redaction + Consent"]
        M5["Dependabot + Trivy scanning<br/>+ Pinned versions"]
        M6["Rate limiting + Redis cache<br/>+ Nginx reverse proxy"]
        M7["Pydantic validation + Parameterized SQL<br/>+ Security headers"]
    end

    T1 -.-> M1
    T2 -.-> M2
    T3 -.-> M3
    T4 -.-> M4
    T5 -.-> M5
    T6 -.-> M6
    T7 -.-> M7

    style T1 fill:#ff6b6b,color:#fff
    style T2 fill:#ff6b6b,color:#fff
    style T3 fill:#ff6b6b,color:#fff
    style T4 fill:#ff6b6b,color:#fff
    style M1 fill:#51cf66,color:#fff
    style M2 fill:#51cf66,color:#fff
    style M3 fill:#51cf66,color:#fff
    style M4 fill:#51cf66,color:#fff
```

### Risk Assessment

| Threat | Likelihood | Impact | Risk Level | Primary Mitigation |
|--------|-----------|--------|------------|-------------------|
| Data breach (student conversations) | Low | Critical | High | Encryption + RBAC + Audit logs |
| LLM prompt injection | Medium | High | High | Input sanitization + Guardrails |
| Unauthorized access to admin panel | Low | High | Medium | JWT + RBAC + Rate limiting |
| Re-identification via analytics | Low | High | Medium | k-Anonymity + Differential Privacy |
| Supply chain vulnerability | Medium | Medium | Medium | Dependabot + Trivy |
| DDoS during peak usage | Medium | Medium | Medium | Rate limiting + Redis + Nginx |
| SQL injection via API | Low | Critical | Low | SQLAlchemy parameterized queries |
