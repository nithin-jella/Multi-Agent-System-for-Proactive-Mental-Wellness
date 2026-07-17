"""
Aika Tool Definitions for Gemini Function Calling

This module defines the tools (functions) that Gemini can invoke
to activate specialized LangGraph agents conditionally.
"""

# ==============================================================================
# TOOL DEFINITIONS
# ==============================================================================

AIKA_AGENT_TOOLS = [
    {
        "name": "run_safety_triage_agent",
        "description": """Execute the Safety Triage Agent (STA) LangGraph pipeline for comprehensive risk assessment.

⚠️ ONLY call this tool when the user shows SERIOUS mental health concerns:
- Self-harm or suicidal thoughts/ideation
- Mentions of wanting to die or hurt themselves
- Severe depression with hopelessness
- Psychotic symptoms or severe anxiety
- Crisis situation requiring immediate intervention
- Harmful behavior patterns toward self or others

❌ DO NOT call for:
- Normal stress or exam anxiety
- General sadness or disappointment
- Academic pressure (unless extreme)
- Relationship problems (unless indicating harm)
- Casual expressions of frustration

The STA agent performs:
- PII redaction for privacy
- Gemini-based risk classification
- Severity level determination (low/moderate/high/critical)
- Recommended action based on risk
- Database persistence of assessment

Keywords that might indicate need: "bunuh diri", "mati", "tidak ingin hidup", "suicide", 
"mengakhiri hidup", "self-harm", "menyakiti diri"
""",
        "parameters": {
            "type": "object",
            "properties": {
                "urgency_override": {
                    "type": "string",
                    "enum": ["moderate", "high", "critical"],
                    "description": "Override urgency level if immediate escalation is clearly needed based on message content"
                },
                "reason": {
                    "type": "string",
                    "description": "Brief explanation of why STA is being invoked (for audit trail and learning)"
                }
            },
            "required": ["reason"]
        }
    },
    {
        "name": "run_therapeutic_coach_agent",
        "description": """Execute the Therapeutic Coach Agent (TCA) LangGraph pipeline to generate a personalized CBT-informed intervention plan.

✅ Call this tool when user EXPLICITLY requests structured support:
- Asks for a plan or strategies: "buatin rencana", "kasih strategi", "gimana caranya"
- Wants step-by-step guidance: "langkah-langkah apa yang harus aku lakukan"
- Needs coping techniques: "cara mengatasi stress", "teknik relaksasi"
- Requests intervention: "bantu aku menghadapi ini", "aku butuh bantuan"

✅ Also call when user shows clear need for structured support:
- Describes overwhelming stress or anxiety that needs actionable steps
- Mentions struggling with specific situation (exams, relationships, family)
- Expresses desire to improve but doesn't know how

❌ DO NOT call for:
- General questions about coping (just explain, don't generate full plan)
- Casual chat or venting (listen and validate instead)
- User just checking on existing plans (use get_user_intervention_plans instead)

The TCA agent generates:
- 4-6 actionable CBT-informed steps
- 2-3 mental health resource cards
- Personalized plan based on intervention type
- Safety review before delivery
- Database persistence for progress tracking

Intervention types:
- stress_management: Academic stress, work-life balance
- anxiety_coping: Test anxiety, social anxiety, worry
- depression_support: Low mood, lack of motivation
- general_wellness: Self-care, resilience building
""",
        "parameters": {
            "type": "object",
            "properties": {
                "intervention_hint": {
                    "type": "string",
                    "enum": ["stress_management", "anxiety_coping", "depression_support", "general_wellness"],
                    "description": "Suggested intervention type based on user's expressed need"
                },
                "severity_context": {
                    "type": "string",
                    "enum": ["low", "moderate"],
                    "description": "Severity context from conversation (high severity should use STA first)"
                }
            },
            "required": []
        }
    },
    {
        "name": "run_case_management_agent",
        "description": """Execute the Case Management Agent (CMA) to create a case for human professional support.

✅ Call this tool when user wants to connect with human professionals:
- Explicitly asks for counselor/psychologist: "mau ketemu psikolog", "konseling", "mau curhat ke orang"
- Requests referral to professional services: "perlu bantuan profesional"
- Asks about GMC, HPU, or mental health services at UGM
- Wants to escalate beyond AI support

✅ Also call when situation requires professional intervention:
- User has been assessed as high risk by STA
- Problem is beyond AI's scope (trauma, severe mental illness)
- User explicitly says AI support isn't enough

The CMA agent:
- Creates support case ticket with priority level
- Notifies appropriate staff (counselors, emergency team)
- Provides case number and estimated response time
- Tracks case through resolution

Service types:
- counseling: General counseling sessions at GMC
- psychiatry: Need for psychiatric evaluation/medication
- crisis_intervention: Emergency situations requiring immediate human contact
- general_inquiry: Questions about mental health services
""",
        "parameters": {
            "type": "object",
            "properties": {
                "service_type": {
                    "type": "string",
                    "enum": ["counseling", "psychiatry", "crisis_intervention", "general_inquiry"],
                    "description": "Type of professional service user needs"
                },
                "priority": {
                    "type": "string",
                    "enum": ["normal", "high", "urgent"],
                    "description": "Case priority (use 'urgent' for crisis, 'high' if STA indicated risk)"
                }
            },
            "required": ["service_type"]
        }
    },
    {
        "name": "get_user_intervention_plans",
        "description": """Retrieve user's existing intervention plans from database.

Call when user asks about their plans or progress:
- "rencana aku apa?", "plan aku gimana?"
- "progress aku sudah sampai mana?"
- "show my plans", "lihat rencana ku"
- "aku sudah selesai langkah berapa?"

Returns list of user's plans with completion status.
""",
        "parameters": {
            "type": "object",
            "properties": {
                "active_only": {
                    "type": "boolean",
                    "description": "If true, only return active (not completed/archived) plans. Default true."
                }
            }
        }
    },
    {
        "name": "get_mental_health_resources",
        "description": """Retrieve mental health resources (articles, videos, contacts, techniques).

Call when user asks for:
- Coping strategies or techniques: "teknik relaksasi", "cara coping"
- Educational content: "penjelasan tentang anxiety", "apa itu CBT"
- Emergency contacts: "nomor darurat", "hotline bunuh diri"
- UGM mental health services: "GMC", "HPU", "layanan konseling"

Returns curated resources based on category.
""",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": [
                        "coping_strategies",
                        "relaxation_techniques", 
                        "emergency_contacts",
                        "educational_content",
                        "ugm_services"
                    ],
                    "description": "Category of resources to retrieve"
                },
                "topic": {
                    "type": "string",
                    "description": "Optional specific topic within category (e.g., 'breathing exercises', 'grounding techniques')"
                }
            },
            "required": ["category"]
        }
    },
    
    # ==============================================================================
    # ADDITIONAL USER-FACING TOOLS (from identity.py prompt)
    # ==============================================================================
    
    {
        "name": "get_user_profile",
        "description": """Get user's profile information and account details.
        
        ✅ CALL WHEN:
        - User asks "siapa aku?", "info tentang aku", "profil aku"
        - User wants to know their account info
        
        ❌ DO NOT CALL:
        - For general greetings (use direct response)
        - For intervention plan queries (use get_user_intervention_plans)
        
        Returns: User's name, email, role, registration date, preferences""",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    
    {
        "name": "create_intervention_plan",
        "description": """Create a structured CBT intervention plan for the user.
        
        ✅ CALL WHEN USER EXPRESSES:
        - Stress: "Aku stres dengan tugas kuliah"
        - Anxiety: "Aku cemas menjelang ujian"
        - Sadness: "Aku sedih dan tidak termotivasi"
        - Overwhelm: "Aku kewalahan dengan tanggung jawab"
        - Need for coping strategies
        
        ❌ DO NOT CALL:
        - For casual greetings
        - When user just wants to view existing plans (use get_user_intervention_plans)
        - For crisis situations (use run_safety_triage_agent first)
        
        This tool creates a personalized plan with 4-6 actionable steps displayed as an interactive card.
        CRITICAL: Always create plans proactively when user needs structured support!""",
        "parameters": {
            "type": "object",
            "properties": {
                "plan_title": {
                    "type": "string",
                    "description": "Clear Indonesian title describing the goal (e.g., 'Strategi Mengelola Stres Akademik')"
                },
                "concern_type": {
                    "type": "string",
                    "description": "Type of concern: 'stress', 'anxiety', 'sadness', 'overwhelm', 'motivation', 'other'"
                },
                "severity": {
                    "type": "string",
                    "description": "Severity level: 'low', 'moderate', 'high' (use 'high' if user mentions severe distress)"
                }
            },
            "required": ["plan_title", "concern_type"]
        }
    },
    
    # ==============================================================================
    # APPOINTMENT SCHEDULING TOOLS
    # ==============================================================================
    
    {
        "name": "book_appointment",
        "description": """Book a counseling appointment with a psychologist at UGM.
        
        ✅ CALL WHEN USER:
        - Explicitly requests appointment: "mau booking", "jadwalin konseling", "book appointment"
        - Wants to meet with psychologist: "mau ketemu psikolog", "pengen konseling"
        - Specifies preferred time: "besok jam 2", "Selasa siang", "next week"
        
        ❌ DO NOT CALL:
        - When just gathering preferences (ask first, then book)
        - For general questions about counseling (just answer)
        
        IMPORTANT: Before calling this tool, you should have already:
        1. Asked about preferred date/time
        2. Optionally asked about preferred counselor
        3. Optionally asked about appointment type (konseling umum, konsultasi akademik, etc.)
        
        This tool will create the appointment and return confirmation with appointment ID.
        If successful, ALWAYS inform the user about:
        - Appointment date and time
        - Counselor name
        - Location (GMC - Grhatama Pustaka)
        - How to cancel/reschedule""",
        "parameters": {
            "type": "object",
            "properties": {
                "psychologist_id": {
                    "type": "integer",
                    "description": "ID of the psychologist (get from get_available_counselors tool first). Optional if you want system to auto-assign."
                },
                "appointment_datetime": {
                    "type": "string",
                    "description": "Requested appointment date and time in ISO 8601 format (YYYY-MM-DDTHH:MM:SS). Example: '2025-11-19T13:00:00'"
                },
                "appointment_type_id": {
                    "type": "integer",
                    "description": "Type of appointment (1=General Counseling, 2=Academic Counseling, 3=Career Counseling, 4=Crisis Intervention). Default to 1 if not specified."
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes about the appointment or student's concern"
                }
            },
            "required": ["appointment_datetime"]
        }
    },
    
    {
        "name": "get_available_counselors",
        "description": """Get list of available psychologists/counselors at UGM.
        
        ✅ CALL WHEN:
        - User asks "siapa psikolog yang ada?", "counselor available?"
        - User wants to choose specific counselor
        - Need to show counselor options before booking
        
        Returns list of counselors with their specializations, languages, and experience.
        Use this BEFORE book_appointment if user wants to choose counselor.""",
        "parameters": {
            "type": "object",
            "properties": {
                "specialization": {
                    "type": "string",
                    "description": "Filter by specialization: 'anxiety', 'depression', 'trauma', 'academic_stress', 'relationships', 'general'"
                },
                "language": {
                    "type": "string",
                    "description": "Filter by language: 'id' (Indonesian), 'en' (English), 'jv' (Javanese)"
                }
            },
            "required": []
        }
    },
    
    {
        "name": "suggest_appointment_times",
        "description": """Get AI-suggested optimal appointment times based on user preferences and counselor availability.
        
        ✅ CALL WHEN:
        - User asks for available slots: "jam berapa aja yang available?", "kapan bisa?"
        - User gives general preferences: "mau siang aja", "weekday afternoon"
        - Need to suggest times before booking
        
        This tool uses AI to analyze:
        - User's stated preferences (time of day, day of week)
        - Counselor availability from their schedule
        - Existing appointment conflicts
        
        Returns top 3 recommended time slots with reasoning.""",
        "parameters": {
            "type": "object",
            "properties": {
                "psychologist_id": {
                    "type": "integer",
                    "description": "ID of specific psychologist. If not provided, suggests times for any available counselor."
                },
                "preferred_day_of_week": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Preferred days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']"
                },
                "preferred_time_of_day": {
                    "type": "string",
                    "description": "Preferred time: 'morning' (08:00-12:00), 'afternoon' (12:00-17:00), 'evening' (17:00-20:00)"
                },
                "earliest_date": {
                    "type": "string",
                    "description": "Earliest acceptable date in YYYY-MM-DD format. Default to tomorrow."
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Appointment duration in minutes. Default 60."
                }
            },
            "required": []
        }
    },
    
    {
        "name": "cancel_appointment",
        "description": """Cancel an existing appointment.
        
        ✅ CALL WHEN:
        - User asks to cancel: "cancel appointment", "batalin jadwal"
        - User wants to remove booking
        
        Returns cancellation confirmation.""",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {
                    "type": "integer",
                    "description": "ID of the appointment to cancel"
                },
                "reason": {
                    "type": "string",
                    "description": "Optional reason for cancellation"
                }
            },
            "required": ["appointment_id"]
        }
    },
    
    {
        "name": "reschedule_appointment",
        "description": """Reschedule an existing appointment to a new time.
        
        ✅ CALL WHEN:
        - User asks to reschedule: "reschedule", "ganti jadwal", "pindahin appointment"
        
        Returns new appointment confirmation.""",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {
                    "type": "integer",
                    "description": "ID of the appointment to reschedule"
                },
                "new_datetime": {
                    "type": "string",
                    "description": "New date and time in ISO 8601 format (YYYY-MM-DDTHH:MM:SS)"
                },
                "reason": {
                    "type": "string",
                    "description": "Optional reason for rescheduling"
                }
            },
            "required": ["appointment_id", "new_datetime"]
        }
    }
]


# ==============================================================================
# HELPER: Convert to Gemini Format
# ==============================================================================

def get_gemini_tools():
    """
    Convert tool definitions to Gemini's function calling format.
    
    Returns:
        List of Gemini Tool objects ready for API calls
    """
    from google.genai import types
    
    gemini_tools = []
    
    for tool in AIKA_AGENT_TOOLS:
        gemini_tools.append(
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name=tool["name"],
                        description=tool["description"],
                        parameters=tool["parameters"]
                    )
                ]
            )
        )
    
    return gemini_tools
