import { apiCall } from '@/utils/adminApi';
import type {
  ActiveUsersSummary,
  CohortRetentionSeries,
  DailyActiveUsersSeries,
  RetentionSummary,
} from '@/types/admin/retention';

export async function getActiveUsersSummary(): Promise<ActiveUsersSummary> {
  return apiCall<ActiveUsersSummary>('/api/v1/admin/analytics/retention/active');
}

export async function getDailyActiveUsersSeries(days: number = 30): Promise<DailyActiveUsersSeries> {
  const params = new URLSearchParams({ days: String(days) });
  return apiCall<DailyActiveUsersSeries>(`/api/v1/admin/analytics/retention/dau?${params.toString()}`);
}

export async function getCohortRetentionSeries(
  cohortDays: number = 30,
  dayNValues: number[] = [1, 7, 30]
): Promise<CohortRetentionSeries> {
  const params = new URLSearchParams({ cohort_days: String(cohortDays) });
  for (const dayN of dayNValues) {
    params.append('day_n_values', String(dayN));
  }
  return apiCall<CohortRetentionSeries>(`/api/v1/admin/analytics/retention/cohorts?${params.toString()}`);
}

export async function getRetentionSummary(dayNValues: number[] = [1, 7, 30]): Promise<RetentionSummary> {
  const params = new URLSearchParams();
  for (const dayN of dayNValues) {
    params.append('day_n_values', String(dayN));
  }
  const query = params.toString();
  return apiCall<RetentionSummary>(`/api/v1/admin/analytics/retention/summary${query ? `?${query}` : ''}`);
}
