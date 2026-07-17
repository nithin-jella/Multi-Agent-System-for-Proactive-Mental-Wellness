export interface AttestationCounts {
  total: number;
  pending: number;
  queued: number;
  confirmed: number;
  failed: number;
}

export interface PublishQueueCounts {
  total: number;
  queued: number;
  approved: number;
  running: number;
  confirmed: number;
  failed: number;
  dead_letter: number;
}

export interface AttestationContractTelemetry {
  chain_id: number;
  network: string;
  short_name: string;
  contract_address: string | null;
  publisher_address: string | null;
  is_ready: boolean;
  rpc_connected: boolean;
  publish_attempts: number;
  publish_successes: number;
  publish_failures: number;
  last_tx_hash: string | null;
  last_publish_attempt_at: string | null;
  last_publish_success_at: string | null;
  onchain_total_published: number | null;
  onchain_last_published_at: string | null;
  onchain_publisher_published: number | null;
  last_error: string | null;
  last_onchain_read_error: string | null;
  explorer_base_url: string | null;
  network_logo_url: string | null;
}

export interface AttestationRecordItem {
  id: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  counselor_id: number;
  quest_instance_id: number | null;
  tx_hash: string | null;
  chain_id: number | null;
  attestation_id: string | null;
  last_error: string | null;
}

export interface PublishActionItem {
  id: number;
  status: string;
  retry_count: number;
  created_at: string;
  executed_at: string | null;
  next_retry_at: string | null;
  tx_hash: string | null;
  chain_id: number | null;
  error_message: string | null;
  attestation_record_id: number | null;
  attestation_id: string | null;
}

export interface AttestationMonitorResponse {
  generated_at: string;
  counts: AttestationCounts;
  publish_queue: PublishQueueCounts;
  success_rate_percent: number;
  avg_confirmation_seconds: number | null;
  contracts: AttestationContractTelemetry[];
  recent_records: AttestationRecordItem[];
  recent_publish_actions: PublishActionItem[];
}
