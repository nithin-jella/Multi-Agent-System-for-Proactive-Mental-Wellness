import { create } from 'zustand';
import { updateWellnessState } from '@/services/questApi';

/**
 * GameStore - Shared state between Phaser and React
 * 
 * Responsibilities:
 * - Store wellness state (JOY, CARE, Harmony)
 * - Sync game rewards to backend
 * - Manage game settings
 */

interface GameState {
  // Wellness state
  joy: number;
  care: number;
  harmony: number;
  
  // Game settings
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  language: 'en' | 'id';
  
  // Actions
  updateWellnessFromGame: (deltas: {
    joy_delta?: number;
    care_delta?: number;
    harmony_delta?: number;
  }) => Promise<void>;
  
  setWellnessState: (state: {
    joy: number;
    care: number;
    harmony: number;
  }) => void;
  
  toggleSound: () => void;
  setMusicVolume: (volume: number) => void;
  setSFXVolume: (volume: number) => void;
  setLanguage: (language: 'en' | 'id') => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial wellness state
  joy: 0,
  care: 0,
  harmony: 0,
  
  // Initial settings
  soundEnabled: true,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  language: 'en',
  
  /**
   * Update wellness state from game rewards
   * Syncs to backend via API
   */
  updateWellnessFromGame: async (deltas) => {
    console.log('[gameStore] Syncing wellness deltas to backend:', deltas);
    
    try {
      const response = await updateWellnessState(deltas);
      
      // Update local state with server response
      // Map backend fields to local state
      set({
        joy: response.joy_balance,
        care: response.care_balance,
        harmony: response.harmony_score,
      });
      
      console.log('[gameStore] Wellness synced successfully:', response);
    } catch (error) {
      console.error('[gameStore] Failed to sync wellness:', error);
      
      // Fallback: Update local state optimistically
      const currentState = get();
      set({
        joy: currentState.joy + (deltas.joy_delta || 0),
        care: currentState.care + (deltas.care_delta || 0),
        harmony: currentState.harmony + (deltas.harmony_delta || 0),
      });
      
      throw error; // Re-throw for UI error handling
    }
  },
  
  /**
   * Set wellness state directly (e.g., from initial fetch)
   */
  setWellnessState: (state) => {
    set({
      joy: state.joy,
      care: state.care,
      harmony: state.harmony,
    });
  },
  
  /**
   * Toggle sound on/off
   */
  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },
  
  /**
   * Set music volume (0.0 - 1.0)
   */
  setMusicVolume: (volume) => {
    set({ musicVolume: Math.max(0, Math.min(1, volume)) });
  },
  
  /**
   * Set SFX volume (0.0 - 1.0)
   */
  setSFXVolume: (volume) => {
    set({ sfxVolume: Math.max(0, Math.min(1, volume)) });
  },
  
  /**
   * Set game language
   */
  setLanguage: (language) => {
    set({ language });
  },
}));
