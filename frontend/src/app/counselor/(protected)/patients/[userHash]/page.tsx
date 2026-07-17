'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiSend,
  FiAlertTriangle,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiTarget,
  FiFileText,
  FiCalendar,
  FiMapPin,
  FiVideo,
  FiEye,
} from 'react-icons/fi';
import apiClient from '@/services/api';

// Interfaces based on actual pages
interface CaseItem {
  id: string;
  user_hash: string;
  severity: 'low' | 'med' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'waiting' | 'closed' | 'resolved';
  created_at: string;
  updated_at: string;
  summary_redacted?: string;
  user_email?: string;
  user_phone?: string;
  telegram_username?: string;
}

interface CaseNote {
  id: number;
  case_id: string;
  user_hash?: string;
  note: string;
  author_id: number | null;
  created_at: string;
}

interface PlanStep {
  title: string;
  description?: string;
  completed?: boolean;
}

interface TreatmentPlan {
  id: number;
  user_id: number;
  user_email?: string;
  plan_title: string;
  risk_level?: number;
  status: string;
  is_active: boolean;
  total_steps: number;
  completed_steps: number;
  plan_steps: PlanStep[];
  created_at: string;
  updated_at: string;
}

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type AppointmentType = 'in_person' | 'video_call' | 'phone_call';

interface BackendAppointmentType {
  name: string;
  duration_minutes: number;
}

interface BackendAppointmentUser {
  id?: number;
  email?: string | null;
  name?: string | null;
}

interface BackendAppointment {
  id: number;
  user_id: number;
  appointment_datetime: string;
  status: string;
  notes?: string | null;
  appointment_type?: BackendAppointmentType;
  user?: BackendAppointmentUser;
}

interface Appointment {
  appointment_id: string;
  date: string;
  time: string;
  duration_minutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
}

// Patient profile derived from cases
interface PatientProfile {
  user_hash: string;
  user_email?: string;
  user_phone?: string;
  telegram_username?: string;
  status: 'active' | 'inactive' | 'discharged';
  highest_severity: string;
  total_cases: number;
  active_cases: number;
  first_seen: string | null;
}

interface PatientIdentityScope {
  trustedEmails: string[];
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  med: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const caseStatusColors: Record<string, string> = {
  new: 'bg-purple-500/20 text-purple-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  waiting: 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-gray-500/20 text-gray-300',
};

const patientStatusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  discharged: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

const planStatusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  archived: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  expired: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const aptStatusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  no_show: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const aptTypeIcons = {
  in_person: FiMapPin,
  video_call: FiVideo,
  phone_call: FiClock,
};

type TabId = 'cases' | 'notes' | 'plans' | 'appointments';

type ScopeNoticeTone = 'neutral' | 'warning';

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
      <FiAlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p className="text-red-300 text-sm">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((index) => (
        <div
          key={index}
          className="h-24 bg-white/5 animate-pulse rounded-xl border border-white/5"
        ></div>
      ))}
    </div>
  );
}

function ScopeNotice({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: ScopeNoticeTone;
}) {
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-xs ${
        tone === 'warning'
          ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
          : 'border-white/10 bg-white/5 text-white/65'
      }`}
    >
      {message}
    </div>
  );
}

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawHash = Array.isArray(params.userHash) ? params.userHash[0] : params.userHash;
  const patientHash = rawHash ? decodeURIComponent(rawHash) : '';

  const [activeTab, setActiveTab] = useState<TabId>('cases');

  const [casesState, setCasesState] = useState<{ loading: boolean; error: string | null; data: CaseItem[] }>({ loading: true, error: null, data: [] });
  const [notesState, setNotesState] = useState<{ loading: boolean; error: string | null; data: CaseNote[] }>({ loading: true, error: null, data: [] });
  const [plansState, setPlansState] = useState<{ loading: boolean; error: string | null; data: TreatmentPlan[] }>({ loading: true, error: null, data: [] });
  const [aptsState, setAptsState] = useState<{ loading: boolean; error: string | null; data: Appointment[] }>({ loading: true, error: null, data: [] });
  const [identityScope, setIdentityScope] = useState<PatientIdentityScope>({ trustedEmails: [] });

  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  useEffect(() => {
    if (!patientHash) return;

    let mounted = true;

    async function loadAllData() {
      // Use Promise.allSettled to fetch in parallel without failing fast
      const [casesRes, notesRes, plansRes, aptsRes] = await Promise.allSettled([
        apiClient.get('/counselor/cases'),
        apiClient.get('/counselor/notes'),
        apiClient.get('/counselor/treatment-plans'),
        apiClient.get('/counselor/appointments')
      ]);

      if (!mounted) return;

      // 1. Process Cases
      let patientCases: CaseItem[] = [];
      let trustedEmailSet = new Set<string>();

      if (casesRes.status === 'fulfilled') {
        const allCases: CaseItem[] = casesRes.value.data?.cases ?? casesRes.value.data ?? [];
        patientCases = allCases.filter(c => c.user_hash === patientHash);
        trustedEmailSet = new Set(
          patientCases
            .map((caseItem) => caseItem.user_email?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email))
        );
        setIdentityScope({ trustedEmails: Array.from(trustedEmailSet) });
        
        // Derive patient profile
        if (patientCases.length > 0) {
          const sorted = [...patientCases].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const latest = [...patientCases].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
          
          const activeCases = patientCases.filter(c => ['new', 'in_progress', 'waiting'].includes(c.status));
          const closedCases = patientCases.filter(c => ['closed', 'resolved'].includes(c.status));
          
          let status: PatientProfile['status'] = 'active';
          if (activeCases.length === 0 && closedCases.length > 0) status = 'discharged';
          else if (activeCases.length === 0) status = 'inactive';

          const severityRank: Record<string, number> = { critical: 4, high: 3, med: 2, low: 1 };
          const relevantCases = activeCases.length > 0 ? activeCases : patientCases;
          const highestSev = relevantCases.reduce((max, c) => ((severityRank[c.severity] || 0) > (severityRank[max] || 0) ? c.severity : max), 'low');

          setPatientProfile({
            user_hash: patientHash,
            user_email: latest.user_email,
            user_phone: latest.user_phone,
            telegram_username: latest.telegram_username,
            status,
            highest_severity: highestSev,
            total_cases: patientCases.length,
            active_cases: activeCases.length,
            first_seen: sorted[0].created_at
          });
        } else {
          setPatientProfile({
            user_hash: patientHash,
            status: 'inactive',
            highest_severity: 'low',
            total_cases: 0,
            active_cases: 0,
            first_seen: null
          });
        }
        setCasesState({ loading: false, error: null, data: patientCases });
      } else {
        setIdentityScope({ trustedEmails: [] });
        setCasesState({ loading: false, error: 'Failed to load cases', data: [] });
      }

      // 2. Process Notes
      if (notesRes.status === 'fulfilled') {
        const allNotes: CaseNote[] = notesRes.value.data?.items ?? [];
        // Only notes that belong to one of the patient's cases
        const caseIds = new Set(patientCases.map(c => c.id));
        const filteredNotes = allNotes.filter(n => caseIds.has(n.case_id));
        setNotesState({ loading: false, error: null, data: filteredNotes });
      } else {
        setNotesState({ loading: false, error: 'Failed to load notes', data: [] });
      }

      // 3. Process Treatment Plans
      if (plansRes.status === 'fulfilled') {
        const allPlans: TreatmentPlan[] = plansRes.value.data?.items ?? [];
        const filteredPlans = allPlans.filter((plan) => {
          const planEmail = plan.user_email?.trim().toLowerCase();
          return Boolean(planEmail) && trustedEmailSet.has(planEmail as string);
        });
        setPlansState({ loading: false, error: null, data: filteredPlans });
      } else {
        setPlansState({ loading: false, error: 'Failed to load treatment plans', data: [] });
      }

      // 4. Process Appointments
      if (aptsRes.status === 'fulfilled') {
        const allApts: BackendAppointment[] = aptsRes.value.data ?? [];
        const patientApts = allApts.filter((appointment) => {
          const appointmentEmail = appointment.user?.email?.trim().toLowerCase();
          return Boolean(appointmentEmail) && trustedEmailSet.has(appointmentEmail as string);
        });

        const mappedApts: Appointment[] = patientApts.map(apt => {
          const dt = new Date(apt.appointment_datetime);
          
          const typeStr = (apt.appointment_type?.name || '').toLowerCase();
          let type: AppointmentType = 'in_person';
          if (typeStr.includes('video') || typeStr.includes('online')) type = 'video_call';
          else if (typeStr.includes('phone') || typeStr.includes('call')) type = 'phone_call';

          let status: AppointmentStatus = 'scheduled';
          if (['scheduled', 'completed', 'cancelled', 'no_show'].includes(apt.status)) {
            status = apt.status as AppointmentStatus;
          }

          return {
            appointment_id: String(apt.id),
            date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
            time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
            duration_minutes: apt.appointment_type?.duration_minutes ?? 60,
            type,
            status,
            notes: apt.notes || undefined,
          };
        });
        setAptsState({ loading: false, error: null, data: mappedApts });
      } else {
        setAptsState({ loading: false, error: 'Failed to load appointments', data: [] });
      }
    }

    loadAllData();

    return () => { mounted = false; };
  }, [patientHash]);

  const formatDate = (ds: string | null | undefined) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (ds: string | null | undefined) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const hasTrustedEmailIdentity = identityScope.trustedEmails.length > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to Patients
      </button>

      {/* Header Profile Card */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 md:p-8">
        {!patientProfile && casesState.loading ? (
          <div className="flex items-start gap-6 animate-pulse">
            <div className="w-20 h-20 rounded-full bg-white/10"></div>
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-white/10 rounded w-1/3"></div>
              <div className="h-4 bg-white/10 rounded w-1/4"></div>
              <div className="flex gap-4 mt-4">
                <div className="h-6 w-16 bg-white/10 rounded-full"></div>
                <div className="h-6 w-16 bg-white/10 rounded-full"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-[#FFCA40]/20 flex items-center justify-center shrink-0 border border-[#FFCA40]/30">
              <span className="text-3xl text-[#FFCA40] font-semibold">
                {patientProfile?.user_email 
                  ? patientProfile.user_email.charAt(0).toUpperCase() 
                  : patientProfile?.user_hash?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">
                  {patientProfile?.user_email || 'Anonymous Patient'}
                </h1>
                {patientProfile && (
                  <>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${patientStatusColors[patientProfile.status]}`}>
                      {patientProfile.status.toUpperCase()}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${severityColors[patientProfile.highest_severity]}`}>
                      {patientProfile.highest_severity.toUpperCase()} RISK
                    </span>
                  </>
                )}
              </div>
              
              <div className="text-sm text-white/50 font-mono mb-4 flex items-center gap-2">
                <FiUser className="w-3.5 h-3.5" />
                {patientHash}
              </div>

              {/* Stats & Contacts row */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-4 text-sm text-white/70">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{patientProfile?.total_cases || 0}</span> Total Cases
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#FFCA40]">{patientProfile?.active_cases || 0}</span> Active
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20"></div>
                  <div className="flex items-center gap-1.5">
                    First Seen: {formatDate(patientProfile?.first_seen)}
                  </div>
                </div>

                <div className="h-6 w-px bg-white/10 hidden md:block"></div>

                <div className="flex items-center gap-2">
                  {patientProfile?.user_email && (
                    <a href={`mailto:${patientProfile.user_email}`} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all" title="Email">
                      <FiMail className="w-4 h-4" />
                    </a>
                  )}
                  {patientProfile?.user_phone && (
                    <a href={`https://wa.me/${patientProfile.user_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all" title="WhatsApp">
                      <FiPhone className="w-4 h-4" />
                    </a>
                  )}
                  {patientProfile?.telegram_username && (
                    <a href={`https://t.me/${patientProfile.telegram_username.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all" title="Telegram">
                      <FiSend className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-1 border-b border-white/10 overflow-x-auto no-scrollbar">
        {[
          { id: 'cases', label: 'Cases', count: casesState.data.length },
          { id: 'notes', label: 'Notes', count: notesState.data.length },
          { id: 'plans', label: 'Treatment Plans', count: plansState.data.length },
          { id: 'appointments', label: 'Appointments', count: aptsState.data.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#FFCA40] text-[#FFCA40]'
                : 'border-transparent text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-[#FFCA40]/20 text-[#FFCA40]' : 'bg-white/10 text-white/60'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="min-h-100">
        {/* CASES TAB */}
        {activeTab === 'cases' && (
          <div className="animate-in fade-in duration-300">
            <ScopeNotice message="Source: counselor-assigned cases where user_hash matches the selected patient." />
            {casesState.loading ? <LoadingState /> : casesState.error ? <ErrorState message={casesState.error} /> : (
              casesState.data.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                  <FiAlertTriangle className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60">No cases found for this patient.</p>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Case ID</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase">Severity</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Summary</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Created</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-white/70 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {casesState.data.map(c => (
                          <tr key={c.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-4 text-sm font-mono text-white/90">{c.id.substring(0, 8)}...</td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${severityColors[c.severity]}`}>
                                {c.severity.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${caseStatusColors[c.status]}`}>
                                {c.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-4 max-w-xs">
                              <p className="text-sm text-white/80 line-clamp-2">{c.summary_redacted || 'No summary available'}</p>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-white/60">{formatDate(c.created_at)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <button 
                                onClick={() => {
                                  const params = new URLSearchParams({
                                    search: c.id,
                                    highlight: c.id,
                                    status: c.status,
                                    source: 'patient-detail',
                                  });
                                  router.push(`/counselor/cases?${params.toString()}`);
                                }}
                                className="px-3 py-1 bg-[#FFCA40]/10 hover:bg-[#FFCA40]/20 border border-[#FFCA40]/30 rounded text-xs font-medium text-[#FFCA40] transition-all flex items-center gap-1.5 ml-auto"
                              >
                                <FiEye className="w-3 h-3" /> View in Cases
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="animate-in fade-in duration-300">
            <ScopeNotice message="Source: notes linked to this patient’s case IDs only." />
            {notesState.loading ? <LoadingState /> : notesState.error ? <ErrorState message={notesState.error} /> : (
              notesState.data.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                  <FiFileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60 mb-2">No notes for this patient yet.</p>
                  <button onClick={() => router.push('/counselor/notes')} className="text-sm text-[#FFCA40] hover:underline">
                    Add notes from the Notes page
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {notesState.data.map(note => (
                    <div key={note.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-mono text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          Case: {note.case_id.substring(0, 8)}...
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <FiClock className="w-3 h-3" />
                          {formatDateTime(note.created_at)}
                        </div>
                      </div>
                      <div className="bg-[#00153A] rounded-lg p-4 border border-white/5">
                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{note.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* PLANS TAB */}
        {activeTab === 'plans' && (
          <div className="animate-in fade-in duration-300">
            <ScopeNotice
              tone={hasTrustedEmailIdentity ? 'neutral' : 'warning'}
              message={
                hasTrustedEmailIdentity
                  ? 'Source: treatment plans matched by verified patient email derived from assigned cases.'
                  : 'Unavailable: no verified patient email from assigned cases, so treatment plans are intentionally hidden to prevent cross-patient leakage.'
              }
            />
            {plansState.loading ? <LoadingState /> : plansState.error ? <ErrorState message={plansState.error} /> : (
              plansState.data.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                  <FiTarget className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60">
                    {hasTrustedEmailIdentity
                      ? 'No treatment plans found for this patient.'
                      : 'Treatment plans are unavailable until this patient has a verified email in an assigned case record.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {plansState.data.map(plan => {
                    const progressPct = plan.total_steps > 0 ? Math.round((plan.completed_steps / plan.total_steps) * 100) : 0;
                    return (
                      <div key={plan.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-base font-semibold text-white">{plan.plan_title}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${planStatusColors[plan.status] || 'bg-gray-500/20 text-gray-300'}`}>
                                {plan.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-xs text-white/50 flex items-center gap-4">
                              <span className="flex items-center gap-1.5"><FiClock className="w-3 h-3"/> Created: {formatDate(plan.created_at)}</span>
                              <span className="flex items-center gap-1.5"><FiClock className="w-3 h-3"/> Updated: {formatDate(plan.updated_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4 bg-black/20 p-4 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/60">Progress ({plan.completed_steps}/{plan.total_steps} steps)</span>
                            <span className="text-xs font-medium text-[#FFCA40]">{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-linear-to-r from-[#FFCA40] to-[#FFD55C] transition-all" style={{ width: `${progressPct}%` }}></div>
                          </div>
                        </div>

                        {plan.plan_steps && plan.plan_steps.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Plan Steps</p>
                            <ul className="space-y-2">
                              {plan.plan_steps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 text-sm">
                                  <FiCheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${step.completed ? 'text-green-400' : 'text-white/20'}`} />
                                  <div className={step.completed ? 'text-white/40 line-through' : 'text-white/80'}>
                                    {step.title}
                                    {step.description && !step.completed && <p className="text-xs text-white/50 mt-1">{step.description}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'appointments' && (
          <div className="animate-in fade-in duration-300">
            <ScopeNotice
              tone={hasTrustedEmailIdentity ? 'neutral' : 'warning'}
              message={
                hasTrustedEmailIdentity
                  ? 'Source: appointments matched by verified patient email from counselor-owned records.'
                  : 'Unavailable: no verified patient email from assigned cases, so appointments are intentionally hidden to avoid wrong-patient display.'
              }
            />
            {aptsState.loading ? <LoadingState /> : aptsState.error ? <ErrorState message={aptsState.error} /> : (
              aptsState.data.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                  <FiCalendar className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60">
                    {hasTrustedEmailIdentity
                      ? 'No appointments scheduled.'
                      : 'Appointments are unavailable until this patient has a verified email in an assigned case record.'}
                  </p>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Date / Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Type</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {aptsState.data.map(apt => {
                        const TypeIcon = aptTypeIcons[apt.type] || FiMapPin;
                        return (
                          <tr key={apt.appointment_id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">{formatDate(apt.date)}</div>
                              <div className="text-xs text-white/50 mt-0.5">{apt.time}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-sm text-white/80">
                                <TypeIcon className="w-4 h-4 text-[#FFCA40]" />
                                <span className="capitalize">{apt.type.replace('_', ' ')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${aptStatusColors[apt.status] || 'bg-gray-500/20 text-gray-300'}`}>
                                {apt.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-white/70">
                              {apt.duration_minutes}m
                            </td>
                            <td className="px-4 py-4 max-w-50">
                              <p className="text-sm text-white/60 truncate">{apt.notes || '—'}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
