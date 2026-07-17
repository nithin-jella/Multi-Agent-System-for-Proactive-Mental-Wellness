"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
    FiClipboard, FiUser, FiCheckCircle, FiBell, FiChevronDown, FiChevronUp, FiBarChart2, FiList, FiUsers, FiRefreshCw
} from "react-icons/fi";
import { AnalyticsOverview } from "./components/AnalyticsOverview";
import { CBTModuleUsage } from "./components/CBTModuleUsage";
import { UserProgressTable } from "./components/UserProgressTable";
import { useAnalytics } from "./hooks/useAnalytics";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const apiUrl = (path: string) => (apiOrigin ? `${apiOrigin}${path}` : path);

interface InterventionPlan {
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    plan_title: string;
    risk_level: number;
    status: string;
    total_steps: number;
    completed_steps: number;
    created_at: string;
    updated_at: string;
    plan_data: {
        plan_steps: Array<{
            title: string;
            description: string;
            completed: boolean;
        }>;
        resource_cards: Array<{
            title: string;
            url: string;
            description: string;
        }>;
    };
}

interface InterventionExecution {
    id: number;
    campaign_id: number;
    user_id: number;
    status: string;
    scheduled_at: string;
    executed_at: string | null;
    delivery_method: string | null;
    notes: string | null;
    engagement_score: number | null;
    is_manual: boolean;
    user_name: string | null;
    user_email: string | null;
    campaign_title: string | null;
    priority: string | null;
    plan_preview: Record<string, unknown> | null;
}

export default function InterventionPlansPage() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'plans' | 'users'>('dashboard');
    const [plans, setPlans] = useState<InterventionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
    const [notifying, setNotifying] = useState<number | null>(null);

    const [executions, setExecutions] = useState<InterventionExecution[]>([]);
    const [executionsLoading, setExecutionsLoading] = useState(false);
    const [executionActioning, setExecutionActioning] = useState<number | null>(null);

    // Analytics hook
    const { analytics, loading: analyticsLoading } = useAnalytics(30);

    useEffect(() => {
        if (activeTab === 'plans') {
            loadPlans();
        }
        if (activeTab === 'queue') {
            loadExecutions();
        }
    }, [activeTab]);

    const loadExecutions = async () => {
        try {
            setExecutionsLoading(true);
            const params = new URLSearchParams({ limit: '50' });
            const response = await fetch(apiUrl(`/api/v1/admin/interventions/executions?${params.toString()}`), {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to load executions');
            const data = await response.json();
            const items = (data.items || []) as InterventionExecution[];
            setExecutions(items.filter((it) => it.status === 'pending_review' || it.status === 'approved'));
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to load review queue');
        } finally {
            setExecutionsLoading(false);
        }
    };

    const approveExecution = async (executionId: number) => {
        const note = prompt('Optional approval note (leave blank to skip):') ?? '';
        setExecutionActioning(executionId);
        try {
            const params = new URLSearchParams();
            if (note.trim()) params.set('note', note.trim());
            const url = apiUrl(`/api/v1/admin/interventions/executions/${executionId}/approve${params.toString() ? `?${params.toString()}` : ''}`);
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to approve execution');
            toast.success('Execution approved');
            await loadExecutions();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to approve execution');
        } finally {
            setExecutionActioning(null);
        }
    };

    const rejectExecution = async (executionId: number) => {
        const reason = prompt('Rejection reason (required):');
        if (!reason || !reason.trim()) return;

        setExecutionActioning(executionId);
        try {
            const params = new URLSearchParams({ reason: reason.trim() });
            const response = await fetch(apiUrl(`/api/v1/admin/interventions/executions/${executionId}/reject?${params.toString()}`), {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to reject execution');
            toast.success('Execution rejected');
            await loadExecutions();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to reject execution');
        } finally {
            setExecutionActioning(null);
        }
    };

    const sendExecution = async (executionId: number) => {
        if (!confirm('Send this message now?')) return;

        setExecutionActioning(executionId);
        try {
            const response = await fetch(apiUrl(`/api/v1/admin/interventions/executions/${executionId}/send`), {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to send execution');
            toast.success('Execution sent');
            await loadExecutions();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to send execution');
        } finally {
            setExecutionActioning(null);
        }
    };

    const loadPlans = async () => {
        try {
            setLoading(true);
            const response = await fetch(apiUrl("/api/v1/admin/interventions/plans"), {
                credentials: "include",
            });
            if (!response.ok) throw new Error("Failed to load plans");
            const data = await response.json();
            // Parse plan_data if it's a string (defensive coding)
            const parsedItems = data.items.map((plan: any) => ({
                ...plan,
                plan_data: typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data
            }));
            setPlans(parsedItems);
        } catch (error) {
            console.error("Error:", error);
            toast.error("Failed to load intervention plans");
        } finally {
            setLoading(false);
        }
    };

    const notifyUser = async (planId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Send notification to user about this plan?")) return;

        setNotifying(planId);
        try {
            const response = await fetch(apiUrl(`/api/v1/admin/interventions/plans/${planId}/notify`), {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) throw new Error("Failed to send notification");
            toast.success("Notification sent successfully");
        } catch (error) {
            console.error("Error:", error);
            toast.error("Failed to send notification");
        } finally {
            setNotifying(null);
        }
    };

    const getRiskBadge = (level: number) => {
        switch (level) {
            case 0: return <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">Low</span>;
            case 1: return <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">Moderate</span>;
            case 2: return <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-300">High</span>;
            case 3: return <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300">Critical</span>;
            default: return <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300">Unknown</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <FiClipboard className="text-[#FFCA40]" />
                            Intervention Plans
                        </h1>
                        <p className="text-white/70">
                            Monitor and manage active intervention plans generated by the TCA agent.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 self-start md:self-center">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'dashboard'
                                ? 'bg-[#FFCA40] text-black'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <FiBarChart2 /> Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'queue'
                                ? 'bg-[#FFCA40] text-black'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <FiCheckCircle /> Review Queue
                        </button>
                        <button
                            onClick={() => setActiveTab('plans')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'plans'
                                ? 'bg-[#FFCA40] text-black'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <FiList /> All Plans
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'users'
                                ? 'bg-[#FFCA40] text-black'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <FiUsers /> User Progress
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <AnalyticsOverview
                        analytics={analytics}
                        loading={analyticsLoading}
                        timeframeDays={30}
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CBTModuleUsage timeframeDays={30} />
                        {/* Placeholder for another chart or component */}
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <UserProgressTable />
                </div>
            )}

            {activeTab === 'queue' && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <div className="text-white font-semibold">Review Queue</div>
                            <div className="text-sm text-white/60">Approve first, then send. Rejected items will not be sent.</div>
                        </div>
                        <button
                            onClick={loadExecutions}
                            className="px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <FiRefreshCw className={executionsLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>

                    {executionsLoading ? (
                        <div className="p-8 text-center text-white/60">Loading review queue...</div>
                    ) : executions.length === 0 ? (
                        <div className="p-8 text-center text-white/60">No pending executions.</div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {executions.map((ex) => (
                                <div key={ex.id} className="p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-white font-semibold truncate">
                                                {ex.campaign_title || 'Campaign'}
                                                <span className="text-white/40 font-normal"> #{ex.id}</span>
                                            </div>
                                            <div className="text-sm text-white/60 flex flex-wrap items-center gap-2">
                                                <span>User: {ex.user_name || `#${ex.user_id}`}</span>
                                                <span className="w-1 h-1 rounded-full bg-white/30" />
                                                <span>{ex.user_email || 'No email'}</span>
                                                <span className="w-1 h-1 rounded-full bg-white/30" />
                                                <span>Scheduled: {new Date(ex.scheduled_at).toLocaleString()}</span>
                                            </div>
                                            {ex.notes && (
                                                <div className="mt-2 text-sm text-white/70">
                                                    <span className="text-white/40">Notes: </span>{ex.notes}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 self-start lg:self-center">
                                            <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                                {ex.status}
                                            </span>
                                            <button
                                                onClick={() => approveExecution(ex.id)}
                                                disabled={executionActioning === ex.id || ex.status !== 'pending_review'}
                                                className="px-3 py-2 rounded-md bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 text-sm font-medium text-[#FFCA40] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                title="Approve (required before send)"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => rejectExecution(ex.id)}
                                                disabled={executionActioning === ex.id || ex.status !== 'pending_review'}
                                                className="px-3 py-2 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-sm font-medium text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                title="Reject"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => sendExecution(ex.id)}
                                                disabled={executionActioning === ex.id || ex.status !== 'approved'}
                                                className="px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                title="Send (requires approval)"
                                            >
                                                Send
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'plans' && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {loading ? (
                        <div className="p-8 text-center text-white/60">Loading plans...</div>
                    ) : plans.length === 0 ? (
                        <div className="p-8 text-center text-white/60">No intervention plans found.</div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {plans.map((plan) => (
                                <div key={plan.id} className="group">
                                    {/* Plan Summary Row */}
                                    <div
                                        className="p-4 hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-between"
                                        onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300">
                                                <FiUser />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">{plan.plan_title}</div>
                                                <div className="text-sm text-white/60 flex items-center gap-2">
                                                    <span>{plan.user_name}</span>
                                                    <span className="w-1 h-1 rounded-full bg-white/30" />
                                                    <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <div className="text-xs text-white/40 uppercase mb-1">Risk Level</div>
                                                {getRiskBadge(plan.risk_level)}
                                            </div>

                                            <div className="flex flex-col items-end w-32">
                                                <div className="text-xs text-white/40 uppercase mb-1">Progress</div>
                                                <div className="w-full bg-white/10 rounded-full h-2 mb-1">
                                                    <div
                                                        className="bg-green-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${(plan.completed_steps / plan.total_steps) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-white/60">
                                                    {plan.completed_steps}/{plan.total_steps} steps
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => notifyUser(plan.id, e)}
                                                disabled={notifying === plan.id}
                                                className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-[#FFCA40] transition-colors"
                                                title="Notify User"
                                            >
                                                {notifying === plan.id ? (
                                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <FiBell size={20} />
                                                )}
                                            </button>

                                            <div className="text-white/40">
                                                {expandedPlanId === plan.id ? <FiChevronUp /> : <FiChevronDown />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedPlanId === plan.id && (
                                        <div className="bg-black/20 p-6 border-t border-white/10 animate-in slide-in-from-top-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Steps */}
                                                <div>
                                                    <h3 className="text-sm font-bold text-white/80 uppercase mb-3 flex items-center gap-2">
                                                        <FiCheckCircle /> Action Steps
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {plan.plan_data.plan_steps.map((step, idx) => (
                                                            <div key={idx} className="bg-white/5 p-3 rounded border border-white/10 flex gap-3">
                                                                <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${step.completed ? "bg-green-500/20 border-green-500 text-green-500" : "border-white/30 text-transparent"
                                                                    }`}>
                                                                    <FiCheckCircle size={12} />
                                                                </div>
                                                                <div>
                                                                    <div className={`font-medium ${step.completed ? "text-white/50 line-through" : "text-white"}`}>
                                                                        {step.title}
                                                                    </div>
                                                                    <div className="text-sm text-white/60 mt-1">{step.description}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Resources & Meta */}
                                                <div>
                                                    <h3 className="text-sm font-bold text-white/80 uppercase mb-3 flex items-center gap-2">
                                                        <FiClipboard /> Resources
                                                    </h3>
                                                    <div className="space-y-3 mb-6">
                                                        {plan.plan_data.resource_cards.map((resource, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={resource.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block bg-blue-500/10 hover:bg-blue-500/20 p-3 rounded border border-blue-500/30 transition-colors"
                                                            >
                                                                <div className="font-medium text-blue-300 mb-1">{resource.title}</div>
                                                                <div className="text-sm text-white/60">{resource.description}</div>
                                                            </a>
                                                        ))}
                                                    </div>

                                                    <div className="bg-white/5 p-4 rounded border border-white/10">
                                                        <div className="text-xs text-white/40 uppercase mb-2">User Details</div>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                                                <FiUser size={14} />
                                                            </div>
                                                            <div>
                                                                <div className="text-white text-sm font-medium">{plan.user_name}</div>
                                                                <div className="text-white/60 text-xs">{plan.user_email}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
