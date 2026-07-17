/**
 * LangGraph Health Widget
 * Compact health status display for all Safety Agent Suite graphs
 * Shows in Dashboard for quick monitoring
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import axios from 'axios';
import { ChartBarIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { getAnalyticsOverview } from '@/services/langGraphApi';

interface GraphHealth {
  graph_type: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  success_rate: number;
  total_executions: number;
}

interface HealthData {
  overall_status: 'healthy' | 'degraded' | 'down' | 'unknown';
  graphs: GraphHealth[];
  last_updated: string;
  total_executions: number;
  success_rate_percent: number;
}

const GRAPH_NAMES: Record<string, string> = {
  sta: 'STA',
  tca: 'TCA',
  cma: 'CMA',
  ia: 'IA',
  sca: 'TCA',
  sda: 'CMA',
  orchestrator: 'Orch',
};

const GRAPH_FULL_NAMES: Record<string, string> = {
  sta: 'Safety Triage Agent',
  tca: 'Therapeutic Chat Agent',
  cma: 'Case Management Agent',
  ia: 'Insights Agent',
  sca: 'Student Communication Agent',
  sda: 'Case Management Agent',
  orchestrator: 'Orchestrator',
};

export default function LangGraphHealthWidget() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  const isAuthError = (err: unknown): boolean => {
    if (axios.isAxiosError(err)) {
      return err.response?.status === 401;
    }

    if (err instanceof Error) {
      const message = err.message.toLowerCase();
      return message.includes('not authenticated') || message.includes('authentication required');
    }

    return false;
  };

  const fetchHealth = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    
    try {
      const result = await getAnalyticsOverview(1);
      
      if (result.success && result.data) {
        const analytics = result.data;
        
        // Determine overall status based on success rate
        let overallStatus: 'healthy' | 'degraded' | 'down' | 'unknown' = 'unknown';
        const successRate = analytics.success_rate_percent || 0;
        
        if (analytics.total_executions === 0) {
          overallStatus = 'unknown';
        } else if (successRate >= 95) {
          overallStatus = 'healthy';
        } else if (successRate >= 70) {
          overallStatus = 'degraded';
        } else {
          overallStatus = 'down';
        }

        // Build graph health from most_active_nodes or default graphs
        const graphTypes = ['sta', 'tca', 'cma', 'ia'];
        const graphs: GraphHealth[] = graphTypes.map(graphType => {
          // Check if we have specific metrics for this graph
          const nodeMetrics = analytics.most_active_nodes?.find(
            (n) => n.node_name.toLowerCase().includes(graphType)
          );
          
          return {
            graph_type: graphType,
            status: nodeMetrics 
              ? (nodeMetrics.success_rate_percent >= 95 ? 'healthy' : nodeMetrics.success_rate_percent >= 70 ? 'degraded' : 'down')
              : (analytics.total_executions > 0 ? overallStatus : 'unknown'),
            success_rate: nodeMetrics?.success_rate_percent || successRate,
            total_executions: nodeMetrics?.execution_count || 0,
          };
        });

        setHealthData({
          overall_status: overallStatus,
          graphs,
          last_updated: result.generated_at || new Date().toISOString(),
          total_executions: analytics.total_executions || 0,
          success_rate_percent: successRate,
        });
        setError(null);
        setAuthUnavailable(false);
      } else {
        // No data available, show unknown state
        setHealthData({
          overall_status: 'unknown',
          graphs: ['sta', 'tca', 'cma', 'ia'].map(g => ({
            graph_type: g,
            status: 'unknown',
            success_rate: 0,
            total_executions: 0,
          })),
          last_updated: new Date().toISOString(),
          total_executions: 0,
          success_rate_percent: 0,
        });
        setError(null);
        setAuthUnavailable(false);
      }
    } catch (err) {
      if (isAuthError(err)) {
        setAuthUnavailable(true);
        setError('Unavailable');
      } else {
        console.error('LangGraph Health Widget error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    if (authUnavailable) {
      return undefined;
    }

    const interval = setInterval(() => fetchHealth(), 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [authUnavailable, fetchHealth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', dot: 'bg-emerald-400', text: 'text-emerald-300' };
      case 'degraded':
        return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', dot: 'bg-yellow-400', text: 'text-yellow-300' };
      case 'down':
        return { bg: 'bg-red-500/20', border: 'border-red-500/30', dot: 'bg-red-400', text: 'text-red-300' };
      default:
        return { bg: 'bg-gray-500/20', border: 'border-gray-500/30', dot: 'bg-gray-400', text: 'text-gray-300' };
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetchHealth(true);
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-white/10 rounded mb-3 w-2/3"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-white/10 rounded flex-1"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isUnavailable = error === 'Unavailable';

    return (
      <div className={`${isUnavailable ? 'bg-white/5 border-white/10' : 'bg-red-500/10 border-red-500/30'} backdrop-blur-sm border rounded-xl p-4`}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-sm ${isUnavailable ? 'text-white/65' : 'text-red-300'}`}>
            {!isUnavailable && <ExclamationTriangleIcon className="w-4 h-4" />}
            <span>{isUnavailable ? 'LangGraph: unavailable on this session' : `LangGraph: ${error}`}</span>
          </div>
          {!isUnavailable && (
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 text-red-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!healthData) return null;

  const overallColors = getStatusColor(healthData.overall_status);

  return (
    <Link href="/admin/langgraph" className="block group">
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={`${overallColors.bg} backdrop-blur-sm border ${overallColors.border} rounded-xl p-4 hover:shadow-lg transition-all`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-white/70" />
            <h3 className="font-semibold text-white">LangGraph Status</h3>
            {healthData.total_executions > 0 && (
              <span className="text-xs text-white/50 ml-2">
                ({healthData.total_executions} executions today)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 text-white/60 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${overallColors.dot} ${healthData.overall_status === 'healthy' ? 'animate-pulse' : ''}`}></div>
              <span className={`text-xs font-semibold uppercase ${overallColors.text}`}>
                {healthData.overall_status === 'unknown' ? 'No Data' : healthData.overall_status}
              </span>
            </div>
          </div>
        </div>

        {/* Graph Status Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {healthData.graphs.map((graph) => {
            const colors = getStatusColor(graph.status);
            return (
              <div
                key={graph.graph_type}
                className={`${colors.bg} border ${colors.border} rounded-lg px-3 py-2.5 group/pill hover:scale-[1.02] transition-transform`}
                title={GRAPH_FULL_NAMES[graph.graph_type] || graph.graph_type}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white/60">
                    {GRAPH_NAMES[graph.graph_type] || graph.graph_type.toUpperCase()}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-bold ${colors.text}`}>
                    {graph.status === 'unknown' ? '—' : `${Math.round(graph.success_rate)}%`}
                  </span>
                  {graph.total_executions > 0 && (
                    <span className="text-xs text-white/40">
                      ({graph.total_executions})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* View Details Link */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/40">
            Updated {new Date(healthData.last_updated).toLocaleTimeString()}
          </span>
          <span className="text-[#FFCA40] group-hover:text-[#FFD666] font-medium flex items-center gap-1">
            View Details
            <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
