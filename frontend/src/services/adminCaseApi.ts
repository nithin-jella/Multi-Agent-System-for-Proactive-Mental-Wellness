/**
 * Admin Case Management API Service
 * Handles all case-related API calls
 */

import apiClient from './api';
import type {
  CaseListResponse,
  CaseDetailResponse,
  CaseFilters,
  CaseStatusUpdate,
  CaseAssignmentUpdate,
  CaseNoteCreate,
  CaseNoteItem,
  CaseConversationResponse,
} from '@/types/admin/cases';

const BASE_PATH = '/admin/cases';

/**
 * List cases with filtering, pagination, and sorting
 */
export const listCases = async (filters: CaseFilters = {}): Promise<CaseListResponse> => {
  const params = new URLSearchParams();

  // Add filters
  if (filters.status) params.append('status', filters.status);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
  if (filters.unassigned !== undefined) params.append('unassigned', String(filters.unassigned));
  if (filters.sla_breached !== undefined) params.append('sla_breached', String(filters.sla_breached));
  if (filters.search) params.append('search', filters.search);

  // Add pagination
  if (filters.page) params.append('page', String(filters.page));
  if (filters.page_size) params.append('page_size', String(filters.page_size));

  // Add sorting
  if (filters.sort_by) params.append('sort_by', filters.sort_by);
  if (filters.sort_order) params.append('sort_order', filters.sort_order);

  const response = await apiClient.get<CaseListResponse>(`${BASE_PATH}?${params.toString()}`);
  return response.data;
};

/**
 * Get detailed case information
 */
export const getCaseDetail = async (caseId: string): Promise<CaseDetailResponse> => {
  const response = await apiClient.get<CaseDetailResponse>(`${BASE_PATH}/${caseId}`);
  return response.data;
};

/**
 * Update case status with optional note
 */
export const updateCaseStatus = async (
  caseId: string,
  payload: CaseStatusUpdate
): Promise<{ case_id: string; status: string; message?: string }> => {
  const response = await apiClient.put(`${BASE_PATH}/${caseId}/status`, payload);
  return response.data;
};

/**
 * Assign or reassign a case
 */
export const assignCase = async (
  caseId: string,
  payload: CaseAssignmentUpdate
): Promise<{ case_id: string; assigned_to: string | null; message?: string }> => {
  const response = await apiClient.put(`${BASE_PATH}/${caseId}/assign`, payload);
  return response.data;
};

/**
 * Get case conversation messages
 */
export const getCaseConversation = async (
  caseId: string,
  limit: number = 50
): Promise<CaseConversationResponse> => {
  const response = await apiClient.get<CaseConversationResponse>(
    `${BASE_PATH}/${caseId}/conversation?limit=${limit}`
  );
  return response.data;
};

/**
 * List case notes
 */
export const listCaseNotes = async (caseId: string): Promise<{ notes: CaseNoteItem[] }> => {
  const response = await apiClient.get(`${BASE_PATH}/${caseId}/notes`);
  return response.data;
};

/**
 * Add a note to a case
 */
export const addCaseNote = async (
  caseId: string,
  payload: CaseNoteCreate
): Promise<{ id: number; case_id: string; note: string; created_at: string }> => {
  const response = await apiClient.post(`${BASE_PATH}/${caseId}/notes`, payload);
  return response.data;
};
