from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from datetime import datetime
from typing import Any, Dict

from fastapi import Depends
from sqlalchemy import text, Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.ia.queries import ALLOWED_QUERIES
from app.agents.ia.schemas import IAQueryRequest, IAQueryResponse
from app.database import get_async_db


class InsightsAgentService:
    """Executes allow-listed analytics questions with k-anonymity enforcement."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def query(self, payload: IAQueryRequest) -> IAQueryResponse:
        """
        Execute allow-listed SQL query with date range parameters.
        All queries enforce k-anonymity (minimum group size k=5).
        """
        question_id = payload.question_id
        if question_id not in ALLOWED_QUERIES:
            raise ValueError(f"Unsupported question_id: {question_id}")
        
        start, end = payload.params.start, payload.params.end
        if start >= end:
            raise ValueError("Parameter 'from' must be before 'to'")
        
        # Execute raw SQL query with parameters
        sql_query = ALLOWED_QUERIES[question_id]
        result = await self._session.execute(
            text(sql_query),
            {"start_date": start, "end_date": end}
        )
        rows = result.fetchall()
        
        # Format results based on query type
        handler = self._resolve_formatter(question_id)
        return handler(rows, start, end)

    def _resolve_formatter(
        self,
        question_id: str,
    ) -> Callable[[Sequence[Row[Any]], datetime, datetime], IAQueryResponse]:
        """Get formatter function for query results."""
        formatters: Dict[str, Callable[[Sequence[Row[Any]], datetime, datetime], IAQueryResponse]] = {
            "crisis_trend": self._format_crisis_trend,
            "dropoffs": self._format_dropoffs,
            "resource_reuse": self._format_resource_reuse,
            "fallback_reduction": self._format_fallback_reduction,
            "cost_per_helpful": self._format_cost_per_helpful,
            "coverage_windows": self._format_coverage_windows,
            "coverage_windows": self._format_coverage_windows,
            "topic_analysis": self._format_topic_analysis,
            "sentiment_trends": self._format_sentiment_trends,
            "intervention_latency": self._format_intervention_latency,
        }
        return formatters[question_id]

    def _format_crisis_trend(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format crisis_trend query results.
        Expected columns: date, crisis_count, severity, unique_users_affected
        """
        def _coerce_iso(value: Any) -> str:
            if hasattr(value, "isoformat"):
                return str(value.isoformat())
            return str(value)

        # Group by date for series
        series_data: Dict[str, int] = {}
        table = []
        for row in rows:
            date, crisis_count, severity, unique_users = row
            date_str = _coerce_iso(date)
            series_data[date_str] = series_data.get(date_str, 0) + crisis_count
            table.append({
                "date": date_str,
                "crisis_count": crisis_count,
                "severity": severity,
                "unique_users_affected": unique_users
            })

        series = [[date, count] for date, count in sorted(series_data.items())]
        notes = [
            "Counts include cases marked high or critical severity.",
            f"Window: {start.isoformat()} → {end.isoformat()}.",
            "K-anonymity enforced: minimum 5 cases per group.",
        ]
        return IAQueryResponse(
            chart={"type": "line", "series": [{"name": "Crisis cases", "data": series}]},
            table=table,
            notes=notes,
        )

    def _format_dropoffs(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format dropoffs query results.
        Expected columns: date, total_sessions, early_dropoffs, dropoff_percentage, avg_messages_per_conversation
        """
        if not rows:
            empty_chart = {"type": "bar", "series": [{"name": "Sessions", "data": []}]}
            return IAQueryResponse(chart=empty_chart, table=[], notes=["No conversations during this window."])

        table = []
        total_sessions_sum = 0
        total_dropoffs_sum = 0
        for row in rows:
            date, total_sessions, early_dropoffs, dropoff_percentage, avg_messages = row
            table.append({
                "date": str(date),
                "total_sessions": total_sessions,
                "early_dropoffs": early_dropoffs,
                "dropoff_percentage": float(dropoff_percentage),
                "avg_messages_per_conversation": float(avg_messages),
            })
            total_sessions_sum += total_sessions
            total_dropoffs_sum += early_dropoffs

        completion_rate = round(((total_sessions_sum - total_dropoffs_sum) / total_sessions_sum) * 100, 2) if total_sessions_sum else 0

        chart = {
            "type": "bar",
            "series": [
                {
                    "name": "Session completion",
                    "data": [
                        ["Early dropoffs (≤2 messages)", total_dropoffs_sum],
                        ["Completed sessions (3+ messages)", total_sessions_sum - total_dropoffs_sum],
                    ],
                }
            ],
        }
        notes = [
            "Drop-offs defined as conversations with two or fewer messages.",
            f"Completion rate {completion_rate}% across {total_sessions_sum} sessions.",
            "K-anonymity enforced: minimum 5 sessions per day.",
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_resource_reuse(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format resource_reuse query results.
        Expected columns: date, total_plans_created, unique_users, plans_revisited, revisit_rate, avg_completion_percentage
        """
        table = []
        total_plans = 0
        total_revisited = 0
        for row in rows:
            date, plans_created, unique_users, plans_revisited, revisit_rate, avg_completion = row
            table.append({
                "date": str(date),
                "total_plans_created": plans_created,
                "unique_users": unique_users,
                "plans_revisited": plans_revisited,
                "revisit_rate": float(revisit_rate),
                "avg_completion_percentage": float(avg_completion) if avg_completion else 0.0,
            })
            total_plans += plans_created
            total_revisited += plans_revisited

        chart = {
            "type": "bar",
            "series": [
                {
                    "name": "Intervention plans",
                    "data": [[str(row[0]), row[1]] for row in rows[:10]],  # Top 10 days
                }
            ],
        }
        notes = [
            f"High revisit rate indicates users returning to intervention resources.",
            f"Total: {total_plans} plans created, {total_revisited} revisited.",
            "K-anonymity enforced: minimum 5 plans per day.",
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_fallback_reduction(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format fallback_reduction query results.
        Expected columns: date, total_conversations, escalated_to_human, handled_by_ai, ai_resolution_rate
        """
        total_conversations = 0
        total_escalations = 0
        table = []
        for row in rows:
            date, total, escalated, handled_by_ai, ai_resolution_rate = row
            table.append({
                "date": str(date),
                "total_conversations": total,
                "escalated_to_human": escalated,
                "handled_by_ai": handled_by_ai,
                "ai_resolution_rate": float(ai_resolution_rate),
            })
            total_conversations += total
            total_escalations += escalated

        avoidance = round(((total_conversations - total_escalations) / total_conversations) * 100, 2) if total_conversations else 0.0

        chart = {
            "type": "pie",
            "series": [
                {
                    "name": "Routing",
                    "data": [
                        ["AI-handled", total_conversations - total_escalations],
                        ["Human escalation", total_escalations],
                    ],
                }
            ],
        }
        notes = [
            f"Automated resolution {avoidance}% across {total_conversations} conversations.",
            "AI-handled means no case escalation occurred.",
            "K-anonymity enforced: minimum 5 conversations per day.",
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_cost_per_helpful(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format cost_per_helpful query results.
        Expected columns: date, total_assessments, avg_processing_time_ms, successful_interventions, success_rate_percentage
        """
        table = []
        total_assessments = 0
        total_successful = 0
        total_processing_time = 0
        for row in rows:
            date, assessments, avg_processing_time, successful, success_rate = row
            table.append({
                "date": str(date),
                "total_assessments": assessments,
                "avg_processing_time_ms": float(avg_processing_time) if avg_processing_time else 0.0,
                "successful_interventions": successful,
                "success_rate_percentage": float(success_rate),
            })
            total_assessments += assessments
            total_successful += successful
            total_processing_time += avg_processing_time if avg_processing_time else 0

        avg_processing_time = total_processing_time / len(rows) if rows else 0
        assumed_cost = 5.0  # nominal IDR cost per assessment placeholder
        cost_per_helpful = round((total_assessments * assumed_cost) / max(total_successful, 1), 2)

        chart = {
            "type": "gauge",
            "series": [{"name": "Cost/Helpful", "data": cost_per_helpful}],
        }
        notes = [
            "Cost uses a placeholder 5-unit assumption until billing integration ships.",
            "Successful intervention = low/moderate assessment followed by plan within 1 hour.",
            f"Avg processing time: {avg_processing_time:.2f}ms per assessment.",
            "K-anonymity enforced: minimum 5 assessments per day.",
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_coverage_windows(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format coverage_windows query results.
        Expected columns: hour_of_day, day_of_week, conversation_count, unique_users, avg_messages_per_conversation, high_risk_conversations
        """
        # Group by hour for heatmap
        hour_data: Dict[int, int] = {}
        table = []
        for row in rows:
            hour, day_of_week, conversation_count, unique_users, avg_messages, high_risk = row
            hour_data[int(hour)] = hour_data.get(int(hour), 0) + conversation_count
            table.append({
                "hour_of_day": int(hour),
                "day_of_week": int(day_of_week),  # 0=Sunday, 6=Saturday
                "conversation_count": conversation_count,
                "unique_users": unique_users,
                "avg_messages_per_conversation": float(avg_messages),
                "high_risk_conversations": high_risk,
            })

        chart = {
            "type": "bar",
            "series": [
                {
                    "name": "Conversations",
                    "data": [[f"{hour:02d}:00", count] for hour, count in sorted(hour_data.items())],
                }
            ],
        }
        notes = [
            "Identifies peak hours for user conversations across the requested range.",
            "Hour_of_day: 0-23 (24-hour format), day_of_week: 0=Sunday, 6=Saturday.",
            "K-anonymity enforced: minimum 5 conversations per hour/day group.",
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_topic_analysis(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format topic_analysis query results.
        Expected columns: topic, frequency, unique_users
        """
        table = []
        for row in rows:
            topic, frequency, unique_users = row
            table.append({
                "topic": topic,
                "frequency": frequency,
                "unique_users": unique_users
            })

        # Sort by frequency desc
        sorted_rows = sorted(rows, key=lambda x: x[1], reverse=True)
        top_10 = sorted_rows[:10]

        chart = {
            "type": "bar",
            "series": [
                {
                    "name": "Topic Frequency",
                    "data": [[row[0], row[1]] for row in top_10]
                }
            ]
        }
        
        notes = [
            "Topics extracted from 'concerns' field in risk assessments.",
            f"Showing top {len(top_10)} topics.",
            "K-anonymity enforced: minimum 5 occurrences per topic."
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_sentiment_trends(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format sentiment_trends query results.
        Expected columns: date, avg_risk_score, low_risk_count, med_risk_count, high_risk_count, critical_risk_count, total_assessments
        """
        table = []
        series_avg_risk = []
        series_high_critical = []
        
        for row in rows:
            date, avg_risk, low, med, high, critical, total = row
            date_str = str(date)
            
            table.append({
                "date": date_str,
                "avg_risk_score": float(avg_risk) if avg_risk else 0.0,
                "low_risk": low,
                "med_risk": med,
                "high_risk": high,
                "critical_risk": critical,
                "total": total
            })
            
            series_avg_risk.append([date_str, float(avg_risk) if avg_risk else 0.0])
            series_high_critical.append([date_str, high + critical])

        # Sort by date
        series_avg_risk.sort(key=lambda x: x[0])
        series_high_critical.sort(key=lambda x: x[0])

        chart = {
            "type": "line",
            "series": [
                {"name": "Avg Risk Score (0-1)", "data": series_avg_risk},
                {"name": "High/Critical Cases", "data": series_high_critical}
            ]
        }
        
        notes = [
            "Risk Score acts as a proxy for negative sentiment (Higher = More Negative).",
            "High/Critical cases indicate severe distress.",
            "K-anonymity enforced: minimum 5 assessments per day."
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

    def _format_intervention_latency(self, rows: Sequence[Row[Any]], start: datetime, end: datetime) -> IAQueryResponse:
        """
        Format intervention_latency query results.
        Expected columns: date, avg_latency_seconds, sample_size
        """
        table = []
        series_latency = []
        
        for row in rows:
            date, latency, sample_size = row
            date_str = str(date)
            latency_val = float(latency) if latency else 0.0
            
            table.append({
                "date": date_str,
                "avg_latency_seconds": latency_val,
                "sample_size": sample_size
            })
            
            series_latency.append([date_str, latency_val])

        series_latency.sort(key=lambda x: x[0])

        chart = {
            "type": "line",
            "series": [
                {"name": "Avg Latency (s)", "data": series_latency}
            ]
        }
        
        notes = [
            "Latency = Time between user message and agent risk assessment.",
            "Lower is better.",
            "K-anonymity enforced: minimum 5 assessments per day."
        ]
        return IAQueryResponse(chart=chart, table=table, notes=notes)

def get_insights_agent_service(
    session: AsyncSession = Depends(get_async_db),
) -> "InsightsAgentService":
    """FastAPI dependency factory for :class:`InsightsAgentService`."""

    return InsightsAgentService(session=session)
