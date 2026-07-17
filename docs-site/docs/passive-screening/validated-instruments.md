---
sidebar_position: 2
id: validated-instruments
title: Validated Instruments
---

# Validated Psychological Instruments

The core of the passive screening engine relies on scientifically validated clinical instruments. The system maps conversational features to the domains established by these instruments, ensuring clinical validity.

## Core Instruments Utilized

The system evaluates the following dimensions using established psychiatric scales:

| Dimension | Instrument | Reference | Key Domains Assessed |
|:--- |:--- |:--- |:--- |
| **Depression** | PHQ-9 (Patient Health Questionnaire-9) | Kroenke et al. (2001) | Anhedonia, depressed mood, sleep disturbances, fatigue, concentration issues. |
| **Anxiety** | GAD-7 (Generalized Anxiety Disorder-7) | Spitzer et al. (2006) | Nervousness, uncontrollable worry, restlessness, irritability. |
| **Stress** | DASS-21 (Stress Subscale) | Lovibond & Lovibond (1995) | Difficulty relaxing, nervous energy, agitation, impatience. |
| **Sleep Quality** | PSQI (Pittsburgh Sleep Quality Index) | Buysse et al. (1989) | Sleep latency, duration, daytime dysfunction. |
| **Social Isolation** | UCLA Loneliness Scale (Version 3) | Russell (1996) | Social loneliness, perceived isolation, social withdrawal. |
| **Self-Esteem** | RSES (Rosenberg Self-Esteem Scale) | Rosenberg (1965) | Self-worth, self-acceptance, self-competence. |
| **Crisis/Suicidality** | C-SSRS (Columbia Suicide Severity Rating Scale) | Posner et al. (2011) | Suicidal ideation, intent, plan, self-harm behavior. |

## Thresholds and Normalization

Each instrument operates on a unique scoring scale. To standardize the evaluation across the ecosystem, the system normalizes all scores to a 0.0 to 1.0 continuous scale.

The severity thresholds are dynamically mapped to these normalized scores:

- **None (0.0 - 0.19):** Sub-clinical or absence of symptoms.
- **Mild (0.20 - 0.39):** Detectable symptoms not severely impacting daily function.
- **Moderate (0.40 - 0.59):** Symptoms likely requiring therapeutic intervention or coaching.
- **Severe (0.60 - 0.79):** Significant impairment, counselor review strongly recommended.
- **Critical (0.80 - 1.00):** Immediate crisis or high risk; automatic escalation to human personnel.
