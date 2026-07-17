'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Case scenario data — mirrors the exact routing in aika_orchestrator_graph.py
const CASE_SCENARIOS = [
    {
        id: 'direct',
        emoji: '💬',
        title: 'Casual Chat / Greeting',
        trigger: 'risk = none · needs_agents = false',
        triggerColor: 'text-slate-400',
        borderColor: 'border-slate-500/20',
        bgColor: 'bg-slate-500/5',
        badgeColor: 'bg-slate-700 text-slate-300',
        example: '"Halo Aika! Gimana kabarmu?"',
        steps: [
            { node: 'Aika Decision', detail: 'intent = casual_chat · next_step = none', color: 'bg-blue-500/20 text-blue-300' },
            { node: 'END (direct)', detail: 'aika_direct_response set in decision node — no agents invoked', color: 'bg-slate-500/20 text-slate-300' },
        ],
        agentsFired: [],
        agentsSilent: ['TCA', 'CMA', 'IA', 'STA'],
    },
    {
        id: 'moderate',
        emoji: '🟡',
        title: 'Moderate Distress',
        trigger: 'risk = moderate · next_step = tca',
        triggerColor: 'text-yellow-400',
        borderColor: 'border-yellow-500/20',
        bgColor: 'bg-yellow-500/5',
        badgeColor: 'bg-yellow-900/40 text-yellow-300',
        example: '"Aku merasa overwhelmed banget akhir-akhir ini, susah fokus."',
        steps: [
            { node: 'Aika Decision', detail: 'intent = emotional_support · immediate_risk = moderate', color: 'bg-blue-500/20 text-blue-300' },
            { node: 'TCA (execute_sca)', detail: 'CBT-informed coping plan generated for moderate risk', color: 'bg-yellow-500/20 text-yellow-300' },
            { node: 'Synthesize', detail: 'Final empathetic response assembled from TCA output', color: 'bg-blue-500/20 text-blue-300' },
        ],
        agentsFired: ['TCA'],
        agentsSilent: ['CMA', 'IA', 'STA'],
    },
    {
        id: 'crisis',
        emoji: '🔴',
        title: 'High / Critical Crisis',
        trigger: 'risk = high | critical · parallel_crisis fan-out',
        triggerColor: 'text-red-400',
        borderColor: 'border-red-500/30',
        bgColor: 'bg-red-500/5',
        badgeColor: 'bg-red-900/40 text-red-300',
        example: '"Aku udah gak kuat lagi, pengen menyakiti diriku sendiri…"',
        steps: [
            { node: 'Aika Decision', detail: 'immediate_risk = high · holding message set instantly for user', color: 'bg-blue-500/20 text-blue-300' },
            { node: 'Parallel Crisis', detail: 'asyncio.gather → TCA ∥ CMA run concurrently (max latency, not sum)', color: 'bg-red-500/20 text-red-300' },
            { node: 'TCA (parallel)', detail: 'CBT crisis plan + immediate coping strategies', color: 'bg-yellow-500/20 text-yellow-300' },
            { node: 'CMA (parallel)', detail: 'Case created, counselor auto-assigned, SLA clock started', color: 'bg-orange-500/20 text-orange-300' },
            { node: 'Synthesize', detail: 'Merges TCA + CMA outputs into a single crisis-aware response', color: 'bg-blue-500/20 text-blue-300' },
        ],
        agentsFired: ['TCA', 'CMA'],
        agentsSilent: ['IA', 'STA'],
    },
    {
        id: 'analytics',
        emoji: '📊',
        title: 'Analytics Query (Admin / Counselor)',
        trigger: 'intent = analytics_query · role = admin | counselor',
        triggerColor: 'text-purple-400',
        borderColor: 'border-purple-500/20',
        bgColor: 'bg-purple-500/5',
        badgeColor: 'bg-purple-900/40 text-purple-300',
        example: '"Topik apa yang paling sering muncul minggu ini?"',
        steps: [
            { node: 'Aika Decision', detail: 'intent = analytics_query · next_step = ia', color: 'bg-blue-500/20 text-blue-300' },
            { node: 'IA (execute_ia)', detail: 'k-anonymity (k≥5) + differential privacy applied to aggregate query', color: 'bg-purple-500/20 text-purple-300' },
            { node: 'Synthesize', detail: 'Privacy-preserving trend report formatted for counselor dashboard', color: 'bg-blue-500/20 text-blue-300' },
        ],
        agentsFired: ['IA'],
        agentsSilent: ['TCA', 'CMA', 'STA'],
    },
    {
        id: 'sta_bg',
        emoji: '🔍',
        title: 'Post-Conversation Screening',
        trigger: 'conversation_ended = true · background task (NOT a graph node)',
        triggerColor: 'text-indigo-400',
        borderColor: 'border-indigo-500/20',
        bgColor: 'bg-indigo-500/5',
        badgeColor: 'bg-indigo-900/40 text-indigo-300',
        example: '"sampai jumpa" / 5 minutes of inactivity / explicit session end',
        steps: [
            { node: 'Aika Decision', detail: 'conversation_ended flag set; asyncio.create_task fires background job', color: 'bg-blue-500/20 text-blue-300' },
            { node: 'STA Background', detail: 'Analyzes full conversation history — PHQ-9, GAD-7, DASS-21 extraction', color: 'bg-indigo-500/20 text-indigo-300' },
            { node: 'DB Persist', detail: 'ConversationRiskAssessment upserted; screening profile updated', color: 'bg-slate-500/20 text-slate-300' },
        ],
        agentsFired: ['STA (background)'],
        agentsSilent: ['TCA', 'CMA', 'IA'],
        note: 'STA runs asynchronously and does not block or modify the user-facing response path.',
    },
];

const AGENT_BDI = [
    {
        id: 'aika',
        name: 'AIKA Meta-Agent',
        role: 'Unified Orchestrator',
        icon: '🤖',
        bdi: {
            belief: 'User intent, role (student/counselor/admin), current risk level, conversation history, screening profile.',
            desire: 'Route each message to the correct agent path with minimal latency; ensure safety is never bypassed.',
            intention: 'Run Gemini decision call → evaluate conditional edge → invoke zero, one, or two sub-agents in parallel.',
        },
        description: 'The entry point for all messages. Aika runs a single Gemini JSON decision call, evaluates the routing condition, and dispatches downstream. For direct responses it uses a ReAct tool loop.',
    },
    {
        id: 'tca',
        name: 'Therapeutic Coach Agent (TCA)',
        role: 'Support Provider',
        icon: '🧠',
        bdi: {
            belief: 'User is experiencing distress at moderate severity; crisis keywords absent or mild.',
            desire: 'Alleviate distress through cognitive restructuring without over-escalating.',
            intention: 'Generate a personalized CBT-informed intervention plan with actionable coping steps.',
        },
        description: 'Invoked for moderate risk or structured support requests. Also runs as one branch of the parallel_crisis fan-out for high/critical cases.',
    },
    {
        id: 'cma',
        name: 'Case Management Agent (CMA)',
        role: 'Crisis Escalation',
        icon: '📋',
        bdi: {
            belief: 'Risk level is high or critical; situation exceeds automated support capability.',
            desire: 'Connect the user with a human counselor within SLA bounds.',
            intention: 'Create a formal case, auto-assign the best-available counselor, start SLA monitoring.',
        },
        description: 'Only fires via the parallel_crisis node. Never invoked for moderate risk or analytics. Runs concurrently with TCA during high/critical events.',
    },
    {
        id: 'ia',
        name: 'Insights Agent (IA)',
        role: 'Privacy Analytics',
        icon: '📊',
        bdi: {
            belief: 'Requester is admin or counselor with a well-formed analytics intent.',
            desire: 'Surface population-level trends without exposing any individual record.',
            intention: 'Execute aggregate DB query, apply k-anonymity (k≥5), interpret with Gemini, return anonymized report.',
        },
        description: 'Invoked exclusively for analytics queries from privileged roles. Never fires for student messages.',
    },
    {
        id: 'sta',
        name: 'Safety Triage Agent (STA)',
        role: 'Background Analyst',
        icon: '🔍',
        bdi: {
            belief: 'A conversation has ended; its full arc may reveal longitudinal risk patterns not visible in a single message.',
            desire: 'Maintain an up-to-date clinical screening profile without interrupting the live response path.',
            intention: 'Analyze the full conversation history for PHQ-9, GAD-7, DASS-21 signals; persist the assessment.',
        },
        description: 'STA is NOT a live graph node. It runs as a fire-and-forget asyncio background task triggered at conversation end, or manually via the trigger_conversation_analysis tool available to counselors and admins.',
    },
];

export function ArchitectureGuide() {
    const [activeTab, setActiveTab] = useState<'agents' | 'bdi' | 'cases' | 'theory'>('agents');
    const [activeCaseId, setActiveCaseId] = useState<string>('crisis');

    const activeCase = CASE_SCENARIOS.find((c) => c.id === activeCaseId) ?? CASE_SCENARIOS[0];

    return (
        <div className="bg-[#00153a]/20 backdrop-blur-sm border border-white/5 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-linear-to-r from-white/5 to-transparent">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="text-2xl">📚</span> Thesis Architecture Alignment
                </h2>
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                    {[
                        { id: 'agents', label: 'Agent Roles' },
                        { id: 'bdi',    label: 'BDI Model'  },
                        { id: 'cases',  label: 'Case Examples' },
                        { id: 'theory', label: 'LangGraph'  },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'agents' | 'bdi' | 'cases' | 'theory')}
                            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                                activeTab === tab.id
                                    ? 'bg-[#FFCA40] text-[#00153a] shadow-lg scale-105'
                                    : 'text-white/40 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-8">
                <AnimatePresence mode="wait">
                    {/* ── Agent Roles ─────────────────────────────────────────────────── */}
                    {activeTab === 'agents' && (
                        <motion.div key="agents" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {AGENT_BDI.map((agent) => (
                                <div key={agent.id} className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <span className="text-3xl bg-white/5 p-3 rounded-xl group-hover:scale-110 transition-transform">{agent.icon}</span>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-[#FFCA40] transition-colors">{agent.name}</h3>
                                            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">{agent.role}</span>
                                        </div>
                                    </div>
                                    <p className="text-white/60 text-sm leading-relaxed mb-6">{agent.description}</p>
                                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                        <div className="text-[10px] font-bold text-emerald-400 mb-1 uppercase tracking-wider">Core Intention</div>
                                        <div className="text-sm text-white/80 italic">&ldquo;{agent.bdi.intention}&rdquo;</div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* ── BDI Model ────────────────────────────────────────────────────── */}
                    {activeTab === 'bdi' && (
                        <motion.div key="bdi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <div className="bg-linear-to-r from-blue-500/10 to-purple-500/10 border border-white/5 rounded-2xl p-8 text-center">
                                <h3 className="text-2xl font-bold text-white mb-4">Belief-Desire-Intention (BDI) Architecture</h3>
                                <p className="text-white/60 max-w-3xl mx-auto text-lg leading-relaxed">
                                    The BDI model characterizes an agent using its mental state. In UGM-AICare, this maps to
                                    LangGraph State (Beliefs), Conditional Edges (Desires), and Node Functions (Intentions).
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    {
                                        color: 'blue', icon: '🧠', title: 'Beliefs (Information)',
                                        sub: "The agent's knowledge about the world and current state.",
                                        items: ['User Profile & Screening History', 'Current Conversation Context', 'Clinical Guidelines (JUKNIS UGM)'],
                                    },
                                    {
                                        color: 'pink', icon: '❤️', title: 'Desires (Objectives)',
                                        sub: 'The goals the agent wants to accomplish based on its beliefs.',
                                        items: ['Ensure User Safety (Priority #1)', 'Provide Empathetic Support', 'Maintain Data Privacy (k-anonymity)'],
                                    },
                                    {
                                        color: 'yellow', icon: '⚡', title: 'Intentions (Actions)',
                                        sub: 'The specific actions the agent has committed to executing.',
                                        items: ['Route via should_invoke_agents()', 'Fan-out parallel_crisis (TCA ∥ CMA)', 'Trigger background STA analysis'],
                                    },
                                ].map((col) => (
                                    <div key={col.title} className={`bg-white/5 border border-white/5 rounded-2xl p-8 relative overflow-hidden group hover:bg-white/10 transition-colors`}>
                                        <div className="absolute top-0 right-0 p-6 opacity-5 text-8xl group-hover:opacity-10 transition-opacity">{col.icon}</div>
                                        <h4 className={`text-xl font-bold text-${col.color}-400 mb-4`}>{col.title}</h4>
                                        <p className="text-white/50 text-sm mb-6">{col.sub}</p>
                                        <ul className="space-y-3">
                                            {col.items.map((item) => (
                                                <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                                                    <span className={`w-1.5 h-1.5 rounded-full bg-${col.color}-400`}></span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Case Examples ────────────────────────────────────────────────── */}
                    {activeTab === 'cases' && (
                        <motion.div key="cases" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Scenario selector */}
                            <div className="flex flex-wrap gap-3">
                                {CASE_SCENARIOS.map((sc) => (
                                    <button
                                        key={sc.id}
                                        onClick={() => setActiveCaseId(sc.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                            activeCaseId === sc.id
                                                ? `${sc.bgColor} ${sc.borderColor} text-white scale-105 shadow-lg`
                                                : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                                        }`}
                                    >
                                        <span>{sc.emoji}</span> {sc.title}
                                    </button>
                                ))}
                            </div>

                            {/* Active case detail */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeCase.id}
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -8 }}
                                    className={`border ${activeCase.borderColor} ${activeCase.bgColor} rounded-2xl p-6 space-y-6`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-3xl">{activeCase.emoji}</span>
                                                <h3 className="text-xl font-bold text-white">{activeCase.title}</h3>
                                            </div>
                                            <div className={`text-xs font-mono font-bold ${activeCase.triggerColor} bg-black/30 rounded-lg px-3 py-1 inline-block`}>
                                                {activeCase.trigger}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Example message</div>
                                            <div className="text-sm text-white/70 italic max-w-xs">{activeCase.example}</div>
                                        </div>
                                    </div>

                                    {/* Execution path */}
                                    <div>
                                        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Execution Path</div>
                                        <div className="relative space-y-3">
                                            <div className="absolute left-5 top-5 bottom-5 w-px bg-white/10"></div>
                                            {activeCase.steps.map((step, i) => (
                                                <div key={i} className="flex items-start gap-4 pl-2">
                                                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/50 shrink-0 z-10">
                                                        {i + 1}
                                                    </div>
                                                    <div className={`flex-1 rounded-xl px-4 py-3 ${step.color}`}>
                                                        <div className="font-bold text-sm">{step.node}</div>
                                                        <div className="text-xs opacity-70 mt-0.5">{step.detail}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Agent fire matrix */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Agents Fired</div>
                                            {activeCase.agentsFired.length === 0
                                                ? <span className="text-sm text-white/30 italic">None — direct response</span>
                                                : activeCase.agentsFired.map((a) => (
                                                    <div key={a} className="flex items-center gap-2 text-sm text-white/80 mb-1">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {a}
                                                    </div>
                                                ))
                                            }
                                        </div>
                                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Agents Silent</div>
                                            {activeCase.agentsSilent.map((a) => (
                                                <div key={a} className="flex items-center gap-2 text-sm text-white/50 mb-1">
                                                    <span className="w-2 h-2 rounded-full bg-red-400/40"></span> {a}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Optional note */}
                                    {activeCase.note && (
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-xs text-indigo-200/80 leading-relaxed">
                                            ℹ️ {activeCase.note}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* ── LangGraph Theory ──────────────────────────────────────────────── */}
                    {activeTab === 'theory' && (
                        <motion.div key="theory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                        >
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-4">LangGraph Implementation</h3>
                                    <p className="text-white/60 leading-relaxed">
                                        LangGraph provides the structural framework to implement the BDI architecture.
                                        Each node represents a distinct cognitive step; conditional edges model the routing logic.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        { tag: 'AikaOrchestratorState', color: 'blue',   title: 'The Environment',  body: 'TypedDict holding shared state (Beliefs) visible to all nodes — risk level, intent, agent outputs, screening profile.' },
                                        { tag: 'Nodes',                  color: 'purple', title: 'The Agents',      body: 'Async functions that process state. Each node may call Gemini, a DB, or an external subgraph.' },
                                        { tag: 'Conditional Edges',      color: 'yellow', title: 'Control Flow',    body: 'should_invoke_agents() maps risk level to the correct path: parallel_crisis, TCA, IA, or END.' },
                                        { tag: 'asyncio.gather',         color: 'red',    title: 'Parallelism',     body: 'parallel_crisis_node() runs TCA and CMA concurrently. Latency = max(TCA, CMA) instead of their sum.' },
                                    ].map((item) => (
                                        <div key={item.tag} className="flex items-start gap-5 bg-white/5 p-6 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className={`bg-${item.color}-500/20 p-3 rounded-xl text-${item.color}-400 font-mono text-xs shrink-0`}>{item.tag}</div>
                                            <div>
                                                <h4 className="font-bold text-white mb-1">{item.title}</h4>
                                                <p className="text-sm text-white/50">{item.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-black/30 rounded-2xl p-8 border border-white/5 font-mono text-sm text-white/70 overflow-auto relative">
                                <div className="absolute top-4 right-4 text-xs text-white/20 font-bold uppercase tracking-widest">aika_orchestrator_graph.py</div>
                                <pre className="whitespace-pre-wrap relative z-10 text-xs leading-relaxed">
{`# AikaOrchestratorState (LangGraph TypedDict)
class AikaOrchestratorState(TypedDict):
    message: str
    immediate_risk_level: str   # none/low/moderate/high/critical
    needs_agents: bool
    next_step: str
    final_response: str
    # ... screening profile, tool_calls, etc.

workflow = StateGraph(AikaOrchestratorState)

# Graph Nodes
workflow.add_node("aika_decision",   aika_decision_node)
workflow.add_node("parallel_crisis", parallel_crisis_node)  # TCA ∥ CMA
workflow.add_node("execute_sca",     execute_sca_subgraph)  # TCA only
workflow.add_node("execute_ia",      execute_ia_subgraph)   # IA
workflow.add_node("synthesize",      synthesize_final_response)

# Single conditional edge from Aika
workflow.add_conditional_edges(
    "aika_decision",
    should_invoke_agents,
    {
        "invoke_crisis_parallel": "parallel_crisis",
        "invoke_tca":             "execute_sca",
        "invoke_ia":              "execute_ia",
        "end":                     END,
    }
)

# Direct edges — no further branching after this
workflow.add_edge("execute_sca",     "synthesize")
workflow.add_edge("parallel_crisis", "synthesize")
workflow.add_edge("execute_ia",      "synthesize")
workflow.add_edge("synthesize",       END)

# STA is NOT a node — it's a background task:
# asyncio.create_task(trigger_sta_conversation_analysis_background(...))
# fired inside aika_decision_node on conversation_ended=True`}
                                </pre>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
