'use client';

import { useEffect, useState } from 'react';
import { useLangGraphAnalytics } from '../hooks/useLangGraphAnalytics';
import { getExecutionDetails } from '@/services/langGraphApi';

interface AgentDetailsPanelProps {
    agentId: string | null;
    onClose: () => void;
    healthData: any;
}

export function AgentDetailsPanel({ agentId, onClose, healthData }: AgentDetailsPanelProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'executions' | 'alerts'>('overview');
    const { history, fetchHistory } = useLangGraphAnalytics();

    // Map 'aika' to 'orchestrator' for data lookup
    const mappedAgentId = agentId === 'aika' ? 'orchestrator' : agentId;

    useEffect(() => {
        if (mappedAgentId) {
            // Fetch history for this specific agent
            fetchHistory({
                limit: 10,
                offset: 0,
                graph_name: mappedAgentId === 'orchestrator' ? 'orchestrator' : mappedAgentId as any
            });
        }
    }, [mappedAgentId, fetchHistory]);

    if (!agentId) return null;

    const graphData = healthData?.graphs?.find((g: any) =>
        g?.graph_name && g.graph_name.toLowerCase() === (mappedAgentId === 'orchestrator' ? 'orchestrator' : mappedAgentId?.toLowerCase())
    );

    const getAgentName = (id: string) => {
        const names: Record<string, string> = {
            sta: 'Safety Triage Agent',
            tca: 'Therapeutic Coach Agent',
            cma: 'Case Management Agent',
            ia: 'Insights Agent',
            aika: 'AIKA Meta-Agent',
            orchestrator: 'Orchestrator',
            user: 'User'
        };
        return names[id.toLowerCase()] || id;
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-[#00153a]/80 backdrop-blur-2xl border-l border-white/5 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col">
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex justify-between items-start bg-gradient-to-b from-white/5 to-transparent">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{getAgentName(agentId)}</h2>
                    <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${graphData?.status === 'healthy' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
                            graphData?.status === 'degraded' ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' :
                                'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'
                            }`}></span>
                        <span className="text-sm text-white/60 uppercase tracking-wider font-medium">
                            {graphData?.status || 'Unknown Status'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 px-8">
                {['overview', 'executions', 'alerts'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`py-4 px-1 mr-6 text-sm font-medium border-b-2 transition-all capitalize ${activeTab === tab
                            ? 'border-[#FFCA40] text-[#FFCA40]'
                            : 'border-transparent text-white/40 hover:text-white hover:border-white/10'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Success Rate</div>
                                <div className={`text-3xl font-bold ${(graphData?.success_rate ?? 0) >= 0.95 ? 'text-emerald-400' :
                                    (graphData?.success_rate ?? 0) >= 0.70 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                    {((graphData?.success_rate ?? 0) * 100).toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Total Executions</div>
                                <div className="text-3xl font-bold text-white">
                                    {graphData?.total_executions?.toLocaleString() ?? '-'}
                                </div>
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Avg Duration</div>
                                <div className="text-3xl font-bold text-white">
                                    {graphData?.average_duration_ms?.toFixed(0) ?? '-'} <span className="text-sm font-normal text-white/40">ms</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Error Rate</div>
                                <div className="text-3xl font-bold text-red-400">
                                    {((graphData?.error_rate ?? 0) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        {/* Performance Trend (Placeholder) */}
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-6">Performance Trend</h3>
                            <div className="h-32 flex items-end gap-1.5">
                                {[...Array(20)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 bg-blue-500/20 hover:bg-blue-500/40 transition-colors rounded-t-sm"
                                        style={{ height: `${Math.random() * 100}%` }}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'executions' && (
                    <div className="space-y-3">
                        {history?.data.map((exec) => (
                            <div key={exec.execution_id} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${exec.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                        exec.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                            'bg-blue-500/10 text-blue-400'
                                        }`}>
                                        {exec.status}
                                    </span>
                                    <span className="text-xs text-white/40 font-mono">
                                        {new Date(exec.started_at).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-white/60 group-hover:text-white transition-colors">{exec.total_nodes_executed} steps</span>
                                    <span className="text-white/60 font-mono group-hover:text-white transition-colors">{exec.total_execution_time_ms}ms</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'alerts' && (
                    <div className="text-center py-12 text-white/40">
                        <p>No active alerts for this agent.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
