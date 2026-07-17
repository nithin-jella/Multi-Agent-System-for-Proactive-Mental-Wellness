"""
LangGraph analytics and historical data API endpoints.
Phase 2 enhancement for performance monitoring and insights.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from app.database import get_async_db
from app.models import (
    LangGraphExecution, 
    LangGraphNodeExecution, 
    LangGraphEdgeExecution,
    LangGraphPerformanceMetric,
    LangGraphAlert
)
from app.agents.execution_tracker import execution_tracker
from app.dependencies import get_admin_user

router = APIRouter(prefix="/api/v1/admin/langgraph", tags=["Admin - LangGraph Analytics"])

@router.get("/analytics/overview")
async def get_analytics_overview(
    days: int = Query(7, description="Number of days to analyze", ge=1, le=90),
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Get comprehensive analytics overview for the specified period."""
    try:
        # Use the enhanced execution tracker analytics
        analytics = await execution_tracker.get_execution_analytics(days)
        decision_parse_health = await execution_tracker.get_decision_parse_health(days)
        
        if not analytics:
            # Fallback to direct database query
            cutoff_date = datetime.now() - timedelta(days=days)
            
            # Basic metrics
            total_result = await db.execute(
                select(func.count(LangGraphExecution.id))
                .where(LangGraphExecution.started_at >= cutoff_date)
            )
            total_executions = total_result.scalar() or 0
            
            analytics = {
                "period_days": days,
                "total_executions": total_executions,
                "successful_executions": 0,
                "success_rate_percent": 0.0,
                "average_execution_time_ms": 0.0,
                "most_active_nodes": []
            }
        
        return {
            "success": True,
            "data": {
                **analytics,
                "decision_parse_health": decision_parse_health,
            },
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")


@router.get("/executions/history")
async def get_execution_history(
    limit: int = Query(50, description="Number of executions to return", ge=1, le=500),
    offset: int = Query(0, description="Number of executions to skip", ge=0),
    status: Optional[str] = Query(None, description="Filter by execution status"),
    graph_name: Optional[str] = Query(None, description="Filter by graph name"),
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Get execution history with filtering and pagination."""
    try:
        query = select(LangGraphExecution).order_by(desc(LangGraphExecution.started_at))
        
        # Apply filters
        if status:
            query = query.where(LangGraphExecution.status == status)
        if graph_name:
            query = query.where(LangGraphExecution.graph_name == graph_name)
            
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        executions = result.scalars().all()
        
        execution_data = []
        for execution in executions:
            execution_data.append({
                "execution_id": execution.execution_id,
                "graph_name": execution.graph_name,
                "status": execution.status,
                "started_at": execution.started_at.isoformat(),
                "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                "total_execution_time_ms": execution.total_execution_time_ms,
                "total_nodes_executed": execution.total_nodes_executed,
                "failed_nodes": execution.failed_nodes,
                "success_rate": execution.success_rate,
                "agent_run_id": execution.agent_run_id,
                "error_message": execution.error_message
            })
        
        return {
            "success": True,
            "data": execution_data,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "returned": len(execution_data)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History error: {str(e)}")


@router.get("/executions/{execution_id}/details")
async def get_execution_details(
    execution_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Get detailed information about a specific execution."""
    try:
        # Get main execution record
        execution_result = await db.execute(
            select(LangGraphExecution).where(LangGraphExecution.execution_id == execution_id)
        )
        execution = execution_result.scalar_one_or_none()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get node executions
        nodes_result = await db.execute(
            select(LangGraphNodeExecution)
            .where(LangGraphNodeExecution.execution_id == execution_id)
            .order_by(LangGraphNodeExecution.started_at)
        )
        nodes = nodes_result.scalars().all()
        
        # Get edge executions
        edges_result = await db.execute(
            select(LangGraphEdgeExecution)
            .where(LangGraphEdgeExecution.execution_id == execution_id)
            .order_by(LangGraphEdgeExecution.triggered_at)
        )
        edges = edges_result.scalars().all()
        
        # Get performance metrics
        metrics_result = await db.execute(
            select(LangGraphPerformanceMetric)
            .where(LangGraphPerformanceMetric.execution_id == execution_id)
            .order_by(LangGraphPerformanceMetric.recorded_at)
        )
        metrics = metrics_result.scalars().all()
        
        return {
            "success": True,
            "data": {
                "execution": {
                    "execution_id": execution.execution_id,
                    "graph_name": execution.graph_name,
                    "status": execution.status,
                    "started_at": execution.started_at.isoformat(),
                    "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                    "total_execution_time_ms": execution.total_execution_time_ms,
                    "input_data": execution.input_data,
                    "output_data": execution.output_data,
                    "execution_context": execution.execution_context,
                    "error_message": execution.error_message
                },
                "nodes": [
                    {
                        "node_id": node.node_id,
                        "agent_id": node.agent_id,
                        "status": node.status,
                        "started_at": node.started_at.isoformat(),
                        "completed_at": node.completed_at.isoformat() if node.completed_at else None,
                        "execution_time_ms": node.execution_time_ms,
                        "input_data": node.input_data,
                        "output_data": node.output_data,
                        "error_message": node.error_message,
                        "custom_metrics": node.custom_metrics
                    }
                    for node in nodes
                ],
                "edges": [
                    {
                        "edge_id": edge.edge_id,
                        "source_node_id": edge.source_node_id,
                        "target_node_id": edge.target_node_id,
                        "edge_type": edge.edge_type,
                        "triggered_at": edge.triggered_at.isoformat(),
                        "evaluation_result": edge.evaluation_result,
                        "condition_expression": edge.condition_expression
                    }
                    for edge in edges
                ],
                "metrics": [
                    {
                        "metric_name": metric.metric_name,
                        "metric_category": metric.metric_category,
                        "metric_value": metric.metric_value,
                        "metric_unit": metric.metric_unit,
                        "recorded_at": metric.recorded_at.isoformat(),
                        "node_id": metric.node_id
                    }
                    for metric in metrics
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Details error: {str(e)}")


@router.get("/performance/bottlenecks")
async def get_performance_bottlenecks(
    days: int = Query(7, description="Number of days to analyze", ge=1, le=90),
    limit: int = Query(10, description="Number of bottlenecks to return", ge=1, le=50),
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Identify performance bottlenecks in node executions."""
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Query for slowest nodes
        bottlenecks_result = await db.execute(
            select(
                LangGraphNodeExecution.node_id,
                LangGraphNodeExecution.agent_id,
                func.count(LangGraphNodeExecution.id).label("execution_count"),
                func.avg(LangGraphNodeExecution.execution_time_ms).label("avg_time_ms"),
                func.max(LangGraphNodeExecution.execution_time_ms).label("max_time_ms"),
                func.min(LangGraphNodeExecution.execution_time_ms).label("min_time_ms")
            )
            .join(LangGraphExecution, LangGraphNodeExecution.execution_id == LangGraphExecution.execution_id)
            .where(and_(
                LangGraphExecution.started_at >= cutoff_date,
                LangGraphNodeExecution.execution_time_ms.isnot(None)
            ))
            .group_by(LangGraphNodeExecution.node_id, LangGraphNodeExecution.agent_id)
            .order_by(desc(func.avg(LangGraphNodeExecution.execution_time_ms)))
            .limit(limit)
        )
        
        bottlenecks = []
        for row in bottlenecks_result.all():
            bottlenecks.append({
                "node_id": row.node_id,
                "agent_id": row.agent_id,
                "execution_count": row.execution_count,
                "average_time_ms": round(float(row.avg_time_ms), 2),
                "max_time_ms": float(row.max_time_ms),
                "min_time_ms": float(row.min_time_ms),
                "performance_impact": "high" if row.avg_time_ms > 10000 else "medium" if row.avg_time_ms > 5000 else "low"
            })
        
        return {
            "success": True,
            "data": {
                "period_days": days,
                "bottlenecks": bottlenecks,
                "analysis_date": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bottlenecks analysis error: {str(e)}")


@router.get("/alerts")
async def get_alerts(
    limit: int = Query(50, description="Number of alerts to return", ge=1, le=200),
    severity: Optional[str] = Query(None, description="Filter by alert severity"),
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    status: Optional[str] = Query(None, description="Filter by alert status (active, resolved)"),
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Get recent alerts with filtering."""
    try:
        # Use the execution tracker method if available
        if not any([severity, alert_type, status]):
            alerts = await execution_tracker.get_recent_alerts(limit)
            return {
                "success": True,
                "data": alerts,
                "generated_at": datetime.now().isoformat()
            }
        
        # Custom filtered query
        query = select(LangGraphAlert).order_by(desc(LangGraphAlert.created_at))
        
        if severity:
            query = query.where(LangGraphAlert.severity == severity)
        if alert_type:
            query = query.where(LangGraphAlert.alert_type == alert_type)
        if status:
            query = query.where(LangGraphAlert.status == status)
            
        query = query.limit(limit)
        
        result = await db.execute(query)
        alerts = result.scalars().all()
        
        alert_data = []
        for alert in alerts:
            # Ensure we don't call isoformat on None or ambiguous SQLAlchemy attribute
            resolved_at_val = alert.resolved_at
            resolved_at_iso = resolved_at_val.isoformat() if isinstance(resolved_at_val, datetime) else None

            alert_data.append({
                "id": alert.id,
                "execution_id": alert.execution_id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "message": alert.message,
                "created_at": alert.created_at.isoformat(),
                "resolved_at": resolved_at_iso,
                "status": alert.status,
                "threshold_value": alert.threshold_value,
                "actual_value": alert.actual_value,
                "metric_name": alert.metric_name,
                "affected_nodes": alert.affected_nodes
            })
        
        return {
            "success": True,
            "data": alert_data,
            "filters_applied": {
                "severity": severity,
                "alert_type": alert_type,
                "status": status,
                "limit": limit
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alerts error: {str(e)}")


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Mark an alert as resolved."""
    try:
        result = await db.execute(
            select(LangGraphAlert).where(LangGraphAlert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        if alert.status == "resolved":
            return {"success": True, "message": "Alert already resolved"}
        
        alert.status = "resolved"
        alert.resolved_at = datetime.now()
        await db.commit()

        # Use a local var and explicit type check before isoformat for safety with static analyzers
        resolved_at_val = alert.resolved_at
        resolved_at_iso = resolved_at_val.isoformat() if isinstance(resolved_at_val, datetime) else None

        return {
            "success": True,
            "message": "Alert resolved successfully",
            "alert_id": alert_id,
            "resolved_at": resolved_at_iso
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resolve alert error: {str(e)}")


@router.get("/metrics/trends")
async def get_performance_trends(
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    metric_name: str = Query("execution_time_ms", description="Metric to analyze"),
    granularity: str = Query("daily", description="Trend granularity (hourly, daily, weekly)"),
    db: AsyncSession = Depends(get_async_db),
    admin_user = Depends(get_admin_user)
):
    """Get performance trends over time."""
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Define date truncation based on granularity
        if granularity == "hourly":
            date_trunc = func.date_trunc('hour', LangGraphPerformanceMetric.recorded_at)
        elif granularity == "weekly":
            date_trunc = func.date_trunc('week', LangGraphPerformanceMetric.recorded_at)
        else:  # daily
            date_trunc = func.date_trunc('day', LangGraphPerformanceMetric.recorded_at)
        
        # Query for trends
        trends_result = await db.execute(
            select(
                date_trunc.label("period"),
                func.avg(LangGraphPerformanceMetric.metric_value).label("avg_value"),
                func.max(LangGraphPerformanceMetric.metric_value).label("max_value"),
                func.min(LangGraphPerformanceMetric.metric_value).label("min_value"),
                func.count(LangGraphPerformanceMetric.id).label("data_points")
            )
            .where(and_(
                LangGraphPerformanceMetric.recorded_at >= cutoff_date,
                LangGraphPerformanceMetric.metric_name == metric_name
            ))
            .group_by(date_trunc)
            .order_by(date_trunc)
        )
        
        trends = []
        for row in trends_result.all():
            trends.append({
                "period": row.period.isoformat(),
                "average_value": round(float(row.avg_value), 2),
                "max_value": float(row.max_value),
                "min_value": float(row.min_value),
                "data_points": row.data_points
            })
        
        return {
            "success": True,
            "data": {
                "metric_name": metric_name,
                "granularity": granularity,
                "period_days": days,
                "trends": trends,
                "analysis_date": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trends analysis error: {str(e)}")