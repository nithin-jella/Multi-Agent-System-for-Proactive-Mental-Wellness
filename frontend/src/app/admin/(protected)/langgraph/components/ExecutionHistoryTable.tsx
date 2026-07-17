/**
 * ExecutionHistoryTable Component (Data Grid)
 * 
 * Displays extremely high-density paginated table of LangGraph execution history with:
 * - Filtering by status and graph type
 * - Strict brutalist monochrome design
 * - Token & Cost tracking
 */

'use client';

import { useState, useEffect } from 'react';
import { useLangGraphAnalytics } from '../hooks/useLangGraphAnalytics';

interface ExecutionHistoryTableProps {
  limit?: number;
}

export function ExecutionHistoryTable({ limit = 50 }: ExecutionHistoryTableProps) {
  const { history, loadingHistory, fetchHistory } = useLangGraphAnalytics();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [graphFilter, setGraphFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const validStatus = statusFilter as 'completed' | 'failed' | 'running' | '';
    const validGraph = graphFilter as 'sta' | 'tca' | 'cma' | 'ia' | 'aika' | 'orchestrator' | '';
    fetchHistory({
      limit,
      offset,
      status: validStatus || undefined,
      graph_name: (validGraph || undefined) as 'sta' | 'tca' | 'cma' | 'ia' | 'aika' | 'orchestrator' | undefined
    });
  }, [offset, statusFilter, graphFilter, limit, fetchHistory]);

  const handleRefresh = () => {
    setOffset(0);
    fetchHistory({
      limit,
      offset: 0,
      status: statusFilter as any || undefined,
      graph_name: graphFilter as any || undefined
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-emerald-500';
      case 'failed': return 'text-red-500 bg-red-950/30';
      case 'running': return 'text-blue-400';
      default: return 'text-white/50';
    }
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-';
    return `${ms}ms`;
  };

  return (
    <div className="border border-white/20 bg-black font-mono">
      {/* Header and Controls */}
      <div className="flex justify-between items-center p-3 border-b border-white/20 bg-white/5">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Execution Trace Grid</h2>
        <div className="flex gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black border border-white/20 text-white px-2 py-1 outline-none appearance-none cursor-pointer"
          >
            <option value="">STATUS:ALL</option>
            <option value="completed">STATUS:COMPLETED</option>
            <option value="failed">STATUS:FAILED</option>
            <option value="running">STATUS:RUNNING</option>
          </select>
          <select
            value={graphFilter}
            onChange={(e) => setGraphFilter(e.target.value)}
            className="bg-black border border-white/20 text-white px-2 py-1 outline-none appearance-none cursor-pointer uppercase"
          >
            <option value="">AGENT:ALL</option>
            <option value="sta">STA</option>
            <option value="tca">TCA</option>
            <option value="cma">CMA</option>
            <option value="ia">IA</option>
            <option value="aika">AIKA</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={loadingHistory}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 border border-white/20 transition-colors uppercase"
          >
            {loadingHistory ? 'WAIT' : 'SYNC'}
          </button>
        </div>
      </div>

      {/* Grid container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-white/5 border-b border-white/20 text-white/50 uppercase tracking-widest">
            <tr>
              <th className="py-2 pl-3 pr-2 font-normal">ID</th>
              <th className="py-2 px-2 font-normal">TIME</th>
              <th className="py-2 px-2 font-normal">AGENT</th>
              <th className="py-2 px-2 font-normal">STATUS</th>
              <th className="py-2 px-2 font-normal text-right">DUR</th>
              <th className="py-2 px-2 font-normal text-right">TOKENS (P/C)</th>
              <th className="py-2 px-2 font-normal text-right">USD</th>
              <th className="py-2 pl-2 pr-3 font-normal max-w-50 truncate">ERROR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-white/80">
            {loadingHistory ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-white/50">OBTAINING TELEMETRY...</td>
              </tr>
            ) : !history || history.data.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-white/50">NO TELEMETRY RECORDED</td>
              </tr>
            ) : (
              history.data.map((exec) => (
                <tr key={exec.execution_id} className={`hover:bg-white/5 cursor-crosshair group ${getStatusColor(exec.status)}`}>
                  <td className="py-1.5 pl-3 pr-2">{exec.execution_id.substring(0, 8)}</td>
                  <td className="py-1.5 px-2">{new Date(exec.started_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}.{(new Date(exec.started_at).getMilliseconds()).toString().padStart(3, '0')}</td>
                  <td className="py-1.5 px-2 uppercase">{exec.graph_name}</td>
                  <td className="py-1.5 px-2 uppercase">{exec.status}</td>
                  <td className="py-1.5 px-2 text-right">{formatDuration(exec.total_execution_time_ms)}</td>
                  <td className="py-1.5 px-2 text-right text-white/60 group-hover:text-white/90">
                    {(exec.tokens?.total ?? 0) > 0 ? (
                      `${exec.tokens.prompt} / ${exec.tokens.completion}`
                    ) : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right">${(exec.cost_usd ?? 0).toFixed(4)}</td>
                  <td className="py-1.5 pl-2 pr-3 max-w-50 truncate text-red-400">
                    {exec.error_message || ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer / Pagination */}
      <div className="flex justify-between items-center p-2 border-t border-white/20 bg-white/5 text-xs text-white/50">
        <div>
          OFFSET: {offset} | LIMIT: {limit} 
          {history?.pagination?.returned !== undefined && ` | RCV: ${history.pagination.returned}`}
        </div>
        <div className="flex gap-2">
          <button 
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-2 py-0.5 hover:text-white disabled:opacity-30 uppercase"
          >
            &lt; PREV
          </button>
          <button 
            disabled={!history || history.data.length < limit}
            onClick={() => setOffset(offset + limit)}
            className="px-2 py-0.5 hover:text-white disabled:opacity-30 uppercase"
          >
            NEXT &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
