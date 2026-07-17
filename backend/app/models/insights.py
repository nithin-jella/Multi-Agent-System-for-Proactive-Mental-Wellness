"""Insights and analytics models for admin dashboard."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InsightsReport(Base):
    """IA-generated insights reports for admin dashboard.
    
    Stores weekly/monthly reports with trending topics, sentiment analysis,
    and risk assessments for the admin command center.
    """
    __tablename__ = "insights_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # 'weekly', 'monthly', 'ad_hoc'
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Structured data
    trending_topics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # {"topics": [{"topic": str, "count": int}, ...]}
    sentiment_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # {"avg_score": float, "trend": str, ...}
    
    # Aggregate counts
    high_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    assessment_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metadata
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    generated_by: Mapped[str] = mapped_column(String(100), nullable=False, default='ia_agent')

    def __repr__(self) -> str:
        return f"<InsightsReport(id={self.id}, type={self.report_type}, period={self.period_start} to {self.period_end})>"
