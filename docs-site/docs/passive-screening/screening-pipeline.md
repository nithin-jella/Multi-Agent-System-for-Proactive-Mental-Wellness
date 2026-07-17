---
id: screening-pipeline
title: Covert Screening Pipeline
sidebar_position: 4
---

# Covert Screening Pipeline

This document details the end-to-end covert screening pipeline — from raw conversation messages through indicator extraction, score normalization, longitudinal profile updates, and dashboard visualization.

---

## Pipeline Overview

```mermaid
flowchart TD
    START([Student sends message]) --> MSG["Message stored in<br/>Conversation + Message tables"]
    MSG --> AIKA["Aika processes message<br/>Screening awareness module<br/>identifies potential indicators"]

    AIKA --> RESPONSE["Aika responds to student<br/>No screening delay"]
    AIKA -.-> |"async, non-blocking"| STA["STA Background Task<br/>triggered after conversation"]

    STA --> LOAD["Load full conversation<br/>transcript from DB"]
    LOAD --> REDACT["Apply PII Redaction<br/>Regex-based removal"]
    REDACT --> CLASSIFY["Gemini Deep Analysis<br/>Structured JSON output"]

    CLASSIFY --> RISK["Risk Assessment<br/>risk_level + risk_score + severity"]
    CLASSIFY --> EXTRACT["Indicator Extraction<br/>Map to instrument domains"]

    EXTRACT --> NORM["Score Normalization<br/>Raw indicators → 0-1 scale"]
    NORM --> BAND["Severity Banding<br/>None / Mild / Moderate /<br/>Severe / Critical"]
    BAND --> DECAY["Exponential Decay Update<br/>old_score × 0.95 + new × factor"]
    DECAY --> PROFILE["Update ScreeningProfile<br/>in PostgreSQL"]
    PROFILE --> DASHBOARD["Visible on Counselor<br/>Dashboard as trend chart"]

    RISK --> ASSESSMENT["Create<br/>ConversationRiskAssessment"]
    ASSESSMENT --> TRIGGER{Risk threshold<br/>exceeded?}
    TRIGGER --> |Yes| CASE["Trigger CMA<br/>case creation"]
    TRIGGER --> |No| MONITOR["Continue routine<br/>monitoring"]

    style STA fill:#868e96,color:#fff
    style DECAY fill:#a855f7,color:#fff
    style TRIGGER fill:#ff6b6b,color:#fff
```

---

## Indicator Extraction

The STA extracts psychological indicators from redacted conversation text and maps them to validated instrument domains.

```mermaid
flowchart LR
    subgraph "Input: Redacted Message"
        MSG["'I've been sleeping<br/>terribly, can't focus<br/>on anything, feel<br/>like a failure'"]
    end

    subgraph "Gemini Extraction"
        LLM["Structured JSON:<br/>{<br/>  phq9: [concentration, worthlessness],<br/>  gad7: [],<br/>  dass21_stress: [overwhelm],<br/>  psqi: [sleep_quality, daytime_dysfunction],<br/>  rses: [self_worth]<br/>}"]
    end

    subgraph "Score Computation"
        SCORE["Per-instrument score:<br/>count(matched_items) / total_items<br/>→ normalized to 0-1"]
    end

    subgraph "Severity Banding"
        BAND["PHQ-9: 0.45 → Moderate<br/>PSQI: 0.62 → Severe<br/>RSES: 0.38 → Mild"]
    end

    MSG --> LLM --> SCORE --> BAND
```

---

## Score Normalization & Severity Bands

Each instrument uses specific thresholds normalized to a 0-1 scale:

```mermaid
flowchart LR
    subgraph "PHQ-9 (Depression)"
        P0["0.00 - 0.19<br/>None"]
        P1["0.19 - 0.37<br/>Mild"]
        P2["0.37 - 0.56<br/>Moderate"]
        P3["0.56 - 0.74<br/>Severe"]
        P4["0.74 - 1.00<br/>Critical"]
        P0 --> P1 --> P2 --> P3 --> P4
    end

    subgraph "GAD-7 (Anxiety)"
        G0["0.00 - 0.24<br/>None"]
        G1["0.24 - 0.48<br/>Mild"]
        G2["0.48 - 0.71<br/>Moderate"]
        G3["0.71 - 0.90<br/>Severe"]
        G4["0.90 - 1.00<br/>Critical"]
        G0 --> G1 --> G2 --> G3 --> G4
    end
```

| Instrument | None | Mild | Moderate | Severe | Critical |
|------------|------|------|----------|--------|----------|
| PHQ-9 | 0 - 0.19 | 0.19 - 0.37 | 0.37 - 0.56 | 0.56 - 0.74 | 0.74 - 1.0 |
| GAD-7 | 0 - 0.24 | 0.24 - 0.48 | 0.48 - 0.71 | 0.71 - 0.90 | 0.90 - 1.0 |
| DASS-21 Stress | 0 - 0.19 | 0.19 - 0.29 | 0.29 - 0.38 | 0.38 - 0.60 | 0.60 - 1.0 |
| PSQI | 0 - 0.20 | 0.20 - 0.40 | 0.40 - 0.60 | 0.60 - 0.80 | 0.80 - 1.0 |
| UCLA Loneliness | 0 - 0.20 | 0.20 - 0.40 | 0.40 - 0.60 | 0.60 - 0.80 | 0.80 - 1.0 |
| RSES | 0 - 0.20 | 0.20 - 0.40 | 0.40 - 0.60 | 0.60 - 0.80 | 0.80 - 1.0 |
| C-SSRS | 0 - 0.00 | N/A | N/A | 0.01 - 0.50 | 0.50 - 1.0 |

---

## Longitudinal Decay Model

The screening profile is updated with exponential decay to weight recent indicators more heavily:

```mermaid
flowchart LR
    subgraph "Decay Formula"
        EQ["new_score =<br/>old_score × decay_factor +<br/>extracted_weight × update_factor<br/><br/>decay_factor = 0.95 (default)<br/>update_factor = 0.50"]
    end

    subgraph "Example"
        OLD["Old PHQ-9: 0.35<br/>(Mild)"]
        NEW["Extracted: 0.55<br/>(Moderate)"]
        RESULT["New PHQ-9:<br/>0.35 × 0.95 + 0.55 × 0.50<br/>= 0.3325 + 0.275<br/>= 0.6075<br/>(Moderate → Severe)"]
        OLD --> RESULT
        NEW --> RESULT
    end
```

### Decay Properties

| Property | Value | Rationale |
|----------|-------|-----------|
| `decay_factor` | 0.95 | 5% decay per conversation — gradual forgetting |
| `update_factor` | 0.50 | New evidence has significant but not overwhelming weight |
| Minimum update interval | Per conversation | Prevents rapid oscillation |
| Score bounds | [0.0, 1.0] | Clamped to valid range |

---

## Screening Dashboard Visualization

```mermaid
flowchart TD
    subgraph "Data Source"
        SP["ScreeningProfile table<br/>One row per student<br/>9 instrument scores"]
    end

    subgraph "Counselor Dashboard"
        CHART1["📈 Trend Lines<br/>Score over time per instrument<br/>PHQ-9, GAD-7, DASS-21, etc."]
        CHART2["🌡️ Risk Heatmap<br/>Current scores by instrument<br/>Color-coded severity bands"]
        CHART3["📊 Radar Chart<br/>Multi-dimensional profile<br/>All instruments on one chart"]
        CHART4["⚠️ Alerts<br/>Threshold breach notifications<br/>Worsening trend alerts"]
    end

    SP --> CHART1 & CHART2 & CHART3 & CHART4

    subgraph "Admin Dashboard"
        POP1["Population Distribution<br/>Aggregated score distributions<br/>by faculty, semester"]
        POP2["Trend Analysis<br/>Average scores over time<br/>with k-anonymity"]
    end

    SP --> POP1 & POP2
```

---

## Validated Instruments Reference

| Instrument | Full Name | Domains | Items | Reference |
|------------|-----------|---------|-------|-----------|
| PHQ-9 | Patient Health Questionnaire-9 | Depression | 9 | Kroenke et al. (2001) |
| GAD-7 | Generalized Anxiety Disorder-7 | Anxiety | 7 | Spitzer et al. (2006) |
| DASS-21 | Depression Anxiety Stress Scales | Depression, Anxiety, Stress | 21 | Lovibond & Lovibond (1995) |
| PSQI | Pittsburgh Sleep Quality Index | Sleep Quality | 19 (7 components) | Buysse et al. (1989) |
| UCLA-3 | UCLA Loneliness Scale v3 | Social Isolation | 20 | Russell (1996) |
| RSES | Rosenberg Self-Esteem Scale | Self-Esteem | 10 | Rosenberg (1965) |
| C-SSRS | Columbia Suicide Severity Rating | Suicidality | 6 | Posner et al. (2011) |
| AUDIT | Alcohol Use Disorders ID | Substance Use | 10 | Saunders et al. (1993) |
| SSI | Student Stress Inventory | Academic Stress | Adapted | Lakaev (2009) |
