import * as Phaser from 'phaser';

/**
 * MenuScene - Developer Testing Menu
 * 
 * Scene selection hub for easier development and testing.
 * Provides quick access to all game scenes with UGM design system styling.
 * 
 * UGM Design System:
 * - Blue: #001D58 (primary)
 * - Blue Dark: #00308F (gradient)
 * - Gold: #FFCA40 (accent)
 * - Glassmorphism effects
 * - Smooth animations
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background - UGM Blue gradient
    const bgGraphics = this.add.graphics();
    bgGraphics.fillGradientStyle(0x001d58, 0x001d58, 0x00308f, 0x00308f, 1);
    bgGraphics.fillRect(0, 0, width, height);

    // Animated orbs background (subtle decorative elements)
    this.createAnimatedOrbs();

    // Title - "CareQuest"
    const title = this.add.text(centerX, 120, 'CareQuest', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#FFCA40', // UGM Gold
      stroke: '#001D58',
      strokeThickness: 4,
    });
    title.setOrigin(0.5, 0.5);
    
    // Add title glow effect
    title.setBlendMode(Phaser.BlendModes.ADD);
    title.setAlpha(0.9);

    // Subtitle
    const subtitle = this.add.text(centerX, 190, 'Scene Selection - Developer Menu', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#FFCA40',
    });
    subtitle.setOrigin(0.5, 0.5).setAlpha(0.8);

    // Scene selection buttons
    const buttonConfig = [
      {
        text: '🗺️ World Map',
        scene: 'WorldMapScene',
        description: 'Explore UGM Campus',
        yOffset: 0,
      },
      {
        text: '🎮 CareQuest Hub',
        scene: 'CareQuestHubScene',
        description: 'TypeRacer + Tap Titans Game',
        yOffset: 100,
      },
      {
        text: '⚔️ Typing Combat',
        scene: 'CombatScene',
        description: 'Traditional Sentence Combat',
        yOffset: 200,
      },
      {
        text: '🏠 Back to Website',
        scene: null, // Special case - navigate back
        description: 'Return to CareQuest Page',
        yOffset: 300,
      },
    ];

    const startY = centerY - 50;

    buttonConfig.forEach((btn) => {
      this.createMenuButton(
        centerX,
        startY + btn.yOffset,
        btn.text,
        btn.description,
        btn.scene
      );
    });

    // Footer credits
    const footer = this.add.text(centerX, height - 40, 'UGM-AICare © 2025 | Press any button to begin', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
    });
    footer.setOrigin(0.5, 0.5).setAlpha(0.5);

    // ESC key to reload menu (refresh)
    this.input.keyboard?.on('keydown-ESC', () => {
      console.log('[MenuScene] ESC pressed, restarting menu');
      this.scene.restart();
    });
  }

  /**
   * Create a glassmorphism-styled menu button
   */
  private createMenuButton(
    x: number,
    y: number,
    text: string,
    description: string,
    targetScene: string | null
  ) {
    const buttonWidth = 500;
    const buttonHeight = 70;

    // Button container
    const container = this.add.container(x, y);

    // Glassmorphism background
    const bg = this.add.graphics();
    bg.fillStyle(0x001d58, 0.6); // Semi-transparent blue
    bg.lineStyle(2, 0xffca40, 0.8); // Gold border
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);

    // Button main text
    const buttonText = this.add.text(0, -10, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#FFCA40', // Gold
    });
    buttonText.setOrigin(0.5, 0.5);

    // Button description
    const descText = this.add.text(0, 18, description, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
    });
    descText.setOrigin(0.5, 0.5).setAlpha(0.7);

    container.add([bg, buttonText, descText]);

    // Make interactive
    const hitArea = new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight);
    container.setSize(buttonWidth, buttonHeight);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // Hover effects
    container.on('pointerover', () => {
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 200,
        ease: 'Power2',
      });

      // Glow effect
      bg.clear();
      bg.fillStyle(0x00308f, 0.8); // Brighter blue
      bg.lineStyle(3, 0xffca40, 1); // Brighter gold border
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);

      // Cursor
      this.input.setDefaultCursor('pointer');
    });

    container.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scale: 1.0,
        duration: 200,
        ease: 'Power2',
      });

      // Reset background
      bg.clear();
      bg.fillStyle(0x001d58, 0.6);
      bg.lineStyle(2, 0xffca40, 0.8);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);

      this.input.setDefaultCursor('default');
    });

    // Click handler
    container.on('pointerdown', () => {
      // Click animation
      this.tweens.add({
        targets: container,
        scale: 0.95,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          if (targetScene) {
            console.log(`[MenuScene] Starting scene: ${targetScene}`);
            this.scene.start(targetScene);
          } else {
            // Back to website - navigate using window.location
            console.log('[MenuScene] Navigating back to CareQuest page');
            if (typeof window !== 'undefined') {
              window.location.href = '/carequest';
            }
          }
        },
      });
    });
  }

  /**
   * Create animated decorative orbs in the background
   */
  private createAnimatedOrbs() {
    const { width, height } = this.cameras.main;
    
    // Create 3 large orbs
    for (let i = 0; i < 3; i++) {
      const x = Phaser.Math.Between(100, width - 100);
      const y = Phaser.Math.Between(100, height - 100);
      const radius = Phaser.Math.Between(80, 150);

      const orb = this.add.graphics();
      orb.fillGradientStyle(0xffca40, 0xffca40, 0x001d58, 0x001d58, 0.1, 0.1, 0.05, 0.05);
      orb.fillCircle(0, 0, radius);
      orb.setPosition(x, y);
      orb.setBlendMode(Phaser.BlendModes.ADD);

      // Floating animation
      this.tweens.add({
        targets: orb,
        y: y + Phaser.Math.Between(-50, 50),
        x: x + Phaser.Math.Between(-30, 30),
        duration: Phaser.Math.Between(4000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Pulse animation
      this.tweens.add({
        targets: orb,
        scaleX: 1.1,
        scaleY: 1.1,
        alpha: 0.8,
        duration: Phaser.Math.Between(3000, 5000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
