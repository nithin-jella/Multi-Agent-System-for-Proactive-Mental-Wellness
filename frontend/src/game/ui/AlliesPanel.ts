/**
 * AlliesPanel - UI component for displaying and purchasing passive allies
 */

export interface Ally {
  key: string;
  name: string;
  icon: string;
  description: string;
  count: number;
  cost: number;
  baseCost: number;
  dps: number; // Damage per second
}

export interface AlliesPanelConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  allies: Ally[];
  resources: { joy: number };
  onPurchase: (allyKey: string) => void;
}

export class AlliesPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private allyButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private config: AlliesPanelConfig;

  constructor(config: AlliesPanelConfig) {
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
      this.config.width / 2, 15,
      'ALLIES',
      {
        fontSize: '20px',
        color: '#FFCA40',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5, 0);
    this.container.add(title);

    // Create ally buttons
    let yOffset = 50;
    this.config.allies.forEach((ally) => {
      const button = this.createAllyButton(ally, yOffset);
      this.container.add(button);
      this.allyButtons.set(ally.key, button);
      yOffset += 70;
    });
  }

  private createAllyButton(ally: Ally, yOffset: number): Phaser.GameObjects.Container {
    const buttonContainer = this.scene.add.container(10, yOffset);

    // Button background
    const buttonBg = this.scene.add.rectangle(
      0, 0,
      this.config.width - 20, 60,
      0x16213E
    ).setOrigin(0, 0).setStrokeStyle(2, 0x0F3460).setInteractive();

    // Icon and text
    const icon = this.scene.add.text(10, 10, ally.icon, {
      fontSize: '24px',
    }).setOrigin(0, 0);

    const nameText = this.scene.add.text(50, 8, `${ally.name} x${ally.count}`, {
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0).setFontSize(16);

    const dpsText = this.scene.add.text(50, 28, `${ally.dps} DPS each`, {
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0, 0);

    const costText = this.scene.add.text(this.config.width - 90, 20, `${ally.cost} 🌟`, {
      fontSize: '16px',
      color: this.config.resources.joy >= ally.cost ? '#FFD700' : '#666666',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    buttonContainer.add([buttonBg, icon, nameText, dpsText, costText]);

    // Store references for updates
    (buttonContainer as any).nameText = nameText;
    (buttonContainer as any).costText = costText;
    (buttonContainer as any).dpsText = dpsText;

    // Click handler
    buttonBg.on('pointerdown', () => {
      if (this.config.resources.joy >= ally.cost) {
        this.config.onPurchase(ally.key);
      }
    });

    // Hover effects
    buttonBg.on('pointerover', () => {
      if (this.config.resources.joy >= ally.cost) {
        buttonBg.setFillStyle(0x1F4068);
      }
    });

    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x16213E);
    });

    return buttonContainer;
  }

  public updateAlly(allyKey: string, newCount: number, newCost: number): void {
    const button = this.allyButtons.get(allyKey);
    if (!button) return;

    const ally = this.config.allies.find((a) => a.key === allyKey);
    if (!ally) return;

    ally.count = newCount;
    ally.cost = newCost;

    const nameText = (button as any).nameText;
    const costText = (button as any).costText;

    nameText.setText(`${ally.name} x${newCount}`);
    costText.setText(`${newCost} 🌟`);
    costText.setColor(this.config.resources.joy >= newCost ? '#FFD700' : '#666666');
  }

  public updateResources(resources: { joy: number }): void {
    this.config.resources = resources;

    // Update all cost text colors
    this.config.allies.forEach((ally) => {
      const button = this.allyButtons.get(ally.key);
      if (!button) return;

      const costText = (button as any).costText;
      costText.setColor(resources.joy >= ally.cost ? '#FFD700' : '#666666');
    });
  }

  public destroy(): void {
    this.container.destroy();
    this.allyButtons.clear();
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
