/**
 * AlertsPanel Component
 * 
 * Displays active system alerts with:
 * - Severity badges (info/warning/error/critical)
 * - Alert descriptions
 * - Resolve functionality
 * - Auto-refresh
 */

'use client';

import { useEffect } from 'react';
import { useLangGraphAnalytics } from '../hooks/useLangGraphAnalytics';

export function AlertsPanel() {
  const { alerts, loadingAlerts, fetchAlerts, resolveAlert } = useLangGraphAnalytics();

  // Fetch alerts on mount and every 60 seconds
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => {
      void fetchAlerts();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleResolve = async (alertId: number) => {
    try {
      await resolveAlert(alertId);
    } catch {
      alert('Failed to resolve alert');
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
      case 'error':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'warning':
        return 'bg-[#FFCA40]/10 border-[#FFCA40]/20 text-[#FFCA40]';
      case 'info':
      default:
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    }
  };

  const getGraphIcon = (graphType?: string | null) => {
    const icons: Record<string, string> = {
      sta: '🛡️',
      tca: '🧠',
      cma: '📋',
      ia: '📊',
      aika: '🤖',
      orchestrator: '🎯'
    };
    const key = (graphType ?? '').toString().trim().toLowerCase();
    if (!key) return '📦';
    return icons[key] || '📦';
  };

  if (loadingAlerts) {
    return (
      <div className="bg-[#00153a]/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl h-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-xl border border-white/5"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeAlerts = alerts?.data || [];

  return (
    <div className="bg-[#00153a]/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">System Alerts</h2>
        <span className="text-xs font-mono text-white/40 uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full border border-white/5">
          {activeAlerts.length} Active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {activeAlerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white font-medium">All Systems Healthy</p>
            <p className="text-sm text-white/50 mt-1">No active alerts detected</p>
          </div>
        ) : (
          activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.02] ${getSeverityStyles(alert.severity)}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getGraphIcon(alert.graph_type)}</span>
                  <span className="font-bold text-sm uppercase tracking-wider opacity-90">
                    {alert.graph_type || 'unknown'}
                  </span>
                </div>
                <span className="text-[10px] font-mono opacity-70">
                  {new Date(alert.created_at).toLocaleTimeString()}
                </span>
              </div>

              <p className="text-sm font-medium mb-3 leading-relaxed opacity-90">
                {alert.message}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-black/10">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
                  {alert.severity} Priority
                </span>
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="text-xs font-bold hover:underline opacity-80 hover:opacity-100 transition-opacity"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
