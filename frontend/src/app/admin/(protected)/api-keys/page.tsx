"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiCopy,
  FiKey,
  FiPlus,
  FiRefreshCw,
  FiServer,
  FiShield,
  FiTrendingUp,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import clsx from "clsx";
import toast from "react-hot-toast";

import { apiCall } from "@/utils/adminApi";
import type {
  ApiKeyStatusResponse,
  KeySnapshot,
  AddKeyResponse,
  ActiveModelStatusResponse,
} from "@/types/admin/apiKeys";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable relative time (e.g. "3 min ago"). */
function timeAgo(isoString: string | null): string {
  if (!isoString) return "Never";
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function timeAgoFromEpoch(epochSeconds: number | null): string {
  if (!epochSeconds) return "Never";
  return timeAgo(new Date(epochSeconds * 1000).toISOString());
}

function formatChatModelLabel(model: string): string {
  const lower = model.toLowerCase();
  if (lower === "gemini:auto") return "Gemini (Auto Routing)";
  if (lower === "gemini-3.1-flash-lite-preview") return "Gemini 3.1 Flash-Lite (Preview)";
  if (lower === "glm-4.7") return "Z.AI GLM-4.7 (Direct Coding Plan)";
  if (lower === "glm-4.7-flash") return "Z.AI GLM-4.7 Flash (Direct Coding Plan)";
  if (lower === "z-ai/glm-4.7") return "Z.AI GLM-4.7 (OpenRouter)";
  if (lower === "z-ai/glm-4.7-flash") return "Z.AI GLM-4.7 Flash (OpenRouter)";
  return model;
}

/** Format uptime seconds to human-readable string. */
function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Determine health level for a key based on rate-limit and error data. */
function keyHealth(key: KeySnapshot): "healthy" | "warning" | "critical" {
  if (key.is_on_cooldown) return "critical";
  if (key.rate_limited_hits > 0 && key.errors_last_hour > 2) return "critical";
  if (key.rate_limited_hits > 0 || key.errors_last_hour > 0) return "warning";
  return "healthy";
}

const healthColors = {
  healthy: "border-emerald-500/40 bg-emerald-500/10",
  warning: "border-yellow-500/40 bg-yellow-500/10",
  critical: "border-red-500/40 bg-red-500/10",
};

const healthDot = {
  healthy: "bg-emerald-400",
  warning: "bg-yellow-400",
  critical: "bg-red-400",
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent = false,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  /** Optional 0–100 fill bar rendered below the sub-label. */
  progress?: number;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-5 backdrop-blur transition-colors",
        accent
          ? "border-[#FFCA40]/30 bg-[#FFCA40]/5"
          : "border-white/10 bg-white/5"
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm text-white/50">
        {icon}
        {label}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor:
                progress > 25 ? "#f87171" : progress > 10 ? "#fbbf24" : "#34d399",
            }}
          />
        </div>
      )}
    </div>
  );
}

function ModelBadge({ model, count }: { model: string; count: number }) {
  // Short display name
  const short = model
    .replace("gemini-", "")
    .replace("-preview", "")
    .replace("-lite", " lite");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
      <FiServer size={12} className="text-[#FFCA40]" />
      {short}
      <span className="ml-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
        {count}
      </span>
    </span>
  );
}

function CooldownBar({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <FiClock size={14} className="shrink-0 text-red-400" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-red-400 transition-all duration-1000"
          style={{ width: `${Math.min((remaining / 60) * 100, 100)}%` }}
        />
      </div>
      <span className="text-xs text-red-300">{Math.ceil(remaining)}s</span>
    </div>
  );
}

/** Tiny SVG donut ring that represents a 0–100% fill. */
function SuccessRateRing({
  rate,
  size = 32,
}: {
  rate: number;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(Math.max(rate, 0), 100);
  const color =
    fill >= 90 ? "#34d399" : fill >= 70 ? "#fbbf24" : "#f87171";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${(fill / 100) * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/**
 * Three-column micro bar chart for a key's hourly activity snapshot.
 * Columns: requests last hour (blue), errors last hour (red), rate-limit hits (yellow).
 */
function ActivityMiniChart({ snapshot }: { snapshot: KeySnapshot }) {
  const bars = [
    { label: "Req/hr", value: snapshot.requests_last_hour, color: "#60a5fa" },
    { label: "Err/hr", value: snapshot.errors_last_hour, color: "#f87171" },
    { label: "Limits", value: snapshot.rate_limited_hits, color: "#fbbf24" },
  ];
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const chartH = 28;

  return (
    <div className="mb-3 rounded-lg bg-white/5 px-3 py-2">
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/30">
        Activity
      </p>
      <div className="flex items-end gap-2">
        {bars.map((bar) => {
          const barH = Math.max((bar.value / maxVal) * chartH, 2);
          return (
            <div
              key={bar.label}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: bar.color }}
              >
                {bar.value}
              </span>
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: `${barH}px`,
                  backgroundColor: bar.color,
                  opacity: 0.7,
                }}
              />
              <span className="text-[9px] text-white/30">{bar.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyCard({ snapshot }: { snapshot: KeySnapshot }) {
  const health = keyHealth(snapshot);
  const successRate =
    snapshot.total_requests > 0
      ? ((snapshot.successful_requests / snapshot.total_requests) * 100).toFixed(
          1
        )
      : "N/A";

  const modelEntries = Object.entries(snapshot.requests_by_model).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div
      className={clsx(
        "rounded-xl border p-5 backdrop-blur transition-all",
        healthColors[health]
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={clsx("h-2.5 w-2.5 rounded-full", healthDot[health])}
          />
          <h3 className="text-sm font-semibold text-white">
            {snapshot.key_label}
          </h3>
        </div>
        {snapshot.is_on_cooldown && (
          <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
            Cooldown
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-white/40">Total</p>
          <p className="font-mono text-lg font-bold text-white">
            {snapshot.total_requests.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-white/40">Success</p>
          <div className="flex items-center gap-2">
            {successRate !== "N/A" && (
              <SuccessRateRing rate={parseFloat(successRate)} />
            )}
            <p className="font-mono text-lg font-bold text-emerald-400">
              {successRate}%
            </p>
          </div>
        </div>
        <div>
          <p className="text-white/40">Last Hour</p>
          <p className="font-mono text-white">
            {snapshot.requests_last_hour}
          </p>
        </div>
        <div>
          <p className="text-white/40">Rate Limits</p>
          <p
            className={clsx(
              "font-mono",
              snapshot.rate_limited_hits > 0 ? "text-red-400" : "text-white/60"
            )}
          >
            {snapshot.rate_limited_hits}
          </p>
        </div>
      </div>

      {/* Activity micro chart */}
      <ActivityMiniChart snapshot={snapshot} />

      {/* Model distribution */}
      {modelEntries.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {modelEntries.map(([model, count]) => (
            <ModelBadge key={model} model={model} count={count} />
          ))}
        </div>
      )}

      {/* Cooldown bar */}
      <CooldownBar remaining={snapshot.cooldown_remaining_s} />

      {/* Footer meta */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-white/30">
        <span>Used {timeAgo(snapshot.last_used_at)}</span>
        {snapshot.last_error_at && (
          <span className="text-red-400/60">
            Error {timeAgo(snapshot.last_error_at)}
          </span>
        )}
      </div>

      {/* Last error message (truncated) */}
      {snapshot.last_error_message && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-200/70">
          {snapshot.last_error_message}
        </p>
      )}
    </div>
  );
}

function AlertBanner({
  data,
}: {
  data: ApiKeyStatusResponse;
}) {
  const { summary, keys } = data;
  const alerts: { level: "critical" | "warning"; message: string }[] = [];
  const breakerSummary = data.circuit_breakers?.summary;

  // All keys on cooldown = critical
  if (
    summary.keys_on_cooldown >= summary.total_keys &&
    summary.total_keys > 0
  ) {
    alerts.push({
      level: "critical",
      message:
        "All API keys are on cooldown. Requests will fail until cooldown expires.",
    });
  } else if (summary.keys_on_cooldown > 0) {
    alerts.push({
      level: "warning",
      message: `${summary.keys_on_cooldown} of ${summary.total_keys} keys on cooldown. Rotation is handling it.`,
    });
  }

  // High error rate
  if (summary.error_rate > 25 && summary.total_requests > 10) {
    alerts.push({
      level: "critical",
      message: `Error rate is ${summary.error_rate}% across all keys.`,
    });
  } else if (summary.error_rate > 10 && summary.total_requests > 10) {
    alerts.push({
      level: "warning",
      message: `Error rate elevated at ${summary.error_rate}%.`,
    });
  }

  // Per-key rate limit spikes
  keys.forEach((k) => {
    if (k.rate_limited_hits > 5 && k.errors_last_hour > 3) {
      alerts.push({
        level: "warning",
        message: `${k.key_label} approaching quota: ${k.rate_limited_hits} rate limits, ${k.errors_last_hour} errors in the last hour.`,
      });
    }
  });

  if (breakerSummary?.open_models && breakerSummary.open_models > 0) {
    alerts.push({
      level: breakerSummary.open_models > 1 ? "critical" : "warning",
      message: `${breakerSummary.open_models} model circuit breaker(s) open. Requests will route around affected models.`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={clsx(
            "flex items-start gap-3 rounded-xl border p-4 text-sm",
            a.level === "critical"
              ? "border-red-500/40 bg-red-500/10 text-red-100"
              : "border-yellow-500/40 bg-yellow-500/10 text-yellow-100"
          )}
        >
          <FiAlertTriangle
            className={clsx(
              "mt-0.5 shrink-0",
              a.level === "critical" ? "text-red-400" : "text-yellow-400"
            )}
            size={18}
          />
          {a.message}
        </div>
      ))}
    </div>
  );
}

function CircuitBreakerPanel({
  payload,
}: {
  payload: ApiKeyStatusResponse["circuit_breakers"];
}) {
  const models = [...payload.models].sort((a, b) => {
    if (a.is_open === b.is_open) {
      return a.model.localeCompare(b.model);
    }
    return a.is_open ? -1 : 1;
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <FiActivity size={16} className="text-[#FFCA40]" /> Circuit Breakers
          </h3>
          <p className="text-xs text-white/40">
            Open breakers route traffic away from unstable models.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/60">
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
            Models: {payload.summary.total_models}
          </span>
          <span
            className={clsx(
              "rounded-md border px-2 py-1",
              payload.summary.open_models > 0
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            )}
          >
            Open: {payload.summary.open_models}
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
            Opens: {payload.summary.total_opens}
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
            Closes: {payload.summary.total_closes}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {models.map((model) => (
          <div
            key={model.model}
            className={clsx(
              "rounded-lg border px-4 py-3",
              model.is_open
                ? "border-red-500/40 bg-red-500/10"
                : "border-white/10 bg-white/5"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">
                {model.model}
              </span>
              <span
                className={clsx(
                  "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  model.is_open
                    ? "bg-red-500/20 text-red-200"
                    : "bg-emerald-500/20 text-emerald-200"
                )}
              >
                {model.is_open ? "Open" : "Closed"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/50">
              <span>Failures: {model.failures_in_window}</span>
              <span>Remaining: {Math.ceil(model.open_remaining_s)}s</span>
              <span>Last Open: {timeAgoFromEpoch(model.last_opened_at)}</span>
              <span>Last Close: {timeAgoFromEpoch(model.last_closed_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelUsageChart({ snapshots }: { snapshots: KeySnapshot[] }) {
  const totals: Record<string, number> = {};

  snapshots.forEach((snapshot) => {
    Object.entries(snapshot.requests_by_model).forEach(([model, count]) => {
      totals[model] = (totals[model] || 0) + count;
    });
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const maxValue = entries.length > 0 ? entries[0][1] : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
        <FiTrendingUp size={16} className="text-[#FFCA40]" /> Model Usage (Snapshot)
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-white/40">No model usage recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([model, count]) => {
            const width = maxValue ? Math.round((count / maxValue) * 100) : 0;
            return (
              <div key={model} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{model}</span>
                  <span>{count.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#FFCA40]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelHistoryChart({ history }: { history: ApiKeyStatusResponse["model_history"] }) {
  const palette = [
    "#FFCA40",
    "#60A5FA",
    "#34D399",
    "#F472B6",
    "#F59E0B",
  ];

  if (!history || history.series.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
          <FiTrendingUp size={16} className="text-[#FFCA40]" /> Model History (Last Hour)
        </div>
        <p className="text-xs text-white/40">No historical data yet.</p>
      </div>
    );
  }

  const allPoints = history.series.flatMap((s) => s.points.map((p) => p.count));
  const maxValue = Math.max(1, ...allPoints);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <FiTrendingUp size={16} className="text-[#FFCA40]" /> Model History (Last Hour)
          </h3>
          <p className="text-xs text-white/40">
            Bucketed every {Math.round(history.bucket_seconds / 60)} minutes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-white/50">
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
            Window: {Math.round(history.window_seconds / 60)}m
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {history.series.map((series, index) => {
          const color = palette[index % palette.length];
          const points = series.points.map((point, i) => {
            const x = (i / Math.max(series.points.length - 1, 1)) * 100;
            const y = 40 - (point.count / maxValue) * 40;
            return `${x},${y}`;
          });

          return (
            <div key={series.model} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                <span>{series.model}</span>
                <span>Total: {series.points.reduce((sum, p) => sum + p.count, 0)}</span>
              </div>
              <svg viewBox="0 0 100 40" className="h-10 w-full">
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  points={points.join(" ")}
                />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FallbackChainViz({ chain }: { chain: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
        <FiZap size={16} className="text-[#FFCA40]" />
        Fallback Chain
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {chain.map((model, i) => {
          const short = model
            .replace("gemini-", "")
            .replace("-preview", "")
            .replace("-lite", " lite");
          return (
            <div key={model} className="flex items-center gap-2">
              <span
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium",
                  i === 0
                    ? "border-[#FFCA40]/40 bg-[#FFCA40]/10 text-[#FFCA40]"
                    : "border-white/10 bg-white/5 text-white/60"
                )}
              >
                {i === 0 && "Primary: "}
                {short}
              </span>
              {i < chain.length - 1 && (
                <span className="text-white/20">&rarr;</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddKeyForm({ onKeyAdded }: { onKeyAdded: () => void }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [masked, setMasked] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 10) {
      toast.error("API key must be at least 10 characters.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiCall<AddKeyResponse>(
        "/api/v1/admin/system/api-keys",
        { method: "POST", body: JSON.stringify({ api_key: trimmed }) }
      );
      toast.success(res.message);
      setValue("");
      onKeyAdded();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to add key";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const displayValue = masked && value.length > 8
    ? `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`
    : value;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
        <FiPlus size={16} className="text-[#FFCA40]" />
        Add API Key
      </h3>
      <p className="mb-4 text-xs text-white/40">
        Adds a new Gemini API key to the runtime rotation pool. The key is not
        persisted across restarts (set it via the GEMINI_API_KEY env vars for
        persistence).
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={masked ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
          />
          <button
            type="button"
            onClick={() => setMasked((p) => !p)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
            tabIndex={-1}
          >
            {masked ? <FiShield size={14} /> : <FiKey size={14} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={submitting || value.trim().length < 10}
          className="flex items-center gap-2 rounded-lg bg-[#FFCA40] px-5 py-2.5 text-sm font-semibold text-[#000B1F] transition hover:bg-[#FFCA40]/90 disabled:opacity-40"
        >
          {submitting ? (
            <FiRefreshCw size={14} className="animate-spin" />
          ) : (
            <FiPlus size={14} />
          )}
          Add
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminApiKeysPage() {
  const [data, setData] = useState<ApiKeyStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModelDraft, setActiveModelDraft] = useState<string>("");
  const [updatingActiveModel, setUpdatingActiveModel] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const modelSelectionDirtyRef = useRef(false);

  const fetchStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiCall<ApiKeyStatusResponse>(
        "/api/v1/admin/system/api-keys/status"
      );
      setData(res);
      if (!modelSelectionDirtyRef.current) {
        setActiveModelDraft(res.active_chat_model);
      }
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load API key status";
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateActiveModel = useCallback(async () => {
    if (!activeModelDraft.trim()) {
      toast.error("Please choose a valid model.");
      return;
    }

    try {
      setUpdatingActiveModel(true);
      const response = await apiCall<ActiveModelStatusResponse>(
        "/api/v1/admin/system/api-keys/active-model",
        {
          method: "PUT",
          body: JSON.stringify({ model: activeModelDraft.trim() }),
        }
      );

      setData((prev) =>
        prev
          ? {
              ...prev,
              active_chat_model: response.active_chat_model,
              active_chat_provider: response.active_chat_provider,
              supported_chat_models: response.supported_chat_models,
            }
          : prev
      );
      modelSelectionDirtyRef.current = false;
      setActiveModelDraft(response.active_chat_model);
      toast.success(`Active AI set to ${formatChatModelLabel(response.active_chat_model)}.`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update active AI model";
      toast.error(msg);
    } finally {
      setUpdatingActiveModel(false);
    }
  }, [activeModelDraft]);

  // Initial fetch + 15-second auto-refresh
  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(() => fetchStatus(true), 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-white">
            <FiKey className="h-7 w-7 text-[#FFCA40]" /> API Key Monitor
          </h1>
          <p className="text-sm text-white/60">
            Real-time API key usage, health, and quota tracking.
            Auto-refreshes every 15 seconds.
          </p>
        </div>
        <button
          onClick={() => fetchStatus()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          <FiRefreshCw
            size={14}
            className={clsx(loading && "animate-spin")}
          />
          Refresh
        </button>
      </header>

      {/* Loading */}
      {loading && !data && (
        <div className="rounded-xl border border-white/10 bg-white/10 p-6 text-center text-sm text-white/60">
          Loading API key status&hellip;
        </div>
      )}

      {/* Error */}
      {error && !loading && !data && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Main content */}
      {data && (
        <>
          {/* Alerts */}
          <AlertBanner data={data} />

          <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
              <FiZap size={16} className="text-[#FFCA40]" /> Active AI Routing
            </div>
            <p className="mb-4 text-xs text-white/50">
              Sets the default AI used by chat when a request does not provide a preferred model.
              This is runtime-only and resets after backend restart.
            </p>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <select
                value={activeModelDraft}
                onChange={(event) => {
                  modelSelectionDirtyRef.current = true;
                  setActiveModelDraft(event.target.value);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20 md:max-w-md"
              >
                {data.supported_chat_models.map((modelOption) => (
                  <option key={modelOption} value={modelOption} className="bg-[#0d1d35]">
                    {formatChatModelLabel(modelOption)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={updateActiveModel}
                disabled={
                  updatingActiveModel ||
                  !activeModelDraft ||
                  activeModelDraft === data.active_chat_model
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFCA40] px-4 py-2 text-sm font-semibold text-[#000B1F] transition hover:bg-[#FFCA40]/90 disabled:opacity-40"
              >
                {updatingActiveModel ? (
                  <FiRefreshCw size={14} className="animate-spin" />
                ) : (
                  <FiCheck size={14} />
                )}
                Apply
              </button>
            </div>

            <p className="mt-3 text-xs text-white/50">
              Active provider: <span className="font-medium text-white/80">{data.active_chat_provider}</span>
              {" · "}
              Active model: <span className="font-medium text-white/80">{formatChatModelLabel(data.active_chat_model)}</span>
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SummaryCard
              icon={<FiKey size={16} />}
              label="Total Keys"
              value={data.summary.total_keys}
              sub={`${data.summary.active_keys} active`}
              accent
            />
            <SummaryCard
              icon={<FiActivity size={16} />}
              label="Open Breakers"
              value={data.circuit_breakers.summary.open_models}
              sub={`${data.circuit_breakers.summary.total_models} tracked`}
            />
            <SummaryCard
              icon={<FiTrendingUp size={16} />}
              label="Total Requests"
              value={data.summary.total_requests.toLocaleString()}
              sub={`${data.summary.requests_last_hour} in last hour`}
            />
            <SummaryCard
              icon={<FiXCircle size={16} />}
              label="Errors"
              value={data.summary.total_errors}
              sub={`${data.summary.error_rate}% error rate`}
              progress={data.summary.error_rate}
            />
            <SummaryCard
              icon={<FiActivity size={16} />}
              label="Uptime"
              value={formatUptime(data.summary.uptime_seconds)}
              sub={`${data.summary.total_rate_limited} rate limits total`}
            />
          </div>

          <CircuitBreakerPanel payload={data.circuit_breakers} />

          <ModelUsageChart snapshots={data.keys} />

          <ModelHistoryChart history={data.model_history} />

          {/* Fallback chain */}
          {data.fallback_chain.length > 0 && (
            <FallbackChainViz chain={data.fallback_chain} />
          )}

          {/* Per-key cards */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white/80">
              Key Health
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.keys.map((key) => (
                <KeyCard key={key.key_index} snapshot={key} />
              ))}
            </div>
          </div>

          {/* Add key form */}
          <AddKeyForm onKeyAdded={() => fetchStatus()} />
        </>
      )}
    </div>
  );
}
