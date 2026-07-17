/**
 * StatsPanel - UI component for displaying game statistics and resources
 */

export interface StatsPanelConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StatsData {
  joy: number;
  care: number;
  harmony: number;
  wpm: number;
  combo: number;
  stage: number;
  monsterName: string;
}

export class StatsPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private config: StatsPanelConfig;
  
  private joyText!: Phaser.GameObjects.Text;
  private careText!: Phaser.GameObjects.Text;
  private harmonyText!: Phaser.GameObjects.Text;
  private wpmText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;

  constructor(config: StatsPanelConfig) {
    this.scene = config.scene;
    this.config = config;
    this.create();
  }

  private create(): void {
    this.container = this.scene.add.container(this.config.x, this.config.y);

    // Panel background
    const bg = this.scene.add.rectangle(
      0, 0,
      this.config.width, this.config.height,
      0x001D58
    ).setOrigin(0, 0).setStrokeStyle(2, 0xFFCA40);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(
      this.config.width / 2, 10,
      'STATS',
      {
        fontSize: '18px',
        color: '#FFCA40',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5, 0);
    this.container.add(title);

    // Stats layout
    let yPos = 40;

    // Resources section
    this.joyText = this.scene.add.text(15, yPos, '🌟 JOY: 0', {
      fontSize: '14px',
      color: '#FFD700',
    }).setOrigin(0, 0);
    this.container.add(this.joyText);
    yPos += 25;

    this.careText = this.scene.add.text(15, yPos, '💜 CARE: 0', {
      fontSize: '14px',
      color: '#FF75D1',
    }).setOrigin(0, 0);
    this.container.add(this.careText);
    yPos += 25;

    this.harmonyText = this.scene.add.text(15, yPos, '✨ Harmony: 0', {
      fontSize: '14px',
      color: '#7DD3C0',
    }).setOrigin(0, 0);
    this.container.add(this.harmonyText);
    yPos += 35;

    // Divider
    const divider = this.scene.add.rectangle(
      this.config.width / 2, yPos,
      this.config.width - 20, 2,
      0xFFCA40
    ).setOrigin(0.5, 0.5);
    this.container.add(divider);
    yPos += 25;

    // Combat stats
    this.wpmText = this.scene.add.text(15, yPos, '⌨️ WPM: 0', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0);
    this.container.add(this.wpmText);
    yPos += 25;

    this.comboText = this.scene.add.text(15, yPos, '🔥 Combo: 0x', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0);
    this.container.add(this.comboText);
    yPos += 25;

    this.stageText = this.scene.add.text(15, yPos, '📍 Stage 1', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0);
    this.container.add(this.stageText);
  }

  public update(data: StatsData): void {
    this.joyText.setText(`🌟 JOY: ${Math.floor(data.joy)}`);
    this.careText.setText(`💜 CARE: ${Math.floor(data.care)}`);
    this.harmonyText.setText(`✨ Harmony: ${Math.floor(data.harmony)}`);
    this.wpmText.setText(`⌨️ WPM: ${Math.floor(data.wpm)}`);
    
    // Color combo based on value
    const comboColor = data.combo >= 10 ? '#FF00FF' : 
                      data.combo >= 5 ? '#FF75D1' :
                      data.combo >= 3 ? '#FFD700' : '#ffffff';
    this.comboText.setText(`🔥 Combo: ${data.combo}x`).setColor(comboColor);
    
    this.stageText.setText(`📍 Stage ${data.stage} - ${data.monsterName}`);
  }

  public destroy(): void {
    this.container.destroy();
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
