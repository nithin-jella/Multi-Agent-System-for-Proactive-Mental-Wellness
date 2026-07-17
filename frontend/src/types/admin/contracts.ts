export interface AdminContractStatusItem {
  key: string;
  name: string;
  category: 'token' | 'badge' | 'attestation' | string;
  network: string;
  chain_id: number | null;
  contract_address: string | null;
  publisher_address: string | null;
  is_configured: boolean;
  is_ready: boolean;
  rpc_connected: boolean;
  is_testnet: boolean;
  explorer_base_url: string | null;
  tx_sample_url: string | null;
  last_error: string | null;
  network_logo_url: string | null;
  details: Record<string, unknown>;
}

export interface AdminContractsStatusResponse {
  generated_at: string;
  status: 'healthy' | 'degraded' | string;
  contracts: AdminContractStatusItem[];
}
