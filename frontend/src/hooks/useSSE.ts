/**
 * useSSE Hook - Server-Sent Events (SSE) connection management
 * 
 * Uses @microsoft/fetch-event-source for proper header support and
 * better reconnection handling compared to native EventSource.
 * 
 * Features:
 * - Supports Authorization header (not possible with native EventSource)
 * - Auto-reconnect with exponential backoff
 * - Event type filtering
 * - Connection status tracking
 * - Cleanup on unmount
 * 
 * @example
 * ```tsx
 * const { isConnected, events, error } = useSSE({
 *   url: '/api/v1/admin/sse/events',
 *   onEvent: (event) => {
 *     if (event.type === 'alert_created') {
 *       toast({ title: event.data.title });
 *     }
 *   },
 *   eventTypes: ['alert_created', 'case_updated']
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';
import { useSession } from 'next-auth/react';

export interface SSEEvent {
  id?: string;
  type: string;
  data: unknown;
  timestamp?: string;
}

export interface UseSSEOptions {
  /** SSE endpoint URL */
  url: string;
  /** Callback when event is received */
  onEvent?: (event: SSEEvent) => void;
  /** Filter specific event types (if empty, receive all) */
  eventTypes?: string[];
  /** Enable auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export interface UseSSEReturn {
  /** Connection status */
  isConnected: boolean;
  /** Recent events buffer (last 50) */
  events: SSEEvent[];
  /** Connection error if any */
  error: string | null;
  /** Manual reconnect */
  reconnect: () => void;
  /** Manual disconnect */
  disconnect: () => void;
  /** Clear events buffer */
  clearEvents: () => void;
}

// Custom error class for fatal errors that shouldn't trigger retry
class FatalError extends Error {}

export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const {
    url,
    onEvent,
    eventTypes = [],
    autoReconnect = true,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
    debug = false,
  } = options;

  const { data: session, status: sessionStatus } = useSession();

  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);
  const connectionIdRef = useRef(0); // Track connection attempts to handle Strict Mode
  
  // Stable refs for callbacks and options to avoid dependency changes
  const onEventRef = useRef(onEvent);
  const eventTypesRef = useRef(eventTypes);
  const autoReconnectRef = useRef(autoReconnect);
  const urlRef = useRef(url);
  
  // Update refs when values change
  useEffect(() => {
    onEventRef.current = onEvent;
    eventTypesRef.current = eventTypes;
    autoReconnectRef.current = autoReconnect;
    urlRef.current = url;
  }, [onEvent, eventTypes, autoReconnect, url]);

  const log = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (message: string, ...args: any[]) => {
      if (debug) {
        console.log(`[useSSE] ${message}`, ...args);
      }
    },
    [debug]
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const addEvent = useCallback((event: SSEEvent) => {
    setEvents((prev) => {
      const newEvents = [event, ...prev].slice(0, 50); // Keep last 50 events
      return newEvents;
    });
  }, []);

  const calculateReconnectDelay = useCallback(() => {
    // Exponential backoff: delay * 2^attempts, capped at maxReconnectDelay
    const delay = Math.min(
      reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      maxReconnectDelay
    );
    return delay;
  }, [reconnectDelay, maxReconnectDelay]);

  const connect = useCallback(async (accessToken: string) => {
    if (!isMountedRef.current) return;
    if (isConnectingRef.current) {
      log('Already connecting, skipping duplicate connect call');
      return;
    }

    // Increment connection ID for this attempt
    const currentConnectionId = ++connectionIdRef.current;

    // Clean up existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    isConnectingRef.current = true;
    log(`Connecting to SSE endpoint (attempt #${currentConnectionId}):`, urlRef.current);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await fetchEventSource(urlRef.current, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
        openWhenHidden: true, // Keep connection alive even when tab is hidden

        async onopen(response) {
          // Check if this connection was superseded by a newer one (React Strict Mode)
          if (currentConnectionId !== connectionIdRef.current) {
            log(`Connection #${currentConnectionId} superseded by #${connectionIdRef.current}, closing`);
            controller.abort();
            return;
          }
          
          if (!isMountedRef.current) return;
          isConnectingRef.current = false;

          if (response.ok && response.headers.get('content-type')?.includes(EventStreamContentType)) {
            log(`SSE connection #${currentConnectionId} established`);
            setIsConnected(true);
            setError(null);
            reconnectAttemptsRef.current = 0; // Reset reconnect attempts on success
            return;
          } else if (response.status === 401 || response.status === 403) {
            // Authentication error - don't retry
            throw new FatalError(`Authentication failed: ${response.status}`);
          } else if (response.status >= 400 && response.status < 500) {
            // Client error - don't retry
            throw new FatalError(`Client error: ${response.status}`);
          } else {
            // Server error - will retry
            throw new Error(`Server error: ${response.status}`);
          }
        },

        onmessage(ev) {
          // Ignore messages if this connection was superseded
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

            log(`Received ${eventType} event:`, sseEvent);

            // Check if we should process this event type
            const shouldProcess = 
              eventTypesRef.current.length === 0 || 
              eventTypesRef.current.includes(eventType);

            if (shouldProcess) {
              // Add to events buffer (except ping)
              if (eventType !== 'ping') {
                addEvent(sseEvent);
              }

              // Call event handler
              onEventRef.current?.(sseEvent);
            }
          } catch (err) {
            log('Failed to parse SSE event:', err);
          }
        },

        onclose() {
          // Ignore close if this connection was superseded
          if (currentConnectionId !== connectionIdRef.current) {
            log(`Connection #${currentConnectionId} close ignored (superseded)`);
            return;
          }
          if (!isMountedRef.current) return;

          log(`SSE connection #${currentConnectionId} closed by server`);
          setIsConnected(false);
          isConnectingRef.current = false;
          
          // Auto-reconnect if enabled
          if (autoReconnectRef.current && accessToken) {
            const delay = calculateReconnectDelay();
            reconnectAttemptsRef.current++;
            log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && autoReconnectRef.current && currentConnectionId === connectionIdRef.current) {
                connect(accessToken);
              }
            }, delay);
          }
        },

        onerror(err) {
          // Ignore errors if this connection was superseded
          if (currentConnectionId !== connectionIdRef.current) return;
          if (!isMountedRef.current) return;

          log(`SSE connection #${currentConnectionId} error:`, err);
          setIsConnected(false);
          isConnectingRef.current = false;

          if (err instanceof FatalError) {
            // Don't retry on fatal errors
            setError(err.message);
            throw err; // Stop retrying
          }

          setError('Connection error occurred');
          
          // Track our attempts
          reconnectAttemptsRef.current++;
          
          // Return the calculated delay for the library's retry mechanism
          return calculateReconnectDelay();
        },
      });
    } catch (err) {
      isConnectingRef.current = false;
      if (err instanceof FatalError) {
        log('Fatal error, not retrying:', err.message);
        setError(err.message);
      } else if (err instanceof Error && err.name === 'AbortError') {
        log(`Connection #${currentConnectionId} aborted (intentional disconnect or superseded)`);
      } else {
        log('Connection failed:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
      setIsConnected(false);
    }
  }, [addEvent, calculateReconnectDelay, log]);

  const disconnect = useCallback(() => {
    log('Disconnecting SSE...');
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    isConnectingRef.current = false;
    setIsConnected(false);
  }, [log]);

  const reconnect = useCallback(() => {
    log('Manual reconnect triggered');
    reconnectAttemptsRef.current = 0; // Reset attempts for manual reconnect
    disconnect();
    
    // Get access token and reconnect
    const accessToken = session?.accessToken || session?.user?.accessToken;
    if (accessToken) {
      // Small delay before reconnecting
      setTimeout(() => {
        if (isMountedRef.current) {
          connect(accessToken);
        }
      }, 100);
    }
  }, [connect, disconnect, log, session?.accessToken, session?.user?.accessToken]);

  // Auto-connect when session is available - stable effect
  useEffect(() => {
    isMountedRef.current = true;
    
    // Only connect when session is authenticated and we have a token
    if (sessionStatus !== 'authenticated') {
      return;
    }
    
    const accessToken = session?.accessToken || session?.user?.accessToken;
    if (!accessToken) {
      return;
    }

    // Small delay to allow React Strict Mode's double-mount to settle
    // This prevents the first connection from being immediately aborted
    const connectTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        connect(accessToken);
      }
    }, 100);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      clearTimeout(connectTimeout);
      disconnect();
    };
  // Only depend on session status changing, not the full session object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  return {
    isConnected,
    events,
    error,
    reconnect,
    disconnect,
    clearEvents,
  };
}
