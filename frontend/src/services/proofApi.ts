import apiClient from './api';

export interface ProofActionItem {
  id: number;
  action_type: string;
  risk_level: string;
  policy_decision: string;
  status: string;
  created_at: string;
  executed_at?: string | null;
  tx_hash?: string | null;
  chain_id?: number | null;
  explorer_tx_url?: string | null;
  approval_notes?: string | null;
}

export interface ProofActionListResponse {
  items: ProofActionItem[];
  total: number;
}

export const listProofActions = async (params: {
  user_id?: number;
  skip?: number;
  limit?: number;
} = {}): Promise<ProofActionListResponse> => {
  const query = new URLSearchParams();
  if (params.user_id !== undefined) query.set('user_id', String(params.user_id));
  if (params.skip !== undefined) query.set('skip', String(params.skip));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const response = await apiClient.get<ProofActionListResponse>(`/proof/actions?${query.toString()}`);
  return response.data;
};
