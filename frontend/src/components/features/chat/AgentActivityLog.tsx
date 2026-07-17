'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, Activity, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface AgentActivityLogProps {
  agentActivity: {
    execution_path: string[];
    agents_invoked: string[];
    intent: string;
    intent_confidence: number;
    needs_agents: boolean;
    agent_reasoning: string;
    response_source: string;
    processing_time_ms: number;
    risk_level?: string;
    risk_score?: number;
  };
}

const AGENT_LABELS: Record<string, string> = {
  STA: '🧠 Suicide & Threat Assessment',
  TCA: '🤝 Support & Care Agent',
  CMA: '🚨 Scheduling & Documentation Agent',
};

const INTENT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  emotional_support: {
    label: 'Dukungan Emosional',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-emerald-500',
  },
  crisis_detection: {
    label: 'Deteksi Krisis',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-red-500',
  },
  information_query: {
    label: 'Pertanyaan Informasi',
    icon: <Brain className="h-4 w-4" />,
    color: 'text-blue-500',
  },
  casual_conversation: {
    label: 'Obrolan Santai',
    icon: <Activity className="h-4 w-4" />,
    color: 'text-gray-400',
  },
  unknown: {
    label: 'Tidak Diketahui',
    icon: <Brain className="h-4 w-4" />,
    color: 'text-gray-500',
  },
};

const RISK_LEVEL_COLORS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-300',
  high: 'text-orange-600 bg-orange-50 border-orange-300',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-300',
  low: 'text-green-600 bg-green-50 border-green-300',
  minimal: 'text-gray-600 bg-gray-50 border-gray-300',
  unknown: 'text-gray-500 bg-gray-50 border-gray-300',
};

export function AgentActivityLog({ agentActivity }: AgentActivityLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const intentInfo = INTENT_LABELS[agentActivity.intent] || INTENT_LABELS.unknown;
  const confidencePercent = Math.round(agentActivity.intent_confidence * 100);
  const processingSeconds = (agentActivity.processing_time_ms / 1000).toFixed(2);
  
  // Calculate width class for risk score bar
  const getRiskWidthClass = (score: number): string => {
    const percent = Math.round(score * 10) * 10; // Round to nearest 10
    return `w-[${percent}%]`;
  };

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-800/50 to-slate-900/50 shadow-lg backdrop-blur-sm">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
        aria-expanded={isExpanded ? 'true' : 'false'}
        aria-label={isExpanded ? 'Sembunyikan log aktivitas agen' : 'Tampilkan log aktivitas agen'}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-ugm-gold/10 p-2">
            <Activity className="h-5 w-5 text-ugm-gold" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white">Log Aktivitas Agen</span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {processingSeconds}s
              </span>
              {agentActivity.agents_invoked.length > 0 && (
                <span className="rounded-full bg-ugm-gold/20 px-2 py-0.5 text-ugm-gold">
                  {agentActivity.agents_invoked.length} agen aktif
                </span>
              )}
              {agentActivity.risk_level && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    RISK_LEVEL_COLORS[agentActivity.risk_level] || RISK_LEVEL_COLORS.unknown
                  }`}
                >
                  Risk: {agentActivity.risk_level.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-white/60" />
          ) : (
            <ChevronDown className="h-5 w-5 text-white/60" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          {/* Decision Info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Keputusan Aika
            </h4>
            <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3">
              <div className={`mt-0.5 ${intentInfo.color}`}>{intentInfo.icon}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{intentInfo.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                    {confidencePercent}% yakin
                  </span>
                </div>
                {agentActivity.agent_reasoning && (
                  <p className="text-xs text-white/70">{agentActivity.agent_reasoning}</p>
                )}
              </div>
            </div>
          </div>

          {/* Agents Invoked */}
          {agentActivity.agents_invoked.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Agen yang Dipanggil
              </h4>
              <div className="flex flex-wrap gap-2">
                {agentActivity.agents_invoked.map((agent, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-ugm-gold/30 bg-ugm-gold/10 px-3 py-2"
                  >
                    <Zap className="h-4 w-4 text-ugm-gold" />
                    <span className="text-sm font-medium text-ugm-gold">
                      {AGENT_LABELS[agent] || agent}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Assessment */}
          {agentActivity.risk_level && agentActivity.risk_score !== undefined && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Penilaian Risiko (STA)
              </h4>
              <div className="space-y-2 rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Tingkat Risiko:</span>
                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                      RISK_LEVEL_COLORS[agentActivity.risk_level] || RISK_LEVEL_COLORS.unknown
                    }`}
                  >
                    {agentActivity.risk_level.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Skor Risiko:</span>
                  <span className="text-sm font-medium text-white">
                    {(agentActivity.risk_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full transition-all ${getRiskWidthClass(agentActivity.risk_score)} ${
                      agentActivity.risk_level === 'critical' || agentActivity.risk_level === 'high'
                        ? 'bg-red-500'
                        : agentActivity.risk_level === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    role="progressbar"
                    aria-label={`Risk score: ${(agentActivity.risk_score * 100).toFixed(1)}%`}
                  >
                    <span className="sr-only">{(agentActivity.risk_score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Execution Path */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Jalur Eksekusi
            </h4>
            <div className="flex flex-wrap gap-1">
              {agentActivity.execution_path.map((node, idx) => (
                <React.Fragment key={idx}>
                  <span className="rounded bg-white/10 px-2 py-1 text-xs font-mono text-white/80">
                    {node}
                  </span>
                  {idx < agentActivity.execution_path.length - 1 && (
                    <span className="flex items-center text-white/40">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Response Source */}
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-xs text-white/70">Sumber Respons:</span>
            <span className="rounded-full bg-ugm-gold/20 px-3 py-1 text-xs font-medium text-ugm-gold">
              {agentActivity.response_source === 'aika_direct' ? '🤖 Aika Direct' : '🔗 Sintesis Agen'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
