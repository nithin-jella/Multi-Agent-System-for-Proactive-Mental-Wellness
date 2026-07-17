/**
 * TypeScript types for Server-Sent Events (SSE)
 */

export type AlertType = 
  | 'case_created'
  | 'case_updated'
  | 'sla_breach'
  | 'ia_report_generated'
  | 'campaign_executed'
  | 'system_notification';

export type AlertSeverity = 
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export interface AlertData {
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  link?: string;
  timestamp: string;
  case_id?: string;
  report_id?: string;
  user_hash?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface CaseUpdatedData {
  case_id: string;
  old_status: string;
  new_status: string;
  changed_by?: number;
  timestamp: string;
}

export interface SLABreachData {
  alert_type: 'sla_breach';
  severity: 'critical';
  title: string;
  message: string;
  link: string;
  timestamp: string;
  case_id: string;
  assigned_to: string | null;
  breach_time?: string;
}

export interface IAReportGeneratedData {
  alert_type: 'ia_report_generated';
  severity: AlertSeverity;
  title: string;
  message: string;
  link: string;
  timestamp: string;
  report_id: string;
  report_type: 'weekly' | 'monthly' | 'custom';
  period_start?: string;
  period_end?: string;
  high_risk_count: number;
}

export interface PingData {
  timestamp: string;
}

export interface ConnectedData {
  message: string;
  user_id: number;
  timestamp?: string;
}

export type SSEEventType = 
  | 'connected'
  | 'alert_created'
  | 'case_updated'
  | 'sla_breach'
  | 'ia_report_generated'
  | 'ping'
  | 'message';

export interface SSEEvent<T = unknown> {
  id?: string;
  type: SSEEventType;
  data: T;
  timestamp?: string;
}

export type AlertEvent = SSEEvent<AlertData>;
export type CaseUpdatedEvent = SSEEvent<CaseUpdatedData>;
export type SLABreachEvent = SSEEvent<SLABreachData>;
export type IAReportEvent = SSEEvent<IAReportGeneratedData>;
export type PingEvent = SSEEvent<PingData>;
export type ConnectedEvent = SSEEvent<ConnectedData>;
