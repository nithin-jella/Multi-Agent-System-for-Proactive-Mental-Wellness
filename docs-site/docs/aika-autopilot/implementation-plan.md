---
id: implementation-plan
title: Autopilot Implementation Plan
sidebar_position: 1
---

# Aika Autopilot Phased Implementation Plan

**Date**: 2026-02-16 
**Status**: Phases 0-5 implemented (demo-grade) 
This plan converts the current Aika orchestration into an autonomous onchain operations flow.
**Track fit**: Agent (primary), Consumer (secondary)

## Implementation snapshot (2026-02-16)

- Phase 0: Completed (`docs/AUTOPILOT_POLICY_MATRIX.md`)
- Phase 1: Completed (model, migration, service, admin list/detail API)
- Phase 2: Completed (policy engine integrated into Aika orchestrator)
- Phase 3: Completed (durable worker, retries, dead-letter flow)
- Phase 4: Completed (approve/reject admin flow + proof timeline API/UI)
- Phase 5: Completed (replay script + runbook + artifact generation)

Note: onchain worker handlers currently include a documented placeholder tx mode controlled by `AUTOPILOT_ONCHAIN_PLACEHOLDER`.

---

## 1) Why this plan exists

Current UGM-AICare already has:

- LangGraph orchestration and conditional routing.
- Tool calling and appointment workflows.
- Multi-chain NFT capabilities including BNB chain IDs.
- Streaming trace UX and admin dashboards.

The Aika Autopilot implementation addresses the transition from a standard assistant to an autonomous operator. This plan integrates policy-governed actions, durable execution, and onchain verification.
This plan closes that gap by adding:

1. Policy-governed autonomous actions.
2. Durable action execution with idempotency and retries.
3. Onchain attestation publication and reconciliation.
4. Public proof timeline for reproducibility and verification.

---

## 2) Scope boundaries (for hackathon speed)

### In scope

- Autonomous action decisions for low/moderate risk operational events.
- Human approval gates for high/critical risk events.
- Onchain attestations that store hashes only (no sensitive content).
- Deterministic demo scenario with replay script and tx links.

### Out of scope

- Full protocol tokenomics redesign.
- Cross-chain bridge logic.
- Production-grade SOC2/GDPR legal implementation.

---

## 3) Phase sequence (recommended)

- Phase 0: Autopilot contract and policy spec
- Phase 1: Action Control Plane and DB model
- Phase 2: Policy engine and Aika integration
- Phase 3: Durable worker and blockchain attestation publisher
- Phase 4: Admin approval flow and public proof timeline
- Phase 5: Replayable demo harness and submission package

---

## 4) File map against current codebase

## Existing files to modify

- `backend/app/agents/aika_orchestrator_graph.py`
- `backend/app/agents/aika/tools.py`
- `backend/app/agents/shared/tools/registry.py`
- `backend/app/services/attestation_service.py`
- `backend/app/tasks/attestation_tasks.py`
- `backend/app/routes/admin/interventions.py`
- `backend/app/routes/admin/system.py`
- `backend/app/main.py`
- `backend/env.example`
- `backend/app/domains/blockchain/nft/chain_registry.py`
- `blockchain/hardhat.config.ts`

## New files to add

- `backend/app/domains/mental_health/models/autopilot_actions.py`
- `backend/app/domains/mental_health/services/autopilot_policy_engine.py`
- `backend/app/domains/mental_health/services/autopilot_action_service.py`
- `backend/app/domains/mental_health/services/autopilot_worker.py`
- `backend/app/domains/mental_health/routes/admin/autopilot.py`
- `backend/app/schemas/admin/autopilot.py`
- `backend/alembic/versions/<timestamp>_add_autopilot_actions.py`
- `frontend/src/app/admin/(protected)/autopilot/page.tsx`
- `frontend/src/app/(main)/proof/page.tsx`
- `frontend/src/services/adminAutopilotApi.ts`
- `frontend/src/services/proofApi.ts`
- `scripts/replay_autopilot_demo.py`

Note: if `opBNB` is selected, add chain config in both backend and frontend chain maps.

---

## 5) Data model design (minimal)

Create `AutopilotAction` table:

- `id` (pk)
- `action_type` (enum: `create_checkin`, `create_case`, `mint_badge`, `publish_attestation`)
- `risk_level` (enum)
- `policy_decision` (enum: `allow`, `require_approval`, `deny`)
- `status` (enum: `queued`, `awaiting_approval`, `approved`, `running`, `confirmed`, `failed`, `dead_letter`)
- `idempotency_key` (unique)
- `payload_hash` (sha256)
- `payload_json` (jsonb)
- `requires_human_review` (bool)
- `approved_by` (nullable)
- `approval_notes` (nullable)
- `tx_hash` (nullable)
- `chain_id` (nullable)
- `error_message` (nullable)
- `retry_count` (int)
- `next_retry_at` (nullable datetime)
- `created_at`, `updated_at`, `executed_at`

Create `AutopilotPolicySnapshot` table (optional in hackathon, useful for audit):

- action id fk, policy version, applied rules json.

---

## 6) Phase-by-phase implementation

## Phase 0 - Autopilot contract and policy spec

### Goal

Freeze autonomy boundaries before coding.

### Tasks

1. Define policy matrix by risk level and action type.
2. Define idempotency formula per action.
3. Define attestation payload schema (hash only).

### Deliverable

`docs/AUTOPILOT_POLICY_MATRIX.md` with one source of truth.

### LLM Agent prompt (copy-paste)

"""
Read the existing orchestration and intervention flow. Produce `docs/AUTOPILOT_POLICY_MATRIX.md` containing:

1) Risk x action decision matrix (`allow`, `require_approval`, `deny`),
2) Idempotency key formulas per action,
3) Minimal hashed attestation payload schema,
4) Non-goals for hackathon.
Keep policies conservative for high/critical risk.
"""

### Done criteria

- Matrix exists and is approved by developer.
- No ambiguous policy branch remains.

---

## Phase 1 - Action Control Plane and DB model

### Goal

Create durable action records before execution.

### Tasks

1. Add SQLAlchemy model `AutopilotAction`.
2. Add Alembic migration.
3. Add CRUD service skeleton for create/list/get/update status.
4. Add admin read endpoints for queue visibility.

### File targets

- `backend/app/domains/mental_health/models/autopilot_actions.py`
- `backend/alembic/versions/<timestamp>_add_autopilot_actions.py`
- `backend/app/domains/mental_health/services/autopilot_action_service.py`
- `backend/app/domains/mental_health/routes/admin/autopilot.py`
- `backend/app/main.py` (router include)

### LLM Agent prompt (copy-paste)

"""
Implement Phase 1 Action Control Plane:

- Add SQLAlchemy model `AutopilotAction` and migration.
- Add service with methods: `enqueue_action`, `mark_awaiting_approval`, `mark_running`, `mark_confirmed`, `mark_failed`, `mark_dead_letter`.
- Add admin routes:
 - GET `/api/v1/admin/autopilot/actions`
 - GET `/api/v1/admin/autopilot/actions/{id}`
Return Pydantic schemas with pagination and filters.
Follow existing backend style and async patterns.
"""

### Done criteria

- Migration runs.
- Actions can be created and listed through API.
- Status transitions persist correctly.

---

## Phase 2 - Policy engine and Aika integration

### Goal

Aika decides and enqueues actions through explicit policy checks.

### Tasks

1. Add `autopilot_policy_engine.py`.
2. Integrate policy check after risk/intent classification in orchestrator.
3. Enqueue allowed actions, queue approvals for gated actions.
4. Emit structured events for traceability.

### File targets

- `backend/app/domains/mental_health/services/autopilot_policy_engine.py`
- `backend/app/agents/aika_orchestrator_graph.py`
- `backend/app/services/compliance_service.py` (reuse for audit event writes)

### LLM Agent prompt (copy-paste)

"""
Implement Phase 2 policy integration:

- Create policy engine function `evaluate_action_policy(risk_level, action_type, context) -> decision`.
- In Aika orchestration flow, before executing operational side effects, call policy engine.
- If `allow`, enqueue action with `queued`.
- If `require_approval`, enqueue action with `awaiting_approval`.
- If `deny`, store audit event and skip side effect.
- Ensure no direct high-risk autonomous side effects execute.
"""

### Done criteria

- High/critical actions are never auto-executed.
- Low/moderate allowed actions are queued reliably.
- Audit entries are created for each policy decision.

---

## Phase 3 - Durable worker and blockchain attestation publisher

### Goal

Execute queued actions with retries and onchain reconciliation.

### Tasks

1. Build worker loop for queued approved actions.
2. Add idempotency enforcement before execution.
3. Extend attestation publisher to submit tx and capture hash.
4. Add retry strategy with exponential backoff and dead-letter state.

### File targets

- `backend/app/domains/mental_health/services/autopilot_worker.py`
- `backend/app/services/attestation_service.py`
- `backend/app/tasks/attestation_tasks.py`
- `backend/app/main.py` (startup worker hook or scheduler integration)

### LLM Agent prompt (copy-paste)

"""
Implement Phase 3 durable execution:

- Worker reads `AutopilotAction` in `queued` or `approved` state.
- Uses idempotency key check to prevent duplicate external side effects.
- Executes action handlers (mint badge, publish attestation, create check-in).
- On success: persist `tx_hash`, `chain_id`, set `confirmed`.
- On failure: increment retry count, set `next_retry_at` with exponential backoff.
- Move to `dead_letter` after max retries.
Add structured logs and metrics counters.
"""

### Done criteria

- Duplicate execution is blocked by idempotency.
- Failed blockchain operations retry and finally dead-letter.
- Confirmed actions have explorer-ready tx hash stored.

---

## Phase 4 - Admin approval flow and proof timeline

### Goal

Expose governance and proof to judges in UI.

### Tasks

1. Add approve/reject endpoints for `awaiting_approval` actions.
2. Add admin queue page with filters and action details.
3. Add public/user proof page with action timeline and tx links.

### File targets

- `backend/app/domains/mental_health/routes/admin/autopilot.py`
- `backend/app/schemas/admin/autopilot.py`
- `frontend/src/app/admin/(protected)/autopilot/page.tsx`
- `frontend/src/app/(main)/proof/page.tsx`
- `frontend/src/services/adminAutopilotApi.ts`
- `frontend/src/services/proofApi.ts`

### LLM Agent prompt (copy-paste)

"""
Implement Phase 4 approval and proof UX:

- Backend endpoints:
 - POST `/api/v1/admin/autopilot/actions/{id}/approve`
 - POST `/api/v1/admin/autopilot/actions/{id}/reject`
 - GET `/api/v1/proof/actions?user_id=...`
- Frontend admin queue page: list awaiting approvals, show risk, payload summary, approve/reject controls.
- Frontend proof page: timeline of actions with status, tx hash, explorer URL, and chain label.
Use existing UI patterns and API client style.
"""

### Done criteria

- Admin can approve/reject queued actions.
- Proof page shows verifiable onchain links.
- Demo can show one full lifecycle from detection to confirmed tx.

---

## Phase 5 - Replayable demo harness and submission package

### Goal

Make verification easy for judges.

### Tasks

1. Create deterministic demo script that seeds scenario and triggers one autopilot run.
2. Export result artifact JSON with action IDs, statuses, tx hashes.
3. Add quickstart reproduction guide.

### File targets

- `scripts/replay_autopilot_demo.py`
- `docs/AUTOPILOT_DEMO_RUNBOOK.md`
- `README.md` (append hackathon quickstart section)

### LLM Agent prompt (copy-paste)

"""
Implement Phase 5 reproducibility package:

- Add `scripts/replay_autopilot_demo.py` to seed one user, one risk event, one allowed action, one approval-required action.
- Script prints final artifact JSON with tx hashes and explorer links.
- Add `docs/AUTOPILOT_DEMO_RUNBOOK.md` with exact commands and expected outputs.
Keep setup minimal and deterministic.
"""

### Done criteria

- One-command demo replay works on clean environment.
- Artifact includes verifiable tx hashes.
- Runbook covers setup, run, and verification.

---

## 7) Suggested 7-day timeline

- Day 1: Phase 0 and Phase 1
- Day 2: Phase 2
- Day 3-4: Phase 3
- Day 5: Phase 4 backend
- Day 6: Phase 4 frontend
- Day 7: Phase 5 and final polish

---

## 8) Testing matrix (minimum)

### Unit tests

- Policy decisions by risk/action permutation.
- Idempotency key collision handling.
- Retry backoff and dead-letter transition.

### Integration tests

- Orchestrator enqueues action with correct policy decision.
- Approval transitions from awaiting_approval -> approved -> running -> confirmed.
- Attestation publisher stores tx hash and chain id.

### Demo tests

- End-to-end run from user message to proof timeline display.
- Explorer links resolve.

---

## 9) Environment variables to add

Add to `backend/env.example`:

- `AUTOPILOT_ENABLED=true`
- `AUTOPILOT_MAX_RETRIES=5`
- `AUTOPILOT_RETRY_BASE_SECONDS=30`
- `AUTOPILOT_WORKER_INTERVAL_SECONDS=5`
- `AUTOPILOT_REQUIRE_APPROVAL_HIGH_RISK=true`
- `AUTOPILOT_REQUIRE_APPROVAL_CRITICAL_RISK=true`
- `AUTOPILOT_POLICY_VERSION=v1`

If targeting opBNB:

- `OPBNB_TESTNET_RPC_URL=`
- `OPBNB_NFT_CONTRACT_ADDRESS=`
- `OPBNB_MINTER_PRIVATE_KEY=`

---

## 10) Final acceptance checklist (judge-facing)

- [ ] Aika performs policy-governed autonomous decisions.
- [ ] High/critical actions are approval-gated.
- [ ] At least one action is confirmed onchain with tx hash.
- [ ] Public proof timeline shows lifecycle and explorer links.
- [ ] Reproduction guide works on fresh setup.

---

## 11) Anti-patterns to avoid during implementation

- No direct autonomous execution for critical-risk pathways.
- No plaintext sensitive mental health data onchain.
- No blockchain side effects without idempotency key.
- No hidden manual step in the core demo flow.

---

## 12) Recommended first execution command

Start with Phase 1 prompt and ask your coding agent to implement only model + migration + admin list endpoints in one PR. 
After that is merged or stable locally, continue to Phase 2.
