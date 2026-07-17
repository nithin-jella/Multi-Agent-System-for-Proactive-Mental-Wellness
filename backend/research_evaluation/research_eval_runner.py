from __future__ import annotations

import argparse
import asyncio
import csv
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

from eval_lib.http_client import AuthContext, EvaluationHttpError, login_and_get_user_id
from eval_lib.io_utils import ensure_dir, read_json, sha256_file, utc_now_iso, write_json, write_jsonl
from eval_lib.metrics_run import compute_and_write_metrics_for_run_dir
from eval_lib.sse import extract_first_metadata_dict, iter_sse_events, try_parse_json


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR


@dataclass(frozen=True)
class RunnerConfig:
    backend_url: str
    eval_email: str
    eval_password: str
    admin_email: str
    admin_password: str
    out_dir: Path
    timeout_s: float


def _env(name: str, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise ValueError(f"Missing required env var: {name}")
    return value


def _risk_is_crisis(risk_level: str) -> bool:
    return str(risk_level).lower().strip() in {"high", "critical"}


async def _call_aika_sse(
    client: httpx.AsyncClient,
    config: RunnerConfig,
    auth: AuthContext,
    *,
    message: str,
    conversation_history: list[dict[str, str]],
    role: str = "user",
) -> dict[str, Any]:
    """Call /api/v1/aika and parse metadata + final response (notebook-compatible)."""

    payload = {
        "user_id": auth.user_id,
        "message": message,
        "role": role,
        "conversation_history": conversation_history,
    }

    headers = {
        "Authorization": f"Bearer {auth.access_token}",
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }

    t0 = time.perf_counter()
    lines: list[str] = []
    final_text_parts: list[str] = []

    async with client.stream(
        "POST",
        f"{config.backend_url}/api/v1/aika",
        headers=headers,
        json=payload,
        timeout=config.timeout_s,
    ) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if line is None:
                continue
            lines.append(line)

            # Try to capture final response text in multiple formats
            # - event: final_response with data: {"response": "..."}
            # - legacy data: {"type": "final_response", "response": "..."}
            if line.startswith("data:"):
                data_str = line[len("data:") :].lstrip()
                parsed = try_parse_json(data_str)
                if not parsed:
                    continue
                if parsed.get("type") == "final_response" and "response" in parsed:
                    final_text_parts.append(str(parsed.get("response")))
                if "response" in parsed and "type" not in parsed and "agents_invoked" not in parsed:
                    # Best-effort: some implementations may send response chunks
                    # as JSON with a `response` field.
                    pass

    metadata = extract_first_metadata_dict(lines)

    # Secondary attempt: if explicit final_response event exists, parse it
    if not final_text_parts:
        for ev in iter_sse_events(lines):
            if ev.event == "final_response":
                parsed = try_parse_json(ev.data)
                if parsed and "response" in parsed:
                    final_text_parts.append(str(parsed.get("response")))

    elapsed_s = time.perf_counter() - t0
    return {
        "metadata": metadata,
        "final_response": "\n".join([t for t in final_text_parts if t]).strip() or None,
        "elapsed_s": elapsed_s,
        "raw_sse_lines": lines,
    }


async def run_rq1_crisis_detection(
    client: httpx.AsyncClient,
    config: RunnerConfig,
    auth: AuthContext,
) -> list[dict[str, Any]]:
    dataset_path = DATA_DIR / "rq1_crisis_detection" / "conversation_scenarios.json"
    scenarios = read_json(dataset_path)

    results: list[dict[str, Any]] = []

    for scenario in scenarios:
        scenario_id = scenario.get("id")
        is_crisis = bool(scenario.get("is_crisis"))
        turns = scenario.get("turns", [])
        if not isinstance(turns, list) or not turns:
            continue

        # Evaluate only on the last user message by replaying prior turns into history
        history: list[dict[str, str]] = []
        last_user: Optional[str] = None
        for t in turns:
            role = str(t.get("role", ""))
            content = str(t.get("content", ""))
            if role in {"user", "assistant"} and content:
                history.append({"role": role, "content": content})
            if role == "user" and content:
                last_user = content

        if last_user is None:
            continue

        sse = await _call_aika_sse(
            client,
            config,
            auth,
            message=last_user,
            conversation_history=history[:-1],
            role="user",
        )

        metadata = sse.get("metadata") or {}
        risk_level = str(metadata.get("risk_level", "none"))
        predicted_crisis = _risk_is_crisis(risk_level)

        results.append(
            {
                "scenario_id": scenario_id,
                "category": scenario.get("category"),
                "is_crisis": is_crisis,
                "predicted_crisis": predicted_crisis,
                "risk_level": risk_level,
                "agents_invoked": metadata.get("agents_invoked"),
                "elapsed_s": sse.get("elapsed_s"),
            }
        )

    return results


async def run_rq2_orchestration(
    client: httpx.AsyncClient,
    config: RunnerConfig,
    auth: AuthContext,
) -> list[dict[str, Any]]:
    dataset_path = DATA_DIR / "rq2_orchestration" / "orchestration_flows.json"
    flows = read_json(dataset_path)

    results: list[dict[str, Any]] = []

    for flow in flows:
        flow_id = str(flow.get("flow_id"))
        conversation = flow.get("conversation", [])
        if not isinstance(conversation, list):
            continue

        history: list[dict[str, str]] = []
        for turn_idx, turn in enumerate(conversation):
            user_text = str(turn.get("user", ""))
            if not user_text:
                continue

            expected_intent = str(turn.get("expected_intent", ""))
            expected_risk = str(turn.get("expected_risk", ""))
            expected_next_agent = str(turn.get("expected_next_agent", ""))

            sse = await _call_aika_sse(
                client,
                config,
                auth,
                message=user_text,
                conversation_history=history,
                role="user",
            )

            metadata = sse.get("metadata") or {}

            # Notebook uses both old and new keys across versions.
            actual_intent = metadata.get("intent") or metadata.get("orchestration_intent")
            actual_risk = metadata.get("risk") or metadata.get("risk_level")
            actual_next_agent = (
                metadata.get("next_agent")
                or metadata.get("agent")
                or metadata.get("route_to")
            )

            # Fail-fast signal (notebook had `system_busy` handling)
            if metadata.get("system_busy") is True:
                results.append(
                    {
                        "flow_id": flow_id,
                        "turn_idx": turn_idx,
                        "user": user_text,
                        "error": "system_busy",
                        "expected_intent": expected_intent,
                        "expected_risk": expected_risk,
                        "expected_next_agent": expected_next_agent,
                    }
                )
                break

            intent_ok = (str(actual_intent).strip() == expected_intent) if expected_intent else None
            risk_ok = (str(actual_risk).strip().lower() == expected_risk.lower()) if expected_risk else None
            agent_ok = (str(actual_next_agent).strip() == expected_next_agent) if expected_next_agent else None

            results.append(
                {
                    "flow_id": flow_id,
                    "turn_idx": turn_idx,
                    "user": user_text,
                    "expected_intent": expected_intent,
                    "expected_risk": expected_risk,
                    "expected_next_agent": expected_next_agent,
                    "actual_intent": actual_intent,
                    "actual_risk": actual_risk,
                    "actual_next_agent": actual_next_agent,
                    "intent_ok": intent_ok,
                    "risk_ok": risk_ok,
                    "agent_ok": agent_ok,
                    "agents_invoked": metadata.get("agents_invoked"),
                    "elapsed_s": sse.get("elapsed_s"),
                }
            )

            # Update conversation history for next turn
            history.append({"role": "user", "content": user_text})
            final_resp = sse.get("final_response")
            if final_resp:
                history.append({"role": "assistant", "content": str(final_resp)})

    return results


async def run_rq2b_generate_coaching(
    client: httpx.AsyncClient,
    config: RunnerConfig,
    auth: AuthContext,
) -> list[dict[str, Any]]:
    dataset_path = DATA_DIR / "rq2b_coaching_quality" / "coaching_scenarios.json"
    scenarios = read_json(dataset_path)

    results: list[dict[str, Any]] = []

    for item in scenarios:
        scenario_id = str(item.get("scenario_id"))
        prompt = str(item.get("prompt", ""))
        if not scenario_id or not prompt:
            continue

        payload = {
            "session_id": f"eval_{scenario_id}",
            "intent": "emotional_support",
            "user_hash": f"eval_user_{auth.user_id}",
            "options": {
                "original_prompt": prompt,
                "plan_type": "general_coping",
                "use_gemini_plan": True,
            },
        }

        headers = {"Authorization": f"Bearer {auth.access_token}"}
        resp = await client.post(
            f"{config.backend_url}/api/agents/sca/intervene",
            json=payload,
            headers=headers,
            timeout=config.timeout_s,
        )
        if resp.status_code >= 400:
            raise EvaluationHttpError(
                f"TCA intervene failed for {scenario_id} ({resp.status_code}): {resp.text[:500]}"
            )

        results.append(
            {
                "scenario_id": scenario_id,
                "category": item.get("category"),
                "prompt": prompt,
                "tca_response": resp.json(),
            }
        )

    return results


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    fieldnames: list[str] = []
    seen = set()
    for row in rows:
        for k in row.keys():
            if k not in seen:
                seen.add(k)
                fieldnames.append(k)

    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_manifest(config: RunnerConfig) -> dict[str, Any]:
    files = {
        "rq1": DATA_DIR / "rq1_crisis_detection" / "conversation_scenarios.json",
        "rq2": DATA_DIR / "rq2_orchestration" / "orchestration_flows.json",
        "rq2b": DATA_DIR / "rq2b_coaching_quality" / "coaching_scenarios.json",
    }

    return {
        "created_at": utc_now_iso(),
        "backend_url": config.backend_url,
        "timeout_s": config.timeout_s,
        "datasets": {
            key: {
                "path": str(path.relative_to(ROOT_DIR)).replace("\\", "/"),
                "sha256": sha256_file(path),
            }
            for key, path in files.items()
            if path.exists()
        },
    }


async def main_async(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Headless thesis evaluation runner")
    parser.add_argument(
        "--backend-url",
        default=os.getenv("AIKA_BACKEND_URL", "http://127.0.0.1:22001"),
    )
    parser.add_argument("--out-dir", default=str(ROOT_DIR / "runs"))
    parser.add_argument("--timeout-s", type=float, default=300.0)

    parser.add_argument("--run-rq1", action="store_true")
    parser.add_argument("--run-rq2", action="store_true")
    parser.add_argument("--run-rq2b-generate", action="store_true")

    args = parser.parse_args(argv)

    if not (args.run_rq1 or args.run_rq2 or args.run_rq2b_generate):
        parser.error("Select at least one: --run-rq1, --run-rq2, --run-rq2b-generate")

    config = RunnerConfig(
        backend_url=str(args.backend_url).rstrip("/"),
        eval_email=_env("EVAL_USER_EMAIL", "evaluation_user@example.com"),
        eval_password=_env("EVAL_USER_PASSWORD"),
        admin_email=_env("ADMIN_EMAIL", "evaluation_user@example.com"),
        admin_password=_env("ADMIN_PASSWORD", _env("EVAL_USER_PASSWORD")),
        out_dir=Path(args.out_dir),
        timeout_s=float(args.timeout_s),
    )

    run_dir = ensure_dir(config.out_dir / utc_now_iso().replace(":", "-").replace("+", "_") )
    write_json(run_dir / "manifest.json", build_manifest(config))

    async with httpx.AsyncClient() as client:
        auth = await login_and_get_user_id(client, config.backend_url, config.eval_email, config.eval_password)

        if args.run_rq1:
            rq1 = await run_rq1_crisis_detection(client, config, auth)
            _write_csv(run_dir / "rq1_results.csv", rq1)
            write_jsonl(run_dir / "rq1_results.jsonl", rq1)

        if args.run_rq2:
            rq2 = await run_rq2_orchestration(client, config, auth)
            _write_csv(run_dir / "rq2_results.csv", rq2)
            write_jsonl(run_dir / "rq2_results.jsonl", rq2)

        if args.run_rq2b_generate:
            rq2b = await run_rq2b_generate_coaching(client, config, auth)
            write_json(run_dir / "rq2b_generated.json", rq2b)

    # Always write consolidated metrics if we have any outputs.
    metrics_path = compute_and_write_metrics_for_run_dir(run_dir)
    print(f"Wrote metrics to: {metrics_path}")

    print(f"Wrote outputs to: {run_dir}")
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(main_async(sys.argv[1:])))
    except (EvaluationHttpError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
