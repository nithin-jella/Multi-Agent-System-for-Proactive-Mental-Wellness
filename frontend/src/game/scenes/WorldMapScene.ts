import * as Phaser from 'phaser';
import { EventBridge } from '../utils/EventBridge';

/**
 * WorldMapScene - UGM campus exploration
 * 
 * Features:
 * - Player movement (arrow keys)
 * - NPC interactions (Aika, counselors)
 * - Monster encounter zones
 * - Quest markers
 */
export class WorldMapScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private eventBridge!: EventBridge;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  create() {
    console.log('[WorldMapScene] Creating world map...');

    // Get dynamic dimensions
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Event bridge for React communication
    this.eventBridge = EventBridge.getInstance();

    // Background (TODO: Use UGM campus map when generated)
    this.add.rectangle(centerX, centerY, width, height, 0x88cc88);
    this.add.text(centerX, height * 0.07, 'UGM Campus - CareQuest World', {
      fontSize: `${Math.min(width, height) * 0.03}px`,
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);

    // Player sprite (using placeholder)
    this.player = this.physics.add.sprite(centerX, centerY, 'player-placeholder');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10); // Render on top

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Spawn NPCs - use relative positioning
    this.spawnNPC('aika', width * 0.39, height * 0.42, 'Hai! Aku Aika, virtual assistant UGM-AICare! 👋');

    // Spawn monster zones - use relative positioning
    this.spawnMonsterZone(width * 0.625, height * 0.56, 'Anxiety Monster', 3);
    this.spawnMonsterZone(width * 0.234, height * 0.69, 'Stress Monster', 2);

    // Instructions
    this.add.text(centerX, height * 0.90, 'Arrow Keys: Move | Click NPC: Talk | Click Red Zone: Combat', {
      fontSize: `${Math.min(width, height) * 0.015}px`,
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5);

    // ESC key handler
    this.input.keyboard?.on('keydown-ESC', () => {
      console.log('[WorldMapScene] ESC pressed, returning to menu');
      this.scene.start('MenuScene');
    });

    // Notify React
    this.eventBridge.emit('game:sceneChanged', { scene: 'WorldMap' });
  }

  update() {
    // Player movement
    const speed = 160;
    this.player.setVelocity(0);

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
    }

    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      this.player.setVelocityY(speed);
    }
  }

  /**
   * Spawn an NPC that can be clicked for dialogue
   */
  private spawnNPC(key: string, x: number, y: number, dialogue: string) {
    const npc = this.physics.add.sprite(x, y, 'npc-placeholder');
    npc.setInteractive();

    // Label
    this.add.text(x, y - 40, key.toUpperCase(), {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#0000ff',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5);

    npc.on('pointerdown', () => {
      console.log(`[WorldMapScene] Interacting with NPC: ${key}`);
      this.eventBridge.emit('npc:interact', { key, dialogue });
      
      // TODO: Open DialogueScene overlay
      alert(`${key.toUpperCase()}: ${dialogue}`);
    });

    // Hover effect
    npc.on('pointerover', () => {
      npc.setTint(0xaaaaff);
    });
    npc.on('pointerout', () => {
      npc.clearTint();
    });
  }

  /**
   * Spawn a monster encounter zone
   */
  private spawnMonsterZone(x: number, y: number, monsterType: string, difficulty: number) {
    // Create interaction zone
    const zone = this.add.circle(x, y, 50, 0xff0000, 0.3);
    zone.setInteractive();

    // Label
    this.add.text(x, y - 70, monsterType, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#ff0000',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5);

    zone.on('pointerdown', () => {
      console.log(`[WorldMapScene] Entering combat with ${monsterType} (difficulty ${difficulty})`);
      this.scene.start('CombatScene', { monsterType, difficulty });
    });

    // Hover effect
    zone.on('pointerover', () => {
      this.tweens.add({
        targets: zone,
        alpha: 0.6,
        duration: 200,
      });
    });
    zone.on('pointerout', () => {
      this.tweens.add({
        targets: zone,
        alpha: 0.3,
        duration: 200,
      });
    });
  }
}
