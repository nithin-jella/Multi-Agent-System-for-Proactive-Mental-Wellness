export interface CampaignMetrics {
  total: number;
  scheduled: number;
  pending_review: number;
  active: number;
  completed: number;
  failed: number;
}

export interface CampaignSummary {
  total: number;
  active: number;
  paused: number;
  draft: number;
  completed: number;
}

export interface ExecutionSummary {
  total: number;
  scheduled: number;
  pending_review: number;
  approved: number;
  completed: number;
  failed: number;
}

export interface QueueItem {
  execution_id?: number | null;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  status: string;
  scheduled_at: string;
  campaign_id?: number;
  priority?: string | null;
  risk_score?: number | null;
  severity_level?: string | null;
  recommended_action?: string | null;
  delivery_method?: string | null;
  notes?: string | null;
}

export interface InterventionOverview {
  campaign_summary: CampaignSummary;
  execution_summary: ExecutionSummary;
  queue_size: number;
  automation_enabled: boolean;
  human_review_required: boolean;
  risk_score_threshold: number;
  daily_send_limit: number;
  channels_enabled: string[];
  last_updated: string;
  top_risk_cases: QueueItem[];
}

export interface InterventionCampaign {
  id: number;
  campaign_type: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  content: Record<string, unknown>;
  target_criteria?: Record<string, unknown> | null;
  start_date?: string | null;
  end_date?: string | null;
  target_audience_size: number;
  executions_delivered: number;
  executions_failed: number;
  created_at: string;
  updated_at: string;
  metrics: CampaignMetrics;
}

export interface InterventionExecution {
  id: number;
  campaign_id: number;
  user_id: number;
  status: string;
  scheduled_at: string;
  executed_at?: string | null;
  delivery_method?: string | null;
  notes?: string | null;
  engagement_score?: number | null;
  is_manual: boolean;
  user_name?: string | null;
  user_email?: string | null;
  campaign_title?: string | null;
  priority?: string | null;
}

export interface InterventionSettings {
  auto_mode_enabled: boolean;
  human_review_required: boolean;
  risk_score_threshold: number;
  daily_send_limit: number;
  channels_enabled: string[];
  escalation_email?: string | null;
  office_hours_start?: string | null;
  office_hours_end?: string | null;
  manual_notes?: string | null;
  updated_at: string;
}

export interface ManualInterventionPayload {
  user_id: number;
  campaign_id?: number;
  title?: string;
  message?: string;
  delivery_method?: string;
  scheduled_at?: string;
  notes?: string;
}
