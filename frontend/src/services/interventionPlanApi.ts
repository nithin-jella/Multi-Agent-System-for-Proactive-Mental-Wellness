/**
 * API service for intervention plan records
 */

import apiClient from './api';

export interface PlanStep {
  title: string;
  description: string;
  completed: boolean;
}

export interface ResourceCard {
  title: string;
  url: string;
  description: string;
  resource_type?: 'link' | 'activity' | 'video' | 'article';
  activity_id?: string;
  resource_id?: string;
}

export interface NextCheckIn {
  timeframe: string;
  method: string;
}

export interface InterventionPlanData {
  plan_steps: PlanStep[];
  resource_cards: ResourceCard[];
  next_check_in: NextCheckIn;
}

export interface CompletionTracking {
  completed_steps: number[];
  completion_percentage: number;
  last_updated: string | null;
}

export interface InterventionPlanRecord {
  id: number;
  user_id: number;
  session_id: string | null;
  conversation_id: number | null;
  plan_title: string;
  risk_level: number | null;
  plan_data: InterventionPlanData;
  completion_tracking: CompletionTracking;
  total_steps: number;
  completed_steps: number;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_viewed_at: string | null;
  archived_at: string | null;
}

export interface InterventionPlanListResponse {
  plans: InterventionPlanRecord[];
  total: number;
}

export interface StepCompletionRequest {
  step_index: number;
  completed: boolean;
  notes?: string;
}

/**
 * Fetch all intervention plans for the current user
 */
export const fetchInterventionPlans = async (
  activeOnly: boolean = true,
  limit: number = 50,
  offset: number = 0
): Promise<InterventionPlanListResponse> => {
  const params = new URLSearchParams({
    active_only: activeOnly.toString(),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  const response = await apiClient.get(`/intervention-plans?${params.toString()}`);
  return response.data;
};

/**
 * Fetch a specific intervention plan by ID
 */
export const fetchInterventionPlanById = async (planId: number): Promise<InterventionPlanRecord> => {
  const response = await apiClient.get(`/intervention-plans/${planId}`);
  return response.data;
};

/**
 * Mark a step as complete or incomplete
 */
export const completeInterventionStep = async (
  planId: number,
  stepIndex: number,
  completed: boolean,
  notes?: string
): Promise<InterventionPlanRecord> => {
  const response = await apiClient.post(`/intervention-plans/${planId}/complete-step`, {
    step_index: stepIndex,
    completed,
    notes,
  });
  return response.data.updated_plan;
};

/**
 * Archive an intervention plan
 */
export const archiveInterventionPlan = async (planId: number): Promise<InterventionPlanRecord> => {
  const response = await apiClient.post(`/intervention-plans/${planId}/archive`);
  return response.data;
};
