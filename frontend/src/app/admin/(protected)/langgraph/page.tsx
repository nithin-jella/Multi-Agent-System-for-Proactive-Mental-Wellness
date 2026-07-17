/**
 * LangGraph Monitoring Dashboard
 * 
 * Purpose: Real-time monitoring and analytics for all LangGraph StateGraphs
 * User Role: Admin only
 */

'use client';

import { useState } from 'react';
import { AgenticArchitectureGraph } from './components/AgenticArchitectureGraph';
import { AnalyticsOverview } from './components/AnalyticsOverview';
import { ExecutionHistoryTable } from './components/ExecutionHistoryTable';
// Removing AlertsPanel and AgentDetailsPanel for the strict brutalist dashboard 
// since we now display everything in the high-density grid.
import { useLangGraphHealth } from './hooks/useLangGraphHealth';

export default function LangGraphMonitoringPage() {
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { data, error, refetch } = useLangGraphHealth(30);

  return (
    <div className="space-y-6 font-mono text-white selection:bg-white/30">
      
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/20 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-widest mb-1">LangGraph Observability</h1>
            <p className="text-white/50 text-xs uppercase tracking-widest">
              Financial & Technical Telemetry
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex border border-white/20 text-xs">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setAnalyticsDays(days)}
                  className={`px-3 py-1 transition-colors uppercase ${
                    analyticsDays === days
                      ? 'bg-white text-black font-bold'
                      : 'bg-black text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>

            {/* Overall Status Badge */}
            {data && (
              <div className={`flex items-center gap-2 text-xs px-3 py-1 border uppercase font-bold tracking-widest ${
                data.overall_status === 'healthy' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' :
                data.overall_status === 'degraded' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                'border-red-500 text-red-500 bg-red-500/10'
              }`}>
                <div className={`h-1.5 w-1.5 ${
                  data.overall_status === 'healthy' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                  data.overall_status === 'degraded' ? 'bg-yellow-500 shadow-[0_0_8px_#eab308]' : 
                  'bg-red-500 shadow-[0_0_8px_#ef4444]'
                }`}></div>
                SYS:{data.overall_status}
              </div>
            )}
          </div>
        </div>

        {/* Financial & Health Ribbon */}
        <AnalyticsOverview days={analyticsDays} />

        {/* Error State */}
        {error && (
          <div className="border border-red-500 bg-red-500/10 p-3 text-red-500 text-xs flex justify-between items-center uppercase tracking-widest">
            <p>ERR_CONNECTION: Failed to sync telemetry ({error})</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-1 border border-red-500 hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Top Row: Graph (Left) & Minimal Grid (Right) */}
          <div className="col-span-12 lg:col-span-6 space-y-2">
            <h2 className="text-xs text-white/50 uppercase tracking-widest border-b border-white/10 pb-2">
              Agentic Architecture Topology
            </h2>
            <AgenticArchitectureGraph
              onNodeClick={setSelectedAgentId}
              healthData={data}
            />
          </div>

          <div className="col-span-12 lg:col-span-6 space-y-2">
            <h2 className="text-xs text-white/50 uppercase tracking-widest border-b border-white/10 pb-2">
              Recent Execution Trace
            </h2>
            <ExecutionHistoryTable limit={15} />
          </div>
        </div>

        {selectedAgentId && (
          <div className="border border-white/20 bg-black p-4 text-xs">
            <div className="flex justify-between items-center border-b border-white/20 pb-2 mb-2">
              <span className="uppercase text-white/50 tracking-widest">Selected Node Inspector</span>
              <button onClick={() => setSelectedAgentId(null)} className="text-white hover:text-red-500 uppercase">CLOSE [X]</button>
            </div>
            <div className="text-white/80">
              <span className="text-white font-bold uppercase tracking-widest">NODE ID: {selectedAgentId}</span><br/>
              TELEMETRY DUMP:<br/>
              (Deep dive traces available in the grid above. View detailed API responses here if connected to backend)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
