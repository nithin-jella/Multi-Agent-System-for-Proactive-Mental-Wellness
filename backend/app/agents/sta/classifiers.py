from __future__ import annotations

import re
from typing import Any, Mapping, cast

from app.agents.sta.schemas import RiskLevel, STAClassifyRequest, STAClassifyResponse


_CRISIS_KEYWORDS: tuple[str, ...] = (
    # Explicit suicide mentions
    "bunuh diri",
    "suicide",
    "suicidal",
    "mengakhiri hidup",
    
    # Direct death wishes (English) - using patterns handled by regex
    "kill myself",
    # "want to die",  # Removed - handled by regex pattern with word boundaries
    # "wanna die",  # Removed - handled by regex pattern
    "wish i was dead",  # Specific phrase unlikely to false-match
    "wish i were dead",  # Specific phrase
    # "want to be dead",  # Removed - handled by regex
    # "ready to die",  # Removed - handled by regex  
    "end my life",  # Specific phrase
    "ending it all",  # Specific phrase
    "don't want to live",  # Specific phrase
    "dont want to live",  # Specific phrase
    "can't go on",  # Specific phrase
    "cant go on",  # Specific phrase
    "better off dead",  # Specific phrase
    "better off without me",  # Specific phrase
    "world without me",  # Specific phrase
    
    # Direct death wishes (Indonesian)
    "tidak mau hidup",
    "tidak ingin hidup",
    "ingin mati",
    "pengen mati",
    # "mau mati",  # Removed - handled by Indonesian regex pattern
    "lebih baik mati",
    "ga mau hidup",
    "gak mau hidup",
    
    # Self-harm methods
    "gantung diri",
    "overdose",
    "jump off",
    "cut my wrists",
    "slit my wrists",
    
    # Farewell indicators
    "goodbye note",
    "goodbye letter",
    "suicide note",
    "final message",
    "surat perpisahan",
    "pesan terakhir",
)

_HIGH_DISTRESS_KEYWORDS: tuple[str, ...] = (
    "panic",
    "panik",
    "serangan panik",
    "self harm",
    "melukai diri",
    "tidur tidak",
    "tidak bisa tidur",
    "trauma",
    "depress",
    "hopeless",
    "putus asa",
    "kosong",
    "empty inside",
    "tidak ada artinya",
    "meaningless",
    "tidak berguna",
    "useless",
    "ga berguna",
    "tidak ada gunanya",
    "staying in bed",
    "tidur terus",
    "skipping class",
    "bolos kuliah",
    "nothing matters",
    "burnout",
    "drop out",
    "berhenti kuliah",
    "tidak bisa lagi",
)

_ACADEMIC_KEYWORDS: tuple[str, ...] = (
    "skripsi",
    "tesis",
    "kuliah",
    "ujian",
    "nilai",
    "tugas",
)

_RELATIONSHIP_KEYWORDS: tuple[str, ...] = (
    "pacar",
    "relationship",
    "orang tua",
    "family",
    "pertemanan",
)

_FINANCIAL_KEYWORDS: tuple[str, ...] = (
    "biaya",
    "uang",
    "keuangan",
    "financial",
    "bayar",
)

# Keywords for detecting need for calming techniques
_CALM_DOWN_KEYWORDS: tuple[str, ...] = (
    "cemas",
    "anxious",
    "anxiety",
    "panic",
    "panik",
    "overthink",
    "terlalu banyak pikir",
    "tidak tenang",
    "gelisah",
    "nervous",
    "worried",
    "khawatir",
    "stress banget",
    "stressed out",
    "overwhelm",
    "kewalahan",
    "racing thoughts",
    "pikiran kacau",
    "tidak bisa fokus",
    "can't focus",
    "cannot concentrate",
    "susah konsentrasi",
    "jantung berdebar",
    "heart racing",
    "breathing fast",
    "napas cepat",
    "keringat dingin",
)

# Keywords for detecting need to break down problems
_BREAK_DOWN_PROBLEM_KEYWORDS: tuple[str, ...] = (
    "tidak tahu harus mulai dari mana",
    "don't know where to start",
    "dont know where to start",
    "bingung mulai",
    "masalah terlalu besar",
    "problem too big",
    "terlalu banyak",
    "too much",
    "overwhelm",
    "kewalahan",
    "tidak bisa handle",
    "can't handle",
    "cannot handle",
    "stuck",
    "buntu",
    "mentok",
    "tidak tahu caranya",
    "don't know how",
    "dont know how",
    "complicated",
    "kompleks",
    "rumit",
    "sulit banget",
    "too difficult",
    "cara ngatasin",
    "bagaimana menghadapi",
    "how to deal with",
    "how to solve",
    "gimana solusinya",
    "need a plan",
    "butuh rencana",
    "butuh strategi",
    "need strategy",
)

# Regex patterns for crisis detection (catch variations and misspellings)
_CRISIS_PATTERNS: tuple[str, ...] = (
    r"\b(want|wanna|wish)(?:ed)?\s+(?:to\s+)?(die|be\s+dead)\b",  # want to die, wanna die, wish I was dead
    r"\b(don'?t|cant|can'?t)\s+want\s+to\s+live\b",  # don't want to live
    r"\b(can'?t|cant)\s+(take|do)\s+(it|this)\s+(anymore|any\s+more)\b",  # can't take it anymore
    r"\b(end|ending)\s+(?:my|this|it\s+all)\s+life\b",  # end my life (more specific)
    r"\bending\s+it\s+all\b",  # ending it all
    r"\b(kill|killing)\s+my?self\b",  # kill myself
    r"\b(ready|prepared)\s+to\s+die\b",  # ready to die
    r"\bmau\s+mati\b",  # Indonesian: want to die
    r"\btidak\s+mau\s+hidup\b",  # Indonesian: don't want to live
    r"\bingin\s+mati\b",  # Indonesian: want to die
)


class SafetyTriageClassifier:
    """Rule-based interim triage classifier until ML models are wired."""

    def _check_crisis_patterns(self, text: str) -> bool:
        """Check text against regex patterns for crisis intent.
        
        Args:
            text: Lowercased user message
            
        Returns:
            True if any crisis pattern matches
        """
        for pattern in _CRISIS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    async def classify(
        self,
        payload: STAClassifyRequest,
        *,
        context: Mapping[str, Any] | None = None,
    ) -> STAClassifyResponse:
        text = payload.text.lower()

        risk_score = 0
        intent = "general_support"
        next_step = "resource"
        handoff = False
        diagnostic_notes: list[str] = []
        needs_support_plan = False
        plan_type = "none"

        # Check for crisis keywords OR regex patterns
        has_crisis_keyword = any(keyword in text for keyword in _CRISIS_KEYWORDS)
        has_crisis_pattern = self._check_crisis_patterns(text)
        
        if has_crisis_keyword or has_crisis_pattern:
            risk_score = 3
            intent = "crisis_support"
            next_step = "human"
            handoff = True
            if has_crisis_keyword:
                diagnostic_notes.append("Keyword match indicates crisis intent")
            if has_crisis_pattern:
                diagnostic_notes.append("Pattern match indicates crisis intent")
        elif any(keyword in text for keyword in _HIGH_DISTRESS_KEYWORDS):
            risk_score = 2
            intent = "acute_distress"
            next_step = "human"
            handoff = True
            diagnostic_notes.append("Elevated distress keywords detected")
        else:
            if any(keyword in text for keyword in _ACADEMIC_KEYWORDS):
                intent = "academic_stress"
                next_step = "tca"
                risk_score = max(risk_score, 1)
            if any(keyword in text for keyword in _RELATIONSHIP_KEYWORDS):
                intent = "relationship_strain"
                risk_score = max(risk_score, 1)
            if any(keyword in text for keyword in _FINANCIAL_KEYWORDS):
                intent = "financial_pressure"
                risk_score = max(risk_score, 1)

        # Detect need for Therapeutic Coach Plan (independent of risk level)
        # Check for calm down indicators
        has_calm_keywords = any(keyword in text for keyword in _CALM_DOWN_KEYWORDS)
        if has_calm_keywords:
            needs_support_plan = True
            plan_type = "calm_down"
            diagnostic_notes.append("User shows signs of anxiety/panic - recommend calming techniques")
        
        # Check for problem breakdown indicators (higher priority than calm down)
        has_breakdown_keywords = any(keyword in text for keyword in _BREAK_DOWN_PROBLEM_KEYWORDS)
        if has_breakdown_keywords:
            needs_support_plan = True
            plan_type = "break_down_problem"
            diagnostic_notes.append("User overwhelmed by problem complexity - recommend breaking down approach")
        
        # If moderate/high risk and next_step is TCA, also recommend support plan
        if risk_score >= 1 and next_step == "tca" and not needs_support_plan:
            needs_support_plan = True
            plan_type = "general_coping"
            diagnostic_notes.append("Moderate stress detected - recommend general coping support plan")

        notes = "; ".join(diagnostic_notes) if diagnostic_notes else None
        risk_level = cast(RiskLevel, max(0, min(3, risk_score)))

        return STAClassifyResponse(
            risk_level=risk_level,
            intent=intent,
            next_step=next_step,
            handoff=handoff,
            diagnostic_notes=notes,
            needs_therapeutic_coach_plan=needs_support_plan,
            therapeutic_plan_type=plan_type,
        )
