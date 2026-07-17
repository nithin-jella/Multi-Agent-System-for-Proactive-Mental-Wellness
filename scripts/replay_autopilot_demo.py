from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

# Ensure backend app imports are available when script is run from repository root.
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
import httpx

from app.database import AsyncSessionLocal
 
# HACKATHON: Default chain changed to BSC Testnet for BNB Chain hackathon.
# TODO: Make configurable via environment variable (e.g., AUTOPILOT_DEMO_CHAIN_ID=97)
# NOTE: opBNB Testnet chain ID is 5611, Mainnet is 204
DEFAULT_BADGE_CHAIN_ID = int(os.getenv("AUTOPILOT_DEMO_CHAIN_ID", "97"))

EXPLORER_BASE_BY_CHAIN_ID: dict[int, str] = {
    656476: "https://edu-chain-testnet.blockscout.com/tx/",
    97: "https://testnet.bscscan.com/tx/",
    56: "https://bscscan.com/tx/",
    5611: "https://opbnb-testnet.bscscan.com/tx/",
}

SCENARIO_DEFINITIONS: dict[str, dict[str, Any]] = {
    "attestation_pipeline": {
        "description": "Simulates attestation publication lane with one auto-allowed action and one approval-gated action.",
        "action_a_type": "publish_attestation",
        "action_a_risk": "low",
        "action_b_type": "publish_attestation",
        "action_b_risk": "high",
    },
    "case_management": {
        "description": "Simulates case-management decisions: urgent case creation plus approval-gated follow-up check-in.",
        "action_a_type": "create_case",
        "action_a_risk": "high",
        "action_b_type": "create_checkin",
        "action_b_risk": "high",
    },
    "mixed_operations": {
        "description": "Simulates mixed operation flow: badge minting with attestation publication under policy gating.",
        "action_a_type": "mint_badge",
        "action_a_risk": "low",
        "action_b_type": "publish_attestation",
        "action_b_risk": "moderate",
    },
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _explorer_tx_url(chain_id: int | None, tx_hash: str | None) -> str | None:
    if chain_id is None or not tx_hash:
        return None
    base = EXPLORER_BASE_BY_CHAIN_ID.get(chain_id)
    return f"{base}{tx_hash}" if base else None


def _synthetic_tx_hash(action_id: int, idempotency_key: str) -> str:
    raw = f"demo:{action_id}:{idempotency_key}:{datetime.now(timezone.utc).isoformat()}"
    return f"0x{hashlib.sha256(raw.encode('utf-8')).hexdigest()}"


def _api_base_url() -> str:
    return os.getenv("AUTOPILOT_DEMO_API_BASE_URL", "http://localhost:22001").rstrip("/")


def _policy_decision(
    *,
    action_type: Literal["publish_attestation", "mint_badge", "create_checkin", "create_case"],
    risk_level: Literal["none", "low", "moderate", "high", "critical"],
) -> tuple[str, bool]:
    if action_type == "create_case":
        if risk_level in {"high", "critical"}:
            return "allow", False
        if risk_level == "moderate":
            return "require_approval", True
        return "deny", False

    if action_type == "create_checkin":
        if risk_level in {"none", "low", "moderate"}:
            return "allow", False
        return "require_approval", True

    # publish_attestation / mint_badge
    if risk_level in {"none", "low", "moderate"}:
        return "allow", False
    return "require_approval", True


def _resolve_scenario_actions() -> dict[str, Any]:
    scenario = os.getenv("AUTOPILOT_DEMO_SCENARIO", "attestation_pipeline").strip().lower()
    if scenario not in SCENARIO_DEFINITIONS:
        scenario = "attestation_pipeline"

    defaults = SCENARIO_DEFINITIONS[scenario]
    action_a_type = os.getenv("AUTOPILOT_DEMO_ACTION_A_TYPE", defaults["action_a_type"]).strip().lower()
    action_a_risk = os.getenv("AUTOPILOT_DEMO_ACTION_A_RISK", defaults["action_a_risk"]).strip().lower()
    action_b_type = os.getenv("AUTOPILOT_DEMO_ACTION_B_TYPE", defaults["action_b_type"]).strip().lower()
    action_b_risk = os.getenv("AUTOPILOT_DEMO_ACTION_B_RISK", defaults["action_b_risk"]).strip().lower()

    allowed_action_types = {"publish_attestation", "mint_badge", "create_checkin", "create_case"}
    allowed_risk_levels = {"none", "low", "moderate", "high", "critical"}

    if action_a_type not in allowed_action_types:
        action_a_type = defaults["action_a_type"]
    if action_b_type not in allowed_action_types:
        action_b_type = defaults["action_b_type"]
    if action_a_risk not in allowed_risk_levels:
        action_a_risk = defaults["action_a_risk"]
    if action_b_risk not in allowed_risk_levels:
        action_b_risk = defaults["action_b_risk"]

    auto_approve = os.getenv("AUTOPILOT_DEMO_AUTO_APPROVE", "true").strip().lower() in {"1", "true", "yes", "on"}

    return {
        "scenario": scenario,
        "description": defaults["description"],
        "action_a_type": action_a_type,
        "action_a_risk": action_a_risk,
        "action_b_type": action_b_type,
        "action_b_risk": action_b_risk,
        "auto_approve": auto_approve,
    }


async def _resolve_demo_user() -> dict[str, Any]:
    demo_email = os.getenv("AUTOPILOT_DEMO_EMAIL", "autopilot-demo@example.com").strip().lower()
    explicit_user_id = os.getenv("AUTOPILOT_DEMO_USER_ID", "").strip()

    async with AsyncSessionLocal() as db:
        if explicit_user_id:
            explicit = (
                await db.execute(
                    text("SELECT id, email FROM users WHERE id = :id LIMIT 1"),
                    {"id": int(explicit_user_id)},
                )
            ).mappings().first()
            if explicit:
                return dict(explicit)

        existing = (
            await db.execute(
                text("SELECT id, email FROM users WHERE lower(email) = :email LIMIT 1"),
                {"email": demo_email},
            )
        ).mappings().first()
        if existing:
            return dict(existing)

        fallback_admin = (
            await db.execute(
                text(
                    """
                    SELECT id, email
                    FROM users
                    WHERE role = 'admin' AND is_active = true
                    ORDER BY id ASC
                    LIMIT 1
                    """
                )
            )
        ).mappings().first()
        if fallback_admin:
            return dict(fallback_admin)

        raise RuntimeError(
            "No eligible demo user found. Set AUTOPILOT_DEMO_USER_ID or AUTOPILOT_DEMO_EMAIL to an existing account."
        )


async def _api_login() -> tuple[str, dict[str, Any]]:
    existing_token = os.getenv("AUTOPILOT_DEMO_ACCESS_TOKEN", "").strip()
    base_url = _api_base_url()

    async with httpx.AsyncClient(timeout=60.0) as client:
        if existing_token:
            me_response = await client.get(
                f"{base_url}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {existing_token}"},
            )
            me_response.raise_for_status()
            return existing_token, me_response.json()

        email = os.getenv("AUTOPILOT_DEMO_AUTH_EMAIL", os.getenv("ADMIN_EMAIL", "")).strip()
        password = os.getenv("AUTOPILOT_DEMO_AUTH_PASSWORD", os.getenv("ADMIN_PASSWORD", "")).strip()
        if not email or not password:
            raise RuntimeError(
                "Set AUTOPILOT_DEMO_ACCESS_TOKEN or AUTOPILOT_DEMO_AUTH_EMAIL/AUTOPILOT_DEMO_AUTH_PASSWORD."
            )

        response: httpx.Response | None = None
        last_error: Exception | None = None
        for _ in range(5):
            try:
                response = await client.post(
                    f"{base_url}/api/v1/auth/token",
                    json={"email": email, "password": password},
                )
                response.raise_for_status()
                break
            except Exception as exc:
                last_error = exc
                await asyncio.sleep(1.5)
        if response is None:
            raise RuntimeError(f"Failed login after retries: {last_error}")

        body = response.json()
        token = body.get("access_token")
        user = body.get("user")
        if not token or not isinstance(user, dict):
            raise RuntimeError("Invalid auth response from /api/v1/auth/token")
        return str(token), user


async def _api_approve_action(client: httpx.AsyncClient, token: str, action_id: int, note: str) -> None:
    response = await client.post(
        f"{_api_base_url()}/api/v1/admin/autopilot/actions/{action_id}/approve",
        headers={"Authorization": f"Bearer {token}"},
        json={"note": note},
    )
    response.raise_for_status()


async def _api_get_action(client: httpx.AsyncClient, token: str, action_id: int) -> dict[str, Any]:
    response = await client.get(
        f"{_api_base_url()}/api/v1/admin/autopilot/actions/{action_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    response.raise_for_status()
    return response.json()


async def _wait_for_confirmed_actions(
    client: httpx.AsyncClient,
    token: str,
    action_ids: list[int],
    *,
    timeout_seconds: int,
    poll_seconds: float,
) -> dict[int, dict[str, Any]]:
    started = datetime.now(timezone.utc)
    last_seen: dict[int, dict[str, Any]] = {}

    while True:
        for action_id in action_ids:
            last_seen[action_id] = await _api_get_action(client, token, action_id)

        if all((last_seen.get(action_id, {}).get("status") == "confirmed") for action_id in action_ids):
            return last_seen

        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        if elapsed >= timeout_seconds:
            statuses = {str(action_id): (last_seen.get(action_id, {}).get("status") or "unknown") for action_id in action_ids}
            raise TimeoutError(
                f"Timed out waiting for confirmed actions after {timeout_seconds}s. Current statuses: {json.dumps(statuses)}"
            )

        await asyncio.sleep(poll_seconds)


async def _api_get_proof_actions(client: httpx.AsyncClient, token: str, user_id: int) -> list[dict[str, Any]]:
    response = await client.get(
        f"{_api_base_url()}/api/v1/proof/actions",
        headers={"Authorization": f"Bearer {token}"},
        params={"user_id": user_id, "limit": 100},
    )
    response.raise_for_status()
    body = response.json()
    return list(body.get("items") or [])


async def _enqueue_demo_action(
    *,
    user_id: int,
    action_type: Literal["publish_attestation", "mint_badge", "create_checkin", "create_case"],
    risk_level: Literal["none", "low", "moderate", "high", "critical"],
    run_id: str,
) -> dict[str, Any]:
    payload = {
        "user_id": user_id,
        "user_hash": f"demo-user-{user_id}",
        "session_id": f"demo-session-{run_id}",
        "intent": "autopilot_demo",
        "next_step": "autopilot_demo",
        "risk_level": risk_level,
        "chain_id": DEFAULT_BADGE_CHAIN_ID,
        "demo_run_id": run_id,
    }

    decision, requires_review = _policy_decision(action_type=action_type, risk_level=risk_level)
    status = "awaiting_approval" if decision == "require_approval" else ("queued" if decision == "allow" else "failed")

    idempotency_raw = f"demo:{run_id}:{action_type}:{risk_level}:{user_id}"
    idempotency_key = hashlib.sha256(idempotency_raw.encode("utf-8")).hexdigest()
    payload_hash = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                INSERT INTO autopilot_actions
                (action_type, risk_level, policy_decision, status, idempotency_key, payload_hash, payload_json, requires_human_review, retry_count)
                VALUES
                (:action_type, :risk_level, :policy_decision, :status, :idempotency_key, :payload_hash, :payload_json, :requires_human_review, :retry_count)
                """
            ),
            {
                "action_type": action_type,
                "risk_level": risk_level,
                "policy_decision": decision,
                "status": status,
                "idempotency_key": idempotency_key,
                "payload_hash": payload_hash,
                "payload_json": json.dumps(payload),
                "requires_human_review": requires_review,
                "retry_count": 0,
            },
        )
        await db.commit()
        created = (
            await db.execute(
                text("SELECT * FROM autopilot_actions WHERE idempotency_key = :idempotency_key LIMIT 1"),
                {"idempotency_key": idempotency_key},
            )
        ).mappings().first()
        if not created:
            raise RuntimeError("Failed to create autopilot action")
        return dict(created)


async def _approve_action(action_id: int, reviewer_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                """
                UPDATE autopilot_actions
                SET status = 'approved', approved_by = :approved_by, approval_notes = :approval_notes,
                    updated_at = now(), requires_human_review = false
                WHERE id = :action_id
                """
            )
            ,
            {
                "approved_by": reviewer_id,
                "approval_notes": "Replay demo approval",
                "action_id": action_id,
            },
        )
        await db.commit()


async def _execute_action_now(action_id: int) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        action = (
            await db.execute(text("SELECT id, idempotency_key, payload_json FROM autopilot_actions WHERE id = :id"), {"id": action_id})
        ).mappings().first()
        if not action:
            raise RuntimeError(f"Action not found: {action_id}")

        payload = action.get("payload_json") or {}
        if isinstance(payload, str):
            payload = json.loads(payload)

        tx_hash = _synthetic_tx_hash(int(action["id"]), str(action["idempotency_key"]))
        chain_id = int(payload.get("chain_id") or DEFAULT_BADGE_CHAIN_ID)

        await db.execute(
            text(
                """
                UPDATE autopilot_actions
                SET status = 'running', executed_at = now(), updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": action_id},
        )
        await db.execute(
            text(
                """
                UPDATE autopilot_actions
                SET status = 'confirmed', tx_hash = :tx_hash, chain_id = :chain_id,
                    error_message = NULL, executed_at = now(), updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": action_id, "tx_hash": tx_hash, "chain_id": chain_id},
        )
        await db.commit()

        refreshed = (
            await db.execute(text("SELECT * FROM autopilot_actions WHERE id = :id"), {"id": action_id})
        ).mappings().first()
        if not refreshed:
            raise RuntimeError(f"Action not found after execution: {action_id}")
        return dict(refreshed)


async def run_demo() -> dict[str, Any]:
    run_id = uuid.uuid4().hex[:10]
    started_at = _utc_now_iso()

    user = await _resolve_demo_user()
    user_id = int(user["id"])
    scenario_config = _resolve_scenario_actions()

    # Action A (scenario-defined)
    allow_action = await _enqueue_demo_action(
        user_id=user_id,
        action_type=scenario_config["action_a_type"],
        risk_level=scenario_config["action_a_risk"],
        run_id=run_id,
    )

    # Action B (scenario-defined)
    approval_action = await _enqueue_demo_action(
        user_id=user_id,
        action_type=scenario_config["action_b_type"],
        risk_level=scenario_config["action_b_risk"],
        run_id=run_id,
    )

    # Authenticate via API and use admin endpoints for governance transitions.
    token, auth_user = await _api_login()
    reviewer_id = int(auth_user.get("id") or user_id)

    if scenario_config["auto_approve"] and approval_action.get("status") == "awaiting_approval":
        async with httpx.AsyncClient(timeout=60.0) as client:
            await _api_approve_action(
                client,
                token,
                int(approval_action["id"]),
                note="Replay demo approval via API",
            )

    wait_timeout = int(os.getenv("AUTOPILOT_DEMO_WAIT_TIMEOUT_SECONDS", "90"))
    wait_interval = float(os.getenv("AUTOPILOT_DEMO_WAIT_INTERVAL_SECONDS", "2"))

    proof_error: str | None = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        final_actions = await _wait_for_confirmed_actions(
            client,
            token,
            [int(allow_action["id"]), int(approval_action["id"])],
            timeout_seconds=wait_timeout,
            poll_seconds=wait_interval,
        )
        try:
            proof_items = await _api_get_proof_actions(client, token, user_id=user_id)
        except Exception as exc:
            proof_items = []
            proof_error = str(exc)

    final_a = final_actions[int(allow_action["id"])]
    final_b = final_actions[int(approval_action["id"])]

    result_a = {
        "action_id": final_a["id"],
        "action_type": final_a["action_type"],
        "risk_level": final_a["risk_level"],
        "policy_decision": final_a["policy_decision"],
        "status": final_a["status"],
        "tx_hash": final_a.get("tx_hash"),
        "chain_id": final_a.get("chain_id"),
        "explorer_url": final_a.get("explorer_tx_url")
        or _explorer_tx_url(final_a.get("chain_id"), final_a.get("tx_hash")),
    }
    result_b = {
        "action_id": final_b["id"],
        "action_type": final_b["action_type"],
        "risk_level": final_b["risk_level"],
        "policy_decision": final_b["policy_decision"],
        "status": final_b["status"],
        "tx_hash": final_b.get("tx_hash"),
        "chain_id": final_b.get("chain_id"),
        "explorer_url": final_b.get("explorer_tx_url")
        or _explorer_tx_url(final_b.get("chain_id"), final_b.get("tx_hash")),
    }

    finished_at = _utc_now_iso()
    artifact = {
        "run_id": run_id,
        "started_at": started_at,
        "finished_at": finished_at,
        "user": {
            "id": user["id"],
            "email": user["email"],
        },
        "api": {
            "base_url": _api_base_url(),
            "auth_user_id": reviewer_id,
        },
        "notes": {
            "flow_mode": "hybrid_seed_db_execute_api",
            "scenario": scenario_config["scenario"],
            "scenario_description": scenario_config["description"],
            "scenario_parameters": {
                "action_a_type": scenario_config["action_a_type"],
                "action_a_risk": scenario_config["action_a_risk"],
                "action_b_type": scenario_config["action_b_type"],
                "action_b_risk": scenario_config["action_b_risk"],
                "auto_approve": scenario_config["auto_approve"],
            },
            "onchain_mode": "placeholder" if os.getenv("AUTOPILOT_ONCHAIN_PLACEHOLDER", "true").strip().lower() in {"1", "true", "yes", "on"} else "real-or-unimplemented",
            "warning": "If onchain_mode=placeholder, tx hashes are synthetic and not real blockchain submissions.",
        },
        "proof_snapshot": {
            "count": len(proof_items),
            "latest_action_ids": [item.get("id") for item in proof_items[:10]],
            "error": proof_error,
        },
        "actions": [result_a, result_b],
    }

    artifact_path = REPO_ROOT / "docs" / "autopilot_demo_artifact.json"
    artifact_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")

    return artifact


def main() -> None:
    artifact = asyncio.run(run_demo())
    print(json.dumps(artifact, indent=2))


if __name__ == "__main__":
    main()
