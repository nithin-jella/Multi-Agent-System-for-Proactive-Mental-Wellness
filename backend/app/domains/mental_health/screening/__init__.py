"""Mental Health Screening Module.

This module provides covert mental health screening capabilities that extract
indicators from natural conversation without explicit assessment questions.

Theoretical Foundation:
Based on internationally validated psychological screening instruments:

1. DEPRESSION: PHQ-9 (Patient Health Questionnaire-9)
   - Kroenke et al. (2001). The PHQ-9: Validity of a brief depression severity measure.
   - Domains: Anhedonia, depressed mood, sleep, fatigue, appetite, guilt, concentration, psychomotor, suicidal ideation
   - Scoring: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe

2. ANXIETY: GAD-7 (Generalized Anxiety Disorder-7)
   - Spitzer et al. (2006). A brief measure for assessing generalized anxiety disorder.
   - Domains: Feeling nervous, uncontrollable worry, excessive worry, trouble relaxing, restlessness, irritability, fear
   - Scoring: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe

3. STRESS: DASS-21 Stress Subscale (Depression Anxiety Stress Scales)
   - Lovibond & Lovibond (1995). The structure of negative emotional states.
   - Domains: Difficulty relaxing, nervous arousal, easily agitated, irritable, impatient, over-reactive, intolerant
   - Scoring: 0-7 normal, 8-9 mild, 10-12 moderate, 13-16 severe, 17+ extremely severe

4. SLEEP: PSQI (Pittsburgh Sleep Quality Index)
   - Buysse et al. (1989). The Pittsburgh Sleep Quality Index.
   - Domains: Sleep quality, latency, duration, efficiency, disturbances, medication, daytime dysfunction
   - Scoring: 0-4 good, 5-10 poor, 11+ very poor

5. SOCIAL ISOLATION: UCLA Loneliness Scale (Version 3)
   - Russell (1996). UCLA Loneliness Scale Version 3.
   - Domains: Social loneliness, emotional loneliness, perceived isolation
   - Scoring: 20-34 low, 35-49 moderate, 50-65 high, 66-80 very high

6. SELF-WORTH: RSES (Rosenberg Self-Esteem Scale)
   - Rosenberg (1965). Society and the adolescent self-image.
   - Domains: Self-worth, self-acceptance, self-respect, perceived competence
   - Scoring: 0-15 low, 15-25 normal, 26-30 high

7. SUBSTANCE USE: AUDIT (Alcohol Use Disorders Identification Test)
   - Saunders et al. (1993). Development of the AUDIT.
   - Domains: Hazardous use, dependence symptoms, harmful use
   - Scoring: 0-7 low risk, 8-15 hazardous, 16-19 harmful, 20+ dependence

8. CRISIS: Columbia Suicide Severity Rating Scale (C-SSRS)
   - Posner et al. (2011). The Columbia Suicide Severity Rating Scale.
   - Domains: Suicidal ideation intensity, suicidal behavior, self-harm
   - Any positive indicator requires immediate escalation

Privacy & Ethics:
- All extraction is consent-based (user agrees to mental health support)
- Data is used only to improve support quality
- No external sharing without explicit consent
- Complies with Indonesian Mental Health Law No. 18/2014
"""

from .engine import (
    ScreeningDimension,
    IndicatorSeverity,
    ExtractionResult,
    ScreeningProfile,
    DimensionScore,
    update_screening_profile,
    INSTRUMENT_REFERENCES,
    DIMENSION_SCORING_THRESHOLDS,
)

from .instruments import (
    PHQ9_DOMAINS,
    GAD7_DOMAINS,
    DASS21_STRESS_DOMAINS,
    PSQI_DOMAINS,
    UCLA_LONELINESS_DOMAINS,
    RSES_DOMAINS,
    AUDIT_DOMAINS,
    CSSRS_DOMAINS,
)

__all__ = [
    # Core engine
    "ScreeningDimension",
    "IndicatorSeverity",
    "ExtractionResult",
    "ScreeningProfile",
    "DimensionScore",
    "update_screening_profile",
    "INSTRUMENT_REFERENCES",
    "DIMENSION_SCORING_THRESHOLDS",
    # Instrument domains
    "PHQ9_DOMAINS",
    "GAD7_DOMAINS",
    "DASS21_STRESS_DOMAINS",
    "PSQI_DOMAINS",
    "UCLA_LONELINESS_DOMAINS",
    "RSES_DOMAINS",
    "AUDIT_DOMAINS",
    "CSSRS_DOMAINS",
]
