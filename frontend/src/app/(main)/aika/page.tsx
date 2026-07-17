/**
 * Aika Enhanced Chat Page
 * 
 * This is the enhanced version of Aika chat that uses the LangGraph-orchestrated
 * Meta-Agent backend. It maintains the same UI/UX as the original Aika while
 * adding agent activity visibility.
 * 
 * Features:
 * - Same polished UI as original Aika
 * - LangGraph orchestration with agent visibility
 * - Real-time agent activity badges
 * - Risk level indicators
 * - Escalation notifications
 * - Original chat components (MessageBubble, ChatInput, ChatWindow)
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Activity, Eye, EyeOff, X } from 'lucide-react';
import { useAikaChat, type ToolActivityLog } from '@/hooks/useAikaChat';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { ChatWindow } from '@/components/features/chat/ChatWindow';
import { ChatInput } from '@/components/features/chat/ChatInput';
import { AIKA_MEMORY_NOTE } from '@/constants/chat';
import { useInterventionPlans } from '@/hooks/useInterventionPlans';
import { AikaLoadingBubble } from '@/components/features/aika/AikaLoadingBubble';
import {
  RiskLevelIndicator,
  EscalationNotification,
  AikaAvatar,
  AikaPoweredBadge,
} from '@/components/features/aika/AikaComponents';
import { ActivityLogPanel, ActivityIndicator } from '@/components/features/aika/ActivityLogPanel';
import { InterventionPlansSidebar } from '@/components/features/chat/InterventionPlansSidebar';
import { useActivityLog } from '@/hooks/useActivityLog';

// Loading Component
const LoadingIndicator = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-linear-to-br from-[#001d58]/95 via-[#0a2a6e]/95 to-[#173a7a]/95 text-white">
    <div className="text-center">
      <div className="inline-block w-16 h-16 relative">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#FFCA40]"></div>
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
          <Image src="/UGM_Lambang.png" alt="UGM" width={32} height={32} />
        </div>
      </div>
      <p className="mt-4 text-lg">Loading Aika...</p>
    </div>
  </div>
);

export default function AikaEnhancedPage() {
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();
  const { src: profilePictureSrc } = useProfilePicture();
  const router = useRouter();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [isAikaPanelOpen, setIsAikaPanelOpen] = useState(false);
  const [showThinkingTrace, setShowThinkingTrace] = useState(true);

  // Fetch intervention plans
  const {
    data: plansData,
    isLoading: interventionPlansLoading,
    error: interventionPlansError,
    refetch: refetchPlans,
  } = useInterventionPlans(true);

  // Activity logging - must be declared before useAikaChat to pass addActivity
  const {
    activities,
    latestActivity,
    isReceiving,
    addActivity,
  } = useActivityLog({
    enabled: true,
    maxLogs: 100,
  });

  // Handler to convert tool activity logs to activity log format
  const handleToolActivity = useCallback((toolActivity: ToolActivityLog) => {
    // Map tool event types to activity types
    const activityTypeMap: Record<string, 'tool_start' | 'tool_end' | 'tool_use' | 'info'> = {
      'tool_start': 'tool_start',
      'tool_end': 'tool_end',
      'tool_use': 'tool_use',
      'status': 'info',
    };

    const activityType = activityTypeMap[toolActivity.type] || 'info';
    
    // Build message based on event type
    let message = '';
    if (toolActivity.type === 'tool_start' && toolActivity.tools?.length) {
      message = `Starting tools: ${toolActivity.tools.join(', ')}`;
    } else if (toolActivity.type === 'tool_end' && toolActivity.tool) {
      message = `Tool completed: ${toolActivity.tool}`;
    } else if (toolActivity.type === 'tool_use' && toolActivity.tool) {
      message = `Using tool: ${toolActivity.tool}`;
    } else if (toolActivity.message) {
      message = toolActivity.message;
    } else {
      message = `Tool event: ${toolActivity.type}`;
    }

    addActivity({
      timestamp: toolActivity.timestamp,
      activity_type: activityType,
      agent: 'Aika',
      message,
      duration_ms: null,
      details: {
        event: toolActivity.type,
        tool: toolActivity.tool,
        tools: toolActivity.tools,
      }
    });
  }, [addActivity]);

  // Use the Aika chat hook
  const {
    messages,
    inputValue,
    isLoading,
    retryCooldownMs,
    activeAgents,
    currentThinking,
    thinkingTrace,
    thinkingSteps,
    elapsedSeconds,
    error,
    lastMetadata,
    handleInputChange,
    handleSendMessage,
  } = useAikaChat({
    sessionId: 'aika-session-' + new Date().getTime(),
    showAgentActivity: true,
    showRiskIndicators: true,
    onToolActivity: handleToolActivity,
  });

  // Track processed metadata to prevent duplicate logging
  const processedMetadataRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const hasLoggedGreetingRef = useRef<boolean>(false);
  const processedReasoningCountRef = useRef<number>(0);

  // Log initial greeting when component mounts
  useEffect(() => {
    if (!hasLoggedGreetingRef.current && messages.length > 0) {
      const firstMessage = messages[0];
      if (firstMessage.role === 'assistant') {
        addActivity({
          timestamp: new Date().toISOString(),
          activity_type: 'agent_complete',
          agent: 'Aika',
          message: 'Aika initialized and ready',
          duration_ms: null,
          details: { event: 'greeting', content_preview: firstMessage.content.substring(0, 50) + '...' }
        });
        hasLoggedGreetingRef.current = true;
      }
    }
  }, [messages, addActivity]);

  // Log when user sends a message or Aika responds (detect new messages)
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      newMessages.forEach((msg) => {
        if (msg.role === 'user') {
          addActivity({
            timestamp: msg.created_at || new Date().toISOString(),
            activity_type: 'info',
            agent: 'Aika',
            message: `User message received: "${msg.content.substring(0, 40)}${msg.content.length > 40 ? '...' : ''}"`,
            duration_ms: null,
            details: { event: 'user_message', message_id: msg.id }
          });
        }
        // Log Aika's response (non-error assistant messages after greeting)
        if (msg.role === 'assistant' && !msg.isError && hasLoggedGreetingRef.current) {
          addActivity({
            timestamp: msg.created_at || new Date().toISOString(),
            activity_type: 'agent_complete',
            agent: 'Aika',
            message: `Aika responded: "${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}"`,
            duration_ms: null,
            details: { 
              event: 'aika_response', 
              message_id: msg.id,
              content_length: msg.content.length,
              content_preview: msg.content.substring(0, 150) + (msg.content.length > 150 ? '...' : '')
            }
          });
        }
        // Detect error messages
        if (msg.role === 'assistant' && msg.isError) {
          addActivity({
            timestamp: msg.created_at || new Date().toISOString(),
            activity_type: 'agent_error',
            agent: 'Aika',
            message: `Error occurred: ${msg.content}`,
            duration_ms: null,
            details: { event: 'error_response', message_id: msg.id, error_content: msg.content }
          });
        }
      });
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, addActivity]);

  // Log when loading state changes (agent processing start/end)
  const prevLoadingRef = useRef<boolean>(false);
  useEffect(() => {
    if (isLoading && !prevLoadingRef.current) {
      // Processing started
      addActivity({
        timestamp: new Date().toISOString(),
        activity_type: 'agent_start',
        agent: 'Aika',
        message: 'Processing request...',
        duration_ms: null,
        details: { event: 'processing_start' }
      });
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, addActivity]);

  // Log active agents when they change
  const prevActiveAgentsRef = useRef<string[]>([]);
  useEffect(() => {
    if (activeAgents.length > 0) {
      const newAgents = activeAgents.filter(a => !prevActiveAgentsRef.current.includes(a));
      newAgents.forEach((agent) => {
        addActivity({
          timestamp: new Date().toISOString(),
          activity_type: 'agent_start',
          agent: agent,
          message: `${agent} agent activated`,
          duration_ms: null,
          details: { event: 'agent_activated' }
        });
      });
    }
    prevActiveAgentsRef.current = activeAgents;
  }, [activeAgents, addActivity]);

  // Log transparent reasoning trace into activity panel timeline
  useEffect(() => {
    if (thinkingTrace.length === 0) {
      processedReasoningCountRef.current = 0;
      return;
    }

    if (!showThinkingTrace) {
      return;
    }

    if (thinkingTrace.length <= processedReasoningCountRef.current) {
      return;
    }

    const pending = thinkingTrace.slice(processedReasoningCountRef.current);
    pending.forEach((trace) => {
      addActivity({
        timestamp: trace.timestamp,
        activity_type: 'reasoning_trace',
        agent: 'Aika',
        message: trace.summary,
        duration_ms: null,
        details: {
          stage: trace.stage,
          source_node: trace.sourceNode,
          intent: trace.intent,
          confidence: trace.confidence,
          needs_agents: trace.needsAgents,
          risk_level: trace.riskLevel,
        }
      });
    });

    processedReasoningCountRef.current = thinkingTrace.length;
  }, [thinkingTrace, addActivity, showThinkingTrace]);

  // Log errors when they occur
  useEffect(() => {
    if (error) {
      addActivity({
        timestamp: new Date().toISOString(),
        activity_type: 'agent_error',
        agent: 'Aika',
        message: `Error: ${error}`,
        duration_ms: null,
        details: { event: 'error', error: error }
      });
    }
  }, [error, addActivity]);

  // Effect to ingest activity logs from metadata
  useEffect(() => {
    if (lastMetadata?.activity_logs && Array.isArray(lastMetadata.activity_logs)) {
      // Create a unique identifier for this metadata to prevent duplicate logging
      const metadataId = JSON.stringify({
        agents: lastMetadata.agents_invoked,
        time: lastMetadata.processing_time_ms,
        logsCount: lastMetadata.activity_logs.length
      });

      if (processedMetadataRef.current === metadataId) {
        return; // Already processed this metadata
      }
      processedMetadataRef.current = metadataId;

      // Log response completion first
      addActivity({
        timestamp: new Date().toISOString(),
        activity_type: 'agent_complete',
        agent: 'Aika',
        message: `Response generated in ${lastMetadata.processing_time_ms}ms`,
        duration_ms: lastMetadata.processing_time_ms,
        details: {
          event: 'response_complete',
          agents_invoked: lastMetadata.agents_invoked,
          risk_level: lastMetadata.risk_assessment?.risk_level
        }
      });

      // Sort by start time to ensure chronological order
      const sortedLogs = [...lastMetadata.activity_logs].sort((a: any, b: any) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
      );

      sortedLogs.forEach((log: any) => {
        // Infer agent from node name
        let agent = 'Aika';
        if (log.name.includes('sta')) agent = 'STA';
        else if (log.name.includes('tca')) agent = 'TCA';
        else if (log.name.includes('cma')) agent = 'CMA';
        else if (log.name.includes('ia')) agent = 'IA';

        // Determine activity type
        let type: any = 'node_complete';
        if (log.status === 'failed') type = 'agent_error';

        addActivity({
          timestamp: log.completed_at || log.started_at || new Date().toISOString(),
          activity_type: type,
          agent: agent,
          message: `Executed node: ${log.name}`,
          duration_ms: log.duration_ms,
          details: log
        });
      });

      // Log risk assessment if present
      if (lastMetadata.risk_assessment && lastMetadata.risk_assessment.risk_level !== 'low') {
        addActivity({
          timestamp: new Date().toISOString(),
          activity_type: 'risk_assessment',
          agent: 'Aika',
          message: `Risk level detected: ${lastMetadata.risk_assessment.risk_level.toUpperCase()}`,
          duration_ms: null,
          details: lastMetadata.risk_assessment
        });
      }

      // Log escalation if triggered
      if (lastMetadata.escalation_triggered && lastMetadata.case_id) {
        addActivity({
          timestamp: new Date().toISOString(),
          activity_type: 'case_created',
          agent: 'CMA',
          message: `Case escalated: ${lastMetadata.case_id}`,
          duration_ms: null,
          details: { case_id: lastMetadata.case_id, escalation_triggered: true }
        });
      }

      // Log if any intervention-related actions were taken
      const interventionActions = lastMetadata.actions_taken?.filter(
        action => action.includes('intervention') || action.includes('plan')
      );
      if (interventionActions && interventionActions.length > 0) {
        addActivity({
          timestamp: new Date().toISOString(),
          activity_type: 'intervention_created',
          agent: 'IA',
          message: `Intervention actions: ${interventionActions.join(', ')}`,
          duration_ms: null,
          details: { actions: interventionActions }
        });
      }
    }
  }, [lastMetadata, addActivity]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('aika_show_thinking_trace');
    if (saved === '0') {
      setShowThinkingTrace(false);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('aika_show_thinking_trace', showThinkingTrace ? '1' : '0');
  }, [showThinkingTrace]);

  useEffect(() => {
    if (mounted && status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [mounted, status, router]);

  if (!mounted || status === 'loading') {
    return <LoadingIndicator />;
  }

  if (status === 'unauthenticated') {
    return <LoadingIndicator />;
  }

  return (
    <>
      {/* Content area - Fixed positioning to avoid navbar clash */}
      <div className="fixed inset-0 top-18 md:top-20 w-full text-white flex flex-col">
        {/* Main Layout Container */}
        <motion.div
          layout
          transition={{ type: 'spring', damping: 28, stiffness: 220, mass: 0.9 }}
          className="w-full flex-1 flex overflow-hidden min-w-0"
        >
          {/* Chat Panel */}
          <motion.div
            layout
            transition={{ type: 'spring', damping: 28, stiffness: 220, mass: 0.9 }}
            className="flex-1 min-w-0 flex flex-col bg-transparent overflow-hidden min-h-0 p-2 md:p-4 lg:p-6"
          >

            <div className="flex-1 overflow-hidden flex min-h-0">
              {/* Chat area */}
              <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              {/* Agent Activity Indicator */}
              {isReceiving && activeAgents.length > 0 && (
                <div className="px-4 pt-3">
                  <ActivityIndicator
                    activeAgents={activeAgents}
                    latestActivity={latestActivity || undefined}
                  />
                </div>
              )}

              <div className="px-4 pt-3">
                <div className="mx-auto w-full max-w-3xl flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowThinkingTrace((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50"
                    aria-pressed={showThinkingTrace}
                    aria-label={showThinkingTrace ? 'Hide Aika Thinking Trace' : 'Show Aika Thinking Trace'}
                    title={showThinkingTrace ? 'Hide Aika Thinking Trace' : 'Show Aika Thinking Trace'}
                  >
                    {showThinkingTrace ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span>{showThinkingTrace ? 'Thinking Trace: On' : 'Thinking Trace: Off'}</span>
                  </button>
                </div>
              </div>

              {/* Agent Activity & Risk Display */}
              {lastMetadata && (
                <div className="px-4 pt-3 space-y-2">
                  {lastMetadata.risk_assessment && lastMetadata.risk_assessment.risk_level !== 'low' && (
                    <RiskLevelIndicator
                      assessment={lastMetadata.risk_assessment}
                      showFactors={lastMetadata.risk_assessment.risk_level === 'high' || lastMetadata.risk_assessment.risk_level === 'critical'}
                    />
                  )}
                  {lastMetadata.escalation_triggered && lastMetadata.case_id && (
                    <EscalationNotification caseId={lastMetadata.case_id} />
                  )}
                </div>
              )}

              {/* Chat Window - using original component */}
              <ChatWindow
                messages={messages}
                chatContainerRef={chatContainerRef}
                isLoading={isLoading}
                activeAgents={activeAgents}
                currentThinking={showThinkingTrace ? currentThinking : null}
                thinkingSteps={thinkingSteps}
                elapsedSeconds={elapsedSeconds}
                onCardSelect={handleSendMessage}
                onRegenerate={handleSendMessage}
                userDisplayName={session?.user?.name ?? session?.user?.email ?? 'You'}
                userImageUrl={profilePictureSrc}
              />

              {/* Chat Input - using original component */}
              <div className="px-4 pb-3 pt-2">
                <div className="mx-auto w-full max-w-3xl">
                  <ChatInput
                    inputValue={inputValue}
                    onInputChange={handleInputChange}
                    onSendMessage={handleSendMessage}
                    onStartModule={() => { }} // Disabled for now
                    isLoading={isLoading || retryCooldownMs > 0}
                    currentMode="standard"
                    availableModules={[]}
                    isLiveTalkActive={false}
                    toggleLiveTalk={() => { }} // Disabled for now
                    interruptOnEnter={false}
                  />
                </div>
              </div>
              </div>
            </div>
          </motion.div>

          {/* Integrated Right Sidebar */}
          <AnimatePresence initial={false} mode="popLayout">
            {isAikaPanelOpen && (
              <motion.aside
                key="aika-sidebar"
                layout
                initial={{ opacity: 0, x: 120, scaleX: 0.98 }}
                animate={{ opacity: 1, x: 0, scaleX: 1 }}
                exit={{ opacity: 0, x: 140, scaleX: 0.98 }}
                transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.8 }}
                className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col origin-right border-l border-white/10 bg-linear-to-b from-[#0a1628]/60 to-[#0d1d35]/60 backdrop-blur-md overflow-hidden"
              >
                <div className="flex-1 min-h-0">
                  <ActivityLogPanel
                    activities={showThinkingTrace ? activities : activities.filter((a) => a.activity_type !== 'reasoning_trace')}
                    metadata={lastMetadata ?? null}
                    embedded={true}
                    onClose={() => setIsAikaPanelOpen(true)}
                  />
                </div>

                <div className="border-t border-white/10 px-3 py-3 text-center">
                  <p className="text-[10px] text-white/40">Disclaimer: Aika adalah AI dan bukan pengganti profesional medis.</p>
                  <p className="text-[10px] text-white/30 mt-1">Built with ❤️ by UGM AICare Team • Powered by LangGraph</p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pull tag when sidebar is closed */}
        <div className="hidden lg:block">
          <AnimatePresence initial={false}>
            {!isAikaPanelOpen && (
              <motion.button
                key="aika-panel-tag"
                initial={{ x: 56, opacity: 0, scale: 0.98 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: 56, opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.8 }}
                type="button"
                onClick={() => setIsAikaPanelOpen(true)}
                className="fixed right-0 top-1/2 z-70 -translate-y-1/2 origin-right rounded-l-2xl border border-r-0 border-white/10 bg-black/20 px-3 py-3 text-white/80 backdrop-blur hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50"
                aria-label="Buka Aika Panel"
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ugm-gold" />
                  <span className="text-xs font-semibold">Aika Panel</span>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <InterventionPlansSidebar alwaysVisible={true} />

      </div>
    </>
  );
}