from __future__ import annotations

import pytest

from app.services.api_performance import APIPerformanceService


@pytest.mark.unit
def test_api_performance_no_data_summary() -> None:
    svc = APIPerformanceService()
    assert svc.get_performance_summary()["status"] == "no_data"


@pytest.mark.unit
def test_api_performance_generates_endpoint_stats_and_alerts() -> None:
    svc = APIPerformanceService()

    # Force stats recompute on every record.
    svc._stats_update_interval = 0

    endpoint = "/api/test"

    # Mix of successes and errors, and slow response time to trigger warnings.
    for _ in range(10):
        svc.record_request(endpoint, "GET", 200, 3000)
    for _ in range(2):
        svc.record_request(endpoint, "GET", 500, 3000)

    key = f"GET:{endpoint}"
    assert key in svc.endpoint_stats

    stats = svc.endpoint_stats[key]
    assert stats.total_requests == 12
    assert stats.avg_response_time >= 3000
    assert stats.error_rate > 0
    assert stats.status_code_distribution[200] == 10
    assert stats.status_code_distribution[500] == 2

    alerts = svc.get_active_alerts()
    assert any(a["type"] == "slow_response" for a in alerts)
    assert any(a["type"] == "high_error_rate" for a in alerts)

    summary = svc.get_performance_summary()
    assert summary["status"] in {"warning", "critical"}


@pytest.mark.unit
def test_api_performance_trend_direction() -> None:
    svc = APIPerformanceService()
    svc._stats_update_interval = 0

    endpoint = "/api/trend"

    # Create two "halves": first slower, second faster.
    for _ in range(5):
        svc.record_request(endpoint, "GET", 200, 2000)
    for _ in range(5):
        svc.record_request(endpoint, "GET", 200, 500)

    trends = svc.get_performance_trends(hours=24)
    assert trends["overall_trend"] in {"improving", "stable", "declining", "insufficient_data"}
