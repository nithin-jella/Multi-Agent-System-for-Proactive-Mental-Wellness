---
sidebar_position: 3
id: evaluation
title: Evaluation Framework
---

# Evaluation Framework

To ensure the system is safe, effective, and functionally correct, the evaluation of UGM-AICare is structured around specific metrics aligned with the three core Research Questions (RQs).

## Core Research Questions

### RQ1: Proactive Safety
**Question:** Can an agentic system detect crisis signals with high sensitivity (>90%) and low false negatives?

**Evaluation Method:**
- Simulated conversation datasets encompassing a range of risk profiles (Level 0 to Level 3).
- **Metric:** Sensitivity (Recall), specificity, and precision in predicting the correct triage level.
- **Safety Criterion:** Zero false negatives for severe suicidal ideation (Level 3 risk).

### RQ2: Functional Correctness
**Question:** Can a LangGraph-based orchestrator reliably route intents without hallucinations?

**Evaluation Method:**
- Intent classification testing using out-of-distribution adversarial prompts.
- **Metric:** Routing accuracy rate. Aika must correctly hand off the conversation to the Safety Triage Agent, Therapeutic Coach Agent, or Case Management Agent without deadlocking or misclassifying the user's intent.
- **Metric:** Latency and system throughput during context switching.

### RQ3: Output Quality & Privacy
**Question:** Can the system generate clinically valid CBT responses while maintaining k-anonymity?

**Evaluation Method:**
- Clinical review of the Therapeutic Coach Agent's generated responses for adherence to Cognitive Behavioral Therapy (CBT) principles and absence of harmful advice.
- Verification of the Insights Agent queries to ensure differential privacy mechanisms (k-anonymity where $k \ge 5$) prevent any potential re-identification of students.

## Sensitivity Analysis & Testing

Continuous testing is conducted throughout the CI/CD pipeline. The evaluation encompasses:

- **Unit Testing:** Ensuring validated instrument scoring algorithms (e.g., GAD-7, PHQ-9 thresholds) are mathematically exact.
- **Integration Testing:** Ensuring state persistence and context retention between the LangGraph nodes.
- **Load Testing:** Validating that the backend can handle concurrent background analysis and database writes without blocking the user-facing chat response.
