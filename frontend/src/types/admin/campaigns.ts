/**
 * Campaign Management Types
 * Type definitions for proactive outreach campaign system
 */

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export type CampaignPriority = 'low' | 'medium' | 'high';

export type TargetAudience = 'all_users' | 'high_risk' | 'inactive' | 'recent_cases' | 'custom';

/**
 * Backend target_audience structure
 * Backend stores target_audience as a Dict/object with at minimum a 'type' field
 */
export interface TargetAudienceObject {
  type: TargetAudience;
  [key: string]: unknown; // Allow additional fields for future extensibility
}

export type TriggerType = 
  | 'sentiment_threshold' 
  | 'case_count' 
  | 'sla_breach' 
  | 'risk_score' 
  | 'inactivity';

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'greater_than_or_equal' 
  | 'less_than' 
  | 'less_than_or_equal';

export interface TriggerConditions {
  operator?: ConditionOperator;
  value?: number;
  time_period_days?: number;
  min_breaches?: number;
  severity?: string;
  days_inactive?: number;
  had_previous_activity?: boolean;
}

export interface CampaignTrigger {
  id?: number;
  campaign_id?: string;
  trigger_type: TriggerType;
  conditions: TriggerConditions;
  is_active?: boolean;
  created_at?: string;
}

export interface CampaignMetric {
  id: string;
  campaign_id: string;
  execution_date: string;
  messages_sent: number;
  users_targeted: number;
  users_engaged: number;
  success_rate?: number;
  avg_sentiment_before?: number;
  avg_sentiment_after?: number;
}

/**
 * Campaign response from backend
 * Backend returns target_audience as an object (TargetAudienceObject)
 * or optionally as a simple Dict with unknown structure
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  target_audience: TargetAudienceObject | Record<string, unknown> | null;
  message_template: string;
  status: CampaignStatus;
  priority?: CampaignPriority;
  schedule?: string;
  created_at: string;
  updated_at: string;
  created_by?: number;
  last_executed_at?: string;
  triggers?: CampaignTrigger[];
}

export interface CampaignListResponse {
  items: Campaign[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  target_audience: TargetAudience;
  message_template: string;
  status?: CampaignStatus;
  priority?: CampaignPriority;
  schedule?: string;
  triggers?: Omit<CampaignTrigger, 'id' | 'campaign_id' | 'created_at'>[];
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  target_audience?: TargetAudience;
  message_template?: string;
  status?: CampaignStatus;
  priority?: CampaignPriority;
  schedule?: string;
}

export interface ExecuteCampaignRequest {
  dry_run?: boolean;
}

export interface ExecuteCampaignResponse {
  campaign_id: string;
  execution_id: string;
  status: string;
  total_targeted: number;
  messages_sent: number;
  messages_failed: number;
  execution_time_seconds: number;
  timestamp: string;
  dry_run?: boolean;
}

export interface CampaignMetricsResponse {
  campaign_id: string;
  metrics: CampaignMetric[];
  total_messages_sent: number;
  total_users_targeted: number;
  total_users_engaged: number;
  average_success_rate?: number;
}

export interface CampaignFilters {
  status?: CampaignStatus;
  priority?: CampaignPriority;
  target_audience?: TargetAudience;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface MessageTemplate {
  template: string;
  variables: string[];
  preview: string;
}

export const TEMPLATE_VARIABLES = [
  { name: 'user_name', description: "Student's name" },
  { name: 'sentiment_score', description: 'Current sentiment percentage' },
  { name: 'risk_score', description: 'Latest risk assessment score' },
  { name: 'case_count', description: 'Number of active cases' },
  { name: 'days_inactive', description: 'Days since last activity' },
] as const;

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
};

export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
  all_users: 'All Students',
  high_risk: 'High Risk',
  inactive: 'Inactive Users',
  recent_cases: 'Recent Cases',
  custom: 'Custom Segment',
};

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  sentiment_threshold: 'Sentiment Threshold',
  case_count: 'Case Count',
  sla_breach: 'SLA Breach',
  risk_score: 'Risk Score',
  inactivity: 'Inactivity',
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  greater_than: 'Greater Than',
  greater_than_or_equal: 'Greater Than or Equal',
  less_than: 'Less Than',
  less_than_or_equal: 'Less Than or Equal',
};

/**
 * Campaign Execution History
 * Audit trail of campaign executions
 */
export interface CampaignExecutionHistory {
  id: string;
  campaign_id: string;
  campaign_name: string;
  executed_at: string;
  executed_by: number | null;
  total_targeted: number;
  messages_sent: number;
  messages_failed: number;
  execution_time_seconds: number;
  dry_run: boolean;
  targeted_user_ids: number[] | null;
  message_content: string;
  error_message: string | null;
}

export interface CampaignExecutionHistoryListResponse {
  items: CampaignExecutionHistory[];
  total: number;
  skip: number;
  limit: number;
}
