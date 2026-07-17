---
id: policy-governed-autonomy
title: Policy-Governed Autonomy
sidebar_position: 2
---

# Aika Autopilot Policy Matrix

**Version**: `v1` 
**Date**: 2026-02-16 
**Scope**: Phase 0 policy contract for Aika Autopilot implementation

---

## 1. Policy objective

The policy layer defines when Aika may execute operational actions autonomously versus when human approval is required.

The policy is intentionally conservative for high and critical risk scenarios.

---

## 2. Risk levels

- `none`
- `low`
- `moderate`
- `high`
- `critical`

---

## 3. Action types

- `create_checkin`
- `create_case`
- `mint_badge`
- `publish_attestation`

---

## 4. Decision matrix

Decision values:

- `allow`
- `require_approval`
- `deny`

| Risk \ Action | create_checkin | create_case | mint_badge | publish_attestation |
| --- | --- | --- | --- | --- |
| none | allow | deny | allow | allow |
| low | allow | deny | allow | allow |
| moderate | allow | require_approval | allow | allow |
| high | require_approval | allow | require_approval | allow |
| critical | require_approval | allow | require_approval | allow |

Rationale:

- `create_case` at high/critical remains `allow` to preserve safety escalation latency.
- Reward-like onchain actions (`mint_badge`) stay approval-gated for high/critical.
- Audit attestations (`publish_attestation`) are always auto-allowed to preserve continuous verifiability of agentic flow.
- `create_case` at none/low is denied to avoid unnecessary escalation noise.

---

## 5. Idempotency key formulas

All formulas are deterministic string templates hashed with SHA-256.

1. `create_checkin`

- Raw key:
 - `create_checkin:{user_id}:{session_id}:{date_yyyy_mm_dd}`

1. `create_case`

- Raw key:
 - `create_case:{user_hash}:{session_id}:{risk_level}:{message_hash}`

1. `mint_badge`

- Raw key:
 - `mint_badge:{user_id}:{chain_id}:{badge_id}:{source_event_id}`

1. `publish_attestation`

- Raw key:
 - `publish_attestation:{subject_type}:{subject_id}:{payload_hash}`

Notes:

- `message_hash` is SHA-256 of the normalized current message.
- `payload_hash` is SHA-256 of canonicalized payload JSON.
- Key uniqueness is enforced at DB level.

---

## 6. Minimal hashed attestation payload schema

No sensitive plaintext should be written onchain.

```json
{
 "schema_version": "v1",
 "event_type": "autopilot_action_confirmed",
 "action_id": 12345,
 "action_type": "publish_attestation",
 "subject_type": "user",
 "subject_id": "u_123",
 "risk_level": "moderate",
 "decision": "allow",
 "payload_hash": "sha256_hex",
 "evidence_hash": "sha256_hex",
 "created_at": "2026-02-16T12:00:00Z"
}
```

---

## 7. Non-goals for hackathon

- Full legal/compliance certification implementation (SOC2, GDPR end-to-end).
- Protocol-level tokenomics redesign.
- Cross-chain bridge and generalized interoperability layer.
- Advanced governance voting for policy updates.

---

## 8. Safety guardrails

- Critical pathways must never bypass crisis escalation logic.
- Onchain payloads must not include raw mental health text, names, emails, phone numbers, or identifiers.
- Every autonomous action must have an idempotency key and status lifecycle trace.
- Policy decision and rationale must be stored in audit logs.
## Autopilot Decision Lifecycle

The Autopilot follows a strict governance model to ensure clinical safety while enabling operational efficiency. Every action requested by the agents passes through the control plane before execution.

```mermaid
stateDiagram-v2
 [*] --> ActionRequested: Agent Proposes Action
 ActionRequested --> PolicyEngine: Check Governance Matrix
 
 state PolicyEngine {
 direction LR
 Analyze[Analyze Intent & Risk] --> Match[Match Policy Rule]
 }
 
 PolicyEngine --> AutoAllow: Policy = ALLOW
 PolicyEngine --> RequireApproval: Policy = REQUIRE_APPROVAL
 PolicyEngine --> Denied: Policy = DENY
 
 AutoAllow --> ExecutionWorker: Direct Queue
 
 RequireApproval --> AdminQueue: Pending Human Review
 AdminQueue --> Approved: Admin Approves
 AdminQueue --> Rejected: Admin Rejects
 Approved --> ExecutionWorker: Escalated Queue
 
 ExecutionWorker --> BlockchainAnchor: Execution Success
 BlockchainAnchor --> OnchainAttestation: Emit Event
 OnchainAttestation --> [*]: Task Complete
 
 Denied --> [*]: Task Rejected
 Rejected --> [*]: Task Rejected
```
