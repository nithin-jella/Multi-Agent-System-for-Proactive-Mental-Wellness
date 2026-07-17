from __future__ import annotations

import csv
import math
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional, Sequence


def _as_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if value == 0:
            return False
        if value == 1:
            return True
        return None
    text = str(value).strip().lower()
    if text in {"true", "t", "yes", "y", "1"}:
        return True
    if text in {"false", "f", "no", "n", "0"}:
        return False
    return None


def _safe_div(num: float, den: float) -> Optional[float]:
    if den == 0:
        return None
    return num / den


def _percent(values: Sequence[float], q: float) -> Optional[float]:
    if not values:
        return None
    if q <= 0:
        return float(min(values))
    if q >= 100:
        return float(max(values))
    xs = sorted(values)
    pos = (len(xs) - 1) * (q / 100.0)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return float(xs[lo])
    frac = pos - lo
    return float(xs[lo] * (1.0 - frac) + xs[hi] * frac)


def _summary_stats(values: Sequence[float]) -> dict[str, Any]:
    if not values:
        return {"n": 0}
    return {
        "n": int(len(values)),
        "mean": float(statistics.fmean(values)),
        "stdev": float(statistics.pstdev(values)) if len(values) > 1 else 0.0,
        "min": float(min(values)),
        "p50": _percent(values, 50.0),
        "p90": _percent(values, 90.0),
        "p95": _percent(values, 95.0),
        "p99": _percent(values, 99.0),
        "max": float(max(values)),
    }


@dataclass(frozen=True)
class ConfusionCounts:
    tp: int
    fp: int
    tn: int
    fn: int

    @property
    def total(self) -> int:
        return self.tp + self.fp + self.tn + self.fn


def _binary_confusion(y_true: Sequence[bool], y_pred: Sequence[bool]) -> ConfusionCounts:
    tp = fp = tn = fn = 0
    for yt, yp in zip(y_true, y_pred, strict=False):
        if yt and yp:
            tp += 1
        elif (not yt) and yp:
            fp += 1
        elif (not yt) and (not yp):
            tn += 1
        elif yt and (not yp):
            fn += 1
    return ConfusionCounts(tp=tp, fp=fp, tn=tn, fn=fn)


def compute_rq1_metrics(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """RQ1 crisis detection metrics.

    Expects each row to include at least:
      - is_crisis: bool
      - predicted_crisis: bool
    Optionally:
      - category: str
      - elapsed_s: float
    """

    y_true: list[bool] = []
    y_pred: list[bool] = []
    latencies: list[float] = []
    categories: list[str] = []

    for row in rows:
        yt = _as_bool(row.get("is_crisis"))
        yp = _as_bool(row.get("predicted_crisis"))
        if yt is None or yp is None:
            continue
        y_true.append(bool(yt))
        y_pred.append(bool(yp))

        cat = row.get("category")
        if isinstance(cat, str) and cat.strip():
            categories.append(cat.strip())

        elapsed = row.get("elapsed_s")
        try:
            if elapsed is not None:
                latencies.append(float(elapsed))
        except (TypeError, ValueError):
            pass

    c = _binary_confusion(y_true, y_pred)
    precision = _safe_div(c.tp, c.tp + c.fp)
    recall = _safe_div(c.tp, c.tp + c.fn)  # sensitivity
    specificity = _safe_div(c.tn, c.tn + c.fp)
    accuracy = _safe_div(c.tp + c.tn, c.total)
    f1 = (
        None
        if precision is None or recall is None or (precision + recall) == 0
        else (2.0 * precision * recall) / (precision + recall)
    )

    # Emphasize recall (safety) with F2 (beta=2):
    # F_beta = (1+beta^2) * P*R / (beta^2*P + R)
    beta2 = 4.0
    f2 = (
        None
        if precision is None or recall is None or (beta2 * precision + recall) == 0
        else (1.0 + beta2) * precision * recall / (beta2 * precision + recall)
    )

    fnr = _safe_div(c.fn, c.fn + c.tp)
    fpr = _safe_div(c.fp, c.fp + c.tn)
    npv = _safe_div(c.tn, c.tn + c.fn)
    balanced_acc = (
        None
        if recall is None or specificity is None
        else 0.5 * (recall + specificity)
    )

    # Matthews Correlation Coefficient
    denom = math.sqrt(
        (c.tp + c.fp) * (c.tp + c.fn) * (c.tn + c.fp) * (c.tn + c.fn)
    )
    mcc = None if denom == 0 else ((c.tp * c.tn) - (c.fp * c.fn)) / denom

    metrics: dict[str, Any] = {
        "n": int(c.total),
        "confusion": {"tp": c.tp, "fp": c.fp, "tn": c.tn, "fn": c.fn},
        "accuracy": accuracy,
        "precision": precision,
        "recall_sensitivity": recall,
        "specificity": specificity,
        "f1": f1,
        "f2": f2,
        "false_negative_rate": fnr,
        "false_positive_rate": fpr,
        "negative_predictive_value": npv,
        "balanced_accuracy": balanced_acc,
        "mcc": mcc,
        "latency_s": _summary_stats(latencies),
    }

    if categories:
        by_cat: dict[str, Any] = {}
        unique = sorted(set(categories))
        for cat in unique:
            subset = [r for r in rows if str(r.get("category", "")).strip() == cat]
            by_cat[cat] = compute_rq1_metrics(subset)
        metrics["by_category"] = by_cat
        metrics["category_counts"] = dict(Counter(categories))

    return metrics


def compute_rq2_metrics(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """RQ2 orchestration metrics.

    Expects per-turn rows similar to `research_eval_runner.run_rq2_orchestration` outputs:
      - flow_id, turn_idx, expected_* fields
      - intent_ok, risk_ok, agent_ok (bool or None)
      - actual_* fields (optional, for confusion summaries)
      - error (optional)
      - elapsed_s (optional)
    """

    total_turns = 0
    error_turns = 0
    latencies: list[float] = []

    intent_evaluated = intent_correct = 0
    risk_evaluated = risk_correct = 0
    agent_evaluated = agent_correct = 0
    all_evaluated = all_correct = 0

    intent_confusions: Counter[tuple[str, str]] = Counter()
    risk_confusions: Counter[tuple[str, str]] = Counter()
    agent_confusions: Counter[tuple[str, str]] = Counter()

    by_flow: dict[str, list[Mapping[str, Any]]] = defaultdict(list)

    for row in rows:
        flow_id = str(row.get("flow_id") or "")
        if flow_id:
            by_flow[flow_id].append(row)

        total_turns += 1
        if row.get("error"):
            error_turns += 1

        try:
            elapsed = row.get("elapsed_s")
            if elapsed is not None:
                latencies.append(float(elapsed))
        except (TypeError, ValueError):
            pass

        i_ok = _as_bool(row.get("intent_ok"))
        r_ok = _as_bool(row.get("risk_ok"))
        a_ok = _as_bool(row.get("agent_ok"))

        if i_ok is not None:
            intent_evaluated += 1
            if i_ok:
                intent_correct += 1
            else:
                exp = str(row.get("expected_intent") or "")
                act = str(row.get("actual_intent") or "")
                if exp and act:
                    intent_confusions[(exp, act)] += 1

        if r_ok is not None:
            risk_evaluated += 1
            if r_ok:
                risk_correct += 1
            else:
                exp = str(row.get("expected_risk") or "")
                act = str(row.get("actual_risk") or "")
                if exp and act:
                    risk_confusions[(exp, act)] += 1

        if a_ok is not None:
            agent_evaluated += 1
            if a_ok:
                agent_correct += 1
            else:
                exp = str(row.get("expected_next_agent") or "")
                act = str(row.get("actual_next_agent") or "")
                if exp and act:
                    agent_confusions[(exp, act)] += 1

        if i_ok is not None and r_ok is not None and a_ok is not None:
            all_evaluated += 1
            if i_ok and r_ok and a_ok:
                all_correct += 1

    def _top_pairs(counter: Counter[tuple[str, str]], limit: int = 10) -> list[dict[str, Any]]:
        return [
            {"expected": exp, "actual": act, "count": int(cnt)}
            for (exp, act), cnt in counter.most_common(limit)
        ]

    # Flow-level pass: all turns for a flow have (intent_ok & risk_ok & agent_ok) == True.
    flow_total = len(by_flow)
    flow_pass = 0
    flow_error = 0
    flow_incomplete = 0
    flow_turns_stats: list[int] = []

    for flow_id, flow_rows in by_flow.items():
        flow_turns_stats.append(len(flow_rows))
        if any(r.get("error") for r in flow_rows):
            flow_error += 1
            continue

        oks: list[bool] = []
        for r in flow_rows:
            i_ok = _as_bool(r.get("intent_ok"))
            r_ok = _as_bool(r.get("risk_ok"))
            a_ok = _as_bool(r.get("agent_ok"))
            if i_ok is None or r_ok is None or a_ok is None:
                flow_incomplete += 1
                oks.append(False)
                continue
            oks.append(bool(i_ok and r_ok and a_ok))

        if oks and all(oks):
            flow_pass += 1

    metrics: dict[str, Any] = {
        "turns": {
            "n": int(total_turns),
            "error_turns": int(error_turns),
            "error_rate": _safe_div(error_turns, total_turns),
            "intent_accuracy": _safe_div(intent_correct, intent_evaluated),
            "risk_accuracy": _safe_div(risk_correct, risk_evaluated),
            "agent_accuracy": _safe_div(agent_correct, agent_evaluated),
            "all_fields_accuracy": _safe_div(all_correct, all_evaluated),
            "coverage": {
                "intent_evaluated": int(intent_evaluated),
                "risk_evaluated": int(risk_evaluated),
                "agent_evaluated": int(agent_evaluated),
                "all_fields_evaluated": int(all_evaluated),
            },
            "latency_s": _summary_stats(latencies),
        },
        "flows": {
            "n": int(flow_total),
            "pass": int(flow_pass),
            "pass_rate": _safe_div(flow_pass, flow_total),
            "error_flows": int(flow_error),
            "incomplete_flows": int(flow_incomplete),
            "turns_per_flow": _summary_stats([float(x) for x in flow_turns_stats]),
        },
        "top_confusions": {
            "intent": _top_pairs(intent_confusions),
            "risk": _top_pairs(risk_confusions),
            "next_agent": _top_pairs(agent_confusions),
        },
    }

    return metrics


def compute_rq2b_metrics_from_tca_rows(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """RQ2B structural metrics from TCA/TCA response JSON.

    Expects runner-style rows:
      - scenario_id
      - category
      - prompt
      - tca_response: dict with keys plan_steps/resource_cards/next_check_in
    """

    plan_steps_counts: list[float] = []
    resource_counts: list[float] = []
    next_check_in_present = 0
    total = 0

    step_title_ok = 0
    step_desc_ok = 0
    step_total = 0

    card_url_ok = 0
    card_total = 0

    for row in rows:
        total += 1
        resp = row.get("tca_response")
        if not isinstance(resp, Mapping):
            continue

        steps = resp.get("plan_steps")
        if isinstance(steps, list):
            plan_steps_counts.append(float(len(steps)))
            for step in steps:
                if not isinstance(step, Mapping):
                    continue
                step_total += 1
                title = str(step.get("title") or "").strip()
                desc = str(step.get("description") or "").strip()
                if title:
                    step_title_ok += 1
                if desc:
                    step_desc_ok += 1

        cards = resp.get("resource_cards")
        if isinstance(cards, list):
            resource_counts.append(float(len(cards)))
            for card in cards:
                if not isinstance(card, Mapping):
                    continue
                card_total += 1
                url = str(card.get("url") or "").strip()
                if url and url != "#":
                    card_url_ok += 1

        if resp.get("next_check_in"):
            next_check_in_present += 1

    return {
        "n": int(total),
        "plan_steps_count": _summary_stats(plan_steps_counts),
        "resource_cards_count": _summary_stats(resource_counts),
        "next_check_in_present_rate": _safe_div(next_check_in_present, total),
        "plan_steps": {
            "n": int(step_total),
            "title_nonempty_rate": _safe_div(step_title_ok, step_total),
            "description_nonempty_rate": _safe_div(step_desc_ok, step_total),
        },
        "resource_cards": {
            "n": int(card_total),
            "url_present_rate": _safe_div(card_url_ok, card_total),
        },
    }


def compute_rq2b_metrics_from_judge_csv(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """RQ2B quality metrics from an LLM-judge CSV.

    Expects columns similar to thesis_evaluation_results_rq3.csv:
      - Safety, Empathy, Actionability, Relevance, Overall Score
    """

    def _get_float(row: Mapping[str, Any], key: str) -> Optional[float]:
        v = row.get(key)
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    dims = {
        "safety": "Safety",
        "empathy": "Empathy",
        "actionability": "Actionability",
        "relevance": "Relevance",
        "overall": "Overall Score",
    }

    per_dim: dict[str, list[float]] = {k: [] for k in dims}
    for row in rows:
        for dim, col in dims.items():
            score = _get_float(row, col)
            if score is not None:
                per_dim[dim].append(score)

    metrics: dict[str, Any] = {
        "n": int(max((len(v) for v in per_dim.values()), default=0)),
        "scores": {dim: _summary_stats(values) for dim, values in per_dim.items()},
    }

    # Threshold rates (common reporting): >=4 and >=3
    def _rate_at_least(values: Sequence[float], thr: float) -> Optional[float]:
        if not values:
            return None
        return sum(1 for v in values if v >= thr) / len(values)

    metrics["threshold_rates"] = {
        dim: {
            ">=4": _rate_at_least(values, 4.0),
            ">=3": _rate_at_least(values, 3.0),
        }
        for dim, values in per_dim.items()
    }

    return metrics


def compute_rq3_k_anonymity_metrics(
    *,
    k: int,
    raw_high: int,
    raw_critical: int,
    exposed_high: int,
    exposed_critical: int,
) -> dict[str, Any]:
    """RQ3 privacy metrics for the k-anonymity compliance test."""

    high_should_be_exposed = raw_high >= k
    critical_should_be_suppressed = raw_critical < k

    high_ok = (exposed_high == raw_high) if high_should_be_exposed else (exposed_high == 0)
    critical_ok = (exposed_critical == 0) if critical_should_be_suppressed else (exposed_critical == raw_critical)

    return {
        "k": int(k),
        "raw": {"high": int(raw_high), "critical": int(raw_critical)},
        "exposed": {"high": int(exposed_high), "critical": int(exposed_critical)},
        "checks": {
            "high_ok": bool(high_ok),
            "critical_ok": bool(critical_ok),
            "overall_pass": bool(high_ok and critical_ok),
        },
    }


def read_csv_dicts(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]
