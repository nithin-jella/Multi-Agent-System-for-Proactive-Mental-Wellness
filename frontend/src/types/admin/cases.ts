/**
 * Admin Case Management Types
 * Corresponds to backend schemas in app/schemas/admin/cases.py
 */

// === Case Enums ===
export type CaseStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type CaseSeverity = 'low' | 'med' | 'high' | 'critical';
export type SLAStatus = 'safe' | 'warning' | 'critical' | 'breached';

// === Triage Assessment ===
export interface TriageAssessmentSummary {
  id: number;
  risk_score: number;
  severity_level: string;
  confidence_score: number | null;
  risk_factors: string[] | null;
  created_at: string;
}

// === Case Assignment ===
export interface CaseAssignmentSummary {
  id: string; // UUID
  assigned_to: string | null;
  assigned_by: number | null;
  assigned_at: string;
  previous_assignee: string | null;
  reassignment_reason: string | null;
  assignee_role: string | null;
}

// === Case List Item ===
export interface CaseListItem {
  // Base case fields
  id: string;
  status: CaseStatus;
  severity: CaseSeverity;
  user_hash: string;
  session_id: string | null;
  conversation_id: string | null;
  summary_redacted: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  sla_breach_at: string | null;

  // Computed SLA fields
  is_sla_breached: boolean;
  minutes_until_breach: number | null;
  sla_status: SLAStatus;

  // Related counts
  notes_count: number;
  assignments_count: number;

  // Latest triage
  latest_triage: TriageAssessmentSummary | null;
}

// === Case List Response ===
export interface CaseListResponse {
  cases: CaseListItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

// === Case Note ===
export interface CaseNoteItem {
  id: number;
  case_id: string;
  note: string;
  created_at: string;
  author_id: number | null;
}

// === Conversation Message ===
export interface ConversationMessageSummary {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

// === Case Detail Response ===
export interface CaseDetailResponse {
  // Base case fields
  id: string;
  status: CaseStatus;
  severity: CaseSeverity;
  user_hash: string;
  session_id: string | null;
  conversation_id: string | null;
  summary_redacted: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  sla_breach_at: string | null;

  // Computed SLA fields
  is_sla_breached: boolean;
  minutes_until_breach: number | null;
  sla_status: SLAStatus;

  // Related data
  notes: CaseNoteItem[];
  assignments: CaseAssignmentSummary[];
  triage_assessments: TriageAssessmentSummary[];
  conversation_preview: ConversationMessageSummary[] | null;
}

// === Request Payloads ===
export interface CaseStatusUpdate {
  status: CaseStatus;
  note?: string;
}

export interface CaseAssignmentUpdate {
  assigned_to: string | null;
  reason?: string;
}

export interface CaseNoteCreate {
  note: string;
}

// === Filter & Pagination ===
export interface CaseFilters {
  status?: CaseStatus;
  severity?: CaseSeverity;
  assigned_to?: string;
  unassigned?: boolean;
  sla_breached?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'updated_at' | 'severity' | 'sla_breach_at';
  sort_order?: 'asc' | 'desc';
}

// === Conversation Response ===
export interface CaseConversationResponse {
  case_id: string;
  conversation_id: string;
  messages: ConversationMessageSummary[];
  total_messages: number;
  conversation_created_at: string | null;
}
