'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiMessageSquare, FiX, FiSend, FiMinimize2, FiMaximize2, FiActivity, FiShield, FiUsers, FiCalendar } from 'react-icons/fi';
import { decodeJwt } from 'jose';
import CounselorCard, { Counselor } from '@/components/features/chat/CounselorCard';
import TimeSlotCard, { TimeSlot } from '@/components/features/chat/TimeSlotCard';

interface OrchestrateChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    ts: string;
    correlationId?: string;
    resolvedAgent?: string;
    agentsInvoked?: string[];
    riskLevel?: string;
    riskScore?: number;
    interventionPlan?: Record<string, any>;
    appointment?: Record<string, any>;
    metrics?: Record<string, any>;
    pending?: boolean;
    thinkingStatus?: string;
}

interface StreamEvent {
    type: 'thinking' | 'status' | 'agent' | 'intervention_plan' | 'appointment' | 'agent_activity' | 'complete' | 'error';
    message?: string;
    node?: string;
    agent?: string;
    name?: string;
    description?: string;
    data?: Record<string, any>;
    response?: string;
    metadata?: Record<string, any>;
    error?: string;
}

const pillColor: Record<string, string> = {
    triage: "bg-[#FFCA40]/20 text-[#FFCA40] border border-[#FFCA40]/40",
    analytics: "bg-blue-500/20 text-blue-300 border border-blue-400/40",
    intervention: "bg-green-500/20 text-green-300 border border-green-400/40",
    aika: "bg-purple-500/20 text-purple-300 border border-purple-400/40",
    STA: "bg-red-500/20 text-red-300 border border-red-400/40",
    TCA: "bg-green-500/20 text-green-300 border border-green-400/40",
    CMA: "bg-blue-500/20 text-blue-300 border border-blue-400/40",
    IA: "bg-yellow-500/20 text-yellow-300 border border-yellow-400/40",
};

const riskLevelColors: Record<string, { bg: string; text: string; icon: string }> = {
    none: { bg: 'bg-green-500/20', text: 'text-green-300', icon: '✓' },
    low: { bg: 'bg-green-500/20', text: 'text-green-300', icon: '✓' },
    moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', icon: '⚠' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-300', icon: '⚠' },
    critical: { bg: 'bg-red-500/20', text: 'text-red-300', icon: '🚨' },
};

export default function AikaChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<OrchestrateChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState<{ apiBase: string } | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [currentThinking, setCurrentThinking] = useState<string | null>(null);
    const [activeAgents, setActiveAgents] = useState<Array<{ agent: string; name: string; description: string }>>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, scrollToBottom]);

    useEffect(() => {
        const backendHttpBase = (process.env.NEXT_PUBLIC_BACKEND_BASE || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const apiBase = backendHttpBase ? backendHttpBase + '/api/v1' : '';
        setConfig({ apiBase });

        const getCookie = (name: string) => {
            if (typeof document === 'undefined') return undefined;
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
        };

        const token = getCookie('access_token');
        if (token) {
            try {
                const claims = decodeJwt(token);
                if (claims.sub) {
                    setUserId(parseInt(claims.sub, 10));
                }
            } catch (e) {
                console.error("Failed to decode token:", e);
            }
        }
    }, []);

    const handleCardSelection = (text: string) => {
        if (isLoading) return;
        const correlationId = `orc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setMessages(prev => [
            ...prev,
            { id: `u-${correlationId}`, role: 'user', content: text, ts: new Date().toISOString(), correlationId },
            { id: `a-${correlationId}`, role: 'assistant', content: '', ts: new Date().toISOString(), correlationId, pending: true }
        ]);
        submitMessage(text, correlationId);
    };

    const submitMessage = async (text: string, correlationId: string) => {
        setIsLoading(true);
        setCurrentThinking('Memproses...');
        setActiveAgents([]);

        // Cancel any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const getCookie = (name: string) => {
                if (typeof document === 'undefined') return undefined;
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
            };
            const token = getCookie('access_token');

            const payload = {
                message: text,
                user_id: userId,
                role: "admin",
                conversation_history: messages.filter(m => !m.pending).map(m => ({
                    role: m.role,
                    content: m.content
                })),
                session_id: `sess_${userId}_admin`
            };

            const res = await fetch(`${config?.apiBase}/aika`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Request failed: ${res.status} ${errText}`);
            }

            // Handle SSE streaming response
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let accumulatedData = '';
            let finalResponse = '';
            let metadata: Record<string, any> = {};
            let agentsInvoked: string[] = [];
            let riskLevel: string | undefined;
            let riskScore: number | undefined;
            let interventionPlan: Record<string, any> | undefined;
            let appointment: Record<string, any> | undefined;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                accumulatedData += decoder.decode(value, { stream: true });
                const lines = accumulatedData.split('\n');
                accumulatedData = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event: StreamEvent = JSON.parse(line.slice(6));

                            switch (event.type) {
                                case 'thinking':
                                    setCurrentThinking(event.message || 'Berpikir...');
                                    break;

                                case 'status':
                                    setCurrentThinking(event.message || `Processing ${event.node}...`);
                                    break;

                                case 'agent':
                                    if (event.agent) {
                                        agentsInvoked.push(event.agent);
                                        setActiveAgents(prev => [
                                            ...prev,
                                            { agent: event.agent!, name: event.name || event.agent!, description: event.description || '' }
                                        ]);
                                    }
                                    break;

                                case 'intervention_plan':
                                    interventionPlan = event.data;
                                    break;

                                case 'appointment':
                                    appointment = event.data;
                                    break;

                                case 'agent_activity':
                                    if (event.data) {
                                        riskLevel = event.data.risk_level;
                                        riskScore = event.data.risk_score;
                                        metadata = { ...metadata, ...event.data };
                                    }
                                    break;

                                case 'complete':
                                    finalResponse = event.response || '';
                                    metadata = { ...metadata, ...event.metadata };
                                    break;

                                case 'error':
                                    throw new Error(event.message || event.error || 'Unknown streaming error');
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse SSE event:', line, parseError);
                        }
                    }
                }
            }

            setCurrentThinking(null);
            setActiveAgents([]);

            setMessages(prev => prev.map(m => (m.correlationId === correlationId && m.role === 'assistant')
                ? ({
                    ...m,
                    content: finalResponse,
                    pending: false,
                    resolvedAgent: metadata.response_source || 'aika',
                    agentsInvoked,
                    riskLevel,
                    riskScore,
                    interventionPlan,
                    appointment,
                    metrics: metadata
                })
                : m));

        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                return;
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            setMessages(prev => prev.map(m => (m.correlationId === correlationId && m.role === 'assistant')
                ? ({ ...m, content: `Error: ${msg}`, pending: false })
                : m));
            setCurrentThinking(null);
            setActiveAgents([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !config?.apiBase || !userId) return;

        const question = input.trim();
        setInput('');

        const correlationId = `orc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Optimistic update
        setMessages(prev => [
            ...prev,
            { id: `u-${correlationId}`, role: 'user', content: question, ts: new Date().toISOString(), correlationId },
            { id: `a-${correlationId}`, role: 'assistant', content: '', ts: new Date().toISOString(), correlationId, pending: true }
        ]);

        await submitMessage(question, correlationId);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-[#FFCA40] hover:bg-[#ffc107] text-[#001D58] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 group"
                aria-label="Open Aika Chat"
            >
                <div className="relative">
                    <FiMessageSquare className="w-6 h-6" />
                </div>
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#001D58] text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Chat with Aika
                </span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 bg-[#00153a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 transition-all duration-300 flex flex-col ${isMinimized ? 'w-72 h-14' : 'w-[400px] h-[600px]'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 rounded-t-2xl cursor-pointer" onClick={() => !isMinimized && setIsMinimized(true)}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFCA40] to-[#FFAB00] flex items-center justify-center text-[#001D58] font-bold">
                        A
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">Aika Assistant</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            <span className="text-[10px] text-white/60 uppercase tracking-wider">Online</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                    >
                        {isMinimized ? <FiMaximize2 className="w-4 h-4" /> : <FiMinimize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/60 hover:text-red-400 transition-colors"
                    >
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.length === 0 && (
                            <div className="text-center py-8 text-white/40">
                                <div className="text-4xl mb-3">👋</div>
                                <p className="text-sm mb-4">Halo! Aku Aika, asisten AI untuk admin. Ada yang bisa aku bantu hari ini?</p>
                                <div className="flex flex-wrap justify-center gap-2 px-2">
                                    <button 
                                        onClick={() => handleCardSelection("Tampilkan statistik platform hari ini")}
                                        className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <FiActivity className="w-3 h-3" /> Stats
                                    </button>
                                    <button 
                                        onClick={() => handleCardSelection("Ada berapa counselor yang tersedia?")}
                                        className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <FiUsers className="w-3 h-3" /> Counselors
                                    </button>
                                    <button 
                                        onClick={() => handleCardSelection("Ada appointment yang pending hari ini?")}
                                        className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <FiCalendar className="w-3 h-3" /> Appointments
                                    </button>
                                </div>
                            </div>
                        )}

                        {messages.map((m) => (
                            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user'
                                    ? 'bg-[#FFCA40] text-[#001D58] rounded-tr-none'
                                    : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/5'
                                    }`}>
                                    {m.pending && currentThinking ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="text-white/60 text-xs">{currentThinking}</span>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                    )}

                                    {m.role === 'assistant' && !m.pending && (
                                        <div className="mt-2 flex flex-col gap-2">
                                            {/* Agent Pills */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {m.resolvedAgent && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${pillColor[m.resolvedAgent] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
                                                        {m.resolvedAgent}
                                                    </span>
                                                )}
                                                {m.agentsInvoked && m.agentsInvoked.map((agent, idx) => (
                                                    <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full border ${pillColor[agent] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
                                                        {agent}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Risk Level Indicator (Admin-specific) */}
                                            {m.riskLevel && m.riskLevel !== 'none' && (
                                                <div className={`text-[10px] px-2 py-1 rounded-lg flex items-center gap-1.5 ${riskLevelColors[m.riskLevel]?.bg || 'bg-gray-500/20'} ${riskLevelColors[m.riskLevel]?.text || 'text-gray-300'}`}>
                                                    <FiShield className="w-3 h-3" />
                                                    <span className="font-medium">Risk: {m.riskLevel}</span>
                                                    {m.riskScore !== undefined && (
                                                        <span className="text-white/40">({(m.riskScore * 100).toFixed(0)}%)</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Processing Time */}
                                            {m.metrics?.processing_time_ms && (
                                                <span className="text-[10px] text-white/30">
                                                    {m.metrics.processing_time_ms.toFixed(0)}ms
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Intervention Plan Card (Admin-specific) */}
                                {m.role === 'assistant' && m.interventionPlan && (
                                    <div className="mt-2 max-w-[90%] bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-xs">
                                        <div className="flex items-center gap-2 text-green-300 font-medium mb-2">
                                            <FiActivity className="w-3.5 h-3.5" />
                                            Intervention Plan
                                        </div>
                                        <div className="space-y-1 text-white/70">
                                            {m.interventionPlan.immediate_actions && (
                                                <p><span className="text-white/40">Actions:</span> {JSON.stringify(m.interventionPlan.immediate_actions)}</p>
                                            )}
                                            {m.interventionPlan.priority && (
                                                <p><span className="text-white/40">Priority:</span> {m.interventionPlan.priority}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Appointment Card */}
                                {m.role === 'assistant' && m.appointment && (
                                    <div className="mt-2 max-w-[90%] bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs">
                                        <div className="flex items-center gap-2 text-blue-300 font-medium mb-2">
                                            <FiCalendar className="w-3.5 h-3.5" />
                                            Appointment Created
                                        </div>
                                        <div className="space-y-1 text-white/70">
                                            {m.appointment.psychologist?.full_name && (
                                                <p><span className="text-white/40">Counselor:</span> {m.appointment.psychologist.full_name}</p>
                                            )}
                                            {m.appointment.appointment_datetime && (
                                                <p><span className="text-white/40">Time:</span> {new Date(m.appointment.appointment_datetime).toLocaleString('id-ID')}</p>
                                            )}
                                            {m.appointment.status && (
                                                <p><span className="text-white/40">Status:</span> {m.appointment.status}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Interactive Cards from Tool Calls */}
                                {m.role === 'assistant' && m.metrics?.tool_calls && Array.isArray(m.metrics.tool_calls) && (
                                    <div className="mt-2 w-full overflow-x-auto pb-2 custom-scrollbar">
                                        <div className="flex gap-3 px-1">
                                            {m.metrics.tool_calls.map((tool: Record<string, unknown>) => {
                                                const toolResult = tool.result as Record<string, unknown> | undefined;
                                                if (tool.tool_name === 'get_available_counselors' && toolResult?.counselors) {
                                                    return (toolResult.counselors as Counselor[]).map((counselor) => (
                                                        <CounselorCard
                                                            key={counselor.id}
                                                            counselor={counselor}
                                                            onSelect={(c: Counselor) => handleCardSelection(`Saya pilih ${c.name} (ID: ${c.id})`)}
                                                        />
                                                    ));
                                                }
                                                if (tool.tool_name === 'suggest_appointment_times' && toolResult?.suggestions) {
                                                    return (toolResult.suggestions as TimeSlot[]).map((slot, sIdx: number) => (
                                                        <TimeSlotCard
                                                            key={sIdx}
                                                            slot={slot}
                                                            onSelect={(s: TimeSlot) => handleCardSelection(`Saya pilih waktu ${s.time_label} (${s.datetime})`)}
                                                        />
                                                    ));
                                                }
                                                return null;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Active Agents Indicator */}
                        {isLoading && activeAgents.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                                <div className="text-[10px] text-white/40 uppercase tracking-wider">Active Agents</div>
                                {activeAgents.map((agent, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${pillColor[agent.agent] || 'bg-purple-500/20 text-purple-300 border-purple-400/40'}`}>
                                            {agent.name}
                                        </span>
                                        <span className="text-[10px] text-white/40">{agent.description}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask Aika..."
                                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFCA40]/50 focus:ring-1 focus:ring-[#FFCA40]/50 transition-all"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="p-2.5 bg-[#FFCA40] hover:bg-[#ffc107] disabled:opacity-50 disabled:cursor-not-allowed text-[#001D58] rounded-xl transition-colors"
                            >
                                <FiSend className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}
