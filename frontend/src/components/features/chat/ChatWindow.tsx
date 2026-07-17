// src/components/features/chat/ChatWindow.tsx
import React, { useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

import { AikaLoadingBubble } from "../aika/AikaLoadingBubble";
import { AgentThinkingBubble } from "../aika/AgentThinkingBubble";
import { ThinkingStep } from "@/types/thinking";
interface ChatWindowProps {
  messages: Message[];
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  onCancelAppointment?: (appointmentId: number, reason: string) => Promise<void>;
  onRescheduleAppointment?: (appointmentId: number, newDatetime: string) => Promise<void>;
  isLoading?: boolean;
  activeAgents?: string[];
  currentThinking?: string | null;
  onCardSelect?: (text: string) => void;
  onRegenerate?: (text: string) => void;

  userDisplayName?: string;
  userImageUrl?: string | null;

  /** New structured thinking steps props */
  thinkingSteps?: ThinkingStep[];
  elapsedSeconds?: number;
}

export function ChatWindow({
  messages,
  chatContainerRef,
  onCancelAppointment,
  onRescheduleAppointment,
  isLoading,
  activeAgents = [],
  currentThinking,
  onCardSelect,
  onRegenerate,
  userDisplayName,
  userImageUrl,
  thinkingSteps,
  elapsedSeconds,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const topFadeMaskStyle: React.CSSProperties = {
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 24px)',
    maskImage: 'linear-gradient(to bottom, transparent 0px, black 24px)',
  };

  useEffect(() => {
    const scrollToBottom = () => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    };
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  return (
    <div
      ref={chatContainerRef}
      className="flex-1 overflow-y-auto bg-transparent! px-2 pb-4 pt-4 sm:px-4 md:px-6"
      style={topFadeMaskStyle}
    >
      {/* Centered conversation column (ChatGPT-like reading width) */}
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {messages.map((msg, index) => {
          const nextMsg = messages[index + 1];
          const isLastInGroup = !nextMsg || !nextMsg.isContinuation || nextMsg.role !== msg.role;

          // For assistant messages, compute the most recent user prompt so we can "regenerate"
          let retryText: string | null = null;
          if (msg.role === 'assistant') {
            for (let i = index - 1; i >= 0; i -= 1) {
              if (messages[i]?.role === 'user') {
                retryText = messages[i].content;
                break;
              }
            }
          }

          return (
            <div key={msg.id} className="flex flex-col">
              <MessageBubble
                message={msg}
                isLastInGroup={isLastInGroup}
                onCancelAppointment={onCancelAppointment}
                onRescheduleAppointment={onRescheduleAppointment}
                onCardSelect={onCardSelect}
                retryText={retryText}
                onRegenerate={onRegenerate}
                userDisplayName={userDisplayName}
                userImageUrl={userImageUrl}
              />
            </div>
          );
        })}

        {isLoading && !messages.some((m) => m.role === 'assistant' && m.isLoading && m.content.length > 0) && (
          <AgentThinkingBubble
            steps={thinkingSteps ?? []}
            activeAgents={activeAgents}
            isActive={true}
            elapsedSeconds={elapsedSeconds ?? 0}
          />
        )}
      </div>

      {/* Scroll anchor for auto-scroll */}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}


