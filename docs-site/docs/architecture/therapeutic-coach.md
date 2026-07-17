---
id: therapeutic-coach-agent
title: Therapeutic Coach Agent
sidebar_position: 3
---

# Therapeutic Coach Agent

## TCA - Therapeutic Coach Agent

## What Is the TCA?

The Therapeutic Coach Agent (TCA) provides evidence-based support within the system. When the STA determines that a student requires more than empathetic conversation, the TCA delivers structured, clinically guided interventions. The TCA is grounded in Cognitive Behavioral Therapy (CBT), a validated psychological approach. CBT operates on the principle that thoughts, feelings, and behaviors are interconnected, and that addressing unhelpful thought patterns can effectively reduce emotional distress.

The TCA is grounded in **Cognitive Behavioural Therapy (CBT)** - one of the most empirically validated approaches in psychology. CBT works on the premise that thoughts, feelings, and behaviours are interconnected, and that changing unhelpful thought patterns can reduce emotional distress.

---

## When Is the TCA Invoked?

The TCA is called by the orchestrator under two conditions:

1. **Moderate risk** (`risk_level = 1`): The STA has detected distress signals that warrant structured support but not immediate clinical escalation.
2. **High/Critical risk** (`risk_level ≥ 2`): The TCA runs in **parallel** with the CMA. Both agents start simultaneously, and their outputs are merged in the synthesis node.

The TCA is *never* invoked for casual conversation or simple information queries - this preserves its clinical weight and avoids "therapy-washing" ordinary chat.

---

## TCA LangGraph Flow

The TCA is implemented as a compiled LangGraph with structured nodes:

```mermaid
flowchart TD
    START([TCA Invoked]) --> LOAD["Load Context<br/>User profile + history<br/>+ previous plans"]
    LOAD --> CLASSIFY["Classify Intent<br/>academic_stress, anxiety,<br/>depression, panic, etc."]
    CLASSIFY --> SELECT_PROMPT["Select CBT Prompt Template<br/>calm_down, cognitive_restructuring,<br/>behavioral_activation, general_coping"]
    SELECT_PROMPT --> GEN["Generate Plan via Gemini<br/>Structured JSON output"]
    GEN --> REPAIR{JSON valid?}
    REPAIR --> |No| FIX["Repair truncated JSON<br/>_repair_truncated_json()"]
    FIX --> REPAIR
    REPAIR --> |Yes| SAFETY["Safety Review Gate<br/>Check for harmful content<br/>+ clinical boundaries"]
    SAFETY --> SAFE{Plan safe?}
    SAFE --> |No| REVISE["Revise plan<br/>Remove unsafe content"]
    REVISE --> SAFETY
    SAFE --> |Yes| PERSONALIZE["Personalize Plan<br/>Check previous strategies<br/>Avoid repetition"]
    PERSONALIZE --> ACTIVITIES["Attach Wellness Activities<br/>From curated catalog"]
    ACTIVITIES --> RESOURCES["Attach Resource Cards<br/>Relevant to intent"]
    RESOURCES --> WRITE["Write to State<br/>intervention_plan +<br/>coping_strategies"]
    WRITE --> PERSIST["Persist to DB<br/>InterventionPlan table"]
    PERSIST --> END([Return to Synthesis])

    style SAFETY fill:#ff6b6b,color:#fff
    style PERSONALIZE fill:#a855f7,color:#fff
```

---

## Safety Review Gate

Every generated plan passes through a safety review before delivery:

```mermaid
flowchart LR
    PLAN["Generated Plan"] --> CHECK1{"Contains<br/>diagnosis?"}
    CHECK1 --> |Yes| REJECT1["Remove diagnostic<br/>language"]
    CHECK1 --> |No| CHECK2{"Recommends<br/>medication?"}
    CHECK2 --> |Yes| REJECT2["Remove medication<br/>references"]
    CHECK2 --> |No| CHECK3{"Appropriate for<br/>risk level?"}
    CHECK3 --> |No| REJECT3["Downgrade to<br/>lower-intensity plan"]
    CHECK3 --> |Yes| CHECK4{"Includes<br/>disclaimer?"}
    CHECK4 --> |No| ADD_DISCLAIMER["Add supportive<br/>guidance disclaimer"]
    CHECK4 --> |Yes| APPROVED["✅ Plan Approved"]
    REJECT1 --> RERUN["Re-generate plan"]
    REJECT2 --> RERUN
    REJECT3 --> RERUN
    ADD_DISCLAIMER --> APPROVED
    RERUN --> CHECK1

    style APPROVED fill:#51cf66,color:#fff
    style REJECT1 fill:#ff6b6b,color:#fff
    style REJECT2 fill:#ff6b6b,color:#fff
    style REJECT3 fill:#ff6b6b,color:#fff
```

---

## CBT Prompt Templates

The TCA uses five specialized prompt templates selected by intent:

| Template | Trigger Intent | Approach |
|----------|---------------|----------|
| `CALM_DOWN` | Acute anxiety, panic | Immediate grounding + breathing techniques |
| `COGNITIVE_RESTRUCTURING` | Depression, negative thinking | Thought record + cognitive distortion identification |
| `BEHAVIORAL_ACTIVATION` | Low mood, anhedonia | Activity scheduling + graded exposure |
| `BREAK_DOWN_PROBLEM` | Academic stress, overwhelm | Problem decomposition + prioritization |
| `GENERAL_COPING` | General distress | Mixed CBT techniques + psychoeducation |

Each template produces a structured `TCAInterveneResponse` with:
- `coping_strategies`: Ordered list of actionable steps
- `psychoeducation`: Brief explanation of the psychological mechanism
- `homework`: Optional between-session exercise
- `resource_cards`: Relevant resources from the catalog
- `follow_up_trigger`: Recommended time until next check-in

---

## What the TCA Produces

The TCA produces an intervention plan, which is a structured object integrated into Aika's response and maintained in the database. The personalization process is critical. The TCA reviews previously suggested coping strategies to avoid redundancy, ensuring the agent remains effective and engaging over long-term use.

```json
{
 "plan_id": "tcp_8f3a2c",
 "user_id": 1203,
 "category": "academic_stress",
 "coping_strategies": [
 "5-4-3-2-1 grounding technique for acute anxiety",
 "Pomodoro time-blocking for exam preparation",
 "Scheduled worry time (15 min/day, then redirect)"
 ],
 "psychoeducation": "Exam anxiety is a normal physiological response...",
 "homework": "Write down three thoughts about exams and identify the cognitive distortion in each.",
 "follow_up_trigger": "3 days",
 "evidence_base": "CBT for academic anxiety [Beck, 1979; Meichenbaum, 1985]"
}
```

---

## The Intervention Plan Generation Pipeline

```mermaid
flowchart TD
 A[Receive shared state\nrisk_level, intent, message] --> B{Intent Classification}
 B -- "Academic stress" --> C[Generate study skills\n+ anxiety management plan]
 B -- "Interpersonal conflict" --> D[Generate social skills\n+ assertiveness strategies]
 B -- "Low mood / depression" --> E[Generate behavioural activation\n+ thought record exercises]
 B -- "Panic / acute anxiety" --> F[Generate immediate\ngrounding techniques]
 C & D & E & F --> G[Fetch student history\nfrom intervention plan DB]
 G --> H[Personalise to student\navoid repeating used strategies]
 H --> I[Generate via Gemini Pro\nwith CBT framework prompt]
 I --> J[Write to SafetyAgentState\nintervention_plan field]
 J --> K[Persist to DB\nUserInterventionPlan table]
```

The personalization step is essential. The TCA monitors previously suggested coping strategies to avoid repetition, ensuring the agent remains engaging over extended periods.

---

## Wellness Activities Catalogue

Beyond the generated plan, the TCA has access to a curated catalogue of structured wellness activities. These are categorised by type and evidence base, and can be recommended directly in conversation:

| Category | Example Activities |
| --- | --- |
| **Breathing exercises** | Box breathing, 4-7-8 technique, diaphragmatic breathing |
| **Grounding techniques** | 5-4-3-2-1 sensory, cold water immersion, body scan |
| **CBT exercises** | Thought records, cognitive restructuring worksheets, behavioural experiments |
| **Psychoeducation** | Short explainers on anxiety, depression, stress physiology |
| **Lifestyle anchors** | Sleep hygiene, exercise scheduling, social connection |

---

## Journaling Integration

The TCA encourages students to maintain a digital journal within the platform. Journal entries serve as:

1. **Therapeutic homework** - completing assigned reflective exercises
2. **Longitudinal mood tracking** - the STA's background analysis can incorporate journal content for richer screening
3. **Conversation starters** - Aika can reference recent journal entries to make follow-up conversations feel continuous

---

## What the TCA Does Not Do

The TCA is deliberately scoped. It does **not**:

- Diagnose mental health conditions
- Prescribe or recommend medications
- Provide crisis counselling (that is the CMA's escalation path)
- Replace a human therapist

Every TCA-generated plan includes a disclaimer that it is supportive guidance, not clinical treatment, and that a trained counsellor is available if the student wants human support.
