/** Response types for the Gemini API Key monitoring admin page. */

export interface KeySnapshot {
  key_index: number;
  key_label: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  rate_limited_hits: number;
  last_used_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  is_on_cooldown: boolean;
  cooldown_remaining_s: number;
  requests_by_model: Record<string, number>;
  requests_last_hour: number;
  requests_last_24h: number;
  errors_last_hour: number;
}

export interface ApiKeySummary {
  total_keys: number;
  active_keys: number;
  keys_on_cooldown: number;
  total_requests: number;
  total_errors: number;
  total_rate_limited: number;
  error_rate: number;
  requests_last_hour: number;
  uptime_seconds: number;
}

export interface ApiKeyStatusResponse {
  summary: ApiKeySummary;
  keys: KeySnapshot[];
  models_available: string[];
  fallback_chain: string[];
  circuit_breakers: CircuitBreakerPayload;
  model_history: ModelHistoryPayload;
  active_chat_model: string;
  active_chat_provider: string;
  supported_chat_models: string[];
}

export interface ActiveModelStatusResponse {
  active_chat_model: string;
  active_chat_provider: string;
  supported_chat_models: string[];
}

export interface UpdateActiveModelPayload {
  model: string;
}

export interface CircuitBreakerModelStatus {
  model: string;
  is_open: boolean;
  open_remaining_s: number;
  failures_in_window: number;
  total_opens: number;
  total_closes: number;
  last_opened_at: number | null;
  last_closed_at: number | null;
}

export interface CircuitBreakerSummary {
  total_models: number;
  open_models: number;
  total_opens: number;
  total_closes: number;
}

export interface CircuitBreakerPayload {
  summary: CircuitBreakerSummary;
  models: CircuitBreakerModelStatus[];
}

export interface ModelHistoryPoint {
  ts: number;
  count: number;
}

export interface ModelHistorySeries {
  model: string;
  points: ModelHistoryPoint[];
}

export interface ModelHistoryPayload {
  window_seconds: number;
  bucket_seconds: number;
  series: ModelHistorySeries[];
}

export interface AddKeyResponse {
  message: string;
  total_keys: number;
}
