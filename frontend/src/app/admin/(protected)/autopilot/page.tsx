"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiCheckCircle,
  FiExternalLink,
  FiRefreshCw,
  FiXCircle,
  FiCpu,
  FiAlertTriangle,
  FiActivity,
  FiClock,
  FiShield,
  FiPlay,
  FiDatabase,
  FiUserCheck,
  FiTrendingUp,
  FiSave,
  FiAlertCircle,
} from "react-icons/fi";

import {
  approveAutopilotAction,
  getAutopilotStatus,
  listAutopilotActions,
  rejectAutopilotAction,
  getAutopilotPolicy,
  updateAutopilotPolicy,
  type AdminAutopilotAction,
  type AdminAutopilotStatus,
  type AdminAutopilotPolicy,
} from "@/services/adminAutopilotApi";
import NoteInputDialog from "@/components/ui/NoteInputDialog";

const REVIEWABLE = new Set(["awaiting_approval"]);

// Helper component for status badges
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    awaiting_approval: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    running: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    confirmed: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    failed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  
  const defaultStyle = "bg-slate-500/10 text-slate-400 border-slate-500/20";
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || defaultStyle}`}>
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
};

// Helper component for risk badges
const RiskBadge = ({ level }: { level: string }) => {
  const styles: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${styles[level.toLowerCase()] || "bg-slate-700 text-slate-300 border-slate-600"}`}>
      {level.toUpperCase()}
    </span>
  );
};

interface PolicyFormState {
  autopilot_enabled: boolean;
  onchain_placeholder: boolean;
  worker_interval_seconds: number;
}

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="mt-1 text-xs text-white/60">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            checked ? "bg-emerald-500/70" : "bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default function AdminAutopilotPage() {
  const [activeTab, setActiveTab] = useState<"actions" | "policy">("actions");

  // Autopilot Actions State
  const [items, setItems] = useState<AdminAutopilotAction[]>([]);
  const [status, setStatus] = useState<AdminAutopilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("awaiting_approval");
  const [actingId, setActingId] = useState<number | null>(null);

  // Policy State
  const [policy, setPolicy] = useState<AdminAutopilotPolicy | null>(null);
  const [form, setForm] = useState<PolicyFormState | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Note Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: "approve" | "reject" | null;
    actionId: number | null;
    title: string;
    message: string;
    inputLabel: string;
    inputPlaceholder: string;
    confirmLabel: string;
    cancelLabel: string;
  }>({
    isOpen: false,
    type: null,
    actionId: null,
    title: "",
    message: "",
    inputLabel: "",
    inputPlaceholder: "",
    confirmLabel: "",
    cancelLabel: "",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [response, statusResponse] = await Promise.all([
        listAutopilotActions({ status: statusFilter || undefined, limit: 100 }),
        getAutopilotStatus(),
      ]);
      setItems(response.items);
      setStatus(statusResponse);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load autopilot actions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadPolicyData = useCallback(async () => {
    try {
      setLoadingPolicy(true);
      const next = await getAutopilotPolicy();
      setPolicy(next);
      setForm({ ...next });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load autopilot policy");
    } finally {
      setLoadingPolicy(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "actions") {
      load().catch(() => undefined);
    } else if (activeTab === "policy") {
      loadPolicyData().catch(() => undefined);
    }
  }, [activeTab, load, loadPolicyData]);

  const reviewableCount = useMemo(
    () => items.filter((item) => REVIEWABLE.has(item.status)).length,
    [items],
  );

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => ["confirmed", "executed"].includes(i.status)).length;
    const failed = items.filter((i) => i.status === "failed").length;
    return { total, completed, failed };
  }, [items]);

  const hasPolicyChanges = useMemo(() => {
    if (!policy || !form) return false;
    return (
      policy.autopilot_enabled !== form.autopilot_enabled ||
      policy.onchain_placeholder !== form.onchain_placeholder ||
      policy.worker_interval_seconds !== form.worker_interval_seconds
    );
  }, [policy, form]);

  const updateForm = <K extends keyof PolicyFormState>(key: K, value: PolicyFormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSavePolicy = async () => {
    if (!form || !policy) return;
    try {
      setSavingPolicy(true);
      const updated = await updateAutopilotPolicy({
        autopilot_enabled: form.autopilot_enabled,
        onchain_placeholder: form.onchain_placeholder,
        worker_interval_seconds: form.worker_interval_seconds,
      });
      setPolicy(updated);
      setForm({ ...updated });
      toast.success("Autopilot policy updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update autopilot policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleApproveClick = (action: AdminAutopilotAction) => {
    setDialogConfig({
      isOpen: true,
      type: "approve",
      actionId: action.id,
      title: `Approve Action #${action.id}`,
      message: `Are you sure you want to approve this ${action.action_type} action? It will be queued for execution.`,
      inputLabel: "Approval Note (Optional)",
      inputPlaceholder: "Enter any notes for this approval...",
      confirmLabel: "Approve",
      cancelLabel: "Cancel",
    });
  };

  const handleRejectClick = (action: AdminAutopilotAction) => {
    setDialogConfig({
      isOpen: true,
      type: "reject",
      actionId: action.id,
      title: `Reject Action #${action.id}`,
      message: `Are you sure you want to reject this ${action.action_type} action? This action will not be executed.`,
      inputLabel: "Rejection Note (Required)",
      inputPlaceholder: "Enter reason for rejection...",
      confirmLabel: "Reject",
      cancelLabel: "Cancel",
    });
  };

  const handleDialogConfirm = async (note: string) => {
    const { actionId, type } = dialogConfig;
    if (!actionId || !type) return;

    setDialogConfig((prev) => ({ ...prev, isOpen: false }));

    if (type === "approve") {
      try {
        setActingId(actionId);
        await approveAutopilotAction(actionId, note || undefined);
        toast.success(`Approved action #${actionId}`);
        await load();
      } catch (error) {
        console.error(error);
        toast.error("Failed to approve action");
      } finally {
        setActingId(null);
      }
    } else if (type === "reject") {
      try {
        setActingId(actionId);
        await rejectAutopilotAction(actionId, note);
        toast.success(`Rejected action #${actionId}`);
        await load();
      } catch (error) {
        console.error(error);
        toast.error("Failed to reject action");
      } finally {
        setActingId(null);
      }
    }
  };

  const closeDialog = () => {
    setDialogConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const FilterTab = ({ value, label, icon: Icon, count }: { value: string, label: string, icon: any, count?: number }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
        statusFilter === value
          ? "border-[#FFCA40] text-[#FFCA40]"
          : "border-transparent text-white/60 hover:text-white hover:border-white/20"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && (
        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${statusFilter === value ? "bg-[#FFCA40]/10 text-[#FFCA40]" : "bg-white/10 text-white/60"}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
              <div className="p-2 rounded-lg bg-[#FFCA40]/10 border border-[#FFCA40]/20">
                <FiCpu className="w-8 h-8 text-[#FFCA40]" />
              </div>
              Autopilot
            </h1>
            <p className="mt-2 text-white/60 max-w-2xl">
              Monitor and manage autonomous agent actions. Configure runtime policies and review high-risk decisions.
            </p>
          </div>
          {activeTab === "actions" ? (
            <div className="flex gap-2">
              <button
                onClick={() => load()}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors flex items-center gap-2"
              >
                <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh Data
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => loadPolicyData()}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors flex items-center gap-2"
              >
                <FiRefreshCw className={loadingPolicy ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          )}
        </div>

        {/* Main Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("actions")}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "actions"
                ? "border-[#FFCA40] text-[#FFCA40]"
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            Actions
          </button>
          <button
            onClick={() => setActiveTab("policy")}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "policy"
                ? "border-[#FFCA40] text-[#FFCA40]"
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            Policy
          </button>
        </div>
      </div>

      {activeTab === "actions" && (
        <div className="space-y-6">
          {/* Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${status?.enabled ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
              <div className="text-sm text-white/60 mb-1">System Status</div>
              <div className={`text-xl font-bold flex items-center gap-2 ${status?.enabled ? "text-emerald-400" : "text-red-400"}`}>
                <FiCheckCircle /> {status?.enabled ? "Active" : "Disabled"}
              </div>
              <div className="mt-2 text-xs text-white/40">Worker Interval: {status?.worker_interval_seconds ?? "-"}s</div>
            </div>

            <div className={`p-4 rounded-xl border ${!status?.onchain_placeholder ? "bg-cyan-500/5 border-cyan-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
              <div className="text-sm text-white/60 mb-1">Execution Mode</div>
              <div className={`text-xl font-bold flex items-center gap-2 ${!status?.onchain_placeholder ? "text-cyan-400" : "text-amber-400"}`}>
                {!status?.onchain_placeholder ? <FiActivity /> : <FiAlertTriangle />}
                {!status?.onchain_placeholder ? "Live Blockchain" : "Placeholder"}
              </div>
               <div className="mt-2 text-xs text-white/40">{!status?.onchain_placeholder ? "Transactions are broadcast on-chain" : "Transactions are simulated"}</div>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="text-sm text-white/60 mb-1">Queue Health</div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <FiClock className="text-[#FFCA40]" /> {reviewableCount} Pending
              </div>
              <div className="mt-2 text-xs text-white/40">Requires immediate attention</div>
            </div>

             <div className="p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="text-sm text-white/60 mb-1">Success Rate</div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <FiTrendingUp className="text-purple-400" /> 
                {stats.total > 0 ? Math.round((stats.completed / (stats.total || 1)) * 100) : 0}%
              </div>
              <div className="mt-2 text-xs text-white/40">{stats.completed} successes, {stats.failed} failures</div>
            </div>
          </div>

          {/* Process Flow Visualization */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <FiCpu className="w-64 h-64" />
            </div>
            
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
               <FiActivity className="text-[#FFCA40]" /> How Autopilot Works
            </h2>

            <div className="relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/20 via-[#FFCA40]/20 to-purple-500/20 -translate-y-1/2 z-0"></div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
                {[
                  { icon: FiCpu, title: "1. Agent Trigger", desc: "AI proposes an action based on context", color: "text-emerald-400" },
                  { icon: FiShield, title: "2. Policy Check", desc: "Evaluated against risk rules", color: "text-blue-400" },
                  { icon: FiClock, title: "3. Queue / Review", desc: "High risk? Wait for human approval", color: "text-amber-400" },
                  { icon: FiPlay, title: "4. Execution", desc: "Worker picks up approved tasks", color: "text-cyan-400" },
                  { icon: FiDatabase, title: "5. On-Chain", desc: "Result verified on blockchain", color: "text-purple-400" }
                ].map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-4 rounded-lg bg-[#0A1628] border border-white/5 hover:border-white/20 transition-all group">
                    <div className={`p-3 rounded-full bg-white/5 mb-3 group-hover:scale-110 transition-transform ${step.color}`}>
                      <step.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium text-white text-sm">{step.title}</h3>
                    <p className="text-xs text-white/50 mt-1">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Filters */}
          <div className="flex flex-wrap border-b border-white/10">
            <FilterTab value="awaiting_approval" label="Review Needed" icon={FiAlertTriangle} count={reviewableCount} />
            <FilterTab value="" label="All Actions" icon={FiDatabase} count={items.length} />
            <FilterTab value="running" label="In Progress" icon={FiPlay} />
            <FilterTab value="confirmed" label="Completed" icon={FiCheckCircle} />
            <FilterTab value="failed" label="Failed" icon={FiXCircle} />
          </div>

          {/* List View */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-white/10 bg-white/5 animate-pulse">
              <div className="h-8 w-8 bg-white/10 rounded-full mb-4"></div>
              <p className="text-white/40">Loading actions...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-white/10 bg-white/5">
              <FiDatabase className="w-12 h-12 text-white/20 mb-4" />
              <p className="text-white/60 text-lg font-medium">No actions found</p>
              <p className="text-white/40 text-sm">Try changing the filter or refresh the list</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map((action) => {
                const isReviewable = REVIEWABLE.has(action.status);
                const isActing = actingId === action.id;

                return (
                  <div 
                    key={action.id} 
                    className={`group rounded-xl border p-4 transition-all ${
                      isReviewable 
                        ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40" 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono text-white/40">#{action.id}</span>
                          <h3 className="font-semibold text-white truncate">{action.action_type}</h3>
                          <StatusBadge status={action.status} />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-sm text-white/60">
                          <div className="flex items-center gap-2">
                             <span className="text-white/40">Risk:</span>
                             <RiskBadge level={action.risk_level} />
                          </div>
                          <div className="flex items-center gap-2 truncate" title={action.policy_decision}>
                             <span className="text-white/40">Policy:</span>
                             <span className="truncate">{action.policy_decision}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-white/40">Created:</span>
                             <span>{new Date(action.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Error / Notes Section */}
                        {(action.error_message || action.approval_notes) && (
                          <div className="mt-3 py-2 px-3 rounded bg-black/20 text-xs border border-white/5">
                            {action.error_message && (
                              <div className="text-red-300 flex items-start gap-2">
                                <FiXCircle className="mt-0.5 shrink-0" /> {action.error_message}
                              </div>
                            )}
                            {action.approval_notes && (
                              <div className="text-amber-200/70 flex items-start gap-2 mt-1">
                                <FiUserCheck className="mt-0.5 shrink-0" /> Note: {action.approval_notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                        {action.explorer_tx_url && (
                          <a
                            href={action.explorer_tx_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                            title="View on Blockchain Explorer"
                          >
                            <FiExternalLink className="w-5 h-5" />
                          </a>
                        )}

                        {isReviewable && (
                          <>
                            <button
                              onClick={() => handleApproveClick(action)}
                              disabled={isActing}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-emerald-900/20"
                            >
                              {isActing && dialogConfig.type === 'approve' ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />}
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectClick(action)}
                              disabled={isActing}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <FiXCircle /> 
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "policy" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-medium text-white">Flow and Decision Policy</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/70">
              <li>Agent proposes an action with risk metadata.</li>
              <li>Policy evaluates action type + risk to allow or deny.</li>
              <li>Queue executes allowed actions; denied actions are recorded as failed.</li>
              <li>If on-chain placeholder is off, execution attempts real blockchain transactions.</li>
            </ol>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-medium text-white">Policy Settings</h2>

            {loadingPolicy || !form ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Loading policy...
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <ToggleRow
                  label="Autopilot Enabled"
                  description="Turns autopilot worker processing on or off."
                  checked={form.autopilot_enabled}
                  onChange={(value) => updateForm("autopilot_enabled", value)}
                />

                <ToggleRow
                  label="On-chain Placeholder Mode"
                  description="When enabled, on-chain actions are simulated using synthetic transaction hashes."
                  checked={form.onchain_placeholder}
                  onChange={(value) => updateForm("onchain_placeholder", value)}
                />

                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <label htmlFor="worker-interval" className="block text-sm font-medium text-white">
                    Worker Interval (seconds)
                  </label>
                  <p className="mt-1 text-xs text-white/60">Polling interval used by autopilot queue processor.</p>
                  <input
                    id="worker-interval"
                    type="number"
                    min={1}
                    max={3600}
                    value={form.worker_interval_seconds}
                    onChange={(event) =>
                      updateForm(
                        "worker_interval_seconds",
                        Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1),
                      )
                    }
                    className="mt-3 w-full rounded-lg border border-white/20 bg-[#001D58] px-3 py-2 text-sm text-white md:w-56"
                  />
                </div>

                <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="flex items-start gap-2">
                    <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Runtime updates are applied to the active backend process. For persistent config, also update backend .env. Worker startup controls (enabled and interval) may require backend restart to fully take effect.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSavePolicy()}
                    disabled={!hasPolicyChanges || savingPolicy}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#FFCA40] px-4 py-2 text-sm font-medium text-[#001D58] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPolicy ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
                    Save Policy
                  </button>
                  {!hasPolicyChanges && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                      <FiCheckCircle className="h-3.5 w-3.5" /> No pending changes
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="flex items-center gap-2 text-lg font-medium text-white">
              <FiCpu className="text-[#FFCA40]" /> Why Execution Mode shows Placeholder
            </h2>
            <p className="mt-2 text-sm text-white/70">
              The Autopilot Queue badge reads the backend field onchain_placeholder. If it is true, the UI shows Placeholder mode and the worker simulates transaction hashes.
            </p>
          </section>
        </div>
      )}

      <NoteInputDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        inputLabel={dialogConfig.inputLabel}
        inputPlaceholder={dialogConfig.inputPlaceholder}
        confirmLabel={dialogConfig.confirmLabel}
        cancelLabel={dialogConfig.cancelLabel}
        onConfirm={handleDialogConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
