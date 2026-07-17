import apiClient from '@/services/api';
import type { AgentDecisionListResponse } from '@/types/agentDecisions';

export async function getCounselorAgentDecisions(limit = 40, skip = 0): Promise<AgentDecisionListResponse> {
  const response = await apiClient.get<AgentDecisionListResponse>(`/counselor/agent-decisions?limit=${limit}&skip=${skip}`);
  return response.data;
}
