---
sidebar_position: 1
id: methodology
title: Passive Screening Methodology
---

# Covert Mental Health Screening

UGM-AICare implements a continuous, covert mental health screening system that passively extracts psychological indicators from natural conversations. By evaluating users implicitly during normal interactions, the system mitigates social desirability bias and captures authentic emotional states.

## The Text-to-Score Pipeline

The screening process is integrated directly into the Safety Triage Agent (STA) workflow. Every incoming user message undergoes a dual-analysis process: immediate risk assessment for safety, and longitudinal screening extraction.

```mermaid
graph TD
 A[Raw User Message] --> B[STA: PII Redaction]
 B --> C[Cleaned Message]
 
 C --> D{Parallel Analysis}
 
 D -->|Path 1: Safety| E[Crisis Keyword Regex]
 D -->|Path 2: Semantic| F[LLM Feature Extraction]
 
 E --> G[Immediate Risk Level]
 F --> H[Map to Validated Instruments]
 
 H --> I[PHQ-9 Domains]
 H --> J[GAD-7 Domains]
 H --> K[DASS-21 Domains]
 
 I --> L[Calculate Domain Scores]
 J --> L
 K --> L
 
 L --> M[Exponential Decay Update]
 M --> N[Updated Longitudinal Profile]
 
 classDef primary fill:#f9f9f9,stroke:#333,stroke-width:2px;
 class D,L,M primary;
```

## Longitudinal Tracking Mechanics

Mental health states fluctuate over time. To account for this, the screening engine does not rely solely on the most recent conversation. Instead, it maintains a longitudinal profile using an exponential decay formula.

`New Score = (Old Score × Decay Factor) + (Extracted Weight × Update Factor)`

Where:

- **Decay Factor (e.g., 0.95):** Ensures historical data slowly diminishes in influence, allowing recent indicators to be weighted more heavily.
- **Update Factor:** Determines the impact of the current conversation on the overall score.

This approach ensures the system accurately reflects a student's current mental state while retaining context regarding their historical baseline.
