import { apiCall } from '@/utils/adminApi';
import type { AdminContractsStatusResponse } from '@/types/admin/contracts';

export async function getAdminContractsStatus(): Promise<AdminContractsStatusResponse> {
  return apiCall<AdminContractsStatusResponse>('/api/v1/admin/contracts/status');
}
