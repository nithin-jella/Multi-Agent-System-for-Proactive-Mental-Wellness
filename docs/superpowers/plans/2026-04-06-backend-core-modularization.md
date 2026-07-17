# Backend Core Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularize high-complexity backend core code to improve readability and maintainability without changing runtime behavior.

**Architecture:** Use extraction-by-seam refactoring. Keep `app.core.llm` as the stable facade while moving cohesive internals into focused modules. Preserve public function names and route behavior, then verify with targeted regression tests after each phase.

**Tech Stack:** FastAPI, Python 3.x, pytest, httpx, Google Gemini SDK, OpenRouter/Z.AI API.

---

## Current State

- `backend/app/core/llm.py` is the largest core module (~1900+ lines) and currently mixes:
  - provider config/constants,
  - model alias normalization and active-model registry,
  - OpenRouter/Z.AI direct HTTP transport,
  - Gemini fallback/circuit-breaker logic,
  - unified dispatch (`generate_response`).
- High coupling in a single file increases cognitive load and makes changes riskier.

## Target State

- `app.core.llm` remains the compatibility facade.
- Provider-specific transport/parsing is isolated.
- Active-model registry and provider routing policy are isolated.
- Gemini fallback/circuit-breaker logic is isolated.
- Existing imports in routes/services/tests continue to work.

## Phase Plan (Safe Sequence)

### Phase 1: Extract Z.AI/OpenRouter transport (Completed)

**Files:**

- Create: `backend/app/core/zai_chat_completion.py`
- Modify: `backend/app/core/llm.py`
- Verify: `backend/tests/test_llm_zai_routing.py`

- [x] Move generic chat-completion HTTP transport + response parsing to dedicated module.
- [x] Keep `generate_openrouter_response` and `generate_zai_direct_response` signatures unchanged in `llm.py`.
- [x] Run targeted routing tests.

**Verification snapshot (2026-04-06):**

- `pytest tests/test_llm_zai_routing.py tests/test_aika_discordance_policy.py tests/test_sta_gemini_classifier.py -q`
- Result: `24 passed`.

### Phase 2: Extract active-model registry + normalization (Completed)

**Files:**

- Create: `backend/app/core/llm_active_model_registry.py`
- Modify: `backend/app/core/llm.py`
- Verify: `backend/tests/test_llm_zai_routing.py`, admin API tests (if present)

- [x] Move active model state lock, normalization, and supported-model list.
- [x] Preserve `get_active_chat_model`, `set_active_chat_model`, `get_supported_chat_models`, `get_active_chat_provider` in facade.

**Verification snapshot (2026-04-06):**

- `pytest tests/test_llm_zai_routing.py tests/test_aika_discordance_policy.py tests/test_sta_gemini_classifier.py -q`
- Result: `24 passed`.

### Phase 3: Extract Gemini circuit breaker + fallback policy (Completed)

**Files:**

- Create: `backend/app/core/llm_gemini_circuit_breaker.py`
- Modify: `backend/app/core/llm.py`
- Verify: Gemini-related unit tests and Aika/STA impacted tests.

- [x] Move circuit-breaker state/tracking into dedicated module.
- [x] Keep `get_gemini_circuit_breaker_status` and fallback callers stable via llm facade wrappers.
- [x] Move remaining fallback-chain policy helpers.

**Verification snapshot (2026-04-06):**

- `pytest tests/test_llm_zai_routing.py tests/test_sta_conversation_analyzer.py -q`
- Result: `11 passed`.
- `pytest tests/test_llm_zai_routing.py tests/test_aika_discordance_policy.py tests/test_sta_gemini_classifier.py tests/test_sta_conversation_analyzer.py -q`
- Result: `27 passed`.

### Phase 4: Simplify unified dispatch orchestration (Completed)

**Files:**

- Modify: `backend/app/core/llm.py`
- Create: `backend/app/core/llm_dispatch.py` (optional)
- Verify: routing + integration tests.

- [x] Convert `generate_response` to a thin orchestrator over extracted modules.
- [x] Keep behavior: `gemini:auto`, `glm-*` direct, `z-ai/*` OpenRouter, `gemma_local` local path.

**Verification snapshot (2026-04-06):**

- `pytest tests/test_llm_zai_routing.py tests/test_aika_discordance_policy.py tests/test_sta_gemini_classifier.py tests/test_sta_conversation_analyzer.py -q`
- Result: `27 passed`.

### Final Cleanup Pass: Shared Gemini Fallback Runner (Completed)

**Files:**

- Create: `backend/app/core/llm_gemini_fallback_runner.py`
- Modify: `backend/app/core/llm.py`

- [x] Extract duplicated fallback retry loop from `generate_gemini_content_with_fallback` and `generate_gemini_response_with_fallback` into shared runner.
- [x] Keep public llm facade signatures and behavior unchanged.

**Verification snapshot (2026-04-06):**

- `pytest tests/test_llm_zai_routing.py tests/test_aika_discordance_policy.py tests/test_sta_gemini_classifier.py tests/test_sta_conversation_analyzer.py -q`
- Result: `27 passed`.
- `pytest $(grep -R --include='*.py' -l "generate_gemini_response_with_fallback\|generate_gemini_content_with_fallback\|get_gemini_circuit_breaker_status" tests) -q`
- Result: `11 passed`.

## Verification Gates Per Phase

1. Run targeted unit tests for modified behavior.
2. Run related integration-style tests for impacted agents/routes.
3. Check static errors for modified files.
4. If any gate fails: rollback only current phase changes.

## Rollback Plan

If a phase introduces regressions:

1. Revert only files touched in that phase.
2. Re-run previously passing targeted tests.
3. Re-apply extraction with smaller scope.

## Risks and Mitigations

- Risk: Behavior drift in provider routing.
  - Mitigation: preserve facade functions and run routing regression tests.
- Risk: Test monkeypatch assumptions on `llm.py` symbols.
  - Mitigation: keep facade symbol names unchanged while extracting internals.
- Risk: Hidden coupling in large module.
  - Mitigation: extract one seam at a time and validate after each seam.
