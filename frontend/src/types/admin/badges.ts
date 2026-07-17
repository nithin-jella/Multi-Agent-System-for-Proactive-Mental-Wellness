export type BadgeTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ---------------------------------------------------------------------------
// Chain info (from GET /admin/badges/chains)
// ---------------------------------------------------------------------------

export interface ChainInfo {
  chain_id: number;
  name: string;
  short_name: string;
  explorer_base_url: string;
  native_currency: string;
  is_testnet: boolean;
  is_ready: boolean;
}

export interface ChainsListResponse {
  chains: ChainInfo[];
}

// ---------------------------------------------------------------------------
// Badge template
// ---------------------------------------------------------------------------

export interface BadgeTemplate {
  id: number;
  chain_id: number;
  contract_address: string;
  token_id: number;
  name: string;
  description: string | null;
  image_uri: string | null;
  metadata_uri: string | null;
  status: BadgeTemplateStatus;
  auto_award_enabled: boolean;
  auto_award_action: string | null;
  auto_award_criteria: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // Chain display metadata (enriched by the backend)
  chain_name: string | null;
  chain_short_name: string | null;
  explorer_base_url: string | null;
}

export interface BadgeTemplateListResponse {
  templates: BadgeTemplate[];
}

export interface BadgeTemplateCreatePayload {
  token_id: number;
  name: string;
  description?: string;
  /** Optional chain_id; defaults to EDU Chain (656476) on the server */
  chain_id?: number;
  auto_award_enabled?: boolean;
  auto_award_action?: string;
  auto_award_criteria?: Record<string, unknown>;
}

export interface BadgeTemplateUpdatePayload {
  name?: string;
  description?: string | null;
  auto_award_enabled?: boolean;
  auto_award_action?: string | null;
  auto_award_criteria?: Record<string, unknown> | null;
}

export interface BadgePublishResponse {
  template: BadgeTemplate;
  metadata_cid: string;
  metadata_uri: string;
  set_token_uri_tx_hash?: string | null;
}

// ---------------------------------------------------------------------------
// Badge issuance
// ---------------------------------------------------------------------------

export type BadgeIssuanceStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED';

export interface BadgeIssuance {
  id: number;
  template_id: number;
  user_id: number;
  chain_id: number;
  wallet_address: string;
  amount: number;
  tx_hash: string | null;
  status: BadgeIssuanceStatus;
  error_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Pre-built explorer link for the tx */
  explorer_tx_url: string | null;
}

export interface BadgeIssuanceListResponse {
  issuances: BadgeIssuance[];
}

export interface BadgeMintRequest {
  user_id: number;
  amount: number;
}
