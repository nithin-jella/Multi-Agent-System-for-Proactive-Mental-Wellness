/**
 * Admin Cases Management Page
 * Comprehensive case management with filtering, sorting, pagination, and workflows
 * Compact stats bar, quick filter chips, and conditional alert banner
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { listCases } from '@/services/adminCaseApi';
import type { CaseListResponse, CaseFilters } from '@/types/admin/cases';
import CaseListTable from '@/components/admin/cases/CaseListTable';
import CaseDetailModal from '@/components/admin/cases/CaseDetailModal';
import CaseStatusWorkflow from '@/components/admin/cases/CaseStatusWorkflow';
import CaseAssignment from '@/components/admin/cases/CaseAssignment';
import toast from 'react-hot-toast';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  FiAlertCircle, FiClock, FiUsers, FiCheckCircle,
  FiAlertTriangle, FiShield, FiFilter,
} from 'react-icons/fi';
import { useSSEEventHandler } from '@/contexts/AdminSSEContext';

// Quick filter chip presets
type QuickFilter = 'all' | 'critical_high' | 'unassigned' | 'sla_risk' | 'new';
const QUICK_FILTERS: { key: QuickFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All Cases', icon: <FiFilter size={14} /> },
  { key: 'critical_high', label: 'Critical / High', icon: <FiAlertCircle size={14} /> },
  { key: 'unassigned', label: 'Unassigned', icon: <FiUsers size={14} /> },
  { key: 'sla_risk', label: 'SLA At Risk', icon: <FiClock size={14} /> },
  { key: 'new', label: 'New', icon: <FiAlertTriangle size={14} /> },
];

function chipToFilters(chip: QuickFilter, base: CaseFilters): CaseFilters {
  const next: CaseFilters = { page: 1, page_size: base.page_size, sort_by: base.sort_by, sort_order: base.sort_order };
  switch (chip) {
    case 'critical_high': next.severity = undefined; break; // we'll handle below
    case 'unassigned': next.unassigned = true; break;
    case 'sla_risk': next.sla_breached = true; break;
    case 'new': next.status = 'new'; break;
    default: break;
  }
  return next;
}

export default function CasesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const caseIdParam = searchParams?.get('case_id');
  const [response, setResponse] = useState<CaseListResponse>({
    cases: [],
    total: 0,
    page: 1,
    page_size: 20,
    has_next: false,
    has_prev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CaseFilters>({
    page: 1,
    page_size: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [activeChip, setActiveChip] = useState<QuickFilter>('all');

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Use ref for SSE handlers to avoid stale closures
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Handle case_created events via centralized SSE context
  useSSEEventHandler('case_created', useCallback(() => {
    toast.success('New case created', { duration: 3000 });
    setFilters(prev => ({ ...prev }));
  }, []));

  // Handle case_updated events
  useSSEEventHandler('case_updated', useCallback(() => {
    toast('Case updated', { duration: 2000 });
    setFilters(prev => ({ ...prev }));
  }, []));

  // Handle sla_breach events
  useSSEEventHandler('sla_breach', useCallback(() => {
    toast.error('SLA breach detected', { duration: 5000 });
    setFilters(prev => ({ ...prev }));
  }, []));

  const updateCaseIdParam = useCallback((caseId: string | null) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (caseId) {
      params.set('case_id', caseId);
    } else {
      params.delete('case_id');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (caseIdParam && caseIdParam !== selectedCaseId) {
      setSelectedCaseId(caseIdParam);
      setShowDetailModal(true);
    }
  }, [caseIdParam, selectedCaseId]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listCases(filters);
        setResponse(data);
      } catch (err) {
        console.error('Failed to fetch cases:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cases');
        toast.error('Failed to load cases');
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [filters]);

  const handleChipClick = (chip: QuickFilter) => {
    setActiveChip(chip);
    if (chip === 'all') {
      setFilters({ page: 1, page_size: 20, sort_by: 'created_at', sort_order: 'desc' });
    } else if (chip === 'critical_high') {
      // API doesn't support multiple severity values, so sort by severity desc to float critical/high to top
      setFilters({ page: 1, page_size: 20, sort_by: 'severity', sort_order: 'desc' });
    } else {
      setFilters(chipToFilters(chip, filters));
    }
  };

  const handleCaseClick = (caseId: string) => {
    updateCaseIdParam(caseId);
    setSelectedCaseId(caseId);
    setShowDetailModal(true);
  };

  const handleStatusUpdate = (caseId: string) => {
    setSelectedCaseId(caseId);
    setShowDetailModal(false);
    setShowStatusModal(true);
  };

  const handleAssign = (caseId: string) => {
    setSelectedCaseId(caseId);
    setShowDetailModal(false);
    setShowAssignmentModal(true);
  };

  const handleSuccess = () => {
    setFilters({ ...filters });
  };

  const selectedCase = response.cases.find((c) => c.id === selectedCaseId);

  // Page-level stats (from current page of data)
  const pageCritical = response.cases.filter(c => c.severity === 'critical').length;
  const pageHigh = response.cases.filter(c => c.severity === 'high').length;
  const pageUnassigned = response.cases.filter(c => !c.assigned_to).length;
  const pageSlaBreached = response.cases.filter(c => c.sla_status === 'breached').length;

  // Conditional alert: show if there are breached SLAs or critical unassigned on this page
  const criticalUnassigned = response.cases.filter(c => c.severity === 'critical' && !c.assigned_to).length;
  const showAlert = pageSlaBreached > 0 || criticalUnassigned > 0;

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FiShield className="text-[#FFCA40]" size={22} />
              <h1 className="text-2xl font-bold text-white">Cases</h1>
              <span className="px-2.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-full">
                {response.total} total
              </span>
            </div>
            <p className="text-white/60 text-sm ml-8.5">
              Monitor and manage mental health cases with real-time SLA tracking
            </p>
          </div>
          <a
            href="/admin/quick-triage"
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/15 border border-[#FFCA40]/30 text-[#FFCA40] text-sm font-medium rounded-lg hover:bg-[#FFCA40]/25 transition-colors"
          >
            Quick Triage
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>

        {/* Compact Summary Bar */}
        <div className="flex items-center gap-6 mt-4 ml-[34px] text-sm">
          <div className="flex items-center gap-1.5">
            <FiAlertCircle className="text-red-400" size={15} />
            <span className="text-white/50">Critical:</span>
            <span className="text-white font-semibold">{pageCritical}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FiAlertTriangle className="text-orange-400" size={15} />
            <span className="text-white/50">High:</span>
            <span className="text-white font-semibold">{pageHigh}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FiUsers className="text-purple-400" size={15} />
            <span className="text-white/50">Unassigned:</span>
            <span className="text-white font-semibold">{pageUnassigned}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FiClock className="text-red-400" size={15} />
            <span className="text-white/50">SLA Breached:</span>
            <span className="text-white font-semibold">{pageSlaBreached}</span>
          </div>
        </div>
      </div>

      {/* Alert Banner (conditional) */}
      {showAlert && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <FiAlertCircle className="text-red-400 shrink-0" size={18} />
          <div className="flex items-center gap-4 text-sm">
            {pageSlaBreached > 0 && (
              <span className="text-red-300 font-medium">
                {pageSlaBreached} SLA breach{pageSlaBreached > 1 ? 'es' : ''} on this page
              </span>
            )}
            {criticalUnassigned > 0 && (
              <span className="text-orange-300 font-medium">
                {criticalUnassigned} critical case{criticalUnassigned > 1 ? 's' : ''} unassigned
              </span>
            )}
          </div>
          <button
            onClick={() => handleChipClick('sla_risk')}
            className="ml-auto text-xs text-red-300 hover:text-red-200 underline underline-offset-2"
          >
            Show SLA breaches
          </button>
        </div>
      )}

      {/* Quick Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_FILTERS.map(chip => (
          <button
            key={chip.key}
            onClick={() => handleChipClick(chip.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeChip === chip.key
                ? 'bg-[#FFCA40]/20 border-[#FFCA40]/40 text-[#FFCA40]'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {chip.icon}
            {chip.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="text-red-400 flex-shrink-0" size={20} />
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Cases Table */}
      <CaseListTable
        cases={response.cases}
        total={response.total}
        page={response.page}
        pageSize={response.page_size}
        hasNext={response.has_next}
        hasPrev={response.has_prev}
        filters={filters}
        onFilterChange={(f) => {
          setActiveChip('all'); // reset chip highlight when user uses table filters
          setFilters(f);
        }}
        onCaseClick={handleCaseClick}
        loading={loading}
      />

      {/* Modals */}
      {selectedCaseId && (
        <>
          <CaseDetailModal
            caseId={selectedCaseId}
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedCaseId(null);
              updateCaseIdParam(null);
            }}
            onStatusUpdate={handleStatusUpdate}
            onAssign={handleAssign}
          />

          <CaseStatusWorkflow
            caseId={selectedCaseId}
            currentStatus={selectedCase?.status || 'new'}
            isOpen={showStatusModal}
            onClose={() => {
              setShowStatusModal(false);
              setSelectedCaseId(null);
              updateCaseIdParam(null);
            }}
            onSuccess={handleSuccess}
          />

          <CaseAssignment
            caseId={selectedCaseId}
            currentAssignee={selectedCase?.assigned_to || null}
            isOpen={showAssignmentModal}
            onClose={() => {
              setShowAssignmentModal(false);
              setSelectedCaseId(null);
              updateCaseIdParam(null);
            }}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
}
