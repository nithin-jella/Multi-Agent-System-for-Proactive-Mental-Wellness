// lib/appointments-api.ts
import { getSession } from 'next-auth/react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

/**
 * Get authentication headers with JWT token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.accessToken && {
      'Authorization': `Bearer ${session.accessToken}`
    })
  };
}

/**
 * Handle API response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // Redirect to login or refresh token
    throw new Error('Unauthorized. Please log in again.');
  }

  if (response.status === 404) {
    throw new Error('Resource not found.');
  }

  if (response.status === 409) {
    const error = await response.json();
    throw new Error(error.detail || 'Conflict error occurred.');
  }

  if (response.status === 422) {
    const error = await response.json();
    const messages = error.detail?.map((e: { msg: string }) => e.msg).join(', ') || 'Validation error';
    throw new Error(messages);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || `Request failed with status ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// ========================================
// Types
// ========================================

export interface Psychologist {
  id: number;
  name: string;
  specialization: string | null;
  image_url: string | null;
  is_available: boolean;
}

export interface AppointmentType {
  id: number;
  name: string;
  duration_minutes: number;
  description: string | null;
}

export interface Appointment {
  id: number;
  user_id: number;
  psychologist_id: number;
  appointment_type_id: number;
  appointment_datetime: string; // ISO 8601
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'moved' | 'no_show';
  created_at: string;
  updated_at: string;
  psychologist: Psychologist;
  appointment_type: AppointmentType;
}

export interface AppointmentStats {
  total_appointments: number;
  upcoming_count: number;
  completed_count: number;
  cancelled_count: number;
  moved_count: number;
  no_show_count: number;
}

export interface CreateAppointmentData {
  psychologist_id: number;
  appointment_type_id: number;
  appointment_datetime: string; // ISO 8601
  notes?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'moved' | 'no_show';
}

export interface UpdateAppointmentData {
  appointment_datetime?: string;
  notes?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'moved' | 'no_show';
}

export interface GetMyAppointmentsParams {
  status_filter?: string;
  upcoming_only?: boolean;
  past_only?: boolean;
  limit?: number;
  offset?: number;
}

// ========================================
// Public API (No Authentication Required)
// ========================================

/**
 * Get all psychologists/counselors
 */
export async function getPsychologists(availableOnly: boolean = false): Promise<Psychologist[]> {
  const url = `${API_BASE}/api/v1/appointments/psychologists${
    availableOnly ? '?available_only=true' : ''
  }`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<Psychologist[]>(response);
}

/**
 * Get single psychologist by ID (Public - basic info only)
 */
export async function getPublicPsychologist(id: number): Promise<Psychologist> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/psychologists/${id}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<Psychologist>(response);
}

/**
 * Get all appointment types
 */
export async function getAppointmentTypes(): Promise<AppointmentType[]> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/appointment-types`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<AppointmentType[]>(response);
}

/**
 * Get single appointment type by ID
 */
export async function getAppointmentType(id: number): Promise<AppointmentType> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/appointment-types/${id}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<AppointmentType>(response);
}

// ========================================
// Authenticated API
// ========================================

/**
 * Get current user's appointments with filters
 */
export async function getMyAppointments(
  params?: GetMyAppointmentsParams
): Promise<Appointment[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.status_filter) {
    queryParams.set('status_filter', params.status_filter);
  }
  if (params?.upcoming_only) {
    queryParams.set('upcoming_only', 'true');
  }
  if (params?.past_only) {
    queryParams.set('past_only', 'true');
  }
  if (params?.limit) {
    queryParams.set('limit', params.limit.toString());
  }
  if (params?.offset) {
    queryParams.set('offset', params.offset.toString());
  }
  
  const url = `${API_BASE}/api/v1/appointments/my-appointments${
    queryParams.toString() ? '?' + queryParams.toString() : ''
  }`;
  
  const response = await fetch(url, {
    headers: await getAuthHeaders(),
    credentials: 'include' // Include cookies for NextAuth
  });
  
  return handleResponse<Appointment[]>(response);
}

/**
 * Get appointment statistics for current user
 */
export async function getMyAppointmentStats(): Promise<AppointmentStats> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/my-appointments/stats`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<AppointmentStats>(response);
}

/**
 * Get single appointment by ID
 */
export async function getAppointment(id: number): Promise<Appointment> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/${id}`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<Appointment>(response);
}

/**
 * Create a new appointment
 */
export async function createAppointment(data: CreateAppointmentData): Promise<Appointment> {
  const response = await fetch(`${API_BASE}/api/v1/appointments`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  
  return handleResponse<Appointment>(response);
}

/**
 * Update an appointment (reschedule, change status, update notes)
 */
export async function updateAppointment(
  id: number,
  data: UpdateAppointmentData
): Promise<Appointment> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  
  return handleResponse<Appointment>(response);
}

/**
 * Update only appointment notes (pre-appointment information)
 */
export async function updateAppointmentNotes(
  id: number,
  notes: string
): Promise<Appointment> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/${id}/notes`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ notes })
  });
  
  return handleResponse<Appointment>(response);
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/appointments/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<void>(response);
}

// ========================================
// ADMIN PSYCHOLOGIST MANAGEMENT
// ========================================

export interface Education {
  degree: string;
  institution: string;
  year?: number;
  field_of_study?: string;
}

export interface Certification {
  name: string;
  issuing_organization: string;
  year?: number;
  expiry_date?: string;
}

export interface AvailabilitySchedule {
  day: string;
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

export interface TimeSlot {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  hour: number; // 0-23
  available: boolean;
}

export interface CounselorUser {
  id: number;
  email?: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface CounselorCreate {
  user_id: number;
  name: string;
  specialization?: string;
  image_url?: string;
  is_available?: boolean;
  bio?: string;
  years_of_experience?: number;
  languages?: string[];
  consultation_fee?: number;
  education?: Education[];
  certifications?: Certification[];
  availability_schedule?: AvailabilitySchedule[];
}

export interface CounselorUpdate {
  name?: string;
  specialization?: string;
  image_url?: string;
  is_available?: boolean;
  bio?: string;
  years_of_experience?: number;
  languages?: string[];
  consultation_fee?: number;
  education?: Education[];
  certifications?: Certification[];
  availability_schedule?: AvailabilitySchedule[];
}

export interface Education {
  degree: string;
  institution: string;
  year?: number;
  field_of_study?: string;
}

export interface CounselorResponse {
  id: number;
  user_id?: number;
  name: string;
  specialization?: string;
  image_url?: string;
  is_available: boolean;
  bio?: string;
  years_of_experience?: number;
  languages?: string[];
  consultation_fee?: number;
  education?: Education[];
  certifications?: Certification[];
  availability_schedule?: AvailabilitySchedule[];
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    email: string;
    role: string;
    full_name?: string;
  };
}

export interface CounselorListResponse {
  counselors: CounselorResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CounselorStats {
  total_appointments: number;
  upcoming_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  total_patients: number;
  average_rating: number;
  total_reviews: number;
}

/**
 * List all counselors (Admin)
 */
export async function listCounselors(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  is_available?: boolean;
  specialization?: string;
}): Promise<CounselorListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.is_available !== undefined) queryParams.append('is_available', params.is_available.toString());
  if (params?.specialization) queryParams.append('specialization', params.specialization);

  const response = await fetch(
    `${API_BASE}/api/v1/admin/counselors?${queryParams.toString()}`,
    {
      headers: await getAuthHeaders(),
      credentials: 'include'
    }
  );
  
  return handleResponse<CounselorListResponse>(response);
}

/**
 * Get single counselor with full details (Admin only)
 */
export async function getAdminCounselor(id: number): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/admin/counselors/${id}`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Create counselor profile (Admin)
 */
export async function createCounselor(data: CounselorCreate): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/admin/counselors`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Update counselor profile (Admin)
 */
export async function updateCounselor(
  id: number,
  data: CounselorUpdate
): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/admin/counselors/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Toggle counselor availability (Admin)
 */
export async function toggleCounselorAvailabilityAdmin(
  id: number,
  is_available: boolean
): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/admin/counselors/${id}/availability`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ is_available })
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Get counselor users (Admin) - filtered from user directory.
 */
export async function getCounselorUsers(): Promise<CounselorUser[]> {
  const params = new URLSearchParams({ page: '1', limit: '100' });

  const response = await fetch(`${API_BASE}/api/v1/admin/users?${params.toString()}`, {
    headers: await getAuthHeaders(),
    credentials: 'include',
  });

  const data = await handleResponse<{
    users: Array<{ id: number; email?: string; name?: string | null; role?: string; created_at?: string }>;
  }>(response);

  return data.users
    .filter((user) => user.role === 'counselor')
    .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name ?? user.email ?? `Counselor ${user.id}`,
      created_at: user.created_at ?? new Date().toISOString(),
    }));
}

/**
 * Delete counselor profile (Admin)
 */
export async function deleteCounselor(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/admin/counselors/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<void>(response);
}

/**
 * Get counselor statistics (Admin)
 */
export async function getCounselorStatsAdmin(id: number): Promise<CounselorStats> {
  const response = await fetch(`${API_BASE}/api/v1/admin/counselors/${id}/stats`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<CounselorStats>(response);
}

// ========================================
// COUNSELOR SELF-MANAGEMENT
// ========================================

export interface CounselorDashboardStats {
  profile_completion_percentage: number;
  this_week_appointments: number;
  upcoming_appointments: number;
  total_revenue: number;
  average_rating: number;
  total_reviews: number;
  total_patients: number;
  total_completed_appointments: number;
}

/**
 * Get own profile (Counselor)
 */
export async function getCounselorProfile(): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/counselor/profile`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Update own profile (Counselor)
 */
export async function updateCounselorProfile(
  data: CounselorUpdate
): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/counselor/profile`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data)
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Toggle own availability (Counselor)
 */
export async function toggleCounselorAvailability(
  is_available: boolean
): Promise<CounselorResponse> {
  const response = await fetch(`${API_BASE}/api/v1/counselor/profile/availability`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ is_available })
  });
  
  return handleResponse<CounselorResponse>(response);
}

/**
 * Get own appointments (Counselor)
 */
export async function getCounselorAppointments(params?: {
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}): Promise<Appointment[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

  const response = await fetch(
    `${API_BASE}/api/v1/counselor/appointments?${queryParams.toString()}`,
    {
      headers: await getAuthHeaders(),
      credentials: 'include'
    }
  );
  
  return handleResponse<Appointment[]>(response);
}

/**
 * Get single appointment (Counselor)
 */
export async function getCounselorAppointment(id: number): Promise<Appointment> {
  const response = await fetch(`${API_BASE}/api/v1/counselor/appointments/${id}`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<Appointment>(response);
}

/**
 * Get dashboard statistics (Counselor)
 */
export async function getCounselorStats(): Promise<CounselorDashboardStats> {
  const response = await fetch(`${API_BASE}/api/v1/counselor/stats`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<CounselorDashboardStats>(response);
}

/**
 * Get today's appointments (Counselor)
 */
export async function getTodayAppointments(): Promise<Appointment[]> {
  const response = await fetch(`${API_BASE}/api/v1/counselor/upcoming-today`, {
    headers: await getAuthHeaders(),
    credentials: 'include'
  });
  
  return handleResponse<Appointment[]>(response);
}
