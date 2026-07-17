/**
 * Custom hook for fetching LangGraph analytics data
 * 
 * Provides:
 * - Execution history with filtering
 * - Performance bottlenecks
 * - Active alerts
 * - Metrics trends
 */

'use client';

import { useState, useCallback } from 'react';
import * as langGraphApi from '@/services/langGraphApi';
import type { 
  ExecutionHistoryFilters,
  ExecutionHistoryResponse,
  PerformanceBottleneck,
  SystemAlert,
  MetricsTrend
} from '@/services/langGraphApi';

export function useLangGraphAnalytics() {
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingBottlenecks, setLoadingBottlenecks] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const [history, setHistory] = useState<ExecutionHistoryResponse | null>(null);
  const [bottlenecks, setBottlenecks] = useState<{ success: boolean; data: PerformanceBottleneck[] } | null>(null);
  const [alerts, setAlerts] = useState<{ success: boolean; data: SystemAlert[] } | null>(null);
  const [trends, setTrends] = useState<{ success: boolean; data: MetricsTrend[] } | null>(null);

  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch execution history with optional filters
   */
  const fetchHistory = useCallback(async (filters?: ExecutionHistoryFilters) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const data = await langGraphApi.getExecutionHistory(filters);
      setHistory(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch execution history';
      console.error('Failed to fetch execution history:', err);
      setError(errorMessage);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  /**
   * Fetch execution details by ID
   */
  const fetchExecutionDetails = useCallback(async (executionId: string) => {
    try {
      return await langGraphApi.getExecutionDetails(executionId);
    } catch (err) {
      console.error('Failed to fetch execution details:', err);
      throw err;
    }
  }, []);

  /**
   * Fetch performance bottlenecks
   */
  const fetchBottlenecks = useCallback(async () => {
    setLoadingBottlenecks(true);
    setError(null);
    try {
      const data = await langGraphApi.getPerformanceBottlenecks();
      setBottlenecks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bottlenecks';
      console.error('Failed to fetch bottlenecks:', err);
      setError(errorMessage);
    } finally {
      setLoadingBottlenecks(false);
    }
  }, []);

  /**
   * Fetch active alerts
   */
  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    setError(null);
    try {
      const data = await langGraphApi.getAlerts();
      setAlerts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alerts';
      console.error('Failed to fetch alerts:', err);
      setError(errorMessage);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  /**
   * Resolve an alert
   */
  const resolveAlert = useCallback(async (alertId: number) => {
    try {
      await langGraphApi.resolveAlert(alertId);
      // Refresh alerts after resolving
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      throw err;
    }
  }, [fetchAlerts]);

  /**
   * Fetch metrics trends
   */
  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    setError(null);
    try {
      const data = await langGraphApi.getMetricsTrends();
      setTrends(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trends';
      console.error('Failed to fetch trends:', err);
      setError(errorMessage);
    } finally {
      setLoadingTrends(false);
    }
  }, []);

  return {
    // State
    history,
    bottlenecks,
    alerts,
    trends,
    error,

    // Loading states
    loadingHistory,
    loadingBottlenecks,
    loadingAlerts,
    loadingTrends,

    // Actions
    fetchHistory,
    fetchExecutionDetails,
    fetchBottlenecks,
    fetchAlerts,
    resolveAlert,
    fetchTrends
  };
}

