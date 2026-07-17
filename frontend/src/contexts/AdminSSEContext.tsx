/**
 * AdminSSEContext - Centralized SSE connection management for admin dashboard
 * 
 * This context provides a single SSE connection shared across all admin pages,
 * preventing multiple connections and simplifying event handling.
 * 
 * Features:
 * - Single SSE connection per admin session
 * - Event subscription/unsubscription for components
 * - Connection status tracking
 * - Automatic reconnection with exponential backoff
 * - React 18 Strict Mode compatible
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';

// ============================================================================
// Types
// ============================================================================

export interface SSEEvent {
  id?: string;
  type: string;
  data: unknown;
  timestamp: string;
}

export type SSEEventHandler = (event: SSEEvent) => void;

interface AdminSSEContextValue {
  /** Whether SSE connection is established */
  isConnected: boolean;
  /** Connection error message if any */
  error: string | null;
  /** Subscribe to SSE events */
  subscribe: (eventTypes: string[], handler: SSEEventHandler) => () => void;
  /** Manually trigger reconnection */
  reconnect: () => void;
  /** Recent events (last 20) for debugging */
  recentEvents: SSEEvent[];
}

// ============================================================================
// Context
// ============================================================================

const AdminSSEContext = createContext<AdminSSEContextValue | null>(null);

// ============================================================================
// Custom Error for non-retryable errors
// ============================================================================

class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}

// ============================================================================
// Provider Component
// ============================================================================

interface AdminSSEProviderProps {
  children: React.ReactNode;
  /** SSE endpoint URL */
  url?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export function AdminSSEProvider({
  children,
  url = '/api/v1/admin/sse/events',
  debug = process.env.NODE_ENV === 'development',
}: AdminSSEProviderProps) {
  const { data: session, status: sessionStatus } = useSession();
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<SSEEvent[]>([]);
  
  // Refs for stable values
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const connectionIdRef = useRef(0);
  
  // Subscribers: Map of handler ID -> { eventTypes, handler }
  const subscribersRef = useRef<Map<number, { eventTypes: string[]; handler: SSEEventHandler }>>(new Map());
  const nextSubscriberIdRef = useRef(0);

  // Logging helper
  const log = useCallback((message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[AdminSSE] ${message}`, ...args);
    }
  }, [debug]);

  // Dispatch event to all matching subscribers
  const dispatchEvent = useCallback((event: SSEEvent) => {
    subscribersRef.current.forEach(({ eventTypes, handler }) => {
      // Call handler if no filter or event type matches
      if (eventTypes.length === 0 || eventTypes.includes(event.type)) {
        try {
          handler(event);
        } catch (err) {
          console.error('[AdminSSE] Handler error:', err);
        }
      }
    });
  }, []);

  // Subscribe to events
  const subscribe = useCallback((eventTypes: string[], handler: SSEEventHandler): (() => void) => {
    const id = nextSubscriberIdRef.current++;
    subscribersRef.current.set(id, { eventTypes, handler });
    log(`Subscriber ${id} registered for: ${eventTypes.join(', ') || 'all events'}`);
    
    // Return unsubscribe function
    return () => {
      subscribersRef.current.delete(id);
      log(`Subscriber ${id} unregistered`);
    };
  }, [log]);

  // Calculate reconnect delay with exponential backoff
  const calculateReconnectDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    return Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay);
  }, []);

  // Main connect function
  const connect = useCallback(async (accessToken: string) => {
    if (!isMountedRef.current) return;

    // Increment connection ID to track this attempt
    const currentConnectionId = ++connectionIdRef.current;

    // Cleanup existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    log(`Connecting (attempt #${currentConnectionId})...`);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await fetchEventSource(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
        openWhenHidden: true,

        async onopen(response) {
          // Check if superseded by newer connection
          if (currentConnectionId !== connectionIdRef.current) {
            log(`Connection #${currentConnectionId} superseded`);
            controller.abort();
            return;
          }

          if (!isMountedRef.current) return;

          if (response.ok && response.headers.get('content-type')?.includes(EventStreamContentType)) {
            log(`Connected (#${currentConnectionId})`);
            setIsConnected(true);
            setError(null);
            reconnectAttemptsRef.current = 0;
          } else if (response.status === 401 || response.status === 403) {
            throw new FatalError(`Authentication failed: ${response.status}`);
          } else if (response.status >= 400 && response.status < 500) {
            throw new FatalError(`Client error: ${response.status}`);
          } else {
            throw new Error(`Server error: ${response.status}`);
          }
        },

        onmessage(ev) {
          if (currentConnectionId !== connectionIdRef.current) return;
          if (!isMountedRef.current) return;

          try {
            const eventType = ev.event || 'message';
            const data = ev.data ? JSON.parse(ev.data) : {};
            
            const sseEvent: SSEEvent = {
              id: ev.id,
              type: eventType,
              data,
              timestamp: new Date().toISOString(),
            };

            // Skip ping events from recent events list
            if (eventType !== 'ping') {
              setRecentEvents(prev => [sseEvent, ...prev].slice(0, 20));
            }

            // Dispatch to subscribers
            dispatchEvent(sseEvent);

          } catch (err) {
            log('Failed to parse event:', err);
          }
        },

        onclose() {
          if (currentConnectionId !== connectionIdRef.current) return;
          if (!isMountedRef.current) return;

          log('Connection closed by server');
          setIsConnected(false);

          // Auto-reconnect
          const delay = calculateReconnectDelay();
          reconnectAttemptsRef.current++;
          log(`Reconnecting in ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && currentConnectionId === connectionIdRef.current) {
              connect(accessToken);
            }
          }, delay);
        },

        onerror(err) {
          if (currentConnectionId !== connectionIdRef.current) return;
          if (!isMountedRef.current) return;

          log('Connection error:', err);
          setIsConnected(false);

          if (err instanceof FatalError) {
            setError(err.message);
            throw err;
          }

          setError('Connection error');
          reconnectAttemptsRef.current++;
          return calculateReconnectDelay();
        },
      });
    } catch (err) {
      if (err instanceof FatalError) {
        log('Fatal error:', err.message);
        setError(err.message);
      } else if (err instanceof Error && err.name === 'AbortError') {
        log('Connection aborted');
      } else {
        log('Connection failed:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
      setIsConnected(false);
    }
  }, [url, log, dispatchEvent, calculateReconnectDelay]);

  // Disconnect function
  const disconnect = useCallback(() => {
    log('Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsConnected(false);
  }, [log]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    log('Manual reconnect triggered');
    reconnectAttemptsRef.current = 0;
    disconnect();

    const accessToken = session?.accessToken || session?.user?.accessToken;
    if (accessToken) {
      setTimeout(() => {
        if (isMountedRef.current) {
          connect(accessToken);
        }
      }, 100);
    }
  }, [connect, disconnect, log, session?.accessToken, session?.user?.accessToken]);

  // Connect when session is authenticated
  useEffect(() => {
    isMountedRef.current = true;

    if (sessionStatus !== 'authenticated') {
      return;
    }

    const accessToken = session?.accessToken || session?.user?.accessToken;
    if (!accessToken) {
      return;
    }

    // Delay to handle React Strict Mode double-mount
    const connectTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        connect(accessToken);
      }
    }, 150);

    return () => {
      isMountedRef.current = false;
      clearTimeout(connectTimeout);
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  const contextValue: AdminSSEContextValue = {
    isConnected,
    error,
    subscribe,
    reconnect,
    recentEvents,
  };

  return (
    <AdminSSEContext.Provider value={contextValue}>
      {children}
    </AdminSSEContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the admin SSE context
 */
export function useAdminSSE(): AdminSSEContextValue {
  const context = useContext(AdminSSEContext);
  if (!context) {
    throw new Error('useAdminSSE must be used within an AdminSSEProvider');
  }
  return context;
}

/**
 * Hook to subscribe to specific SSE events
 * 
 * @example
 * ```tsx
 * useSSESubscription(['alert_created', 'case_updated'], (event) => {
 *   console.log('Received:', event);
 * });
 * ```
 */
export function useSSESubscription(
  eventTypes: string[],
  handler: SSEEventHandler,
  deps: React.DependencyList = []
) {
  const { subscribe } = useAdminSSE();
  const handlerRef = useRef(handler);

  // Update handler ref when handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Subscribe with stable reference
  useEffect(() => {
    const unsubscribe = subscribe(eventTypes, (event) => {
      handlerRef.current(event);
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, ...deps]);
}

/**
 * Hook to subscribe to a single SSE event type with a handler
 * Simplified wrapper around useSSESubscription for single event types
 * 
 * @example
 * ```tsx
 * useSSEEventHandler('alert_created', useCallback((data) => {
 *   console.log('Alert:', data);
 * }, []));
 * ```
 */
export function useSSEEventHandler<T = unknown>(
  eventType: string,
  handler: (data: T) => void
) {
  useSSESubscription([eventType], (event) => {
    handler(event.data as T);
  }, [eventType]);
}
