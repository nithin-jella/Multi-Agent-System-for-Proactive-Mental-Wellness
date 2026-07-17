/**
 * Custom hooks for Intervention Analytics data fetching
 */

import { useState, useEffect } from 'react';
import apiClient from '@/services/api';

// ============================================================================
// TYPES
// ============================================================================

export interface SCAAnalytics {
    total_plans: number;
    active_plans: number;
    completed_plans: number;
    archived_plans: number;
    avg_completion_percentage: number;
    avg_days_to_completion: number | null;
    plans_viewed_in_24h: number;
    plans_not_viewed_in_7d: number;
    risk_level_distribution: Record<string, number>;
    completion_rate: number;
    abandonment_rate: number;
    timeframe_days: number;
    generated_at: string;
}

export interface UserProgress {
    user_hash: string;
    total_plans: number;
    active_plans: number;
    completed_plans: number;
    avg_completion_percentage: number;
    last_plan_created: string;
    engagement_score: number;
}

export interface CBTModuleUsage {
    module_name: string;
    usage_count: number;
    avg_completion_rate: number;
    total_steps: number;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch Intervention Analytics
 */
export function useAnalytics(days: number = 30) {
    const [analytics, setAnalytics] = useState<SCAAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                setError(null);
                // Updated API path
                const response = await apiClient.get<SCAAnalytics>(`/admin/analytics/interventions?days=${days}`);
                setAnalytics(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load analytics');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [days]);

    return { analytics, loading, error };
}

/**
 * Hook to fetch user progress
 */
export function useUserProgress(params: { limit?: number; min_plans?: number } = {}) {
    const [users, setUsers] = useState<UserProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { limit = 50, min_plans = 1 } = params;

    useEffect(() => {
        const fetchUserProgress = async () => {
            try {
                setLoading(true);
                setError(null);

                const queryParams = new URLSearchParams({
                    limit: limit.toString(),
                    min_plans: min_plans.toString(),
                });

                // Updated API path
                const response = await apiClient.get<UserProgress[]>(
                    `/admin/analytics/users/progress?${queryParams.toString()}`
                );
                setUsers(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load user progress');
            } finally {
                setLoading(false);
            }
        };

        fetchUserProgress();
    }, [limit, min_plans]);

    return { users, loading, error };
}

/**
 * Hook to fetch CBT module usage
 */
export function useCBTModuleUsage(days: number = 30) {
    const [modules, setModules] = useState<CBTModuleUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchModuleUsage = async () => {
            try {
                setLoading(true);
                setError(null);
                // Updated API path
                const response = await apiClient.get<CBTModuleUsage[]>(
                    `/admin/analytics/cbt-modules/usage?days=${days}`
                );
                setModules(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load module usage');
            } finally {
                setLoading(false);
            }
        };

        fetchModuleUsage();
    }, [days]);

    return { modules, loading, error };
}
