"""
Aika's Screening Awareness Module

This module provides Aika with awareness of:
1. What mental health dimensions we're tracking
2. What information gaps exist in the user's profile
3. Natural conversation prompts to elicit missing information

Design Philosophy:
- Aika should feel like a genuine friend, NOT a clinical interviewer
- Questions are woven into natural conversation, never as a checklist
- Timing matters - ask when contextually appropriate
- Never ask more than 1 probing question per response
- Respect the conversation flow

Integration:
- This module is called during Aika's response generation
- It adds "screening guidance" to Aika's system prompt
- STA can use the same LLM call to analyze the response
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# =============================================================================
# SCREENING DIMENSIONS & NATURAL PROBES
# =============================================================================

class ScreeningDimension(str, Enum):
    """Mental health dimensions to track through natural conversation."""
    MOOD = "mood"                   # General emotional state
    SLEEP = "sleep"                 # Sleep quality and patterns
    ENERGY = "energy"               # Energy levels, fatigue
    SOCIAL = "social"               # Social connections, isolation
    ACADEMIC = "academic"           # Academic stress, performance
    APPETITE = "appetite"           # Eating patterns (depression indicator)
    CONCENTRATION = "concentration" # Focus, cognitive function
    SELF_WORTH = "self_worth"       # Self-esteem, self-criticism
    ANXIETY = "anxiety"             # Worry, tension, nervousness
    HOPE = "hope"                   # Future outlook, hopelessness


@dataclass
class NaturalProbe:
    """A natural conversation prompt to elicit screening information.
    
    These are conversational openers that feel genuine, not clinical.
    """
    dimension: ScreeningDimension
    context_triggers: List[str]     # When to use this probe
    probe_variations: List[str]     # Different ways to ask naturally
    follow_up_if_negative: str      # If they share something concerning
    information_goal: str           # What we're trying to learn
    priority: int = 3               # 1-5, higher = more important to fill


# Natural probes that feel like genuine friend conversation
# Designed based on PHQ-9, GAD-7, but conversationalized
NATURAL_PROBES: List[NaturalProbe] = [
    # =========================================================================
    # MOOD (PHQ-9: Depressed mood)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.MOOD,
        context_triggers=[
            "greeting", "starting_conversation", "how_are_you_response",
            "after_discussing_stress", "transitional_moment"
        ],
        probe_variations=[
            "Gimana kabarnya hari ini? Beneran, bukan basa-basi aja.",
            "Akhir-akhir ini gimana sih rasanya? Lagi oke atau ada yang berat?",
            "Kalau boleh tau, perasaanmu gimana belakangan ini?",
            "Hey, kayaknya kamu lagi banyak pikiran. Mau cerita?",
        ],
        follow_up_if_negative="Makasih udah mau cerita. Itu pasti nggak mudah. Mau elaborasi lebih?",
        information_goal="Understand overall emotional state, detect persistent low mood",
        priority=5,
    ),
    
    # =========================================================================
    # SLEEP (PSQI indicators)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.SLEEP,
        context_triggers=[
            "mentions_tired", "mentions_night", "academic_stress",
            "after_mood_discussion", "mentions_energy_low"
        ],
        probe_variations=[
            "Btw, tidurnya gimana? Cukup nggak?",
            "Akhir-akhir ini bisa tidur nyenyak nggak?",
            "Jam tidurmu gimana belakangan? Aku kadang juga struggle sama ini.",
            "Kalau malam, biasanya langsung bisa tidur atau suka kebangun?",
        ],
        follow_up_if_negative="Susah tidur tuh emang ganggu banget ya. Biasanya yang bikin susah apa?",
        information_goal="Assess sleep quality, identify insomnia or disturbed sleep patterns",
        priority=4,
    ),
    
    # =========================================================================
    # ENERGY (PHQ-9: Fatigue)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.ENERGY,
        context_triggers=[
            "mentions_tired", "academic_stress", "after_sleep_discussion",
            "mentions_unmotivated", "monday_morning"
        ],
        probe_variations=[
            "Gimana energimu belakangan? Masih semangat atau lagi loyo?",
            "Akhir-akhir ini capek-capek terus atau masih ada tenaga?",
            "Kadang aku juga suka ngerasa exhausted. Kamu gimana?",
        ],
        follow_up_if_negative="Capek terus-terusan emang nguras banget. Udah coba istirahat?",
        information_goal="Detect persistent fatigue, distinguish from normal tiredness",
        priority=3,
    ),
    
    # =========================================================================
    # SOCIAL (UCLA Loneliness indicators)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.SOCIAL,
        context_triggers=[
            "mentions_alone", "weekend_discussion", "relationship_issues",
            "mentions_no_friends", "campus_life_discussion"
        ],
        probe_variations=[
            "Kalau di kampus, biasanya main sama siapa?",
            "Weekend kemarin ngapain? Ada hangout sama temen?",
            "Gimana circle pertemananmu? Masih sering ketemu nggak?",
            "Punya orang yang bisa diajak curhat nggak di sekitarmu?",
        ],
        follow_up_if_negative="Emang nggak mudah sih cari koneksi. Mau cerita lebih?",
        information_goal="Assess social support network, detect isolation patterns",
        priority=4,
    ),
    
    # =========================================================================
    # ACADEMIC (University-specific stress)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.ACADEMIC,
        context_triggers=[
            "mentions_kuliah", "mentions_tugas", "mentions_dosen",
            "exam_period", "thesis_discussion", "grade_discussion"
        ],
        probe_variations=[
            "Gimana kuliahnya? Lancar?",
            "Lagi banyak tugas nggak sekarang?",
            "Semester ini gimana? Ada yang bikin pusing?",
            "Skripsi/tugas akhirnya gimana progressnya?",
        ],
        follow_up_if_negative="Tekanan akademik emang real banget. Yang paling bikin overwhelmed apa?",
        information_goal="Understand academic pressure level, identify specific stressors",
        priority=4,
    ),
    
    # =========================================================================
    # APPETITE (PHQ-9: Appetite changes)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.APPETITE,
        context_triggers=[
            "deep_mood_discussion", "after_sleep_discussion",
            "mentions_stress_eating", "weight_discussion"
        ],
        probe_variations=[
            "Btw, makan teratur nggak belakangan ini?",
            "Kadang kalau lagi stress, nafsu makan juga ikut kacau ya. Kamu gimana?",
            "Udah makan hari ini?",
        ],
        follow_up_if_negative="Pola makan yang kacau kadang tanda tubuh lagi struggle. Udah berapa lama?",
        information_goal="Detect appetite changes (increase/decrease), eating disorders signs",
        priority=2,
    ),
    
    # =========================================================================
    # CONCENTRATION (PHQ-9: Difficulty concentrating)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.CONCENTRATION,
        context_triggers=[
            "academic_stress", "mentions_focus_issues",
            "exam_period", "after_sleep_discussion"
        ],
        probe_variations=[
            "Gimana fokusmu belakangan? Masih bisa konsen?",
            "Kadang susah nggak sih konsentrasi pas lagi banyak pikiran?",
            "Kalau lagi belajar, bisa fokus lama atau gampang ke-distract?",
        ],
        follow_up_if_negative="Susah fokus kadang bikin frustasi ya. Udah berapa lama kayak gitu?",
        information_goal="Assess cognitive function, detect concentration difficulties",
        priority=2,
    ),
    
    # =========================================================================
    # SELF-WORTH (Rosenberg Self-Esteem)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.SELF_WORTH,
        context_triggers=[
            "after_failure_discussion", "comparison_with_others",
            "self_criticism_detected", "imposter_syndrome_hints"
        ],
        probe_variations=[
            "Kamu suka terlalu keras sama diri sendiri nggak sih?",
            "Gimana sih kamu ngeliat diri sendiri belakangan ini?",
            "Kadang kita suka lupa appreciate diri sendiri. Kamu gimana?",
        ],
        follow_up_if_negative="Aku paham perasaan itu. Self-talk negatif emang berat. Boleh cerita lebih?",
        information_goal="Assess self-esteem, detect self-criticism patterns",
        priority=3,
    ),
    
    # =========================================================================
    # ANXIETY (GAD-7: Excessive worry)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.ANXIETY,
        context_triggers=[
            "mentions_worry", "future_discussion", "uncertainty",
            "exam_period", "decision_making"
        ],
        probe_variations=[
            "Sering overthinking nggak? Aku juga kadang gitu.",
            "Ada yang bikin khawatir belakangan ini?",
            "Kepalamu sering penuh sama 'what if' nggak?",
            "Gimana caramu handle kalau lagi cemas?",
        ],
        follow_up_if_negative="Khawatir terus-terusan emang melelahkan. Biasanya tentang apa yang paling sering?",
        information_goal="Assess anxiety levels, identify specific worry triggers",
        priority=4,
    ),
    
    # =========================================================================
    # HOPE (PHQ-9: Hopelessness - CRITICAL)
    # =========================================================================
    NaturalProbe(
        dimension=ScreeningDimension.HOPE,
        context_triggers=[
            "deep_mood_discussion", "after_negative_disclosure",
            "future_discussion", "mentions_giving_up"
        ],
        probe_variations=[
            "Gimana sih kamu ngeliat masa depanmu?",
            "Ada nggak yang kamu tunggu-tunggu dalam waktu dekat?",
            "Kalau setahun dari sekarang, kamu berharap ada di mana?",
        ],
        follow_up_if_negative=(
            "Aku dengerin. Kalau kamu pernah ngerasa nggak ada harapan, "
            "itu pasti berat banget. Boleh cerita lebih?"
        ),
        information_goal="Assess future outlook, detect hopelessness (suicide risk factor)",
        priority=5,
    ),
]


# =============================================================================
# INFORMATION GAP ANALYSIS
# =============================================================================

@dataclass
class DimensionStatus:
    """Status of information we have for a dimension."""
    dimension: ScreeningDimension
    last_assessed: Optional[datetime] = None
    confidence: float = 0.0         # 0-1, how confident we are in our info
    recent_indicators: List[str] = field(default_factory=list)
    needs_update: bool = True
    staleness_days: int = 0


@dataclass 
class ScreeningGapAnalysis:
    """Analysis of what information we're missing."""
    user_id: int
    dimension_statuses: Dict[str, DimensionStatus] = field(default_factory=dict)
    priority_gaps: List[ScreeningDimension] = field(default_factory=list)
    suggested_probe: Optional[NaturalProbe] = None
    last_probe_time: Optional[datetime] = None
    probes_this_session: int = 0
    
    # Affective Discordance (Unified Framework)
    discordance_level: str = "none" # none, low, medium, high
    discordance_reason: Optional[str] = None


async def analyze_screening_gaps(
    db: AsyncSession,
    user_id: int,
    conversation_history: List[Dict[str, str]],
    current_message: str,
    session_id: Optional[str] = None,
) -> ScreeningGapAnalysis:
    """Analyze what screening information we're missing for this user.
    
    This determines:
    1. Which dimensions have stale or missing information
    2. Which probe would be most appropriate given the conversation context
    3. Whether now is a good time to probe (based on conversation flow)
    4. Affective Discordance (Delta between self-report and AI detection)
    
    Args:
        db: Database session
        user_id: User ID
        conversation_history: Current conversation
        current_message: Latest user message
        session_id: Current session for tracking probe frequency
        
    Returns:
        ScreeningGapAnalysis with recommended probe
    """
    from app.domains.mental_health.models.assessments import UserScreeningProfile, ConversationRiskAssessment
    from app.domains.mental_health.models.journal import JournalEntry
    
    analysis = ScreeningGapAnalysis(user_id=user_id)
    
    # 1. Analyze Affective Discordance (Unified Framework)
    # Fetch latest self-report (Journal) and latest AI assessment
    latest_journal_stmt = (
        select(JournalEntry)
        .where(JournalEntry.user_id == user_id)
        .order_by(JournalEntry.entry_date.desc())
        .limit(1)
    )
    latest_assessment_stmt = (
        select(ConversationRiskAssessment)
        .where(ConversationRiskAssessment.user_id == user_id)
        .order_by(ConversationRiskAssessment.created_at.desc())
        .limit(1)
    )
    
    journal_res = await db.execute(latest_journal_stmt)
    assessment_res = await db.execute(latest_assessment_stmt)
    
    latest_journal = journal_res.scalar_one_or_none()
    latest_assessment = assessment_res.scalar_one_or_none()
    
    if latest_journal and latest_assessment and latest_journal.valence is not None and latest_assessment.pleasure is not None:
        # Calculate delta for Pleasure/Valence (-1 to 1 space)
        p_delta = abs(latest_journal.valence - latest_assessment.pleasure)
        a_delta = abs(latest_journal.arousal - latest_assessment.arousal) if (latest_journal.arousal is not None and latest_assessment.arousal is not None) else 0.0
        
        total_delta = (p_delta + a_delta) / 2
        
        if total_delta > 0.8:
            analysis.discordance_level = "high"
            analysis.discordance_reason = f"Significant gap: User reported {latest_journal.valence} pleasure but AI detected {latest_assessment.pleasure}."
        elif total_delta > 0.4:
            analysis.discordance_level = "medium"
            analysis.discordance_reason = "Moderate gap between self-report and detected sentiment (Masking possible)."
        elif total_delta > 0.2:
            analysis.discordance_level = "low"

    # 2. Fetch existing screening profile
    stmt = select(UserScreeningProfile).where(UserScreeningProfile.user_id == user_id)
    result = await db.execute(stmt)
    db_profile = result.scalar_one_or_none()
    
    profile_data = (db_profile.profile_data or {}) if db_profile else {}
    dimension_scores = profile_data.get("dimension_scores", {})
    
    # Map existing dimension data to our tracking dimensions
    # (screening_engine uses slightly different dimension names)
    dimension_mapping = {
        "depression": [ScreeningDimension.MOOD, ScreeningDimension.HOPE],
        "anxiety": [ScreeningDimension.ANXIETY],
        "stress": [ScreeningDimension.ACADEMIC],
        "sleep": [ScreeningDimension.SLEEP],
        "social": [ScreeningDimension.SOCIAL],
        "self_worth": [ScreeningDimension.SELF_WORTH],
    }
    
    now = datetime.utcnow()
    staleness_threshold = timedelta(days=7)  # Consider info stale after 7 days
    
    # Initialize all dimensions as needing update
    for dim in ScreeningDimension:
        analysis.dimension_statuses[dim.value] = DimensionStatus(
            dimension=dim,
            needs_update=True,
            confidence=0.0,
        )
    
    # Update status based on existing profile data
    for raw_dim, mapped_dims in dimension_mapping.items():
        if raw_dim in dimension_scores:
            score_data = dimension_scores[raw_dim]
            last_updated_str = score_data.get("last_updated")
            last_updated = None
            if last_updated_str:
                try:
                    last_updated = datetime.fromisoformat(last_updated_str.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
            
            for mapped_dim in mapped_dims:
                status = analysis.dimension_statuses[mapped_dim.value]
                status.last_assessed = last_updated
                status.confidence = min(1.0, score_data.get("indicator_count", 0) * 0.2)
                status.recent_indicators = score_data.get("last_indicators", [])
                
                if last_updated:
                    status.staleness_days = (now - last_updated).days
                    status.needs_update = (now - last_updated) > staleness_threshold
                else:
                    status.staleness_days = 999
                    status.needs_update = True
    
    # Determine priority gaps (dimensions needing updates, sorted by priority)
    priority_gaps = []
    for probe in NATURAL_PROBES:
        dim_status = analysis.dimension_statuses.get(probe.dimension.value)
        if dim_status and dim_status.needs_update:
            priority_gaps.append((probe.priority, probe.dimension))
    
    # Sort by priority (descending) then by staleness (descending)
    priority_gaps.sort(key=lambda x: (x[0], 
        analysis.dimension_statuses[x[1].value].staleness_days), reverse=True)
    
    analysis.priority_gaps = [gap[1] for gap in priority_gaps]
    
    # Determine if we should suggest a probe based on conversation context
    suggested_probe = _select_contextual_probe(
        gaps=analysis.priority_gaps,
        conversation_history=conversation_history,
        current_message=current_message,
    )
    
    analysis.suggested_probe = suggested_probe
    
    logger.debug(
        f"🔍 Gap analysis for user {user_id}: "
        f"gaps={[g.value for g in analysis.priority_gaps[:3]]}, "
        f"suggested_probe={suggested_probe.dimension.value if suggested_probe else 'none'}"
    )
    
    return analysis


def _select_contextual_probe(
    gaps: List[ScreeningDimension],
    conversation_history: List[Dict[str, str]],
    current_message: str,
) -> Optional[NaturalProbe]:
    """Select the most contextually appropriate probe.
    
    Considers:
    - What gaps exist
    - What the current conversation topic is
    - Whether now is a good moment to ask
    """
    if not gaps:
        return None
    
    # Build context from conversation
    message_lower = current_message.lower()
    recent_context = " ".join([
        msg.get("content", "").lower() 
        for msg in conversation_history[-3:]
    ])
    
    # Context triggers detection
    context_signals = {
        "greeting": any(w in message_lower for w in ["hai", "halo", "hi", "hello", "pagi", "siang", "malam"]),
        "how_are_you_response": any(w in message_lower for w in ["baik", "fine", "oke", "okay", "lumayan"]),
        "mentions_tired": any(w in message_lower for w in ["capek", "lelah", "tired", "exhausted", "lemas"]),
        "mentions_night": any(w in message_lower for w in ["malam", "tidur", "night", "sleep", "insomnia"]),
        "academic_stress": any(w in message_lower for w in ["tugas", "kuliah", "ujian", "skripsi", "dosen", "nilai", "deadline"]),
        "mentions_alone": any(w in message_lower for w in ["sendiri", "alone", "lonely", "kesepian"]),
        "mentions_worry": any(w in message_lower for w in ["khawatir", "worry", "cemas", "takut", "anxious"]),
        "after_mood_discussion": "perasaan" in recent_context or "mood" in recent_context,
        "after_negative_disclosure": any(w in recent_context for w in ["sedih", "stress", "susah", "berat"]),
        "transitional_moment": message_lower.endswith("?") or len(message_lower.split()) < 10,
    }
    
    # Find probes that match current context
    matching_probes = []
    for dim in gaps:
        for probe in NATURAL_PROBES:
            if probe.dimension == dim:
                # Check if any context triggers match
                matched_triggers = [
                    trigger for trigger in probe.context_triggers
                    if context_signals.get(trigger, False)
                ]
                if matched_triggers:
                    matching_probes.append((len(matched_triggers), probe.priority, probe))
    
    # Sort by: number of matching triggers (desc), then priority (desc)
    if matching_probes:
        matching_probes.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return matching_probes[0][2]
    
    # If no strong context match, return highest priority gap probe
    # but only if conversation seems open/casual
    if context_signals["transitional_moment"] or context_signals["greeting"]:
        for dim in gaps[:1]:  # Only try first gap
            for probe in NATURAL_PROBES:
                if probe.dimension == dim:
                    return probe
    
    return None


# =============================================================================
# SYSTEM PROMPT ENHANCEMENT
# =============================================================================

def generate_screening_guidance(
    gap_analysis: ScreeningGapAnalysis,
    max_probes_per_session: int = 3,
) -> str:
    """Generate screening guidance to add to Aika's system prompt.
    
    This gives Aika awareness of what to naturally explore without
    making her responses feel clinical.
    
    Args:
        gap_analysis: Results of gap analysis
        max_probes_per_session: Maximum probes per session to avoid fatigue
        
    Returns:
        Guidance text to append to system prompt
    """
    guidance_sections = []
    
    # 1. Affective Discordance (Layered Strategy)
    if gap_analysis.discordance_level != "none":
        discordance_text = f"""
## Unified Framework Awareness: Affective Discordance (INTERNAL)
**Discordance Level:** {gap_analysis.discordance_level}
**Reason:** {gap_analysis.discordance_reason}

**Instructions for Aika:**
"""
        if gap_analysis.discordance_level == "high":
            discordance_text += "- CRITICAL: User's self-report is significantly more positive than detected sentiment. Possible crisis masking.\n- STRATEGY: Use validating, deep-probing questions to explore the 'underlying' feelings."
        elif gap_analysis.discordance_level == "medium":
            discordance_text += "- STRATEGY: Gentle Inquiry. Acknowledge their positive report but tentatively mention the stressors they've discussed (e.g., 'You said you're doing okay, but I can feel how heavy these assignments are for you...')."
        else: # low
            discordance_text += "- STRATEGY: Silent Coaching. Be slightly more supportive/empathetic than usual, even if they claim to be fine."
            
        guidance_sections.append(discordance_text)

    # 2. Information Gaps
    if gap_analysis.suggested_probe and gap_analysis.probes_this_session < max_probes_per_session:
        probe = gap_analysis.suggested_probe
        import random
        probe_text = random.choice(probe.probe_variations)
        
        gap_text = f"""
## Screening Awareness (Information Gap - INTERNAL)
**Dimension:** {probe.dimension.value}
**Goal:** {probe.information_goal}

**If natural, you may ask:** "{probe_text}"
"""
        guidance_sections.append(gap_text)

    if not guidance_sections:
        return ""

    header = "\n# INTERNAL SYSTEM GUIDANCE (DO NOT MENTION TO USER)\n"
    footer = """
**IMPORTANT RULES:**
1. Only follow this if it fits naturally - don't force it.
2. Maintain your persona as a genuine, non-clinical friend.
3. If they seem uncomfortable, back off immediately.
4. Never mention "screening", "assessment", or "discordance".
5. If they're in crisis, skip gathering info and focus on immediate safety.
"""
    return header + "\n".join(guidance_sections) + footer


# =============================================================================
# RESPONSE ENHANCEMENT
# =============================================================================

async def enhance_response_with_probe(
    base_response: str,
    gap_analysis: ScreeningGapAnalysis,
    conversation_history: List[Dict[str, str]],
    preferred_model: Optional[str] = None,
) -> Tuple[str, bool]:
    """Enhance Aika's response with a natural screening probe if appropriate.
    
    This is called AFTER Aika generates her response, to optionally add
    a natural probe at the end.
    
    Args:
        base_response: Aika's original response
        gap_analysis: Gap analysis results
        conversation_history: Conversation context
        preferred_model: LLM model to use
        
    Returns:
        Tuple of (enhanced_response, probe_added)
    """
    if not gap_analysis.suggested_probe:
        return base_response, False
    
    # Don't add probe if response is already asking a question
    if base_response.rstrip().endswith("?"):
        return base_response, False
    
    # Don't add probe if response is about crisis/serious topic
    crisis_keywords = ["crisis", "darurat", "bunuh", "suicide", "hotline", "bantuan"]
    if any(kw in base_response.lower() for kw in crisis_keywords):
        return base_response, False
    
    probe = gap_analysis.suggested_probe
    import random
    probe_text = random.choice(probe.probe_variations)
    
    # Simple append with natural transition
    transitions = [
        "\n\nOh ya btw,",
        "\n\nBtw,",
        "\n\nOh iya,",
        "\n\nSekalian mau tanya,",
    ]
    transition = random.choice(transitions)
    
    # Only add if probe is short enough to not overwhelm
    if len(probe_text) < 80:
        enhanced = f"{base_response}{transition} {probe_text}"
        return enhanced, True
    
    return base_response, False


# =============================================================================
# INTEGRATION FUNCTION
# =============================================================================

async def get_screening_aware_prompt_addition(
    db: AsyncSession,
    user_id: int,
    conversation_history: List[Dict[str, str]],
    current_message: str,
    session_id: Optional[str] = None,
) -> Tuple[str, ScreeningGapAnalysis]:
    """Get screening-aware addition to Aika's system prompt.
    
    Call this before generating Aika's response to give her awareness
    of what information would be valuable to naturally explore.
    
    Args:
        db: Database session
        user_id: User ID
        conversation_history: Current conversation
        current_message: Latest user message
        session_id: Session ID for tracking
        
    Returns:
        Tuple of (prompt_addition, gap_analysis)
    """
    gap_analysis = await analyze_screening_gaps(
        db=db,
        user_id=user_id,
        conversation_history=conversation_history,
        current_message=current_message,
        session_id=session_id,
    )
    
    prompt_addition = generate_screening_guidance(gap_analysis)
    
    return prompt_addition, gap_analysis
