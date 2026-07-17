"""API performance analytics and monitoring service."""

import asyncio
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import statistics

from app.core.memory import get_redis_client

logger = logging.getLogger(__name__)

@dataclass
class RequestMetrics:
    """Individual request metrics."""
    endpoint: str
    method: str
    status_code: int
    duration_ms: float
    timestamp: datetime
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

@dataclass
class EndpointStats:
    """Aggregated endpoint statistics."""
    endpoint: str
    method: str
    total_requests: int
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    p95_response_time: float
    p99_response_time: float
    success_rate: float
    error_rate: float
    requests_per_minute: float
    status_code_distribution: Dict[int, int]
    last_updated: datetime

@dataclass
class PerformanceAlert:
    """Performance alert information."""
    alert_type: str
    severity: str
    message: str
    endpoint: str
    threshold: float
    current_value: float
    timestamp: datetime
    suggested_action: str

class APIPerformanceService:
    """Service for tracking and analyzing API performance."""
    
    def __init__(self, max_metrics_history: int = 10000):
        self.max_metrics_history = max_metrics_history
        self.metrics_history: deque = deque(maxlen=max_metrics_history)
        self.endpoint_stats: Dict[str, EndpointStats] = {}
        self.active_alerts: List[PerformanceAlert] = []
        
        # Performance thresholds (configurable)
        self.thresholds = {
            'slow_response_time': 2000,      # 2 seconds in ms
            'very_slow_response_time': 5000, # 5 seconds in ms
            'high_error_rate': 5.0,          # 5% error rate
            'critical_error_rate': 10.0,     # 10% error rate
            'low_success_rate': 95.0,        # Below 95% success rate
            'high_request_rate': 100,        # 100 requests per minute
        }
        
        # Start background tasks
        self._last_stats_update = datetime.utcnow()
        self._stats_update_interval = 60  # Update stats every minute
        self._redis_ttl_seconds = 3600
    
    def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Record a request metric."""
        metric = RequestMetrics(
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration_ms=duration_ms,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        self.metrics_history.append(metric)
        self._update_endpoint_stats_if_needed()

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._record_redis_metrics(metric))
        except RuntimeError:
            pass

    async def _record_redis_metrics(self, metric: RequestMetrics) -> None:
        try:
            redis = await get_redis_client()
            if not hasattr(redis, "hincrby"):
                return

            key = f"perf:stats:{metric.method}:{metric.endpoint}"
            await redis.hincrby(key, "count", 1)
            await redis.hincrbyfloat(key, "total_ms", float(metric.duration_ms))

            if 200 <= metric.status_code < 400:
                await redis.hincrby(key, "success_count", 1)
            else:
                await redis.hincrby(key, "error_count", 1)

            min_raw = await redis.hget(key, "min_ms")
            max_raw = await redis.hget(key, "max_ms")

            min_ms = float(min_raw) if min_raw is not None else float(metric.duration_ms)
            max_ms = float(max_raw) if max_raw is not None else float(metric.duration_ms)

            if float(metric.duration_ms) < min_ms:
                min_ms = float(metric.duration_ms)
            if float(metric.duration_ms) > max_ms:
                max_ms = float(metric.duration_ms)

            await redis.hset(key, mapping={
                "min_ms": f"{min_ms}",
                "max_ms": f"{max_ms}",
                "last_updated": datetime.utcnow().isoformat(),
            })
            await redis.expire(key, self._redis_ttl_seconds)
        except Exception as exc:
            logger.debug("Redis metrics update failed: %s", exc)
    
    def _update_endpoint_stats_if_needed(self):
        """Update endpoint statistics if enough time has passed."""
        now = datetime.utcnow()
        if (now - self._last_stats_update).seconds >= self._stats_update_interval:
            self._update_all_endpoint_stats()
            self._check_performance_alerts()
            self._last_stats_update = now
    
    def _update_all_endpoint_stats(self):
        """Update statistics for all endpoints."""
        # Group metrics by endpoint+method
        endpoint_metrics = defaultdict(list)
        cutoff_time = datetime.utcnow() - timedelta(hours=1)  # Last hour
        
        for metric in self.metrics_history:
            if metric.timestamp >= cutoff_time:
                key = f"{metric.method}:{metric.endpoint}"
                endpoint_metrics[key].append(metric)
        
        # Calculate stats for each endpoint
        for endpoint_key, metrics in endpoint_metrics.items():
            method, endpoint = endpoint_key.split(':', 1)
            self.endpoint_stats[endpoint_key] = self._calculate_endpoint_stats(
                endpoint, method, metrics
            )
    
    def _calculate_endpoint_stats(
        self, 
        endpoint: str, 
        method: str, 
        metrics: List[RequestMetrics]
    ) -> EndpointStats:
        """Calculate statistics for a specific endpoint."""
        if not metrics:
            return EndpointStats(
                endpoint=endpoint,
                method=method,
                total_requests=0,
                avg_response_time=0,
                min_response_time=0,
                max_response_time=0,
                p95_response_time=0,
                p99_response_time=0,
                success_rate=0,
                error_rate=0,
                requests_per_minute=0,
                status_code_distribution={},
                last_updated=datetime.utcnow()
            )
        
        # Response times
        response_times = [m.duration_ms for m in metrics]
        avg_response_time = statistics.mean(response_times)
        min_response_time = min(response_times)
        max_response_time = max(response_times)
        
        # Percentiles
        p95_response_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) > 20 else max_response_time
        p99_response_time = statistics.quantiles(response_times, n=100)[98] if len(response_times) > 100 else max_response_time
        
        # Success/error rates
        success_count = sum(1 for m in metrics if 200 <= m.status_code < 400)
        error_count = len(metrics) - success_count
        success_rate = (success_count / len(metrics)) * 100
        error_rate = (error_count / len(metrics)) * 100
        
        # Requests per minute
        if metrics:
            time_span = (metrics[-1].timestamp - metrics[0].timestamp).total_seconds() / 60
            requests_per_minute = len(metrics) / max(time_span, 1)
        else:
            requests_per_minute = 0
        
        # Status code distribution
        status_code_distribution = {}
        for metric in metrics:
            status_code_distribution[metric.status_code] = status_code_distribution.get(metric.status_code, 0) + 1
        
        return EndpointStats(
            endpoint=endpoint,
            method=method,
            total_requests=len(metrics),
            avg_response_time=avg_response_time,
            min_response_time=min_response_time,
            max_response_time=max_response_time,
            p95_response_time=p95_response_time,
            p99_response_time=p99_response_time,
            success_rate=success_rate,
            error_rate=error_rate,
            requests_per_minute=requests_per_minute,
            status_code_distribution=status_code_distribution,
            last_updated=datetime.utcnow()
        )
    
    def _check_performance_alerts(self):
        """Check for performance issues and generate alerts."""
        self.active_alerts.clear()
        
        for endpoint_key, stats in self.endpoint_stats.items():
            # Slow response time alerts
            if stats.avg_response_time > self.thresholds['very_slow_response_time']:
                self.active_alerts.append(PerformanceAlert(
                    alert_type='slow_response',
                    severity='critical',
                    message=f'Very slow average response time: {stats.avg_response_time:.0f}ms',
                    endpoint=stats.endpoint,
                    threshold=self.thresholds['very_slow_response_time'],
                    current_value=stats.avg_response_time,
                    timestamp=datetime.utcnow(),
                    suggested_action='Review endpoint performance, check database queries, consider caching'
                ))
            elif stats.avg_response_time > self.thresholds['slow_response_time']:
                self.active_alerts.append(PerformanceAlert(
                    alert_type='slow_response',
                    severity='warning',
                    message=f'Slow average response time: {stats.avg_response_time:.0f}ms',
                    endpoint=stats.endpoint,
                    threshold=self.thresholds['slow_response_time'],
                    current_value=stats.avg_response_time,
                    timestamp=datetime.utcnow(),
                    suggested_action='Monitor endpoint performance, consider optimization'
                ))
            
            # High error rate alerts
            if stats.error_rate > self.thresholds['critical_error_rate']:
                self.active_alerts.append(PerformanceAlert(
                    alert_type='high_error_rate',
                    severity='critical',
                    message=f'Critical error rate: {stats.error_rate:.1f}%',
                    endpoint=stats.endpoint,
                    threshold=self.thresholds['critical_error_rate'],
                    current_value=stats.error_rate,
                    timestamp=datetime.utcnow(),
                    suggested_action='Immediate investigation required - check logs and fix errors'
                ))
            elif stats.error_rate > self.thresholds['high_error_rate']:
                self.active_alerts.append(PerformanceAlert(
                    alert_type='high_error_rate',
                    severity='warning',
                    message=f'High error rate: {stats.error_rate:.1f}%',
                    endpoint=stats.endpoint,
                    threshold=self.thresholds['high_error_rate'],
                    current_value=stats.error_rate,
                    timestamp=datetime.utcnow(),
                    suggested_action='Review error patterns and implement fixes'
                ))
            
            # High traffic alerts
            if stats.requests_per_minute > self.thresholds['high_request_rate']:
                self.active_alerts.append(PerformanceAlert(
                    alert_type='high_traffic',
                    severity='info',
                    message=f'High traffic: {stats.requests_per_minute:.1f} req/min',
                    endpoint=stats.endpoint,
                    threshold=self.thresholds['high_request_rate'],
                    current_value=stats.requests_per_minute,
                    timestamp=datetime.utcnow(),
                    suggested_action='Monitor system resources and consider scaling'
                ))
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get overall API performance summary."""
        if not self.endpoint_stats:
            return {
                "status": "no_data",
                "message": "No performance data available yet"
            }
        
        # Calculate overall stats
        all_stats = list(self.endpoint_stats.values())
        total_requests = sum(stats.total_requests for stats in all_stats)
        avg_response_time = statistics.mean([stats.avg_response_time for stats in all_stats])
        overall_success_rate = statistics.mean([stats.success_rate for stats in all_stats])
        
        # Determine overall status
        critical_alerts = [a for a in self.active_alerts if a.severity == 'critical']
        warning_alerts = [a for a in self.active_alerts if a.severity == 'warning']
        
        if critical_alerts:
            status = "critical"
        elif warning_alerts:
            status = "warning"  
        else:
            status = "healthy"
        
        return {
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_endpoints": len(self.endpoint_stats),
                "total_requests_last_hour": total_requests,
                "average_response_time": f"{avg_response_time:.0f}ms",
                "overall_success_rate": f"{overall_success_rate:.1f}%"
            },
            "alerts": {
                "critical": len(critical_alerts),
                "warning": len(warning_alerts),
                "info": len([a for a in self.active_alerts if a.severity == 'info'])
            },
            "top_slow_endpoints": self._get_slowest_endpoints(5),
            "top_error_endpoints": self._get_highest_error_endpoints(5)
        }

    async def get_redis_summary(self) -> Dict[str, Any]:
        """Get a lightweight summary from Redis if available."""
        try:
            redis = await get_redis_client()
            if not hasattr(redis, "keys"):
                return {"status": "unavailable"}

            keys = await redis.keys("perf:stats:*")
            if not keys:
                return {"status": "no_data"}

            total_count = 0
            total_ms = 0.0
            total_success = 0
            total_error = 0

            for key in keys:
                data = await redis.hgetall(key)
                if not data:
                    continue
                total_count += int(float(data.get("count", 0)))
                total_ms += float(data.get("total_ms", 0.0))
                total_success += int(float(data.get("success_count", 0)))
                total_error += int(float(data.get("error_count", 0)))

            avg_ms = (total_ms / total_count) if total_count else 0.0
            success_rate = (total_success / total_count) * 100 if total_count else 0.0
            error_rate = (total_error / total_count) * 100 if total_count else 0.0

            return {
                "status": "ok",
                "total_requests": total_count,
                "avg_response_time_ms": round(avg_ms, 2),
                "success_rate_pct": round(success_rate, 2),
                "error_rate_pct": round(error_rate, 2),
            }
        except Exception as exc:
            return {"status": "error", "error": str(exc)}
    
    def _get_slowest_endpoints(self, limit: int = 5) -> List[Dict]:
        """Get the slowest endpoints."""
        sorted_endpoints = sorted(
            self.endpoint_stats.values(),
            key=lambda x: x.avg_response_time,
            reverse=True
        )
        
        return [
            {
                "endpoint": f"{stats.method} {stats.endpoint}",
                "avg_response_time": f"{stats.avg_response_time:.0f}ms",
                "requests": stats.total_requests
            }
            for stats in sorted_endpoints[:limit]
        ]
    
    def _get_highest_error_endpoints(self, limit: int = 5) -> List[Dict]:
        """Get endpoints with highest error rates."""
        sorted_endpoints = sorted(
            [stats for stats in self.endpoint_stats.values() if stats.error_rate > 0],
            key=lambda x: x.error_rate,
            reverse=True
        )
        
        return [
            {
                "endpoint": f"{stats.method} {stats.endpoint}",
                "error_rate": f"{stats.error_rate:.1f}%",
                "total_requests": stats.total_requests
            }
            for stats in sorted_endpoints[:limit]
        ]
    
    def get_endpoint_details(self, endpoint: str, method: Optional[str] = None) -> Dict[str, Any]:
        """Get detailed statistics for a specific endpoint."""
        if method:
            key = f"{method}:{endpoint}"
            if key in self.endpoint_stats:
                stats = self.endpoint_stats[key]
                return {
                    "endpoint": endpoint,
                    "method": method,
                    "statistics": asdict(stats),
                    "recent_requests": self._get_recent_requests(endpoint, method, 10)
                }
        else:
            # Return all methods for this endpoint
            matching_stats = {
                key: stats for key, stats in self.endpoint_stats.items()
                if stats.endpoint == endpoint
            }
            
            if matching_stats:
                return {
                    "endpoint": endpoint,
                    "methods": {
                        stats.method: asdict(stats) 
                        for stats in matching_stats.values()
                    }
                }
        
        return {"error": "Endpoint not found or no data available"}
    
    def _get_recent_requests(self, endpoint: str, method: str, limit: int) -> List[Dict]:
        """Get recent requests for an endpoint."""
        recent_requests = [
            {
                "status_code": m.status_code,
                "duration_ms": m.duration_ms,
                "timestamp": m.timestamp.isoformat(),
                "user_id": m.user_id
            }
            for m in reversed(list(self.metrics_history))
            if m.endpoint == endpoint and m.method == method
        ]
        
        return recent_requests[:limit]
    
    def get_active_alerts(self) -> List[Dict]:
        """Get all active performance alerts."""
        return [
            {
                "type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "endpoint": alert.endpoint,
                "threshold": alert.threshold,
                "current_value": alert.current_value,
                "timestamp": alert.timestamp.isoformat(),
                "suggested_action": alert.suggested_action
            }
            for alert in self.active_alerts
        ]
    
    def get_performance_trends(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance trends over time."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Filter metrics for the time period
        recent_metrics = [
            m for m in self.metrics_history
            if m.timestamp >= cutoff_time
        ]
        
        if not recent_metrics:
            return {"message": "No data available for the specified time period"}
        
        # Group by hour
        hourly_stats = defaultdict(list)
        for metric in recent_metrics:
            hour_key = metric.timestamp.replace(minute=0, second=0, microsecond=0)
            hourly_stats[hour_key].append(metric)
        
        # Calculate hourly trends
        trends = []
        for hour, metrics in sorted(hourly_stats.items()):
            response_times = [m.duration_ms for m in metrics]
            success_count = sum(1 for m in metrics if 200 <= m.status_code < 400)
            
            trends.append({
                "hour": hour.isoformat(),
                "request_count": len(metrics),
                "avg_response_time": statistics.mean(response_times),
                "success_rate": (success_count / len(metrics)) * 100 if metrics else 0
            })
        
        return {
            "time_period_hours": hours,
            "total_requests": len(recent_metrics),
            "hourly_trends": trends,
            "overall_trend": self._calculate_trend_direction(trends)
        }
    
    def _calculate_trend_direction(self, trends: List[Dict]) -> str:
        """Calculate if performance is improving or declining."""
        if len(trends) < 2:
            return "insufficient_data"
        
        # Compare first half vs second half
        mid_point = len(trends) // 2
        first_half_avg_response = statistics.mean([t["avg_response_time"] for t in trends[:mid_point]])
        second_half_avg_response = statistics.mean([t["avg_response_time"] for t in trends[mid_point:]])
        
        if second_half_avg_response < first_half_avg_response * 0.9:
            return "improving"
        elif second_half_avg_response > first_half_avg_response * 1.1:
            return "declining"
        else:
            return "stable"


# Global performance service instance
performance_service: Optional[APIPerformanceService] = None

def get_performance_service() -> APIPerformanceService:
    """Get or create the global performance service instance."""
    global performance_service
    if performance_service is None:
        performance_service = APIPerformanceService()
    return performance_service