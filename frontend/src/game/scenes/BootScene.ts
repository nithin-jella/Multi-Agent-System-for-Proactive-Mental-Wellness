import * as Phaser from 'phaser';

/**
 * BootScene - Asset loading and initialization
 * 
 * Responsibilities:
 * - Load all game assets (sprites, backgrounds, audio, JSON)
 * - Display loading progress bar
 * - Transition to WorldMapScene when complete
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    console.log('[BootScene] Loading assets...');

    // Loading bar UI with UGM design system
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    
    // Progress box - UGM Blue with Gold border
    progressBox.fillStyle(0x001d58, 0.9);
    progressBox.lineStyle(3, 0xffca40, 0.8); // Gold border
    progressBox.fillRoundedRect(440, 320, 400, 50, 8);
    progressBox.strokeRoundedRect(440, 320, 400, 50, 8);

    // Loading text - UGM Gold
    const loadingText = this.add.text(960, 420, 'Loading CareQuest...', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#FFCA40', // UGM Gold
    }).setOrigin(0.5);

    // Progress events - Gold gradient with glow
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillGradientStyle(0xffca40, 0xffca40, 0xffb020, 0xffb020, 1);
      progressBar.fillRoundedRect(450, 330, 380 * value, 30, 4);
      
      // Add glow effect
      progressBar.lineStyle(2, 0xffca40, 0.6);
      progressBar.strokeRoundedRect(450, 330, 380 * value, 30, 4);
    });

    this.load.on('complete', () => {
      console.log('[BootScene] All assets loaded');
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load assets
    // TODO: Replace with real asset paths when generated
    
    // Backgrounds
    // this.load.image('ugm-campus', '/assets/backgrounds/ugm-campus-map.png');
    
    // Player sprite
    // this.load.spritesheet('player', '/assets/sprites/player.png', {
    //   frameWidth: 32,
    //   frameHeight: 48,
    // });
    
    // Monster sprites (5 common + 5 bosses)
    // this.load.spritesheet('monster-anxiety', '/assets/monsters/anxiety.png', {
    //   frameWidth: 64,
    //   frameHeight: 64,
    // });
    
    // NPC sprites
    // this.load.spritesheet('npc-aika', '/assets/npcs/aika.png', {
    //   frameWidth: 32,
    //   frameHeight: 48,
    // });

    // Sentence database (already exists)
    this.load.json('sentences', '/assets/game/sentences-database.json');

    // Placeholder: Create temporary assets for testing
    this.createPlaceholderAssets();
  }

  create() {
    console.log('[BootScene] Assets loaded, transitioning to MenuScene');
    this.scene.start('MenuScene');
  }

  /**
   * Create placeholder graphics for testing (remove when real assets ready)
   */
  private createPlaceholderAssets() {
    // Placeholder player sprite
    const playerGraphics = this.add.graphics();
    playerGraphics.fillStyle(0x00ff00, 1);
    playerGraphics.fillCircle(16, 24, 15);
    playerGraphics.generateTexture('player-placeholder', 32, 48);
    playerGraphics.destroy();

    // Placeholder monster sprite
    const monsterGraphics = this.add.graphics();
    monsterGraphics.fillStyle(0xff0000, 1);
    monsterGraphics.fillCircle(32, 32, 30);
    monsterGraphics.generateTexture('monster-placeholder', 64, 64);
    monsterGraphics.destroy();

    // Placeholder NPC sprite
    const npcGraphics = this.add.graphics();
    npcGraphics.fillStyle(0x0000ff, 1);
    npcGraphics.fillCircle(16, 24, 15);
    npcGraphics.generateTexture('npc-placeholder', 32, 48);
    npcGraphics.destroy();
  }
}
