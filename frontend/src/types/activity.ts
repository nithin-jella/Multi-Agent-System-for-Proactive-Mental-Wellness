/**
 * Activity Log Types
 * 
 * TypeScript types for agent activity logging from the backend.
 */

export type ActivityType =
  | 'agent_start'
  | 'agent_complete'
  | 'agent_error'
  | 'node_start'
  | 'node_complete'
  | 'routing_decision'
  | 'risk_assessment'
  | 'intervention_created'
  | 'case_created'
  | 'llm_call'
  | 'tool_start'
  | 'tool_end'
  | 'tool_use'
  | 'reasoning_trace'
  | 'info'
  | 'warning';

export interface ActivityLog {
  timestamp: string;
  activity_type: ActivityType;
  agent: string; // STA, TCA, CMA, IA, Aika
  message: string;
  details?: Record<string, any>;
  duration_ms?: number | null;
}

export interface ActivityLogMessage {
  type: 'activity_log';
  data: ActivityLog;
}
