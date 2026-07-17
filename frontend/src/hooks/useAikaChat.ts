/**
 * useAikaChat Hook
 * 
 * Enhanced chat hook that integrates Aika Meta-Agent orchestration
 * with the existing chat functionality.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { useAika, type AikaMessage, type AikaMetadata, type ReasoningTrace } from './useAika';
import { useThinkingSteps } from '@/hooks/useThinkingSteps';
import type { Appointment, InterventionPlan, Message } from '@/types/chat';

// Activity log entry type for tool/API tracking
export interface ToolActivityLog {
  id: string;
  type: 'tool_start' | 'tool_end' | 'tool_use' | 'status';
  tool?: string;
  tools?: string[];
  message?: string;
  timestamp: string;
}

interface UseAikaChatOptions {
  sessionId: string;
  showAgentActivity?: boolean;
  showRiskIndicators?: boolean;
  preferredModel?: string;
  onToolActivity?: (activity: ToolActivityLog) => void;
}

export function useAikaChat({ 
  sessionId, 
  showAgentActivity = true, 
  showRiskIndicators = true,
  preferredModel,
  onToolActivity 
}: UseAikaChatOptions) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [currentThinking, setCurrentThinking] = useState<string | null>(null);
  const [thinkingTrace, setThinkingTrace] = useState<ReasoningTrace[]>([]);
  const lastConversationIdRef = useRef<string | null>(null);
  const [lastMetadata, setLastMetadata] = useState<AikaMetadata | null>(null);

  // Retry cooldown after a rate-limit fallback (ms remaining until the user can resend).
  const [retryCooldownMs, setRetryCooldownMs] = useState(0);

  // Count down the retry cooldown every second.
  useEffect(() => {
    if (retryCooldownMs <= 0) return;
    const id = window.setTimeout(() => {
      setRetryCooldownMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [retryCooldownMs]);

  // Track streaming state for multi-bubble support
  const currentBubbleIdRef = useRef<string | null>(null);
  const bubbleCountRef = useRef<number>(0);
  const partialResponseBufferRef = useRef<string>('');
  const hasPartialResponseRef = useRef<boolean>(false);
  const latestInterventionPlanRef = useRef<InterventionPlan | null>(null);
  const latestAppointmentRef = useRef<Appointment | null>(null);
  const latestAgentActivityRef = useRef<Message['agentActivity'] | null>(null);

  const mapInterventionPlan = (payload: Record<string, unknown>): InterventionPlan | null => {
    const rawSteps = Array.isArray(payload.plan_steps) ? payload.plan_steps : [];
    const rawResources = Array.isArray(payload.resource_cards) ? payload.resource_cards : [];

    const planSteps = rawSteps
      .map((step, index) => {
        if (!step || typeof step !== 'object') {
          return null;
        }

        const obj = step as Record<string, unknown>;
        const label =
          (typeof obj.label === 'string' && obj.label.trim()) ||
          (typeof obj.title === 'string' && obj.title.trim()) ||
          (typeof obj.description === 'string' && obj.description.trim()) ||
          '';

        if (!label) {
          return null;
        }

        return {
          id: typeof obj.id === 'string' && obj.id.trim() ? obj.id : `step-${index + 1}`,
          label,
          duration_min: typeof obj.duration_min === 'number' ? obj.duration_min : undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const resourceCards = rawResources
      .map((resource, index) => {
        if (!resource || typeof resource !== 'object') {
          return null;
        }

        const obj = resource as Record<string, unknown>;
        const title = typeof obj.title === 'string' ? obj.title : '';
        const summary = typeof obj.summary === 'string'
          ? obj.summary
          : typeof obj.description === 'string'
            ? obj.description
            : '';

        if (!title || !summary) {
          return null;
        }

        return {
          resource_id: typeof obj.resource_id === 'string' && obj.resource_id.trim()
            ? obj.resource_id
            : `resource-${index + 1}`,
          title,
          summary,
          url: typeof obj.url === 'string' ? obj.url : undefined,
          resource_type: typeof obj.resource_type === 'string'
            ? obj.resource_type as 'link' | 'activity' | 'video' | 'article'
            : undefined,
          activity_id: typeof obj.activity_id === 'string' ? obj.activity_id : undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (planSteps.length === 0 && resourceCards.length === 0) {
      return null;
    }

    return {
      plan_steps: planSteps,
      resource_cards: resourceCards,
      next_check_in: typeof payload.next_check_in === 'string' ? payload.next_check_in : undefined,
      intervention_reason: typeof payload.intervention_reason === 'string' ? payload.intervention_reason : undefined,
    };
  };

  const mapAppointment = (payload: Record<string, unknown>): Appointment | null => {
    if (typeof payload.id !== 'number' || typeof payload.appointment_datetime !== 'string') {
      return null;
    }

    const psychologist = payload.psychologist;
    const appointmentType = payload.appointment_type;

    return {
      id: payload.id,
      student_id: typeof payload.student_id === 'number' ? payload.student_id : 0,
      psychologist_id: typeof payload.psychologist_id === 'number' ? payload.psychologist_id : 0,
      appointment_datetime: payload.appointment_datetime,
      appointment_type_id: typeof payload.appointment_type_id === 'number' ? payload.appointment_type_id : 0,
      status: (typeof payload.status === 'string' ? payload.status : 'scheduled') as Appointment['status'],
      notes: typeof payload.notes === 'string' ? payload.notes : undefined,
      location: typeof payload.location === 'string' ? payload.location : undefined,
      psychologist: psychologist && typeof psychologist === 'object'
        ? {
            id: typeof (psychologist as Record<string, unknown>).id === 'number'
              ? (psychologist as Record<string, unknown>).id as number
              : 0,
            full_name: typeof (psychologist as Record<string, unknown>).full_name === 'string'
              ? (psychologist as Record<string, unknown>).full_name as string
              : 'Psikolog',
            specialization: Array.isArray((psychologist as Record<string, unknown>).specialization)
              ? (psychologist as Record<string, unknown>).specialization as string[]
              : undefined,
            languages: Array.isArray((psychologist as Record<string, unknown>).languages)
              ? (psychologist as Record<string, unknown>).languages as string[]
              : undefined,
          }
        : undefined,
      appointment_type: appointmentType && typeof appointmentType === 'object'
        ? {
            id: typeof (appointmentType as Record<string, unknown>).id === 'number'
              ? (appointmentType as Record<string, unknown>).id as number
              : 0,
            name: typeof (appointmentType as Record<string, unknown>).name === 'string'
              ? (appointmentType as Record<string, unknown>).name as string
              : 'Konseling',
            description: typeof (appointmentType as Record<string, unknown>).description === 'string'
              ? (appointmentType as Record<string, unknown>).description as string
              : undefined,
          }
        : undefined,
    };
  };

  const mapAgentActivity = (payload: Record<string, unknown>): Message['agentActivity'] => ({
    execution_path: Array.isArray(payload.execution_path) ? payload.execution_path as string[] : [],
    agents_invoked: Array.isArray(payload.agents_invoked) ? payload.agents_invoked as string[] : [],
    intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
    intent_confidence: typeof payload.intent_confidence === 'number' ? payload.intent_confidence : 0,
    needs_agents: Boolean(payload.needs_agents),
    agent_reasoning: typeof payload.agent_reasoning === 'string' ? payload.agent_reasoning : '',
    response_source: typeof payload.response_source === 'string' ? payload.response_source : 'unknown',
    processing_time_ms: typeof payload.processing_time_ms === 'number' ? payload.processing_time_ms : 0,
    risk_level: typeof payload.risk_level === 'string' ? payload.risk_level : undefined,
    risk_score: typeof payload.risk_score === 'number' ? payload.risk_score : undefined,
  });

  const sanitizeAssistantResponse = (
    rawText: string,
    hasInterventionPlan: boolean,
    hasAppointment: boolean
  ): string => {
    if (!rawText) {
      return '';
    }

    let next = rawText;

    next = next.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (block, body) => {
      if (/plan_steps|resource_cards|intervention_plan|appointment_datetime|psychologist_id|appointment_type_id/i.test(body)) {
        return '';
      }
      return block;
    });

    const trimmed = next.trim();
    if ((hasInterventionPlan || hasAppointment) && /^\{[\s\S]*\}$/.test(trimmed)) {
      if (/plan_steps|resource_cards|intervention_plan|appointment_datetime|psychologist_id|appointment_type_id/i.test(trimmed)) {
        return '';
      }
    }

    return next.trim();
  };

  const findChunkBoundary = (text: string): number => {
    const paragraphBreak = text.lastIndexOf('\n\n');
    if (paragraphBreak >= 0) {
      return paragraphBreak + 2;
    }

    const sentenceMarkers = ['. ', '! ', '? ', '。'];
    let sentenceBoundary = -1;
    for (const marker of sentenceMarkers) {
      const index = text.lastIndexOf(marker);
      if (index > sentenceBoundary) {
        sentenceBoundary = index + marker.length;
      }
    }

    if (sentenceBoundary >= 0 && sentenceBoundary >= 120) {
      return sentenceBoundary;
    }

    if (text.length >= 240) {
      const forcedBoundary = text.lastIndexOf(' ', 220);
      return forcedBoundary >= 0 ? forcedBoundary + 1 : 220;
    }

    return -1;
  };

  const consumePartialChunks = (text: string): { chunks: string[]; remainder: string } => {
    const chunks: string[] = [];
    let remainder = text;

    while (true) {
      const boundary = findChunkBoundary(remainder);
      if (boundary <= 0) {
        break;
      }

      const chunk = remainder.slice(0, boundary).trim();
      remainder = remainder.slice(boundary).trimStart();

      if (chunk) {
        chunks.push(chunk);
      }
    }

    return { chunks, remainder };
  };

  /**
   * Split content into logical sections for multiple message bubbles.
   * This creates a more natural, conversational feel.
   */
  const splitContentIntoSections = (content: string): string[] => {
    const sections: string[] = [];
    
    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n');
    
    // Multiple patterns to detect section breaks:
    // 1. Double newline followed by bold header: **Header** or **Header:**
    // 2. Double newline followed by heading: ## Header or ### Header
    // 3. Double newline followed by numbered list item that looks like a section: 1. **Item**
    const sectionPatterns = [
      /\n\n(?=\*\*[^*\n]+\*\*:?\s*\n)/g,  // **Bold Header** or **Bold Header:**
      /\n\n(?=##+ )/g,                      // Markdown headings
      /\n\n(?=\d+\.\s+\*\*)/g,              // Numbered items with bold
    ];
    
    // Try splitting with each pattern
    let parts = [normalizedContent];
    for (const pattern of sectionPatterns) {
      if (parts.length === 1) {
        const split = parts[0].split(pattern);
        if (split.length > 1) {
          parts = split;
          break;
        }
      }
    }
    
    // If still no split occurred, try splitting by double newlines for very long content
    if (parts.length === 1 && normalizedContent.length > 400) {
      // Split on double newlines, but keep related content together
      const paragraphs = normalizedContent.split(/\n\n+/);
      let currentChunk = '';
      
      for (const para of paragraphs) {
        const trimmedPara = para.trim();
        if (!trimmedPara) continue;
        
        // Check if this paragraph is a header/title (bold text at start)
        const isHeader = /^\*\*[^*]+\*\*/.test(trimmedPara) || /^##+ /.test(trimmedPara);
        
        // Start a new section if:
        // 1. Current chunk is getting long (>350 chars) and this is a header
        // 2. Current chunk is very long (>500 chars)
        if ((currentChunk.length > 350 && isHeader) || currentChunk.length > 500) {
          if (currentChunk.trim()) {
            sections.push(currentChunk.trim());
          }
          currentChunk = trimmedPara;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedPara : trimmedPara;
        }
      }
      
      if (currentChunk.trim()) {
        sections.push(currentChunk.trim());
      }
    } else {
      // Process the parts from pattern splitting
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          sections.push(trimmed);
        }
      }
    }
    
    // If no splitting occurred, return original content
    return sections.length > 0 ? sections : [normalizedContent];
  };

  // Simplified streaming - just accumulate content in a single bubble during streaming
  const {
    sendMessage: sendToAika,
    loading: aikaLoading,
    error: aikaError,
    getRiskLevelColor,
    getAgentDisplayName,
  } = useAika({
    showToasts: true,
    onAgentActivity: (agents) => {
      console.log('🤖 Aika consulted agents:', agents);
      setActiveAgents(agents);
    },
    onRiskDetected: (assessment) => {
      console.log('⚠️ Risk detected:', assessment);
    },
    onEscalation: (caseId) => {
      console.log('🚨 Case escalated:', caseId);
    },
    onToolEvent: (event) => {
      // Forward tool events to parent component for activity logging
      if (onToolActivity) {
        onToolActivity({
          id: uuidv4(),
          type: event.type,
          tool: event.tool,
          tools: event.tools,
          timestamp: event.timestamp,
        });
      }
    },
    onStatusUpdate: (message) => {
      setCurrentThinking(message.replace(/^Thinking:\s*/i, '').replace(/^Reasoning:\s*/i, ''));

      // Forward status updates as activity logs
      if (onToolActivity) {
        onToolActivity({
          id: uuidv4(),
          type: 'status',
          message: message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    onReasoning: (trace) => {
      setCurrentThinking(trace.summary);
      setThinkingTrace((prev) => {
        const next = [...prev, trace];
        if (next.length > 30) {
          return next.slice(next.length - 30);
        }
        return next;
      });
    },
    onAgentActivityData: (activity) => {
      latestAgentActivityRef.current = mapAgentActivity(activity);
    },
    onInterventionPlan: (planPayload) => {
      const mapped = mapInterventionPlan(planPayload);
      if (mapped) {
        latestInterventionPlanRef.current = mapped;
      }
    },
    onAppointment: (appointmentPayload) => {
      const mapped = mapAppointment(appointmentPayload);
      if (mapped) {
        latestAppointmentRef.current = mapped;
      }
    },
    onPartialResponse: (text) => {
      setIsLoading(false);

      hasPartialResponseRef.current = true;
      partialResponseBufferRef.current = `${partialResponseBufferRef.current}${text}`;

      const conversationId = lastConversationIdRef.current || uuidv4();
      lastConversationIdRef.current = conversationId;

      if (!currentBubbleIdRef.current) {
        currentBubbleIdRef.current = uuidv4();
        bubbleCountRef.current = 1;
      }

      const bubbleId = currentBubbleIdRef.current;
      const accumulatedText = partialResponseBufferRef.current;

      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === bubbleId);

        if (index === -1) {
          const message: Message = {
            id: bubbleId,
            role: 'assistant',
            content: accumulatedText,
            timestamp: new Date(),
            session_id: sessionId,
            conversation_id: conversationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isLoading: true,
          };
          return [...prev, message];
        }

        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          content: accumulatedText,
          updated_at: new Date().toISOString(),
        };
        return updated;
      });
    },
  });

  /**
   * Initialize with greeting message
   */
  useEffect(() => {
    if (messages.length === 0) {
      const greetingId = uuidv4();
      const conversationId = uuidv4();
      lastConversationIdRef.current = conversationId;

      setMessages([
        {
          id: greetingId,
          role: 'assistant',
          content: 'Halo! Aku Aika, asisten AI untuk kesehatan mentalmu. Bagaimana kabarmu hari ini? 💙',
          timestamp: new Date(),
          session_id: sessionId,
          conversation_id: conversationId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            isSeedGreeting: true,
          },
        },
      ]);
    }
  }, [sessionId, messages.length]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  /**
   * Send message to Aika
   */
  const handleSendMessage = useCallback(
    async (message?: string) => {
      const userMessageContent = (typeof message === 'string' ? message : inputValue).trim();
      if (!userMessageContent) return;
      if (isLoading || aikaLoading) return;

      const activeConversationId =
        messages.find((m) => m.conversation_id)?.conversation_id || 
        lastConversationIdRef.current || 
        uuidv4();
      lastConversationIdRef.current = activeConversationId;

      // Add user message
      const newUserMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: userMessageContent,
        timestamp: new Date(),
        session_id: sessionId,
        conversation_id: activeConversationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newUserMessage]);
      setInputValue('');
      setIsLoading(true);
      setActiveAgents([]); // Reset active agents
      setCurrentThinking('Aika sedang menganalisis pesanmu...');
      setThinkingTrace([]);
      partialResponseBufferRef.current = '';
      hasPartialResponseRef.current = false;
      bubbleCountRef.current = 0;
      currentBubbleIdRef.current = null;
      latestInterventionPlanRef.current = null;
      latestAppointmentRef.current = null;
      latestAgentActivityRef.current = null;

      try {
        // Prepare conversation history for Aika
        const historyForAika: AikaMessage[] = [...messages, newUserMessage]
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.metadata?.isSeedGreeting)
          .slice(-10) // Last 10 messages
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.created_at,
          }));

        // Send to Aika Meta-Agent
        const aikaResponse = await sendToAika(
          userMessageContent,
          historyForAika,
          'user', // 'user' for students, can be 'counselor' or 'admin' based on user role
          preferredModel,
          sessionId  // Forward stable session_id so all turns belong to the same DB session
        );

        if (!aikaResponse) {
          throw new Error('Failed to get response from Aika');
        }

        // Store metadata for UI display
        setLastMetadata(aikaResponse.metadata);

        // If this was a degraded-mode response, start the retry cooldown so the
        // input is briefly disabled and the user knows to wait before retrying.
        if (aikaResponse.isFallback && aikaResponse.metadata.retry_after_ms) {
          setRetryCooldownMs(aikaResponse.metadata.retry_after_ms);
        }

        const fallbackProps: Partial<Message> = aikaResponse.isFallback
          ? {
              isError: true,
              retryAfterMs: aikaResponse.metadata.retry_after_ms ?? 0,
              fallbackType: aikaResponse.metadata.fallback_type,
            }
          : {};

        const hasStreamedPartials = hasPartialResponseRef.current;
        const streamedBubbleId = currentBubbleIdRef.current;
        const streamedAccumulatedText = partialResponseBufferRef.current;
        const interventionPlan = latestInterventionPlanRef.current;
        const appointment = latestAppointmentRef.current;
        const agentActivity = latestAgentActivityRef.current;

        setMessages((prev) => {
          if (hasStreamedPartials) {
            const sanitizedContent = sanitizeAssistantResponse(
              streamedAccumulatedText,
              Boolean(interventionPlan),
              Boolean(appointment)
            );

            let bubbleIndex = -1;
            if (streamedBubbleId) {
              bubbleIndex = prev.findIndex((m) => m.id === streamedBubbleId);
            }

            if (bubbleIndex === -1) {
              for (let index = prev.length - 1; index >= 0; index -= 1) {
                const item = prev[index];
                if (item.role === 'assistant' && item.conversation_id === activeConversationId && item.isLoading) {
                  bubbleIndex = index;
                  break;
                }
              }
            }

            if (bubbleIndex !== -1) {
              const next = [...prev];
              next[bubbleIndex] = {
                ...next[bubbleIndex],
                content: sanitizedContent || 'Aku sudah menyiapkan detail dukungan untukmu.',
                isLoading: false,
                updated_at: new Date().toISOString(),
                aikaMetadata: aikaResponse.metadata,
                interventionPlan: interventionPlan || undefined,
                appointment: appointment || undefined,
                agentActivity: agentActivity || undefined,
                ...fallbackProps,
              };
              return next;
            }

            if (!sanitizedContent && !interventionPlan && !appointment && !agentActivity) {
              return prev;
            }

            const finalMessage: Message = {
              id: uuidv4(),
              role: 'assistant',
              content: sanitizedContent || 'Aku sudah menyiapkan detail dukungan untukmu.',
              timestamp: new Date(),
              session_id: sessionId,
              conversation_id: activeConversationId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              aikaMetadata: aikaResponse.metadata,
              interventionPlan: interventionPlan || undefined,
              appointment: appointment || undefined,
              agentActivity: agentActivity || undefined,
              ...fallbackProps,
            };

            return [...prev, finalMessage];
          }

          const cleanedResponse = sanitizeAssistantResponse(
            aikaResponse.response,
            Boolean(interventionPlan),
            Boolean(appointment)
          );
          const sections = splitContentIntoSections(cleanedResponse).filter((value) => value.trim().length > 0);

          if (sections.length === 0 && (interventionPlan || appointment || agentActivity)) {
            sections.push('Aku sudah menyiapkan detail dukungan untukmu.');
          }

          const newMessages: Message[] = sections.map((section, idx) => ({
            id: uuidv4(),
            role: 'assistant' as const,
            content: section,
            timestamp: new Date(),
            session_id: sessionId,
            conversation_id: activeConversationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isContinuation: idx > 0,
            aikaMetadata: idx === sections.length - 1 ? aikaResponse.metadata : undefined,
            interventionPlan: idx === sections.length - 1 ? interventionPlan || undefined : undefined,
            appointment: idx === sections.length - 1 ? appointment || undefined : undefined,
            agentActivity: idx === sections.length - 1 ? agentActivity || undefined : undefined,
            ...fallbackProps,
          }));

          return [...prev, ...newMessages];
        });

        partialResponseBufferRef.current = '';
        hasPartialResponseRef.current = false;
        bubbleCountRef.current = 0;
        currentBubbleIdRef.current = null;
        latestInterventionPlanRef.current = null;
        latestAppointmentRef.current = null;
        latestAgentActivityRef.current = null;
      } catch (error) {
        console.error('Aika chat error:', error);

        const streamedBubbleId = currentBubbleIdRef.current;
        const streamedAccumulatedText = partialResponseBufferRef.current;
        const interventionPlan = latestInterventionPlanRef.current;
        const appointment = latestAppointmentRef.current;
        const agentActivity = latestAgentActivityRef.current;

        setMessages((prev) => {
          let bubbleIndex = -1;

          if (streamedBubbleId) {
            bubbleIndex = prev.findIndex((m) => m.id === streamedBubbleId);
          }

          if (bubbleIndex === -1) {
            for (let index = prev.length - 1; index >= 0; index -= 1) {
              const item = prev[index];
              if (item.role === 'assistant' && item.conversation_id === activeConversationId && item.isLoading) {
                bubbleIndex = index;
                break;
              }
            }
          }

          if (bubbleIndex !== -1) {
            const sanitizedContent = sanitizeAssistantResponse(
              streamedAccumulatedText,
              Boolean(interventionPlan),
              Boolean(appointment)
            );
            const next = [...prev];
            next[bubbleIndex] = {
              ...next[bubbleIndex],
              content: sanitizedContent || 'Maaf, terjadi kesalahan. Silakan coba lagi.',
              isLoading: false,
              isError: true,
              updated_at: new Date().toISOString(),
              interventionPlan: interventionPlan || next[bubbleIndex].interventionPlan,
              appointment: appointment || next[bubbleIndex].appointment,
              agentActivity: agentActivity || next[bubbleIndex].agentActivity,
            };
            return next;
          }

          const errorMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
            timestamp: new Date(),
            session_id: sessionId,
            conversation_id: activeConversationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isError: true,
          };

          return [...prev, errorMessage];
        });
      } finally {
        setIsLoading(false);
        setActiveAgents([]); // Clear active agents when done
        setCurrentThinking(null);
        partialResponseBufferRef.current = '';
        hasPartialResponseRef.current = false;
        bubbleCountRef.current = 0;
        currentBubbleIdRef.current = null;
        latestInterventionPlanRef.current = null;
        latestAppointmentRef.current = null;
        latestAgentActivityRef.current = null;
      }
    },
    [
      inputValue,
      isLoading,
      aikaLoading,
      messages,
      sessionId,
      sendToAika,
      preferredModel,
    ]
  );

  /**
   * Clear chat history
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    lastConversationIdRef.current = null;
  }, []);

  const isChatLoading = isLoading || aikaLoading;

  const { steps: thinkingSteps, elapsedSeconds } = useThinkingSteps({
    thinkingTrace,
    activeAgents,
    isActive: isChatLoading,
  });

  return {
    messages,
    inputValue,
    isLoading: isChatLoading,
    /** Milliseconds remaining in the post-fallback retry cooldown. 0 when no cooldown is active. */
    retryCooldownMs,
    activeAgents,
    currentThinking,
    thinkingTrace,
    thinkingSteps,
    elapsedSeconds,
    error: aikaError,
    lastMetadata,
    handleInputChange,
    handleSendMessage,
    clearMessages,
    getRiskLevelColor,
    getAgentDisplayName,
  };
}
