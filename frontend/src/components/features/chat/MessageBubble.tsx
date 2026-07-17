// src/components/features/chat/MessageBubble.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { motion, Variants } from 'framer-motion';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useEffect, useState } from 'react';
import { useLiveTalkStore } from '@/store/useLiveTalkStore';
import { InterventionPlan } from './InterventionPlan';
import { AppointmentCard } from './AppointmentCard';
import { AgentActivityLog } from './AgentActivityLog';
import { AikaSchedulingWidget } from './AikaSchedulingWidget';
import { AikaThinkingCompact } from './AikaThinkingIndicator';
import { Copy, Check, RotateCcw, Clock } from 'lucide-react';

import CounselorCard from "./CounselorCard";
import TimeSlotCard from "./TimeSlotCard";

interface MessageBubbleProps {
  message: Message;
  isLastInGroup?: boolean; // True if this is the last bubble in a continuation group
  onCancelAppointment?: (appointmentId: number, reason: string) => Promise<void>;
  onRescheduleAppointment?: (appointmentId: number, newDateTime: string) => Promise<void>;
  onCardSelect?: (text: string) => void;
  retryText?: string | null;
  onRegenerate?: (text: string) => void;

  /** Optional: used for labeling and avatar on user messages */
  userDisplayName?: string;
  userImageUrl?: string | null;
}

// Preload audio files for instant playback
const audioCache: { [key: string]: HTMLAudioElement } = {};
if (typeof window !== 'undefined') {
  audioCache.user = new Audio('/sounds/message_bubble_user.mp3');
  audioCache.aika = new Audio('/sounds/message_bubble_aika.mp3');
  // Preload the audio
  audioCache.user.load();
  audioCache.aika.load();
}

export function MessageBubble({
  message,
  isLastInGroup = true,
  onCancelAppointment,
  onRescheduleAppointment,
  onCardSelect,
  retryText,
  onRegenerate,
  userDisplayName,
  userImageUrl,
}: MessageBubbleProps) {
  const messageSoundsEnabled = useLiveTalkStore((state) => state.messageSoundsEnabled);
  const hasPlayedRef = React.useRef(false);
  const [copied, setCopied] = React.useState(false);
  const [userAvatarFailed, setUserAvatarFailed] = React.useState(false);
  const [widgetAppointment, setWidgetAppointment] = React.useState<Message['appointment'] | null>(null);

  useEffect(() => {
    // Only play sound once per message and when not loading
    if (!message.isLoading && messageSoundsEnabled && !hasPlayedRef.current && !message.isContinuation) {
      hasPlayedRef.current = true;
      const cachedAudio = message.role === 'user' ? audioCache.user : audioCache.aika;
      if (cachedAudio) {
        // Clone the audio to allow overlapping sounds
        const audio = cachedAudio.cloneNode() as HTMLAudioElement;
        audio.volume = 0.5;
        audio.play().catch(error => {
          if (error.name !== 'NotAllowedError') {
            console.error("Audio play failed:", error);
          }
        });
      }
    }
  }, [message.isLoading, message.role, messageSoundsEnabled, message.isContinuation]);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.isError;
  const isContinuation = message.isContinuation;

  // Countdown for rate-limit fallbacks: counts down from retryAfterMs to 0.
  const [countdownSecs, setCountdownSecs] = useState(
    message.retryAfterMs ? Math.ceil(message.retryAfterMs / 1000) : 0
  );
  useEffect(() => {
    if (countdownSecs <= 0) return;
    const id = window.setTimeout(() => setCountdownSecs((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdownSecs]);

  const canShowActions = !isUser && !isSystem && !message.isLoading && !message.isStreaming;
  // Allow the retry button on fallback error messages (retryAfterMs is present) as well as normal messages.
  const canRegenerate = Boolean(
    retryText && onRegenerate && (!isError || message.retryAfterMs !== undefined)
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback for older browsers
      try {
        const el = document.createElement('textarea');
        el.value = message.content;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        // No-op
      }
    }
  };

  const toolCalls = (!isUser && message.metadata?.tool_calls && Array.isArray(message.metadata.tool_calls))
    ? (message.metadata.tool_calls as any[])
    : [];

  const shouldShowSchedulingWidget = React.useMemo(() => {
    if (isUser || message.isLoading || message.appointment || widgetAppointment) {
      return false;
    }

    const intent = message.aikaMetadata?.intent?.toLowerCase() || '';
    const actions = message.aikaMetadata?.actions_taken || [];
    const keywords = ['schedule', 'scheduling', 'appointment', 'booking', 'counselor', 'konseling'];

    const intentTriggered = keywords.some((keyword) => intent.includes(keyword));
    const actionTriggered = actions.some((action) => {
      const normalized = action.toLowerCase();
      return keywords.some((keyword) => normalized.includes(keyword));
    });

    return intentTriggered || actionTriggered;
  }, [isUser, message.isLoading, message.appointment, message.aikaMetadata, widgetAppointment]);

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="my-3 text-center text-xs text-gray-300/80 italic px-4"
      >
        {message.content}
      </motion.div>
    );
  }

  const bubbleVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  };

  const senderName = isUser ? (userDisplayName?.trim() || 'You') : 'Aika';
  const normalizedUserImageUrl =
    typeof userImageUrl === 'string' && userImageUrl.trim() && userImageUrl !== 'null' && userImageUrl !== 'undefined'
      ? userImageUrl.trim()
      : null;

  const renderAvatar = () => {
    if (isUser) {
      if (normalizedUserImageUrl && !userAvatarFailed) {
        return (
          <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-black/20 shadow-sm backdrop-blur-sm">
            <Image
              src={normalizedUserImageUrl}
              alt={senderName}
              width={32}
              height={32}
              className="object-cover w-full h-full"
              onError={() => setUserAvatarFailed(true)}
            />
          </div>
        );
      }

      return (
        <div className="shrink-0 w-8 h-8 rounded-full border border-white/20 bg-white/10 text-white/85 backdrop-blur-sm flex items-center justify-center font-semibold text-[11px] shadow-sm">
          {senderName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase())
            .join('') || 'U'}
        </div>
      );
    }
    return (
      <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-black/20 shadow-sm backdrop-blur-sm">
        <Image src="/aika-human.jpeg" alt="Aika" width={28} height={28} className="object-cover w-full h-full" />
      </div>
    );
  };

  const renderBubbleContent = () => {
    if (message.isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {message.toolIndicator ? (
            <AikaThinkingCompact message={message.toolIndicator} />
          ) : (
            <div className="flex items-center justify-start h-full px-3 py-2 text-ugm-blue-dark">
              <LoadingDots text="Aika sedang mengetik..." />
            </div>
          )}
        </div>
      );
    }
    return (
      <>
        <div className={cn(
          // Enhanced prose styling for better readability
          'prose prose-sm max-w-none',
          // Paragraph spacing
          'prose-p:my-1.5 prose-p:leading-relaxed',
          // List styling - better spacing and bullets
          'prose-ul:my-2 prose-ul:pl-4 prose-ul:space-y-1',
          'prose-ol:my-2 prose-ol:pl-4 prose-ol:space-y-1',
          'prose-li:my-0.5 prose-li:leading-relaxed',
          // Headers styling
          'prose-headings:font-semibold prose-headings:text-ugm-gold prose-headings:mt-3 prose-headings:mb-1.5',
          'prose-h1:text-base prose-h2:text-sm prose-h3:text-sm',
          // Strong/Bold styling
          'prose-strong:text-ugm-gold prose-strong:font-semibold',
          // Code/Pre styling
          'prose-code:text-ugm-gold/90 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded prose-code:text-xs',
          // Blockquote styling
          'prose-blockquote:border-l-2 prose-blockquote:border-ugm-gold/50 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-white/70',
          // Text colors
          isUser ? 'prose-invert' : isError ? 'text-red-200' : 'text-white/90',
          // Link styling
          'prose-a:font-medium prose-a:transition-colors prose-a:underline prose-a:underline-offset-2',
          isUser ? 'prose-a:text-ugm-gold hover:prose-a:text-ugm-gold/80' : 'prose-a:text-ugm-gold hover:prose-a:text-ugm-gold/80'
        )}>
          <ReactMarkdown
            components={{
              a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="break-all" />,
              // Enhanced heading rendering
              h1: ({ children, ...props }) => <h2 {...props} className="text-base font-semibold text-ugm-gold mt-3 mb-1.5">{children}</h2>,
              h2: ({ children, ...props }) => <h3 {...props} className="text-sm font-semibold text-ugm-gold mt-2.5 mb-1">{children}</h3>,
              h3: ({ children, ...props }) => <h4 {...props} className="text-sm font-medium text-ugm-gold/90 mt-2 mb-1">{children}</h4>,
              // Better list rendering
              ul: ({ children, ...props }) => <ul {...props} className="my-2 pl-4 space-y-1 list-disc marker:text-ugm-gold/60">{children}</ul>,
              ol: ({ children, ...props }) => <ol {...props} className="my-2 pl-4 space-y-1 list-decimal marker:text-ugm-gold/60">{children}</ol>,
              li: ({ children, ...props }) => <li {...props} className="my-0.5 leading-relaxed">{children}</li>,
              // Paragraph with proper spacing
              p: ({ children, ...props }) => <p {...props} className="my-1.5 leading-relaxed">{children}</p>,
              // Better strong/emphasis
              strong: ({ children, ...props }) => <strong {...props} className="font-semibold text-ugm-gold">{children}</strong>,
              em: ({ children, ...props }) => <em {...props} className="italic text-white/80">{children}</em>,
              // Horizontal rule as section divider
              hr: ({ ...props }) => <hr {...props} className="my-3 border-white/10" />,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {/* Countdown hint — only visible while the retry cooldown is active. */}
        {isError && countdownSecs > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-300/80">
            <Clock className="h-3 w-3 shrink-0" />
            Coba lagi dalam {countdownSecs} detik...
          </p>
        )}
      </>
    );
  };

  return (
    <motion.div
      className={cn(
        'flex items-start gap-2',
        // Reduced margin for continuation bubbles to make them look connected
        isContinuation ? 'my-0.5' : 'my-1.5',
        isUser ? 'justify-end' : 'justify-start'
      )}
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Avatar - hidden for continuation bubbles, placeholder space maintained */}
      {!isUser && (
        isContinuation 
          ? <div className="shrink-0 w-8 h-8" /> // Placeholder to maintain alignment
          : renderAvatar()
      )}
      <div className={cn('group flex flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'mb-1 text-[11px] leading-none text-white/60',
            isUser ? 'mr-1 text-right' : 'ml-1 text-left'
          )}
        >
          {senderName}
        </div>
        <div className={cn(
          'px-3 py-2 rounded-2xl max-w-xs md:max-w-md lg:max-w-lg text-sm relative',
          isUser
            ? 'bg-ugm-blue text-white rounded-br-sm'
            : isError && message.fallbackType === 'rate_limit'
              ? 'bg-amber-500/15 backdrop-blur-sm text-amber-200 rounded-bl-sm border border-amber-500/30'
              : isError
                ? 'bg-red-500/20 backdrop-blur-sm text-red-200 rounded-bl-sm border border-red-500/30'
                : 'bg-white/10 backdrop-blur-sm text-white/90 border border-white/10',
          // Adjust rounding for continuation bubbles
          !isUser && isContinuation ? 'rounded-tl-lg rounded-bl-sm' : !isUser && 'rounded-bl-sm',
          message.isLoading && 'p-0 bg-white/10 backdrop-blur-sm w-35'
        )}>
          {renderBubbleContent()}
        </div>

        {/* Tool-result cards (integrated, attachment-like strip) */}
        {!isUser && toolCalls.length > 0 && !message.isLoading && (
          <div className="mt-2 w-full max-w-xs md:max-w-md lg:max-w-lg">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {toolCalls.map((tool: any) => {
                  if (tool.tool_name === 'get_available_counselors' && tool.result?.counselors) {
                    return tool.result.counselors.map((counselor: any) => (
                      <CounselorCard
                        key={counselor.id}
                        counselor={counselor}
                        onSelect={(c) => onCardSelect?.(`Saya pilih ${c.name} (ID: ${c.id})`)}
                      />
                    ));
                  }
                  if (tool.tool_name === 'suggest_appointment_times' && tool.result?.suggestions) {
                    return tool.result.suggestions.map((slot: any, sIdx: number) => (
                      <TimeSlotCard
                        key={`${slot.datetime}-${sIdx}`}
                        slot={slot}
                        onSelect={(s) => onCardSelect?.(`Saya pilih waktu ${s.time_label} (${s.datetime})`)}
                      />
                    ));
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* Intervention Plan Display */}
        {!isUser && message.interventionPlan && !message.isLoading && (
          <div className="max-w-xs md:max-w-md lg:max-w-lg mt-2">
            <InterventionPlan plan={message.interventionPlan} />
          </div>
        )}
        
        {/* Appointment Card Display */}
        {!isUser && (message.appointment || widgetAppointment) && !message.isLoading && (
          <div className="max-w-xs md:max-w-md lg:max-w-lg mt-2">
            <AppointmentCard 
              appointment={(message.appointment || widgetAppointment)!}
              onCancel={onCancelAppointment}
              onReschedule={onRescheduleAppointment}
            />
          </div>
        )}

        {/* Interactive Scheduling Widget */}
        {!isUser && shouldShowSchedulingWidget && (
          <div className="max-w-xs md:max-w-md lg:max-w-lg mt-2">
            <AikaSchedulingWidget
              onScheduled={(appointment) => {
                setWidgetAppointment(appointment);
              }}
              onAikaFollowup={(text) => onCardSelect?.(text)}
            />
          </div>
        )}
        
        {/* Agent Activity Log Display */}
        {!isUser && message.agentActivity && !message.isLoading && (
          <div className="max-w-xs md:max-w-md lg:max-w-lg mt-2">
            <AgentActivityLog agentActivity={message.agentActivity} />
          </div>
        )}
        
        {/* Timestamp + actions (only show on the last bubble of a continuation group) */}
        {!message.isLoading && isLastInGroup && (
          <div
            className={cn(
              'mt-1 flex items-center gap-2 text-[10px] text-white/40',
              isUser ? 'mr-1 justify-end' : 'ml-1 justify-start'
            )}
          >
            <span>{format(message.timestamp, 'HH:mm', { locale: id })}</span>

            {canShowActions && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 backdrop-blur hover:bg-black/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50"
                  aria-label="Salin pesan"
                >
                  {copied ? <Check className="h-4 w-4 text-ugm-gold" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (retryText && onRegenerate) onRegenerate(retryText);
                  }}
                  disabled={!canRegenerate}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 backdrop-blur hover:bg-black/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50",
                    !canRegenerate && "cursor-not-allowed opacity-40"
                  )}
                  aria-label="Ulangi jawaban"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (isContinuation ? <div className="shrink-0 w-8 h-8" /> : renderAvatar())}
    </motion.div>
  );
}
