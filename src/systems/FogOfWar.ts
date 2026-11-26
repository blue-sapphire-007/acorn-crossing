import { WORLD_W, WORLD_H } from '../world/WorldLayout.ts';

/**
 * Fog of war over undiscovered woodland. The world is divided into a coarse
 * grid; cells near the acorn are revealed permanently. A small mask canvas is
 * blurred & upscaled so the boundary looks like soft drifting mist in-world
 * and like torn paper edges on the collage map.
 */
export class FogOfWar {
  public readonly cellSize = 110;
  public readonly cols: number;
  public readonly rows: number;
  private readonly revealed: Uint8Array;
  private dirty = true;
  private readonly maskSmall: HTMLCanvasElement;
  private readonly maskSoft: HTMLCanvasElement;
  private readonly softScale = 6;
  private mistTile: HTMLCanvasElement | null = null;
  private view: HTMLCanvasElement | null = null;

  constructor() {
    this.cols = Math.ceil(WORLD_W / this.cellSize);
    this.rows = Math.ceil(WORLD_H / this.cellSize);
    this.revealed = new Uint8Array(this.cols * this.rows);
    this.maskSmall = document.createElement('canvas');
    this.maskSmall.width = this.cols;
    this.maskSmall.height = this.rows;
    this.maskSoft = document.createElement('canvas');
    this.maskSoft.width = this.cols * this.softScale;
    this.maskSoft.height = this.rows * this.softScale;
  }

  /** Reveal a circle of radius r around (x, y). Returns true if anything new was uncovered. */
  public reveal(x: number, y: number, r: number): boolean {
    const cs = this.cellSize;
    const c0 = Math.max(0, Math.floor((x - r) / cs));
    const c1 = Math.min(this.cols - 1, Math.floor((x + r) / cs));
    const r0 = Math.max(0, Math.floor((y - r) / cs));
    const r1 = Math.min(this.rows - 1, Math.floor((y + r) / cs));
    let changed = false;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const i = row * this.cols + col;
        if (this.revealed[i]) continue;
        const cx = (col + 0.5) * cs;
        const cy = (row + 0.5) * cs;
        if (Math.hypot(cx - x, (cy - y) * 1.15) <= r) {
          this.revealed[i] = 1;
          changed = true;
        }
      }
    }
    if (changed) this.dirty = true;
    return changed;
  }

  public isRevealed(x: number, y: number): boolean {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    return this.revealed[row * this.cols + col] === 1;
  }

  public revealedFraction(): number {
    let n = 0;
    for (let i = 0; i < this.revealed.length; i++) n += this.revealed[i];
    return n / this.revealed.length;
  }

  /** Soft alpha mask (opaque = discovered) covering the whole world. */
  public getMask(): HTMLCanvasElement {
    if (!this.dirty) return this.maskSoft;
    const sctx = this.maskSmall.getContext('2d')!;
    const img = sctx.createImageData(this.cols, this.rows);
    for (let i = 0; i < this.revealed.length; i++) {
      const v = this.revealed[i] ? 255 : 0;
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = v;
    }
    sctx.putImageData(img, 0, 0);

    const g = this.maskSoft.getContext('2d')!;
    g.clearRect(0, 0, this.maskSoft.width, this.maskSoft.height);
    g.imageSmoothingEnabled = true;
    g.filter = 'blur(4px)';
    g.drawImage(this.maskSmall, 0, 0, this.maskSoft.width, this.maskSoft.height);
    g.filter = 'none';
    this.dirty = false;
    return this.maskSoft;
  }

  /** Seamless warm parchment-mist tile with faint pencil hatching. */
  private getMistTile(): HTMLCanvasElement {
    if (this.mistTile) return this.mistTile;
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgb(221, 203, 166)';
    g.fillRect(0, 0, S, S);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // Soft watercolour blooms (wrapped so the tile repeats seamlessly)
    for (let i = 0; i < 70; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 30 + rnd() * 90;
      const light = rnd() < 0.55;
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          grad.addColorStop(0, light ? 'rgba(246, 234, 206, 0.35)' : 'rgba(176, 146, 100, 0.22)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
    // Light diagonal pencil hatching
    g.strokeStyle = 'rgba(92, 66, 38, 0.08)';
    g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const len = 8 + rnd() * 16;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y - len * 0.6);
      g.stroke();
    }
    this.mistTile = c;
    return c;
  }

  /** True if any unexplored cell intersects the given world rectangle. */
  private anyFogIn(x0: number, y0: number, x1: number, y1: number): boolean {
    const cs = this.cellSize;
    // pad by the blur spread so soft edges are still drawn
    const c0 = Math.max(0, Math.floor(x0 / cs) - 1);
    const c1 = Math.min(this.cols - 1, Math.floor(x1 / cs) + 1);
    const r0 = Math.max(0, Math.floor(y0 / cs) - 1);
    const r1 = Math.min(this.rows - 1, Math.floor(y1 / cs) + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (!this.revealed[r * this.cols + c]) return true;
    }
    return false;
  }

  /** Draws the in-world mist in screen space using the current camera. */
  public renderWorldFog(ctx: CanvasRenderingContext2D, camX: number, camY: number, zoom: number, viewW: number, viewH: number, time: number): void {
    const halfW = viewW / 2 / zoom;
    const halfH = viewH / 2 / zoom;
    if (!this.anyFogIn(camX - halfW, camY - halfH, camX + halfW, camY + halfH)) return;

    // Mist is soft, so render it at half resolution and upscale
    const R = 0.5;
    const bw = Math.ceil(viewW * R);
    const bh = Math.ceil(viewH * R);
    if (!this.view) {
      this.view = document.createElement('canvas');
      this.view.width = bw;
      this.view.height = bh;
    }
    const v = this.view.getContext('2d')!;
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.globalCompositeOperation = 'source-over';
    v.clearRect(0, 0, bw, bh);

    const z = zoom * R;
    const ox = bw / 2 - camX * z;
    const oy = bh / 2 - camY * z;

    // Two drifting mist layers anchored to the world so the fog feels physical
    const tile = this.getMistTile();
    const pattern = v.createPattern(tile, 'repeat');
    if (pattern) {
      const layers = [
        { alpha: 0.96, scale: z, tx: ox + time * 3, ty: oy + time * 1 },
        { alpha: 0.35, scale: z * 1.6, tx: ox - time * 4.5, ty: oy + time * 2 }
      ];
      v.fillStyle = pattern;
      for (const L of layers) {
        v.globalAlpha = L.alpha;
        v.setTransform(L.scale, 0, 0, L.scale, L.tx, L.ty);
        v.fillRect(-L.tx / L.scale - 8, -L.ty / L.scale - 8, bw / L.scale + 16, bh / L.scale + 16);
      }
      v.globalAlpha = 1;
    }

    // Punch out everything that has been discovered
    v.globalCompositeOperation = 'destination-out';
    v.setTransform(z, 0, 0, z, ox, oy);
    v.imageSmoothingEnabled = true;
    const mask = this.getMask();
    v.drawImage(mask, 0, 0, this.cols * this.cellSize, this.rows * this.cellSize);
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.view, 0, 0, viewW, viewH);
    ctx.restore();
  }
}
