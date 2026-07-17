"""LangGraph execution state tracker for real-time monitoring and historical persistence."""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Callable, Any
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.dialects.postgresql import insert

from app.domains.mental_health.schemas.enhanced_agents import (
    GraphExecutionState,
    NodeExecutionState, 
    EdgeExecutionState,
    NodeExecutionStatus,
    EdgeType
)
from app.models import (
    LangGraphExecution,
    LangGraphNodeExecution,
    LangGraphEdgeExecution,
    LangGraphPerformanceMetric,
    LangGraphAlert
)
from app.database import AsyncSessionLocal


async def _ensure_langgraph_execution_row(
    db: AsyncSession,
    *,
    execution_id: str,
    graph_name: Optional[str],
    agent_name: Optional[str],
    agent_run_id: Optional[int],
    started_at: Optional[datetime],
    input_data: Optional[Dict],
) -> None:
    """Ensure parent `langgraph_executions` row exists.

    Persistence happens via background tasks. In practice, a node can be persisted
    before the execution-start task commits, which would violate the FK from
    `langgraph_node_executions.execution_id` to `langgraph_executions.execution_id`.

    This helper removes that race by creating the execution row on-demand atomically.
    """
    stmt = insert(LangGraphExecution).values(
        execution_id=execution_id,
        agent_run_id=agent_run_id,
        graph_name=graph_name,
        started_at=started_at or datetime.now(),
        status="running",
        input_data=input_data,
        execution_context={"agent_name": agent_name} if agent_name else None,
    ).on_conflict_do_nothing(index_elements=["execution_id"])

    await db.execute(stmt)
    await db.flush()

class ExecutionStateTracker:
    """Tracks execution state of LangGraph agents in real-time with database persistence."""
    
    def __init__(self):
        self._active_executions: Dict[str, GraphExecutionState] = {}
        self._execution_history: List[GraphExecutionState] = []
        self._subscribers: Set[Callable] = set()
        self._node_metrics: Dict[str, Dict[str, float]] = {}
        self._persist_to_db: bool = True  # Enable database persistence
        self._alert_thresholds: Dict[str, float] = {
            "execution_time_warning_ms": 30000,  # 30 seconds
            "execution_time_critical_ms": 120000,  # 2 minutes
            "failure_rate_warning": 0.1,  # 10%
            "failure_rate_critical": 0.25,  # 25%
            "decision_parse_failure_warning_percent": 5.0,
            "decision_parse_failure_critical_percent": 15.0,
            "decision_parse_failure_min_samples": 20,
        }
        self._decision_parse_alert_cooldown_s: int = 900  # 15 minutes
        self._last_decision_parse_alert_ts: float = 0.0
        self._pending_tasks: Set[asyncio.Task] = set()
        
    def _fire_task(self, coro) -> asyncio.Task:
        """Safely track background tasks to ensure they complete on shutdown."""
        task = asyncio.create_task(coro)
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)
        return task

    async def shutdown(self) -> None:
        """Gracefully await all pending tracking operations."""
        if self._pending_tasks:
            await asyncio.gather(*self._pending_tasks, return_exceptions=True)

        
    def start_execution(self, graph_id: str, agent_name: str, agent_run_id: Optional[int] = None, 
                       input_data: Optional[Dict] = None) -> str:
        """Start tracking a new execution with database persistence."""
        execution_id = str(uuid4())
        execution_state = GraphExecutionState(
            graph_id=graph_id,
            execution_id=execution_id,
            status=NodeExecutionStatus.RUNNING,
            started_at=datetime.now(),
            metrics={"agent_name": agent_name}
        )
        self._active_executions[execution_id] = execution_state
        
        # Persist to database (Phase 2 enhancement)
        if self._persist_to_db:
            self._fire_task(self._persist_execution_start(
                execution_id, graph_id, agent_name, agent_run_id, input_data
            ))
        
        self._notify_subscribers("execution_started", execution_state)
        return execution_id
    
    def start_node(self, execution_id: str, node_id: str, agent_id: Optional[str] = None,
                  input_data: Optional[Dict] = None, node_type: Optional[str] = None, 
                  retry_count: int = 0) -> None:
        """Mark a node as started with database persistence."""
        if execution_id not in self._active_executions:
            return
            
        execution = self._active_executions[execution_id]
        
        # Update current node
        execution.current_node = node_id
        
        # Find or create node state
        node_state = None
        for node in execution.nodes:
            if node.node_id == node_id:
                node_state = node
                break
                
        if not node_state:
            node_state = NodeExecutionState(
                node_id=node_id,
                status=NodeExecutionStatus.RUNNING,
                started_at=datetime.now()
            )
            execution.nodes.append(node_state)
        else:
            node_state.status = NodeExecutionStatus.RUNNING
            node_state.started_at = datetime.now()
        
        # Persist to database (Phase 2 enhancement)
        if self._persist_to_db:
            self._fire_task(self._persist_node_execution(
                execution_id, node_id, "running", agent_id, input_data,
                node_type=node_type, retry_count=retry_count
            ))
            
        self._notify_subscribers("node_started", execution)
    
    def complete_node(self, execution_id: str, node_id: str, metrics: Optional[Dict] = None,
                     output_data: Optional[Dict] = None) -> None:
        """Mark a node as completed with database persistence."""
        if execution_id not in self._active_executions:
            return
            
        execution = self._active_executions[execution_id]
        
        for node in execution.nodes:
            if node.node_id == node_id:
                node.status = NodeExecutionStatus.COMPLETED
                node.completed_at = datetime.now()
                if node.started_at:
                    node.execution_time_ms = int((node.completed_at - node.started_at).total_seconds() * 1000)
                if metrics:
                    node.metrics.update(metrics)
                    
                # Update global node metrics
                self._update_node_metrics(node_id, node.execution_time_ms or 0)
                
                # Persist to database (Phase 2 enhancement)
                if self._persist_to_db:
                    self._fire_task(self._persist_node_execution(
                        execution_id, node_id, "completed", None, None, output_data, 
                        None, node.execution_time_ms
                    ))
                    
                    # Record performance metrics
                    if node.execution_time_ms:
                        self._fire_task(self._persist_performance_metric(
                            execution_id, "node_execution_time", node.execution_time_ms, 
                            "milliseconds", "performance", node_id
                        ))
                        
                        # Check performance thresholds
                        self._check_performance_thresholds(execution_id, node.execution_time_ms)
                
                break
                
        self._notify_subscribers("node_completed", execution)
    
    def fail_node(self, execution_id: str, node_id: str, error: str) -> None:
        """Mark a node as failed with database persistence."""
        if execution_id not in self._active_executions:
            return
            
        execution = self._active_executions[execution_id]
        
        for node in execution.nodes:
            if node.node_id == node_id:
                node.status = NodeExecutionStatus.FAILED
                node.completed_at = datetime.now()
                node.error_message = error
                if node.started_at:
                    node.execution_time_ms = int((node.completed_at - node.started_at).total_seconds() * 1000)
                
                # Persist to database (Phase 2 enhancement)
                if self._persist_to_db:
                    self._fire_task(self._persist_node_execution(
                        execution_id, node_id, "failed", None, None, None, error, 
                        node.execution_time_ms
                    ))
                    
                    # Create failure alert
                    self._fire_task(self._create_alert(
                        alert_type="error",
                        severity="high",
                        title=f"Node Execution Failed: {node_id}",
                        message=f"Node {node_id} failed with error: {error}",
                        execution_id=execution_id
                    ))
                
                break
                
        self._notify_subscribers("node_failed", execution)
    
    def trigger_edge(self, execution_id: str, edge_id: str, condition_result: Optional[bool] = None) -> None:
        """Mark an edge as triggered."""
        if execution_id not in self._active_executions:
            return
            
        execution = self._active_executions[execution_id]
        
        # Find or create edge state
        edge_state = None
        for edge in execution.edges:
            if edge.edge_id == edge_id:
                edge_state = edge
                break
                
        if not edge_state:
            edge_state = EdgeExecutionState(
                edge_id=edge_id,
                source="",  # Will be populated from graph spec
                target="",
                edge_type=EdgeType.CONDITIONAL if condition_result is not None else EdgeType.NORMAL,
                triggered=True,
                evaluation_result=condition_result
            )
            execution.edges.append(edge_state)
        else:
            edge_state.triggered = True
            edge_state.evaluation_result = condition_result
            
        self._notify_subscribers("edge_triggered", execution)
    
    def complete_execution(self, execution_id: str, success: bool = True, error: Optional[str] = None, output_data: Optional[Dict] = None) -> None:
        """Complete an execution."""
        if execution_id not in self._active_executions:
            return
            
        execution = self._active_executions[execution_id]
        execution.status = NodeExecutionStatus.COMPLETED if success else NodeExecutionStatus.FAILED
        execution.completed_at = datetime.now()
        execution.current_node = None
        
        # Move to history
        self._execution_history.append(execution)
        del self._active_executions[execution_id]
        
        # Keep only last 100 executions
        if len(self._execution_history) > 100:
            self._execution_history = self._execution_history[-100:]
            
        # Persist to database (Phase 2 enhancement)
        if self._persist_to_db:
            self._fire_task(self._persist_execution_completion(
                execution_id, success, error, output_data
            ))
            
        self._notify_subscribers("execution_completed", execution)
    
    def get_active_executions(self) -> List[GraphExecutionState]:
        """Get all active executions."""
        return list(self._active_executions.values())
    
    def get_execution_history(self, limit: int = 20) -> List[GraphExecutionState]:
        """Get recent execution history."""
        return self._execution_history[-limit:]
    
    def get_node_metrics(self) -> Dict[str, Dict[str, float]]:
        """Get aggregated node performance metrics."""
        return self._node_metrics.copy()
    
    def subscribe(self, callback: Callable) -> None:
        """Subscribe to execution state changes."""
        self._subscribers.add(callback)
    
    def unsubscribe(self, callback: Callable) -> None:
        """Unsubscribe from execution state changes."""
        self._subscribers.discard(callback)
    
    def _update_node_metrics(self, node_id: str, execution_time_ms: int) -> None:
        """Update aggregated metrics for a node."""
        if node_id not in self._node_metrics:
            self._node_metrics[node_id] = {
                "total_executions": 0,
                "total_time_ms": 0,
                "avg_time_ms": 0,
                "min_time_ms": float('inf'),
                "max_time_ms": 0
            }
            
        metrics = self._node_metrics[node_id]
        metrics["total_executions"] += 1
        metrics["total_time_ms"] += execution_time_ms
        metrics["avg_time_ms"] = metrics["total_time_ms"] / metrics["total_executions"]
        metrics["min_time_ms"] = min(metrics["min_time_ms"], execution_time_ms)
        metrics["max_time_ms"] = max(metrics["max_time_ms"], execution_time_ms)
    
    def _notify_subscribers(self, event_type: str, execution: GraphExecutionState) -> None:
        """Notify all subscribers of state changes."""
        for callback in self._subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    self._fire_task(callback(event_type, execution))
                else:
                    callback(event_type, execution)
            except Exception as e:
                print(f"Error notifying subscriber: {e}")

    # Phase 2 Database Persistence Methods
    
    async def _persist_execution_start(self, execution_id: str, graph_name: str, 
                                     agent_name: str, agent_run_id: Optional[int], 
                                     input_data: Optional[Dict]) -> None:
        """Persist execution start to database."""
        try:
            async with AsyncSessionLocal() as db:
                db_execution = LangGraphExecution(
                    execution_id=execution_id,
                    agent_run_id=agent_run_id,
                    graph_name=graph_name,
                    started_at=datetime.now(),
                    status="running",
                    input_data=input_data,
                    execution_context={"agent_name": agent_name}
                )
                db.add(db_execution)
                await db.commit()
        except Exception as e:
            print(f"Error persisting execution start: {e}")

    async def _persist_execution_completion(self, execution_id: str, success: bool, 
                                          error: Optional[str] = None, 
                                          output_data: Optional[Dict] = None) -> None:
        """Persist execution completion to database."""
        try:
            async with AsyncSessionLocal() as db:
                # Find the execution record
                result = await db.execute(
                    select(LangGraphExecution).where(LangGraphExecution.execution_id == execution_id)
                )
                db_execution = result.scalar_one_or_none()
                
                if db_execution:
                    db_execution.status = "completed" if success else "failed"
                    db_execution.completed_at = datetime.now()
                    db_execution.error_message = error
                    db_execution.output_data = output_data
                    
                    # Calculate total execution time
                    if db_execution.started_at:
                        db_execution.total_execution_time_ms = (
                            db_execution.completed_at - db_execution.started_at
                        ).total_seconds() * 1000
                    
                    await db.commit()
        except Exception as e:
            print(f"Error persisting execution completion: {e}")

    async def _persist_node_execution(self, execution_id: str, node_id: str, 
                                    status: str, agent_id: Optional[str] = None,
                                    input_data: Optional[Dict] = None,
                                    output_data: Optional[Dict] = None,
                                    error_message: Optional[str] = None,
                                    execution_time_ms: Optional[float] = None,
                                    node_type: Optional[str] = None,
                                    retry_count: int = 0) -> None:
        """Persist node execution to database."""
        try:
            async with AsyncSessionLocal() as db:
                state = self._active_executions.get(execution_id)
                await _ensure_langgraph_execution_row(
                    db,
                    execution_id=execution_id,
                    graph_name=(state.graph_id if state else None),
                    agent_name=(str(state.metrics.get("agent_name")) if state and isinstance(state.metrics, dict) and state.metrics.get("agent_name") else None),
                    agent_run_id=None,
                    started_at=(state.started_at if state else None),
                    input_data=input_data if status == "running" else None,
                )

                db_node = LangGraphNodeExecution(
                    execution_id=execution_id,
                    node_id=node_id,
                    agent_id=agent_id,
                    status=status,
                    started_at=datetime.now() if status == "running" else None,
                    completed_at=datetime.now() if status in ["completed", "failed"] else None,
                    execution_time_ms=execution_time_ms,
                    input_data=input_data,
                    output_data=output_data,
                    error_message=error_message,
                    node_type=node_type,
                    retry_count=retry_count
                )
                db.add(db_node)
                await db.commit()
        except Exception as e:
            print(f"Error persisting node execution: {e}")

    async def _persist_edge_execution(self, execution_id: str, edge_id: str,
                                    source_node: str, target_node: str,
                                    edge_type: str, evaluation_result: Optional[bool] = None) -> None:
        """Persist edge execution to database."""
        try:
            async with AsyncSessionLocal() as db:
                state = self._active_executions.get(execution_id)
                await _ensure_langgraph_execution_row(
                    db,
                    execution_id=execution_id,
                    graph_name=(state.graph_id if state else None),
                    agent_name=(str(state.metrics.get("agent_name")) if state and isinstance(state.metrics, dict) and state.metrics.get("agent_name") else None),
                    agent_run_id=None,
                    started_at=(state.started_at if state else None),
                    input_data=None,
                )
                db_edge = LangGraphEdgeExecution(
                    execution_id=execution_id,
                    edge_id=edge_id,
                    source_node_id=source_node,
                    target_node_id=target_node,
                    edge_type=edge_type,
                    triggered_at=datetime.now(),
                    evaluation_result=evaluation_result
                )
                db.add(db_edge)
                await db.commit()
        except Exception as e:
            print(f"Error persisting edge execution: {e}")

    async def _persist_performance_metric(self, execution_id: str, metric_name: str,
                                        metric_value: float, metric_unit: str,
                                        metric_category: str = "performance",
                                        node_id: Optional[str] = None) -> None:
        """Persist performance metric to database."""
        try:
            async with AsyncSessionLocal() as db:
                state = self._active_executions.get(execution_id)
                await _ensure_langgraph_execution_row(
                    db,
                    execution_id=execution_id,
                    graph_name=(state.graph_id if state else None),
                    agent_name=(str(state.metrics.get("agent_name")) if state and isinstance(state.metrics, dict) and state.metrics.get("agent_name") else None),
                    agent_run_id=None,
                    started_at=(state.started_at if state else None),
                    input_data=None,
                )
                db_metric = LangGraphPerformanceMetric(
                    execution_id=execution_id,
                    metric_name=metric_name,
                    metric_category=metric_category,
                    metric_value=metric_value,
                    metric_unit=metric_unit,
                    node_id=node_id,
                    recorded_at=datetime.now()
                )
                db.add(db_metric)
                await db.commit()
        except Exception as e:
            print(f"Error persisting performance metric: {e}")

    def record_custom_metric(
        self,
        execution_id: Optional[str],
        metric_name: str,
        metric_value: float,
        *,
        metric_unit: str = "count",
        metric_category: str = "quality",
        node_id: Optional[str] = None,
    ) -> None:
        """Record a custom LangGraph metric when an execution_id is available."""
        if not execution_id:
            return
        self._fire_task(
            self._persist_performance_metric(
                execution_id=execution_id,
                metric_name=metric_name,
                metric_value=metric_value,
                metric_unit=metric_unit,
                metric_category=metric_category,
                node_id=node_id,
            )
        )

    def record_decision_parse_outcome(
        self,
        *,
        execution_id: Optional[str],
        initial_parse_failed: bool,
        repaired: bool,
    ) -> None:
        """Record Aika decision-parse quality metrics and trigger threshold alerts."""
        self.record_custom_metric(
            execution_id,
            "aika_decision_parse_attempt",
            1.0,
            metric_unit="count",
            metric_category="quality",
            node_id="aika_decision",
        )

        if initial_parse_failed:
            self.record_custom_metric(
                execution_id,
                "aika_decision_parse_failed",
                1.0,
                metric_unit="count",
                metric_category="quality",
                node_id="aika_decision",
            )

        if repaired:
            self.record_custom_metric(
                execution_id,
                "aika_decision_parse_repaired",
                1.0,
                metric_unit="count",
                metric_category="quality",
                node_id="aika_decision",
            )

        if initial_parse_failed and not repaired:
            self.record_custom_metric(
                execution_id,
                "aika_decision_parse_unrecovered",
                1.0,
                metric_unit="count",
                metric_category="quality",
                node_id="aika_decision",
            )

        self._fire_task(self._check_decision_parse_failure_threshold(days=1))

    async def _check_decision_parse_failure_threshold(self, *, days: int = 1) -> None:
        """Create warning/critical alerts when parse-failure rate breaches thresholds."""
        try:
            summary = await self.get_decision_parse_health(days=days)
            attempts = int(summary.get("total_attempts", 0))
            failure_rate = float(summary.get("parse_failure_rate_percent", 0.0))

            min_samples = int(self._alert_thresholds["decision_parse_failure_min_samples"])
            if attempts < min_samples:
                return

            severity: Optional[str] = None
            if failure_rate >= float(self._alert_thresholds["decision_parse_failure_critical_percent"]):
                severity = "critical"
            elif failure_rate >= float(self._alert_thresholds["decision_parse_failure_warning_percent"]):
                severity = "warning"

            if severity is None:
                return

            now_ts = time.time()
            if (now_ts - self._last_decision_parse_alert_ts) < self._decision_parse_alert_cooldown_s:
                return

            self._last_decision_parse_alert_ts = now_ts
            threshold_value = (
                float(self._alert_thresholds["decision_parse_failure_critical_percent"])
                if severity == "critical"
                else float(self._alert_thresholds["decision_parse_failure_warning_percent"])
            )

            await self._create_alert(
                alert_type="quality",
                severity=severity,
                title="Aika Decision Parse Failure Rate Elevated",
                message=(
                    f"Decision parse failure rate is {failure_rate:.2f}% over the last {days} day(s) "
                    f"({summary.get('failed_parses', 0)}/{attempts} attempts)."
                ),
                execution_id=None,
                threshold_value=threshold_value,
                actual_value=failure_rate,
                metric_name="aika_decision_parse_failure_rate_percent",
            )
        except Exception as e:
            print(f"Error checking decision parse threshold: {e}")

    async def _create_alert(self, alert_type: str, severity: str, title: str,
                          message: str, execution_id: Optional[str] = None,
                          threshold_value: Optional[float] = None,
                          actual_value: Optional[float] = None,
                          metric_name: Optional[str] = None) -> None:
        """Create an alert for performance issues or failures."""
        try:
            async with AsyncSessionLocal() as db:
                if execution_id:
                    state = self._active_executions.get(execution_id)
                    await _ensure_langgraph_execution_row(
                        db,
                        execution_id=execution_id,
                        graph_name=(state.graph_id if state else None),
                        agent_name=(str(state.metrics.get("agent_name")) if state and isinstance(state.metrics, dict) and state.metrics.get("agent_name") else None),
                        agent_run_id=None,
                        started_at=(state.started_at if state else None),
                        input_data=None,
                    )
                alert = LangGraphAlert(
                    execution_id=execution_id,
                    alert_type=alert_type,
                    severity=severity,
                    title=title,
                    message=message,
                    threshold_value=threshold_value,
                    actual_value=actual_value,
                    metric_name=metric_name,
                    created_at=datetime.now(),
                    status="active"
                )
                db.add(alert)
                await db.commit()
                
                # Notify subscribers about the alert
                # Create a special alert notification (not a regular execution state)
                for callback in self._subscribers:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            self._fire_task(callback("alert_created", {
                                "alert_type": alert_type,
                                "severity": severity,
                                "title": title,
                                "message": message,
                                "execution_id": execution_id
                            }))
                        else:
                            callback("alert_created", {
                                "alert_type": alert_type,
                                "severity": severity,
                                "title": title,
                                "message": message,
                                "execution_id": execution_id
                            })
                    except Exception as e:
                        print(f"Error notifying subscriber about alert: {e}")
        except Exception as e:
            print(f"Error creating alert: {e}")

    def _check_performance_thresholds(self, execution_id: str, execution_time_ms: float) -> None:
        """Check performance thresholds and create alerts if needed."""
        if execution_time_ms > self._alert_thresholds["execution_time_critical_ms"]:
            self._fire_task(self._create_alert(
                alert_type="performance",
                severity="critical",
                title="Critical Execution Time",
                message=f"Execution took {execution_time_ms:.0f}ms (threshold: {self._alert_thresholds['execution_time_critical_ms']:.0f}ms)",
                execution_id=execution_id,
                threshold_value=self._alert_thresholds["execution_time_critical_ms"],
                actual_value=execution_time_ms,
                metric_name="execution_time_ms"
            ))
        elif execution_time_ms > self._alert_thresholds["execution_time_warning_ms"]:
            self._fire_task(self._create_alert(
                alert_type="performance",
                severity="medium",
                title="Slow Execution Warning",
                message=f"Execution took {execution_time_ms:.0f}ms (threshold: {self._alert_thresholds['execution_time_warning_ms']:.0f}ms)",
                execution_id=execution_id,
                threshold_value=self._alert_thresholds["execution_time_warning_ms"],
                actual_value=execution_time_ms,
                metric_name="execution_time_ms"
            ))

    # Enhanced Phase 2 Analytics Methods
    
    async def get_execution_analytics(self, days: int = 7) -> Dict[str, Any]:
        """Get execution analytics for the specified period."""
        try:
            async with AsyncSessionLocal() as db:
                from sqlalchemy import func, and_
                from datetime import timedelta
                
                cutoff_date = datetime.now() - timedelta(days=days)
                
                # Total executions
                total_result = await db.execute(
                    select(func.count(LangGraphExecution.id))
                    .where(LangGraphExecution.started_at >= cutoff_date)
                )
                total_executions = total_result.scalar() or 0
                
                # Success rate
                success_result = await db.execute(
                    select(func.count(LangGraphExecution.id))
                    .where(and_(
                        LangGraphExecution.started_at >= cutoff_date,
                        LangGraphExecution.status == "completed"
                    ))
                )
                successful_executions = success_result.scalar() or 0
                success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
                
                # Average execution time
                avg_time_result = await db.execute(
                    select(func.avg(LangGraphExecution.total_execution_time_ms))
                    .where(and_(
                        LangGraphExecution.started_at >= cutoff_date,
                        LangGraphExecution.total_execution_time_ms.isnot(None)
                    ))
                )
                avg_execution_time = avg_time_result.scalar() or 0
                
                # Most active nodes
                node_activity_result = await db.execute(
                    select(
                        LangGraphNodeExecution.node_id,
                        func.count(LangGraphNodeExecution.id).label("execution_count"),
                        func.avg(LangGraphNodeExecution.execution_time_ms).label("avg_time")
                    )
                    .join(LangGraphExecution, LangGraphNodeExecution.execution_id == LangGraphExecution.execution_id)
                    .where(LangGraphExecution.started_at >= cutoff_date)
                    .group_by(LangGraphNodeExecution.node_id)
                    .order_by(func.count(LangGraphNodeExecution.id).desc())
                    .limit(10)
                )
                
                node_activity = [
                    {
                        "node_id": row.node_id,
                        "execution_count": row.execution_count,
                        "avg_execution_time_ms": float(row.avg_time) if row.avg_time else 0
                    }
                    for row in node_activity_result.all()
                ]
                
                return {
                    "period_days": days,
                    "total_executions": total_executions,
                    "successful_executions": successful_executions,
                    "success_rate_percent": round(success_rate, 2),
                    "average_execution_time_ms": round(avg_execution_time, 2),
                    "most_active_nodes": node_activity
                }
                
        except Exception as e:
            print(f"Error getting execution analytics: {e}")
            return {}

    async def get_decision_parse_health(self, days: int = 7) -> Dict[str, Any]:
        """Return Aika decision JSON parse health summary for dashboard/alerts."""
        try:
            async with AsyncSessionLocal() as db:
                cutoff_date = datetime.now() - timedelta(days=days)

                async def _sum_metric(metric_name: str) -> float:
                    result = await db.execute(
                        select(func.coalesce(func.sum(LangGraphPerformanceMetric.metric_value), 0.0)).where(
                            and_(
                                LangGraphPerformanceMetric.metric_name == metric_name,
                                LangGraphPerformanceMetric.recorded_at >= cutoff_date,
                            )
                        )
                    )
                    return float(result.scalar() or 0.0)

                attempts = int(await _sum_metric("aika_decision_parse_attempt"))
                failed = int(await _sum_metric("aika_decision_parse_failed"))
                repaired = int(await _sum_metric("aika_decision_parse_repaired"))
                unrecovered = int(await _sum_metric("aika_decision_parse_unrecovered"))

                failure_rate = (failed / attempts * 100.0) if attempts > 0 else 0.0
                unrecovered_rate = (unrecovered / attempts * 100.0) if attempts > 0 else 0.0
                recovery_rate = (repaired / failed * 100.0) if failed > 0 else 0.0

                warning = float(self._alert_thresholds["decision_parse_failure_warning_percent"])
                critical = float(self._alert_thresholds["decision_parse_failure_critical_percent"])
                status = "healthy"
                if attempts >= int(self._alert_thresholds["decision_parse_failure_min_samples"]):
                    if failure_rate >= critical:
                        status = "critical"
                    elif failure_rate >= warning:
                        status = "degraded"

                return {
                    "period_days": days,
                    "total_attempts": attempts,
                    "failed_parses": failed,
                    "repaired_parses": repaired,
                    "unrecovered_parses": unrecovered,
                    "parse_failure_rate_percent": round(failure_rate, 2),
                    "unrecovered_rate_percent": round(unrecovered_rate, 2),
                    "repair_recovery_rate_percent": round(recovery_rate, 2),
                    "warning_threshold_percent": warning,
                    "critical_threshold_percent": critical,
                    "status": status,
                }
        except Exception as e:
            print(f"Error getting decision parse health: {e}")
            return {
                "period_days": days,
                "total_attempts": 0,
                "failed_parses": 0,
                "repaired_parses": 0,
                "unrecovered_parses": 0,
                "parse_failure_rate_percent": 0.0,
                "unrecovered_rate_percent": 0.0,
                "repair_recovery_rate_percent": 0.0,
                "warning_threshold_percent": float(self._alert_thresholds["decision_parse_failure_warning_percent"]),
                "critical_threshold_percent": float(self._alert_thresholds["decision_parse_failure_critical_percent"]),
                "status": "unknown",
            }

    async def get_recent_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent alerts."""
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(LangGraphAlert)
                    .order_by(LangGraphAlert.created_at.desc())
                    .limit(limit)
                )
                
                alerts = []
                for alert in result.scalars().all():
                    alerts.append({
                        "id": alert.id,
                        "execution_id": alert.execution_id,
                        "alert_type": alert.alert_type,
                        "severity": alert.severity,
                        "title": alert.title,
                        "message": alert.message,
                        "created_at": alert.created_at.isoformat(),
                        "status": alert.status,
                        "threshold_value": alert.threshold_value,
                        "actual_value": alert.actual_value,
                        "metric_name": alert.metric_name
                    })
                
                return alerts
                
        except Exception as e:
            print(f"Error getting recent alerts: {e}")
            return []

# Global instance
execution_tracker = ExecutionStateTracker()