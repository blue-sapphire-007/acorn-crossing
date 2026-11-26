import type { GameApp } from '../engine/GameApp.ts';

/**
 * Expanded Acorn Crossing world (slides 7 & 8):
 * a 3x3 grid of hand-painted zones with the Home clearing in the centre,
 * Pinecone Lake upper-left, Sweetpea's Traveling Post upper-right and
 * Claud's Rubber Boot lower-left. Meadows fill the rest for gathering.
 */

export const CELL_W = 1760;
export const CELL_H = 990;
export const GRID_COLS = 3;
export const GRID_ROWS = 3;
export const WORLD_W = CELL_W * GRID_COLS;
export const WORLD_H = CELL_H * GRID_ROWS;

export type ZoneId = 'home' | 'lake' | 'boot' | 'post' | 'meadow';

export interface WorldCell {
  col: number;
  row: number;
  textureKey: string;
  flipX: boolean;
  zone: ZoneId;
}

export const WORLD_CELLS: WorldCell[] = [
  { col: 0, row: 0, textureKey: 'zone_lake', flipX: false, zone: 'lake' },
  { col: 1, row: 0, textureKey: 'zone_meadow_a', flipX: false, zone: 'meadow' },
  { col: 2, row: 0, textureKey: 'zone_post', flipX: false, zone: 'post' },
  { col: 0, row: 1, textureKey: 'zone_meadow_b', flipX: false, zone: 'meadow' },
  { col: 1, row: 1, textureKey: 'clearing_bg', flipX: false, zone: 'home' },
  { col: 2, row: 1, textureKey: 'zone_meadow_a', flipX: true, zone: 'meadow' },
  { col: 0, row: 2, textureKey: 'zone_boot', flipX: false, zone: 'boot' },
  { col: 1, row: 2, textureKey: 'zone_meadow_b', flipX: true, zone: 'meadow' },
  { col: 2, row: 2, textureKey: 'zone_meadow_a', flipX: false, zone: 'meadow' }
];

const cellOrigin = (col: number, row: number) => ({ x: col * CELL_W, y: row * CELL_H });
const HOME = cellOrigin(1, 1);
const LAKE = cellOrigin(0, 0);
const POST = cellOrigin(2, 0);
const BOOT = cellOrigin(0, 2);

export interface Landmark {
  id: Exclude<ZoneId, 'meadow'>;
  name: string;
  mapLabel: string;
  mapIcon: string;
  x: number;
  y: number;
  /** Discovery happens once the fog is lifted at (x, y). */
  discoverToast: string;
}

export const LANDMARKS: Landmark[] = [
  { id: 'home', name: 'Home Clearing', mapLabel: 'Home', mapIcon: 'map_home', x: HOME.x + 880, y: HOME.y + 560, discoverToast: '' },
  { id: 'lake', name: 'Pinecone Lake', mapLabel: 'Pinecone Lake', mapIcon: 'map_lake', x: LAKE.x + 720, y: LAKE.y + 430, discoverToast: 'Discovered Pinecone Lake! Giant pinecones bob among the lily pads.' },
  { id: 'post', name: "Sweetpea's Traveling Post", mapLabel: "Sweetpea's Traveling Post", mapIcon: 'map_wagon', x: POST.x + 985, y: POST.y + 520, discoverToast: "Discovered an empty clearing with wagon ruts… a signpost reads \"Sweetpea's Traveling Post\"." },
  { id: 'boot', name: "Claud's Rubber Boot", mapLabel: "Claud's Rubber Boot", mapIcon: 'map_boot', x: BOOT.x + 940, y: BOOT.y + 330, discoverToast: "Discovered Claud's Rubber Boot! A thimble chimney puffs woodsmoke." }
];

export type Blocker =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

/** Solid scenery the acorn cannot walk through (ignored while flying). */
export const BLOCKERS: Blocker[] = [
  // Giant oak trunk in the upper-right of the home clearing
  { kind: 'rect', x: HOME.x + 1130, y: HOME.y + 120, w: 630, h: 395 },
  // Pinecone Lake water
  { kind: 'ellipse', cx: LAKE.x + 720, cy: LAKE.y + 430, rx: 470, ry: 215 },
  // Claud's rubber boot
  { kind: 'ellipse', cx: BOOT.x + 950, cy: BOOT.y + 440, rx: 300, ry: 120 },
  // Sweetpea's stacked crates
  { kind: 'ellipse', cx: POST.x + 1050, cy: POST.y + 250, rx: 140, ry: 70 }
];

export const WALK_MARGIN = { left: 170, right: 170, top: 230, bottom: 110 };
export const FLY_MARGIN = { left: 110, right: 110, top: 170, bottom: 80 };

export function pointInBlocker(x: number, y: number, b: Blocker): boolean {
  if (b.kind === 'rect') return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const dx = (x - b.cx) / b.rx;
  const dy = (y - b.cy) / b.ry;
  return dx * dx + dy * dy <= 1;
}

export function isWalkable(x: number, y: number, flying: boolean): boolean {
  const m = flying ? FLY_MARGIN : WALK_MARGIN;
  if (x < m.left || x > WORLD_W - m.right || y < m.top || y > WORLD_H - m.bottom) return false;
  if (flying) return true;
  for (const b of BLOCKERS) if (pointInBlocker(x, y, b)) return false;
  return true;
}

/** Fixed points of interest used by the scene for [E] interactions. */
export const POINTS = {
  playerStart: { x: HOME.x + 780, y: HOME.y + 585 },
  sparrowStart: { x: HOME.x + 885, y: HOME.y + 580 },
  oakDoor: { x: HOME.x + 1295, y: HOME.y + 535 },
  claud: { x: BOOT.x + 1235, y: BOOT.y + 610 },
  bootDoor: { x: BOOT.x + 1110, y: BOOT.y + 560 },
  lakeShore: { x: LAKE.x + 1120, y: LAKE.y + 690 },
  postSign: { x: POST.x + 755, y: POST.y + 660 },
  wagon: { x: POST.x + 985, y: POST.y + 560 },
  sweetpea: { x: POST.x + 1215, y: POST.y + 640 }
};

/** Mulberry32 — deterministic so forage layout is stable between sessions. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SpawnSpec {
  itemType?: 'berry' | 'seed' | 'leaf' | 'stick';
  scenery?: 'mushroom_log' | 'forest_fern';
  x: number;
  y: number;
  flipX: boolean;
  scale: number;
}

/** Generates extra gathering spots in every zone except the hand-placed home clearing. */
export function generateZoneSpawns(seed: number = 20261126): SpawnSpec[] {
  const rnd = seededRandom(seed);
  const out: SpawnSpec[] = [];
  const avoid: { x: number; y: number; r: number }[] = Object.values(POINTS).map((p) => ({ ...p, r: 170 }));

  const tryPlace = (cell: WorldCell, make: (x: number, y: number) => SpawnSpec): void => {
    const o = cellOrigin(cell.col, cell.row);
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = o.x + 160 + rnd() * (CELL_W - 320);
      const y = o.y + 220 + rnd() * (CELL_H - 330);
      if (!isWalkable(x, y, false)) continue;
      // Keep a little breathing room around blockers
      if (!isWalkable(x + 60, y, false) || !isWalkable(x - 60, y, false) || !isWalkable(x, y - 50, false)) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < a.r)) continue;
      out.push(make(x, y));
      avoid.push({ x, y, r: 115 });
      return;
    }
  };

  const forageCycle: SpawnSpec['itemType'][] = ['berry', 'seed', 'leaf', 'stick', 'leaf', 'stick', 'berry', 'seed'];
  for (const cell of WORLD_CELLS) {
    if (cell.zone === 'home') continue;
    const forageCount = cell.zone === 'meadow' ? 11 : 6;
    const sceneryCount = cell.zone === 'meadow' ? 4 : 2;
    for (let i = 0; i < forageCount; i++) {
      const itemType = forageCycle[Math.floor(rnd() * forageCycle.length)];
      tryPlace(cell, (x, y) => ({ itemType, x, y, flipX: rnd() < 0.5, scale: 0.92 + rnd() * 0.16 }));
    }
    for (let i = 0; i < sceneryCount; i++) {
      const scenery = rnd() < 0.5 ? 'mushroom_log' : 'forest_fern';
      tryPlace(cell, (x, y) => ({ scenery, x, y, flipX: rnd() < 0.5, scale: 0.9 + rnd() * 0.2 }));
    }
  }
  return out;
}

/**
 * Renders the zone backgrounds. Each zone painting is pre-baked into an
 * offscreen canvas with feathered interior edges so neighbouring paintings
 * blend together like overlapping watercolour washes.
 */
export class WorldBackground {
  private baked: Map<WorldCell, HTMLCanvasElement> = new Map();
  private readonly overlap = 95;
  private readonly groundColor = '#b98a45';

  private readonly app: GameApp;

  constructor(app: GameApp) {
    this.app = app;
  }

  private bake(cell: WorldCell): HTMLCanvasElement | null {
    const cached = this.baked.get(cell);
    if (cached) return cached;
    const tex = this.app.getTexture(cell.textureKey);
    if (!tex || !tex.complete || tex.width === 0) return null;

    const c = document.createElement('canvas');
    c.width = tex.width;
    c.height = tex.height;
    const g = c.getContext('2d')!;
    g.save();
    if (cell.flipX) {
      g.translate(c.width, 0);
      g.scale(-1, 1);
    }
    g.drawImage(tex, 0, 0);
    g.restore();

    // Feather only the edges that touch another zone.
    const drawW = CELL_W + this.overlapLeft(cell) + this.overlapRight(cell);
    const drawH = CELL_H + this.overlapTop(cell) + this.overlapBottom(cell);
    const fx = (2 * this.overlap * c.width) / drawW;
    const fy = (2 * this.overlap * c.height) / drawH;
    g.globalCompositeOperation = 'destination-in';
    const hg = g.createLinearGradient(0, 0, c.width, 0);
    hg.addColorStop(0, this.overlapLeft(cell) ? 'rgba(0,0,0,0)' : '#000');
    hg.addColorStop(Math.min(0.49, fx / c.width), '#000');
    hg.addColorStop(Math.max(0.51, 1 - fx / c.width), '#000');
    hg.addColorStop(1, this.overlapRight(cell) ? 'rgba(0,0,0,0)' : '#000');
    g.fillStyle = hg;
    g.fillRect(0, 0, c.width, c.height);
    const vg = g.createLinearGradient(0, 0, 0, c.height);
    vg.addColorStop(0, this.overlapTop(cell) ? 'rgba(0,0,0,0)' : '#000');
    vg.addColorStop(Math.min(0.49, fy / c.height), '#000');
    vg.addColorStop(Math.max(0.51, 1 - fy / c.height), '#000');
    vg.addColorStop(1, this.overlapBottom(cell) ? 'rgba(0,0,0,0)' : '#000');
    g.fillStyle = vg;
    g.fillRect(0, 0, c.width, c.height);

    this.baked.set(cell, c);
    return c;
  }

  private overlapLeft(c: WorldCell): number { return c.col > 0 ? this.overlap : 0; }
  private overlapRight(c: WorldCell): number { return c.col < GRID_COLS - 1 ? this.overlap : 0; }
  private overlapTop(c: WorldCell): number { return c.row > 0 ? this.overlap : 0; }
  private overlapBottom(c: WorldCell): number { return c.row < GRID_ROWS - 1 ? this.overlap : 0; }

  /** Draw in world space (camera transform already applied). */
  public render(ctx: CanvasRenderingContext2D, viewX0: number, viewY0: number, viewX1: number, viewY1: number): void {
    ctx.fillStyle = this.groundColor;
    ctx.fillRect(Math.max(0, viewX0), Math.max(0, viewY0), Math.min(WORLD_W, viewX1) - Math.max(0, viewX0), Math.min(WORLD_H, viewY1) - Math.max(0, viewY0));

    for (const cell of WORLD_CELLS) {
      const x = cell.col * CELL_W - this.overlapLeft(cell);
      const y = cell.row * CELL_H - this.overlapTop(cell);
      const w = CELL_W + this.overlapLeft(cell) + this.overlapRight(cell);
      const h = CELL_H + this.overlapTop(cell) + this.overlapBottom(cell);
      if (x > viewX1 || y > viewY1 || x + w < viewX0 || y + h < viewY0) continue;
      const baked = this.bake(cell);
      if (baked) ctx.drawImage(baked, x, y, w, h);
    }
  }
}
