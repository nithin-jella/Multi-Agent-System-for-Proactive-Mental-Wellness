export interface SessionUser {
  id: number;
  email?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  last_login?: string | null;
  sentiment_score?: number | null;
}

export interface ConversationDetail {
  id: number;
  user_id_hash: string;
  session_id: string;
  conversation_id: string;
  message: string;
  response: string;
  timestamp: string;
  sentiment_score?: number | null;
}

export interface Analysis {
  message_pairs: number;
  total_user_chars: number;
  total_ai_chars: number;
  avg_user_message_length: number;
  avg_ai_message_length: number;
  top_keywords?: [string, number][];
  [key: string]: unknown;
}

export interface SessionDetailResponse {
  session_id: string;
  user_id_hash: string;
  user?: SessionUser | null;
  conversation_count: number;
  first_message_time: string;
  last_message_time: string;
  total_duration_minutes: number;
  conversations: ConversationDetail[];
  analysis: Analysis;
}

export interface FlagResponse {
  id: number;
  session_id: string;
  user_id?: number | null;
  reason?: string | null;
  status: string;
  flagged_by_admin_id?: number | null;
  created_at: string;
  updated_at: string;
  tags?: string[] | null;
  notes?: string | null;
}

export interface ScreeningDimensionScore {
  score: number;
  evidence: string[];
  is_protective: boolean;
}

export interface ScreeningExtraction {
  depression?: ScreeningDimensionScore | null;
  anxiety?: ScreeningDimensionScore | null;
  stress?: ScreeningDimensionScore | null;
  sleep?: ScreeningDimensionScore | null;
  social?: ScreeningDimensionScore | null;
  academic?: ScreeningDimensionScore | null;
  self_worth?: ScreeningDimensionScore | null;
  substance?: ScreeningDimensionScore | null;
  crisis?: ScreeningDimensionScore | null;
  protective_dimensions?: string[];
}

export interface RiskAssessment {
  id: number;
  conversation_id?: string | null;
  session_id?: string | null;
  user_id?: number | null;
  overall_risk_level: string;
  risk_trend: string;
  conversation_summary: string;
  user_context?: {
    recent_stressors?: string[];
    coping_mechanisms?: string[];
    protective_factors?: string[];
    [key: string]: string[] | undefined;
  } | null;
  protective_factors?: string[] | null;
  concerns?: string[] | null;
  recommended_actions?: string[] | null;
  should_invoke_cma: boolean;
  reasoning: string;
  pleasure?: number | null;
  arousal?: number | null;
  dominance?: number | null;
  journal_valence?: number | null;
  journal_arousal?: number | null;
  journal_inferred_dominance?: number | null;
  discordance_score?: number | null;
  discordance_level?: string | null;
  discordance_reason?: string | null;
  message_count: number;
  conversation_duration_seconds?: number | null;
  analysis_timestamp: string;
  raw_assessment?: {
    screening?: ScreeningExtraction | null;
    crisis_detected?: boolean;
    [key: string]: unknown;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface RiskAssessmentListResponse {
  assessments: RiskAssessment[];
  total_count: number;
}
