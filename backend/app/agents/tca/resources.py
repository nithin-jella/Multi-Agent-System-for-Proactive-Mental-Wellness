from __future__ import annotations

from typing import Iterable, List

from app.agents.tca.schemas import ResourceCard


def get_default_resources(intent: str) -> Iterable[ResourceCard]:
    """Return static resource cards until dynamic lookup is wired."""

    intent_key = intent.strip().lower()

    catalog: dict[str, List[ResourceCard]] = {
        "academic_stress": [
            ResourceCard(
                resource_id="academic_focus_journal",
                title="Academic Focus Journal",
                description="Guided prompts to break coursework into manageable chunks.",
                url="https://aicare.example/academic/journal",
            ),
            ResourceCard(
                resource_id="study_break_micro",
                title="Micro Study-Break Routine",
                description="Three-minute reset combining stretching and grounding.",
                url="https://aicare.example/academic/micro-break",
            ),
        ],
        "acute_distress": [
            ResourceCard(
                resource_id="grounding_audio",
                title="5-4-3-2-1 Grounding Audio",
                description="An audio walkthrough to reorient during panic or overwhelm.",
                url="https://aicare.example/distress/grounding-audio",
            ),
            ResourceCard(
                resource_id="safety_plan_template",
                title="Personal Safety Plan Template",
                description="Document trusted contacts, coping steps, and emergency numbers.",
                url="https://aicare.example/safety/plan-template",
            ),
        ],
        "relationship_strain": [
            ResourceCard(
                resource_id="communication_script",
                title="Courageous Conversation Script",
                description="Template to express needs without escalating conflict.",
                url="https://aicare.example/relationships/script",
            ),
            ResourceCard(
                resource_id="support_warmline",
                title="Campus Support Warmline",
                description="Talk with a peer counselor trained in conflict navigation.",
                url="https://aicare.example/support/warmline",
            ),
        ],
        "financial_pressure": [
            ResourceCard(
                resource_id="budget_calc",
                title="Student Budget Worksheet",
                description="Adaptive budgeting sheet with essentials vs. optional costs.",
                url="https://aicare.example/finance/budget",
            ),
            ResourceCard(
                resource_id="aid_office",
                title="Financial Aid Office Checklist",
                description="Prepare documents for bursar or scholarship conversations.",
                url="https://aicare.example/finance/checklist",
            ),
        ],
        "general_support": [
            ResourceCard(
                resource_id="self_compassion",
                title="Self-Compassion Break",
                description="Three-step practice to soften harsh self-talk.",
                url="https://aicare.example/general/self-compassion",
            ),
            ResourceCard(
                resource_id="contact_counseling",
                title="Contact Counseling Centre",
                description="Direct line and scheduling instructions for university counselors.",
                url="https://aicare.example/general/counseling",
            ),
        ],
    }

    return catalog.get(intent_key, catalog["general_support"])
