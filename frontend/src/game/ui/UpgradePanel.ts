/**
 * UpgradePanel - UI component for displaying and purchasing upgrades
 */

export interface Upgrade {
  key: string;
  name: string;
  icon: string;
  description: string;
  level: number;
  cost: number;
  baseCost: number;
  maxLevel: number;
  effect: string;
}

export interface UpgradePanelConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  upgrades: Upgrade[];
  resources: { care: number };
  onPurchase: (upgradeKey: string) => void;
}

export class UpgradePanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private upgradeButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private config: UpgradePanelConfig;

  constructor(config: UpgradePanelConfig) {
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
      'UPGRADES',
      {
        fontSize: '20px',
        color: '#FFCA40',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5, 0);
    this.container.add(title);

    // Create upgrade buttons
    let yOffset = 50;
    this.config.upgrades.forEach((upgrade) => {
      const button = this.createUpgradeButton(upgrade, yOffset);
      this.container.add(button);
      this.upgradeButtons.set(upgrade.key, button);
      yOffset += 70;
    });
  }

  private createUpgradeButton(upgrade: Upgrade, yOffset: number): Phaser.GameObjects.Container {
    const buttonContainer = this.scene.add.container(10, yOffset);

    // Button background
    const buttonBg = this.scene.add.rectangle(
      0, 0,
      this.config.width - 20, 60,
      0x16213E
    ).setOrigin(0, 0).setStrokeStyle(2, 0x0F3460).setInteractive();

    // Icon and text
    const icon = this.scene.add.text(10, 10, upgrade.icon, {
      fontSize: '24px',
    }).setOrigin(0, 0);

    const nameText = this.scene.add.text(50, 8, `${upgrade.name} Lv.${upgrade.level}`, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0);

    const effectText = this.scene.add.text(50, 28, upgrade.effect, {
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0, 0);

    const costText = this.scene.add.text(this.config.width - 90, 20, `${upgrade.cost} 💜`, {
      fontSize: '16px',
      color: this.config.resources.care >= upgrade.cost ? '#FF75D1' : '#666666',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    buttonContainer.add([buttonBg, icon, nameText, effectText, costText]);

    // Store references for updates
    (buttonContainer as any).nameText = nameText;
    (buttonContainer as any).costText = costText;
    (buttonContainer as any).buttonBg = buttonBg;

    // Click handler
    buttonBg.on('pointerdown', () => {
      if (this.config.resources.care >= upgrade.cost && upgrade.level < upgrade.maxLevel) {
        this.config.onPurchase(upgrade.key);
      }
    });

    // Hover effects
    buttonBg.on('pointerover', () => {
      if (this.config.resources.care >= upgrade.cost && upgrade.level < upgrade.maxLevel) {
        buttonBg.setFillStyle(0x1F4068);
      }
    });

    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x16213E);
    });

    return buttonContainer;
  }

  public updateUpgrade(upgradeKey: string, newLevel: number, newCost: number): void {
    const button = this.upgradeButtons.get(upgradeKey);
    if (!button) return;

    const upgrade = this.config.upgrades.find((u) => u.key === upgradeKey);
    if (!upgrade) return;

    upgrade.level = newLevel;
    upgrade.cost = newCost;

    const nameText = (button as any).nameText as Phaser.GameObjects.Text;
    const costText = (button as any).costText as Phaser.GameObjects.Text;

    nameText.setText(`${upgrade.name} Lv.${newLevel}`);
    costText.setText(`${newCost} 💜`);
    costText.setColor(this.config.resources.care >= newCost ? '#FF75D1' : '#666666');
  }

  public updateResources(resources: { care: number }): void {
    this.config.resources = resources;
    
    // Update all cost text colors
    this.config.upgrades.forEach((upgrade) => {
      const button = this.upgradeButtons.get(upgrade.key);
      if (!button) return;

      const costText = (button as any).costText as Phaser.GameObjects.Text;
      costText.setColor(resources.care >= upgrade.cost ? '#FF75D1' : '#666666');
    });
  }

  public destroy(): void {
    this.container.destroy();
    this.upgradeButtons.clear();
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
