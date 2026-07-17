import apiClient from './api';
import type { AgentUserSummary } from '@/types/admin/agentUsers';

export interface AgentUserFilters {
  role?: string;
  search?: string;
}

export const listAgentUsers = async (
  filters: AgentUserFilters = {}
): Promise<AgentUserSummary[]> => {
  const params = new URLSearchParams();
  if (filters.role) params.append('role', filters.role);
  if (filters.search) params.append('search', filters.search);

  const query = params.toString();
  const response = await apiClient.get<AgentUserSummary[]>(
    `/admin/agent-users${query ? `?${query}` : ''}`
  );
  return response.data;
};
