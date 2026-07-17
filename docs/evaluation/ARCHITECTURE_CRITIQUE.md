# UGM-AICare Architecture & AI Evaluation Report

## 1. Executive Summary

UGM-AICare is built on a highly ambitious and sophisticated Multi-Agent System (MAS) architecture, using LangGraph to orchestrate complex flows. The system integrates a triage agent (STA), therapeutic coach (TCA), case manager (CMA), and insights agent (IA). It takes an innovative approach to mental health support by performing covert screening mapped to validated clinical instruments (like PHQ-9 and GAD-7) and incorporates an autopilot policy engine with blockchain attestation capabilities.

While the clinical foundation is solid and the separation of concerns across agents is well-designed, the system suffers from significant latency issues (40-60 seconds per turn). These issues stem directly from redundant LLM invocations, inefficient tool-calling loops, and bloated context windows.

This report evaluates the agentic architecture, context management, and clinical validity, providing actionable recommendations to reduce token cost and significantly speed up response times.

---

## 2. Architecture & Performance Critique (The Latency Problem)

The primary cause of the 40-60 second latency is the "Chain of LLM Calls" architecture, specifically within `AikaOrchestratorGraph` and the ReAct tool-calling loop.

### Bottlenecks Identified
1. **The Decision Node Redundancy:**
   - Every message goes through `_call_decision_llm` to determine intent, risk, and routing. This takes time, even with `gemini-1.5-flash` or a lightweight model.
   - If the JSON parser fails, `_repair_decision_json_once` makes *another* LLM call just to fix JSON formatting.
2. **ReAct Tool Calling Overhead (`generate_with_tools`):**
   - The tool-calling loop in `tool_calling.py` is overly chatty. If tools are needed, the LLM is invoked to decide the tool (`_check_and_execute_tool_calls`), the tool is executed, and the LLM is invoked *again* with the tool result. In streaming mode, this is even more complex.
3. **The Synthesis Node Overhead:**
   - On the agent routing path, after sub-agents (TCA or CMA) execute, the results converge on `synthesize_final_response`. This triggers *another* LLM call to stitch the agent outputs into a conversational response.
   - Example High-Risk Flow: Decision LLM (1) -> STA Background (Deferred) -> CMA LLM (2) -> TCA LLM (3) -> Synthesis LLM (4). That is up to 4 sequential/parallel LLM generations for one user message.

### Cost & Speed Optimization Recommendations
- **Eliminate the Synthesis LLM Call:** Instead of having a dedicated `synthesize_final_response` LLM call, have the active agent (e.g., TCA) generate the final user-facing text as part of its plan generation. If CMA and TCA run in parallel, TCA can be strictly responsible for the user-facing text, while CMA handles backend DB updates silently.
- **Fast-Path Heuristics for Decision Making:** Implement semantic caching (e.g., Redis + Vector embeddings) or strong regex/keyword-based routing *before* the LLM decision node. The current `_is_smalltalk_message` is a good start, but it can be expanded to catch basic information inquiries.
- **Enforce Structured Outputs natively:** Migrate away from prompting the LLM to output JSON and manually repairing it. Use `response_schema` or structured outputs supported natively by the Google GenAI SDK to guarantee JSON structure on the first try, saving the repair call.

---

## 3. Context Engineering and Management Critique

The system builds large context windows by aggressively injecting multiple components into the `Aika` system prompt.

### Context Bloat Issues
1. **Overloaded System Prompt:**
   - `prompt_builder.py` injects `personal_memory_block`, `tail_context_block`, `system_instruction`, and extensive intent definitions into every decision prompt.
   - The decision prompt explains routing logic for *three different roles* (users, admins, counselors) every time, even though the role is known at runtime.
2. **Screening Awareness Injection:**
   - `screening_awareness.py` appends natural probes and affective discordance instructions directly into the LLM system prompt. While contextually relevant, repeating this massive instruction block on every turn wastes tokens and slows down the time-to-first-token (TTFT).

### Context Optimization Recommendations
- **Dynamic Prompt Pruning based on Role:** If the `user_role` is "user", strip out all routing instructions related to "admin" and "counselor" from `build_decision_prompt`.
- **Summarize Conversation History (Rolling Context):** Instead of keeping raw JSON lists of previous messages, use an asynchronous background task to periodically summarize conversation history into a dense "current state" paragraph.
- **Cache Static Contexts:** System prompts that don't change should be cached at the LLM provider level if supported (e.g., Gemini Context Caching), dramatically reducing input token costs for long sessions.

---

## 4. Clinical Validity & Covert Screening Evaluation

The clinical architecture of UGM-AICare is exceptionally well thought out and represents a high standard for AI mental health tools.

### Strengths in Clinical Engineering
1. **Validated Instruments:** The explicit mapping of conversational dimensions to established psychometric tools (PHQ-9, GAD-7, DASS-21) in `engine.py` provides a strong, defendable clinical baseline.
2. **Covert Assessment:** Passively extracting indicators without forcing the user to take a clinical survey reduces social desirability bias and improves user retention.
3. **Affective Discordance (`affective_discordance.py`):** Comparing the user's self-reported state (Journal) with the AI-detected state (STA PAD model) to detect "masking" is an advanced and highly valuable feature.
4. **Conversational Probes (`screening_awareness.py`):** The transition from clinical checkpoints to natural conversation prompts (e.g., "Gimana kabarnya hari ini? Beneran, bukan basa-basi aja.") is excellent. The priority queuing ensures Aika isn't interrogating the user.

### Clinical Refinement Recommendations
- **Decay Factor Tuning:** The `decay_factor` of 0.95 in `update_screening_profile` might be too slow for fast-moving university environments (e.g., exam week stress vs post-exam relief). Consider dynamically adjusting the decay factor based on the dimension (e.g., stress decays faster than depression).
- **Safety Overrides:** Ensure that covert screening *never* overrides explicit high-risk keywords. The deterministic safety fallbacks in `decision_node.py` are good, but ensure they are strictly enforced before any covert profile is processed.

---

## 5. Conclusion

UGM-AICare's clinical foundation and Multi-Agent structure are robust and innovative. However, the architecture is currently optimized for *capability* rather than *performance*.

To resolve the 40-60 second latency, the engineering focus must shift immediately to **Prompt Pruning**, **Structured Output Enforcements (to drop repair LLMs)**, and **Collapsing the Agent Chain** (specifically, merging the Synthesis step into the terminal sub-agent). These changes will drastically reduce token consumption and restore real-time conversational speeds.
