import type { GameApp } from '../engine/GameApp.ts';
import type { FogOfWar } from '../systems/FogOfWar.ts';
import { WORLD_W, WORLD_H, LANDMARKS, seededRandom, isWalkable } from '../world/WorldLayout.ts';

export interface CollageMapState {
  fog: FogOfWar;
  playerX: number;
  playerY: number;
  tent: { x: number; y: number } | null;
  discovered: Set<string>;
  sweetpeaArrived: boolean;
  time: number;
}

interface PaperTree {
  x: number;
  y: number;
  h: number;
  rot: number;
  taped: boolean;
  tapeRot: number;
}

const HAND_FONT = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';

/**
 * The hero's map, drawn as a handmade paper collage (slides 7 & 8):
 * dark kraft paper, taped pale-ink pine cutouts, landmark cutouts with
 * handwritten labels, a brass compass, and lighter tan paper with "?"
 * marks covering everything the acorn hasn't explored yet.
 */
export class CollageMap {
  public open = false;
  private readonly app: GameApp;
  private readonly paperW = 1100;
  private readonly paperH = 650;
  private readonly rotation = -0.06;
  private readonly inset = 42;
  private trees: PaperTree[] = [];
  private paperPath: Path2D | null = null;
  private fogPaper: HTMLCanvasElement | null = null;
  private fogLayer: HTMLCanvasElement | null = null;
  private cache: HTMLCanvasElement | null = null;
  private cacheDirty = true;
  private questionMarks: { x: number; y: number; size: number; rot: number }[] = [];

  constructor(app: GameApp) {
    this.app = app;
    this.buildLayout();
  }

  public toggle(): void {
    this.open = !this.open;
    if (this.open) this.cacheDirty = true;
  }

  private get mapScale(): number {
    return Math.min((this.paperW - this.inset * 2) / WORLD_W, (this.paperH - this.inset * 2) / WORLD_H);
  }

  /** World position → paper-local position (paper top-left = 0,0). */
  private toPaper(x: number, y: number): { x: number; y: number } {
    const s = this.mapScale;
    const ox = (this.paperW - WORLD_W * s) / 2;
    const oy = (this.paperH - WORLD_H * s) / 2;
    return { x: ox + x * s, y: oy + y * s };
  }

  private buildLayout(): void {
    const rnd = seededRandom(818);

    // Torn-edge paper outline
    const p = new Path2D();
    const W = this.paperW;
    const H = this.paperH;
    const jag = () => (rnd() - 0.5) * 7;
    p.moveTo(0, 0);
    for (let x = 0; x <= W; x += 22) p.lineTo(x, jag());
    for (let y = 0; y <= H; y += 22) p.lineTo(W + jag(), y);
    for (let x = W; x >= 0; x -= 22) p.lineTo(x, H + jag());
    for (let y = H; y >= 0; y -= 22) p.lineTo(jag(), y);
    p.closePath();
    this.paperPath = p;

    // Scatter taped pine cutouts across the world, avoiding landmarks & water
    this.trees = [];
    let attempts = 0;
    while (this.trees.length < 46 && attempts < 2000) {
      attempts++;
      const wx = rnd() * WORLD_W;
      const wy = rnd() * WORLD_H;
      if (LANDMARKS.some((l) => Math.hypot(l.x - wx, (l.y - wy) * 1.4) < 560)) continue;
      if (!isWalkable(wx, wy, false) && wx > 200 && wy > 250 && wx < WORLD_W - 200 && wy < WORLD_H - 150) continue;
      const pp = this.toPaper(wx, wy);
      if (this.trees.some((t) => Math.hypot(t.x - pp.x, t.y - pp.y) < 62)) continue;
      // keep the compass corner clear
      if (pp.x < 190 && pp.y > this.paperH - 200) continue;
      this.trees.push({
        x: pp.x,
        y: pp.y,
        h: 52 + rnd() * 26,
        rot: (rnd() - 0.5) * 0.3,
        taped: rnd() < 0.45,
        tapeRot: (rnd() - 0.5) * 0.9
      });
    }
    this.trees.sort((a, b) => a.y - b.y);

    this.questionMarks = [];
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < 10; gx++) {
        this.questionMarks.push({
          x: 60 + gx * 108 + (rnd() - 0.5) * 50,
          y: 60 + gy * 108 + (rnd() - 0.5) * 50,
          size: 26 + rnd() * 18,
          rot: (rnd() - 0.5) * 0.6
        });
      }
    }
  }

  private drawCutout(g: CanvasRenderingContext2D, key: string, x: number, y: number, h: number, rot: number, shadow: boolean = true): number {
    const tex = this.app.getTexture(key);
    if (!tex) return 0;
    const w = (tex.width / tex.height) * h;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    if (shadow) {
      g.shadowColor = 'rgba(20, 10, 2, 0.55)';
      g.shadowBlur = 6;
      g.shadowOffsetX = 2;
      g.shadowOffsetY = 3;
    }
    g.drawImage(tex, -w / 2, -h / 2, w, h);
    g.restore();
    return w;
  }

  private drawTape(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number): void {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    // ragged torn ends
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2);
    for (let i = 0; i <= 4; i++) g.lineTo(w / 2 + (i % 2 ? -2.5 : 1.5), -h / 2 + (h * i) / 4);
    g.lineTo(-w / 2, h / 2);
    for (let i = 4; i >= 0; i--) g.lineTo(-w / 2 + (i % 2 ? 2.5 : -1.5), -h / 2 + (h * i) / 4);
    g.closePath();
    g.fillStyle = 'rgba(232, 219, 180, 0.78)';
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowBlur = 2;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(160, 136, 92, 0.35)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-w / 2 + 3, -h / 2 + h * 0.35);
    g.lineTo(w / 2 - 3, -h / 2 + h * 0.33);
    g.stroke();
    g.restore();
  }

  private drawLabel(g: CanvasRenderingContext2D, text: string, x: number, y: number, rot: number, size: number = 19, color: string = '#f3e7cc'): void {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = `700 ${size}px ${HAND_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(30, 16, 6, 0.75)';
    g.lineWidth = 4;
    g.strokeText(text, 0, 0);
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.restore();
  }

  private drawKraft(g: CanvasRenderingContext2D, tint: string | null): void {
    const kraft = this.app.getTexture('map_kraft');
    if (kraft) {
      const srcH = kraft.width * (this.paperH / this.paperW);
      g.drawImage(kraft, 0, (kraft.height - srcH) / 2, kraft.width, srcH, 0, 0, this.paperW, this.paperH);
    } else {
      g.fillStyle = '#5a3a1e';
      g.fillRect(0, 0, this.paperW, this.paperH);
    }
    if (tint) {
      g.fillStyle = tint;
      g.fillRect(0, 0, this.paperW, this.paperH);
    }
  }

  /** Lighter tan "unexplored" paper with faint trees showing through and pencil "?" marks. */
  private getFogPaper(): HTMLCanvasElement {
    if (this.fogPaper) return this.fogPaper;
    const c = document.createElement('canvas');
    c.width = this.paperW;
    c.height = this.paperH;
    const g = c.getContext('2d')!;
    this.drawKraft(g, 'rgba(214, 186, 140, 0.84)');
    // faint trees beneath the paper
    g.globalAlpha = 0.11;
    for (const t of this.trees) this.drawCutout(g, 'map_tree', t.x, t.y, t.h, t.rot, false);
    g.globalAlpha = 1;
    // paper grain fibres
    const rnd = seededRandom(99);
    g.strokeStyle = 'rgba(120, 88, 52, 0.12)';
    g.lineWidth = 1;
    for (let i = 0; i < 220; i++) {
      const x = rnd() * this.paperW;
      const y = rnd() * this.paperH;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 6 + rnd() * 10, y + (rnd() - 0.5) * 4);
      g.stroke();
    }
    for (const q of this.questionMarks) {
      g.save();
      g.translate(q.x, q.y);
      g.rotate(q.rot);
      g.font = `700 ${q.size}px ${HAND_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(92, 62, 32, 0.55)';
      g.fillText('?', 0, 0);
      g.restore();
    }
    this.fogPaper = c;
    return c;
  }

  public render(ctx: CanvasRenderingContext2D, s: CollageMapState): void {
    if (!this.open) return;
    const sw = this.app.width;
    const sh = this.app.height;

    // Dim the woodland behind the map
    ctx.save();
    ctx.fillStyle = 'rgba(18, 10, 4, 0.66)';
    ctx.fillRect(0, 0, sw, sh);

    ctx.translate(sw / 2, sh / 2 - 8);
    ctx.rotate(this.rotation);
    ctx.translate(-this.paperW / 2, -this.paperH / 2);

    // Paper drop shadow
    const path = this.paperPath!;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#4a2f17';
    ctx.fill(path);
    ctx.restore();

    // Static paper contents are cached; the map pauses the game so they only change between openings
    if (this.cacheDirty || !this.cache) this.paintPaper(s);
    ctx.drawImage(this.cache!, 0, 0);

    // Acorn "you are here" marker
    const me = this.toPaper(s.playerX, s.playerY);
    const pulse = 1 + Math.sin(s.time * 4) * 0.12;
    ctx.save();
    ctx.strokeStyle = 'rgba(214, 84, 52, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(me.x, me.y + 4, 20 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    this.drawCutout(ctx, 'acorn_idle', me.x, me.y - 14, 42, 0);
    this.drawLabel(ctx, 'you', me.x + 30, me.y - 30, -0.15, 14, '#f6d7b0');

    ctx.restore();

    // Footer hint (unrotated)
    const pct = Math.round(s.fog.revealedFraction() * 100);
    ctx.save();
    ctx.font = `700 16px ${HAND_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(246, 234, 208, 0.92)';
    ctx.fillText(`${pct}% of the woods explored   •   [M] or [Esc] to fold the map`, sw / 2, sh - 16);
    ctx.restore();
  }

  /** Paint kraft paper, cutouts, labels, fog paper and compass into the cache canvas. */
  private paintPaper(s: CollageMapState): void {
    if (!this.cache) {
      this.cache = document.createElement('canvas');
      this.cache.width = this.paperW;
      this.cache.height = this.paperH;
    }
    const ctx = this.cache.getContext('2d')!;
    const path = this.paperPath!;
    ctx.clearRect(0, 0, this.paperW, this.paperH);
    ctx.save();
    ctx.clip(path);
    this.drawKraft(ctx, null);

    // Pencil trail from home to every discovered landmark
    const home = this.toPaper(LANDMARKS[0].x, LANDMARKS[0].y);
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(240, 226, 196, 0.55)';
    ctx.lineWidth = 2.2;
    for (const lm of LANDMARKS) {
      if (lm.id === 'home' || !s.discovered.has(lm.id)) continue;
      const p = this.toPaper(lm.x, lm.y);
      ctx.beginPath();
      ctx.moveTo(home.x, home.y);
      ctx.quadraticCurveTo((home.x + p.x) / 2 + (p.y - home.y) * 0.18, (home.y + p.y) / 2 - (p.x - home.x) * 0.12, p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();

    // Taped pale-ink pine cutouts
    for (const t of this.trees) {
      this.drawCutout(ctx, 'map_tree', t.x, t.y, t.h, t.rot);
      if (t.taped) this.drawTape(ctx, t.x, t.y - t.h * 0.38, 30, 10, t.tapeRot);
    }

    // Landmark cutouts + handwritten labels
    for (const lm of LANDMARKS) {
      if (!s.discovered.has(lm.id)) continue;
      let p = this.toPaper(lm.x, lm.y);
      if (lm.id === 'home' && s.tent) p = this.toPaper(s.tent.x, s.tent.y - 60);
      if (lm.id === 'post') {
        if (s.sweetpeaArrived) {
          this.drawCutout(ctx, 'map_wagon', p.x, p.y, 92, 0.05);
          this.drawTape(ctx, p.x - 30, p.y - 44, 40, 12, -0.4);
          this.drawLabel(ctx, lm.mapLabel, p.x, p.y + 62, 0.03, 17);
        } else {
          // She hasn't arrived yet: just a pencil note where the wagon ruts are
          ctx.save();
          ctx.strokeStyle = 'rgba(240, 226, 196, 0.6)';
          ctx.setLineDash([4, 5]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 34, 16, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          this.drawLabel(ctx, 'wagon tracks?', p.x, p.y + 36, -0.05, 16, '#e8dcc0');
        }
        continue;
      }
      if (lm.id === 'home') {
        this.drawCutout(ctx, 'map_home', p.x, p.y, 92, -0.04);
        this.drawTape(ctx, p.x + 28, p.y - 44, 42, 12, 0.35);
        this.drawLabel(ctx, s.tent ? 'Home (my tent)' : 'Home', p.x, p.y + 62, 0.02, 20);
      } else if (lm.id === 'lake') {
        this.drawCutout(ctx, 'map_lake', p.x, p.y, 70, 0.08);
        this.drawTape(ctx, p.x - 60, p.y - 22, 36, 11, -0.6);
        this.drawLabel(ctx, lm.mapLabel, p.x, p.y + 52, -0.03, 19);
      } else if (lm.id === 'boot') {
        this.drawCutout(ctx, 'map_boot', p.x, p.y, 84, -0.07);
        this.drawTape(ctx, p.x + 34, p.y - 38, 40, 12, 0.5);
        this.drawLabel(ctx, lm.mapLabel, p.x, p.y + 58, 0.04, 18);
      }
    }

    // Unexplored paper laid on top, with the discovered area torn away
    const fogPaper = this.getFogPaper();
    if (!this.fogLayer) {
      this.fogLayer = document.createElement('canvas');
      this.fogLayer.width = this.paperW;
      this.fogLayer.height = this.paperH;
    }
    const fg = this.fogLayer.getContext('2d')!;
    fg.globalCompositeOperation = 'source-over';
    fg.clearRect(0, 0, this.paperW, this.paperH);
    fg.drawImage(fogPaper, 0, 0);
    fg.globalCompositeOperation = 'destination-out';
    fg.imageSmoothingEnabled = true;
    const tl = this.toPaper(0, 0);
    const mask = s.fog.getMask();
    const scale = this.mapScale;
    fg.drawImage(mask, tl.x, tl.y, s.fog.cols * s.fog.cellSize * scale, s.fog.rows * s.fog.cellSize * scale);
    fg.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.shadowColor = 'rgba(20, 10, 2, 0.55)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(this.fogLayer, 0, 0);
    ctx.restore();

    // Title tag
    ctx.save();
    ctx.translate(150, 46);
    ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(238, 226, 198, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.fillRect(-110, -22, 220, 44);
    ctx.shadowBlur = 0;
    ctx.font = `700 22px ${HAND_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2412';
    ctx.fillText('Acorn Crossing', 0, 1);
    ctx.restore();
    this.drawTape(ctx, 58, 28, 44, 13, -0.7);

    // Brass compass, bottom-left
    this.drawCutout(ctx, 'map_compass', 98, this.paperH - 96, 138, 0.1);
    this.drawTape(ctx, 70, this.paperH - 160, 46, 13, -0.5);
    ctx.restore();
    this.cacheDirty = false;
  }
}
