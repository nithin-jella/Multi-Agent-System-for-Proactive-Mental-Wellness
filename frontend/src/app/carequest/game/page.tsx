'use client';

import { PhaserGame } from '@/components/game/PhaserGame';
import { useGameStore } from '@/store/gameStore';
import { ArrowLeft, Gamepad2, Heart, Sparkles, Maximize2, Settings, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CareQuest World Page - Immersive Game Experience
 * 
 * Features:
 * - Full-screen dominant game container with scalable resolution
 * - Floating HUD overlay with resources
 * - Minimal UI that doesn't obstruct gameplay
 * - Responsive game canvas that adapts to window size
 * - Collapsible controls panel
 */
export default function CareQuestWorldPage() {
  const { joy, care } = useGameStore();
  const [showControls, setShowControls] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#001D58] via-[#00308F] to-[#002A7A] overflow-hidden">
      {/* Floating Top Bar - Minimal HUD */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between"
      >
        {/* Back Button */}
        <Link href="/carequest">
          <motion.button
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-black/40 backdrop-blur-xl rounded-xl border border-[#FFCA40]/30 hover:border-[#FFCA40]/60 transition-all shadow-2xl group"
          >
            <ArrowLeft className="w-5 h-5 text-[#FFCA40] group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-white">Exit World</span>
          </motion.button>
        </Link>

        {/* Center Title */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="absolute left-1/2 transform -translate-x-1/2 px-6 py-2 bg-black/40 backdrop-blur-xl rounded-xl border border-[#FFCA40]/30 shadow-2xl"
        >
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-[#FFCA40] animate-pulse" />
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40]">
              CareQuest World
            </h1>
          </div>
        </motion.div>

        {/* Resource HUD - Floating Right */}
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.05, y: -2 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#FF6B9D] to-[#FFCA40] rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-[#FFCA40]/40 shadow-2xl">
              <Heart className="w-5 h-5 text-[#FF6B9D] animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#FFCA40] font-bold tracking-wider">JOY</span>
                <span className="text-lg font-black text-white drop-shadow-lg leading-none">{joy.toFixed(0)}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.05, y: -2 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#50E3C2] to-[#2DD4BF] rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-[#50E3C2]/40 shadow-2xl">
              <Sparkles className="w-5 h-5 text-[#50E3C2]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#50E3C2] font-bold tracking-wider">CARE</span>
                <span className="text-lg font-black text-white drop-shadow-lg leading-none">{care.toFixed(0)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Game Container - Dominant and Scalable */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pt-24 pb-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
          className="relative w-full h-full max-w-[1920px] max-h-[1080px] bg-black rounded-2xl shadow-2xl overflow-hidden"
          style={{
            boxShadow: '0 0 60px rgba(255, 202, 64, 0.3), 0 0 120px rgba(255, 202, 64, 0.1), inset 0 0 100px rgba(0, 0, 0, 0.8)',
          }}
        >
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#FFCA40]/60 rounded-tl-2xl pointer-events-none z-10" />
          <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-[#FFCA40]/60 rounded-tr-2xl pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 w-20 h-20 border-b-4 border-l-4 border-[#FFCA40]/60 rounded-bl-2xl pointer-events-none z-10" />
          <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#FFCA40]/60 rounded-br-2xl pointer-events-none z-10" />

          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-2xl border-2 border-[#FFCA40]/40 pointer-events-none z-10" />

          {/* Phaser Game - Fills entire container and scales */}
          <div className="absolute inset-0 w-full h-full">
            <PhaserGame />
          </div>

          {/* Quick Actions - Bottom Right Floating */}
          <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowControls(!showControls)}
              className="p-3 bg-black/50 backdrop-blur-xl rounded-xl border border-[#FFCA40]/30 hover:border-[#FFCA40]/60 transition-all shadow-xl"
            >
              <Settings className="w-5 h-5 text-[#FFCA40]" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 bg-black/50 backdrop-blur-xl rounded-xl border border-white/30 hover:border-white/60 transition-all shadow-xl"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleFullscreen}
              className="p-3 bg-black/50 backdrop-blur-xl rounded-xl border border-white/30 hover:border-white/60 transition-all shadow-xl"
            >
              <Maximize2 className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Controls Panel - Collapsible Bottom Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40"
          >
            <div className="bg-black/60 backdrop-blur-2xl rounded-2xl border-2 border-[#FFCA40]/50 shadow-2xl p-6 min-w-[600px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-6 h-6 text-[#FFCA40]" />
                  <h3 className="text-xl font-bold text-[#FFCA40]">Game Controls</h3>
                </div>
                <button
                  onClick={() => setShowControls(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <kbd className="px-4 py-2 bg-[#FFCA40]/20 rounded-lg text-[#FFCA40] font-mono text-sm font-bold border-2 border-[#FFCA40]/40 min-w-[60px] text-center">
                    ← ↑ → ↓
                  </kbd>
                  <span className="text-white/90 font-medium">Move Character</span>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <kbd className="px-4 py-2 bg-[#50E3C2]/20 rounded-lg text-[#50E3C2] font-mono text-sm font-bold border-2 border-[#50E3C2]/40 min-w-[60px] text-center">
                    SPACE
                  </kbd>
                  <span className="text-white/90 font-medium">Interact / Confirm</span>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <kbd className="px-4 py-2 bg-[#B8A4FF]/20 rounded-lg text-[#B8A4FF] font-mono text-sm font-bold border-2 border-[#B8A4FF]/40 min-w-[60px] text-center">
                    ESC
                  </kbd>
                  <span className="text-white/90 font-medium">Pause / Menu</span>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <kbd className="px-4 py-2 bg-[#FF6B9D]/20 rounded-lg text-[#FF6B9D] font-mono text-sm font-bold border-2 border-[#FF6B9D]/40 min-w-[60px] text-center">
                    ENTER
                  </kbd>
                  <span className="text-white/90 font-medium">Start Game</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-[#FFCA40]/10 rounded-xl border border-[#FFCA40]/30">
                <p className="text-sm text-[#FFCA40] flex items-center gap-2">
                  <span className="text-xl">💡</span>
                  <span className="font-semibold">Tip: Select your scene from the menu to begin your adventure!</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
