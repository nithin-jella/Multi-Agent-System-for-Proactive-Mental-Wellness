"""Database connection pool monitoring and optimization."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from sqlalchemy import text
from sqlalchemy.pool import Pool

logger = logging.getLogger(__name__)

@dataclass
class ConnectionPoolStats:
    """Connection pool statistics."""
    pool_size: int
    checked_out_connections: int
    overflow_connections: int
    invalid_connections: int
    checked_in_connections: int
    total_connections: int
    utilization_percentage: float
    timestamp: datetime

@dataclass
class DatabasePerformanceMetrics:
    """Database performance metrics."""
    active_connections: int
    idle_connections: int
    waiting_connections: int
    slow_queries_count: int
    average_query_time: float
    lock_waits: int
    deadlocks: int
    timestamp: datetime

class DatabaseMonitoringService:
    """Service for monitoring database connections and performance."""
    
    def __init__(self, engine: AsyncEngine):
        self.engine = engine
        self.pool = engine.pool
        self.metrics_history: List[ConnectionPoolStats] = []
        self.performance_history: List[DatabasePerformanceMetrics] = []
        self.alert_thresholds = {
            'high_utilization': 80.0,  # 80% pool utilization
            'slow_query_threshold': 5.0,  # 5 seconds
            'max_waiting_connections': 5,
            'deadlock_threshold': 1,
        }
    
    def _get_pool_metric(self, method_name: str, default: float = 0.0) -> float:
        """Safely call a pool inspection method with graceful fallback."""
        pool = self.pool
        method = getattr(pool, method_name, None)

        # Fallback to sync engine pool when available (AsyncEngine proxy)
        if method is None and hasattr(self.engine, "sync_engine"):
            sync_pool = getattr(self.engine.sync_engine, "pool", None)
            if sync_pool is not None:
                method = getattr(sync_pool, method_name, None)

        if callable(method):
            try:
                result: Any = method()
                if isinstance(result, (int, float)):
                    return float(result)
                if result is None:
                    return default
                if hasattr(result, "__float__"):
                    try:
                        return float(result)  # type: ignore[arg-type]
                    except (TypeError, ValueError):
                        logger.debug("Pool method %s returned non-convertible value %s", method_name, result)
                else:
                    logger.debug("Pool method %s returned non-numeric value %s", method_name, result)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.debug("Error calling pool.%s: %s", method_name, exc)
        else:
            logger.debug("Pool %s has no method '%s'", type(self.pool).__name__, method_name)

        return default
    
    async def get_pool_stats(self) -> ConnectionPoolStats:
        """Get current connection pool statistics."""
        pool = self.pool
        
        # Get pool statistics
        pool_size = int(self._get_pool_metric('size'))
        checked_out = int(self._get_pool_metric('checkedout'))
        overflow = int(self._get_pool_metric('overflow'))
        invalid = int(self._get_pool_metric('invalid'))
        checked_in_default = max(pool_size - checked_out, 0)
        checked_in = int(self._get_pool_metric('checkedin', float(checked_in_default)))
        total = pool_size + overflow
        
        utilization = (checked_out / total * 100) if total > 0 else 0
        
        stats = ConnectionPoolStats(
            pool_size=pool_size,
            checked_out_connections=checked_out,
            overflow_connections=overflow,
            invalid_connections=invalid,
            checked_in_connections=checked_in,
            total_connections=total,
            utilization_percentage=utilization,
            timestamp=datetime.utcnow()
        )
        
        # Store in history (keep last 100 entries)
        self.metrics_history.append(stats)
        if len(self.metrics_history) > 100:
            self.metrics_history.pop(0)
        
        return stats
    
    async def get_database_performance(self) -> DatabasePerformanceMetrics:
        """Get database performance metrics."""
        async with self.engine.begin() as conn:
            try:
                # PostgreSQL-specific queries
                active_query = text("""
                    SELECT count(*) as active_connections
                    FROM pg_stat_activity 
                    WHERE state = 'active' AND pid != pg_backend_pid()
                """)
                
                idle_query = text("""
                    SELECT count(*) as idle_connections
                    FROM pg_stat_activity 
                    WHERE state = 'idle' AND pid != pg_backend_pid()
                """)
                
                waiting_query = text("""
                    SELECT count(*) as waiting_connections
                    FROM pg_stat_activity 
                    WHERE wait_event_type IS NOT NULL AND pid != pg_backend_pid()
                """)
                
                slow_queries_query = text("""
                    SELECT count(*) as slow_queries
                    FROM pg_stat_activity 
                    WHERE state = 'active' 
                    AND query_start < now() - interval '5 seconds'
                    AND pid != pg_backend_pid()
                """)
                
                avg_query_time_query = text("""
                    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (now() - query_start))), 0) as avg_time
                    FROM pg_stat_activity 
                    WHERE state = 'active' AND pid != pg_backend_pid()
                """)
                
                lock_waits_query = text("""
                    SELECT count(*) as lock_waits
                    FROM pg_stat_activity 
                    WHERE wait_event_type = 'Lock' AND pid != pg_backend_pid()
                """)
                
                # Execute queries
                active_result = await conn.execute(active_query)
                idle_result = await conn.execute(idle_query)
                waiting_result = await conn.execute(waiting_query)
                slow_result = await conn.execute(slow_queries_query)
                avg_time_result = await conn.execute(avg_query_time_query)
                lock_result = await conn.execute(lock_waits_query)
                
                active_connections = active_result.scalar() or 0
                idle_connections = idle_result.scalar() or 0
                waiting_connections = waiting_result.scalar() or 0
                slow_queries = slow_result.scalar() or 0
                avg_query_time = float(avg_time_result.scalar() or 0)
                lock_waits = lock_result.scalar() or 0
                
                # For deadlocks, we'd need to check pg_stat_database or logs
                # For now, setting to 0 as it requires more complex monitoring
                deadlocks = 0
                
            except Exception as e:
                logger.error(f"Error getting database performance metrics: {e}")
                # Return default metrics if query fails
                active_connections = idle_connections = waiting_connections = 0
                slow_queries = lock_waits = deadlocks = 0
                avg_query_time = 0.0
        
        metrics = DatabasePerformanceMetrics(
            active_connections=active_connections,
            idle_connections=idle_connections,
            waiting_connections=waiting_connections,
            slow_queries_count=slow_queries,
            average_query_time=avg_query_time,
            lock_waits=lock_waits,
            deadlocks=deadlocks,
            timestamp=datetime.utcnow()
        )
        
        # Store in history
        self.performance_history.append(metrics)
        if len(self.performance_history) > 100:
            self.performance_history.pop(0)
        
        return metrics
    
    async def check_health(self) -> Dict[str, Any]:
        """Comprehensive database health check."""
        pool_stats = await self.get_pool_stats()
        performance_metrics = await self.get_database_performance()
        
        alerts = []
        status = "healthy"
        
        # Check pool utilization
        if pool_stats.utilization_percentage > self.alert_thresholds['high_utilization']:
            alerts.append({
                "level": "warning",
                "message": f"High connection pool utilization: {pool_stats.utilization_percentage:.1f}%",
                "recommendation": "Consider increasing pool size or optimizing connection usage"
            })
            status = "warning"
        
        # Check for slow queries
        if performance_metrics.slow_queries_count > 0:
            alerts.append({
                "level": "warning",
                "message": f"{performance_metrics.slow_queries_count} slow queries detected",
                "recommendation": "Review and optimize slow queries, check for missing indexes"
            })
            status = "warning"
        
        # Check waiting connections
        if performance_metrics.waiting_connections > self.alert_thresholds['max_waiting_connections']:
            alerts.append({
                "level": "critical",
                "message": f"{performance_metrics.waiting_connections} connections waiting",
                "recommendation": "Check for lock contention, optimize queries, or increase connection limits"
            })
            status = "critical"
        
        # Check for lock waits
        if performance_metrics.lock_waits > 0:
            alerts.append({
                "level": "warning",
                "message": f"{performance_metrics.lock_waits} connections waiting for locks",
                "recommendation": "Review transaction patterns and reduce lock duration"
            })
            if status == "healthy":
                status = "warning"
        
        # Check average query time
        if performance_metrics.average_query_time > self.alert_thresholds['slow_query_threshold']:
            alerts.append({
                "level": "warning",
                "message": f"High average query time: {performance_metrics.average_query_time:.2f}s",
                "recommendation": "Profile and optimize database queries"
            })
            if status == "healthy":
                status = "warning"
        
        return {
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "pool_stats": {
                "size": pool_stats.pool_size,
                "active": pool_stats.checked_out_connections,
                "idle": pool_stats.checked_in_connections,
                "utilization": f"{pool_stats.utilization_percentage:.1f}%"
            },
            "performance": {
                "active_connections": performance_metrics.active_connections,
                "idle_connections": performance_metrics.idle_connections,
                "waiting_connections": performance_metrics.waiting_connections,
                "slow_queries": performance_metrics.slow_queries_count,
                "avg_query_time": f"{performance_metrics.average_query_time:.2f}s",
                "lock_waits": performance_metrics.lock_waits
            },
            "alerts": alerts,
            "recommendations": self._generate_optimization_recommendations(pool_stats, performance_metrics)
        }
    
    def _generate_optimization_recommendations(
        self, 
        pool_stats: ConnectionPoolStats, 
        performance_metrics: DatabasePerformanceMetrics
    ) -> List[str]:
        """Generate optimization recommendations based on metrics."""
        recommendations = []
        
        # Pool optimization
        if pool_stats.utilization_percentage > 70:
            recommendations.append(
                "Consider increasing connection pool size to handle peak loads"
            )
        
        if pool_stats.overflow_connections > 0:
            recommendations.append(
                "Overflow connections detected - consider increasing base pool size"
            )
        
        # Performance optimization
        if performance_metrics.average_query_time > 1.0:
            recommendations.append(
                "High average query time detected - review indexes and query optimization"
            )
        
        if performance_metrics.waiting_connections > 2:
            recommendations.append(
                "Multiple connections waiting - check for lock contention and transaction duration"
            )
        
        # Connection management
        if performance_metrics.idle_connections > pool_stats.pool_size * 0.5:
            recommendations.append(
                "Many idle connections - consider implementing connection lifecycle management"
            )
        
        # General recommendations
        if not recommendations:
            recommendations.append(
                "✅ Database performance is optimal - continue monitoring"
            )
        
        return recommendations
    
    async def get_connection_history(self, hours: int = 24) -> Dict[str, List]:
        """Get connection pool history for the specified time period."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        filtered_metrics = [
            m for m in self.metrics_history 
            if m.timestamp >= cutoff_time
        ]
        
        filtered_performance = [
            p for p in self.performance_history 
            if p.timestamp >= cutoff_time
        ]
        
        return {
            "pool_history": [
                {
                    "timestamp": m.timestamp.isoformat(),
                    "utilization": m.utilization_percentage,
                    "active": m.checked_out_connections,
                    "total": m.total_connections
                }
                for m in filtered_metrics
            ],
            "performance_history": [
                {
                    "timestamp": p.timestamp.isoformat(),
                    "active_connections": p.active_connections,
                    "waiting_connections": p.waiting_connections,
                    "avg_query_time": p.average_query_time,
                    "slow_queries": p.slow_queries_count
                }
                for p in filtered_performance
            ]
        }
    
    async def optimize_pool_settings(self) -> Dict[str, Any]:
        """Analyze metrics and suggest pool optimization settings."""
        if not self.metrics_history:
            return {"message": "No metrics available for analysis"}
        
        # Analyze recent metrics
        recent_metrics = self.metrics_history[-20:]  # Last 20 measurements
        avg_utilization = sum(m.utilization_percentage for m in recent_metrics) / len(recent_metrics)
        max_utilization = max(m.utilization_percentage for m in recent_metrics)
        avg_overflow = sum(m.overflow_connections for m in recent_metrics) / len(recent_metrics)
        
        suggestions = {
            "current_analysis": {
                "average_utilization": f"{avg_utilization:.1f}%",
                "peak_utilization": f"{max_utilization:.1f}%",
                "average_overflow": f"{avg_overflow:.1f}",
                "current_pool_size": int(self._get_pool_metric('size'))
            },
            "recommendations": []
        }
        
        # Pool size recommendations
        if max_utilization > 90:
            current_size = max(int(self._get_pool_metric('size')), 1)
            new_size = max(int(current_size * 1.5), current_size + 1)
            suggestions["recommendations"].append({
                "setting": "pool_size",
                "current": current_size,
                "recommended": new_size,
                "reason": f"Peak utilization {max_utilization:.1f}% is too high"
            })
        
        if avg_overflow > 2:
            suggestions["recommendations"].append({
                "setting": "max_overflow",
                "current": getattr(self.pool, '_max_overflow', 'unknown'),
                "recommended": "increase by 5-10",
                "reason": f"Average overflow {avg_overflow:.1f} indicates insufficient overflow capacity"
            })
        
        # Connection timeout recommendations
        if len(self.performance_history) > 0:
            recent_performance = self.performance_history[-10:]
            avg_waiting = sum(p.waiting_connections for p in recent_performance) / len(recent_performance)
            
            if avg_waiting > 1:
                suggestions["recommendations"].append({
                    "setting": "pool_timeout",
                    "current": "check current timeout",
                    "recommended": "reduce to 10-15 seconds",
                    "reason": f"Average {avg_waiting:.1f} waiting connections suggests timeout issues"
                })
        
        if not suggestions["recommendations"]:
            suggestions["recommendations"].append({
                "message": "✅ Current pool settings appear optimal based on recent metrics"
            })
        
        return suggestions


# Global monitoring service instance
monitoring_service: Optional[DatabaseMonitoringService] = None

def get_monitoring_service(engine: AsyncEngine) -> DatabaseMonitoringService:
    """Get or create the global monitoring service instance."""
    global monitoring_service
    if monitoring_service is None or monitoring_service.engine != engine:
        monitoring_service = DatabaseMonitoringService(engine)
    return monitoring_service