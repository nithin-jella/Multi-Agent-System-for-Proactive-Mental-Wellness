"""LangGraph execution tracking models for monitoring and analytics."""

from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime

class LangGraphExecution(Base):
    """Records for complete LangGraph execution sessions."""
    __tablename__ = "langgraph_executions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    agent_run_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("agent_runs.id"), nullable=True)
    
    # Execution metadata
    graph_name: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="running")
    
    # Performance metrics
    total_execution_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_nodes_executed: Mapped[int] = mapped_column(Integer, default=0)
    failed_nodes: Mapped[int] = mapped_column(Integer, default=0)
    success_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Context and metadata
    input_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    execution_context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    node_executions: Mapped[List["LangGraphNodeExecution"]] = relationship("LangGraphNodeExecution", back_populates="execution")
    edge_executions: Mapped[List["LangGraphEdgeExecution"]] = relationship("LangGraphEdgeExecution", back_populates="execution")
    performance_metrics: Mapped[List["LangGraphPerformanceMetric"]] = relationship("LangGraphPerformanceMetric", back_populates="execution")

class LangGraphNodeExecution(Base):
    """Individual node execution records within a graph execution."""
    __tablename__ = "langgraph_node_executions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[str] = mapped_column(String, ForeignKey("langgraph_executions.execution_id"))
    
    # Node identification
    node_id: Mapped[str] = mapped_column(String, index=True)
    agent_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    node_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Execution tracking
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="running")
    
    # Performance data
    execution_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    memory_usage_mb: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cpu_usage_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Input/Output tracking
    input_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Execution context
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    execution_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_node_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Custom metrics
    custom_metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    execution: Mapped["LangGraphExecution"] = relationship("LangGraphExecution", back_populates="node_executions")

class LangGraphEdgeExecution(Base):
    """Edge execution tracking for conditional flows and routing decisions."""
    __tablename__ = "langgraph_edge_executions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[str] = mapped_column(String, ForeignKey("langgraph_executions.execution_id"))
    
    # Edge identification
    edge_id: Mapped[str] = mapped_column(String, index=True)
    source_node_id: Mapped[str] = mapped_column(String)
    target_node_id: Mapped[str] = mapped_column(String)
    edge_type: Mapped[str] = mapped_column(String, default="normal")
    
    # Execution tracking
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    evaluation_result: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # Conditional edge data
    condition_expression: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    condition_context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    evaluation_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Flow data
    data_passed: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    execution_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Relationships
    execution: Mapped["LangGraphExecution"] = relationship("LangGraphExecution", back_populates="edge_executions")

class LangGraphPerformanceMetric(Base):
    """Custom performance metrics and KPIs for graph executions."""
    __tablename__ = "langgraph_performance_metrics"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[str] = mapped_column(String, ForeignKey("langgraph_executions.execution_id"))
    
    # Metric identification
    metric_name: Mapped[str] = mapped_column(String, index=True)
    metric_category: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    
    # Metric data
    metric_value: Mapped[float] = mapped_column(Float)
    metric_unit: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Context
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    node_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    execution: Mapped["LangGraphExecution"] = relationship("LangGraphExecution", back_populates="performance_metrics")

class LangGraphAlert(Base):
    """Alert records for performance issues, failures, and anomalies."""
    __tablename__ = "langgraph_alerts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    execution_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("langgraph_executions.execution_id"), nullable=True)
    
    # Alert identification
    alert_type: Mapped[str] = mapped_column(String, index=True)
    severity: Mapped[str] = mapped_column(String, index=True)
    
    # Alert content
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
    
    # Context
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    
    # Alert data
    threshold_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metric_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Additional context
    affected_nodes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    alert_context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)