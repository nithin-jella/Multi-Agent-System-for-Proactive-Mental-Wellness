/**
 * TypingEngine - Handles real-time typing validation and metrics
 * 
 * Enhanced Features (PRD R7 Compliance):
 * - Character-by-character validation with real-time visual feedback
 * - WPM (Words Per Minute) calculation within 100ms
 * - Accuracy tracking (mistakes vs total characters)
 * - Combo system with consecutive correct character tracking
 * - Critical hit detection (100% accuracy)
 * - Timeout enforcement (>15 seconds resets combo)
 * - Sentence cooldown management (72-hour per sentence)
 * - Sentence selection from database with difficulty/category filtering
 * 
 * Damage Formula Support:
 * (WPM/60 × 0.5 × accuracy) × upgrades × combo × crit
 */

interface SentenceDB {
  sentences: Array<{
    text_en: string;
    text_id: string;
    difficulty: number;
    category: string;
    id?: string; // For cooldown tracking
  }>;
}

interface SentenceFilters {
  difficulty: number;
  category: string;
  language: 'en' | 'id';
}

export interface TypingResult {
  type: 'character' | 'backspace';
  input: string;
  isComplete: boolean;
  wpm: number;
  accuracy: number;
  mistakes: number;
  combo: number;
  isCrit: boolean; // 100% accuracy = critical hit
  isTimeout: boolean; // Exceeded 15 seconds
  consecutiveCorrect: number; // For combo multiplier calculation
}

const SENTENCE_TIMEOUT_MS = 15000; // 15 seconds
const SENTENCE_COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours

export class TypingEngine {
  private sentencesDB: SentenceDB;
  private currentSentence: string = '';
  private currentSentenceId: string = '';
  private userInput: string = '';
  private startTime: number = 0;
  private mistakes: number = 0;
  private consecutiveCorrect: number = 0;
  private totalCharactersTyped: number = 0;
  private lastKeyPressTime: number = 0;

  constructor(sentencesDB: SentenceDB) {
    this.sentencesDB = sentencesDB;
    console.log(`[TypingEngine] Initialized with ${sentencesDB.sentences.length} sentences`);
    this.cleanExpiredCooldowns();
  }

  /**
   * Get a random sentence matching filters (excluding cooldown sentences)
   */
  getSentence(filters: SentenceFilters): string {
    const cooldowns = this.getCooldownSentences();
    
    const filtered = this.sentencesDB.sentences.filter(
      (s) =>
        s.difficulty === filters.difficulty &&
        s.category === filters.category &&
        !cooldowns.includes(s.id || `${s.text_en}-${s.text_id}`)
    );

    if (filtered.length === 0) {
      console.warn('[TypingEngine] No sentences match filters (or all on cooldown), using fallback');
      return 'I am capable of handling challenges with grace and strength.';
    }

    const selected = filtered[Math.floor(Math.random() * filtered.length)];
    this.currentSentence = filters.language === 'en' ? selected.text_en : selected.text_id;
    this.currentSentenceId = selected.id || `${selected.text_en}-${selected.text_id}`;
    this.startTime = Date.now();
    this.lastKeyPressTime = Date.now();
    this.mistakes = 0;
    this.userInput = '';
    this.consecutiveCorrect = 0;
    this.totalCharactersTyped = 0;

    console.log(`[TypingEngine] Selected sentence (${filters.difficulty}/${filters.category}):`, this.currentSentence);
    return this.currentSentence;
  }

  /**
   * Handle keyboard input with enhanced tracking
   */
  handleKeyPress(key: string): TypingResult {
    this.lastKeyPressTime = Date.now();

    if (key === 'Backspace') {
      if (this.userInput.length > 0) {
        this.userInput = this.userInput.slice(0, -1);
        // Backspace doesn't reset consecutive correct, but doesn't add to it either
      }
      return this.buildResult('backspace', false);
    }

    // Only accept single printable characters
    if (key.length === 1) {
      const expected = this.currentSentence[this.userInput.length];
      this.totalCharactersTyped++;

      // Track mistakes and combo
      if (key !== expected) {
        this.mistakes++;
        this.consecutiveCorrect = 0; // Break combo on mistake
      } else {
        this.consecutiveCorrect++;
      }

      this.userInput += key;

      // Check completion
      const isComplete = this.userInput === this.currentSentence;

      if (isComplete) {
        const wpm = this.calculateWPM();
        const accuracy = this.calculateAccuracy();
        const isCrit = accuracy === 100;

        console.log(`[TypingEngine] Sentence complete! WPM: ${wpm}, Accuracy: ${accuracy}%, Crit: ${isCrit}`);

        // Add sentence to cooldown
        this.addSentenceToCooldown(this.currentSentenceId);

        return this.buildResult('character', isComplete, wpm, accuracy, isCrit);
      }

      return this.buildResult('character', false);
    }

    // Ignore other keys (Shift, Ctrl, etc.)
    return this.buildResult('character', false);
  }

  /**
   * Check if sentence typing has timed out (>15 seconds)
   */
  isTimeout(): boolean {
    const elapsed = Date.now() - this.lastKeyPressTime;
    return elapsed > SENTENCE_TIMEOUT_MS && this.userInput.length > 0;
  }

  /**
   * Reset for next sentence
   */
  reset(): void {
    this.userInput = '';
    this.startTime = Date.now();
    this.lastKeyPressTime = Date.now();
    this.mistakes = 0;
    this.consecutiveCorrect = 0;
    this.totalCharactersTyped = 0;
  }

  /**
   * Build TypingResult with all metrics
   */
  private buildResult(
    type: 'character' | 'backspace',
    isComplete: boolean,
    wpm: number = 0,
    accuracy: number = 0,
    isCrit: boolean = false
  ): TypingResult {
    return {
      type,
      input: this.userInput,
      isComplete,
      wpm: isComplete ? wpm : this.calculateLiveWPM(),
      accuracy: isComplete ? accuracy : this.calculateLiveAccuracy(),
      mistakes: this.mistakes,
      combo: this.consecutiveCorrect,
      isCrit,
      isTimeout: this.isTimeout(),
      consecutiveCorrect: this.consecutiveCorrect,
    };
  }

  /**
   * Calculate Words Per Minute (final)
   */
  private calculateWPM(): number {
    const timeInMinutes = (Date.now() - this.startTime) / 60000;
    const words = this.currentSentence.split(' ').length;
    return Math.round(words / timeInMinutes);
  }

  /**
   * Calculate live WPM (updated during typing)
   */
  private calculateLiveWPM(): number {
    if (this.userInput.length === 0) return 0;
    const timeInMinutes = (Date.now() - this.startTime) / 60000;
    const words = this.userInput.split(' ').length;
    return Math.round(words / timeInMinutes);
  }

  /**
   * Calculate accuracy percentage (final)
   */
  private calculateAccuracy(): number {
    const totalChars = this.currentSentence.length;
    const correctChars = totalChars - this.mistakes;
    return Math.max(0, Math.round((correctChars / totalChars) * 100));
  }

  /**
   * Calculate live accuracy (updated during typing)
   */
  private calculateLiveAccuracy(): number {
    if (this.totalCharactersTyped === 0) return 100;
    const correctChars = this.totalCharactersTyped - this.mistakes;
    return Math.max(0, Math.round((correctChars / this.totalCharactersTyped) * 100));
  }

  /**
   * Add sentence to cooldown (72 hours)
   */
  private addSentenceToCooldown(sentenceId: string): void {
    try {
      const cooldowns = this.getCooldownSentences();
      const expireTime = Date.now() + SENTENCE_COOLDOWN_MS;
      
      cooldowns.push(sentenceId);
      
      // Store with expiration times
      const cooldownData = JSON.parse(localStorage.getItem('sentence_cooldowns') || '{}');
      cooldownData[sentenceId] = expireTime;
      
      localStorage.setItem('sentence_cooldowns', JSON.stringify(cooldownData));
      console.log(`[TypingEngine] Added sentence to cooldown: ${sentenceId} (expires: ${new Date(expireTime).toLocaleString()})`);
    } catch (error) {
      console.error('[TypingEngine] Failed to add cooldown:', error);
    }
  }

  /**
   * Get list of sentences on cooldown
   */
  private getCooldownSentences(): string[] {
    try {
      const cooldownData = JSON.parse(localStorage.getItem('sentence_cooldowns') || '{}');
      const now = Date.now();
      
      return Object.keys(cooldownData).filter((id) => cooldownData[id] > now);
    } catch (error) {
      console.error('[TypingEngine] Failed to get cooldowns:', error);
      return [];
    }
  }

  /**
   * Clean up expired cooldowns
   */
  private cleanExpiredCooldowns(): void {
    try {
      const cooldownData = JSON.parse(localStorage.getItem('sentence_cooldowns') || '{}');
      const now = Date.now();
      
      Object.keys(cooldownData).forEach((id) => {
        if (cooldownData[id] <= now) {
          delete cooldownData[id];
        }
      });
      
      localStorage.setItem('sentence_cooldowns', JSON.stringify(cooldownData));
      console.log('[TypingEngine] Cleaned expired cooldowns');
    } catch (error) {
      console.error('[TypingEngine] Failed to clean cooldowns:', error);
    }
  }

  /**
   * Get current sentence for display
   */
  getCurrentSentence(): string {
    return this.currentSentence;
  }

  /**
   * Get user input for display
   */
  getUserInput(): string {
    return this.userInput;
  }
}
