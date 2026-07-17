'use client';

import { useEffect, useState } from "react";

import { Button } from '@/components/ui/Button';
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiVolume2, FiMic, FiRefreshCcw, FiSettings } from "react-icons/fi";
import { useLiveTalkStore } from "@/store/useLiveTalkStore";
import { toast } from "react-hot-toast";
import DeviceSelector from "./DeviceSelector";
import { useSession } from "next-auth/react";

interface EnvData {
  success: boolean;
  system_prompt: string;
  logs: string[];
  system_info: {
    python_version: string;
    environment: string;
    backend_base_url: string;
    database_url: string;
  };
  user_id: number;
  user_role: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [mounted, setMounted] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envPassword, setEnvPassword] = useState("");
  const [envData, setEnvData] = useState<EnvData | null>(null);
  const [loadingEnv, setLoadingEnv] = useState(false);
  const { data: session } = useSession();
  
  const {
    messageSoundsEnabled,
    setMessageSoundsEnabled,
    ttsEnabled,
    setTtsEnabled,
  } = useLiveTalkStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const testMicrophone = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Tidak dapat mengakses mikrofon. Pastikan izin sudah diberikan.");
      return false;
    }
  };

  const testSpeaker = async (): Promise<boolean> => {
    try {
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.connect(gain).connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.8);
      window.setTimeout(() => {
        void audioCtx.close();
      }, 1000);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Tidak dapat memutar suara uji. Periksa perangkat output Anda.");
      return false;
    }
  };

  const handleTestDevices = async () => {
    const micReady = await testMicrophone();
    if (!micReady) {
      return;
    }
    const speakerReady = await testSpeaker();
    if (!speakerReady) {
      return;
    }
    toast.success("Perangkat input dan output siap digunakan.");
  };

  const handleCheckEnv = () => {
    setShowEnvModal(true);
  };

  const handleEnvPasswordSubmit = async () => {
    if (envPassword !== "1234") {
      toast.error("Password salah!");
      return;
    }

    setLoadingEnv(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE}/api/v1/system/env-check`, {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch environment data');
      }

      const data = await response.json();
      setEnvData(data);
      toast.success("Data environment berhasil dimuat!");
    } catch (error) {
      console.error('Error fetching env data:', error);
      toast.error("Gagal memuat data environment");
    } finally {
      setLoadingEnv(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="audio-settings"
          className="fixed inset-0 z-95 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan audio"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/12 bg-[#0b152e]/90 shadow-[0_30px_70px_rgba(5,9,30,0.55)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex flex-col gap-6 p-6 md:gap-8 md:p-8">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Pengaturan Audio</h2>
                  <p className="text-sm text-white/60">
                    Kelola preferensi suara, tes perangkat, dan pilih input/output yang ingin digunakan.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="self-start rounded-full p-1 text-gray-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-ugm-gold/60"
                  aria-label="Tutup pengaturan"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="group flex items-start gap-3 rounded-2xl border border-white/12 bg-white/8 p-4 transition hover:border-ugm-gold/40">
                      <input
                        type="checkbox"
                        className="mt-1.5 h-4 w-4 flex-none accent-ugm-gold"
                        checked={messageSoundsEnabled}
                        onChange={(event) => setMessageSoundsEnabled(event.target.checked)}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                          <FiVolume2 /> Suara gelembung pesan
                        </span>
                        <span className="text-xs text-white/55">
                          Nonaktifkan untuk menonaktifkan bunyi ketika pesan baru muncul di percakapan.
                        </span>
                      </span>
                    </label>

                    <label className="group flex items-start gap-3 rounded-2xl border border-white/12 bg-white/8 p-4 transition hover:border-ugm-gold/40">
                      <input
                        type="checkbox"
                        className="mt-1.5 h-4 w-4 flex-none accent-ugm-gold"
                        checked={ttsEnabled}
                        onChange={(event) => setTtsEnabled(event.target.checked)}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                          <FiMic /> Putar balasan suara (TTS)
                        </span>
                        <span className="text-xs text-white/55">
                          Nonaktifkan jika Anda tidak ingin mendengar balasan Aika secara langsung.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Tes perangkat audio</p>
                        <p className="text-xs text-white/55">
                          Jalankan uji cepat untuk memastikan mikrofon dan speaker aktif.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestDevices}
                        className="flex w-full items-center justify-center gap-2 border-white/20 bg-white/10 text-white transition hover:bg-white/15 sm:w-auto"
                      >
                        <FiRefreshCcw className="h-4 w-4" />
                        <span>Uji Input & Output</span>
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Check Environment</p>
                        <p className="text-xs text-white/55">
                          Lihat system prompt dan logs (butuh password)
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCheckEnv}
                        className="flex w-full items-center justify-center gap-2 border-white/20 bg-white/10 text-white transition hover:bg-white/15 sm:w-auto"
                      >
                        <FiSettings className="h-4 w-4" />
                        <span>Check Env</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/6 p-4 shadow-[0_20px_45px_rgba(8,12,38,0.35)]">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-white">Pemilihan perangkat</p>
                    <p className="text-xs text-white/55">Atur input/output dan suara yang digunakan Live Talk.</p>
                  </div>
                  <DeviceSelector />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      
      {/* Env Check Modal */}
      {showEnvModal && (
        <motion.div
          key="env-check"
          className="fixed inset-0 z-100 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            onClick={() => {
              setShowEnvModal(false);
              setEnvPassword("");
              setEnvData(null);
            }}
            aria-label="Tutup check env"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-3xl border border-white/12 bg-[#0b152e]/95 shadow-[0_30px_70px_rgba(5,9,30,0.55)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Check Environment</h2>
                <button
                  onClick={() => {
                    setShowEnvModal(false);
                    setEnvPassword("");
                    setEnvData(null);
                  }}
                  className="rounded-full p-1 text-gray-300 transition-colors hover:text-white"
                  aria-label="Tutup"
                >
                  <FiX size={20} />
                </button>
              </div>

              {!envData ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-white/60">Masukkan password untuk melihat environment data:</p>
                  <input
                    type="password"
                    value={envPassword}
                    onChange={(e) => setEnvPassword(e.target.value)}
                    placeholder="Password"
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/40 focus:border-ugm-gold/60 focus:outline-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        void handleEnvPasswordSubmit();
                      }
                    }}
                  />
                  <Button
                    onClick={handleEnvPasswordSubmit}
                    disabled={loadingEnv}
                    className="bg-ugm-gold text-ugm-blue-dark hover:bg-ugm-gold/90"
                  >
                    {loadingEnv ? "Loading..." : "Submit"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* System Prompt */}
                  <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">System Prompt</h3>
                    <div className="max-h-60 overflow-y-auto rounded bg-black/30 p-3 text-xs text-white/80 font-mono whitespace-pre-wrap">
                      {envData.system_prompt}
                    </div>
                  </div>

                  {/* System Info */}
                  <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">System Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-white/60">Environment:</span>
                        <span className="ml-2 text-white">{envData.system_info?.environment}</span>
                      </div>
                      <div>
                        <span className="text-white/60">User ID:</span>
                        <span className="ml-2 text-white">{envData.user_id}</span>
                      </div>
                      <div>
                        <span className="text-white/60">Role:</span>
                        <span className="ml-2 text-white">{envData.user_role}</span>
                      </div>
                      <div>
                        <span className="text-white/60">Backend URL:</span>
                        <span className="ml-2 text-white truncate">{envData.system_info?.backend_base_url}</span>
                      </div>
                    </div>
                  </div>

                  {/* Logs */}
                  <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">Recent Logs (Last 50 lines)</h3>
                    <div className="max-h-96 overflow-y-auto rounded bg-black/30 p-3 text-xs text-white/70 font-mono">
                      {envData.logs && envData.logs.length > 0 ? (
                        envData.logs.map((log: string, index: number) => (
                          <div key={index} className="mb-1 border-b border-white/5 pb-1">
                            {log}
                          </div>
                        ))
                      ) : (
                        <p className="text-white/40">No logs available</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SettingsModal;

