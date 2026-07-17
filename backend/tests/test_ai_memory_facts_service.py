from __future__ import annotations

import pytest

from app.services.ai_memory_facts_service import (
    _hash_fact,
    _normalize_fact_text,
    extract_candidate_facts,
)


@pytest.mark.unit
def test_normalize_fact_text_is_stable() -> None:
    assert _normalize_fact_text("  Hello   World  ") == "hello world"
    assert _normalize_fact_text("Hello\nWorld") == "hello world"


@pytest.mark.unit
def test_hash_fact_is_deterministic_and_user_scoped() -> None:
    text = _normalize_fact_text("Preferred language: English")
    assert _hash_fact(1, text) == _hash_fact(1, text)
    assert _hash_fact(1, text) != _hash_fact(2, text)


@pytest.mark.unit
def test_extract_candidate_facts_empty_for_blank_message() -> None:
    assert extract_candidate_facts("") == []
    assert extract_candidate_facts("   ") == []


@pytest.mark.unit
def test_extract_candidate_facts_extracts_identity_and_preferences() -> None:
    msg = "Hi, my name is Budi. My pronouns are he/him. I prefer English. My timezone is Asia/Jakarta."
    facts = extract_candidate_facts(msg)

    rendered = {f.text for f in facts}
    assert "Preferred name: Budi" in rendered
    assert "Pronouns: he/him" in rendered
    assert "Preferred language: English" in rendered
    assert "Preferred timezone: Asia/Jakarta" in rendered


@pytest.mark.unit
def test_extract_candidate_facts_deduplicates_within_message() -> None:
    msg = "Call me Aika. call me Aika!"  # same fact, different casing/punctuation
    facts = extract_candidate_facts(msg)
    assert [f.text for f in facts] == ["Preferred name: Aika"]
