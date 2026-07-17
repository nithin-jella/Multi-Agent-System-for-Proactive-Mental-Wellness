/**
 * useIAExecution Hook
 * 
 * Manages Insights Agent (IA) graph execution for privacy-preserving analytics
 */

import { useState } from 'react';
import { langGraphApi, IAGraphRequest, IAGraphResponse } from '@/services/langGraphApi';
import toast from 'react-hot-toast';

export interface IAExecutionState {
  loading: boolean;
  result: IAGraphResponse | null;
  error: string | null;
}

export function useIAExecution() {
  const [state, setState] = useState<IAExecutionState>({
    loading: false,
    result: null,
    error: null,
  });

  const executeQuery = async (request: IAGraphRequest) => {
    setState({ loading: true, result: null, error: null });

    try {
      const result = await langGraphApi.executeIA(request);

      if (!result.success) {
        throw new Error(result.errors.join(', ') || 'Query execution failed');
      }

      // Check privacy compliance
      if (!result.result.k_anonymity_satisfied) {
        toast.error('Query blocked: k-anonymity threshold not met (k<5)');
        setState({
          loading: false,
          result: null,
          error: 'Insufficient data for k-anonymity (k<5)',
        });
        return;
      }

      toast.success('Query executed successfully with privacy guarantees');
      setState({ loading: false, result, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Query failed: ${errorMessage}`);
      setState({ loading: false, result: null, error: errorMessage });
    }
  };

  const reset = () => {
    setState({ loading: false, result: null, error: null });
  };

  return {
    ...state,
    executeQuery,
    reset,
  };
}
