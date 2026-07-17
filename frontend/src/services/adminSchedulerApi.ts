/**
 * Scheduler Management API Service
 * Handles all API calls for APScheduler job management (list, toggle, reschedule, run)
 */

import apiClient from './api';

const SCHEDULER_BASE = '/admin/scheduler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchedulerJob {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  cron_expression: string;
  next_run_time: string | null; // ISO 8601 datetime string from backend
  func_name: string;
}

export interface ToggleJobRequest {
  enabled: boolean;
}

export interface RescheduleJobRequest {
  hour: number;
  minute: number;
  day_of_week?: string;
}

export interface TriggerCheckinRequest {
  user_id: number;
  reason?: string;
}

export interface TriggerCheckinResponse {
  detail: string;
  user_id: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * List all registered APScheduler jobs
 */
export async function getSchedulerJobs(): Promise<SchedulerJob[]> {
  const response = await apiClient.get(`${SCHEDULER_BASE}/jobs`);
  return response.data;
}

/**
 * Get a single scheduler job by ID
 */
export async function getSchedulerJob(jobId: string): Promise<SchedulerJob> {
  const response = await apiClient.get(`${SCHEDULER_BASE}/jobs/${jobId}`);
  return response.data;
}

/**
 * Toggle a job on or off (pause/resume)
 */
export async function toggleJob(
  jobId: string,
  enabled: boolean
): Promise<SchedulerJob> {
  const payload: ToggleJobRequest = { enabled };
  const response = await apiClient.patch(`${SCHEDULER_BASE}/jobs/${jobId}`, payload);
  return response.data;
}

/**
 * Reschedule a job with a new cron time.
 * Also automatically resumes the job if it was paused.
 */
export async function rescheduleJob(
  jobId: string,
  hour: number,
  minute: number,
  dayOfWeek?: string
): Promise<SchedulerJob> {
  const payload: RescheduleJobRequest = { hour, minute };
  if (dayOfWeek !== undefined) payload.day_of_week = dayOfWeek;
  const response = await apiClient.patch(`${SCHEDULER_BASE}/jobs/${jobId}`, payload);
  return response.data;
}

/**
 * Trigger a job to run immediately (fire-and-forget on the server side)
 */
export async function runJobNow(jobId: string): Promise<{ detail: string }> {
  const response = await apiClient.post(`${SCHEDULER_BASE}/jobs/${jobId}/run`);
  return response.data;
}

/**
 * Manually trigger a proactive check-in for a specific student
 */
export async function triggerUserCheckin(
  userId: number,
  reason: string = 'manual_admin'
): Promise<TriggerCheckinResponse> {
  const payload: TriggerCheckinRequest = { user_id: userId, reason };
  const response = await apiClient.post(`${SCHEDULER_BASE}/checkins/trigger`, payload);
  return response.data;
}
