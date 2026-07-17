---
id: evaluation-framework
title: Research Evaluation Framework
sidebar_position: 5
---

# Research Evaluation Framework

This document maps the three research questions to system components, evaluation methods, and measurable metrics.

---

## Research Questions to System Mapping

```mermaid
graph TB
    subgraph "Research Questions"
        RQ1["RQ1: Proactive Safety<br/>Can an agentic system detect<br/>crisis signals with high<br/>sensitivity (&gt;90%) and<br/>low false negatives?"]
        RQ2["RQ2: Functional Correctness<br/>Can a LangGraph orchestrator<br/>reliably route intents<br/>without hallucinations?"]
        RQ3["RQ3: Output Quality & Privacy<br/>Can the system generate<br/>clinically valid CBT responses<br/>while maintaining k-anonymity?"]
    end

    subgraph "System Components Evaluated"
        STA["STA — Safety Triage Agent"]
        AIKA["Aika — Orchestrator"]
        TCA["TCA — Therapeutic Coach"]
        IA["IA — Insights Agent"]
    end

    subgraph "Evaluation Methods"
        E1["Unit Testing<br/>Classifiers, routing logic"]
        E2["Integration Testing<br/>End-to-end flows"]
        E3["Research Evaluation<br/>Ground truth datasets"]
        E4["Load Testing<br/>Performance benchmarks"]
    end

    RQ1 --> STA
    RQ1 --> E3
    RQ2 --> AIKA
    RQ2 --> E1 & E2
    RQ3 --> TCA & IA
    RQ3 --> E3 & E2

    style RQ1 fill:#ff6b6b,color:#fff
    style RQ2 fill:#ffd93d,color:#333
    style RQ3 fill:#51cf66,color:#fff
```

---

## Evaluation Pipeline

```mermaid
flowchart TD
    subgraph "Data Preparation"
        GT["Ground Truth Dataset<br/>Anonymized conversations<br/>with labeled risk + intent"]
        SPLIT["Train/Test Split<br/>Stratified by risk level"]
    end

    subgraph "RQ1: Crisis Detection Evaluation"
        STA_EVAL["Run STA on test set"]
        METRICS_RQ1["Compute:<br/>Sensitivity (recall)<br/>Specificity<br/>Precision<br/>F1 Score<br/>False Negative Rate"]
        TARGET_RQ1["Target:<br/>Sensitivity ≥ 90%<br/>False Negatives → 0"]
    end

    subgraph "RQ2: Routing Correctness"
        ROUTE_EVAL["Run Aika on test set<br/>Compare routing to ground truth"]
        METRICS_RQ2["Compute:<br/>Routing Accuracy<br/>Intent Classification F1<br/>Hallucination Rate"]
        TARGET_RQ2["Target:<br/>Accuracy ≥ 95%<br/>Zero safety-critical hallucinations"]
    end

    subgraph "RQ3: Quality & Privacy"
        TCA_EVAL["Generate plans for test cases<br/>Expert panel review"]
        IA_EVAL["Run analytics queries<br/>Verify k-anonymity"]
        METRICS_RQ3["Compute:<br/>Clinical Validity Score<br/>CBT Adherence Rating<br/>k-Anonymity Compliance<br/>Differential Privacy Budget"]
        TARGET_RQ3["Target:<br/>Clinical validity ≥ 4.0/5.0<br/>100% k-anonymity compliance"]
    end

    GT --> SPLIT
    SPLIT --> STA_EVAL --> METRICS_RQ1 --> TARGET_RQ1
    SPLIT --> ROUTE_EVAL --> METRICS_RQ2 --> TARGET_RQ2
    SPLIT --> TCA_EVAL --> METRICS_RQ3
    SPLIT --> IA_EVAL --> METRICS_RQ3 --> TARGET_RQ3
```

---

## Metrics Dashboard

### RQ1 — Crisis Detection Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Sensitivity (Recall) | TP / (TP + FN) | ≥ 0.90 |
| Specificity | TN / (TN + FP) | ≥ 0.85 |
| Precision | TP / (TP + FP) | ≥ 0.80 |
| F1 Score | 2 × (P × R) / (P + R) | ≥ 0.85 |
| False Negative Rate | FN / (TP + FN) | ≤ 0.10 |
| Latency (Tier 1) | Keyword scan time | < 5ms |
| Latency (Tier 2) | LLM classification time | < 500ms |

### RQ2 — Routing Correctness Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Routing Accuracy | Correct routes / Total | ≥ 0.95 |
| Intent F1 | Per-class F1 macro-average | ≥ 0.90 |
| Safety-Critical Hallucinations | Incorrect HIGH→LOW routing | 0 |
| Small-Talk Precision | Correct skips / Total skips | ≥ 0.95 |
| Tool Call Accuracy | Correct tool invocations / Total | ≥ 0.90 |

### RQ3 — Quality & Privacy Metrics

| Metric | Method | Target |
|--------|--------|--------|
| Clinical Validity | Expert panel rating (1-5) | ≥ 4.0 |
| CBT Adherence | Checklist compliance | ≥ 90% |
| Personalization | Novel strategies / Total | ≥ 80% |
| k-Anonymity Compliance | Cell count audit | 100% cells ≥ 5 |
| DP Budget | ε tracking per query | Within allocated ε |
| Privacy Attack Resistance | Re-identification attempts | 0 successful |

---

## Testing Strategy

```mermaid
flowchart TD
    subgraph "Unit Tests"
        U1["STA classifiers<br/>Keyword + LLM"]
        U2["Decision node<br/>Routing logic"]
        U3["Tool registry<br/>Schema validation"]
        U4["Screening engine<br/>Decay scoring"]
    end

    subgraph "Integration Tests"
        I1["Full chat flow<br/>Message → Response"]
        I2["Crisis path<br/>Message → TCA + CMA"]
        I3["Analytics flow<br/>Query → k-anonymous result"]
        I4["Appointment booking<br/>Intent → booked appointment"]
    end

    subgraph "Research Evaluation"
        R1["Ground truth dataset<br/>evaluation runner"]
        R2["Expert panel review<br/>CBT plan quality"]
        R3["Privacy audit<br/>k-anonymity verification"]
    end

    subgraph "Load Tests"
        L1["Concurrent chat sessions"]
        L2["SSE streaming under load"]
        L3["Analytics query throughput"]
    end

    U1 & U2 & U3 & U4 --> I1 & I2 & I3 & I4
    I1 & I2 & I3 & I4 --> R1 & R2 & R3
    R1 & R2 & R3 --> L1 & L2 & L3
```
