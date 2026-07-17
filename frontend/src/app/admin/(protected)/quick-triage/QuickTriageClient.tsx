'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FolderOpenIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { CMAGraphRequest, CMAGraphResponse } from '@/services/langGraphApi';
import { listCases } from '@/services/adminCaseApi';
import type { CaseListItem } from '@/types/admin/cases';
import { CaseCreationForm } from './components/CaseCreationForm';
import { SummaryCards } from './components/SummaryCards';
import { PriorityQueue } from './components/PriorityQueue';
import { useAdminSSE, useSSEEventHandler } from '@/contexts/AdminSSEContext';

interface CaseRecord {
  case_id: string;
  severity: string;
  status: string;
  sla_breach_at: string;
  assigned_to?: number;
  created_at: string;
}

function toCaseRecord(c: CaseListItem): CaseRecord {
  return {
    case_id: c.id,
    severity: c.severity,
    status: c.status,
    sla_breach_at: c.sla_breach_at || '',
    assigned_to: c.assigned_to ? Number(c.assigned_to) : undefined,
    created_at: c.created_at,
  };
}

export default function QuickTriageClient() {
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const { isConnected } = useAdminSSE();
  const fetchCasesRef = useRef<() => Promise<void>>(undefined);

  const fetchCases = useCallback(async () => {
    try {
      const data = await listCases({
        sort_by: 'sla_breach_at',
        sort_order: 'asc',
        page_size: 15,
        page: 1,
      });
      setCases(data.cases.map(toCaseRecord));
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    }
  }, []);

  fetchCasesRef.current = fetchCases;

  useEffect(() => {
    fetchCases().finally(() => setInitialLoading(false));
  }, [fetchCases]);

  useSSEEventHandler('case_created', useCallback((data: CaseRecord) => {
    if (data.severity === 'critical' || data.severity === 'high') {
      toast.success(`New ${data.severity.toUpperCase()} case created: ${data.case_id?.slice(0, 8) ?? ''}...`, {
        duration: 5000,
      });
    }
    fetchCasesRef.current?.();
  }, []));

  useSSEEventHandler('case_updated', useCallback(() => {
    fetchCasesRef.current?.();
  }, []));

  useSSEEventHandler('sla_breach', useCallback((data: CaseRecord) => {
    toast.error(`SLA BREACH: Case ${data.case_id?.slice(0, 8) ?? ''}...`, {
      duration: 8000,
    });
    fetchCasesRef.current?.();
  }, []));

  const handleCreateCase = useCallback<(request: CMAGraphRequest) => Promise<void>>(async (request) => {
    setLoading(true);
    try {
      const { langGraphApi } = await import('@/services/langGraphApi');
      const result: CMAGraphResponse = await langGraphApi.executeCMA(request);

      if (!result.success) {
        throw new Error(result.errors.join(', ') || 'Failed to create case');
      }

      toast.success(`Case created: ${result.case_id?.slice(0, 8) ?? ''}...`);
      await fetchCases();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to create case: ${errorMessage}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchCases]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FolderOpenIcon className="w-6 h-6 text-[#FFCA40]" />
              <h1 className="text-2xl font-bold text-white">Quick Triage</h1>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold rounded-full">
                REAL-TIME
              </span>
            </div>
            <p className="text-white/50 text-sm ml-9">
              Create cases via CMA with automatic SLA tracking
            </p>
            <a
              href="/admin/cases"
              className="ml-9 mt-2 text-[#FFCA40]/80 hover:text-[#FFCA40] text-xs flex items-center gap-1 transition-colors inline-flex"
            >
              View all cases
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-orange-500/10 border-orange-500/20 text-orange-300'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`} />
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {initialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <SummaryCards cases={cases} />
      )}

      {/* Case Creation Form */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FolderOpenIcon className="w-5 h-5 text-[#FFCA40]" />
            Create Case via CMA
          </h2>
          <p className="text-xs text-white/40 mt-0.5 ml-7">
            Auto SLA calculation and counselor assignment
          </p>
        </div>
        <div className="p-6">
          <CaseCreationForm onSubmit={handleCreateCase} loading={loading} />
        </div>
      </div>

      {/* Priority Queue */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-blue-400" />
              Priority Queue
            </h2>
            <p className="text-xs text-white/40 mt-0.5 ml-7">
              Active cases sorted by SLA urgency
            </p>
          </div>
          <button
            onClick={() => fetchCases()}
            className="px-3 py-1.5 text-[11px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="p-6">
          {initialLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <PriorityQueue cases={cases} />
          )}
        </div>
      </div>
    </div>
  );
}
