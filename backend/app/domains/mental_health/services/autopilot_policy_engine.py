from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.domains.mental_health.models.autopilot_actions import (
    AutopilotActionType,
    AutopilotPolicyDecision,
)


@dataclass(frozen=True)
class PolicyEvaluationResult:
    decision: AutopilotPolicyDecision
    rationale: str


def _normalize_risk_level(risk_level: str | None) -> str:
    raw = (risk_level or "none").strip().lower()
    aliases = {
        "med": "moderate",
        "medium": "moderate",
    }
    normalized = aliases.get(raw, raw)
    if normalized not in {"none", "low", "moderate", "high", "critical"}:
        return "none"
    return normalized


def evaluate_action_policy(
    *,
    risk_level: str | None,
    action_type: AutopilotActionType,
    context: dict[str, Any] | None = None,
) -> PolicyEvaluationResult:
    level = _normalize_risk_level(risk_level)
    _ = context or {}

    if action_type == AutopilotActionType.create_case:
        if level in {"moderate", "high", "critical"}:
            return PolicyEvaluationResult(
                decision=AutopilotPolicyDecision.allow,
                rationale="Safety escalation is allowed for moderate/high/critical risk",
            )
        return PolicyEvaluationResult(
            decision=AutopilotPolicyDecision.deny,
            rationale="Case creation denied for none/low risk",
        )

    if action_type == AutopilotActionType.create_checkin:
        return PolicyEvaluationResult(
            decision=AutopilotPolicyDecision.allow,
            rationale="Check-ins are always allowed regardless of risk level",
        )

    if action_type == AutopilotActionType.publish_attestation:
        return PolicyEvaluationResult(
            decision=AutopilotPolicyDecision.allow,
            rationale="Attestation publishing is automatic for auditability of agentic flow",
        )

    if action_type == AutopilotActionType.mint_badge:
        return PolicyEvaluationResult(
            decision=AutopilotPolicyDecision.allow,
            rationale="Badge minting is allowed for all risk levels",
        )

    return PolicyEvaluationResult(
        decision=AutopilotPolicyDecision.deny,
        rationale="No policy rule matched",
    )
