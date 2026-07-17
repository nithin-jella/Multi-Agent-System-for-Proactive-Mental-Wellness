import * as Phaser from 'phaser';
import { TypingEngine } from '../systems/TypingEngine';
import { CombatSystem } from '../systems/CombatSystem';
import { EventBridge } from '../utils/EventBridge';
import { StatsPanel, type StatsData } from '../ui/StatsPanel';
import { UpgradePanel, type Upgrade } from '../ui/UpgradePanel';
import { AlliesPanel, type Ally } from '../ui/AlliesPanel';

/**
 * CombatScene - Main typing combat gameplay
 * 
 * Features:
 * - TypeRacer-style typing combat
 * - Upgrades system (CARE currency)
 * - Allies system (JOY currency)
 * - Real-time WPM tracking
 * - Combo system
 * - Stage progression with boss battles
 */

interface GameState {
  stage: number;
  resources: { joy: number; care: number; harmony: number };
  upgrades: Record<string, { level: number; cost: number }>;
  allies: Record<string, { count: number; cost: number }>;
  combo: number;
  currentWPM: number;
  monster: { hp: number; maxHp: number; name: string; isBoss: boolean };
}

export class CombatScene extends Phaser.Scene {
  // Core systems
  private typingEngine!: TypingEngine;
  private combatSystem!: CombatSystem;
  private eventBridge!: EventBridge;

  // Game state
  private gameState!: GameState;

  // Display objects
  private monster!: Phaser.GameObjects.Sprite;
  private monsterHPBar!: Phaser.GameObjects.Graphics;
  private monsterHPText!: Phaser.GameObjects.Text;
  private sentenceText!: Phaser.GameObjects.Text[];
  private sentenceContainer!: Phaser.GameObjects.Container;

  // UI Panels
  private statsPanel!: StatsPanel;
  private upgradePanel!: UpgradePanel;
  private alliesPanel!: AlliesPanel;

  // Timers
  private allyDPSTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'CombatScene' });
  }

  init() {
    console.log('[CombatScene] Initializing...');

    this.eventBridge = EventBridge.getInstance();

    // Load or initialize game state
    this.gameState = this.loadGameState();

    // Initialize typing engine
    const sentencesDB = this.cache.json.get('sentences');
    this.typingEngine = new TypingEngine(sentencesDB || { sentences: [] });

    // Initialize combat system
    this.combatSystem = new CombatSystem(this.gameState.stage);

    // Sync monster state
    const monster = this.combatSystem.getMonster();
    this.gameState.monster = {
      hp: monster.hp,
      maxHp: monster.maxHp,
      name: monster.name,
      isBoss: monster.type === 'boss',
    };
  }

  create() {
    console.log('[CombatScene] Creating UI...');

    // Background
    this.add.rectangle(0, 0, 1920, 1080, 0x001D58).setOrigin(0, 0);

    // Title
    this.add.text(960, 40, 'CareQuest Combat - Type to Attack!', {
      fontSize: '32px',
      color: '#FFCA40',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Monster
    this.createMonster();

    // Typing interface
    this.createTypingInterface();

    // UI Panels
    this.createUIPanels();

    // Setup timers
    this.setupTimers();

    // Keyboard input
    this.input.keyboard!.on('keydown', this.handleKeyPress, this);

    // Get first sentence
    this.getNewSentence();
  }

  private createMonster(): void {
    // Monster sprite
    this.monster = this.add.sprite(960, 300, 'monster-placeholder');
    this.monster.setScale(this.gameState.monster.isBoss ? 4 : 3);
    this.monster.setTint(this.gameState.monster.isBoss ? 0xff0000 : 0xff6666);

    // HP bar background
    this.add.rectangle(960, 480, 600, 45, 0x001d58).setStrokeStyle(3, 0xffca40);

    // HP bar fill
    this.monsterHPBar = this.add.graphics();

    // HP text
    this.monsterHPText = this.add.text(960, 480, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.updateMonsterHP();
  }

  private createTypingInterface(): void {
    this.sentenceContainer = this.add.container(960, 700);

    // Container background
    const bg = this.add.rectangle(0, 0, 1650, 180, 0x222222).setStrokeStyle(2, 0xFFCA40);
    this.sentenceContainer.add(bg);

    // Sentence will be rendered as individual character Text objects
    this.sentenceText = [];

    // Instructions
    const instructions = this.add.text(0, 75, 'Type the sentence above - Backspace to correct - 100% accuracy = CRIT!', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.sentenceContainer.add(instructions);
  }

  private createUIPanels(): void {
    // Stats panel (left side)
    this.statsPanel = new StatsPanel({
      scene: this,
      x: 20,
      y: 150,
      width: 250,
      height: 280,
    });

    // Upgrades panel (right side)
    const upgrades: Upgrade[] = [
      {
        key: 'typingPower',
        name: 'Typing Power',
        icon: '⚔️',
        description: '+10% damage',
        level: this.gameState.upgrades.typingPower.level,
        cost: this.gameState.upgrades.typingPower.cost,
        baseCost: 10,
        maxLevel: 50,
        effect: '+10% damage per level',
      },
      {
        key: 'criticalInsight',
        name: 'Critical Insight',
        icon: '💎',
        description: '+15% crit damage',
        level: this.gameState.upgrades.criticalInsight.level,
        cost: this.gameState.upgrades.criticalInsight.cost,
        baseCost: 15,
        maxLevel: 50,
        effect: '+15% crit damage per level',
      },
      {
        key: 'comboMastery',
        name: 'Combo Mastery',
        icon: '⚡',
        description: '+2% combo effect',
        level: this.gameState.upgrades.comboMastery.level,
        cost: this.gameState.upgrades.comboMastery.cost,
        baseCost: 12,
        maxLevel: 50,
        effect: '+2% combo effectiveness',
      },
    ];

    this.upgradePanel = new UpgradePanel({
      scene: this,
      x: 1350,
      y: 150,
      width: 550,
      height: 280,
      upgrades,
      resources: { care: this.gameState.resources.care },
      onPurchase: (key) => this.purchaseUpgrade(key),
    });

    // Allies panel (right side, below upgrades)
    const allies: Ally[] = [
      {
        key: 'therapist',
        name: 'Therapist',
        icon: '👨‍⚕️',
        description: 'Passive DPS',
        count: this.gameState.allies.therapist.count,
        cost: this.gameState.allies.therapist.cost,
        baseCost: 50,
        dps: 2,
      },
      {
        key: 'counselor',
        name: 'Counselor',
        icon: '👩‍🏫',
        description: 'Passive DPS',
        count: this.gameState.allies.counselor.count,
        cost: this.gameState.allies.counselor.cost,
        baseCost: 200,
        dps: 10,
      },
      {
        key: 'supporter',
        name: 'Support Group',
        icon: '👥',
        description: 'Passive DPS',
        count: this.gameState.allies.supporter.count,
        cost: this.gameState.allies.supporter.cost,
        baseCost: 1000,
        dps: 50,
      },
    ];

    this.alliesPanel = new AlliesPanel({
      scene: this,
      x: 1350,
      y: 450,
      width: 550,
      height: 280,
      allies,
      resources: { joy: this.gameState.resources.joy },
      onPurchase: (key) => this.purchaseAlly(key),
    });
  }

  private setupTimers(): void {
    // Ally passive DPS (every second)
    this.allyDPSTimer = this.time.addEvent({
      delay: 1000,
      callback: this.applyAllyDPS,
      callbackScope: this,
      loop: true,
    });
  }

  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.saveGameState();
      this.scene.start('MenuScene');
      return;
    }

    const result = this.typingEngine.handleKeyPress(event.key);

    // Update sentence display with color coding
    this.updateSentenceDisplay(result);

    // Track WPM
    this.gameState.currentWPM = result.wpm;

    // Check completion
    if (result.isComplete) {
      this.onSentenceComplete(result);
    }
  }

  private updateSentenceDisplay(result: { input: string; mistakes: number }): void {
    // Clear existing characters
    this.sentenceText.forEach((char) => char.destroy());
    this.sentenceText = [];

    const sentence = this.typingEngine['currentSentence'];
    const typed = result.input;

    let xOffset = -(sentence.length * 8);

    for (let i = 0; i < sentence.length; i++) {
      const char = sentence[i];
      const isTyped = i < typed.length;
      const isCorrect = isTyped && typed[i] === char;
      const isIncorrect = isTyped && typed[i] !== char;

      const color = isCorrect ? '#00ff00' : isIncorrect ? '#ff0000' : '#ffffff';
      const backgroundColor = isTyped ? (isCorrect ? '#003300' : '#330000') : '#000000';

      const charText = this.add.text(xOffset, -20, char, {
        fontSize: '24px',
        color,
        backgroundColor,
        padding: { x: 4, y: 2 },
      }).setOrigin(0, 0.5);

      this.sentenceContainer.add(charText);
      this.sentenceText.push(charText);

      xOffset += 16;
    }

    // Update stats panel
    this.updateUI();
  }

  private onSentenceComplete(result: { wpm: number; accuracy: number; mistakes: number }): void {
    // Calculate damage
    const damage = this.combatSystem.calculateDamage({
      wpm: result.wpm,
      accuracy: result.accuracy / 100,
      isCritical: result.accuracy === 100,
      combo: this.gameState.combo,
      upgrades: {
        typingPower: this.gameState.upgrades.typingPower.level,
        criticalInsight: this.gameState.upgrades.criticalInsight.level,
        comboMastery: this.gameState.upgrades.comboMastery.level,
      },
    });

    // Apply damage
    this.combatSystem.applyDamage(damage);
    const monster = this.combatSystem.getMonster();
    this.gameState.monster.hp = monster.hp;

    // Visual feedback
    this.showDamageNumber(damage, result.accuracy === 100);
    this.cameras.main.shake(200, result.accuracy === 100 ? 0.02 : 0.01);

    // Update combo
    if (result.mistakes === 0) {
      this.gameState.combo++;
    } else {
      this.gameState.combo = 0;
    }

    // Update UI
    this.updateMonsterHP();
    this.updateUI();

    // Check defeat
    if (this.combatSystem.isMonsterDefeated()) {
      this.onMonsterDefeated();
    } else {
      // Next sentence
      this.time.delayedCall(500, () => {
        this.getNewSentence();
        this.typingEngine.reset();
      });
    }
  }

  private onMonsterDefeated(): void {
    // Award resources
    const joyReward = 10 + this.gameState.stage * 2;
    const careReward = 5 + this.gameState.stage;
    const harmonyReward = this.gameState.monster.isBoss ? 5 : 1;

    this.gameState.resources.joy += joyReward;
    this.gameState.resources.care += careReward;
    this.gameState.resources.harmony += harmonyReward;

    // Victory animation
    this.tweens.add({
      targets: this.monster,
      alpha: 0,
      scale: 0,
      duration: 500,
      onComplete: () => {
        this.gameState.stage++;
        this.combatSystem = new CombatSystem(this.gameState.stage);

        const monster = this.combatSystem.getMonster();
        this.gameState.monster = {
          hp: monster.hp,
          maxHp: monster.maxHp,
          name: monster.name,
          isBoss: monster.type === 'boss',
        };

        this.monster.setAlpha(1).setScale(this.gameState.monster.isBoss ? 4 : 3);
        this.monster.setTint(this.gameState.monster.isBoss ? 0xff0000 : 0xff6666);

        this.updateMonsterHP();
        this.getNewSentence();
        this.updateUI();
      },
    });
  }

  private getNewSentence(): void {
    const difficulty = Math.min(5, Math.floor(this.gameState.stage / 2) + 1);
    const sentence = this.typingEngine.getSentence({ difficulty, category: 'Affirmations', language: 'en' });
    this.sentenceText.forEach((char) => char.destroy());
    this.sentenceText = [];
  }

  private updateMonsterHP(): void {
    const percentage = this.gameState.monster.hp / this.gameState.monster.maxHp;

    this.monsterHPBar.clear();

    // HP bar fill
    const color = percentage > 0.5 ? 0xFFCA40 : percentage > 0.25 ? 0xFFB020 : 0xFF4400;
    this.monsterHPBar.fillStyle(color);
    this.monsterHPBar.fillRect(660, 465, 600 * percentage, 30);

    // HP text
    this.monsterHPText.setText(`${Math.ceil(this.gameState.monster.hp)} / ${this.gameState.monster.maxHp} HP`);
  }

  private showDamageNumber(damage: number, isCrit: boolean): void {
    const text = this.add.text(960, 300, `-${Math.round(damage)}`, {
      fontSize: isCrit ? '48px' : '32px',
      color: isCrit ? '#ffff00' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    if (isCrit) {
      text.setText(`CRIT! -${Math.round(damage)}`);
    }

    this.tweens.add({
      targets: text,
      y: text.y - 100,
      alpha: 0,
      duration: 1500,
      onComplete: () => text.destroy(),
    });
  }

  private applyAllyDPS(): void {
    const totalDPS =
      this.gameState.allies.therapist.count * 2 +
      this.gameState.allies.counselor.count * 10 +
      this.gameState.allies.supporter.count * 50;

    if (totalDPS > 0) {
      this.combatSystem.applyDamage(totalDPS);
      const monster = this.combatSystem.getMonster();
      this.gameState.monster.hp = monster.hp;
      this.updateMonsterHP();

      if (this.combatSystem.isMonsterDefeated()) {
        this.onMonsterDefeated();
      }
    }
  }

  private purchaseUpgrade(key: string): void {
    const upgrade = this.gameState.upgrades[key];
    if (!upgrade) return;

    if (this.gameState.resources.care >= upgrade.cost) {
      this.gameState.resources.care -= upgrade.cost;
      upgrade.level++;
      upgrade.cost = Math.floor(upgrade.cost * 1.15);

      this.upgradePanel.updateUpgrade(key, upgrade.level, upgrade.cost);
      this.upgradePanel.updateResources({ care: this.gameState.resources.care });
      this.updateUI();
    }
  }

  private purchaseAlly(key: string): void {
    const ally = this.gameState.allies[key];
    if (!ally) return;

    if (this.gameState.resources.joy >= ally.cost) {
      this.gameState.resources.joy -= ally.cost;
      ally.count++;
      ally.cost = Math.floor(ally.cost * 1.15);

      this.alliesPanel.updateAlly(key, ally.count, ally.cost);
      this.alliesPanel.updateResources({ joy: this.gameState.resources.joy });
      this.updateUI();
    }
  }

  private updateUI(): void {
    const statsData: StatsData = {
      joy: this.gameState.resources.joy,
      care: this.gameState.resources.care,
      harmony: this.gameState.resources.harmony,
      wpm: this.gameState.currentWPM,
      combo: this.gameState.combo,
      stage: this.gameState.stage,
      monsterName: this.gameState.monster.name,
    };

    this.statsPanel.update(statsData);
  }

  private loadGameState(): GameState {
    const saved = localStorage.getItem('carequest_combat_state');
    if (saved) {
      return JSON.parse(saved);
    }

    return {
      stage: 1,
      resources: { joy: 100, care: 50, harmony: 10 },
      upgrades: {
        typingPower: { level: 0, cost: 10 },
        criticalInsight: { level: 0, cost: 15 },
        comboMastery: { level: 0, cost: 12 },
      },
      allies: {
        therapist: { count: 0, cost: 50 },
        counselor: { count: 0, cost: 200 },
        supporter: { count: 0, cost: 1000 },
      },
      combo: 0,
      currentWPM: 0,
      monster: { hp: 100, maxHp: 100, name: 'Gloom', isBoss: false },
    };
  }

  private saveGameState(): void {
    localStorage.setItem('carequest_combat_state', JSON.stringify(this.gameState));
  }

  shutdown() {
    this.saveGameState();
    this.input.keyboard!.off('keydown', this.handleKeyPress, this);
    if (this.allyDPSTimer) this.allyDPSTimer.destroy();
  }
}
