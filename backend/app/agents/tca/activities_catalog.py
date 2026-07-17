"""
Therapeutic Activities Catalog for TCA Integration

This module defines available interactive activities that the TCA can recommend
as part of intervention plans. Activities are rendered by the frontend's
ActivityPlayer component.

To add a new activity:
1. Add it to the frontend (src/components/activities/)
2. Register it here with metadata
3. TCA will automatically consider it in recommendations

Categories:
- breathing: Breathing exercises for calm
- grounding: Present-moment awareness techniques
- mindfulness: Meditation and relaxation
- cognitive: Thought-based CBT exercises
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ActivityDefinition:
    """Definition of an interactive therapeutic activity."""
    id: str
    name: str
    description: str
    category: str
    estimated_duration: int  # seconds
    difficulty: str  # beginner, intermediate, advanced
    tags: List[str]
    icon: str
    
    def to_resource_card(self) -> Dict[str, Any]:
        """Convert to ResourceCard format for TCA response."""
        return {
            "title": self.name,
            "description": self.description,
            "resource_type": "activity",
            "activity_id": self.id,
            "url": f"/activities?play={self.id}",  # Deep link to activity
            "resource_id": f"activity_{self.id}",
        }


# Registry of all available activities
ACTIVITIES_CATALOG: Dict[str, ActivityDefinition] = {
    # ===== BREATHING EXERCISES =====
    "box-breathing": ActivityDefinition(
        id="box-breathing",
        name="Box Breathing",
        description="Teknik pernapasan 4-4-4-4 yang dipakai Navy SEALs untuk menenangkan pikiran dan mengurangi stres.",
        category="breathing",
        estimated_duration=240,  # 4 minutes
        difficulty="beginner",
        tags=["anxiety", "stress", "focus", "calming", "panic"],
        icon="🔲",
    ),
    "four-seven-eight": ActivityDefinition(
        id="four-seven-eight",
        name="4-7-8 Breathing",
        description="Teknik napas relaksasi dari Dr. Andrew Weil untuk tidur lebih nyenyak dan mengurangi kecemasan.",
        category="breathing",
        estimated_duration=300,  # 5 minutes
        difficulty="beginner",
        tags=["sleep", "relaxation", "anxiety", "calming", "insomnia"],
        icon="💜",
    ),
    
    # ===== GROUNDING TECHNIQUES =====
    "five-four-three-two-one": ActivityDefinition(
        id="five-four-three-two-one",
        name="5-4-3-2-1 Grounding",
        description="Teknik grounding sensorik yang menggunakan 5 indera untuk membawa kamu kembali ke saat ini.",
        category="grounding",
        estimated_duration=180,  # 3 minutes
        difficulty="beginner",
        tags=["anxiety", "panic", "dissociation", "grounding", "present-moment"],
        icon="🌿",
    ),
}


def get_activities_by_category(category: str) -> List[ActivityDefinition]:
    """Get all activities in a specific category."""
    return [a for a in ACTIVITIES_CATALOG.values() if a.category == category]


def get_activities_by_tags(tags: List[str]) -> List[ActivityDefinition]:
    """Get activities matching any of the given tags, sorted by relevance."""
    scored = []
    for activity in ACTIVITIES_CATALOG.values():
        score = sum(1 for tag in tags if tag in activity.tags)
        if score > 0:
            scored.append((score, activity))
    
    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)
    return [a for _, a in scored]


def get_activity_by_id(activity_id: str) -> Optional[ActivityDefinition]:
    """Get a specific activity by ID."""
    return ACTIVITIES_CATALOG.get(activity_id)


def get_recommended_activities(
    intent: str,
    risk_level: Optional[str] = None,
    max_activities: int = 2
) -> List[Dict[str, Any]]:
    """
    Get recommended activities based on intent and context.
    Returns activities formatted as ResourceCards.
    
    Intent mapping:
    - calm_down -> breathing activities
    - anxiety/panic -> grounding + breathing
    - general_stress -> breathing
    - sleep issues -> 4-7-8 breathing
    """
    # Map intents to relevant tags
    intent_tag_map = {
        "calm_down": ["calming", "anxiety", "panic", "stress"],
        "anxiety": ["anxiety", "panic", "calming", "grounding"],
        "panic": ["panic", "grounding", "anxiety", "calming"],
        "acute_distress": ["panic", "grounding", "calming"],
        "academic_stress": ["stress", "focus", "calming"],
        "sleep": ["sleep", "relaxation", "calming"],
        "insomnia": ["sleep", "insomnia", "relaxation"],
        "general_coping": ["stress", "calming", "relaxation"],
        "stress": ["stress", "calming", "relaxation"],
    }
    
    # Get relevant tags for the intent
    tags = intent_tag_map.get(intent.lower(), ["calming", "stress"])
    
    # High risk -> prioritize grounding
    if risk_level in ["high", "critical"]:
        tags = ["grounding", "panic"] + tags
    
    # Get matching activities
    activities = get_activities_by_tags(tags)[:max_activities]
    
    # Convert to resource card format
    return [a.to_resource_card() for a in activities]


def get_all_activities_prompt_context() -> str:
    """
    Generate a context string for Gemini prompts describing available activities.
    """
    lines = [
        "AVAILABLE INTERACTIVE ACTIVITIES (can be included in resource_cards with resource_type='activity'):",
        ""
    ]
    
    for activity in ACTIVITIES_CATALOG.values():
        lines.append(f"- {activity.id}: {activity.name}")
        lines.append(f"  Description: {activity.description}")
        lines.append(f"  Duration: ~{activity.estimated_duration // 60} minutes")
        lines.append(f"  Best for: {', '.join(activity.tags[:4])}")
        lines.append("")
    
    lines.append("To include an activity, add a resource_card with:")
    lines.append('  {"title": "...", "description": "...", "resource_type": "activity", "activity_id": "<activity-id>"}')
    
    return "\n".join(lines)
