import { GameApp } from '../engine/GameApp.ts';
import type { Scene } from '../engine/GameApp.ts';
import { ASSET_MANIFEST } from '../engine/AssetManifest.ts';

export class BootScene implements Scene {
  public readonly key = 'BootScene';
  private app!: GameApp;
  private loadedCount: number = 0;
  private totalCount: number = ASSET_MANIFEST.length;
  private failedKeys: string[] = [];
  private done: boolean = false;

  public init(app: GameApp): void {
    this.app = app;
  }

  public enter(): void {
    this.loadedCount = 0;
    this.done = false;

    ASSET_MANIFEST.forEach((asset) => {
      const img = new Image();
      img.onload = () => {
        this.app.textures.set(asset.key, img);
        this.loadedCount++;
        this.checkComplete();
      };
      img.onerror = () => {
        this.failedKeys.push(asset.key);
        this.loadedCount++;
        this.checkComplete();
      };
      img.src = asset.url;
    });
  }

  private checkComplete(): void {
    if (!this.done && this.loadedCount >= this.totalCount) {
      this.done = true;
      setTimeout(() => {
        this.app.startScene('PrologueScene');
      }, 250);
    }
  }

  public exit(): void {}

  public update(_time: number, _dt: number): void {}

  public render(ctx: CanvasRenderingContext2D): void {
    const w = this.app.width;
    const h = this.app.height;

    // Warm dark oak parchment backdrop
    const grad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 700);
    grad.addColorStop(0, '#3a291a');
    grad.addColorStop(1, '#1c130c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Hand-drawn style double ink border
    ctx.strokeStyle = '#c89d54';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, w - 96, h - 96);
    ctx.strokeStyle = 'rgba(200, 157, 84, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(56, 56, w - 112, h - 112);

    ctx.fillStyle = '#f5ead6';
    ctx.font = '700 42px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('ACORN CROSSING', w / 2, h / 2 - 42);

    ctx.fillStyle = '#d4aa63';
    ctx.font = 'italic 19px "Lora", Georgia, serif';
    ctx.fillText('Preparing ink & watercolor illustrations...', w / 2, h / 2 - 6);

    // Progress bar
    const barW = 380;
    const barH = 12;
    const bx = (w - barW) / 2;
    const by = h / 2 + 24;
    const pct = this.totalCount > 0 ? this.loadedCount / this.totalCount : 0;

    ctx.fillStyle = '#140d08';
    ctx.strokeStyle = '#8b6534';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d48c3b';
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 2, Math.max(0, (barW - 4) * pct), barH - 4, 4);
    ctx.fill();
  }
}
