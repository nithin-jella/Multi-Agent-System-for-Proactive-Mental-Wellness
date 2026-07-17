/**
 * Admin Screening API Service
 * API calls for mental health screening monitoring
 */

import apiClient from './api';
import type {
  ScreeningProfile,
  ScreeningProfileListResponse,
  ScreeningDashboard,
  ScreeningFilters,
} from '@/types/admin/screening';

const BASE_URL = '/admin/screening';

/**
 * Get screening dashboard overview
 */
export async function getScreeningDashboard(): Promise<ScreeningDashboard> {
  const response = await apiClient.get<ScreeningDashboard>(`${BASE_URL}/dashboard`);
  return response.data;
}

/**
 * List all screening profiles with optional filters
 */
export async function listScreeningProfiles(
  filters?: ScreeningFilters
): Promise<ScreeningProfileListResponse> {
  const params = new URLSearchParams();
  
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.risk_level) params.append('risk_level', filters.risk_level);
  if (filters?.requires_attention !== undefined) {
    params.append('requires_attention', filters.requires_attention.toString());
  }
  
  const response = await apiClient.get<ScreeningProfileListResponse>(
    `${BASE_URL}/profiles?${params.toString()}`
  );
  return response.data;
}

/**
 * Get a specific user's screening profile
 */
export async function getScreeningProfile(userId: number): Promise<ScreeningProfile> {
  const response = await apiClient.get<ScreeningProfile>(`${BASE_URL}/profiles/${userId}`);
  return response.data;
}

/**
 * Mark a screening profile as reviewed
 */
export async function markProfileReviewed(userId: number): Promise<{ status: string; message: string }> {
  const response = await apiClient.post<{ status: string; message: string }>(
    `${BASE_URL}/profiles/${userId}/mark-reviewed`
  );
  return response.data;
}
