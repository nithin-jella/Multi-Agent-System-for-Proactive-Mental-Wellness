/**
 * Campaign Management API Service
 * Handles all API calls for campaign CRUD and execution
 */

import apiClient from './api';
import type {
  Campaign,
  CampaignListResponse,
  CampaignExecutionHistoryListResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ExecuteCampaignRequest,
  ExecuteCampaignResponse,
  CampaignMetricsResponse,
  CampaignFilters,
} from '@/types/admin/campaigns';

const CAMPAIGNS_BASE = '/admin/campaigns';

/**
 * Get list of campaigns with optional filters
 */
export async function getCampaigns(filters?: CampaignFilters): Promise<CampaignListResponse> {
  const params = new URLSearchParams();
  
  if (filters?.status) params.append('status', filters.status);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.target_audience) params.append('target_audience', filters.target_audience);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.page_size) params.append('page_size', filters.page_size.toString());

  const queryString = params.toString();
  const url = queryString ? `${CAMPAIGNS_BASE}?${queryString}` : CAMPAIGNS_BASE;
  
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Get single campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<Campaign> {
  const response = await apiClient.get(`${CAMPAIGNS_BASE}/${campaignId}`);
  return response.data;
}

/**
 * Create new campaign
 * 
 * Transforms frontend CreateCampaignRequest to backend schema:
 * - target_audience: string → {type: string}
 * - triggers: array → {triggers: array, schedule: string|null}
 * 
 * Backend response will have target_audience as TargetAudienceObject
 */
export async function createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
  // Transform frontend format to backend format
  const backendPayload = {
    name: data.name,
    description: data.description || '',
    message_template: data.message_template,
    priority: data.priority || 'medium',
    status: data.status || 'draft',
    // Backend expects target_audience as an object: {type: TargetAudience}
    target_audience: {
      type: data.target_audience,
    },
    // Backend expects trigger_rules as an object containing triggers array
    trigger_rules: {
      triggers: data.triggers || [],
      schedule: data.schedule || null,
    },
  };

  const response = await apiClient.post(CAMPAIGNS_BASE, backendPayload);
  return response.data;
}

/**
 * Update existing campaign
 * 
 * Transforms frontend UpdateCampaignRequest to backend schema:
 * - target_audience: string → {type: string} (if provided)
 * 
 * Backend response will have target_audience as TargetAudienceObject
 */
export async function updateCampaign(
  campaignId: string,
  data: UpdateCampaignRequest
): Promise<Campaign> {
  // Transform frontend format to backend format (only for fields that are provided)
  const backendPayload: Record<string, unknown> = {};
  
  if (data.name !== undefined) backendPayload.name = data.name;
  if (data.description !== undefined) backendPayload.description = data.description;
  if (data.message_template !== undefined) backendPayload.message_template = data.message_template;
  if (data.priority !== undefined) backendPayload.priority = data.priority;
  if (data.status !== undefined) backendPayload.status = data.status;
  
  // Transform target_audience string to object: {type: TargetAudience}
  if (data.target_audience !== undefined) {
    backendPayload.target_audience = {
      type: data.target_audience,
    };
  }
  
  const response = await apiClient.put(`${CAMPAIGNS_BASE}/${campaignId}`, backendPayload);
  return response.data;
}

/**
 * Delete campaign (soft delete - sets status to cancelled)
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  await apiClient.delete(`${CAMPAIGNS_BASE}/${campaignId}`);
}

/**
 * Execute campaign
 */
export async function executeCampaign(
  campaignId: string,
  params?: ExecuteCampaignRequest
): Promise<ExecuteCampaignResponse> {
  const response = await apiClient.post(`${CAMPAIGNS_BASE}/execute`, {
    campaign_id: campaignId,
    dry_run: params?.dry_run || false,
  });
  return response.data;
}

/**
 * Get campaign metrics
 */
export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetricsResponse> {
  const response = await apiClient.get(`${CAMPAIGNS_BASE}/${campaignId}/metrics`);
  return response.data;
}

/**
 * Preview campaign target audience (dry run without execution)
 */
export async function previewCampaignTargets(campaignId: string): Promise<{
  total_targeted: number;
  sample_users: Array<{ user_id: number; user_hash: string }>;
}> {
  const response = await apiClient.post(`${CAMPAIGNS_BASE}/execute`, {
    campaign_id: campaignId,
    dry_run: true,
  });
  return response.data;
}

/**
 * Get campaign execution history
 */
export async function getCampaignHistory(
  campaignId: string,
  skip: number = 0,
  limit: number = 50
): Promise<CampaignExecutionHistoryListResponse> {
  const response = await apiClient.get(
    `${CAMPAIGNS_BASE}/${campaignId}/history?skip=${skip}&limit=${limit}`
  );
  return response.data;
}
