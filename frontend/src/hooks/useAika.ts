/**
 * useAika Hook
 * 
 * React hook for interacting with the Aika Meta-Agent orchestrator.
 * This replaces direct agent calls with a unified LangGraph-orchestrated interface.
 * 
 * Features:
 * - Unified API endpoint (/api/v1/aika)
 * - Role-based routing (user=student/admin/counselor)
 * - Agent activity tracking
 * - Risk assessment monitoring
 * - Escalation notifications
 */

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

export interface AikaMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface AikaRiskAssessment {
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  risk_score: number;
  confidence: number;
  risk_factors: string[];
}

export interface AikaMetadata {
  session_id: string;
  user_role: 'user' | 'admin' | 'counselor';
  intent: string;
  agents_invoked: string[];  // e.g., ["STA", "TCA"]
  actions_taken: string[];   // e.g., ["assess_risk", "provide_cbt_support"]
  processing_time_ms: number;
  risk_assessment?: AikaRiskAssessment;
  escalation_triggered: boolean;
  case_id?: string;  // If case was created
  activity_logs?: any[]; // Detailed execution logs from LangGraph

  // Monitoring: per-user-prompt LLM usage (includes tool-call followups)
  llm_prompt_id?: string;
  llm_request_count?: number;
  llm_requests_by_model?: Record<string, number>;
  tools_used?: string[];

  // Fallback signalling — present when the response was produced by an error-recovery branch.
  is_fallback?: boolean;
  fallback_type?: 'rate_limit' | 'model_error';
  /** Suggested client-side cooldown in milliseconds before retrying. */
  retry_after_ms?: number;
}

export interface AikaResponse {
  success: boolean;
  response: string;
  metadata: AikaMetadata;
  error?: string;
  /** True when the response came from an error-recovery branch (rate-limit or model error). */
  isFallback?: boolean;
}

export interface AikaRequest {
  user_id: number;
  role: 'user' | 'admin' | 'counselor';
  message: string;
  conversation_history: AikaMessage[];
  preferred_model?: string;
  session_id?: string;
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_end' | 'tool_use';
  tool?: string;
  tools?: string[];
  timestamp: string;
}

export interface ReasoningTrace {
  id: string;
  stage: string;
  summary: string;
  sourceNode: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
  needsAgents?: boolean;
  riskLevel?: string;
}

interface UseAikaOptions {
  onAgentActivity?: (agents: string[]) => void;
  onRiskDetected?: (assessment: AikaRiskAssessment) => void;
  onEscalation?: (caseId: string) => void;
  onPartialResponse?: (text: string) => void;
  onAgentActivityData?: (activity: Record<string, unknown>) => void;
  onInterventionPlan?: (plan: Record<string, unknown>) => void;
  onAppointment?: (appointment: Record<string, unknown>) => void;
  onToolEvent?: (event: ToolEvent) => void;
  onStatusUpdate?: (message: string) => void;
  onReasoning?: (trace: ReasoningTrace) => void;
  showToasts?: boolean;
}

type AikaStreamEventType =
  | 'agent'
  | 'tool_start'
  | 'tool_end'
  | 'tool_use'
  | 'text_chunk'
  | 'status'
  | 'thinking'
  | 'reasoning'
  | 'agent_activity'
  | 'intervention_plan'
  | 'appointment'
  | 'complete'
  | 'error';

interface AikaStreamEventPayload {
  type: AikaStreamEventType;
  agent?: string;
  tool?: string;
  tools?: string[];
  text?: string;
  message?: string;
  data?: Record<string, unknown>;
  response?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

const SSE_DATA_PREFIX = 'data: ';

function buildAikaEndpoint(): string {
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  return apiOrigin ? `${apiOrigin}/api/v1/aika` : '/api/v1/aika';
}

function splitSseFrames(buffer: string): { frames: string[]; remainder: string } {
  const chunks = buffer.split('\n\n');
  return {
    frames: chunks.slice(0, -1),
    remainder: chunks[chunks.length - 1] || '',
  };
}

function parseSseFrame(frame: string): AikaStreamEventPayload | null {
  if (!frame.startsWith(SSE_DATA_PREFIX)) {
    return null;
  }

  const jsonRaw = frame.slice(SSE_DATA_PREFIX.length).trim();
  if (!jsonRaw) {
    return null;
  }

  return JSON.parse(jsonRaw) as AikaStreamEventPayload;
}

function buildReasoningTrace(event: AikaStreamEventPayload): ReasoningTrace {
  const reasoningData = (event.data || {}) as Record<string, unknown>;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage: String(reasoningData.stage || 'unknown'),
    summary: String(reasoningData.summary || event.message || 'Reasoning update'),
    sourceNode: String(reasoningData.source_node || 'unknown'),
    timestamp: String(reasoningData.timestamp || new Date().toISOString()),
    intent: typeof reasoningData.intent === 'string' ? reasoningData.intent : undefined,
    confidence: typeof reasoningData.confidence === 'number' ? reasoningData.confidence : undefined,
    needsAgents: typeof reasoningData.needs_agents === 'boolean' ? reasoningData.needs_agents : undefined,
    riskLevel: typeof reasoningData.risk_level === 'string' ? reasoningData.risk_level : undefined,
  };
}

function buildAikaMetadataFromComplete(
  metadata: Record<string, unknown> | undefined,
  invokedAgents: Set<string>
): AikaMetadata | null {
  if (!metadata) {
    return null;
  }

  return {
    session_id: typeof metadata.session_id === 'string' ? metadata.session_id : '',
    user_role: (metadata.user_role as 'user' | 'admin' | 'counselor') || 'user',
    intent: typeof metadata.intent === 'string' ? metadata.intent : 'unknown',
    agents_invoked: (metadata.agents_invoked as string[]) || Array.from(invokedAgents),
    actions_taken: (metadata.actions_taken as string[]) || [],
    processing_time_ms: typeof metadata.processing_time_ms === 'number' ? metadata.processing_time_ms : 0,
    risk_assessment: metadata.risk_assessment as AikaRiskAssessment | undefined,
    escalation_triggered: Boolean(metadata.escalation_triggered),
    case_id: metadata.case_id as string | undefined,
    activity_logs: metadata.activity_logs as any[] | undefined,
    llm_prompt_id: metadata.llm_prompt_id as string | undefined,
    llm_request_count: metadata.llm_request_count as number | undefined,
    llm_requests_by_model: metadata.llm_requests_by_model as Record<string, number> | undefined,
    tools_used: metadata.tools_used as string[] | undefined,
    is_fallback: Boolean(metadata.is_fallback),
    fallback_type: metadata.fallback_type as 'rate_limit' | 'model_error' | undefined,
    retry_after_ms: typeof metadata.retry_after_ms === 'number' ? metadata.retry_after_ms : 0,
  };
}

export function useAika(options: UseAikaOptions = {}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMetadata, setLastMetadata] = useState<AikaMetadata | null>(null);

  const {
    onAgentActivity,
    onAgentActivityData,
    onRiskDetected,
    onEscalation,
    onInterventionPlan,
    onAppointment,
    onPartialResponse,
    onToolEvent,
    onStatusUpdate,
    onReasoning,
    showToasts = true,
  } = options;

  /**
   * Send a message to Aika Meta-Agent over an SSE stream.
   *
   * Stream events are normalized through small helpers above so the main logic
   * stays readable and easier to maintain.
   */
  const sendMessage = useCallback(async (
    message: string,
    conversationHistory: AikaMessage[] = [],
    role: 'user' | 'admin' | 'counselor' = 'user',
    preferredModel?: string,
    sessionId?: string,
  ): Promise<AikaResponse | null> => {
    if (!session?.user?.id) {
      const errorMsg = 'User not authenticated';
      setError(errorMsg);
      if (showToasts) {
        toast.error('Anda harus login terlebih dahulu');
      }
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = buildAikaEndpoint();

      const requestBody: AikaRequest = {
        user_id: parseInt(session.user.id),
        role,
        message,
        conversation_history: conversationHistory.slice(-10), // Last 10 messages
        ...(sessionId ? { session_id: sessionId } : {}),
      };

      if (preferredModel && preferredModel.trim().length > 0) {
        requestBody.preferred_model = preferredModel;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const MAX_BUFFER_SIZE = 2 * 1024 * 1024; // 2 MB

      let finalResponse = '';
      let finalMetadata: AikaMetadata | null = null;
      const invokedAgents = new Set<string>();
      let receivedStreamChunks = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        if (buffer.length + decoded.length <= MAX_BUFFER_SIZE) {
          buffer += decoded;
        }
        const { frames, remainder } = splitSseFrames(buffer);
        buffer = remainder;

        for (const frame of frames) {
          try {
            const event = parseSseFrame(frame);
            if (!event) {
              continue;
            }

            switch (event.type) {
              case 'agent': {
                const agentName = event.agent;
                if (!agentName) {
                  break;
                }
                invokedAgents.add(agentName);
                onAgentActivity?.(Array.from(invokedAgents));
                break;
              }

              case 'tool_start':
                if (event.tool) {
                  onToolEvent?.({ type: 'tool_start', tool: event.tool, timestamp: new Date().toISOString() });
                }
                break;

              case 'tool_end':
                if (event.tool) {
                  onToolEvent?.({ type: 'tool_end', tool: event.tool, timestamp: new Date().toISOString() });
                }
                break;

              case 'tool_use':
                onToolEvent?.({ type: 'tool_use', tools: event.tools, timestamp: new Date().toISOString() });
                break;

              case 'text_chunk':
                if (typeof event.text === 'string') {
                  receivedStreamChunks = true;
                  onPartialResponse?.(event.text);
                }
                break;

              case 'status':
                if (typeof event.message === 'string') {
                  onStatusUpdate?.(event.message);
                }
                break;

              case 'thinking':
                if (typeof event.message === 'string') {
                  onStatusUpdate?.(`Thinking: ${event.message}`);
                }
                break;

              case 'reasoning': {
                const trace = buildReasoningTrace(event);
                onReasoning?.(trace);
                onStatusUpdate?.(`Reasoning: ${trace.summary}`);
                break;
              }

              case 'agent_activity':
                if (event.data) {
                  onAgentActivityData?.(event.data);
                }
                break;

              case 'intervention_plan':
                if (event.data) {
                  onInterventionPlan?.(event.data);
                }
                break;

              case 'appointment':
                if (event.data) {
                  onAppointment?.(event.data);
                }
                break;

              case 'complete': {
                finalResponse = event.response || finalResponse;
                const mapped = buildAikaMetadataFromComplete(event.metadata, invokedAgents);
                if (mapped) {
                  finalMetadata = mapped;
                  setLastMetadata(mapped);
                }
                break;
              }

              case 'error':
                throw new Error(event.message || event.error || 'Unknown error');
            }
          } catch (parseOrEventError) {
            if (parseOrEventError instanceof SyntaxError) {
              console.error('Error parsing SSE frame:', parseOrEventError, 'Raw frame:', frame);
            } else {
              throw parseOrEventError;
            }
          }
        }
      }

      if (!finalMetadata) {
        throw new Error('Incomplete response from Aika');
      }

      const result: AikaResponse = {
        success: true,
        response: finalResponse,
        metadata: finalMetadata,
        isFallback: finalMetadata.is_fallback === true,
      };

      // Handle risk detection
      if (finalMetadata.risk_assessment) {
        const { risk_level } = finalMetadata.risk_assessment;

        if (onRiskDetected) {
          onRiskDetected(finalMetadata.risk_assessment);
        }

        // Show risk notifications
        if (showToasts) {
          if (risk_level === 'critical') {
            toast.error(
              '🚨 Tim profesional kami telah dihubungi untuk membantu Anda.',
              { duration: 6000 }
            );
          } else if (risk_level === 'high') {
            toast(
              '⚠️ Keselamatanmu penting. Pertimbangkan untuk menghubungi layanan dukungan.',
              {
                duration: 5000,
                icon: '⚠️',
                style: {
                  background: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FCD34D'
                }
              }
            );
          }
        }
      }

      // Handle escalation
      if (finalMetadata.escalation_triggered && finalMetadata.case_id) {
        if (onEscalation) {
          onEscalation(finalMetadata.case_id);
        }

        if (showToasts) {
          toast.success(
            '✅ Kasusmu telah disampaikan ke konselor profesional.',
            { duration: 5000 }
          );
        }
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);

      if (showToasts) {
        toast.error(`Terjadi kesalahan: ${errorMessage}`);
      }

      console.error('Aika API Error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [
    session,
    onAgentActivity,
    onAgentActivityData,
    onEscalation,
    onInterventionPlan,
    onAppointment,
    onPartialResponse,
    onReasoning,
    onRiskDetected,
    onStatusUpdate,
    onToolEvent,
    showToasts,
  ]);

  /**
   * Get risk level color for UI
   */
  const getRiskLevelColor = useCallback((riskLevel: string): string => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'moderate':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low':
        return 'text-green-500 bg-green-500/10 border-green-500/30';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  }, []);

  /**
   * Get agent display name
   */
  const getAgentDisplayName = useCallback((agentCode: string): string => {
    const agentNames: Record<string, string> = {
      STA: 'Safety Triage',
      TCA: 'Therapeutic Coach',
      CMA: 'Case Management',
      IA: 'Insights',
    };
    return agentNames[agentCode] || agentCode;
  }, []);

  return {
    sendMessage,
    loading,
    error,
    lastMetadata,
    getRiskLevelColor,
    getAgentDisplayName,
  };
}
