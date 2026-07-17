// src/components/features/chat/ChatInput.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/TextArea";
import { SendHorizonal, BrainCircuit, Plus, X as XIcon, Mic } from "lucide-react";
import { ChatMode, AvailableModule as ChatModule } from "@/types/chat";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onStartModule: (moduleId: string) => void;
  isLoading: boolean;
  currentMode: ChatMode;
  availableModules: ChatModule[];
  isLiveTalkActive: boolean;
  toggleLiveTalk: () => void;
  onCancel?: () => void;
  interruptOnEnter: boolean;
}

export function ChatInput({
  inputValue,
  onInputChange,
  onSendMessage,
  onStartModule,
  isLoading,
  currentMode,
  availableModules,
  isLiveTalkActive,
  toggleLiveTalk,
  onCancel,
  interruptOnEnter,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showModules, setShowModules] = useState(false);

  const isStandardMode = currentMode === "standard";
  const actionIsCancel = isLoading && Boolean(onCancel);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModules) {
        setShowModules(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showModules]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // Reduced max height for better initial size
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [isLoading]);

  const handleModuleClick = (moduleId: string) => {
    if (isLoading) {
      toast.error("Tunggu sampai Aika selesai merespons sebelum memulai modul baru.");
      return;
    }
    onStartModule(moduleId);
    setShowModules(false);
  };

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    if (isLoading) {
      toast.error("Tunggu hingga Aika selesai merespons sebelum mengirim pesan baru.");
      return;
    }
    onSendMessage();
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isLoading) {
        if (interruptOnEnter && onCancel) {
          onCancel();
        } else {
          toast.error("Aika masih merespons. Batalkan atau tunggu sebentar sebelum mengirim pesan baru.");
        }
        return;
      }
      handleSend();
    }
  };

  const handleActionClick = () => {
    if (actionIsCancel) {
      onCancel?.();
      return;
    }
    handleSend();
  };

  const handleTextareaFocus = () => {
    // Focus the textarea to ensure it expands when clicked
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const ActionIcon = actionIsCancel ? XIcon : SendHorizonal;
  const actionDisabled = actionIsCancel ? false : !inputValue.trim();

  return (
    <div className="w-full shrink-0">
      <div className="flex flex-col gap-3">
        {/* Responsive unified input container */}
        <div className="flex items-end gap-2 sm:gap-3 rounded-full border border-white/20 bg-white/10 px-3 sm:px-4 py-2 sm:py-3 shadow-lg backdrop-blur-xl transition-all duration-300">
          {/* Module picker button */}
          <button
            type="button"
            onClick={() => setShowModules((prev) => !prev)}
            disabled={isLoading || !isStandardMode}
            className={cn(
              "flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
              showModules 
                ? "bg-ugm-gold/20 text-ugm-gold" 
                : "bg-transparent text-white/70 hover:bg-white/15 hover:text-white"
            )}
            aria-label="Buka latihan terpandu"
          >
            {showModules ? <BrainCircuit className="h-4 w-4 sm:h-5 sm:w-5" /> : <Plus className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>

          {/* Dynamic textarea container - always full width */}
          <div 
            className="flex-1 transition-all duration-300 ease-in-out"
            onClick={handleTextareaFocus}
          >
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "Aika sedang mengetik..." : isStandardMode ? "Ketik pesan..." : "Ketik jawabanmu..."}
              rows={1}
              className={cn(
                "w-full resize-none border-0 bg-transparent px-0 text-sm sm:text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 transition-all duration-200"
              )}
              style={{ 
                minHeight: '32px',
                maxHeight: '120px',
                lineHeight: '1.5'
              }}
            />
          </div>

          {/* Action buttons - responsive */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleLiveTalk}
              className={cn(
                "flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all duration-200",
                isLiveTalkActive
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-transparent text-white/70 hover:bg-white/15 hover:text-white"
              )}
              aria-label={isLiveTalkActive ? "Stop Live Talk" : "Start Live Talk"}
            >
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <button
              type="button"
              onClick={handleActionClick}
              disabled={actionDisabled}
              className={cn(
                "flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40",
                actionIsCancel
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-ugm-gold text-ugm-blue hover:bg-ugm-gold/90"
              )}
              aria-label={actionIsCancel ? "Batalkan respons" : "Kirim pesan"}
            >
              <ActionIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Module picker popup modal - responsive */}
        {showModules && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowModules(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md sm:max-w-2xl rounded-2xl border border-white/20 bg-white/10 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 sm:h-6 sm:w-6 text-ugm-gold" />
                  <h3 className="text-lg sm:text-xl font-semibold text-white">Latihan Terpandu CBT</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModules(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                  aria-label="Tutup"
                >
                  <XIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
              
              <p className="mb-4 text-xs sm:text-sm text-white/70">
                Pilih latihan yang sesuai dengan kebutuhanmu saat ini. Setiap latihan dirancang untuk membantumu mengelola pikiran dan emosi dengan lebih baik.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {availableModules.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => handleModuleClick(mod.id)}
                    disabled={isLoading}
                    className="group flex w-full flex-col rounded-xl border border-white/15 bg-white/5 px-3 sm:px-4 py-3 sm:py-3.5 text-left transition hover:border-ugm-gold/50 hover:bg-white/10 disabled:opacity-50"
                  >
                    <span className="text-sm sm:text-base font-semibold text-white group-hover:text-ugm-gold">{mod.name}</span>
                    <span className="mt-1 text-xs sm:text-sm text-white/60">{mod.description}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}














