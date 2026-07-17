"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  FiArrowLeft as ArrowLeft,
  FiMessageCircle as ChatIcon,
  FiClock as Clock,
  FiDownload as Download,
  FiFileText as FileText,
  FiSearch as Search,
  FiAlertTriangle as FlagIcon,
} from "@/icons";
import { apiCall, authenticatedFetch } from "@/utils/adminApi";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { SessionFlagDrawer } from "./components/SessionFlagDrawer";
import { SessionRiskAssessmentSection } from "./components/SessionRiskAssessmentSection";
import { SessionStatCard } from "./components/SessionStatCard";
import type {
  ConversationDetail,
  FlagResponse,
  RiskAssessment,
  RiskAssessmentListResponse,
  SessionDetailResponse,
} from "./components/sessionTypes";

// ============================================================================
// Helpers
// ============================================================================

function humanDuration(mins: number) {
  if (!mins || mins < 1) return "< 1 min";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params?.sessionId) ? params.sessionId[0] : (params?.sessionId as string);

  // Session data
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Flags
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagTags, setFlagTags] = useState("");
  const [flagNotes, setFlagNotes] = useState("");
  const [flagStatus, setFlagStatus] = useState<string>("open");
  const [sessionFlags, setSessionFlags] = useState<FlagResponse[]>([]);
  const activeFlag = useMemo(() => sessionFlags[0] || null, [sessionFlags]);
  const [editingFlagId, setEditingFlagId] = useState<number | null>(null);

  // STA Risk Assessment
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [triggeringAssessment, setTriggeringAssessment] = useState(false);

  // Load session data
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall<SessionDetailResponse>(`/api/v1/admin/conversation-session/${sessionId}`);
      setData(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load session";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Load flags
  const loadFlags = useCallback(async () => {
    try {
      const allFlags = await apiCall<FlagResponse[]>(`/api/v1/admin/flags`);
      const filtered = allFlags
        .filter((f) => f.session_id === sessionId)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "open" ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      setSessionFlags(filtered);
      if (filtered[0]) {
        setFlagReason(filtered[0].reason || "");
        setFlagNotes(filtered[0].notes || "");
        setFlagStatus(filtered[0].status || "open");
        setFlagTags((filtered[0].tags || []).join(", "));
      }
    } catch (error) {
      console.warn("Failed to load flags", error);
    }
  }, [sessionId]);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  // Load STA assessment for each conversation
  const loadAssessment = useCallback(async () => {
    if (!data || data.conversations.length === 0) return;
    setAssessmentLoading(true);
    try {
      // Try session-based assessment first
      const assessmentResponse = await apiCall<RiskAssessmentListResponse>(
        `/api/v1/admin/conversation-assessments?session_id=${sessionId}`
      );
      const assessments = assessmentResponse.assessments || [];
      if (assessments && assessments.length > 0) {
        // Pick the most recent
        const sorted = [...assessments].sort((a, b) =>
          new Date(b.analysis_timestamp).getTime() - new Date(a.analysis_timestamp).getTime()
        );
        setAssessment(sorted[0]);
      } else {
        // Try with the first conversation_id
        try {
          const convAssessment = await apiCall<RiskAssessment>(
            `/api/v1/admin/conversation-assessments/${data.conversations[0].conversation_id}`
          );
          setAssessment(convAssessment);
        } catch {
          // No assessment found — that's OK
          setAssessment(null);
        }
      }
    } catch {
      setAssessment(null);
    } finally {
      setAssessmentLoading(false);
    }
  }, [data, sessionId]);

  useEffect(() => { loadAssessment(); }, [loadAssessment]);

  // Trigger STA assessment
  const triggerAssessment = async () => {
    if (!data || data.conversations.length === 0) return;
    setTriggeringAssessment(true);
    try {
      const convId = data.conversations[data.conversations.length - 1].conversation_id;
      await apiCall(`/api/v1/admin/conversation-assessments/${convId}/trigger`, {
        method: 'POST',
      });
      toast.success('STA analysis triggered. Refreshing...');
      // Wait for processing then reload
      setTimeout(async () => {
        await loadAssessment();
        setTriggeringAssessment(false);
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger analysis';
      toast.error(msg);
      setTriggeringAssessment(false);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!data) return [] as ConversationDetail[];
    if (!filter.trim()) return data.conversations;
    const q = filter.toLowerCase();
    return data.conversations.filter(c =>
      (c.message && c.message.toLowerCase().includes(q)) ||
      (c.response && c.response.toLowerCase().includes(q))
    );
  }, [data, filter]);

  const doExport = async (kind: "txt" | "csv") => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "";
      const path = kind === "csv" ? `export.csv` : `export`;
      const url = `${base}/api/v1/admin/conversation-session/${sessionId}/${path}`;
      const resp = await authenticatedFetch(url, { method: "GET" });
      if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `session_${sessionId}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Export downloaded');
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      toast.error(message);
    }
  };

  const submitFlag = async () => {
    try {
      const tags = flagTags.split(",").map((t) => t.trim()).filter(Boolean);
      if (editingFlagId || activeFlag) {
        const id = editingFlagId || (activeFlag as FlagResponse).id;
        await apiCall(`/api/v1/admin/flags/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            status: flagStatus,
            reason: flagReason,
            tags,
            notes: flagNotes || undefined,
          }),
        });
      } else {
        await apiCall(`/api/v1/admin/conversations/session/${sessionId}/flag`, {
          method: "POST",
          body: JSON.stringify({
            reason: flagReason || undefined,
            tags: tags.length ? tags : undefined,
          }),
        });
      }
      setFlagOpen(false);
      setEditingFlagId(null);
      setFlagReason("");
      setFlagTags("");
      setFlagNotes("");
      toast.success(activeFlag ? 'Flag updated' : 'Session flagged');
      await loadFlags();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to flag session";
      toast.error(message);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ChatIcon className="h-6 w-6 text-[#FFCA40]" />
          <h1 className="text-xl font-semibold text-white">Loading session...</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md text-center">
          <span className="text-red-400 text-sm">{error || "Failed to load session"}</span>
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push("/admin/conversations")}>Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const shortId = data.session_id.slice(-8);
  const firstAgo = formatDistanceToNow(new Date(data.first_message_time), { addSuffix: true });
  const lastAgo = formatDistanceToNow(new Date(data.last_message_time), { addSuffix: true });

  return (
    <div className="space-y-5 max-w-400">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/conversations")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <ChatIcon className="h-6 w-6 text-[#FFCA40]" />
            <h1 className="text-xl font-bold text-white truncate">Session ...{shortId}</h1>
            <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-white/50 font-mono truncate max-w-50">
              {data.user_id_hash}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setEditingFlagId(null); setFlagStatus("open"); setFlagReason(""); setFlagTags(""); setFlagNotes(""); setFlagOpen(true); }}>
              <FlagIcon className="h-4 w-4 mr-1" /> Flag
            </Button>
            <Button variant="outline" size="sm" onClick={() => doExport("txt")}>
              <FileText className="h-4 w-4 mr-1" /> TXT
            </Button>
            <Button variant="outline" size="sm" onClick={() => doExport("csv")}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>
        {data.user?.email && (
          <div className="text-xs text-white/50 mt-2 ml-30 flex items-center gap-2">
            <span>User: <span className="font-mono">{data.user.email}</span></span>
            {data.user.role && <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px]">{data.user.role}</span>}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SessionStatCard label="Message Pairs" value={data.conversation_count} icon={ChatIcon} />
        <SessionStatCard label="Duration" value={humanDuration(data.total_duration_minutes)} icon={Clock} />
        <SessionStatCard label="First Message" value={firstAgo} icon={Clock} />
        <SessionStatCard label="Last Message" value={lastAgo} icon={Clock} />
      </div>

      {/* Active Flag Banner */}
      {activeFlag && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <FlagIcon className="h-4 w-4 text-yellow-300" />
              <span className="font-medium text-yellow-200">Flagged</span>
              <span className="px-2 py-0.5 rounded text-[11px] border border-yellow-400/20 bg-yellow-400/10 text-yellow-300">
                {activeFlag.status}
              </span>
              <span className="text-xs text-yellow-200/60">
                {formatDistanceToNow(new Date(activeFlag.updated_at), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(activeFlag.tags || []).slice(0, 3).map((t, i) => (
                <span key={`${t}-${i}`} className="px-1.5 py-0.5 rounded text-[10px] border border-yellow-400/15 bg-yellow-400/10 text-yellow-200">{t}</span>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                setEditingFlagId(activeFlag.id); setFlagStatus(activeFlag.status); setFlagReason(activeFlag.reason || ""); setFlagTags((activeFlag.tags || []).join(", ")); setFlagNotes(activeFlag.notes || ""); setFlagOpen(true);
              }}>
                Manage
              </Button>
            </div>
          </div>
          {activeFlag.reason && <p className="text-sm text-yellow-100/80 mt-2">{activeFlag.reason}</p>}
        </div>
      )}

      <SessionRiskAssessmentSection
        assessment={assessment}
        assessmentLoading={assessmentLoading}
        triggeringAssessment={triggeringAssessment}
        onTriggerAssessment={triggerAssessment}
      />

      {/* Conversation Insights + Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-3">Conversation Insights</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SessionStatCard label="Avg User Len" value={data.analysis.avg_user_message_length.toFixed(1)} />
            <SessionStatCard label="Avg AI Len" value={data.analysis.avg_ai_message_length.toFixed(1)} />
            <SessionStatCard label="User Chars" value={data.analysis.total_user_chars.toLocaleString()} />
            <SessionStatCard label="AI Chars" value={data.analysis.total_ai_chars.toLocaleString()} />
          </div>
          {data.analysis.top_keywords && data.analysis.top_keywords.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-white/50 mb-2">Top Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {data.analysis.top_keywords.map(([word, count], i) => (
                  <span key={`${word}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/60">
                    <span className="font-medium">{word}</span>
                    <span className="text-white/30">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Search</h2>
            <div className="relative">
              <Search className="h-4 w-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
              />
            </div>
            <p className="mt-2 text-[11px] text-white/40">
              {filteredConversations.length} of {data.conversations.length} turns
            </p>
          </div>

          {/* Flags History */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Flags ({sessionFlags.length})</h2>
              <Button variant="outline" size="sm" onClick={() => { setEditingFlagId(null); setFlagStatus("open"); setFlagReason(""); setFlagTags(""); setFlagNotes(""); setFlagOpen(true); }}>
                New
              </Button>
            </div>
            {sessionFlags.length === 0 ? (
              <p className="text-xs text-white/30">No flags for this session</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto">
                {sessionFlags.map((f) => (
                  <div key={f.id} className="p-2.5 rounded-lg border border-white/10 bg-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded border ${
                          f.status === 'open' ? 'bg-yellow-500/10 text-yellow-200 border-yellow-400/20' :
                          f.status === 'resolved' ? 'bg-green-500/10 text-green-200 border-green-400/20' :
                          'bg-white/5 text-white/40 border-white/10'
                        }`}>{f.status}</span>
                        <span className="text-white/30">{formatDistanceToNow(new Date(f.updated_at), { addSuffix: true })}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingFlagId(f.id); setFlagStatus(f.status); setFlagReason(f.reason || ''); setFlagTags((f.tags || []).join(', ')); setFlagNotes(f.notes || ''); setFlagOpen(true);
                      }}>Edit</Button>
                    </div>
                    {f.reason && <p className="mt-1.5 text-xs text-white/60">{f.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Timeline */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Chat Timeline</h2>
          <span className="text-[11px] text-white/30">Newest at bottom</span>
        </div>
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-white/40 py-8">No messages match your filter.</div>
          ) : (
            <div className="space-y-5">
              {filteredConversations.map((c) => (
                <div key={c.id} className="space-y-3">
                  {c.message && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] lg:max-w-3xl">
                        <div className="flex items-center justify-end gap-2 text-[10px] text-white/30 mb-1">
                          <span>User</span>
                          <span>{new Date(c.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="px-4 py-3 rounded-xl bg-blue-600/80 text-white rounded-br-none">
                          <p className="whitespace-pre-wrap wrap-break-word text-sm">{c.message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {c.response && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] lg:max-w-3xl">
                        <div className="flex items-center gap-2 text-[10px] text-white/30 mb-1">
                          <span>AI</span>
                          <span>{new Date(c.timestamp).toLocaleString()}</span>
                          {typeof c.sentiment_score === "number" && (
                            <span className={`px-1 py-0.5 rounded text-[10px] border ${
                              c.sentiment_score >= 0.2
                                ? "text-green-300 bg-green-600/15 border-green-400/20"
                                : c.sentiment_score <= -0.2
                                ? "text-red-300 bg-red-600/15 border-red-400/20"
                                : "text-white/40 bg-white/5 border-white/10"
                            }`}>
                              {c.sentiment_score >= 0.2 ? "positive" : c.sentiment_score <= -0.2 ? "negative" : "neutral"}
                            </span>
                          )}
                        </div>
                        <div className="px-4 py-3 rounded-xl bg-white/10 text-white/90 rounded-bl-none border border-white/10">
                          <p className="whitespace-pre-wrap wrap-break-word text-sm">{c.response}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SessionFlagDrawer
        isOpen={flagOpen}
        shortId={shortId}
        editingFlagId={editingFlagId}
        activeFlagId={activeFlag?.id ?? null}
        flagStatus={flagStatus}
        flagReason={flagReason}
        flagTags={flagTags}
        flagNotes={flagNotes}
        onClose={() => setFlagOpen(false)}
        onSubmit={submitFlag}
        onFlagStatusChange={setFlagStatus}
        onFlagReasonChange={setFlagReason}
        onFlagTagsChange={setFlagTags}
        onFlagNotesChange={setFlagNotes}
      />
    </div>
  );
}
