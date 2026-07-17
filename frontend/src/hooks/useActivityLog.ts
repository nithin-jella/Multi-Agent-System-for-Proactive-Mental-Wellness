/**
 * useActivityLog Hook
 * 
 * React hook for receiving and managing real-time agent activity logs via WebSocket.
 * Integrates with the backend's activity logging system.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ActivityLog, ActivityLogMessage } from '@/types/activity';

interface UseActivityLogOptions {
  enabled?: boolean;
  maxLogs?: number;
  onActivity?: (activity: ActivityLog) => void;
}

interface UseActivityLogReturn {
  activities: ActivityLog[];
  latestActivity: ActivityLog | null;
  activeAgents: string[];
  clearActivities: () => void;
  isReceiving: boolean;
  addActivity: (activity: ActivityLog) => void;
}

export function useActivityLog(
  options: UseActivityLogOptions = {}
): UseActivityLogReturn {
  const {
    enabled = true,
    maxLogs = 100,
    onActivity,
  } = options;

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [latestActivity, setLatestActivity] = useState<ActivityLog | null>(null);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [isReceiving, setIsReceiving] = useState(false);

  const activeAgentsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Add a new activity log
   */
  const addActivity = useCallback(
    (activity: ActivityLog) => {
      setActivities((prev) => {
        const updated = [...prev, activity];
        // Keep only the last maxLogs entries
        if (updated.length > maxLogs) {
          return updated.slice(updated.length - maxLogs);
        }
        return updated;
      });

      setLatestActivity(activity);
      setIsReceiving(true);

      // Track active agents
      if (activity.activity_type === 'agent_start') {
        setActiveAgents((prev) => {
          if (!prev.includes(activity.agent)) {
            return [...prev, activity.agent];
          }
          return prev;
        });
      } else if (
        activity.activity_type === 'agent_complete' ||
        activity.activity_type === 'agent_error'
      ) {
        setActiveAgents((prev) => prev.filter((a) => a !== activity.agent));
      }

      // Clear isReceiving flag after a delay
      if (activeAgentsTimeoutRef.current) {
        clearTimeout(activeAgentsTimeoutRef.current);
      }
      activeAgentsTimeoutRef.current = setTimeout(() => {
        setIsReceiving(false);
      }, 500);

      // Call onActivity callback
      if (onActivity) {
        onActivity(activity);
      }
    },
    [maxLogs, onActivity]
  );

  /**
   * Clear all activities
   */
  const clearActivities = useCallback(() => {
    setActivities([]);
    setLatestActivity(null);
    setActiveAgents([]);
    setIsReceiving(false);
  }, []);

  /**
   * Parse incoming WebSocket message
   */
  const handleWebSocketMessage = useCallback(
    (data: any) => {
      try {
        // Check if this is an activity log message
        if (data.type === 'activity_log' && data.data) {
          const activityMsg = data as ActivityLogMessage;
          addActivity(activityMsg.data);
        }
      } catch (error) {
        console.error('[useActivityLog] Failed to parse activity message:', error);
      }
    },
    [addActivity]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (activeAgentsTimeoutRef.current) {
        clearTimeout(activeAgentsTimeoutRef.current);
      }
    };
  }, []);

  return {
    activities,
    latestActivity,
    activeAgents,
    clearActivities,
    isReceiving,
    addActivity,
  };
}

/**
 * Hook for processing activity logs from WebSocket messages
 * This is meant to be used in conjunction with an existing WebSocket connection
 */
export function useActivityLogProcessor(options: UseActivityLogOptions = {}) {
  const activityLog = useActivityLog(options);

  /**
   * Process a WebSocket message and extract activity logs
   */
  const processMessage = useCallback(
    (message: MessageEvent) => {
      try {
        const data = JSON.parse(message.data);

        // Check if this is an activity log message
        if (data.type === 'activity_log' && data.data) {
          const activityMsg = data as ActivityLogMessage;
          activityLog.clearActivities(); // Clear old activities for new message

          // In case of batch activities (from REST API response)
          if (Array.isArray(data.data)) {
            data.data.forEach((activity: ActivityLog) => {
              // Process each activity (this is handled by useActivityLog's internal logic)
            });
          }
        }
      } catch (error) {
        console.error('[useActivityLogProcessor] Failed to parse message:', error);
      }
    },
    [activityLog]
  );

  return {
    ...activityLog,
    processMessage,
  };
}
