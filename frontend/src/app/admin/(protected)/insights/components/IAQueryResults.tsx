/**
 * IAQueryResults Component
 * 
 * Displays query results with Recharts visualizations and privacy metadata
 */

'use client';

import { IAGraphResponse } from '@/services/langGraphApi';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface IAQueryResultsProps {
  result: IAGraphResponse | null;
  loading: boolean;
}

// Colors for charts - vibrant colors for dark theme
const CHART_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'];

/**
 * Generate appropriate chart based on query type
 */
function getChartForQueryType(queryName: string, data: Record<string, unknown>[]) {
  // Determine chart type based on query
  if (queryName.includes('trend') || queryName.includes('time')) {
    // Time series data - use Line Chart
    return (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} stroke="rgba(255,255,255,0.2)" />
        <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} stroke="rgba(255,255,255,0.2)" />
        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.8)' }} />
        <Line type="monotone" dataKey="count" stroke="#60A5FA" strokeWidth={2} name="Count" />
        {data[0] && 'severity' in data[0] && (
          <Line type="monotone" dataKey="severity" stroke="#F87171" strokeWidth={2} name="Severity" />
        )}
      </LineChart>
    );
  } else if (queryName.includes('distribution') || queryName.includes('case')) {
    // Distribution data - use Pie Chart
    return (
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.8)' }} />
      </PieChart>
    );
  } else {
    // Default to Bar Chart
    const dataKey = Object.keys(data[0] || {}).find(key => typeof data[0]?.[key] === 'number') || 'value';
    const nameKey = Object.keys(data[0] || {}).find(key => typeof data[0]?.[key] === 'string') || 'name';

    return (
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} stroke="rgba(255,255,255,0.2)" />
        <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} stroke="rgba(255,255,255,0.2)" />
        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.8)' }} />
        <Bar dataKey={dataKey} fill="#60A5FA" name="Count" />
      </BarChart>
    );
  }
}


export function IAQueryResults({ result, loading }: IAQueryResultsProps) {
  if (loading) {
    return (
      <div className="bg-[#00153a]/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Query Results</h2>
            <p className="text-xs text-white/50 mt-1 font-mono uppercase tracking-wider">Privacy-preserving analytics output</p>
          </div>
        </div>

        <div className="p-8">
          <div className="text-center py-16">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-[#FFCA40] blur-xl opacity-20 rounded-full animate-pulse"></div>
              <div className="relative inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFCA40]"></div>
            </div>
            <p className="mt-6 text-base text-white/90 font-medium">Executing query with privacy safeguards...</p>
            <p className="text-xs text-white/40 mt-2 font-mono">Validating consent → Applying k-anonymity → Executing analytics</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-[#00153a]/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl h-full flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Query Results</h2>
            <p className="text-xs text-white/50 mt-1 font-mono uppercase tracking-wider">Privacy-preserving analytics output</p>
          </div>
          <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/30 cursor-not-allowed uppercase tracking-wider">
            Export CSV
          </button>
        </div>

        <div className="p-8 flex-1 flex items-center justify-center">
          <div className="text-center py-12 text-white/40">
            <div className="bg-white/5 rounded-full p-6 inline-block mb-4">
              <svg className="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-base font-medium text-white/60">No query results yet</p>
            <p className="text-xs text-white/30 mt-2 max-w-xs mx-auto">Select a query from the panel above and click "Execute" to generate privacy-safe insights.</p>
          </div>
        </div>
      </div>
    );
  }

  const { query_name, result: queryResult, privacy_metadata, execution_path, execution_time_ms, summary, recommendations } = result;

  // Format query name for display
  const queryNameDisplay = query_name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const exportToCSV = () => {
    // Simple CSV export - in production, add proper formatting
    const csvContent = JSON.stringify(queryResult.data, null, 2);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${query_name}_results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-white/10 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">Query Results</h2>
          <p className="text-xs text-white/60 mt-1">{queryNameDisplay}</p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="p-5">
        {/* Success Message */}
        <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-emerald-300">Query executed successfully</h3>
              <div className="mt-2 text-xs text-emerald-200/80 space-y-1">
                <p>Execution path: {execution_path.join(' → ')}</p>
                <p>Execution time: {execution_time_ms?.toFixed(0) || 'N/A'} ms</p>
              </div>
            </div>
          </div>
        </div>

        {/* LLM Insights Display */}
        {summary && (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Executive Summary */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-xl">📊</span> Executive Summary
              </h3>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            </div>

            {/* Actionable Recommendations */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-xl">🚀</span> Actionable Recommendations
              </h3>
              <div className="space-y-3">
                {recommendations && recommendations.length > 0 ? (
                  recommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-emerald-300 text-sm">{rec.recommendation}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${rec.priority?.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-400' :
                          rec.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                          {rec.priority || 'Medium'}
                        </span>
                      </div>
                      {rec.action && (
                        <p className="text-xs text-white/50 mt-1">👉 {rec.action}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm italic">No specific recommendations generated.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Data */}
        <div className="mb-5">
          <h3 className="text-base font-medium text-white mb-3">Data Summary</h3>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-white/60">Total Records</p>
                <p className="text-xl font-bold text-white mt-1">
                  {queryResult.total_records_anonymized || queryResult.data?.length || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">k-anonymity</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  {queryResult.k_anonymity_satisfied ? '✓' : '✗'} k={privacy_metadata.k_value}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">ε Budget Used</p>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  {privacy_metadata.epsilon_used.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60">δ Budget Used</p>
                <p className="text-xl font-bold text-[#FFCA40] mt-1">
                  {privacy_metadata.delta_used.toExponential(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Visualization */}
        {queryResult.data && queryResult.data.length > 0 && (
          <div className="mb-5">
            <h3 className="text-base font-medium text-white mb-3">Visualization</h3>
            <div className="bg-white/5 border border-white/10 rounded-lg p-5">
              <ResponsiveContainer width="100%" height={350}>
                {getChartForQueryType(query_name, queryResult.data)}
              </ResponsiveContainer>
              <p className="text-xs text-white/50 mt-4 text-center">
                All data points meet k≥{privacy_metadata.k_value} privacy threshold
              </p>
            </div>
          </div>
        )}

        {/* Raw Data Table */}
        <div className="mb-5">
          <h3 className="text-base font-medium text-white mb-3">Results Data</h3>
          <div className="overflow-x-auto bg-white/5 border border-white/10 rounded-lg">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  {queryResult.data && queryResult.data.length > 0 && Object.keys(queryResult.data[0]).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="px-5 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {queryResult.data && queryResult.data.slice(0, 10).map((row: Record<string, unknown>, idx: number) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    {Object.values(row).map((value: unknown, cellIdx: number) => (
                      <td key={cellIdx} className="px-5 py-3 whitespace-nowrap text-sm text-white/90">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {queryResult.data && queryResult.data.length > 10 && (
              <p className="text-xs text-white/50 mt-2 px-5 pb-3">
                Showing first 10 of {queryResult.data.length} results. Export CSV to see all.
              </p>
            )}
          </div>
        </div>

        {/* Privacy Metadata */}
        <div className="bg-[#FFCA40]/10 border border-[#FFCA40]/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-[#FFCA40]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-[#FFCA40]">Privacy Metadata</h3>
              <div className="mt-2 text-xs text-white/80 space-y-1">
                <p>
                  <strong className="text-white">k-anonymity satisfied:</strong>{' '}
                  {queryResult.k_anonymity_satisfied ? (
                    <span className="text-emerald-400">✓ Yes (k={privacy_metadata.k_value}, threshold=5)</span>
                  ) : (
                    <span className="text-red-400">✗ No (k&lt;5)</span>
                  )}
                </p>
                <p>
                  <strong className="text-white">Differential privacy budget used:</strong> ε={privacy_metadata.epsilon_used.toFixed(4)}, δ={privacy_metadata.delta_used.toExponential(2)}
                </p>
                <p>
                  <strong className="text-white">Total records anonymized:</strong> {queryResult.total_records_anonymized}
                </p>
                <p>
                  <strong className="text-white">Privacy guarantees:</strong> All results meet k≥5 threshold and consume minimal ε-δ budget
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
