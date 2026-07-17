"""
Agent Orchestration Tools

Tools that coordinate with LangGraph agents (STA, TCA, CMA, IA).
These tools allow Aika to delegate specialized tasks to expert agents.

Registered Tools:
- run_safety_triage_agent: Crisis detection and risk assessment
- run_therapeutic_coach_agent: CBT-informed intervention planning
- run_case_management_agent: Case management and counselor escalation
- run_insights_agent: Privacy-preserving analytics queries
- general_query: General knowledge and UGM information
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from .registry import register_tool

logger = logging.getLogger(__name__)


# ============================================================================
# AGENT TOOL: Safety Triage Agent (STA)
# ============================================================================

@register_tool(
    name="run_safety_triage_agent",
    description="""Execute the Safety Triage Agent (STA) LangGraph pipeline for comprehensive risk assessment.

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
    parameters={
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
    },
    category="agent",
    requires_db=True,
    requires_user_id=True
)
async def run_safety_triage_agent(
    db: Any,
    user_id: int,
    message: str,
    session_id: str,
    reason: str,
    urgency_override: Optional[str] = None,
    sta_service: Optional[Any] = None,
    activity_logger: Optional[Any] = None,
    **kwargs
) -> Dict[str, Any]:
    """Execute STA graph for crisis detection."""
    from app.agents.sta.sta_graph_service import STAGraphService
    
    try:
        # Use provided service or create new one
        if sta_service is None:
            sta_service = STAGraphService(db=db)
        
        if activity_logger:
            activity_logger.log_info(
                "STA",
                f"🚨 Running safety triage: {reason}",
                {"urgency": urgency_override}
            )
        
        result = await sta_service.execute(
            user_id=user_id,
            session_id=session_id,
            user_hash=f"user_{user_id}",
            message=message,
            conversation_id=None,
        )
        
        severity = result.get("severity", "unknown")
        recommended_action = result.get("recommended_action", "")
        assessment_id = result.get("assessment_id")
        
        if activity_logger:
            activity_logger.log_info(
                "STA",
                f"✅ Triage complete: {severity}",
                {"assessment_id": assessment_id}
            )
        
        return {
            "status": "completed",
            "agent": "STA",
            "severity": severity,
            "risk_level": severity,
            "recommended_action": recommended_action,
            "assessment_id": assessment_id,
            "escalation_needed": severity in ["high", "critical"],
            "actions_taken": [f"Risk assessment completed (severity: {severity})"],
        }
    
    except Exception as e:
        logger.error(f"❌ STA execution failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "agent": "STA",
            "error": str(e)
        }


# ============================================================================
# AGENT TOOL: Therapeutic Coach Agent (TCA)
# ============================================================================

@register_tool(
    name="run_therapeutic_coach_agent",
    description="""Execute the Therapeutic Coach Agent (TCA) LangGraph pipeline to generate a personalized CBT-informed intervention plan.

✅ CALL WHEN USER:
- Shows moderate anxiety, stress, or emotional distress
- Needs structured coping strategies
- Would benefit from step-by-step guidance
- Expresses feeling overwhelmed but not in crisis

Examples:
- "Aku stres banget dengan tugas"
- "Aku cemas menjelang ujian"
- "Aku sedih dan tidak termotivasi"
- "Aku merasa overwhelmed dengan tanggung jawab"

❌ DO NOT CALL:
- For crisis situations (use STA instead)
- For general conversation without clear concern
- If user just wants to talk without needing structured support

The TCA agent creates intervention plans with:
- Evidence-based coping strategies (CBT, mindfulness, behavioral activation)
- Actionable steps tailored to user's concern
- Resource cards with links
- Timeline for check-in

CRITICAL: Always create plans proactively when user needs structured support!""",
    parameters={
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
    },
    category="agent",
    requires_db=True,
    requires_user_id=True
)
async def run_therapeutic_coach_agent(
    db: Any,
    user_id: int,
    message: str,
    session_id: str,
    plan_title: str,
    concern_type: str,
    severity: str = "moderate",
    tca_service: Optional[Any] = None,
    activity_logger: Optional[Any] = None,
    **kwargs
) -> Dict[str, Any]:
    """Execute TCA graph to create intervention plan."""
    from app.agents.tca.tca_graph_service import TCAGraphService
    
    try:
        if tca_service is None:
            tca_service = TCAGraphService(db=db)
        
        if activity_logger:
            activity_logger.log_info(
                "TCA",
                f"💙 Creating intervention plan: {plan_title}",
                {"concern": concern_type, "severity": severity}
            )
        
        result = await tca_service.execute(
            user_id=user_id,
            session_id=session_id,
            user_hash=f"user_{user_id}",
            message=message,
            conversation_id=None,
            severity=severity,
            intent=concern_type,
        )
        
        plan_id = result.get("intervention_plan_id")
        plan_data = result.get("plan_data", {})
        
        if activity_logger:
            activity_logger.log_info(
                "TCA",
                f"✅ Plan created: {plan_id}",
                {"total_steps": plan_data.get("total_steps", 0)}
            )
        
        return {
            "status": "completed",
            "agent": "TCA",
            "plan_id": plan_id,
            "plan_title": plan_title,
            "intervention_plan": plan_data,
            "total_steps": plan_data.get("total_steps", 0),
            "actions_taken": [f"Created intervention plan: {plan_title} (ID: {plan_id})"],
        }
    
    except Exception as e:
        logger.error(f"❌ TCA execution failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "agent": "TCA",
            "error": str(e),
            "resources": [],
        }


# ============================================================================
# AGENT TOOL: Case Management Agent (CMA)
# ============================================================================

@register_tool(
    name="run_case_management_agent",
    description="""Execute the Case Management Agent (CMA) LangGraph pipeline to create a counselor case and auto-assign.

✅ CALL WHEN:
- User explicitly requests to speak with human counselor
- Situation requires professional intervention beyond Aika's scope
- High-risk situation that needs human oversight
- User asks for appointment or counseling session

Examples:
- "Aku mau ketemu konselor"
- "Bisa hubungin psikolog?"
- "Aku butuh bantuan professional"

The CMA agent:
- Creates formal case in ticketing system
- Auto-assigns counselor based on workload
- Sets SLA deadline (2 hours for critical, 24 hours for high)
- Sends notification to assigned counselor
- Returns case ID and counselor info

❌ DO NOT CALL:
- If you can handle the request yourself (e.g., general info, coping tips)
- For crisis situations (use STA first)
- For appointment scheduling (use scheduling tools instead)""",
    parameters={
        "type": "object",
        "properties": {
            "case_title": {
                "type": "string",
                "description": "Brief Indonesian title summarizing the case (e.g., 'Permintaan Konseling - Kecemasan Akademik')"
            },
            "severity": {
                "type": "string",
                "enum": ["low", "moderate", "high", "critical"],
                "description": "Severity based on risk assessment or urgency"
            },
            "reason": {
                "type": "string",
                "description": "Brief explanation of why human counselor is needed"
            }
        },
        "required": ["case_title", "severity", "reason"]
    },
    category="agent",
    requires_db=True,
    requires_user_id=True
)
async def run_case_management_agent(
    db: Any,
    user_id: int,
    message: str,
    session_id: str,
    case_title: str,
    severity: str,
    reason: str,
    cma_service: Optional[Any] = None,
    activity_logger: Optional[Any] = None,
    **kwargs
) -> Dict[str, Any]:
    """Execute CMA graph to create case and assign counselor."""
    from app.agents.cma.cma_graph_service import CMAGraphService
    
    try:
        if cma_service is None:
            cma_service = CMAGraphService(db=db)
        
        if activity_logger:
            activity_logger.log_info(
                "CMA",
                f"📋 Creating service desk case: {case_title}",
                {"severity": severity}
            )
        
        result = await cma_service.execute(
            user_id=user_id,
            session_id=session_id,
            user_hash=f"user_{user_id}",
            message=message,
            conversation_id=None,
            severity=severity,
            intent="counselor_request",
        )
        
        case_id = result.get("case_id")
        status = result.get("status", "open")
        
        if activity_logger:
            activity_logger.log_info(
                "CMA",
                f"✅ Case created: {case_id}",
                {"status": status}
            )
        
        return {
            "status": "completed",
            "agent": "CMA",
            "case_id": case_id,
            "case_title": case_title,
            "case_status": status,
            "escalation_needed": True,
            "actions_taken": [f"Service desk case created (ID: {case_id})"],
        }
    
    except Exception as e:
        logger.error(f"❌ CMA execution failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "agent": "CMA",
            "error": str(e)
        }


# ============================================================================
# AGENT TOOL: Insights Agent (IA)
# ============================================================================

@register_tool(
    name="run_insights_agent",
    description="""Execute the Insights Agent (IA) LangGraph pipeline for privacy-preserving analytics.

✅ CALL WHEN (ADMIN/COUNSELOR ONLY):
- Admin asks for platform analytics
- Counselor asks about their caseload
- Questions about trends, patterns, or statistics
- Dashboard data queries

Examples:
- "Berapa banyak kasus krisis minggu ini?"
- "Topik mental health apa yang trending?"
- "Siapa counselor dengan beban kerja tertinggi?"

The IA agent provides:
- k-anonymity protected analytics
- Aggregated trend data
- Case statistics
- User engagement metrics

❌ DO NOT CALL:
- For student users (they don't have analytics access)
- For individual user data (use get_user_profile instead)""",
    parameters={
        "type": "object",
        "properties": {
            "query_type": {
                "type": "string",
                "enum": ["case_statistics", "trending_topics", "counselor_workload", "user_engagement", "custom"],
                "description": "Type of analytics query"
            },
            "time_range": {
                "type": "string",
                "description": "Time range for query (e.g., 'last_7_days', 'this_month', 'last_quarter')"
            }
        },
        "required": ["query_type"]
    },
    category="agent",
    requires_db=True,
    requires_user_id=False
)
async def run_insights_agent(
    db: Any,
    message: str,
    session_id: str,
    query_type: str,
    time_range: str = "last_7_days",
    ia_service: Optional[Any] = None,
    activity_logger: Optional[Any] = None,
    **kwargs
) -> Dict[str, Any]:
    """Execute IA graph for analytics queries."""
    from app.agents.ia.ia_graph_service import IAGraphService
    
    try:
        if ia_service is None:
            ia_service = IAGraphService(db=db)
        
        if activity_logger:
            activity_logger.log_info(
                "IA",
                f"📊 Running analytics query: {query_type}",
                {"time_range": time_range}
            )
        
        result = await ia_service.execute(
            user_hash="admin",
            message=message,
            session_id=session_id,
            k_anonymity=5,
        )
        
        insights = result.get("insights", {})
        
        if activity_logger:
            activity_logger.log_info(
                "IA",
                f"✅ Analytics complete: {query_type}",
                {"insights_count": len(insights)}
            )
        
        return {
            "status": "completed",
            "agent": "IA",
            "query_type": query_type,
            "insights": insights,
            "actions_taken": [f"Analytics query completed: {query_type}"],
        }
    
    except Exception as e:
        logger.error(f"❌ IA execution failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "agent": "IA",
            "error": str(e)
        }


# ============================================================================
# GENERAL QUERY TOOL
# ============================================================================

@register_tool(
    name="general_query",
    description="""Answer general questions using Gemini's knowledge base.

✅ CALL WHEN:
- User asks about UGM facilities, locations, services
- Questions about mental health concepts, disorders, coping strategies
- General knowledge questions related to wellbeing
- Information about campus resources

Examples:
- "Dimana lokasi BK UGM?"
- "Apa itu CBT?"
- "Bagaimana cara mengatasi anxiety?"
- "Apa saja layanan kesehatan mental di UGM?"

❌ DO NOT CALL:
- For personal user data (use profile tools)
- For crisis situations (use STA)
- For counseling (you can answer directly)""",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The question to answer"
            },
            "context": {
                "type": "string",
                "description": "Optional context to help answer the query"
            }
        },
        "required": ["query"]
    },
    category="agent",
    requires_db=False,
    requires_user_id=False
)
async def general_query(
    query: str,
    context: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """Answer general knowledge questions."""
    # This would typically call Gemini or a knowledge base
    # For now, return a placeholder
    return {
        "status": "completed",
        "agent": "general_query",
        "answer": f"Query: {query}",
        "actions_taken": ["Answered general question"],
    }
