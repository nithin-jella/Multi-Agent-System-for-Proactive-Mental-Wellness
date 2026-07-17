import { apiCall } from '@/utils/adminApi';
import type { AgentDecisionListResponse } from '@/types/agentDecisions';

export async function getAdminAgentDecisions(limit = 40, skip = 0): Promise<AgentDecisionListResponse> {
  return apiCall<AgentDecisionListResponse>(`/api/v1/admin/agent-decisions?limit=${limit}&skip=${skip}`);
}
