import { apiCall } from '@/utils/adminApi';

import type {
  BadgeIssuance,
  BadgeIssuanceListResponse,
  BadgeMintRequest,
  BadgePublishResponse,
  BadgeTemplate,
  BadgeTemplateCreatePayload,
  BadgeTemplateListResponse,
  BadgeTemplateUpdatePayload,
  ChainInfo,
  ChainsListResponse,
} from '@/types/admin/badges';

export const adminBadgesApi = {
  /** Fetch all supported chains with their readiness status. */
  listChains: async (): Promise<ChainInfo[]> => {
    const res = await apiCall<ChainsListResponse>('/api/v1/admin/badges/chains');
    return res.chains;
  },

  listTemplates: async (): Promise<BadgeTemplate[]> => {
    const res = await apiCall<BadgeTemplateListResponse>('/api/v1/admin/badges/templates');
    return res.templates;
  },

  createTemplate: (payload: BadgeTemplateCreatePayload) =>
    apiCall<BadgeTemplate>('/api/v1/admin/badges/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTemplate: (templateId: number, payload: BadgeTemplateUpdatePayload) =>
    apiCall<BadgeTemplate>(`/api/v1/admin/badges/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  uploadImage: (templateId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiCall<BadgeTemplate>(`/api/v1/admin/badges/templates/${templateId}/image`, {
      method: 'POST',
      body: form,
    });
  },

  publish: (templateId: number) =>
    apiCall<BadgePublishResponse>(`/api/v1/admin/badges/templates/${templateId}/publish`, {
      method: 'POST',
    }),

  mint: (templateId: number, payload: BadgeMintRequest) =>
    apiCall<BadgeIssuance>(`/api/v1/admin/badges/templates/${templateId}/mint`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listIssuances: (templateId: number) =>
    apiCall<BadgeIssuanceListResponse>(`/api/v1/admin/badges/templates/${templateId}/issuances`),
};
