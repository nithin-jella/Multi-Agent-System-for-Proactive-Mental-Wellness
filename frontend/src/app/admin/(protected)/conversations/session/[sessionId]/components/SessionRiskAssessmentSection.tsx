import React from "react";

import type { RiskAssessment, ScreeningDimensionScore, ScreeningExtraction } from "./sessionTypes";

interface SessionRiskAssessmentSectionProps {
  assessment: RiskAssessment | null;
  assessmentLoading: boolean;
  triggeringAssessment: boolean;
  onTriggerAssessment: () => void;
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-300", dot: "bg-red-500" },
  high: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-300", dot: "bg-orange-500" },
  moderate: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-300", dot: "bg-yellow-500" },
  low: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-300", dot: "bg-green-500" },
};

const TREND_LABELS: Record<string, { label: string; color: string }> = {
  escalating: { label: "Escalating", color: "text-red-400" },
  "de-escalating": { label: "De-escalating", color: "text-green-400" },
  stable: { label: "Stable", color: "text-blue-300" },
  insufficient_data: { label: "Insufficient Data", color: "text-white/40" },
};

const DISCORDANCE_STYLES: Record<string, { badge: string; text: string }> = {
  high: {
    badge: "bg-red-500/15 border-red-500/30 text-red-300",
    text: "text-red-300",
  },
  medium: {
    badge: "bg-orange-500/15 border-orange-500/30 text-orange-300",
    text: "text-orange-300",
  },
  low: {
    badge: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    text: "text-yellow-300",
  },
  none: {
    badge: "bg-green-500/15 border-green-500/30 text-green-300",
    text: "text-green-300",
  },
};

const DIMENSION_LABELS: Record<string, { label: string; instrument: string }> = {
  depression: { label: "Depression", instrument: "PHQ-9" },
  anxiety: { label: "Anxiety", instrument: "GAD-7" },
  stress: { label: "Stress", instrument: "DASS-21" },
  sleep: { label: "Sleep", instrument: "PSQI" },
  social: { label: "Social", instrument: "UCLA Loneliness" },
  academic: { label: "Academic", instrument: "Academic Pressure" },
  self_worth: { label: "Self-Worth", instrument: "Rosenberg SE" },
  substance: { label: "Substance", instrument: "AUDIT/DAST" },
  crisis: { label: "Crisis", instrument: "Self-Harm/SI" },
};

function DimensionBar({ dimension, data }: { dimension: string; data: ScreeningDimensionScore }) {
  const meta = DIMENSION_LABELS[dimension] || { label: dimension, instrument: "" };
  const pct = Math.round(data.score * 100);
  const barColor = data.is_protective
    ? "bg-green-500"
    : pct >= 70
      ? "bg-red-500"
      : pct >= 40
        ? "bg-orange-500"
        : pct >= 20
          ? "bg-yellow-500"
          : "bg-blue-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/80 font-medium">{meta.label}</span>
          <span className="text-[10px] text-white/30">{meta.instrument}</span>
          {data.is_protective && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-500/15 border border-green-500/20 text-green-300 rounded">
              Protective
            </span>
          )}
          {dimension === "crisis" && pct >= 50 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/15 border border-red-500/20 text-red-300 rounded animate-pulse">
              ALERT
            </span>
          )}
        </div>
        <span className={`text-sm font-bold ${pct >= 70 ? "text-red-400" : pct >= 40 ? "text-orange-400" : "text-white/60"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      {data.evidence.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {data.evidence.slice(0, 2).map((e, i) => (
            <span key={i} className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full italic">
              &quot;{e.length > 60 ? `${e.slice(0, 60)}...` : e}&quot;
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionRiskAssessmentSection({
  assessment,
  assessmentLoading,
  triggeringAssessment,
  onTriggerAssessment,
}: SessionRiskAssessmentSectionProps) {
  const riskColors = assessment ? RISK_COLORS[assessment.overall_risk_level] || RISK_COLORS.low : null;
  const trendInfo = assessment ? TREND_LABELS[assessment.risk_trend] || TREND_LABELS.insufficient_data : null;
  const screening = assessment?.raw_assessment?.screening;
  const discordanceLevel = assessment?.discordance_level || "none";
  const discordanceStyle = DISCORDANCE_STYLES[discordanceLevel] || DISCORDANCE_STYLES.none;

  const formatPad = (value: number | null | undefined): string => {
    if (typeof value !== "number") {
      return "N/A";
    }
    return value.toFixed(2);
  };

  const hasStaPad =
    typeof assessment?.pleasure === "number" ||
    typeof assessment?.arousal === "number" ||
    typeof assessment?.dominance === "number";
  const hasJournalPad =
    typeof assessment?.journal_valence === "number" ||
    typeof assessment?.journal_arousal === "number" ||
    typeof assessment?.journal_inferred_dominance === "number";

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            STA Risk Assessment
          </h2>
          <p className="text-xs text-white/40 mt-0.5 ml-7">Safety Triage Agent analysis with psychologist-relevant insights</p>
        </div>
        <button
          onClick={onTriggerAssessment}
          disabled={triggeringAssessment || assessmentLoading}
          className="px-3 py-1.5 text-[11px] font-medium bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {triggeringAssessment ? (
            <>
              <div className="w-3 h-3 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            "Run STA Analysis"
          )}
        </button>
      </div>

      <div className="p-6">
        {assessmentLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !assessment ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-sm text-white/50">No STA assessment available</p>
            <p className="text-xs text-white/30 mt-1">Click &quot;Run STA Analysis&quot; to generate a risk assessment</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${riskColors?.bg} border ${riskColors?.border} rounded-xl p-4`}>
                <p className="text-[11px] text-white/50 uppercase tracking-wider mb-2">Overall Risk</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${riskColors?.dot}`} />
                  <span className={`text-xl font-bold ${riskColors?.text}`}>
                    {assessment.overall_risk_level.toUpperCase()}
                  </span>
                </div>
                {assessment.should_invoke_cma && (
                  <span className="mt-2 inline-block px-2 py-0.5 text-[10px] font-medium bg-red-500/15 border border-red-500/20 text-red-300 rounded">
                    CMA Recommended
                  </span>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-[11px] text-white/50 uppercase tracking-wider mb-2">Risk Trend</p>
                <span className={`text-lg font-semibold ${trendInfo?.color}`}>
                  {trendInfo?.label}
                </span>
                <p className="text-[11px] text-white/30 mt-1">{assessment.message_count} messages analyzed</p>
              </div>

              <div className={`rounded-xl p-4 border ${
                assessment.raw_assessment?.crisis_detected
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-white/5 border-white/10"
              }`}>
                <p className="text-[11px] text-white/50 uppercase tracking-wider mb-2">Crisis Status</p>
                {assessment.raw_assessment?.crisis_detected ? (
                  <span className="text-lg font-bold text-red-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    Crisis Detected
                  </span>
                ) : (
                  <span className="text-lg font-semibold text-green-300">No Crisis</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-[11px] text-white/50 uppercase tracking-wider mb-3">STA PAD Snapshot</p>
                {hasStaPad ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-white/40 uppercase">Valence</p>
                      <p className="text-lg font-semibold text-white">{formatPad(assessment.pleasure)}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-white/40 uppercase">Arousal</p>
                      <p className="text-lg font-semibold text-white">{formatPad(assessment.arousal)}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-white/40 uppercase">Dominance</p>
                      <p className="text-lg font-semibold text-white">{formatPad(assessment.dominance)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">No PAD signals available for this analysis.</p>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[11px] text-white/50 uppercase tracking-wider">Self-Report Alignment</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] border uppercase ${discordanceStyle.badge}`}>
                    {discordanceLevel}
                  </span>
                </div>
                {hasJournalPad ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                        <p className="text-[10px] text-white/40 uppercase">Journal Valence</p>
                        <p className="text-sm font-semibold text-white">{formatPad(assessment.journal_valence)}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                        <p className="text-[10px] text-white/40 uppercase">Journal Arousal</p>
                        <p className="text-sm font-semibold text-white">{formatPad(assessment.journal_arousal)}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                        <p className="text-[10px] text-white/40 uppercase">Journal Dominance</p>
                        <p className="text-sm font-semibold text-white">{formatPad(assessment.journal_inferred_dominance)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-white/70">
                      Discordance Score:{" "}
                      <span className={discordanceStyle.text}>
                        {typeof assessment.discordance_score === "number" ? assessment.discordance_score.toFixed(3) : "N/A"}
                      </span>
                    </p>
                    {assessment.discordance_reason && <p className="text-xs text-white/50">{assessment.discordance_reason}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-white/40">No journal PAD data found for cross-check.</p>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-[11px] text-white/50 uppercase tracking-wider mb-2">Conversation Summary</p>
              <p className="text-sm text-white/80 leading-relaxed">{assessment.conversation_summary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
                <p className="text-[11px] text-red-300/80 uppercase tracking-wider mb-3 font-medium">Concerns</p>
                {assessment.concerns && assessment.concerns.length > 0 ? (
                  <ul className="space-y-2">
                    {assessment.concerns.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-white/30">No concerns identified</p>
                )}
              </div>

              <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                <p className="text-[11px] text-green-300/80 uppercase tracking-wider mb-3 font-medium">Protective Factors</p>
                {assessment.protective_factors && assessment.protective_factors.length > 0 ? (
                  <ul className="space-y-2">
                    {assessment.protective_factors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-white/30">No protective factors identified</p>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                <p className="text-[11px] text-blue-300/80 uppercase tracking-wider mb-3 font-medium">Recommended Actions</p>
                {assessment.recommended_actions && assessment.recommended_actions.length > 0 ? (
                  <ul className="space-y-2">
                    {assessment.recommended_actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <span className="text-blue-400 text-xs mt-0.5 shrink-0">{i + 1}.</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-white/30">No actions recommended</p>
                )}
              </div>
            </div>

            {screening && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-[11px] text-white/50 uppercase tracking-wider mb-4 font-medium">Mental Health Screening Dimensions</p>
                <div className="space-y-4">
                  {Object.entries(DIMENSION_LABELS).map(([key]) => {
                    const dimData = screening[key as keyof ScreeningExtraction] as ScreeningDimensionScore | undefined | null;
                    if (!dimData || typeof dimData !== "object" || !("score" in dimData)) {
                      return null;
                    }
                    return <DimensionBar key={key} dimension={key} data={dimData} />;
                  })}
                </div>
              </div>
            )}

            {assessment.user_context && Object.keys(assessment.user_context).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-[11px] text-white/50 uppercase tracking-wider mb-3 font-medium">User Context</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(assessment.user_context).map(([key, values]) => {
                    if (!values || values.length === 0) return null;
                    return (
                      <div key={key}>
                        <p className="text-xs text-white/60 font-medium mb-2 capitalize">{key.replace(/_/g, " ")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {values.map((value, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[11px] text-white/60">
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <details className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <summary className="px-4 py-3 text-[11px] text-white/50 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors font-medium">
                STA Reasoning (chain-of-thought)
              </summary>
              <div className="px-4 py-3 border-t border-white/5">
                <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{assessment.reasoning}</p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
