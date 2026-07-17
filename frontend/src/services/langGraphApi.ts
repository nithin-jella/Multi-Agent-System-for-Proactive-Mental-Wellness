/**
 * LangGraph Agent API Service
 * 
 * Provides access to all LangGraph StateGraph execution endpoints and analytics.
 * This service enables admin/counselor interaction with the Safety Agent Suite:
 * - STA (Safety Triage Agent): Crisis detection and risk classification
 * - Orchestrator: Intent-based routing to appropriate agents
 * - IA (Insights Agent): Privacy-preserving analytics with k-anonymity
 * - Monitoring: Real-time execution tracking and performance analytics
 */

import apiClient from './api';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Risk assessment output from STA (Safety Triage Agent)
 */
export interface RiskAssessment {
  risk_level: number;          // 0-3 (low, moderate, high, critical)
  risk_score: number;          // 0.0-1.0 normalized score
  severity: 'low' | 'moderate' | 'high' | 'critical';
  intent: string;              // Detected user intent (e.g., "suicidal_ideation", "anxiety")
  next_step: 'tca' | 'cma' | 'end';  // Routing decision
}

/**
 * STA Graph Execution Request
 */
export interface STAGraphRequest {
  user_id: number;
  session_id: string;
  user_hash: string;           // Anonymized user identifier
  message: string;             // User message to analyze
  conversation_id?: number;
}

/**
 * STA Graph Execution Response
 */
export interface STAGraphResponse {
  success: boolean;
  execution_id: string;        // Unique execution tracking ID
  execution_path: string[];    // Nodes executed: ["ingest_message", "assess_risk", ...]
  risk_assessment: RiskAssessment;
  triage_assessment_id?: number;  // Database ID of saved assessment
  errors: string[];
  execution_time_ms?: number;
}

/**
 * CMA Graph Execution Request
 */
export interface CMAGraphRequest {
  user_id: number;
  session_id: string;
  user_hash: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  message: string;
  intent: string;
  risk_level: number;          // 0-3 (from STA assessment)
}

/**
 * CMA Graph Execution Response
 */
export interface CMAGraphResponse {
  success: boolean;
  execution_id: string;
  execution_path: string[];
  case_id: string;             // Database ID of created case
  sla_breach_at: string;       // ISO timestamp of SLA deadline
  assigned_counselor_id?: number;  // Auto-assigned counselor
  errors: string[];
  execution_time_ms?: number;
}

/**
 * TCA Graph Execution Request
 */
export interface TCAGraphRequest {
  user_id: number;
  session_id: string;
  user_hash: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  intent: string;
  risk_level: number;          // 0-3 from STA
  message: string;
}

/**
 * TCA Graph Execution Response
 */
export interface TCAGraphResponse {
  success: boolean;
  execution_id: string;
  execution_path: string[];
  intervention_type: 'calm_down' | 'break_down_problem' | 'general_coping';
  intervention_plan: {
    plan_steps: Array<{ title: string; description: string }>;
    resource_cards: Array<{ title: string; url: string; description: string }>;
    next_check_in: { timeframe: string; method: string };
  };
  intervention_plan_id?: number;  // Database ID of saved plan
  errors: string[];
  execution_time_ms?: number;
}

/**
 * Orchestrator Graph Execution Request
 */
export interface OrchestratorGraphRequest {
  user_id: number;
  session_id: string;
  user_hash: string;
  intent: string;              // Classified intent or "auto" for auto-detection
  message?: string;            // Optional message for context
  payload?: Record<string, unknown>;  // Agent-specific payload
}

/**
 * Orchestrator Graph Execution Response
 */
export interface OrchestratorGraphResponse {
  success: boolean;
  execution_id: string;
  execution_path: string[];
  routed_to: string;           // Agent routed to: "sta", "tca", "cma", "ia"
  agent_response?: Record<string, unknown>;  // Response from the routed agent
  errors: string[];
  execution_time_ms?: number;
}

/**
 * Insights Agent (IA) Query Request
 */
export interface IAGraphRequest {
  query_name: string;          // One of 6 allow-listed queries
  filters?: {
    start_date?: string;       // ISO date
    end_date?: string;         // ISO date
    severity?: string;
    counselor_id?: number;
  };
  requester_role: 'admin' | 'counselor';  // For access control
}

/**
 * Insights Agent (IA) Query Response
 */
export interface IAGraphResponse {
  success: boolean;
  execution_id: string;
  execution_path: string[];
  query_name: string;
  result: {
    data: Record<string, unknown>[];  // Query results (k-anonymized)
    k_anonymity_satisfied: boolean;   // Whether k≥5 threshold met
    differential_privacy_budget_used: number;  // ε used
    total_records_anonymized: number;
  };
  summary?: string;            // Executive summary from LLM
  recommendations?: Array<{    // Actionable recommendations
    recommendation: string;
    priority: string;
    action: string;
  }>;
  privacy_metadata: {
    k_value: number;           // Actual k value (≥5 required)
    epsilon_used: number;      // Differential privacy ε
    delta_used: number;        // Differential privacy δ
  };
  errors: string[];
  execution_time_ms?: number;
}

/**
 * Graph Health Check Response
 */
export interface GraphHealthResponse {
  graph_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_execution?: string;     // ISO timestamp
  error_rate_percent: number;
  avg_execution_time_ms: number;
  total_executions_24h: number;
}

/**
 * Analytics Overview Response
 */
export interface AnalyticsOverviewResponse {
  success: boolean;
  data: {
    period_days: number;
    total_executions: number;
    successful_executions: number;
    success_rate_percent: number;
    average_execution_time_ms: number;
    total_cost_usd: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    decision_parse_health?: {
      period_days: number;
      total_attempts: number;
      failed_parses: number;
      repaired_parses: number;
      unrecovered_parses: number;
      parse_failure_rate_percent: number;
      unrecovered_rate_percent: number;
      repair_recovery_rate_percent: number;
      warning_threshold_percent: number;
      critical_threshold_percent: number;
      status: 'healthy' | 'degraded' | 'critical' | 'unknown';
    };
    most_active_nodes: Array<{
      node_name: string;
      execution_count: number;
      avg_time_ms: number;
      success_rate_percent: number;
    }>;
  };
  generated_at: string;        // ISO timestamp
}

/**
 * Execution History Filters
 */
export interface ExecutionHistoryFilters {
  limit?: number;              // Default: 50, max: 500
  offset?: number;             // Default: 0
  status?: 'completed' | 'failed' | 'running';
  graph_name?: 'sta' | 'orchestrator' | 'cma' | 'tca' | 'ia' | 'aika';
}

/**
 * Execution History Item
 */
export interface ExecutionHistoryItem {
  execution_id: string;
  graph_name: string;
  status: string;
  started_at: string;          // ISO timestamp
  completed_at?: string;       // ISO timestamp
  total_execution_time_ms?: number;
  total_nodes_executed: number;
  failed_nodes: number;
  success_rate: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost_usd: number;
  agent_run_id?: string;
  error_message?: string;
}

/**
 * Execution History Response
 */
export interface ExecutionHistoryResponse {
  success: boolean;
  data: ExecutionHistoryItem[];
  pagination: {
    limit: number;
    offset: number;
    returned: number;
  };
}

/**
 * Detailed Execution Data
 */
export interface ExecutionDetails {
  execution: {
    execution_id: string;
    graph_name: string;
    status: string;
    started_at: string;
    completed_at?: string;
    total_execution_time_ms?: number;
    input_data?: Record<string, unknown>;
    output_data?: Record<string, unknown>;
    execution_context?: Record<string, unknown>;
    error_message?: string;
  };
  nodes: Array<{
    node_id: string;
    agent_id: string;
    status: string;
    started_at: string;
    completed_at?: string;
    execution_time_ms?: number;
    input_data?: Record<string, unknown>;
    output_data?: Record<string, unknown>;
    error_message?: string;
    custom_metrics?: Record<string, unknown>;
  }>;
  edges: Array<{
    edge_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type: string;
    triggered_at: string;
    evaluation_result?: boolean;
    condition_expression?: string;
  }>;
  metrics: Array<{
    metric_name: string;
    metric_value: number;
    recorded_at: string;
  }>;
}

/**
 * Performance Bottleneck Data
 */
export interface PerformanceBottleneck {
  node_name: string;
  avg_execution_time_ms: number;
  max_execution_time_ms: number;
  execution_count: number;
  p95_execution_time_ms: number;  // 95th percentile
  bottleneck_severity: 'low' | 'medium' | 'high';
}

/**
 * System Alert
 */
export interface SystemAlert {
  id: number;
  alert_type: string;
  graph_type?: string | null; // Backend may omit this for some alert types
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  execution_id?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Metrics Trend Data
 */
export interface MetricsTrend {
  metric_name: string;
  data_points: Array<{
    timestamp: string;
    value: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  change_percent: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Execute Safety Triage Agent (STA) workflow
 * 
 * **Use Case:** Analyze user message for crisis indicators
 * 
 * **Workflow:**
 * 1. Ingest user message
 * 2. Apply redaction (remove PII)
 * 3. Assess risk level (0-3)
 * 4. Decide routing (TCA/CMA/end)
 * 
 * **UX Context:** Called when counselor manually triggers triage or system auto-triages new messages
 */
export const executeSTA = async (request: STAGraphRequest): Promise<STAGraphResponse> => {
  const response = await apiClient.post<STAGraphResponse>(
    '/agents/graph/sta/execute',
    request
  );
  return response.data;
};

/**
 * Execute Case Management Agent (CMA) workflow
 * 
 * **Use Case:** Create cases with automatic SLA calculation and counselor assignment
 * 
 * **Workflow:**
 * 1. Validate severity (must be high or critical)
 * 2. Calculate SLA deadline (critical=1h, high=4h)
 * 3. Auto-assign to available counselor
 * 4. Create case record with metadata
 * 
 * **UX Context:** Called from Case Management dashboard when creating new cases
 */
export const executeCMA = async (request: CMAGraphRequest): Promise<CMAGraphResponse> => {
  const response = await apiClient.post<CMAGraphResponse>(
    '/agents/graph/cma/execute',
    request
  );
  return response.data;
};

/**
 * Execute Therapeutic Coach Agent (TCA) workflow
 * 
 * **Use Case:** Generate personalized intervention plans for users
 * 
 * **Workflow:**
 * 1. Ingest triage signal from STA
 * 2. Determine intervention type (calm_down, break_down_problem, general_coping)
 * 3. Generate plan steps and resource cards
 * 4. Persist intervention plan to database
 * 
 * **UX Context:** Called from Cases page to generate intervention plans
 */
export const executeTCA = async (request: TCAGraphRequest): Promise<TCAGraphResponse> => {
  const response = await apiClient.post<TCAGraphResponse>(
    '/agents/graph/tca/execute',
    request
  );
  return response.data;
};

/**
 * Execute Orchestrator Graph
 * 
 * **Use Case:** Route requests to appropriate agent based on intent
 * 
 * **Workflow:**
 * 1. Classify intent (if intent="auto")
 * 2. Route to appropriate agent (STA/TCA/CMA/IA)
 * 3. Return agent response
 * 
 * **UX Context:** Used in agents command center for manual agent testing
 */
export const executeOrchestrator = async (
  request: OrchestratorGraphRequest
): Promise<OrchestratorGraphResponse> => {
  const response = await apiClient.post<OrchestratorGraphResponse>(
    '/agents/graph/orchestrator/execute',
    request
  );
  return response.data;
};

/**
 * Execute Insights Agent (IA) for privacy-preserving analytics
 * 
 * **Use Case:** Run allow-listed analytics queries with k-anonymity
 * 
 * **Allow-listed Queries:**
 * 1. `high_risk_trends` - Trend analysis of high-risk users
 * 2. `support_plan_effectiveness` - Intervention plan success rates
 * 3. `case_distribution` - Cases by severity distribution
 * 4. `resolution_times` - Average case resolution times
 * 5. `peak_usage_patterns` - Peak usage hour analysis
 * 6. `counselor_workload` - Counselor case load balance
 * 
 * **Privacy Guarantees:**
 * - k-anonymity: k≥5 (minimum 5 users per group)
 * - Differential privacy: ε-δ budget tracking
 * - Consent validation: Only analyze users who opted in
 * 
 * **UX Context:** Called from Insights Dashboard when admin/counselor runs analytics
 */
export const executeIA = async (request: IAGraphRequest): Promise<IAGraphResponse> => {
  const response = await apiClient.post<IAGraphResponse>(
    '/agents/graph/ia/execute',
    request
  );
  return response.data;
};

/**
 * Check health status of a specific LangGraph
 * 
 * **Use Case:** Monitor system health in admin dashboard
 * 
 * **Health Criteria:**
 * - `healthy`: Error rate <5%, avg execution time <2s
 * - `degraded`: Error rate 5-15%, avg execution time 2-5s
 * - `unhealthy`: Error rate >15%, avg execution time >5s
 * 
 * **UX Context:** Displayed in LangGraph Monitoring Dashboard header
 */
export const getGraphHealth = async (
  graphName: 'sta' | 'orchestrator' | 'ia'
): Promise<GraphHealthResponse> => {
  const response = await apiClient.get<GraphHealthResponse>(
    `/agents/graph/${graphName}/health`
  );
  return response.data;
};

/**
 * Get analytics overview for specified time period
 * 
 * **Use Case:** Dashboard summary cards showing execution metrics
 * 
 * **Metrics Included:**
 * - Total executions
 * - Success rate percentage
 * - Average execution time
 * - Most active nodes (top 5)
 * 
 * **UX Context:** Displayed in LangGraph Monitoring Dashboard overview section
 */
export const getAnalyticsOverview = async (
  days: number = 7
): Promise<AnalyticsOverviewResponse> => {
  const response = await apiClient.get<AnalyticsOverviewResponse>(
    `/admin/langgraph/analytics/overview?days=${days}`
  );
  return response.data;
};

/**
 * Get execution history with filtering and pagination
 * 
 * **Use Case:** View past graph executions for debugging/auditing
 * 
 * **Filters Available:**
 * - Status: completed, failed, running
 * - Graph name: sta, orchestrator, cma, tca, ia
 * - Pagination: limit (max 500), offset
 * 
 * **UX Context:** Displayed in LangGraph Monitoring Dashboard execution history table
 */
export const getExecutionHistory = async (
  filters: ExecutionHistoryFilters = {}
): Promise<ExecutionHistoryResponse> => {
  const params = new URLSearchParams();

  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));
  if (filters.status) params.append('status', filters.status);
  if (filters.graph_name) params.append('graph_name', filters.graph_name);

  const response = await apiClient.get<ExecutionHistoryResponse>(
    `/admin/langgraph/executions/history?${params.toString()}`
  );
  return response.data;
};

/**
 * Get detailed execution information including node/edge traces
 * 
 * **Use Case:** Debug failed executions or analyze execution path
 * 
 * **Details Included:**
 * - Execution metadata (status, timing, errors)
 * - Node executions (input/output for each node)
 * - Edge executions (routing decisions)
 * - Performance metrics
 * 
 * **UX Context:** Displayed when user clicks "View Details" on execution history item
 */
export const getExecutionDetails = async (
  executionId: string
): Promise<{ success: boolean; data: ExecutionDetails }> => {
  const response = await apiClient.get<{ success: boolean; data: ExecutionDetails }>(
    `/admin/langgraph/executions/${executionId}/details`
  );
  return response.data;
};

/**
 * Get performance bottleneck analysis
 * 
 * **Use Case:** Identify slow nodes for optimization
 * 
 * **Metrics:**
 * - Average execution time per node
 * - 95th percentile (P95) execution time
 * - Bottleneck severity rating
 * 
 * **UX Context:** Displayed in LangGraph Monitoring Dashboard performance section
 */
export const getPerformanceBottlenecks = async (): Promise<{
  success: boolean;
  data: PerformanceBottleneck[];
}> => {
  const response = await apiClient.get<{
    success: boolean;
    data: PerformanceBottleneck[];
  }>('/admin/langgraph/performance/bottlenecks');
  return response.data;
};

/**
 * Get active system alerts
 * 
 * **Use Case:** Display critical system issues requiring attention
 * 
 * **Alert Types:**
 * - High error rates
 * - Slow execution times
 * - Failed executions
 * - Privacy violations
 * 
 * **UX Context:** Displayed in LangGraph Monitoring Dashboard alerts section
 */
export const getAlerts = async (): Promise<{
  success: boolean;
  data: SystemAlert[];
}> => {
  const response = await apiClient.get<{
    success: boolean;
    data: SystemAlert[];
  }>('/admin/langgraph/alerts');
  return response.data;
};

/**
 * Resolve a system alert
 * 
 * **Use Case:** Mark alert as resolved after addressing issue
 * 
 * **UX Context:** Called when admin clicks "Resolve" button on alert
 */
export const resolveAlert = async (
  alertId: number
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    `/admin/langgraph/alerts/${alertId}/resolve`
  );
  return response.data;
};

/**
 * Get metrics trends over time
 * 
 * **Use Case:** Visualize metric changes in charts
 * 
 * **Metrics Tracked:**
 * - Execution count per hour/day
 * - Success rate trends
 * - Average execution time trends
 * 
 * **UX Context:** Displayed in LangGraph Monitoring Dashboard trend charts
 */
export const getMetricsTrends = async (): Promise<{
  success: boolean;
  data: MetricsTrend[];
}> => {
  const response = await apiClient.get<{
    success: boolean;
    data: MetricsTrend[];
  }>('/admin/langgraph/metrics/trends');
  return response.data;
};

// ============================================================================
// Exported API Object (Alternative usage pattern)
// ============================================================================

/**
 * Consolidated LangGraph API client
 * 
 * **Usage:**
 * ```typescript
 * import { langGraphApi } from '@/services/langGraphApi';
 * 
 * // Execute STA
 * const result = await langGraphApi.executeSTA({ ... });
 * 
 * // Get analytics
 * const overview = await langGraphApi.getAnalyticsOverview(7);
 * ```
 */
export const langGraphApi = {
  // Execution endpoints
  executeSTA,
  executeCMA,
  executeTCA,
  executeOrchestrator,
  executeIA,

  // Health monitoring
  getGraphHealth,

  // Analytics endpoints
  getAnalyticsOverview,
  getExecutionHistory,
  getExecutionDetails,
  getPerformanceBottlenecks,
  getAlerts,
  resolveAlert,
  getMetricsTrends,
};

export default langGraphApi;
