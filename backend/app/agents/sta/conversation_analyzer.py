"""STA Conversation-Level Risk Analyzer.

This module performs deep analysis of entire conversations (not individual messages)
to identify risk patterns, trends, and user context. Runs ONLY at conversation end.

Now also performs SCREENING EXTRACTION (merged from TCA) to capture mental health
dimension scores in a single LLM call, avoiding redundant API calls.
"""
import logging
import time
import json
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.agents.sta.conversation_assessment import (
    ConversationAssessment,
    ScreeningExtraction,
    ScreeningDimensionScore
)
from app.core.llm import generate_gemini_response_with_fallback, DEFAULT_GEMINI_MODEL

logger = logging.getLogger(__name__)


async def analyze_conversation_risk(
    conversation_history: List[Dict[str, str]],
    current_message: str,
    user_context: Dict[str, Any] = None,
    conversation_start_time: float = None,
    preferred_model: str = None
) -> ConversationAssessment:
    """Perform comprehensive conversation-level risk analysis.
    
    This is the Tier 2 analysis that runs ONCE at conversation end to assess
    overall risk trends and patterns with full conversational context.
    
    Args:
        conversation_history: List of previous messages in format:
            [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
        current_message: Latest user message (the ending message)
        user_context: Additional user data (wellness state, profile) if available
        conversation_start_time: Unix timestamp of conversation start (for duration calc)
        preferred_model: Gemini model to use (defaults to DEFAULT_GEMINI_MODEL)
    
    Returns:
        ConversationAssessment with comprehensive risk evaluation
    
    Raises:
        ValueError: If conversation_history is empty
        json.JSONDecodeError: If Gemini returns invalid JSON
    """
    if not conversation_history:
        raise ValueError("Cannot analyze empty conversation")
    
    # Build full conversation text (last 30 messages for context)
    recent_history = conversation_history[-30:] if len(conversation_history) > 30 else conversation_history
    
    conversation_text = "\n\n".join([
        f"{'User' if msg['role'] == 'user' else 'Aika'}: {msg['content']}"
        for msg in recent_history
    ])
    conversation_text += f"\n\nUser: {current_message}"
    
    # Calculate conversation duration
    duration = time.time() - conversation_start_time if conversation_start_time else 0.0
    
    # Build analysis prompt with integrated screening extraction
    analysis_prompt = f"""
You are a clinical mental health analyst reviewing a complete conversation between a university student and Aika (AI mental health assistant).

CONVERSATION HISTORY ({len(conversation_history) + 1} total messages, duration: {duration:.0f}s):
{'='*80}
{conversation_text}
{'='*80}

TASK: Perform DUAL-PURPOSE analysis - both RISK ASSESSMENT and SCREENING EXTRACTION

==============================================================================
PART 1: RISK ASSESSMENT (Clinical Safety Analysis)
==============================================================================

1. OVERALL RISK LEVEL: Considering all messages together, what is the overall mental health risk?
   - low: General stress, manageable challenges
   - moderate: Significant distress, concerning patterns emerging
   - high: Serious risk indicators, needs professional intervention soon
   - critical: Immediate danger, crisis intervention required NOW

2. RISK TREND: How did the user's state change throughout the conversation?
   - stable: Consistent emotional state throughout
   - escalating: User's distress increased during conversation
   - de-escalating: User's state improved with support
   - insufficient_data: Too few messages to determine trend

3. CONVERSATION SUMMARY: What were the main themes and concerns? (2-3 sentences)

4. USER CONTEXT: Extract specific information about:
   - recent_stressors: What problems/challenges are they facing?
   - coping_mechanisms: How do they currently handle stress?
   - protective_factors: What positive supports do they have?

5. CONCERNS: What specific patterns are worrying? (e.g., "sleep deprivation for 3 days", "social withdrawal")

6. RECOMMENDED ACTIONS: What specific interventions would help? (e.g., "CBT for anxiety", "sleep hygiene plan")

7. CASE MANAGEMENT: Does this require immediate human counselor involvement?
   - true if: Critical risk, escalating pattern with high severity, user requests human help
   - false if: Manageable with AI support, user improving, low-moderate stable risk

8. AFFECTIVE STATE (PAD Model): Extract numerical coordinates for the user's emotional state based on the conversation context:
   - pleasure: -1.0 (very negative) to 1.0 (very positive)
   - arousal: -1.0 (very calm/dull) to 1.0 (highly excited/tense)
   - dominance: -1.0 (powerless/overwhelmed) to 1.0 (in control/empowered)

==============================================================================
PART 2: SCREENING EXTRACTION (Covert Mental Health Profiling)
==============================================================================

Extract mental health indicators for these 9 dimensions (only include if present):

SCREENING DIMENSIONS (Based on validated instruments):
- depression: PHQ-9 domains - Mood, anhedonia, hopelessness, fatigue
- anxiety: GAD-7 domains - Excessive worry, tension, panic, physical symptoms
- stress: DASS-21 - Overwhelm, burnout, pressure, inability to cope
- sleep: PSQI - Insomnia, nightmares, fatigue, poor sleep quality
- social: UCLA Loneliness - Isolation, loneliness, relationship issues, withdrawal
- academic: University-specific - Academic pressure, fear of failure, thesis stress
- self_worth: Rosenberg - Low self-esteem, self-criticism, worthlessness
- substance: AUDIT/DAST - Alcohol/drug use for coping
- crisis: CRITICAL - Self-harm, suicidal ideation (flag IMMEDIATELY if detected)

For each dimension present in the conversation, provide:
- score: 0.0-1.0 (0=none, 0.3=mild, 0.5=moderate, 0.7=severe, 1.0=critical)
- evidence: 1-3 brief quotes or paraphrases supporting this score
- is_protective: true if this dimension shows POSITIVE factors (e.g., good sleep, social support)

IMPORTANT FOR SCREENING:
- Be conservative - only flag clear indicators
- Consider Indonesian cultural context (e.g., "banyak pikiran" = overthinking)
- Understand sarcasm and joking (don't over-flag)
- Empty/null for dimensions not mentioned in conversation
- Protective factors are equally important to track

==============================================================================
RETURN FORMAT
==============================================================================

Return ONLY valid JSON (no markdown, no code blocks):
{{
  "overall_risk_level": "low|moderate|high|critical",
  "risk_trend": "stable|escalating|de-escalating|insufficient_data",
  "conversation_summary": "2-3 sentence summary of main themes and user state",
  "user_context": {{
    "recent_stressors": ["specific stressor 1", "specific stressor 2"],
    "coping_mechanisms": ["coping method 1", "coping method 2"],
    "protective_factors": ["support 1", "support 2"]
  }},
  "protective_factors": ["Detailed protective factor 1", "Detailed protective factor 2"],
  "concerns": ["Specific concern 1", "Specific concern 2"],
  "recommended_actions": ["Specific action 1", "Specific action 2"],
  "should_invoke_cma": true or false,
  "reasoning": "Detailed chain-of-thought explanation: Why this risk level? Why this trend? Why CMA decision?",
  "pleasure": 0.0,
  "arousal": 0.0,
  "dominance": 0.0,
  "screening": {{
    "depression": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "anxiety": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "stress": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "sleep": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "social": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "academic": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "self_worth": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "substance": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "crisis": {{"score": 0.0-1.0, "evidence": ["quote 1"], "is_protective": false}},
    "protective_dimensions": ["dimension1", "dimension2"]
  }},
  "crisis_detected": true or false
}}

NOTES:
- Only include screening dimensions that have evidence in the conversation
- null/omit dimensions with no relevant content
- crisis_detected should be true if crisis dimension score > 0.5 OR explicit self-harm/suicide mentions
- Be thorough but concise. Focus on actionable clinical insights.
"""
    
    model = preferred_model or DEFAULT_GEMINI_MODEL
    logger.info(
        f"🔍 STA analyzing full conversation "
        f"({len(conversation_history) + 1} messages, {duration:.0f}s duration)"
    )
    
    start_time = time.time()
    
    try:
        response_text = await generate_gemini_response_with_fallback(
            history=[{"role": "user", "content": analysis_prompt}],
            model=model,
            temperature=0.2,  # Low temp for consistent clinical analysis
            max_tokens=4096
        )

        if not isinstance(response_text, str) or not response_text.strip():
            raise ValueError("STA analyzer received an empty response from the LLM")

        if response_text.lstrip().startswith("Error:"):
            raise ValueError(f"STA analyzer LLM error: {response_text}")
        
        # Clean markdown code blocks if present
        response_text = re.sub(r'^```json\s*', '', response_text.strip())
        response_text = re.sub(r'\s*```$', '', response_text.strip())
        
        assessment_data = json.loads(response_text)
        
        # Parse screening extraction data
        screening_data = assessment_data.pop("screening", None)
        screening_extraction = None
        
        if screening_data:
            # Build ScreeningExtraction from parsed data
            dimension_scores = {}
            for dim in ["depression", "anxiety", "stress", "sleep", "social", 
                       "academic", "self_worth", "substance", "crisis"]:
                dim_data = screening_data.get(dim)
                if dim_data and isinstance(dim_data, dict):
                    dimension_scores[dim] = ScreeningDimensionScore(
                        score=dim_data.get("score", 0.0),
                        evidence=dim_data.get("evidence", []),
                        is_protective=dim_data.get("is_protective", False)
                    )
            
            screening_extraction = ScreeningExtraction(
                **dimension_scores,
                protective_dimensions=screening_data.get("protective_dimensions", [])
            )
        
        # Extract crisis_detected from response
        crisis_detected = assessment_data.pop("crisis_detected", False)
        
        # Create assessment object
        assessment = ConversationAssessment(
            **assessment_data,
            message_count_analyzed=len(conversation_history) + 1,
            analysis_timestamp=datetime.utcnow(),
            conversation_duration_seconds=duration,
            screening=screening_extraction,
            crisis_detected=crisis_detected
        )
        
        analysis_time_ms = (time.time() - start_time) * 1000
        
        # Count extracted screening dimensions
        screening_dims = 0
        if assessment.screening:
            for dim in ["depression", "anxiety", "stress", "sleep", "social",
                       "academic", "self_worth", "substance", "crisis"]:
                if getattr(assessment.screening, dim, None) is not None:
                    screening_dims += 1
        
        logger.info(
            f"✅ STA+Screening analysis complete: "
            f"risk={assessment.overall_risk_level}, "
            f"trend={assessment.risk_trend}, "
            f"cma={assessment.should_invoke_cma}, "
            f"screening_dims={screening_dims}, "
            f"crisis={assessment.crisis_detected}, "
            f"time={analysis_time_ms:.0f}ms"
        )
        
        return assessment
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse STA assessment JSON: {e}")
        logger.debug(f"Raw response: {response_text[:500]}...")
        raise
    except Exception as e:
        logger.error(f"STA conversation analysis failed: {e}", exc_info=True)
        raise
