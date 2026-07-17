"""Insights analytics service for generating IA reports.

Provides automated analysis of triage data, trending topics, and sentiment.
Uses Gemini LLM for intelligent summary generation, pattern recognition,
and actionable recommendations.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InsightsReport  # Core infrastructure model
from app.domains.mental_health.models import TriageAssessment
from app.services.event_bus import publish_event, EventType
from app.core import llm

logger = logging.getLogger(__name__)

K_ANONYMITY_THRESHOLD = 5

# Gemini model for insights generation
# Use Pro where it matters (admin-facing analysis and recommendations).
INSIGHTS_GEMINI_MODEL = llm.GEMINI_PRO_MODEL

class InsightsService:
    """Service for generating and managing IA insights reports.
    
    Uses Gemini LLM for:
    - Intelligent natural language summaries
    - Pattern recognition in mental health trends
    - Actionable recommendations for administrators
    """
    
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._gemini_client = None
    
    async def _get_gemini_client(self):
        """Lazy initialization of Gemini client."""
        if self._gemini_client is None:
            from app.core.llm import get_gemini_client
            self._gemini_client = await get_gemini_client()
        return self._gemini_client
    
    async def generate_weekly_report(
        self,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        use_llm: bool = True
    ) -> InsightsReport:
        """Generate weekly insights report for admin dashboard.
        
        Args:
            period_start: Start of reporting period (defaults to 7 days ago)
            period_end: End of reporting period (defaults to now)
            use_llm: Whether to use Gemini LLM for intelligent analysis
            
        Returns:
            Created InsightsReport object
        """
        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = period_end - timedelta(days=7)
        
        logger.info(f"Generating weekly IA report: {period_start} to {period_end} (LLM: {use_llm})")
        
        # Query assessments for the period
        stmt = select(TriageAssessment).where(
            TriageAssessment.created_at >= period_start,
            TriageAssessment.created_at <= period_end
        )
        result = await self.db.execute(stmt)
        assessments = result.scalars().all()
        
        # Enforce K-Anonymity (Application Layer Check)
        # While SQL aggregation handles the metrics, we must ensure we don't process 
        # individual records for topic extraction if the group is too small.
        if len(assessments) < K_ANONYMITY_THRESHOLD:
            logger.warning(
                f"K-Anonymity threshold not met (n={len(assessments)} < {K_ANONYMITY_THRESHOLD}). "
                "Suppressing individual data processing."
            )
            assessments = []

        logger.info(f"Found {len(assessments)} assessments in period (after privacy check)")
        
        # Calculate trending topics
        trending_topics = await self._extract_trending_topics(assessments)
        
        # Calculate sentiment trend (1 - avg_risk represents positive sentiment)
        sentiment_data = await self._calculate_sentiment_trend(
            period_start, period_end
        )
        
        # Count high/critical risk assessments
        high_risk_count = sum(
            1 for a in assessments
            if a.severity_level and a.severity_level.lower() in ('high', 'critical')
        )
        
        # Count severity distribution
        severity_distribution = self._calculate_severity_distribution(assessments)
        
        # Generate LLM-powered analysis if enabled and we have data
        llm_summary = None
        patterns = None
        recommendations = None
        
        if use_llm and len(assessments) >= K_ANONYMITY_THRESHOLD:
            try:
                # Generate all LLM insights in parallel-ish manner
                llm_analysis = await self._generate_llm_insights(
                    total_count=len(assessments),
                    high_risk_count=high_risk_count,
                    trending_topics=trending_topics,
                    sentiment_data=sentiment_data,
                    severity_distribution=severity_distribution,
                    period_start=period_start,
                    period_end=period_end
                )
                llm_summary = llm_analysis.get('summary')
                patterns = llm_analysis.get('patterns', [])
                recommendations = llm_analysis.get('recommendations', [])
                logger.info("✨ LLM-powered insights generated successfully")
            except Exception as e:
                logger.error(f"LLM insight generation failed, falling back to template: {e}")
                llm_summary = None
                patterns = []
                recommendations = []
        
        # Use LLM summary if available, otherwise fall back to template
        summary = llm_summary if llm_summary else self._generate_summary(
            total_count=len(assessments),
            high_risk_count=high_risk_count,
            trending_topics=trending_topics,
            sentiment_data=sentiment_data
        )
        
        # Enhance sentiment_data with LLM analysis
        enhanced_sentiment_data = {
            **sentiment_data,
            'patterns': patterns or [],
            'recommendations': recommendations or [],
            'severity_distribution': severity_distribution,
            'llm_powered': llm_summary is not None
        }
        
        # Create report
        report = InsightsReport(
            id=uuid4(),
            report_type='weekly',
            period_start=period_start,
            period_end=period_end,
            summary=summary,
            trending_topics=trending_topics,
            sentiment_data=enhanced_sentiment_data,
            high_risk_count=high_risk_count,
            assessment_count=len(assessments),
            generated_at=datetime.utcnow()
        )
        
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        
        logger.info(f"Generated IA report {report.id}")
        
        # Emit event for orchestrator and SSE broadcasting
        await publish_event(
            event_type=EventType.IA_REPORT_GENERATED,
            source_agent='ia',
            data={
                'report_id': str(report.id),
                'report_type': report.report_type,
                'period_start': period_start.isoformat() if period_start else None,
                'period_end': period_end.isoformat() if period_end else None,
                'trending_topics': trending_topics[:5] if trending_topics else [],
                'high_risk_count': high_risk_count,
                'assessment_count': len(assessments),
                'llm_powered': llm_summary is not None
            }
        )
        
        return report
    
    async def _generate_llm_insights(
        self,
        total_count: int,
        high_risk_count: int,
        trending_topics: list[dict[str, Any]],
        sentiment_data: dict[str, Any],
        severity_distribution: dict[str, int],
        period_start: datetime,
        period_end: datetime
    ) -> dict[str, Any]:
        """Generate LLM-powered insights using Gemini.
        
        Produces:
        - Natural language summary
        - Pattern recognition insights
        - Actionable recommendations for administrators
        
        Args:
            total_count: Total assessments in period
            high_risk_count: High/critical risk count
            trending_topics: Extracted trending topics
            sentiment_data: Sentiment metrics
            severity_distribution: Count by severity level
            period_start: Report period start
            period_end: Report period end
            
        Returns:
            Dict with 'summary', 'patterns', and 'recommendations'
        """
        # Prepare k-anonymized data summary for LLM
        high_risk_pct = (high_risk_count / total_count * 100) if total_count > 0 else 0
        avg_sentiment = sentiment_data.get('avg_sentiment', 0.0)
        avg_risk = sentiment_data.get('avg_risk', 0.0)
        
        topics_summary = ', '.join([
            f"{t['topic']} ({t['count']})" for t in trending_topics[:5]
        ]) if trending_topics else 'No trending topics identified'
        
        severity_summary = ', '.join([
            f"{level}: {count}" for level, count in severity_distribution.items()
        ]) if severity_distribution else 'No severity data'
        
        period_days = (period_end - period_start).days
        
        prompt = f"""You are an expert mental health analytics specialist for a university counseling system. 
Analyze the following aggregated, k-anonymized mental health assessment data and provide actionable insights for administrators.

**IMPORTANT:** All data has been aggregated and anonymized to protect student privacy. You are analyzing population-level trends, NOT individual students.

**Report Period:** {period_start.strftime('%Y-%m-%d')} to {period_end.strftime('%Y-%m-%d')} ({period_days} days)

**Aggregated Statistics:**
- Total Assessments: {total_count}
- High/Critical Risk Cases: {high_risk_count} ({high_risk_pct:.1f}%)
- Average Sentiment Score: {avg_sentiment:.2f} (scale 0-1, higher is better)
- Average Risk Score: {avg_risk:.2f} (scale 0-1, lower is better)
- Severity Distribution: {severity_summary}

**Trending Topics (Top 5):**
{topics_summary}

**Your Task:**
Generate a comprehensive analysis in JSON format with three components:

1. **summary** (2-4 sentences): A professional, actionable summary for administrators. Highlight key findings, concerning trends, and overall mental health climate. Be specific with numbers.

2. **patterns** (array of 3-5 patterns): Identify emerging patterns or trends. Each pattern should have:
   - "title": Short descriptive title
   - "description": What the pattern indicates
   - "severity": "low", "medium", or "high"
   - "trend": "increasing", "stable", or "decreasing" (based on the data)

3. **recommendations** (array of 3-5 actionable items): Specific recommendations for administrators. Each should have:
   - "title": Short action title
   - "description": Detailed recommendation
   - "priority": "low", "medium", or "high"
   - "category": "intervention", "resource", "communication", or "monitoring"

**Guidelines:**
- Be objective and evidence-based
- Avoid alarmist language while being direct about concerns
- Focus on actionable insights, not generic advice
- Consider university counseling context (exam periods, academic stress, etc.)
- If data shows positive trends, acknowledge them

**Output ONLY valid JSON (no markdown, no explanation):**
```json
{{
  "summary": "Your professional summary here...",
  "patterns": [
    {{"title": "...", "description": "...", "severity": "...", "trend": "..."}}
  ],
  "recommendations": [
    {{"title": "...", "description": "...", "priority": "...", "category": "..."}}
  ]
}}
```"""
        
        try:
            response_text = await llm.generate_gemini_response_with_fallback(
                history=[{"role": "user", "content": prompt}],
                model=INSIGHTS_GEMINI_MODEL,
                max_tokens=2048,
                temperature=0.2,
                system_prompt=None,
                json_mode=True,
            )
            
            # Extract JSON from response
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            analysis = json.loads(response_text)
            
            # Validate response structure
            if not isinstance(analysis.get('summary'), str):
                analysis['summary'] = self._generate_summary(
                    total_count, high_risk_count, trending_topics, sentiment_data
                )
            if not isinstance(analysis.get('patterns'), list):
                analysis['patterns'] = []
            if not isinstance(analysis.get('recommendations'), list):
                analysis['recommendations'] = []
            
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            raise
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise
    
    def _calculate_severity_distribution(
        self,
        assessments: list[TriageAssessment]
    ) -> dict[str, int]:
        """Calculate distribution of severity levels.
        
        Args:
            assessments: List of triage assessments
            
        Returns:
            Dict mapping severity level to count
        """
        distribution: dict[str, int] = {
            'low': 0,
            'medium': 0,
            'high': 0,
            'critical': 0
        }
        
        for assessment in assessments:
            level = (assessment.severity_level or 'low').lower()
            if level in distribution:
                distribution[level] += 1
            else:
                distribution['low'] += 1  # Default unknown to low
        
        return distribution
    
    async def generate_monthly_report(
        self,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        use_llm: bool = True
    ) -> InsightsReport:
        """Generate monthly insights report.
        
        Args:
            period_start: Start of reporting period (defaults to 30 days ago)
            period_end: End of reporting period (defaults to now)
            use_llm: Whether to use Gemini LLM for intelligent analysis
            
        Returns:
            Created InsightsReport object
        """
        if not period_end:
            period_end = datetime.utcnow()
        if not period_start:
            period_start = period_end - timedelta(days=30)
        
        # Reuse weekly logic with different period
        report = await self.generate_weekly_report(period_start, period_end, use_llm)
        
        # Update report type
        report.report_type = 'monthly'
        await self.db.commit()
        await self.db.refresh(report)
        
        return report
    
    async def get_latest_report(
        self,
        report_type: str = 'weekly'
    ) -> InsightsReport | None:
        """Get the most recent report of given type.
        
        Args:
            report_type: Type of report ('weekly', 'monthly', 'ad_hoc')
            
        Returns:
            Latest InsightsReport or None
        """
        stmt = (
            select(InsightsReport)
            .where(InsightsReport.report_type == report_type)
            .order_by(InsightsReport.generated_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_report_by_id(self, report_id: UUID) -> InsightsReport | None:
        """Get specific report by ID.
        
        Args:
            report_id: Report UUID
            
        Returns:
            InsightsReport or None
        """
        stmt = select(InsightsReport).where(InsightsReport.id == report_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_reports(
        self,
        report_type: str | None = None,
        limit: int = 10,
        offset: int = 0
    ) -> list[InsightsReport]:
        """List reports with pagination.
        
        Args:
            report_type: Optional filter by report type
            limit: Max results to return
            offset: Offset for pagination
            
        Returns:
            List of InsightsReport objects
        """
        stmt = select(InsightsReport).order_by(
            InsightsReport.generated_at.desc()
        )
        
        if report_type:
            stmt = stmt.where(InsightsReport.report_type == report_type)
        
        stmt = stmt.limit(limit).offset(offset)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def _extract_trending_topics(
        self,
        assessments: list[TriageAssessment]
    ) -> list[dict[str, Any]]:
        """Extract trending topics from risk factors.
        
        Args:
            assessments: List of triage assessments
            
        Returns:
            List of topic dicts with counts
        """
        topic_counts: dict[str, int] = {}
        
        for assessment in assessments:
            if not assessment.risk_factors:
                continue
            
            # Extract topics from risk factors
            factors = assessment.risk_factors
            if isinstance(factors, list):
                for factor in factors:
                    if isinstance(factor, str):
                        # Parse risk factors (e.g., "pii::email:2" -> "email")
                        topic = self._parse_risk_factor(factor)
                        if topic:
                            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        # Sort by count descending
        sorted_topics = sorted(
            topic_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Format as list of dicts
        trending = [
            {'topic': topic, 'count': count}
            for topic, count in sorted_topics[:10]  # Top 10
        ]
        
        return trending
    
    async def _calculate_sentiment_trend(
        self,
        period_start: datetime,
        period_end: datetime
    ) -> dict[str, Any]:
        """Calculate sentiment trend over time.
        
        Args:
            period_start: Start of period
            period_end: End of period
            
        Returns:
            Dict with sentiment metrics
        """
        # Query average risk score (inverse of sentiment)
        # Enforce k-anonymity at the SQL level for aggregation
        stmt = select(
            func.avg(TriageAssessment.risk_score).label('avg_risk')
        ).where(
            TriageAssessment.created_at >= period_start,
            TriageAssessment.created_at <= period_end
        ).having(
            func.count(TriageAssessment.id) >= K_ANONYMITY_THRESHOLD
        )
        
        result = await self.db.execute(stmt)
        avg_risk = result.scalar()
        
        if avg_risk is None:
            # Handle insufficient data or no data
            return {
                'avg_sentiment': 0.0,
                'avg_risk': 0.0,
                'period_start': period_start.isoformat(),
                'period_end': period_end.isoformat(),
                'note': 'Insufficient data for k-anonymity or no records.'
            }
        
        # Convert risk to sentiment (1.0 - risk_score)
        avg_sentiment = 1.0 - float(avg_risk)
        
        return {
            'avg_sentiment': round(avg_sentiment, 4),
            'avg_risk': round(float(avg_risk), 4),
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat()
        }
    
    @staticmethod
    def _parse_risk_factor(factor: str) -> str | None:
        """Parse risk factor string to extract topic.
        
        Args:
            factor: Risk factor string (e.g., "pii::email:2", "anxiety")
            
        Returns:
            Extracted topic or None
        """
        # Handle PII format (pii::type:count)
        if factor.startswith('pii::'):
            parts = factor.split(':')
            if len(parts) >= 3:
                return parts[2]  # Extract the PII type
        
        # Handle plain text factors
        if factor and not factor.startswith('pii::'):
            return factor.lower()
        
        return None
    
    @staticmethod
    def _generate_summary(
        total_count: int,
        high_risk_count: int,
        trending_topics: list[dict[str, Any]],
        sentiment_data: dict[str, Any]
    ) -> str:
        """Generate human-readable summary text.
        
        Args:
            total_count: Total assessments
            high_risk_count: High/critical risk count
            trending_topics: List of trending topics
            sentiment_data: Sentiment metrics
            
        Returns:
            Summary text
        """
        high_risk_pct = (
            (high_risk_count / total_count * 100)
            if total_count > 0 else 0
        )
        
        top_topics = ', '.join([
            t['topic'] for t in trending_topics[:3]
        ]) if trending_topics else 'none'
        
        avg_sentiment = sentiment_data.get('avg_sentiment', 0.0)
        sentiment_label = (
            'positive' if avg_sentiment >= 0.7
            else 'neutral' if avg_sentiment >= 0.4
            else 'concerning'
        )
        
        summary = (
            f"Weekly report: {total_count} assessments, "
            f"{high_risk_count} ({high_risk_pct:.1f}%) high/critical risk. "
            f"Top topics: {top_topics}. "
            f"Overall sentiment: {sentiment_label} ({avg_sentiment:.2f})."
        )
        
        return summary


def get_insights_service(db: AsyncSession) -> InsightsService:
    """Dependency to get insights service instance."""
    return InsightsService(db)
