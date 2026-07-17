/**
 * CombatSystem - Monster HP management and damage calculation
 * 
 * PRD R7 Compliance:
 * - Damage Formula: (WPM/60 × 0.5 × accuracy) × upgrades × combo × crit
 * - Monster HP Scaling: Base HP × (1 + Stage × 0.2) × Type Multiplier
 * - Boss encounters every 10 stages with 7x HP
 * - Critical hits at 100% accuracy with 2.5x multiplier
 * - Upgrade system integration
 */

export interface DamageCalculation {
  wpm: number;
  accuracy: number; // 0-1 (e.g., 0.95 = 95%)
  isCritical: boolean; // 100% accuracy
  combo: number; // Current combo count
  upgrades: {
    typingPower: number; // Level of Typing Power upgrade
    criticalInsight: number; // Level of Critical Insight upgrade
    comboMastery: number; // Level of Combo Mastery upgrade
  };
}

export interface MonsterStats {
  stage: number;
  hp: number;
  maxHp: number;
  type: 'common' | 'boss';
  name: string;
}

const BASE_MONSTER_HP = 100;
const BOSS_HP_MULTIPLIER = 7;
const STAGE_HP_SCALING = 0.2;
const CRIT_MULTIPLIER = 2.5;
const DAMAGE_BASE_MULTIPLIER = 0.5;

export class CombatSystem {
  private currentMonster: MonsterStats;
  private combo: number = 0;

  constructor(initialStage: number = 1) {
    this.currentMonster = this.generateMonster(initialStage);
    console.log(`[CombatSystem] Initialized at stage ${initialStage}`, this.currentMonster);
  }

  get hp(): number {
    return this.currentMonster.hp;
  }

  get maxHp(): number {
    return this.currentMonster.maxHp;
  }

  getComboCount(): number {
    return this.combo;
  }

  incrementCombo(): void {
    this.combo++;
  }

  resetCombo(): void {
    this.combo = 0;
  }

  getComboMultiplier(): number {
    // Combo multiplier (from Combo Mastery upgrade - assuming level 1 for now or passed in?)
    // For now, hardcode or use default logic
    let comboMultiplier = 1;
    if (this.combo >= 20) comboMultiplier = 2.0;
    else if (this.combo >= 10) comboMultiplier = 1.5;
    else if (this.combo >= 5) comboMultiplier = 1.25;
    else if (this.combo >= 3) comboMultiplier = 1.1;
    return comboMultiplier;
  }

  isDefeated(): boolean {
    return this.isMonsterDefeated();
  }

  /**
   * Generate a new monster based on stage number
   * PRD R7: HP = Base HP × (1 + Stage × 0.2) × Type Multiplier
   */
  generateMonster(stage: number): MonsterStats {
    const isBoss = stage % 10 === 0;
    const typeMultiplier = isBoss ? BOSS_HP_MULTIPLIER : 1;

    const maxHp = Math.floor(
      BASE_MONSTER_HP * (1 + stage * STAGE_HP_SCALING) * typeMultiplier
    );

    const monsterType = isBoss ? 'boss' : 'common';
    const monsterName = isBoss
      ? `Gloom Boss (Stage ${stage})`
      : `Gloom Monster (Stage ${stage})`;

    return {
      stage,
      hp: maxHp,
      maxHp,
      type: monsterType,
      name: monsterName,
    };
  }

  /**
   * Calculate damage from typing performance
   * PRD R7: (WPM/60 × 0.5 × accuracy) × upgrades × combo × crit
   */
  calculateDamage(input: DamageCalculation): number {
    // Base damage: (WPM/60 × 0.5 × accuracy)
    const baseDamage = (input.wpm / 60) * DAMAGE_BASE_MULTIPLIER * input.accuracy;

    // Upgrade multipliers
    const typingPowerBoost = 1 + (input.upgrades.typingPower * 0.15); // +15% per level
    const upgradeMultiplier = typingPowerBoost;

    // Combo multiplier (from Combo Mastery upgrade)
    const comboMasteryBonus = input.upgrades.comboMastery * 0.05; // +5% per level
    let comboMultiplier = 1;
    if (input.combo >= 20) comboMultiplier = 2.0 + comboMasteryBonus * 2;
    else if (input.combo >= 10) comboMultiplier = 1.5 + comboMasteryBonus * 1.5;
    else if (input.combo >= 5) comboMultiplier = 1.25 + comboMasteryBonus * 1.25;
    else if (input.combo >= 3) comboMultiplier = 1.1 + comboMasteryBonus * 1.1;

    // Critical hit multiplier (100% accuracy = 2.5x, boosted by Critical Insight)
    const critInsightBoost = input.upgrades.criticalInsight * 0.1; // +10% per level
    const critMultiplier = input.isCritical
      ? CRIT_MULTIPLIER + critInsightBoost
      : 1.0;

    const totalDamage = baseDamage * upgradeMultiplier * comboMultiplier * critMultiplier;

    console.log(`[CombatSystem] Damage breakdown:`, {
      baseDamage: baseDamage.toFixed(2),
      upgradeMultiplier: upgradeMultiplier.toFixed(2),
      comboMultiplier: comboMultiplier.toFixed(2),
      critMultiplier: critMultiplier.toFixed(2),
      totalDamage: totalDamage.toFixed(2),
      isCritical: input.isCritical,
    });

    return Math.ceil(totalDamage); // Round up for player benefit
  }

  /**
   * Apply damage to current monster
   * Returns remaining HP
   */
  applyDamage(damage: number): number {
    this.currentMonster.hp -= damage;
    if (this.currentMonster.hp < 0) this.currentMonster.hp = 0;

    console.log(
      `[CombatSystem] ${this.currentMonster.name} HP: ${this.currentMonster.hp}/${this.currentMonster.maxHp}`
    );

    return this.currentMonster.hp;
  }

  /**
   * Check if current monster is defeated
   */
  isMonsterDefeated(): boolean {
    return this.currentMonster.hp <= 0;
  }

  /**
   * Get current monster stats
   */
  getMonster(): MonsterStats {
    return { ...this.currentMonster };
  }

  /**
   * Get HP percentage for UI
   */
  getHPPercentage(): number {
    return this.currentMonster.hp / this.currentMonster.maxHp;
  }

  /**
   * Spawn next monster (advance to next stage)
   */
  nextMonster(currentStage: number): MonsterStats {
    this.currentMonster = this.generateMonster(currentStage);
    console.log(`[CombatSystem] Spawned new monster at stage ${currentStage}`, this.currentMonster);
    return { ...this.currentMonster };
  }

  /**
   * Reset combat system to specific stage
   */
  reset(stage: number = 1): void {
    this.currentMonster = this.generateMonster(stage);
    console.log(`[CombatSystem] Reset to stage ${stage}`);
  }
}
