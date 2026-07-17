'use client';

import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { GAME_CONFIG } from '@/game/config';
import { BootScene } from '@/game/scenes/BootScene';
import { MenuScene } from '@/game/scenes/MenuScene';
import { WorldMapScene } from '@/game/scenes/WorldMapScene';
import { CombatScene } from '@/game/scenes/CombatScene';
import { EventBridge } from '@/game/utils/EventBridge';
import { useGameStore } from '@/store/gameStore';
import toast from 'react-hot-toast';

/**
 * PhaserGame - React wrapper for Phaser 3 game
 * 
 * Responsibilities:
 * - Initialize Phaser game instance
 * - Bridge events between Phaser and React
 * - Sync game state to backend via Zustand
 * - Display React UI overlays
 */
export function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateWellnessFromGame } = useGameStore();
  
  const [currentScene, setCurrentScene] = useState('Boot');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    console.log('[PhaserGame] Initializing Phaser 3 game...');

    // Create Phaser game instance
  const config: Phaser.Types.Core.GameConfig = {
    ...GAME_CONFIG,
    parent: containerRef.current,
    scene: [BootScene, MenuScene, WorldMapScene, CombatScene],
  };    gameRef.current = new Phaser.Game(config);
    setIsLoading(false);

    // Set up event listeners
    const eventBridge = EventBridge.getInstance();

    // Scene changes
    eventBridge.on('game:sceneChanged', (data: { scene: string }) => {
      console.log('[PhaserGame] Scene changed:', data.scene);
      setCurrentScene(data.scene);
    });

    // Combat victory
    eventBridge.on('combat:victory', async (data: {
      rewards: {
        joy_delta?: number;
        care_delta?: number;
        harmony_delta?: number;
      };
      finalWPM: number;
      finalAccuracy: number;
      difficulty: number;
    }) => {
      console.log('[PhaserGame] Combat victory, syncing rewards:', data);
      
      toast.success(`Victory! WPM: ${data.finalWPM}, Accuracy: ${data.finalAccuracy}%`);
      
      try {
        await updateWellnessFromGame(data.rewards);
        toast.success(`Rewards synced: +${data.rewards.joy_delta} JOY, +${data.rewards.care_delta} CARE, +${data.rewards.harmony_delta} Harmony`);
      } catch (error) {
        console.error('[PhaserGame] Failed to sync rewards:', error);
        toast.error('Failed to sync rewards to backend');
      }
    });

    // NPC interactions
    eventBridge.on('npc:interact', (data: { key: string; dialogue: string }) => {
      console.log('[PhaserGame] NPC interaction:', data);
      // TODO: Open DialogueScene overlay or React modal
    });

    // Cleanup
    return () => {
      console.log('[PhaserGame] Cleaning up...');
      eventBridge.removeAllListeners();
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [updateWellnessFromGame]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <div className="text-4xl font-bold text-[#FFCA40] mb-4 animate-pulse">Loading CareQuest...</div>
            <div className="w-64 h-3 bg-white/10 rounded-full overflow-hidden border border-[#FFCA40]/30">
              <div className="h-full w-full bg-gradient-to-r from-[#FFCA40] to-[#FFD700] animate-pulse"></div>
            </div>
            <p className="text-white/60 text-sm mt-4">Preparing your mental health adventure...</p>
          </div>
        </div>
      )}

      {/* Phaser canvas container - Scales to fill parent while maintaining aspect ratio */}
      <div
        ref={containerRef}
        id="phaser-game-container"
        className="w-full h-full"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      {/* React UI overlays - Minimal and non-intrusive */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl z-10 border border-[#FFCA40]/30">
        <div className="text-xs font-bold mb-1 text-[#FFCA40]">Scene: {currentScene}</div>
        <div className="text-[10px] text-white/70">
          {currentScene === 'Menu' && '🎮 Select a scene to begin'}
          {currentScene === 'WorldMap' && '🗺️ Explore the world'}
          {currentScene === 'Combat' && '⚔️ Type to attack!'}
          {currentScene === 'Boot' && '⏳ Loading assets...'}
        </div>
      </div>

      {/* Debug: Game status */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white p-3 rounded-xl text-xs font-mono z-10 border border-white/20">
          <div className="text-[#50E3C2] font-bold mb-1">Debug Info</div>
          <div className="text-white/70">Phaser {Phaser.VERSION}</div>
          <div className="text-white/70">Scene: {currentScene}</div>
          <div className="text-white/70">Target: 60 FPS</div>
        </div>
      )}
    </div>
  );
}
