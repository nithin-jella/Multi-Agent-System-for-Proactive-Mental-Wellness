import { useState, useMemo } from 'react';
import { ClockIcon, ExclamationTriangleIcon, UserIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface CaseRecord {
  case_id: string;
  severity: string;
  status: string;
  sla_breach_at: string;
  assigned_to?: number;
  created_at: string;
}

interface PriorityQueueProps {
  cases: CaseRecord[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 border-red-500/30 text-red-300',
  high: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
  moderate: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
  low: 'bg-green-500/20 border-green-500/30 text-green-300',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  in_progress: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  resolved: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
  closed: 'bg-white/10 border-white/20 text-white/50',
};

type FilterChip = 'all' | 'critical' | 'high' | 'moderate' | 'low';

export function PriorityQueue({ cases }: PriorityQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityChip, setSeverityChip] = useState<FilterChip>('all');

  const filteredCases = useMemo(() => {
    let filtered = cases;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.case_id.toLowerCase().includes(q));
    }
    if (severityChip !== 'all') {
      filtered = filtered.filter(c => c.severity === severityChip);
    }
    return filtered;
  }, [cases, searchQuery, severityChip]);

  const sortedCases = useMemo(() =>
    [...filteredCases].sort((a, b) => {
      if (!a.sla_breach_at || !b.sla_breach_at) return 0;
      return new Date(a.sla_breach_at).getTime() - new Date(b.sla_breach_at).getTime();
    }),
    [filteredCases]
  );

  const hasActiveFilters = searchQuery || severityChip !== 'all';

  const getTimeUntilBreach = (slaBreachAt: string) => {
    const hoursUntil = (new Date(slaBreachAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 0) return { text: 'BREACHED', color: 'text-red-400', urgent: true };
    if (hoursUntil < 1) return { text: `${Math.floor(hoursUntil * 60)}m`, color: 'text-red-400', urgent: true };
    if (hoursUntil < 2) return { text: `${hoursUntil.toFixed(1)}h`, color: 'text-orange-400', urgent: true };
    return { text: `${hoursUntil.toFixed(1)}h`, color: 'text-white/60', urgent: false };
  };

  if (cases.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/5 flex items-center justify-center">
          <ClockIcon className="w-6 h-6 text-white/20" />
        </div>
        <p className="text-sm text-white/50">No cases in queue</p>
        <p className="text-xs text-white/30 mt-1">Create a case above to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search case ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50 transition-all"
          />
        </div>

        {/* Severity Chips */}
        <div className="flex items-center gap-1.5">
          {(['all', 'critical', 'high', 'moderate', 'low'] as FilterChip[]).map((chip) => (
            <button
              key={chip}
              onClick={() => setSeverityChip(chip)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                severityChip === chip
                  ? 'bg-[#FFCA40]/15 border-[#FFCA40]/30 text-[#FFCA40]'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10'
              }`}
            >
              {chip === 'all' ? 'All' : chip.charAt(0).toUpperCase() + chip.slice(1)}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setSeverityChip('all'); }}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/10 transition-all"
              title="Clear filters"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-[11px] text-white/40">
        Showing {sortedCases.length} of {cases.length} cases
      </div>

      {/* Table */}
      {sortedCases.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-white/50">No cases match filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-[11px] font-medium text-white/50 uppercase tracking-wider">Case ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-white/50 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-white/50 uppercase tracking-wider">Assigned</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-white/50 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-white/50 uppercase tracking-wider">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedCases.map((c) => {
                const slaInfo = c.sla_breach_at ? getTimeUntilBreach(c.sla_breach_at) : null;
                return (
                  <tr
                    key={c.case_id}
                    className={`hover:bg-white/5 transition-colors ${slaInfo?.urgent ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-mono text-white/80">
                        #{c.case_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold rounded-md border ${SEVERITY_COLORS[c.severity] || 'bg-white/10 border-white/20 text-white/60'}`}>
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        {c.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-[11px] font-semibold rounded-md border ${STATUS_COLORS[c.status] || 'bg-white/10 border-white/20 text-white/60'}`}>
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.assigned_to ? (
                        <div className="flex items-center gap-1.5 text-xs text-white/60">
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>#{c.assigned_to}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {slaInfo ? (
                        <div className="flex flex-col items-end">
                          <span className={`text-lg font-bold ${slaInfo.color} ${slaInfo.urgent ? 'animate-pulse' : ''}`}>
                            {slaInfo.text}
                          </span>
                          {slaInfo.urgent && (
                            <span className="text-[10px] text-red-400 font-semibold">URGENT</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-white/30">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
