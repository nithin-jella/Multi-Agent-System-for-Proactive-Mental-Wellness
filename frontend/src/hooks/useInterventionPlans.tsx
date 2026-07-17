/**
 * React hooks for intervention plan management
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  fetchInterventionPlans,
  fetchInterventionPlanById,
  completeInterventionStep,
  archiveInterventionPlan,
  type InterventionPlanRecord,
  type InterventionPlanListResponse,
} from '@/services/interventionPlanApi';

/**
 * Hook to fetch all intervention plans for the current user
 */
export const useInterventionPlans = (activeOnly: boolean = true) => {
  const [data, setData] = useState<InterventionPlanListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchInterventionPlans(activeOnly);
      setData(response);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch intervention plans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
};

/**
 * Hook to fetch a specific intervention plan by ID
 */
export const useInterventionPlan = (planId: number | null) => {
  const [data, setData] = useState<InterventionPlanRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!planId) {
      setData(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchInterventionPlanById(planId);
      setData(response);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch intervention plan:', err);
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
};

/**
 * Hook to mark a step as complete
 */
export const useCompleteStep = () => {
  const [isLoading, setIsLoading] = useState(false);

  const completeStep = useCallback(
    async (
      planId: number,
      stepIndex: number,
      completed: boolean,
      notes?: string,
      onSuccess?: (plan: InterventionPlanRecord) => void
    ) => {
      try {
        setIsLoading(true);
        const updatedPlan = await completeInterventionStep(planId, stepIndex, completed, notes);
        
        toast.success(
          completed ? 'Step marked as complete! 🎉' : 'Step marked as incomplete',
          {
            duration: 3000,
            position: 'bottom-right',
          }
        );
        
        if (onSuccess) {
          onSuccess(updatedPlan);
        }
        
        return updatedPlan;
      } catch (error) {
        console.error('Failed to update step:', error);
        toast.error('Failed to update step. Please try again.', {
          duration: 4000,
          position: 'bottom-right',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { completeStep, isLoading };
};

/**
 * Hook to archive an intervention plan
 */
export const useArchivePlan = () => {
  const [isLoading, setIsLoading] = useState(false);

  const archivePlan = useCallback(
    async (planId: number, onSuccess?: (plan: InterventionPlanRecord) => void) => {
      try {
        setIsLoading(true);
        const archivedPlan = await archiveInterventionPlan(planId);
        
        toast.success('Plan archived successfully', {
          duration: 3000,
          position: 'bottom-right',
        });
        
        if (onSuccess) {
          onSuccess(archivedPlan);
        }
        
        return archivedPlan;
      } catch (error) {
        console.error('Failed to archive plan:', error);
        toast.error('Failed to archive plan. Please try again.', {
          duration: 4000,
          position: 'bottom-right',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { archivePlan, isLoading };
};
