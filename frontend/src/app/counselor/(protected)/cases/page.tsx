'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiClock,
  FiUser,
  FiCheckCircle,
  FiEye,
  FiRefreshCw,
  FiAlertTriangle,
  FiMail,
  FiPhone,
  FiSend,
  FiSearch,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import apiClient from '@/services/api';

interface Case {
  id: string;
  user_hash: string;
  severity: 'low' | 'med' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'waiting' | 'closed' | 'resolved';
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  summary_redacted?: string;
  sla_breach_at?: string;
  user_email?: string;
  user_phone?: string;
  telegram_username?: string;
}

interface CaseAssessmentsResponse {
  case_id: string;
  session_id: string | null;
  user_hash: string;
  screening_profile: {
    overall_risk: string;
    requires_attention: boolean;
    primary_concerns: string[];
    protective_factors: string[];
    updated_at: string | null;
  } | null;
  triage_assessments: Array<{
    id: number;
    risk_score: number;
    confidence_score: number;
    severity_level: string;
    recommended_action: string | null;
    intent: string | null;
    next_step: string | null;
    risk_factors: string[] | null;
    diagnostic_notes_redacted: string | null;
    created_at: string | null;
  }>;
}

interface CaseStatusUpdateResponse {
  case_id: string;
  status: string;
  message: string;
  case_attestation?: {
    record_id: number;
    autopilot_action_id: number;
    schema: string;
    decision: 'accepted' | 'rejected';
    severity: string;
  };
}

interface CaseLatestAttestationResponse {
  found: boolean;
  record_id?: number;
  status?: string;
  schema?: string;
  attestation_type?: string;
  decision?: string;
  feedback_redacted?: string;
  tx_hash?: string;
  chain_id?: number;
  autopilot_action_id?: number;
  created_at?: string;
  processed_at?: string;
}

const severityColors = {
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  med: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const statusColors = {
  new: 'bg-purple-500/20 text-purple-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  waiting: 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-gray-500/20 text-gray-300',
};

const STATUS_PRIORITY: Record<Case['status'], number> = {
  in_progress: 0,
  waiting: 1,
  new: 2,
  resolved: 3,
  closed: 4,
};

const SEVERITY_PRIORITY: Record<Case['severity'], number> = {
  critical: 0,
  high: 1,
  med: 2,
  low: 3,
};

const SOURCE_LABELS: Record<string, string> = {
  header: 'Quick search',
  patients: 'Patients & Contacts',
  'patient-detail': 'Patient Detail',
  escalations: 'Escalations Queue',
  dashboard: 'Dashboard quick action',
};

const VALID_STATUS_FILTERS = new Set(['all', 'new', 'in_progress', 'waiting', 'closed', 'resolved']);
const VALID_SEVERITY_FILTERS = new Set(['all', 'low', 'med', 'high', 'critical']);

const resolveDefaultStatusFilter = (
  sourceParam: string | null,
  searchParam: string | null,
  highlightParam: string | null,
) => {
  if (searchParam || highlightParam) {
    return 'all';
  }

  if (sourceParam === 'patients' || sourceParam === 'patient-detail' || sourceParam === 'header') {
    return 'all';
  }

  return 'in_progress';
};

export default function CounselorCasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('in_progress');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightCaseId, setHighlightCaseId] = useState<string | null>(null);
  const [contextSource, setContextSource] = useState<string | null>(null);
  const [assessmentsByCaseId, setAssessmentsByCaseId] = useState<Record<string, CaseAssessmentsResponse | null>>({});
  const [loadingAssessments, setLoadingAssessments] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [actingCaseId, setActingCaseId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [lastAttestationMessage, setLastAttestationMessage] = useState<string | null>(null);
  const [latestAttestationByCaseId, setLatestAttestationByCaseId] = useState<Record<string, CaseLatestAttestationResponse | null>>({});
  const [loadingLatestAttestation, setLoadingLatestAttestation] = useState<string | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const severityParam = searchParams.get('severity');
    const searchParam = searchParams.get('search');
    const highlightParam = searchParams.get('highlight');
    const sourceParam = searchParams.get('source');
    const fallbackStatus = resolveDefaultStatusFilter(sourceParam, searchParam, highlightParam);

    setFilterStatus(statusParam && VALID_STATUS_FILTERS.has(statusParam) ? statusParam : fallbackStatus);
    setFilterSeverity(severityParam && VALID_SEVERITY_FILTERS.has(severityParam) ? severityParam : 'all');
    setSearchQuery(searchParam ?? '');
    setHighlightCaseId(highlightParam);
    setContextSource(sourceParam);
  }, [searchParams]);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ cases: Case[] }>('/counselor/cases');
      setCases(response.data.cases || []);
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError('Failed to load cases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const sortedCases = useMemo(
    () =>
      [...cases].sort((left, right) => {
        const statusGap = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
        if (statusGap !== 0) {
          return statusGap;
        }

        const severityGap = SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity];
        if (severityGap !== 0) {
          return severityGap;
        }

        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }),
    [cases],
  );

  const filteredCases = useMemo(() => sortedCases.filter((c) => {
    const statusMatch = filterStatus === 'all' || c.status === filterStatus;
    const severityMatch = filterSeverity === 'all' || c.severity === filterSeverity;
    const searchableText = [
      c.id,
      c.user_hash,
      c.summary_redacted,
      c.user_email,
      c.user_phone,
      c.telegram_username,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const searchMatch =
      normalizedSearchQuery.length === 0 || searchableText.includes(normalizedSearchQuery);

    return statusMatch && severityMatch && searchMatch;
  }), [filterSeverity, filterStatus, normalizedSearchQuery, sortedCases]);

  const queueCounts = useMemo(
    () => ({
      intake: cases.filter((caseItem) => caseItem.status === 'new').length,
      active: cases.filter((caseItem) => caseItem.status === 'in_progress').length,
      waiting: cases.filter((caseItem) => caseItem.status === 'waiting').length,
      closed: cases.filter((caseItem) => caseItem.status === 'closed' || caseItem.status === 'resolved').length,
      highRiskActive: cases.filter(
        (caseItem) =>
          ['new', 'in_progress', 'waiting'].includes(caseItem.status) &&
          ['critical', 'high'].includes(caseItem.severity),
      ).length,
    }),
    [cases],
  );

  const highlightedCaseVisible = useMemo(
    () => !!highlightCaseId && filteredCases.some((caseItem) => caseItem.id === highlightCaseId),
    [filteredCases, highlightCaseId],
  );

  useEffect(() => {
    if (!highlightedCaseVisible || loading) {
      return;
    }

    const timer = window.setTimeout(() => {
      highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [highlightedCaseVisible, loading]);

  const selectedCase = useMemo(
    () => (selectedCaseId ? cases.find((caseItem) => caseItem.id === selectedCaseId) ?? null : null),
    [cases, selectedCaseId],
  );

  const openCaseDetails = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setRejectNote('');
    setLastAttestationMessage(null);
    if (assessmentsByCaseId[caseId] !== undefined) return;

    setLoadingAssessments(caseId);
    try {
      const response = await apiClient.get<CaseAssessmentsResponse>(`/counselor/cases/${caseId}/assessments`);
      setAssessmentsByCaseId((prev) => ({ ...prev, [caseId]: response.data }));
    } catch (err) {
      console.error('Failed to load case assessments:', err);
      setAssessmentsByCaseId((prev) => ({ ...prev, [caseId]: null }));
    } finally {
      setLoadingAssessments(null);
    }
  };

  const loadLatestAttestation = async (caseId: string) => {
    setLoadingLatestAttestation(caseId);
    try {
      const response = await apiClient.get<CaseLatestAttestationResponse>(`/counselor/cases/${caseId}/latest-attestation`);
      setLatestAttestationByCaseId((prev) => ({ ...prev, [caseId]: response.data }));
    } catch (latestError) {
      console.error('Failed to load latest attestation:', latestError);
      setLatestAttestationByCaseId((prev) => ({ ...prev, [caseId]: null }));
    } finally {
      setLoadingLatestAttestation(null);
    }
  };

  const closeCaseDetails = () => {
    setSelectedCaseId(null);
    setRejectNote('');
    setLastAttestationMessage(null);
  };

  const isReceivable = (caseItem: Case) => ['new', 'waiting'].includes(caseItem.status);
  const isClosable = (caseItem: Case) => ['new', 'waiting', 'in_progress'].includes(caseItem.status);

  const updateCaseStatus = async (caseItem: Case, status: 'in_progress' | 'closed', note?: string) => {
    try {
      setActingCaseId(caseItem.id);
      const response = await apiClient.put<CaseStatusUpdateResponse>(`/counselor/cases/${caseItem.id}/status`, {
        status,
        note,
      });

      setCases((prev) => prev.map((existing) => (
        existing.id === caseItem.id
          ? { ...existing, status: response.data.status as Case['status'], updated_at: new Date().toISOString() }
          : existing
      )));

      await loadCases();
      toast.success(response.data.message || 'Case updated');

      if (response.data.case_attestation) {
        const info = response.data.case_attestation;
        setLastAttestationMessage(
          `Case attestation queued (${info.severity}): decision=${info.decision}, action #${info.autopilot_action_id}`,
        );
        await loadLatestAttestation(caseItem.id);
      }
    } catch (updateError) {
      console.error('Failed to update case status:', updateError);
      toast.error('Failed to update case status');
    } finally {
      setActingCaseId(null);
    }
  };

  const onAcceptCase = async () => {
    if (!selectedCase) return;
    await updateCaseStatus(selectedCase, 'in_progress', 'Accepted by counselor');
  };

  const onCloseCase = async () => {
    if (!selectedCase) return;
    const note = rejectNote.trim();
    if (!note) {
      toast.error('Closing a case requires justification');
      return;
    }
    await updateCaseStatus(selectedCase, 'closed', note);
  };

  const clearContext = () => {
    setSearchQuery('');
    setHighlightCaseId(null);
    setContextSource(null);
    setFilterStatus('in_progress');
    setFilterSeverity('all');
  };

  useEffect(() => {
    if (!selectedCaseId) return;
    if (latestAttestationByCaseId[selectedCaseId] !== undefined) return;
    loadLatestAttestation(selectedCaseId).catch(() => undefined);
  }, [latestAttestationByCaseId, selectedCaseId]);

  const normalizePhoneForWhatsApp = (phoneRaw: string) => {
    // wa.me expects digits only, ideally E.164 without plus.
    const digits = phoneRaw.replace(/\D/g, '');
    return digits;
  };

  const normalizeTelegramUsername = (usernameRaw: string) => {
    const trimmed = usernameRaw.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  };

  const openWhatsApp = (caseItem: Case) => {
    const phone = caseItem.user_phone;
    if (!phone) return;
    const waPhone = normalizePhoneForWhatsApp(phone);
    if (!waPhone) return;
    window.open(`https://wa.me/${encodeURIComponent(waPhone)}`, '_blank', 'noopener,noreferrer');
  };

  const openEmail = (caseItem: Case) => {
    const email = caseItem.user_email;
    if (!email) return;
    window.location.href = `mailto:${encodeURIComponent(email)}`;
  };

  const openTelegram = (caseItem: Case) => {
    const username = caseItem.telegram_username;
    if (!username) return;
    const normalized = normalizeTelegramUsername(username);
    if (!normalized) return;
    window.open(`https://t.me/${encodeURIComponent(normalized)}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40] mb-4"></div>
          <p className="text-white/70">Loading cases...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <FiAlertTriangle className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-red-300 font-semibold mb-2">Failed to load cases</p>
          <p className="text-red-300/70 text-sm mb-4">{error}</p>
          <button
            onClick={loadCases}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-300 transition-all flex items-center gap-2 mx-auto"
          >
            <FiRefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Cases</h1>
          <p className="text-white/60">Owned work queue for accepted cases; new intake is handled in Escalations</p>
        </div>
        <div className="w-full md:w-auto flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg min-w-65">
            <FiSearch className="w-4 h-4 text-white/60" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case ID, session ID, patient hash, summary"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
              aria-label="Search cases"
            />
          </div>
          <button
            onClick={() => { loadCases(); }}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm text-white transition-all flex items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
            title="Filter by severity level"
          >
            <option value="all" className="bg-[#001d58]">All Severities</option>
            <option value="critical" className="bg-[#001d58]">Critical</option>
            <option value="high" className="bg-[#001d58]">High</option>
            <option value="med" className="bg-[#001d58]">Moderate</option>
            <option value="low" className="bg-[#001d58]">Low</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
            title="Filter by case status"
          >
            <option value="all" className="bg-[#001d58]">All Status</option>
            <option value="new" className="bg-[#001d58]">New</option>
            <option value="in_progress" className="bg-[#001d58]">In Progress</option>
            <option value="waiting" className="bg-[#001d58]">Waiting</option>
            <option value="resolved" className="bg-[#001d58]">Resolved</option>
            <option value="closed" className="bg-[#001d58]">Closed</option>
          </select>
        </div>
      </div>

      {(contextSource || highlightCaseId) && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-[#FFCA40]/30 bg-[#FFCA40]/10 p-3">
          <div className="text-sm text-[#FFE9A6]">
            Arrived from {SOURCE_LABELS[contextSource || ''] || 'another workspace'}
            {highlightCaseId && (
              <span className="text-white/80">. Highlighting case #{highlightCaseId.substring(0, 8)}.</span>
            )}
          </div>
          <button
            onClick={clearContext}
            className="self-start md:self-auto px-3 py-1.5 text-xs font-medium rounded-md border border-white/20 text-white/80 hover:bg-white/10"
          >
            Clear context
          </button>
        </div>
      )}

      {queueCounts.intake > 0 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 p-3">
          <p className="text-sm text-orange-100">
            {queueCounts.intake} intake case{queueCounts.intake === 1 ? '' : 's'} still marked as new. Accept them from Escalations to keep ownership explicit.
          </p>
          <button
            onClick={() => router.push('/counselor/escalations')}
            className="self-start md:self-auto px-3 py-1.5 text-xs font-medium rounded-md border border-orange-300/40 text-orange-100 hover:bg-orange-400/10"
          >
            Open Escalations
          </button>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{queueCounts.active}</div>
          <div className="text-xs text-white/60 mt-1">Active Handling</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{queueCounts.waiting}</div>
          <div className="text-xs text-white/60 mt-1">Waiting Follow-up</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{queueCounts.highRiskActive}</div>
          <div className="text-xs text-white/60 mt-1">High Risk Active</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{queueCounts.closed}</div>
          <div className="text-xs text-white/60 mt-1">Closed Cases</div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Case ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Summary
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  SLA Breach
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FiCheckCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/60">No cases found</p>
                    <p className="text-white/40 text-sm mt-1">
                      {searchQuery || filterStatus !== 'all' || filterSeverity !== 'all'
                        ? 'Try adjusting search or filters'
                        : 'Cases assigned to you will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCases.map((caseItem) => {
                  const isHighlighted = highlightCaseId === caseItem.id;

                  return (
                    <tr
                      key={caseItem.id}
                      ref={isHighlighted ? highlightedRowRef : null}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-[#FFCA40]/15 ring-1 ring-inset ring-[#FFCA40]/50'
                          : 'hover:bg-white/5'
                      }`}
                    >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-white/90">{caseItem.id.substring(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FiUser className="w-3 h-3 text-white/40" />
                        <span className="text-xs font-mono text-white/70">{caseItem.user_hash.substring(0, 12)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${severityColors[caseItem.severity]}`}>
                        {caseItem.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[caseItem.status]}`}>
                        {caseItem.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <p className="text-sm text-white/80 line-clamp-2">{caseItem.summary_redacted || 'No summary available'}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {caseItem.sla_breach_at ? (
                        <div className="flex items-center gap-1.5 text-xs text-orange-400">
                          <FiClock className="w-3 h-3" />
                          {formatDate(caseItem.sla_breach_at)}
                        </div>
                      ) : (
                        <span className="text-xs text-white/40">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-white/60">
                        <FiClock className="w-3 h-3" />
                        {formatDate(caseItem.updated_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openWhatsApp(caseItem)}
                          disabled={!caseItem.user_phone}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/70 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title={caseItem.user_phone ? 'Contact via WhatsApp' : 'No phone number on file'}
                        >
                          <FiPhone className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => openEmail(caseItem)}
                          disabled={!caseItem.user_email}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/70 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title={caseItem.user_email ? 'Contact via Email' : 'No email on file'}
                        >
                          <FiMail className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => openTelegram(caseItem)}
                          disabled={!caseItem.telegram_username}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/70 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title={caseItem.telegram_username ? 'Contact via Telegram' : 'No Telegram username on file'}
                        >
                          <FiSend className="w-3 h-3" />
                        </button>
                        {isReceivable(caseItem) && (
                          <button
                            onClick={() => updateCaseStatus(caseItem, 'in_progress', 'Accepted from case list')}
                            disabled={actingCaseId === caseItem.id}
                            className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded text-xs font-medium text-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Accept
                          </button>
                        )}
                        <button
                          onClick={() => openCaseDetails(caseItem.id)}
                          className="px-3 py-1 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded text-xs font-medium text-[#FFCA40] transition-all flex items-center gap-1"
                          title="View risk assessment transparency"
                        >
                          <FiEye className="w-3 h-3" />
                          {caseItem.status === 'in_progress' || caseItem.status === 'waiting' ? 'Resume' : 'View'}
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[#001A4D] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Case Details</h2>
                <p className="mt-1 text-sm text-white/60">Case #{selectedCase.id.substring(0, 8)} · {selectedCase.status.replace('_', ' ')}</p>
              </div>
              <button
                onClick={closeCaseDetails}
                className="rounded-lg border border-white/20 p-2 text-white/70 hover:text-white"
                aria-label="Close case details"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-180px)] overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Severity</div>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${severityColors[selectedCase.severity]}`}>
                      {selectedCase.severity}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Patient Hash</div>
                  <div className="mt-1 text-xs font-mono text-white/80">{selectedCase.user_hash}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Updated</div>
                  <div className="mt-1 text-sm text-white/80">{formatDate(selectedCase.updated_at)}</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-xs text-white/60 mb-2">Case summary (redacted)</div>
                <div className="text-sm text-white/80 whitespace-pre-wrap">
                  {selectedCase.summary_redacted || 'No summary available.'}
                </div>
              </div>

              {loadingAssessments === selectedCase.id ? (
                <div className="text-sm text-white/60 flex items-center gap-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#FFCA40]"></div>
                  Loading risk assessment…
                </div>
              ) : assessmentsByCaseId[selectedCase.id] ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/60 mb-2">Screening profile (aggregated)</div>
                    {assessmentsByCaseId[selectedCase.id]?.screening_profile ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/70">Overall risk</span>
                          <span className="text-sm font-semibold text-white">
                            {assessmentsByCaseId[selectedCase.id]?.screening_profile?.overall_risk}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/70">Requires attention</span>
                          <span className="text-sm text-white">
                            {assessmentsByCaseId[selectedCase.id]?.screening_profile?.requires_attention ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="text-sm text-white/70">
                          <div className="text-xs text-white/50">Primary concerns</div>
                          <div className="text-white/80">
                            {(assessmentsByCaseId[selectedCase.id]?.screening_profile?.primary_concerns || []).slice(0, 6).join(', ') || '—'}
                          </div>
                        </div>
                        <div className="text-sm text-white/70">
                          <div className="text-xs text-white/50">Protective factors</div>
                          <div className="text-white/80">
                            {(assessmentsByCaseId[selectedCase.id]?.screening_profile?.protective_factors || []).slice(0, 6).join(', ') || '—'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">No screening profile found.</div>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/60 mb-2">Recent triage assessments (STA)</div>
                    {(assessmentsByCaseId[selectedCase.id]?.triage_assessments || []).length === 0 ? (
                      <div className="text-sm text-white/60">No triage assessments available.</div>
                    ) : (
                      <div className="space-y-3">
                        {assessmentsByCaseId[selectedCase.id]?.triage_assessments.slice(0, 3).map((triage) => (
                          <div key={triage.id} className="bg-black/20 border border-white/10 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm text-white font-semibold">
                                {triage.severity_level} (score {triage.risk_score.toFixed(2)})
                              </div>
                              <div className="text-xs text-white/50">
                                {triage.created_at ? formatDate(triage.created_at) : ''}
                              </div>
                            </div>
                            <div className="text-xs text-white/60 mt-1">
                              intent: {triage.intent || '—'} | next: {triage.next_step || '—'} | action: {triage.recommended_action || '—'}
                            </div>
                            <div className="text-xs text-white/60 mt-2">
                              factors: {(triage.risk_factors || []).slice(0, 4).join(' | ') || '—'}
                            </div>
                            {triage.diagnostic_notes_redacted && (
                              <div className="text-xs text-white/60 mt-2">
                                notes: <span className="text-white/80">{triage.diagnostic_notes_redacted}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-300">Failed to load risk assessment details.</div>
              )}

              {lastAttestationMessage && (
                <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  {lastAttestationMessage}
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-white">Latest Linked Attestation</h3>
                {loadingLatestAttestation === selectedCase.id ? (
                  <p className="mt-2 text-xs text-white/60">Loading attestation details...</p>
                ) : (() => {
                  const latest = latestAttestationByCaseId[selectedCase.id];
                  if (!latest?.found) {
                    return <p className="mt-2 text-xs text-white/60">No linked attestation yet for this case.</p>;
                  }
                  return (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-white/80">
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p>Record ID: <span className="text-white">{latest.record_id ?? '-'}</span></p>
                        <p className="mt-1">Status: <span className="text-white">{latest.status ?? '-'}</span></p>
                        <p className="mt-1">Schema: <span className="text-white">{latest.schema ?? '-'}</span></p>
                        <p className="mt-1">Type: <span className="text-white">{latest.attestation_type ?? '-'}</span></p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p>Decision: <span className="text-white">{latest.decision ?? '-'}</span></p>
                        <p className="mt-1">Autopilot Action: <span className="text-white">{latest.autopilot_action_id ?? '-'}</span></p>
                        <p className="mt-1">Chain ID: <span className="text-white">{latest.chain_id ?? '-'}</span></p>
                        <p className="mt-1">Tx Hash: <span className="text-white break-all">{latest.tx_hash ?? '-'}</span></p>
                      </div>
                      {latest.feedback_redacted && (
                        <div className="md:col-span-2 rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-white/60">Feedback (redacted)</p>
                          <p className="mt-1 text-white/80 whitespace-pre-wrap">{latest.feedback_redacted}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {isClosable(selectedCase) && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Decision</h3>
                  <p className="text-xs text-white/60">
                    {isReceivable(selectedCase)
                      ? 'Accept receives this case into active handling. Close requires justification and ends counselor ownership.'
                      : 'Close requires justification and ends active counselor ownership for this case.'}
                  </p>
                  <textarea
                    value={rejectNote}
                    onChange={(event) => setRejectNote(event.target.value)}
                    rows={3}
                    placeholder="Required if rejecting this case"
                    className="w-full rounded-lg border border-white/20 bg-[#001D58] px-3 py-2 text-sm text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    {isReceivable(selectedCase) && (
                      <button
                        onClick={onAcceptCase}
                        disabled={actingCaseId === selectedCase.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FiCheckCircle className="h-4 w-4" /> Accept Case
                      </button>
                    )}
                    <button
                      onClick={onCloseCase}
                      disabled={actingCaseId === selectedCase.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiXCircle className="h-4 w-4" /> Close Case
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
