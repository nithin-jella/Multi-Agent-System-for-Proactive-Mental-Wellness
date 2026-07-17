from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Optional

from .io_utils import read_json, utc_now_iso, write_json
from .metrics import (
    compute_rq1_metrics,
    compute_rq2_metrics,
    compute_rq2b_metrics_from_judge_csv,
    compute_rq2b_metrics_from_tca_rows,
    read_csv_dicts,
)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                import json

                rows.append(json.loads(line))
            except Exception:
                continue
    return rows


def compute_trace_metrics(trace_rows: list[Mapping[str, Any]]) -> dict[str, Any]:
    """Compute retry/failure metrics from progress.jsonl (notebook trace)."""
    scheduled: set[str] = set()
    completed: dict[str, int] = {}
    failed: dict[str, int] = {}

    attempt_errors = 0
    attempt_starts = 0

    for row in trace_rows:
        event = str(row.get("event") or "")
        test_id = str(row.get("test_id") or "")
        if event == "test_scheduled" and test_id:
            scheduled.add(test_id)
        elif event == "test_attempt_start":
            attempt_starts += 1
        elif event == "test_attempt_error":
            attempt_errors += 1
        elif event == "test_completed" and test_id:
            try:
                completed[test_id] = int(row.get("attempts_used") or 1)
            except (TypeError, ValueError):
                completed[test_id] = 1
        elif event == "test_failed" and test_id:
            try:
                failed[test_id] = int(row.get("attempts_used") or 1)
            except (TypeError, ValueError):
                failed[test_id] = 1

    attempts_used_values = list(completed.values()) + list(failed.values())
    avg_attempts = None
    if attempts_used_values:
        avg_attempts = sum(attempts_used_values) / len(attempts_used_values)

    total_tests = len(scheduled) if scheduled else (len(completed) + len(failed))
    success_tests = len(completed)
    failed_tests = len(failed)

    return {
        "tests": {
            "scheduled": int(total_tests),
            "completed": int(success_tests),
            "failed": int(failed_tests),
            "success_rate": (success_tests / total_tests) if total_tests else None,
        },
        "attempts": {
            "attempt_starts": int(attempt_starts),
            "attempt_errors": int(attempt_errors),
            "avg_attempts_used": avg_attempts,
            "max_attempts_used": max(attempts_used_values) if attempts_used_values else None,
        },
    }


def compute_metrics_for_run_dir(run_dir: Path) -> dict[str, Any]:
    """Compute metrics from a run folder (notebook or headless runner)."""

    metrics: dict[str, Any] = {
        "computed_at": utc_now_iso(),
        "run_dir": str(run_dir),
    }

    manifest_path = run_dir / "manifest.json"
    if manifest_path.exists():
        metrics["manifest"] = read_json(manifest_path)

    # RQ1
    rq1_candidates = [
        run_dir / "rq1_triage_results.csv",
        run_dir / "rq1_results.csv",
    ]
    for p in rq1_candidates:
        if p.exists():
            rq1_rows = read_csv_dicts(p)
            metrics["rq1"] = compute_rq1_metrics(rq1_rows)
            metrics["rq1"]["source"] = str(p.name)
            break

    # RQ2
    rq2_candidates = [
        run_dir / "rq2_orchestration_results.csv",
        run_dir / "rq2_results.csv",
    ]
    for p in rq2_candidates:
        if p.exists():
            rq2_rows = read_csv_dicts(p)
            metrics["rq2"] = compute_rq2_metrics(rq2_rows)
            metrics["rq2"]["source"] = str(p.name)
            break

    # RQ2B
    rq2b_generated = run_dir / "rq2b_generated.json"
    if rq2b_generated.exists():
        rq2b_rows = read_json(rq2b_generated)
        if isinstance(rq2b_rows, list):
            metrics["rq2b"] = {"tca_structural": compute_rq2b_metrics_from_tca_rows(rq2b_rows)}
            metrics["rq2b"]["source_generated"] = str(rq2b_generated.name)

    # Optional: LLM judge CSV (may be written outside RUN_DIR by older notebook versions)
    rq2b_judge_candidates = [
        run_dir / "rq2b_judge_results.csv",
        run_dir.parent / "thesis_evaluation_results_rq3.csv",
    ]
    for p in rq2b_judge_candidates:
        if p.exists():
            judge_rows = read_csv_dicts(p)
            rq2b_judge = compute_rq2b_metrics_from_judge_csv(judge_rows)
            metrics.setdefault("rq2b", {})
            metrics["rq2b"]["llm_judge"] = rq2b_judge
            metrics["rq2b"]["source_judge"] = str(p)
            break

    # RQ3 privacy metrics if notebook wrote them
    rq3_priv = run_dir / "rq3_privacy_metrics.json"
    if rq3_priv.exists():
        metrics["rq3"] = read_json(rq3_priv)

    # Traceability / retry metrics
    trace_path = run_dir / "progress.jsonl"
    if trace_path.exists():
        trace_rows = _read_jsonl(trace_path)
        metrics["trace"] = compute_trace_metrics(trace_rows)

    return metrics


def compute_and_write_metrics_for_run_dir(run_dir: Path) -> Path:
    metrics = compute_metrics_for_run_dir(run_dir)
    out = run_dir / "metrics.json"
    write_json(out, metrics)
    return out
