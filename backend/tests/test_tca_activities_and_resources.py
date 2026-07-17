from __future__ import annotations

from app.agents.tca.activities_catalog import (
    ActivityDefinition,
    get_activities_by_category,
    get_activities_by_tags,
    get_activity_by_id,
    get_recommended_activities,
    get_all_activities_prompt_context,
)
from app.agents.tca.resources import get_default_resources


def test_activity_definition_to_resource_card() -> None:
    activity = ActivityDefinition(
        id="box-breathing",
        name="Box Breathing",
        description="d",
        category="breathing",
        estimated_duration=60,
        difficulty="beginner",
        tags=["calming"],
        icon="x",
    )

    card = activity.to_resource_card()
    assert card["resource_type"] == "activity"
    assert card["activity_id"] == "box-breathing"
    assert card["url"].startswith("/activities")


def test_get_activities_by_category_filters() -> None:
    breathing = get_activities_by_category("breathing")
    assert breathing
    assert all(a.category == "breathing" for a in breathing)


def test_get_activities_by_tags_sorted_by_score() -> None:
    tags = ["panic", "grounding", "calming"]
    activities = get_activities_by_tags(tags)
    assert activities

    def score(a: ActivityDefinition) -> int:
        return sum(1 for t in tags if t in a.tags)

    scores = [score(a) for a in activities]
    assert all(s > 0 for s in scores)
    assert scores == sorted(scores, reverse=True)


def test_get_activity_by_id_found_and_missing() -> None:
    assert get_activity_by_id("box-breathing") is not None
    assert get_activity_by_id("does-not-exist") is None


def test_get_recommended_activities_respects_max() -> None:
    cards = get_recommended_activities(intent="panic", risk_level="critical", max_activities=1)
    assert len(cards) == 1
    assert cards[0]["resource_type"] == "activity"


def test_get_all_activities_prompt_context_includes_registry() -> None:
    context = get_all_activities_prompt_context()
    assert "AVAILABLE INTERACTIVE ACTIVITIES" in context
    assert "box-breathing" in context


def test_get_default_resources_unknown_falls_back_general() -> None:
    resources = list(get_default_resources("unknown_intent"))
    assert resources
    assert all(r.title for r in resources)
