---
sidebar_position: 3
id: data-safety
title: Data Safety & Redaction
---

# PII Redaction and Data Safety

Given the highly sensitive nature of mental health conversations, the system must guarantee that conversational data cannot be linked back to an individual student by unauthorized personnel.

## The Privacy Shield Architecture

Before any user message is logged or passed to secondary analysis components like the Insights Agent, it passes through the "Privacy Shield." This is an intermediate redaction layer designed to sanitize text.

```mermaid
graph LR
 A[User Message: "I am feeling stressed. My name is Budi and my number is 0812345678"] --> B(STA: PII Redaction Engine)
 B --> C{Rules & NLP Models}
 C -->|Regex| D[Remove Numbers & Emails]
 C -->|NER| E[Remove Names & Locations]
 D --> F
 E --> F[Sanitized Message]
 F --> G[Database]
 F --> H[Insights Agent]
 
 classDef safe fill:#d4edda,stroke:#333,stroke-width:2px;
 class F,G,H safe;
```

## Anonymization vs. Pseudonymization

- **Pseudonymization (Database Layer):** For clinical continuity, the backend maps conversations to a user ID. The actual identity is stored separately and is only accessible by authorized counselors through the Case Management Agent (CMA) during a Level 3 escalation.
- **Anonymization (Analytics Layer):** The Insights Agent operates strictly on anonymized data. Any query that aggregates data is subject to **k-anonymity** where $k \ge 5$. If an administrator requests data that would return fewer than 5 records, the system rejects the query to prevent statistical deanonymization.

These combined mechanisms ensure compliance with institutional privacy policies while enabling proactive care.
