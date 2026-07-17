import { apiCall } from '@/utils/adminApi';
import type { AttestationMonitorResponse } from '@/types/admin/attestationMonitor';

export async function getAttestationMonitor(recentLimit = 15): Promise<AttestationMonitorResponse> {
  return apiCall<AttestationMonitorResponse>(`/api/v1/admin/attestations/monitor?recent_limit=${recentLimit}`);
}
