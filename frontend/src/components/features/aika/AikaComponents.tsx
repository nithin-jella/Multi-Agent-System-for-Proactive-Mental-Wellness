/**
 * Aika UI Components
 * 
 * Reusable components for displaying Aika Meta-Agent activity,
 * risk assessments, and escalation notifications.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, AlertTriangle, CheckCircle, Activity, Cpu } from 'lucide-react';
import type { AikaRiskAssessment, AikaMetadata } from '@/hooks/useAika';

/**
 * Agent Activity Badge
 * Shows which agents Aika consulted for this response
 */
interface AgentActivityBadgeProps {
  agents: string[];
  processingTime?: number;
}

export function AgentActivityBadge({ agents, processingTime }: AgentActivityBadgeProps) {
  if (agents.length === 0) return null;

  const agentNames: Record<string, string> = {
    STA: 'Safety',
    TCA: 'Support',
    CMA: 'Service',
    IA: 'Insights',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-xs text-white/70 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10"
    >
      <Activity className="h-3.5 w-3.5 text-purple-400" />
      <span>
        Consulted: {agents.map(a => agentNames[a] || a).join(', ')}
      </span>
      {processingTime && (
        <span className="text-white/50">• {processingTime}ms</span>
      )}
    </motion.div>
  );
}

/**
 * Risk Level Indicator
 * Visual indicator for safety risk assessment
 */
interface RiskLevelIndicatorProps {
  assessment: AikaRiskAssessment;
  showFactors?: boolean;
}

export function RiskLevelIndicator({ assessment, showFactors = false }: RiskLevelIndicatorProps) {
  const { risk_level, risk_score, confidence, risk_factors } = assessment;

  const riskConfig = {
    critical: {
      label: 'Critical Risk',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: AlertTriangle,
      pulseClass: 'animate-pulse',
    },
    high: {
      label: 'High Risk',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      icon: AlertTriangle,
      pulseClass: '',
    },
    moderate: {
      label: 'Moderate Risk',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: AlertTriangle,
      pulseClass: '',
    },
    low: {
      label: 'Low Risk',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: CheckCircle,
      pulseClass: '',
    },
  };

  const config = riskConfig[risk_level] || riskConfig.low;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-lg border ${config.border} ${config.bg} p-3 space-y-2`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color} ${config.pulseClass}`} />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-white/50">
          (Confidence: {Math.round(confidence * 100)}%)
        </span>
      </div>

      {showFactors && risk_factors.length > 0 && (
        <div className="text-xs text-white/70 space-y-1">
          <div className="font-medium">Risk Factors:</div>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            {risk_factors.map((factor, idx) => (
              <li key={idx}>{factor}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Escalation Notification
 * Shows when a case has been escalated to counselors
 */
interface EscalationNotificationProps {
  caseId: string;
  onDismiss?: () => void;
}

export function EscalationNotification({ caseId, onDismiss }: EscalationNotificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 space-y-2"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <CheckCircle className="h-5 w-5 text-teal-500" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-medium text-teal-400">
            Kasus Telah Disampaikan
          </h4>
          <p className="text-xs text-white/70">
            Tim konselor profesional kami telah dihubungi dan akan segera menghubungi Anda.
            Keselamatan Anda adalah prioritas kami.
          </p>
          <div className="text-xs text-white/50">
            Case ID: {caseId.slice(0, 8)}...
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-white/50 hover:text-white/80 transition-colors"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Aika Avatar
 * Branded avatar for Aika messages
 */
export function AikaAvatar() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="relative shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg"
    >
      <Brain className="h-4 w-4 text-white" />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.2, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 rounded-full bg-purple-400/30"
      />
    </motion.div>
  );
}

/**
 * Aika Powered Badge
 * Shows "Powered by Aika" branding
 */
export function AikaPoweredBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/60">
      <Brain className="h-3.5 w-3.5 text-purple-400" />
      <span>Powered by Aika 💙</span>
    </div>
  );
}

/**
 * Metadata Display
 * Shows detailed metadata from Aika response (for debugging/admin)
 * Enhanced with cleaner, more organized presentation
 */
interface MetadataDisplayProps {
  metadata: AikaMetadata;
}

export function MetadataDisplay({ metadata }: MetadataDisplayProps) {
  const hasMonitoring =
    typeof metadata.llm_request_count === 'number' ||
    (metadata.llm_requests_by_model && Object.keys(metadata.llm_requests_by_model).length > 0) ||
    (metadata.tools_used && metadata.tools_used.length > 0) ||
    typeof metadata.llm_prompt_id === 'string';

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs bg-linear-to-br from-purple-500/10 to-indigo-500/10 rounded-xl border border-purple-500/20 p-4 mt-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
        <Cpu className="h-4 w-4 text-purple-400" />
        <span className="font-semibold text-white/80">Technical Details</span>
        <span className="ml-auto text-[10px] text-white/40 font-mono">
          {metadata.processing_time_ms}ms
        </span>
      </div>
      
      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="text-white/40">Session</div>
        <div className="text-white/70 font-mono text-[10px] truncate" title={metadata.session_id}>
          {metadata.session_id.slice(0, 20)}...
        </div>
        
        <div className="text-white/40">User Role</div>
        <div className="text-white/70 capitalize">{metadata.user_role}</div>
        
        <div className="text-white/40">Intent</div>
        <div className="text-white/70">{metadata.intent}</div>
        
        <div className="text-white/40">Agents</div>
        <div className="flex flex-wrap gap-1">
          {metadata.agents_invoked.length > 0 ? (
            metadata.agents_invoked.map((agent) => (
              <span key={agent} className="px-1.5 py-0.5 rounded bg-ugm-gold/20 text-ugm-gold text-[10px] font-medium">
                {agent}
              </span>
            ))
          ) : (
            <span className="text-white/40">None</span>
          )}
        </div>
        
        <div className="text-white/40">Actions</div>
        <div className="flex flex-wrap gap-1">
          {metadata.actions_taken.length > 0 ? (
            metadata.actions_taken.map((action, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px]">
                {action}
              </span>
            ))
          ) : (
            <span className="text-white/40">None</span>
          )}
        </div>

        {hasMonitoring && (
          <>
            <div className="col-span-2 mt-1 pt-2 border-t border-white/10" />

            <div className="text-white/40">LLM Requests</div>
            <div className="text-white/70">
              {typeof metadata.llm_request_count === 'number' ? metadata.llm_request_count : '—'}
            </div>

            <div className="text-white/40">Requests by Model</div>
            <div className="text-white/70">
              {metadata.llm_requests_by_model && Object.keys(metadata.llm_requests_by_model).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(metadata.llm_requests_by_model).map(([model, count]) => (
                    <span
                      key={model}
                      className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 text-[10px] font-mono"
                      title={model}
                    >
                      {model}: {count}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </div>

            <div className="text-white/40">Tools Used</div>
            <div className="text-white/70">
              {metadata.tools_used && metadata.tools_used.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {metadata.tools_used.map((tool) => (
                    <span key={tool} className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
                      {tool}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </div>

            <div className="text-white/40">Prompt ID</div>
            <div className="text-white/70 font-mono text-[10px] truncate" title={metadata.llm_prompt_id}>
              {metadata.llm_prompt_id ? `${metadata.llm_prompt_id.slice(0, 20)}...` : '—'}
            </div>
          </>
        )}
      </div>
      
      {/* Escalation info if triggered */}
      {metadata.escalation_triggered && (
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-red-400 font-medium">Escalated</span>
          <span className="text-white/50 font-mono text-[10px]">Case: {metadata.case_id}</span>
        </div>
      )}
    </motion.div>
  );
}
