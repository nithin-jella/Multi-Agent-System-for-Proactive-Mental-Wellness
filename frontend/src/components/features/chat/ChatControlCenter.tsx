"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { FiMic, FiRefreshCcw, FiVolume2, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import DeviceSelector from "./DeviceSelector";
import { useLiveTalkStore } from "@/store/useLiveTalkStore";

interface ChatControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  model?: string;
  setModel?: (model: string) => void;
  modelOptions?: Array<{ value: string; label: string }>;
  interruptOnEnter: boolean;
  onToggleInterrupt: (value: boolean) => void;
}

export function ChatControlCenter({
  isOpen,
  onClose,
  model,
  setModel,
  modelOptions,
  interruptOnEnter,
  onToggleInterrupt,
}: ChatControlCenterProps) {
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const {
    messageSoundsEnabled,
    setMessageSoundsEnabled,
    ttsEnabled,
    setTtsEnabled,
  } = useLiveTalkStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTestSpeaker = async () => {
    if (isTesting) return;
    setIsTesting(true);
    
    try {
      toast.loading("Memutar nada uji...", { id: "speaker-test" });
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.connect(gain).connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1);
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      await audioCtx.close();
      
      toast.success("Speaker berfungsi dengan baik!", { id: "speaker-test" });
    } catch (error) {
      console.error(error);
      toast.error("Gagal memutar suara. Periksa perangkat output Anda.", { id: "speaker-test" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestMicrophone = async () => {
    if (isRecording || isPlayingBack) return;
    
    try {
      setIsRecording(true);
      toast.loading("Merekam suara... (3 detik)", { id: "mic-test" });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setIsRecording(false);
        setIsPlayingBack(true);
        toast.loading("Memutar kembali rekaman...", { id: "mic-test" });
        
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlayingBack(false);
          URL.revokeObjectURL(audioUrl);
          toast.success("Mikrofon berfungsi dengan baik!", { id: "mic-test" });
        };
        
        audio.onerror = () => {
          setIsPlayingBack(false);
          URL.revokeObjectURL(audioUrl);
          toast.error("Gagal memutar rekaman.", { id: "mic-test" });
        };
        
        await audio.play();
      };
      
      mediaRecorder.start();
      
      // Record for 3 seconds
      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      }, 3000);
      
    } catch (error) {
      console.error(error);
      setIsRecording(false);
      setIsPlayingBack(false);
      toast.error("Tidak dapat mengakses mikrofon. Pastikan izin sudah diberikan.", { id: "mic-test" });
    }
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-control-center"
          className="fixed inset-0 z-95 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Tutup pusat kontrol chat"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Container - Improved responsive sizing */}
          <motion.div
            className="relative z-10 flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl md:h-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header - Sticky on mobile */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/5 px-5 py-4 md:px-6">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white md:text-2xl">Pusat Kontrol Aika</h2>
                <p className="mt-1 text-sm text-white/60">
                  Sesuaikan pengaturan AI, chat, dan audio
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/60"
                aria-label="Tutup pusat kontrol"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
              <div className="space-y-5">
                {/* Settings Sections - Better mobile layout */}
                {/* Model Selection */}
                {modelOptions?.length ? (
                  <div className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-white">Model AI</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Pilih model untuk mengubah gaya dan kemampuan percakapan
                      </p>
                    </div>
                    <div className="relative">
                      <select
                        id="control-center-model"
                        value={model}
                        onChange={(event) => setModel?.(event.target.value)}
                        aria-label="Pilih model AI"
                        className="w-full appearance-none rounded-xl border border-white/20 bg-white/10 px-4 py-3 pr-10 text-sm text-white focus:border-ugm-gold/50 focus:outline-none focus:ring-2 focus:ring-ugm-gold/30"
                      >
                        {modelOptions.map((option) => (
                          <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r-2 border-b-2 border-white/70" />
                    </div>
                  </div>
                ) : null}

                {/* Chat Preferences */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">Preferensi Chat</h3>
                    <p className="mt-1 text-sm text-white/60">Atur cara interaksi saat Aika sedang merespons</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-ugm-gold/40 hover:bg-white/8">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-ugm-gold"
                      checked={interruptOnEnter}
                      onChange={(event) => onToggleInterrupt(event.target.checked)}
                    />
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-white">Interupsi dengan Enter</span>
                      <span className="mt-1 block text-xs text-white/60">
                        Tekan Enter saat streaming untuk menghentikan respons dan kirim pesan baru
                      </span>
                    </div>
                  </label>
                </div>

                {/* Audio Settings */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">Pengaturan Audio</h3>
                    <p className="mt-1 text-sm text-white/60">Kelola suara notifikasi dan balasan</p>
                  </div>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-ugm-gold/40 hover:bg-white/8">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-ugm-gold"
                        checked={messageSoundsEnabled}
                        onChange={(event) => setMessageSoundsEnabled(event.target.checked)}
                      />
                      <FiVolume2 className="h-5 w-5 shrink-0 text-ugm-gold" />
                      <div className="flex-1">
                        <span className="block text-sm font-medium text-white">Suara pesan</span>
                        <span className="mt-0.5 block text-xs text-white/60">Bunyi notifikasi saat pesan baru</span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-ugm-gold/40 hover:bg-white/8">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-ugm-gold"
                        checked={ttsEnabled}
                        onChange={(event) => setTtsEnabled(event.target.checked)}
                      />
                      <FiMic className="h-5 w-5 shrink-0 text-ugm-gold" />
                      <div className="flex-1">
                        <span className="block text-sm font-medium text-white">Balasan suara (TTS)</span>
                        <span className="mt-0.5 block text-xs text-white/60">Dengarkan balasan Aika secara langsung</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Device Testing - Separated */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">Tes Perangkat Audio</h3>
                    <p className="mt-1 text-sm text-white/60">Uji mikrofon dan speaker secara terpisah</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Microphone Test */}
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FiMic className="h-5 w-5 text-ugm-gold" />
                        <h4 className="text-sm font-semibold text-white">Tes Mikrofon</h4>
                      </div>
                      <p className="mb-3 text-xs text-white/60">
                        Merekam suara Anda selama 3 detik dan memutar kembali
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestMicrophone}
                        disabled={isRecording || isPlayingBack}
                        className="w-full border-white/20 bg-ugm-gold/10 text-ugm-gold transition hover:bg-ugm-gold/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50"
                      >
                        {isRecording ? (
                          <>
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 mr-2" />
                            Merekam...
                          </>
                        ) : isPlayingBack ? (
                          <>
                            <FiVolume2 className="h-4 w-4 mr-2" />
                            Memutar...
                          </>
                        ) : (
                          <>
                            <FiRefreshCcw className="h-4 w-4 mr-2" />
                            Mulai Tes
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Speaker Test */}
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FiVolume2 className="h-5 w-5 text-ugm-gold" />
                        <h4 className="text-sm font-semibold text-white">Tes Speaker</h4>
                      </div>
                      <p className="mb-3 text-xs text-white/60">
                        Memutar nada uji untuk memeriksa output audio
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestSpeaker}
                        disabled={isTesting}
                        className="w-full border-white/20 bg-ugm-gold/10 text-ugm-gold transition hover:bg-ugm-gold/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50"
                      >
                        {isTesting ? (
                          <>
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ugm-gold mr-2" />
                            Memutar...
                          </>
                        ) : (
                          <>
                            <FiRefreshCcw className="h-4 w-4 mr-2" />
                            Mulai Tes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Device Selection */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-white">Pemilihan Perangkat</h3>
                    <p className="mt-1 text-sm text-white/60">Pilih perangkat input dan output untuk Live Talk</p>
                  </div>
                  <DeviceSelector />
                </div>
              </div>
            </div>

            {/* Footer - Sticky on mobile */}
            <div className="border-t border-white/10 bg-white/5 px-5 py-4 md:px-6">
              <div className="flex justify-end">
                <Button
                  onClick={onClose}
                  className="w-full bg-ugm-gold text-ugm-blue hover:bg-ugm-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ugm-gold/50 sm:w-auto"
                >
                  Selesai
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
