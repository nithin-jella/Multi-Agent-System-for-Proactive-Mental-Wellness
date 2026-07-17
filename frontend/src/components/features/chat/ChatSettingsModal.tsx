'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiX } from "react-icons/fi";

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  interruptOnEnter: boolean;
  onToggleInterrupt: (value: boolean) => void;
}

const ChatSettingsModal = ({ isOpen, onClose, interruptOnEnter, onToggleInterrupt }: ChatSettingsModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-settings"
          className="fixed inset-0 z-90 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan chat"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-[0_24px_60px_rgba(6,11,40,0.55)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Pengaturan Chat</h2>
                <p className="text-xs text-white/60">Atur preferensi untuk interaksi selama Aika merespons.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/60 hover:text-white rounded-full p-1 focus-visible:outline focus-visible:outline-ugm-gold/60"
                aria-label="Tutup"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm text-white/80">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-ugm-gold"
                  checked={interruptOnEnter}
                  onChange={(event) => onToggleInterrupt(event.target.checked)}
                />
                <span>
                  <span className="font-medium text-white">Enter untuk membatalkan saat streaming</span>
                  <span className="block text-xs text-white/60">
                    Saat aktif, menekan Enter ketika Aika masih merespons akan menghentikan respons dan mengirim pesan baru segera.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Selesai
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ChatSettingsModal;
