export type ActiveUsersSummary = {
  dau: number;
  wau: number;
  mau: number;
  as_of: string; // YYYY-MM-DD
};

export type DailyActiveUsersPoint = {
  activity_date: string; // YYYY-MM-DD
  active_users: number;
  total_requests: number;
};

export type DailyActiveUsersSeries = {
  days: number;
  generated_at: string; // ISO datetime
  points: DailyActiveUsersPoint[];
};

export type CohortRetentionPoint = {
  cohort_date: string; // YYYY-MM-DD
  day_n: number;
  cohort_size: number;
  retained_users: number;
  retention_rate: number; // 0..1
};

export type CohortRetentionSeries = {
  cohort_days: number;
  day_n_values: number[];
  generated_at: string; // ISO datetime
  points: CohortRetentionPoint[];
};

export type RetentionSummaryPoint = {
  day_n: number;
  cohort_size: number;
  retained_users: number;
  retention_rate: number; // 0..1
};

export type RetentionSummary = {
  cohort_date: string | null; // YYYY-MM-DD
  day_n_values: number[];
  generated_at: string; // ISO datetime
  points: RetentionSummaryPoint[];
};
