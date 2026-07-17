"""
Gemini-powered Therapeutic Coach Plan Generator

This module uses Gemini AI to generate hyper-personalized support plans
based on user context, intent, and support plan type.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.core import llm
from app.core.llm import generate_gemini_response_with_fallback
from app.agents.tca.schemas import PlanStep, ResourceCard

logger = logging.getLogger(__name__)


async def generate_gemini_response(**kwargs: Any) -> str:
    """Generate a Gemini response.

    This thin wrapper exists so unit tests can monkeypatch a stable symbol
    without needing to reach into lower-level LLM plumbing.
    """
    return await generate_gemini_response_with_fallback(**kwargs)


# System prompts for different plan types
CALM_DOWN_SYSTEM_PROMPT = """Kamu adalah coach kesehatan mental yang expert dalam manajemen anxiety dan panic. Peran kamu adalah bantuin user untuk calm down ketika mereka experiencing anxiety, panic, atau stress yang overwhelming.

Generate personalized support plan dengan 3-5 langkah spesifik dan actionable yang:
1. Bantu grounding user di present moment
2. Kurangi gejala fisiologis (jantung berdebar, napas cepat, dll.)
3. Kasih teknik coping yang immediate
4. Culturally sensitive dengan konteks Indonesia/Asia
5. Pakai bahasa yang clear, compassionate, non-clinical

CRITICAL EVALUATION CRITERIA (MUST FOLLOW):
1. SAFETY (Score 5/5): Pastikan semua teknik aman. Jangan pernah kasih saran berbahaya.
2. ACTIONABILITY (Score 5/5): HINDARI saran vague ("Tenang saja"). Berikan langkah KONKRET & EVIDENCE-BASED (misal: "Teknik 5-4-3-2-1", "Box Breathing"). Jelaskan CARA melakukannya.
3. EMPATHY (Score 5/5): Gunakan nada yang VALIDATING & HANGAT. Validasi perasaan user ("Wajar kamu merasa panik...").
4. RELEVANCE (Score 5/5): Address LANGSUNG detail situasi user. Jangan generik.

REQUIREMENTS PENTING:
- Setiap step harus immediately actionable (nggak vague)
- Include durasi waktu spesifik (misal "5 menit", "3 napas dalam")
- Pakai tone yang warm dan encouraging
- Hindari jargon medis
- Consider situasi spesifik dan context user

Output format (JSON):
{
  "plan_steps": [
    {"title": "Tarik napas dalam", "description": "Tarik napas dalam 5 kali - hirup 4 hitungan, tahan 4, hembuskan 6", "duration_min": 2},
    {"title": "Grounding", "description": "Sebutin 5 hal yang kamu lihat sekarang untuk grounding diri", "duration_min": 3}
  ],
  "resource_cards": [
    {"title": "Latihan Napas Terpandu", "description": "Follow pola napas yang calming", "url": "https://aicare.example/calm/breathing"}
  ],
  "next_check_in": {
    "timeframe": "1 jam",
    "method": "chat"
  }
}
"""

BREAK_DOWN_PROBLEM_SYSTEM_PROMPT = """Kamu adalah coach problem-solving yang expert dalam break down masalah kompleks dan overwhelming jadi langkah-langkah yang manageable. Peran kamu adalah bantuin user yang merasa stuck, overwhelmed, atau nggak tau harus mulai dari mana dengan tantangan mereka.

Generate personalized support plan dengan 4-6 langkah spesifik yang:
1. Bantu identifikasi core problem dengan jelas
2. Break down masalah besar jadi potongan-potongan kecil yang manageable
3. Prioritize apa yang harus ditackle duluan
4. Kasih concrete next actions
5. Build momentum dan confidence
6. Culturally sensitive dengan konteks Indonesia/Asia

CRITICAL EVALUATION CRITERIA (MUST FOLLOW):
1. SAFETY (Score 5/5): Pastikan langkah-langkah aman dan tidak membahayakan user.
2. ACTIONABILITY (Score 5/5): HINDARI saran vague. Berikan langkah KONKRET & EVIDENCE-BASED (teknik "Chunking", "Eisenhower Matrix"). Jelaskan CARA melakukannya.
3. EMPATHY (Score 5/5): Gunakan nada yang VALIDATING & HANGAT. Validasi perasaan overwhelmed user ("Wajar merasa berat dengan beban ini...").
4. RELEVANCE (Score 5/5): Address LANGSUNG detail masalah user. Jangan generik.

REQUIREMENTS PENTING:
- Mulai dengan clarity: bantu user define apa yang mereka hadapi
- Pakai teknik "chunking" untuk break down complexity
- Prioritize steps secara logis (urgent/important first)
- Bikin setiap step spesifik dan achievable
- Include thinking steps dan action steps
- Kasih encouragement dan normalisasi feeling overwhelmed
- Pakai bahasa yang warm dan non-judgmental

Output format (JSON):
{
  "plan_steps": [
    {"title": "Definisikan Masalah", "description": "Tulis concern utama kamu dalam satu kalimat", "duration_min": 3},
    {"title": "Pecah Masalah", "description": "List 3 bagian kecil dari masalah ini yang bisa kamu kerjain terpisah", "duration_min": 5},
    {"title": "Mulai Kecil", "description": "Pilih bagian yang paling gampang untuk mulai hari ini", "duration_min": 2}
  ],
  "resource_cards": [
    {"title": "Worksheet Problem Solving", "description": "Template terstruktur untuk break down tantangan", "url": "https://aicare.example/tools/problem-solving"}
  ],
  "next_check_in": {
    "timeframe": "Besok pagi",
    "method": "chat"
  }
}
"""

GENERAL_COPING_SYSTEM_PROMPT = """Kamu adalah coach kesehatan mental yang expert dalam kasih strategi coping umum untuk stress management. Peran kamu adalah bantuin user develop mekanisme coping yang healthy dan resilience skills.

Generate personalized support plan dengan 3-5 langkah yang:
1. Address stressor spesifik user (akademik, relationship, finansial, dll.)
2. Kasih immediate relief dan longer-term coping strategies
3. Include self-care dan support-seeking actions
4. Build on existing strengths user
5. Culturally sensitive dengan konteks Indonesia/Asia

CRITICAL EVALUATION CRITERIA (MUST FOLLOW):
1. SAFETY (Score 5/5): Pastikan coping mechanism aman dan sehat.
2. ACTIONABILITY (Score 5/5): HINDARI saran vague ("Jangan stress"). Berikan langkah KONKRET & EVIDENCE-BASED (misal: "Journaling", "Progressive Muscle Relaxation"). Jelaskan CARA melakukannya.
3. EMPATHY (Score 5/5): Gunakan nada yang VALIDATING & HANGAT. Validasi perasaan user ("Sangat wajar kamu merasa tertekan...").
4. RELEVANCE (Score 5/5): Address LANGSUNG detail stressor user. Jangan generik.

REQUIREMENTS PENTING:
- Balance immediate relief dengan sustainable coping
- Include active coping (problem-focused) dan emotion-focused strategies
- Encourage social support kalau appropriate
- Promote self-compassion dan normalize struggles
- Pakai bahasa yang warm dan empowering
- Hindari toxic positivity - validasi feelings mereka dulu

Output format (JSON):
{
  "plan_steps": [
    {"title": "Self-Care", "description": "Ambil 10 menit untuk self-care - lakukan satu hal yang kamu enjoy", "duration_min": 10},
    {"title": "Refleksi Positif", "description": "Tulis satu hal yang udah kamu handle dengan baik recently", "duration_min": 3}
  ],
  "resource_cards": [
    {"title": "Strategi Coping yang Healthy", "description": "Teknik evidence-based untuk manage stress", "url": "https://aicare.example/coping/strategies"}
  ],
  "next_check_in": {
    "timeframe": "2 hari lagi",
    "method": "chat"
  }
}
"""

COGNITIVE_RESTRUCTURING_SYSTEM_PROMPT = """Kamu adalah coach Cognitive Behavioral Therapy (CBT) yang expert dalam cognitive restructuring. Peran kamu adalah bantuin user identify dan challenge pola pikir yang nggak helpful dengan examine bukti dan develop perspektif yang lebih balanced.

Generate personalized CBT-based plan dengan 4-6 langkah yang follow cognitive restructuring framework:
1. Identify situasi yang trigger distress
2. Recognize automatic negative thoughts
3. Label emosi yang dirasakan
4. Examine evidence for dan against the thought
5. Generate alternative thoughts yang lebih balanced
6. Re-evaluate emotions setelah reframing

CRITICAL EVALUATION CRITERIA (MUST FOLLOW):
1. SAFETY (Score 5/5): Pastikan proses reframing aman dan tidak invalidating trauma.
2. ACTIONABILITY (Score 5/5): HINDARI saran vague. Berikan langkah KONKRET & EVIDENCE-BASED (teknik "Thought Record", "Socratic Questioning"). Jelaskan CARA melakukannya.
3. EMPATHY (Score 5/5): Gunakan nada yang VALIDATING & HANGAT. Validasi perasaan user sebelum menantang pikiran mereka.
4. RELEVANCE (Score 5/5): Address LANGSUNG detail pikiran/situasi user. Jangan generik.

PRINSIP CBT PENTING:
- Guide Socratic questioning (jangan tell, tapi ask)
- Bantu user discover evidence mereka sendiri
- Validasi feelings sambil challenge thoughts
- Pakai teknik CBT "thought record"
- Encourage contoh yang spesifik dan konkret
- Focus pada realistic thinking, bukan positive thinking
- Culturally sensitive dengan konteks Indonesia
- Pakai bahasa yang warm dan collaborative

Output format (JSON):
{
  "plan_steps": [
    {"title": "Situasi", "description": "Describe situasi yang bikin kamu upset dalam 2-3 kalimat", "duration_min": 3},
    {"title": "Pikiran Otomatis", "description": "Apa thought yang langsung muncul? Tulis persis seperti yang kamu pikirkan", "duration_min": 2},
    {"title": "Emosi", "description": "Sebutin emosi yang kamu rasakan: cemas, sedih, marah, frustrasi, malu?", "duration_min": 2},
    {"title": "Bukti", "description": "Cari bukti: Fakta apa yang support thought ini? Fakta apa yang contradict?", "duration_min": 5},
    {"title": "Perspektif Baru", "description": "Bikin thought yang lebih balanced yang consider semua bukti", "duration_min": 4},
    {"title": "Evaluasi Ulang", "description": "Gimana perasaan kamu sekarang dengan perspektif baru ini? Rate 0-10", "duration_min": 2}
  ],
  "resource_cards": [
    {"title": "Jebakan Pikiran yang Umum", "description": "Kenali pola seperti all-or-nothing thinking, catastrophizing, mind-reading", "url": "https://aicare.example/cbt/thinking-traps"}
  ],
  "next_check_in": {
    "timeframe": "Besok sore",
    "method": "chat"
  }
}
"""

BEHAVIORAL_ACTIVATION_SYSTEM_PROMPT = """Kamu adalah coach Cognitive Behavioral Therapy (CBT) yang expert dalam behavioral activation untuk depression dan low motivation. Peran kamu adalah bantuin user break the cycle of inactivity dan avoidance dengan schedule dan complete aktivitas kecil yang meaningful.

Generate personalized CBT-based plan dengan 3-5 langkah yang follow behavioral activation principles:
1. Identify values dan apa yang penting buat user
2. Pilih aktivitas kecil dan achievable yang aligned dengan values
3. Schedule waktu spesifik untuk aktivitas
4. Break aktivitas jadi tiny steps kalau perlu
5. Track mood sebelum dan sesudah aktivitas

CRITICAL EVALUATION CRITERIA (MUST FOLLOW):
1. SAFETY (Score 5/5): Pastikan aktivitas aman dilakukan user.
2. ACTIONABILITY (Score 5/5): HINDARI saran vague ("Coba aktif"). Berikan langkah KONKRET & EVIDENCE-BASED (teknik "Activity Scheduling", "Graded Task Assignment"). Jelaskan CARA melakukannya.
3. EMPATHY (Score 5/5): Gunakan nada yang VALIDATING & HANGAT. Validasi betapa sulitnya memulai aktivitas saat depresi/low motivation.
4. RELEVANCE (Score 5/5): Address LANGSUNG detail minat/situasi user. Jangan generik.

PRINSIP BEHAVIORAL ACTIVATION PENTING:
- Mulai dengan aktivitas yang user DULU enjoy atau find meaningful
- Bikin aktivitas SPESIFIK dan SCHEDULED (bukan vague goals)
- Emphasize action SEBELUM motivation (action creates motivation)
- Focus pada aktivitas berbasis VALUES, bukan cuma pleasant ones
- Pakai activity monitoring untuk tunjukkan mood-behavior connection
- Celebrate action APAPUN, no matter how small
- Culturally sensitive dengan konteks Indonesia
- Pakai bahasa yang encouraging dan non-judgmental

Output format (JSON):
{
  "plan_steps": [
    {"title": "Identifikasi", "description": "Sebutin satu hal yang dulu bring you joy atau meaning sebelum kamu merasa kayak gini", "duration_min": 3},
    {"title": "Sederhanakan", "description": "Pilih versi paling kecil dari aktivitas itu yang bisa kamu lakukan hari ini (15 menit max)", "duration_min": 4},
    {"title": "Jadwalkan", "description": "Schedule: Tulis exactly kapan dan di mana kamu akan lakuin hari ini", "duration_min": 2},
    {"title": "Rate Mood Awal", "description": "Sebelum mulai, rate mood kamu 1-10. Terus lakukan aktivitasnya", "duration_min": 15},
    {"title": "Rate Mood Akhir", "description": "Setelah selesai, rate mood kamu lagi. Notice perubahan apapun", "duration_min": 2}
  ],
  "resource_cards": [
    {"title": "Breaking the Inactivity Cycle", "description": "Gimana small actions boost mood dan motivation", "url": "https://aicare.example/cbt/activation"}
  ],
  "next_check_in": {
    "timeframe": "Nanti malam",
    "method": "chat"
  }
}
"""


def _get_system_prompt(plan_type: str) -> str:
    """Get appropriate system prompt based on plan type."""
    prompts = {
        "calm_down": CALM_DOWN_SYSTEM_PROMPT,
        "break_down_problem": BREAK_DOWN_PROBLEM_SYSTEM_PROMPT,
        "general_coping": GENERAL_COPING_SYSTEM_PROMPT,
        "cognitive_restructuring": COGNITIVE_RESTRUCTURING_SYSTEM_PROMPT,
        "behavioral_activation": BEHAVIORAL_ACTIVATION_SYSTEM_PROMPT,
    }
    return prompts.get(plan_type, GENERAL_COPING_SYSTEM_PROMPT)


def _build_user_prompt(
    user_message: str,
    intent: str,
    plan_type: str,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """Build personalized user prompt with context."""
    from app.agents.tca.activities_catalog import get_all_activities_prompt_context
    
    prompt_parts = [
        f"USER'S MESSAGE: \"{user_message}\"\n",
        f"DETECTED INTENT: {intent}\n",
        f"PLAN TYPE NEEDED: {plan_type}\n",
    ]
    
    if context:
        if context.get("risk_level"):
            prompt_parts.append(f"RISK LEVEL: {context['risk_level']}/3\n")
        if context.get("previous_sessions"):
            prompt_parts.append(f"PREVIOUS SESSIONS: User has {context['previous_sessions']} prior support sessions\n")
        if context.get("demographics"):
            demo = context['demographics']
            if demo.get("age"):
                prompt_parts.append(f"USER AGE: {demo['age']} years old\n")
            if demo.get("student_status"):
                prompt_parts.append(f"STUDENT STATUS: {demo['student_status']}\n")
    
    # Include available interactive activities
    prompt_parts.append("\n" + get_all_activities_prompt_context() + "\n")
    
    prompt_parts.append("\nBased on the above information, generate a hyper-personalized support plan that directly addresses this user's specific situation.")
    prompt_parts.append("\nPRIORITIZE including 1-2 interactive activities in resource_cards when relevant (breathing for anxiety, grounding for panic).")
    prompt_parts.append("\nIMPORTANT: Respond ONLY with valid JSON in the exact format specified. No additional text or explanation.")
    
    return "".join(prompt_parts)


async def generate_personalized_plan(
    user_message: str,
    intent: str,
    plan_type: str,
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate hyper-personalized support plan using Gemini AI.
    
    Args:
        user_message: The user's original message
        intent: Detected intent from STA (e.g., "academic_stress")
        plan_type: Type of plan needed ("calm_down", "break_down_problem", "general_coping")
        context: Optional additional context (risk_level, demographics, history, etc.)
    
    Returns:
        Dict with plan_steps and resource_cards
        
    Raises:
        Exception: If Gemini API fails or returns invalid response
    """
    response_text = ""  # Initialize to avoid unbound variable error
    
    try:
        logger.info(f"Generating personalized plan: type={plan_type}, intent={intent}")
        
        # Get appropriate system prompt
        system_prompt = _get_system_prompt(plan_type)
        
        # Build user prompt with context
        user_prompt = _build_user_prompt(user_message, intent, plan_type, context)
        
        logger.debug(f"User prompt: {user_prompt[:200]}...")
        
        # Call Google SDK model - use Gemma 4 31B for complex reasoning with fallback on quota/rate limits
        response_text = await generate_gemini_response(
            history=[{"role": "user", "content": user_prompt}],
            model=getattr(llm, "GEMINI_PRO_MODEL", "gemma-4-31b-it"),
            max_tokens=2048,
            temperature=0.7,  # Balance between creativity and consistency
            system_prompt=system_prompt,
            return_full_response=False
        )
        
        logger.debug(f"Gemini raw response: {response_text[:200]}...")
        
        # Try to extract JSON if wrapped in markdown code blocks
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        parsed_response = json.loads(response_text)
        
        # Validate response structure
        if "plan_steps" not in parsed_response:
            logger.error("Gemini response missing 'plan_steps'")
            raise ValueError("Invalid response structure from Gemini")
        
        if "resource_cards" not in parsed_response:
            # Provide default resource cards if missing
            parsed_response["resource_cards"] = _get_default_resources(intent)
        
        logger.info(f"Successfully generated plan with {len(parsed_response['plan_steps'])} steps")
        
        return parsed_response
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini JSON response: {e}\nResponse: {response_text}")
        
        # Attempt to repair truncated JSON (Cost-effective failsafe)
        repaired_plan = _repair_truncated_json(response_text, intent)
        if repaired_plan:
            return repaired_plan
            
        # Fallback to static plan
        return _get_fallback_plan(plan_type, intent)
    except Exception as e:
        logger.error(f"Error generating personalized plan with Gemini: {e}", exc_info=True)
        # Fallback to static plan
        return _get_fallback_plan(plan_type, intent)


def _repair_truncated_json(response_text: str, intent: str) -> Optional[Dict[str, Any]]:
    """
    Attempts to salvage valid data from a truncated JSON response.
    Common case: 'plan_steps' is complete but 'resource_cards' is cut off.
    """
    try:
        import re
        # Find the start of plan_steps array
        match = re.search(r'"plan_steps"\s*:\s*\[', response_text)
        if not match:
            return None
            
        start_pos = match.end() - 1 # Point to the '['
        
        # Stack-based parser to find the matching closing bracket
        stack = []
        end_pos = -1
        
        # Iterate through the string to find the balancing ']'
        # We need to be careful about brackets inside strings, but for a simple failsafe 
        # on this specific schema, a simple counter often suffices if we assume no '[' in the content text.
        # However, to be safe, let's just try to parse incrementally if we can't find a clean break.
        
        # Better approach for this specific schema:
        # The plan_steps array is a list of objects. We can try to find the last closing '},' or '}' 
        # before the truncation happens.
        
        current_pos = start_pos
        balance = 0
        in_string = False
        escape = False
        
        for i in range(start_pos, len(response_text)):
            char = response_text[i]
            
            if escape:
                escape = False
                continue
                
            if char == '\\':
                escape = True
                continue
                
            if char == '"':
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '[':
                    balance += 1
                elif char == ']':
                    balance -= 1
                    if balance == 0:
                        end_pos = i + 1
                        break
        
        if end_pos != -1:
            # We found a complete list!
            plan_steps_str = response_text[start_pos:end_pos]
            try:
                plan_steps = json.loads(plan_steps_str)
                if isinstance(plan_steps, list) and len(plan_steps) > 0:
                    logger.info(f"✅ Successfully salvaged {len(plan_steps)} plan steps from truncated response")
                    return {
                        "plan_steps": plan_steps,
                        "resource_cards": _get_default_resources(intent)
                    }
            except json.JSONDecodeError:
                pass
        
        # If we couldn't find the closing ']', maybe we can salvage the items we have so far?
        # This is more complex, but let's try a simple heuristic:
        # Find the last occurrence of "}," inside the array and close it with "]"
        
        # Limit search to a reasonable window to avoid scanning huge garbage
        search_window = response_text[start_pos:]
        last_object_end = search_window.rfind('}')
        
        if last_object_end != -1:
            # Construct a candidate list string: [ ... } ]
            candidate_str = search_window[:last_object_end+1] + "]"
            try:
                plan_steps = json.loads(candidate_str)
                if isinstance(plan_steps, list) and len(plan_steps) > 0:
                    logger.info(f"✅ Successfully salvaged {len(plan_steps)} plan steps (partial list) from truncated response")
                    return {
                        "plan_steps": plan_steps,
                        "resource_cards": _get_default_resources(intent)
                    }
            except json.JSONDecodeError:
                pass

        return None
    except Exception as e:
        logger.warning(f"Failed to repair truncated JSON: {e}")
        return None


def _get_default_resources(intent: str) -> List[Dict[str, Any]]:
    """Get default resource cards based on intent, including interactive activities."""
    from app.agents.tca.resources import get_default_resources
    from app.agents.tca.activities_catalog import get_recommended_activities
    
    resources = []
    
    # Add recommended interactive activities first (priority)
    activities = get_recommended_activities(intent, max_activities=2)
    resources.extend(activities)
    
    # Add traditional resource links
    resource_objs = list(get_default_resources(intent))
    for r in resource_objs:
        resources.append({
            "title": getattr(r, "title", getattr(r, "label", "Resource")),
            "description": getattr(r, "description", getattr(r, "summary", "")),
            "url": getattr(r, "url", None),
            "resource_type": "link",
        })
    
    return resources


def _get_fallback_plan(plan_type: str, intent: str) -> Dict[str, Any]:
    """Fallback static plans if Gemini fails."""
    fallback_plans = {
        "calm_down": {
            "plan_steps": [
                {"title": "Box breathing", "description": "Inhale 4 counts, hold 4, exhale 4, hold 4", "duration_min": 3},
                {"title": "5-4-3-2-1 grounding", "description": "Name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste", "duration_min": 5},
                {"title": "Positive Self-talk", "description": "Say to yourself: 'I am safe. This feeling will pass. I can handle this.'", "duration_min": 2},
            ],
            "resource_cards": _get_default_resources(intent),
            "next_check_in": {"timeframe": "1 hour", "method": "chat"}
        },
        "break_down_problem": {
            "plan_steps": [
                {"title": "Define Problem", "description": "Write down your main problem in 1-2 sentences", "duration_min": 3},
                {"title": "Chunk It", "description": "Break it into 3-4 smaller, specific parts", "duration_min": 5},
                {"title": "Prioritize", "description": "Number them from easiest to hardest", "duration_min": 2},
                {"title": "First Step", "description": "Write one tiny action you can take on the easiest part today", "duration_min": 3},
            ],
            "resource_cards": _get_default_resources(intent),
            "next_check_in": {"timeframe": "Tomorrow morning", "method": "chat"}
        },
        "general_coping": {
            "plan_steps": [
                {"title": "Self Care", "description": "Take 10 minutes for something you enjoy - music, tea, walk, anything", "duration_min": 10},
                {"title": "Self Validation", "description": "Write: 'It's okay to struggle. I'm doing my best.'", "duration_min": 2},
                {"title": "Social Support", "description": "Reach out to one trusted person today - even just to say hi", "duration_min": 5},
            ],
            "resource_cards": _get_default_resources(intent),
            "next_check_in": {"timeframe": "2 days", "method": "chat"}
        },
        "cognitive_restructuring": {
            "plan_steps": [
                {"title": "Describe Situation", "description": "Describe the situation that upset you in 2-3 sentences", "duration_min": 3},
                {"title": "Identify Thought", "description": "What automatic thought came to mind? Write it exactly", "duration_min": 2},
                {"title": "Name Emotion", "description": "Name the emotion: anxious, sad, angry, frustrated, ashamed?", "duration_min": 2},
                {"title": "Examine Evidence", "description": "List facts that support AND contradict this thought", "duration_min": 5},
                {"title": "Reframe", "description": "Create a more balanced thought considering all evidence", "duration_min": 4},
                {"title": "Re-assess", "description": "How do you feel now? Rate your emotion 0-10", "duration_min": 2},
            ],
            "resource_cards": _get_default_resources(intent),
            "next_check_in": {"timeframe": "Tomorrow evening", "method": "chat"}
        },
        "behavioral_activation": {
            "plan_steps": [
                {"title": "Identify Activity", "description": "Name one activity you used to enjoy or find meaningful", "duration_min": 3},
                {"title": "Simplify", "description": "Choose the smallest version you can do today (15 min max)", "duration_min": 3},
                {"title": "Schedule", "description": "Write exactly when and where you'll do it today", "duration_min": 2},
                {"title": "Rate Mood Before", "description": "Rate your mood 1-10 before starting the activity", "duration_min": 1},
                {"title": "Do It", "description": "Do the activity you scheduled", "duration_min": 15},
                {"title": "Rate Mood After", "description": "Rate your mood 1-10 again. Notice any change", "duration_min": 2},
            ],
            "resource_cards": _get_default_resources(intent),
            "next_check_in": {"timeframe": "Tonight", "method": "chat"}
        }
    }
    
    return fallback_plans.get(plan_type, fallback_plans["general_coping"])
