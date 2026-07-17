// Admin Dashboard Types
export interface DashboardKPIs {
  active_critical_cases: number;
  overall_sentiment?: number | null;
  sentiment_delta?: number | null;
  appointments_this_week: number;
  cases_opened_this_week: number;
  cases_closed_this_week: number;
  avg_case_resolution_time?: number | null;
  sla_breach_count: number;
  active_campaigns_count: number;
}

export interface TrendingTopic {
  topic: string;
  count: number;
}

export interface AlertItem {
  case_id: string;
  severity: string;
  created_at: string;
  session_id?: string | null;
  user_hash: string;
  summary?: string | null;
}

// LLM-generated pattern insight
export interface PatternInsight {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  trend: 'increasing' | 'stable' | 'decreasing';
}

// LLM-generated recommendation
export interface RecommendationItem {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: 'intervention' | 'resource' | 'communication' | 'monitoring';
}

// Severity distribution from assessments
export interface SeverityDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface InsightsPanel {
  trending_topics: TrendingTopic[];
  ia_summary: string;
  report_generated_at?: string | null;
  report_period?: string | null;
  // New LLM-powered fields
  patterns?: PatternInsight[];
  recommendations?: RecommendationItem[];
  severity_distribution?: SeverityDistribution;
  llm_powered?: boolean;
}

export interface DashboardOverview {
  kpis: DashboardKPIs;
  insights: InsightsPanel;
  alerts: AlertItem[];
}

export interface HistoricalDataPoint {
  date: string;
  value?: number | null;
}

export interface TrendsResponse {
  sentiment_trend: HistoricalDataPoint[];
  cases_opened_trend: HistoricalDataPoint[];
  cases_closed_trend: HistoricalDataPoint[];
  topic_trends: Record<string, HistoricalDataPoint[]>;
  time_range_days: number;
  bucket_size_days: number;
}

export type TimeRange = 7 | 30 | 90;

// Active user counters from analytics endpoint
export interface ActiveUsersSummary {
  dau: number;
  wau: number;
  mau: number;
  as_of: string;
}
