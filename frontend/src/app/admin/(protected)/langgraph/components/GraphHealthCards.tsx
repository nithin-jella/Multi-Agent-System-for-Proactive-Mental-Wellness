/**
 * GraphHealthCards Component
 * 
 * Displays health status cards for all 6 LangGraph agents:
 * - STA (Safety Triage Agent)
 * - TCA (Therapeutic Coach Agent)
 * - CMA (Case Management Agent)
 * - IA (Insights Agent)
 * - AIKA (Meta-Agent)
 * - Orchestrator (Legacy)
 * 
 * Each card shows:
 * - Status indicator (healthy/degraded/down)
 * - Success rate
 * - Average execution time
 * - Total executions (24h)
 */

'use client';

import { GraphHealthStatus } from '../hooks/useLangGraphHealth';

interface GraphHealthCardsProps {
  graphs: GraphHealthStatus[];
  loading: boolean;
}

// Graph metadata for display
const GRAPH_METADATA: Record<string, { name: string; description: string; icon: string }> = {
  sta: {
    name: 'Safety Triage Agent',
    description: 'Crisis detection and risk classification',
    icon: '🛡️'
  },
  tca: {
    name: 'Therapeutic Coach Agent',
    description: 'CBT-informed coaching and intervention plans',
    icon: '🧠'
  },
  cma: {
    name: 'Case Management Agent',
    description: 'Clinical case management and SLA tracking',
    icon: '📋'
  },
  ia: {
    name: 'Insights Agent',
    description: 'Privacy-preserving analytics',
    icon: '📊'
  },
  aika: {
    name: 'AIKA Meta-Agent',
    description: 'Multi-agent orchestration and intelligent routing',
    icon: '🤖'
  }
};

export function GraphHealthCards({ graphs, loading }: GraphHealthCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-white/20 rounded mb-2"></div>
            <div className="h-4 bg-white/20 rounded mb-4"></div>
            <div className="h-20 bg-white/20 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {graphs.map((graph) => {
        const metadata = GRAPH_METADATA[graph.graph_type];

        // Determine status colors
        const statusColors = {
          healthy: {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            text: 'text-emerald-400',
            dot: 'bg-emerald-400',
            shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
          },
          degraded: {
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/20',
            text: 'text-[#FFCA40]',
            dot: 'bg-[#FFCA40]',
            shadow: 'shadow-[0_0_15px_rgba(255,202,64,0.15)]'
          },
          down: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            text: 'text-red-400',
            dot: 'bg-red-400',
            shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]'
          }
        }[graph.status];

        return (
          <div
            key={graph.graph_type}
            className={`border rounded-xl p-5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${statusColors.bg} ${statusColors.border} ${statusColors.shadow}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl filter drop-shadow-lg">{metadata.icon}</span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full animate-pulse ${statusColors.dot}`}></div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColors.text}`}>
                    {graph.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Graph Name */}
            <h3 className="font-bold text-white mb-1.5 text-lg tracking-tight">{metadata.name}</h3>
            <p className="text-xs text-white/50 mb-5 font-medium leading-relaxed h-8 line-clamp-2">{metadata.description}</p>

            {/* Metrics */}
            <div className="space-y-3 bg-black/20 rounded-lg p-3">
              {/* Success Rate */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/60 font-medium">Success Rate</span>
                  <span className={`font-bold ${statusColors.text}`}>
                    {graph.success_rate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 relative overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${graph.status === 'healthy' ? 'bg-emerald-500' :
                      graph.status === 'degraded' ? 'bg-[#FFCA40]' : 'bg-red-500'
                      }`}
                    style={{ width: `${graph.success_rate}%` }}
                  ></div>
                </div>
              </div>

              {/* Executions */}
              <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-white/60 font-medium">Executions (24h)</span>
                <span className="font-bold text-white font-mono">
                  {graph.total_executions.toLocaleString()}
                </span>
              </div>

              {/* Average Duration */}
              <div className="flex justify-between text-xs">
                <span className="text-white/60 font-medium">Avg Duration</span>
                <span className="font-bold text-white font-mono">
                  {graph.avg_duration_ms.toFixed(0)}ms
                </span>
              </div>

              {/* Error Count */}
              {graph.error_count > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-white/60 font-medium">Errors</span>
                  <span className="font-bold text-red-400 font-mono">
                    {graph.error_count.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Last Execution Time */}
            {graph.last_execution_at && (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] text-white/40 font-mono uppercase tracking-wide">
                  Last: {new Date(graph.last_execution_at).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
