/**
 * CaseListTable Component
 * Displays paginated, filterable, sortable list of cases with SLA indicators
 * Enhanced with glassmorphism design
 */

'use client';

import { useState } from 'react';
import type { CaseListItem, CaseFilters, CaseSeverity, CaseStatus, SLAStatus } from '@/types/admin/cases';
import { formatDistanceToNow } from 'date-fns';
import { FiSearch, FiX, FiChevronUp, FiChevronDown } from 'react-icons/fi';

interface CaseListTableProps {
  cases: CaseListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  filters: CaseFilters;
  onFilterChange: (filters: CaseFilters) => void;
  onCaseClick: (caseId: string) => void;
  loading?: boolean;
}

export default function CaseListTable({
  cases,
  total,
  page,
  pageSize,
  hasNext,
  hasPrev,
  filters,
  onFilterChange,
  onCaseClick,
  loading = false,
}: CaseListTableProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filters, search: searchInput, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    onFilterChange({ ...filters, page: newPage });
  };

  const handleSortChange = (sortBy: CaseFilters['sort_by']) => {
    const newOrder = filters.sort_by === sortBy && filters.sort_order === 'asc' ? 'desc' : 'asc';
    onFilterChange({ ...filters, sort_by: sortBy, sort_order: newOrder });
  };

  // Severity badge styling with glassmorphism
  const getSeverityClass = (severity: CaseSeverity): string => {
    const baseClasses = 'px-3 py-1 text-xs font-semibold rounded-full backdrop-blur-sm border';
    switch (severity) {
      case 'critical':
        return `${baseClasses} bg-red-500/20 text-red-300 border-red-500/40`;
      case 'high':
        return `${baseClasses} bg-orange-500/20 text-orange-300 border-orange-500/40`;
      case 'med':
        return `${baseClasses} bg-yellow-500/20 text-yellow-300 border-yellow-500/40`;
      case 'low':
        return `${baseClasses} bg-green-500/20 text-green-300 border-green-500/40`;
      default:
        return `${baseClasses} bg-white/10 text-white/60 border-white/20`;
    }
  };

  // Status badge styling with glassmorphism
  const getStatusClass = (status: CaseStatus): string => {
    const baseClasses = 'px-3 py-1 text-xs font-semibold rounded-full backdrop-blur-sm border';
    switch (status) {
      case 'new':
        return `${baseClasses} bg-blue-500/20 text-blue-300 border-blue-500/40`;
      case 'in_progress':
        return `${baseClasses} bg-purple-500/20 text-purple-300 border-purple-500/40`;
      case 'waiting':
        return `${baseClasses} bg-amber-500/20 text-amber-300 border-amber-500/40`;
      case 'resolved':
        return `${baseClasses} bg-green-500/20 text-green-300 border-green-500/40`;
      case 'closed':
        return `${baseClasses} bg-gray-500/20 text-gray-300 border-gray-500/40`;
      default:
        return `${baseClasses} bg-white/10 text-white/60 border-white/20`;
    }
  };

  // SLA status indicator
  const getSLAIndicator = (slaStatus: SLAStatus, minutesUntil: number | null) => {
    const getColorClass = () => {
      switch (slaStatus) {
        case 'breached':
          return 'bg-red-500 shadow-red-500/50';
        case 'critical':
          return 'bg-red-400 animate-pulse shadow-red-400/50';
        case 'warning':
          return 'bg-yellow-400 shadow-yellow-400/50';
        case 'safe':
        default:
          return 'bg-green-400 shadow-green-400/50';
      }
    };

    const getTooltip = () => {
      if (slaStatus === 'breached') return 'SLA breached!';
      if (minutesUntil !== null) return `${minutesUntil} min until breach`;
      return 'No SLA set';
    };

    return (
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${getColorClass()} shadow-lg`}
          title={getTooltip()}
        />
        {slaStatus === 'critical' && minutesUntil !== null && (
          <span className="text-xs text-red-400 font-semibold">
            {minutesUntil}m
          </span>
        )}
      </div>
    );
  };

  const SortIcon = ({ active, order }: { active: boolean; order: 'asc' | 'desc' }) => {
    if (!active) return <span className="text-white/30 ml-1">↕</span>;
    return order === 'asc' 
      ? <FiChevronUp className="inline ml-1 text-[#FFCA40]" size={14} />
      : <FiChevronDown className="inline ml-1 text-[#FFCA40]" size={14} />;
  };

  return (
    <div className="space-y-4">
      {/* Filters with Glassmorphism */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiSearch className="text-[#FFCA40]" size={20} />
          Filter & Search Cases
        </h3>
        
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by user hash or summary..."
              className="w-full px-4 py-2.5 bg-black/30 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]/50 transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  onFilterChange({ ...filters, search: undefined, page: 1 });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                aria-label="Clear search"
              >
                <FiX size={18} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#FFCA40] text-[#001D58] font-semibold rounded-lg hover:bg-[#FFD966] transition-all shadow-lg shadow-[#FFCA40]/20"
          >
            Search
          </button>
        </form>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-xs text-white/60 mb-1.5 font-medium uppercase tracking-wide">
              Status
            </label>
            <select
              id="status-filter"
              value={filters.status || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  status: e.target.value as CaseStatus | undefined,
                  page: 1,
                })
              }
              className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]/50 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label htmlFor="severity-filter" className="block text-xs text-white/60 mb-1.5 font-medium uppercase tracking-wide">
              Severity
            </label>
            <select
              id="severity-filter"
              value={filters.severity || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  severity: e.target.value as CaseSeverity | undefined,
                  page: 1,
                })
              }
              className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]/50 transition-all"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Assignment Filter */}
          <div>
            <label htmlFor="assignment-filter" className="block text-xs text-white/60 mb-1.5 font-medium uppercase tracking-wide">
              Assignment
            </label>
            <select
              id="assignment-filter"
              value={
                filters.unassigned
                  ? 'unassigned'
                  : filters.assigned_to || ''
              }
              onChange={(e) => {
                if (e.target.value === 'unassigned') {
                  onFilterChange({ ...filters, unassigned: true, assigned_to: undefined, page: 1 });
                } else if (e.target.value === '') {
                  onFilterChange({ ...filters, unassigned: undefined, assigned_to: undefined, page: 1 });
                } else {
                  onFilterChange({ ...filters, unassigned: undefined, assigned_to: e.target.value, page: 1 });
                }
              }}
              className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]/50 transition-all"
            >
              <option value="">All Assignments</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* SLA Filter */}
          <div>
            <label htmlFor="sla-filter" className="block text-xs text-white/60 mb-1.5 font-medium uppercase tracking-wide">
              SLA Status
            </label>
            <label className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-white/20 rounded-lg cursor-pointer hover:bg-black/40 transition-colors h-[42px]">
              <input
                type="checkbox"
                id="sla-filter"
                checked={filters.sla_breached || false}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    sla_breached: e.target.checked || undefined,
                    page: 1,
                  })
                }
                className="rounded border-white/30 bg-black/30 text-[#FFCA40] focus:ring-[#FFCA40] focus:ring-offset-0"
              />
              <span className="text-sm text-white">SLA Breached</span>
            </label>
          </div>

          {/* Page Size */}
          <div>
            <label htmlFor="pagesize-filter" className="block text-xs text-white/60 mb-1.5 font-medium uppercase tracking-wide">
              Per Page
            </label>
            <select
              id="pagesize-filter"
              value={filters.page_size || 20}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  page_size: parseInt(e.target.value),
                  page: 1,
                })
              }
              className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]/50 transition-all"
            >
              <option value="10">10 cases</option>
              <option value="20">20 cases</option>
              <option value="50">50 cases</option>
              <option value="100">100 cases</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table with Glassmorphism */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-black/20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  SLA
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => handleSortChange('severity')}
                >
                  Severity
                  <SortIcon 
                    active={filters.sort_by === 'severity'} 
                    order={filters.sort_order || 'desc'} 
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  User Hash
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Summary
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Risk Score
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => handleSortChange('created_at')}
                >
                  Created
                  <SortIcon 
                    active={filters.sort_by === 'created_at'} 
                    order={filters.sort_order || 'desc'} 
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => handleSortChange('updated_at')}
                >
                  Updated
                  <SortIcon 
                    active={filters.sort_by === 'updated_at'} 
                    order={filters.sort_order || 'desc'} 
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-white/60">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCA40]"></div>
                      <p>Loading cases...</p>
                    </div>
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-white/60">
                    <p className="text-lg">No cases found</p>
                    <p className="text-sm text-white/40 mt-2">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                cases.map((caseItem) => (
                  <tr
                    key={caseItem.id}
                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                    onClick={() => onCaseClick(caseItem.id)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getSLAIndicator(caseItem.sla_status, caseItem.minutes_until_breach)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={getSeverityClass(caseItem.severity)}>
                        {caseItem.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={getStatusClass(caseItem.status)}>
                        {caseItem.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-white/80">
                      {caseItem.user_hash.substring(0, 12)}...
                    </td>
                    <td className="px-4 py-4 text-sm text-white/80 max-w-xs truncate">
                      {caseItem.summary_redacted || <span className="text-white/40 italic">No summary</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white/80">
                      {caseItem.assigned_to || (
                        <span className="text-white/40 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {caseItem.latest_triage ? (
                        <span className={caseItem.latest_triage.risk_score >= 0.7 ? 'font-semibold text-red-400' : 'text-white/80'}>
                          {(caseItem.latest_triage.risk_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-white/40">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white/60">
                      {formatDistanceToNow(new Date(caseItem.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white/60">
                      {formatDistanceToNow(new Date(caseItem.updated_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCaseClick(caseItem.id);
                        }}
                        className="text-[#FFCA40] hover:text-[#FFD966] font-medium transition-colors group-hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination with Glassmorphism */}
        <div className="bg-black/20 px-6 py-4 flex items-center justify-between border-t border-white/10">
          <div className="text-sm text-white/70">
            Showing <span className="font-semibold text-white">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-white">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-semibold text-white">{total}</span> cases
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={!hasPrev}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="px-4 py-2 bg-[#FFCA40]/20 border border-[#FFCA40]/30 rounded-lg text-sm font-semibold text-white">
              Page {page}
            </div>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasNext}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
