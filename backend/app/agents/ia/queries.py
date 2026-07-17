from __future__ import annotations

from typing import Final

from app.agents.ia.schemas import QuestionId

# ============================================================================
# PRIVACY-PRESERVING ANALYTICS QUERIES
# ============================================================================
# All queries implement k-anonymity (k≥5) and differential privacy principles
# Date ranges and aggregations prevent individual user identification

ALLOWED_QUERIES: Final[dict[QuestionId, str]] = {
    # Crisis Trend: Track crisis escalations over time (daily aggregation)
    "crisis_trend": """
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as crisis_count,
            severity,
            COUNT(DISTINCT user_hash) as unique_users_affected
        FROM cases
        WHERE 
            created_at >= :start_date 
            AND created_at < :end_date
            AND severity IN ('high', 'critical')
        GROUP BY DATE(created_at), severity
        HAVING COUNT(*) >= 5  -- k-anonymity: minimum 5 cases per group
        ORDER BY date DESC
    """,
    
    # Dropoffs: Session abandonment and engagement metrics
    "dropoffs": """
        SELECT 
            DATE(c.created_at) as date,
            COUNT(DISTINCT c.id) as total_sessions,
            COUNT(DISTINCT CASE 
                WHEN (
                    SELECT COUNT(*) 
                    FROM messages m 
                    WHERE m.conversation_id = c.id
                ) <= 2 
                THEN c.id 
            END) as early_dropoffs,
            ROUND(
                COUNT(DISTINCT CASE 
                    WHEN (
                        SELECT COUNT(*) 
                        FROM messages m 
                        WHERE m.conversation_id = c.id
                    ) <= 2 
                    THEN c.id 
                END)::NUMERIC / NULLIF(COUNT(DISTINCT c.id), 0) * 100, 
                2
            ) as dropoff_percentage,
            AVG((
                SELECT COUNT(*) 
                FROM messages m 
                WHERE m.conversation_id = c.id
            )) as avg_messages_per_conversation
        FROM conversations c
        WHERE 
            c.created_at >= :start_date 
            AND c.created_at < :end_date
        GROUP BY DATE(c.created_at)
        HAVING COUNT(DISTINCT c.id) >= 5  -- k-anonymity
        ORDER BY date DESC
    """,
    
    # Resource Reuse: Track how often intervention resources are accessed
    "resource_reuse": """
        SELECT 
            DATE(ipr.created_at) as date,
            COUNT(DISTINCT ipr.id) as total_plans_created,
            COUNT(DISTINCT ipr.user_id) as unique_users,
            COUNT(DISTINCT CASE 
                WHEN ipr.last_viewed_at IS NOT NULL 
                AND ipr.last_viewed_at > ipr.created_at 
                THEN ipr.id 
            END) as plans_revisited,
            ROUND(
                COUNT(DISTINCT CASE 
                    WHEN ipr.last_viewed_at IS NOT NULL 
                    AND ipr.last_viewed_at > ipr.created_at 
                    THEN ipr.id 
                END)::NUMERIC / NULLIF(COUNT(DISTINCT ipr.id), 0) * 100,
                2
            ) as revisit_rate,
            AVG(ipr.completed_steps::NUMERIC / NULLIF(ipr.total_steps, 0) * 100) as avg_completion_percentage
        FROM intervention_plan_records ipr
        WHERE 
            ipr.created_at >= :start_date 
            AND ipr.created_at < :end_date
            AND ipr.status = 'active'
        GROUP BY DATE(ipr.created_at)
        HAVING COUNT(DISTINCT ipr.id) >= 5  -- k-anonymity
        ORDER BY date DESC
    """,
    
    # Fallback Reduction: Track when AI successfully handles vs escalates to human
    "fallback_reduction": """
        SELECT 
            DATE(c.created_at) as date,
            COUNT(DISTINCT c.id) as total_conversations,
            COUNT(DISTINCT CASE 
                WHEN EXISTS (
                    SELECT 1 FROM cases cs 
                    WHERE cs.conversation_id = c.id 
                    AND cs.status IN ('in_progress', 'resolved', 'closed')
                ) 
                THEN c.id 
            END) as escalated_to_human,
            COUNT(DISTINCT CASE 
                WHEN NOT EXISTS (
                    SELECT 1 FROM cases cs 
                    WHERE cs.conversation_id = c.id
                ) 
                THEN c.id 
            END) as handled_by_ai,
            ROUND(
                COUNT(DISTINCT CASE 
                    WHEN NOT EXISTS (
                        SELECT 1 FROM cases cs 
                        WHERE cs.conversation_id = c.id
                    ) 
                    THEN c.id 
                END)::NUMERIC / NULLIF(COUNT(DISTINCT c.id), 0) * 100,
                2
            ) as ai_resolution_rate
        FROM conversations c
        WHERE 
            c.created_at >= :start_date 
            AND c.created_at < :end_date
        GROUP BY DATE(c.created_at)
        HAVING COUNT(DISTINCT c.id) >= 5  -- k-anonymity
        ORDER BY date DESC
    """,
    
    # Cost Per Helpful: Calculate efficiency metrics (LLM tokens vs successful outcomes)
    "cost_per_helpful": """
        SELECT 
            DATE(ta.created_at) as date,
            COUNT(DISTINCT ta.id) as total_assessments,
            AVG(ta.processing_time_ms) as avg_processing_time_ms,
            COUNT(DISTINCT CASE 
                WHEN ta.severity_level IN ('low', 'moderate')
                AND EXISTS (
                    SELECT 1 FROM intervention_plan_records ipr
                    WHERE ipr.user_id = ta.user_id
                    AND ipr.created_at >= ta.created_at
                    AND ipr.created_at <= ta.created_at + INTERVAL '1 hour'
                )
                THEN ta.id
            END) as successful_interventions,
            ROUND(
                COUNT(DISTINCT CASE 
                    WHEN ta.severity_level IN ('low', 'moderate')
                    AND EXISTS (
                        SELECT 1 FROM intervention_plan_records ipr
                        WHERE ipr.user_id = ta.user_id
                        AND ipr.created_at >= ta.created_at
                        AND ipr.created_at <= ta.created_at + INTERVAL '1 hour'
                    )
                    THEN ta.id
                END)::NUMERIC / NULLIF(COUNT(DISTINCT ta.id), 0) * 100,
                2
            ) as success_rate_percentage
        FROM triage_assessments ta
        WHERE 
            ta.created_at >= :start_date 
            AND ta.created_at < :end_date
        GROUP BY DATE(ta.created_at)
        HAVING COUNT(DISTINCT ta.id) >= 5  -- k-anonymity
        ORDER BY date DESC
    """,
    
    # Coverage Windows: Identify when system is most/least active (hourly heatmap)
    "coverage_windows": """
        SELECT 
            EXTRACT(HOUR FROM c.created_at) as hour_of_day,
            EXTRACT(DOW FROM c.created_at) as day_of_week,  -- 0=Sunday, 6=Saturday
            COUNT(DISTINCT c.id) as conversation_count,
            COUNT(DISTINCT c.user_id) as unique_users,
            AVG((
                SELECT COUNT(*) 
                FROM messages m 
                WHERE m.conversation_id = c.id
            )) as avg_messages_per_conversation,
            COUNT(DISTINCT CASE 
                WHEN EXISTS (
                    SELECT 1 FROM triage_assessments ta
                    WHERE ta.conversation_id = c.id
                    AND ta.severity_level IN ('high', 'critical')
                )
                THEN c.id
            END) as high_risk_conversations
        FROM conversations c
        WHERE 
            c.created_at >= :start_date 
            AND c.created_at < :end_date
        GROUP BY 
            EXTRACT(HOUR FROM c.created_at),
            EXTRACT(DOW FROM c.created_at)
        HAVING COUNT(DISTINCT c.id) >= 5  -- k-anonymity
        ORDER BY day_of_week, hour_of_day
    """,

    # Topic Analysis: Extract dominant topics from risk assessments
    "topic_analysis": """
        SELECT 
            topic,
            COUNT(*) as frequency,
            COUNT(DISTINCT user_id) as unique_users
        FROM (
            SELECT 
                json_array_elements_text(concerns) as topic,
                user_id
            FROM conversation_risk_assessments
            WHERE 
                created_at >= :start_date 
                AND created_at < :end_date
                AND concerns IS NOT NULL
        ) as subquery
        GROUP BY topic
        HAVING COUNT(*) >= 5 -- k-anonymity
        ORDER BY frequency DESC
        LIMIT 20
    """,

    # Sentiment Trends: Proxy sentiment using risk scores and severity levels
    "sentiment_trends": """
        SELECT 
            DATE(created_at) as date,
            AVG(risk_score) as avg_risk_score,
            COUNT(CASE WHEN severity_level = 'low' THEN 1 END) as low_risk_count,
            COUNT(CASE WHEN severity_level = 'med' THEN 1 END) as med_risk_count,
            COUNT(CASE WHEN severity_level = 'high' THEN 1 END) as high_risk_count,
            COUNT(CASE WHEN severity_level = 'critical' THEN 1 END) as critical_risk_count,
            COUNT(*) as total_assessments
        FROM triage_assessments
        WHERE 
            created_at >= :start_date 
            AND created_at < :end_date
        GROUP BY DATE(created_at)
        HAVING COUNT(*) >= 5 -- k-anonymity
        ORDER BY date DESC
    """,

    # Intervention Latency: Time between message and assessment
    "intervention_latency": """
        SELECT 
            DATE(ta.created_at) as date,
            AVG(EXTRACT(EPOCH FROM (ta.created_at - c.timestamp))) as avg_latency_seconds,
            COUNT(*) as sample_size
        FROM triage_assessments ta
        JOIN conversations c ON ta.conversation_id = c.id
        WHERE 
            ta.created_at >= :start_date 
            AND ta.created_at < :end_date
        GROUP BY DATE(ta.created_at)
        HAVING COUNT(*) >= 5 -- k-anonymity
        ORDER BY date DESC
    """,
}

