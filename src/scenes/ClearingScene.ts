import { GameApp } from '../engine/GameApp.ts';
import type { Scene } from '../engine/GameApp.ts';
import { InventorySystem, ITEMS } from '../systems/InventorySystem.ts';
import type { ItemId } from '../systems/InventorySystem.ts';
import { CraftingSystem, PHASE1_RECIPES } from '../systems/CraftingSystem.ts';
import { StorybookHUD } from '../ui/StorybookHUD.ts';
import { FogOfWar } from '../systems/FogOfWar.ts';
import { CollageMap } from '../ui/CollageMap.ts';
import { WORLD_W, WORLD_H, CELL_W, CELL_H, LANDMARKS, POINTS, WorldBackground, isWalkable, generateZoneSpawns } from '../world/WorldLayout.ts';

interface WorldProp {
  id: string;
  kind: 'forage' | 'scenery' | 'tent' | 'npc';
  itemType?: ItemId;
  textureKey: string;
  x: number;
  y: number;
  displayHeight: number;
  flipX?: boolean;
  charges: number;
  maxCharges: number;
  respawnTimer: number;
  label?: string;
}

interface Hotspot {
  id: string;
  x: number;
  y: number;
  radius: number;
  badge: string;
  prompt: string;
  onInteract: () => void;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  scale: number;
}

const CLAUD_LINES = [
  "Claud: \"Well I'll be — another acorn! Name's Claud. This old rubber boot keeps me dry as a seed.\"",
  "Claud: \"Pinecone Lake's up north-west. Good water, but don't fall in — acorns float, but not gracefully.\"",
  "Claud: \"Fog rolls thick past the meadows. Fly Maple Leaf up high and you'll see further.\"",
  "Claud: \"Every so often a wagon comes creaking through the north-east woods. Sweetpea's, I reckon. Not this season, though.\"",
  "Claud: \"Come by when the frost bites. A boot's cosier than you'd think.\""
];

export class ClearingScene implements Scene {
  public readonly key = 'ClearingScene';
  private app!: GameApp;
  private inventory!: InventorySystem;
  private crafting!: CraftingSystem;
  private hud!: StorybookHUD;
  private background!: WorldBackground;
  private fog!: FogOfWar;
  private map!: CollageMap;

  // Expanded 3x3 playable world (home clearing in the centre)
  private readonly worldWidth: number = WORLD_W;
  private readonly worldHeight: number = WORLD_H;

  // Camera state
  private camX: number = POINTS.playerStart.x;
  private camY: number = POINTS.playerStart.y;
  private camZoom: number = 1.0;

  // Acorn protagonist state
  private player = {
    x: POINTS.playerStart.x,
    y: POINTS.playerStart.y,
    facingLeft: false,
    walkPhase: 0,
    isMoving: false,
    stepSoundTimer: 0,
    dustTimer: 0,
    health: 100,
    maxHealth: 100,
    hunger: 92,
    maxHunger: 100
  };

  // Maple Leaf (Chipping Sparrow companion) state
  private sparrow = {
    x: POINTS.sparrowStart.x,
    y: POINTS.sparrowStart.y,
    facingLeft: true,
    health: 100,
    maxHealth: 100,
    energy: 88,
    maxEnergy: 100,
    summoning: false,
    summonFromX: 0,
    summonFromY: 0,
    summonTargetX: 0,
    summonTargetY: 0,
    summonProgress: 0,
    isMounted: false,
    isFlying: false,
    altitude: 0, // 0 on ground, lifts to ~115 in flight while shadow remains on ground
    targetAltitude: 0,
    flapPhase: 0
  };

  private props: WorldProp[] = [];
  private dust: DustParticle[] = [];
  private fallingLeaves: FloatingLeaf[] = [];
  private tentBuilt: boolean = false;
  private tentPos: { x: number; y: number } | null = null;
  private toastMessage: string = '';
  private toastTimer: number = 0;
  private sceneTime: number = 0;
  private discovered: Set<string> = new Set(['home']);
  private claudLineIndex: number = 0;
  private hotspots: Hotspot[] = [];

  /** Story progression flags. Sweetpea only arrives later in the game. */
  private storyFlags = {
    sweetpeaArrived: false
  };

  public init(app: GameApp): void {
    this.app = app;
  }

  public enter(): void {
    this.inventory = new InventorySystem();
    this.crafting = new CraftingSystem(this.inventory);
    this.hud = new StorybookHUD(this.app, this.inventory, this.crafting);
    this.background = new WorldBackground(this.app);
    this.fog = new FogOfWar();
    this.map = new CollageMap(this.app);

    this.tentBuilt = false;
    this.tentPos = null;
    this.props = [];
    this.dust = [];
    this.fallingLeaves = [];
    this.discovered = new Set(['home']);
    this.claudLineIndex = 0;

    // Debug / later-chapter hook: ?sweetpea=1 brings the travelling wagon early
    const params = new URLSearchParams(window.location.search);
    this.storyFlags.sweetpeaArrived = params.get('sweetpea') === '1';

    this.populateClearing();
    this.populateWorld();
    this.buildHotspots();

    // The home clearing is already known; the rest of the woods start under fog
    this.fog.reveal(POINTS.playerStart.x + 100, POINTS.playerStart.y - 60, 760);

    // Gentle drifting autumn leaves across the canopy (wrapped around the camera)
    for (let i = 0; i < 18; i++) {
      this.fallingLeaves.push({
        x: this.camX + (Math.random() - 0.5) * 1800,
        y: this.camY + (Math.random() - 0.5) * 1100,
        vx: 18 + Math.random() * 22,
        vy: 24 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 1.8,
        scale: 0.08 + Math.random() * 0.06
      });
    }

    this.showToast('Welcome to the Autumn Clearing! Gather 2 Oak Leaves & 3 Sticks to build shelter. Press [M] for your map.', 5.0);
  }

  public exit(): void {}

  /** Called by later story beats (or ?sweetpea=1) to bring Sweetpea's wagon to her post. */
  public arriveSweetpea(): void {
    if (this.storyFlags.sweetpeaArrived) return;
    this.storyFlags.sweetpeaArrived = true;
    this.addSweetpeaProps();
    this.buildHotspots();
  }

  private populateWorld(): void {
    let n = 0;
    for (const s of generateZoneSpawns()) {
      n++;
      if (s.itemType) {
        const def: Record<string, { tex: string; h: number; charges: number; label: string }> = {
          berry: { tex: 'berry_bush', h: 140, charges: 3, label: 'Woodland Berries' },
          seed: { tex: 'seed_grass', h: 136, charges: 3, label: 'Golden Grass Seeds' },
          leaf: { tex: 'oak_leaf', h: 62, charges: 1, label: 'Fallen Oak Leaf' },
          stick: { tex: 'fallen_stick', h: 65, charges: 1, label: 'Dry Oak Stick' }
        };
        const d = def[s.itemType];
        this.props.push({
          id: `wild_${s.itemType}_${n}`,
          kind: 'forage',
          itemType: s.itemType,
          textureKey: d.tex,
          x: s.x,
          y: s.y,
          displayHeight: d.h * s.scale,
          flipX: s.flipX,
          charges: d.charges,
          maxCharges: d.charges,
          respawnTimer: 0,
          label: d.label
        });
      } else if (s.scenery) {
        this.props.push({
          id: `wild_scenery_${n}`,
          kind: 'scenery',
          textureKey: s.scenery,
          x: s.x,
          y: s.y,
          displayHeight: (s.scenery === 'mushroom_log' ? 125 : 142) * s.scale,
          flipX: s.flipX,
          charges: 0,
          maxCharges: 0,
          respawnTimer: 0
        });
      }
    }

    // Claud lives in his rubber boot (lower-left woods)
    this.props.push({ id: 'npc_claud', kind: 'npc', textureKey: 'npc_claud', x: POINTS.claud.x, y: POINTS.claud.y, displayHeight: 118, flipX: true, charges: 0, maxCharges: 0, respawnTimer: 0, label: 'Claud' });

    if (this.storyFlags.sweetpeaArrived) this.addSweetpeaProps();
  }

  private addSweetpeaProps(): void {
    this.props.push({ id: 'sweetpea_wagon', kind: 'npc', textureKey: 'sweetpea_wagon', x: POINTS.wagon.x, y: POINTS.wagon.y, displayHeight: 230, charges: 0, maxCharges: 0, respawnTimer: 0, label: "Sweetpea's Wagon" });
    this.props.push({ id: 'npc_sweetpea', kind: 'npc', textureKey: 'npc_sweetpea', x: POINTS.sweetpea.x, y: POINTS.sweetpea.y, displayHeight: 112, flipX: true, charges: 0, maxCharges: 0, respawnTimer: 0, label: 'Sweetpea' });
  }

  private buildHotspots(): void {
    this.hotspots = [
      {
        id: 'oak_door', x: POINTS.oakDoor.x, y: POINTS.oakDoor.y, radius: 120, badge: '[E] Inspect',
        prompt: 'Press [E] to inspect Ancient Oak Root Doorway',
        onInteract: () => this.showToast('Ancient Oak Hollow Door: Sturdy winter housing upgrade (Chapter 2: Winter).')
      },
      {
        id: 'claud', x: POINTS.claud.x, y: POINTS.claud.y, radius: 130, badge: '[E] Talk',
        prompt: 'Press [E] to chat with Claud',
        onInteract: () => {
          this.app.audio.playSparrowChirp();
          this.showToast(CLAUD_LINES[this.claudLineIndex % CLAUD_LINES.length], 5.5);
          this.claudLineIndex++;
        }
      },
      {
        id: 'boot_door', x: POINTS.bootDoor.x, y: POINTS.bootDoor.y, radius: 95, badge: '[E] Knock',
        prompt: "Press [E] to knock on Claud's boot door",
        onInteract: () => this.showToast("Knock knock… Claud's cosy rubber boot. A bottle-cap path leads to the little wooden door.")
      },
      {
        id: 'lake_shore', x: POINTS.lakeShore.x, y: POINTS.lakeShore.y, radius: 140, badge: '[E] Look',
        prompt: 'Press [E] to gaze across Pinecone Lake',
        onInteract: () => {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 5);
          this.showToast('Pinecone Lake: cool, still water ripples around giant floating pinecones. You take a refreshing sip (+5 Health).', 4.5);
        }
      }
    ];

    if (this.storyFlags.sweetpeaArrived) {
      this.hotspots.push({
        id: 'sweetpea', x: POINTS.sweetpea.x, y: POINTS.sweetpea.y, radius: 140, badge: '[E] Trade',
        prompt: "Press [E] to browse Sweetpea's Traveling Post",
        onInteract: () => {
          this.app.audio.playCraftSuccess();
          this.showToast('Sweetpea: "Welcome, welcome! Seeds, lanterns, thimbles of honey… my shelves are still being unpacked — trading opens soon!"', 5.5);
        }
      });
    } else {
      this.hotspots.push({
        id: 'post_sign', x: POINTS.postSign.x, y: POINTS.postSign.y, radius: 130, badge: '[E] Read',
        prompt: 'Press [E] to read the weathered signpost',
        onInteract: () => this.showToast('"Sweetpea\'s Traveling Post — back when the leaves turn again!" Deep wagon ruts circle the empty clearing. Someone visits… sometimes.', 5.5)
      });
    }
  }

  private findNearestHotspot(): Hotspot | null {
    let best: Hotspot | null = null;
    let bestD = Infinity;
    for (const h of this.hotspots) {
      const d = Math.hypot(h.x - this.player.x, h.y - this.player.y);
      if (d < h.radius && d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  private populateClearing(): void {
    // Rich hand-drawn forageable resources & 2.5D foreground/midground props for Y-depth sorting
    const initialProps: Omit<WorldProp, 'respawnTimer'>[] = [
      // Berry bushes (for Acorn hunger)
      { id: 'berry_1', kind: 'forage', itemType: 'berry', textureKey: 'berry_bush', x: 560, y: 410, displayHeight: 138, charges: 3, maxCharges: 3, label: 'Woodland Berries' },
      { id: 'berry_2', kind: 'forage', itemType: 'berry', textureKey: 'berry_bush', x: 1390, y: 760, displayHeight: 152, flipX: true, charges: 3, maxCharges: 3, label: 'Woodland Berries' },
      { id: 'berry_3', kind: 'forage', itemType: 'berry', textureKey: 'berry_bush', x: 375, y: 530, displayHeight: 132, charges: 3, maxCharges: 3, label: 'Woodland Berries' },

      // Golden wild grass seed heads (for Maple Leaf energy)
      { id: 'seed_1', kind: 'forage', itemType: 'seed', textureKey: 'seed_grass', x: 705, y: 435, displayHeight: 135, charges: 3, maxCharges: 3, label: 'Golden Grass Seeds' },
      { id: 'seed_2', kind: 'forage', itemType: 'seed', textureKey: 'seed_grass', x: 1185, y: 695, displayHeight: 140, flipX: true, charges: 3, maxCharges: 3, label: 'Golden Grass Seeds' },
      { id: 'seed_3', kind: 'forage', itemType: 'seed', textureKey: 'seed_grass', x: 470, y: 690, displayHeight: 130, charges: 3, maxCharges: 3, label: 'Golden Grass Seeds' },

      // Fallen Oak Leaves (need 2 for Tent)
      { id: 'leaf_1', kind: 'forage', itemType: 'leaf', textureKey: 'oak_leaf', x: 635, y: 565, displayHeight: 62, charges: 1, maxCharges: 1, label: 'Fallen Oak Leaf' },
      { id: 'leaf_2', kind: 'forage', itemType: 'leaf', textureKey: 'oak_leaf', x: 985, y: 680, displayHeight: 66, flipX: true, charges: 1, maxCharges: 1, label: 'Fallen Oak Leaf' },
      { id: 'leaf_3', kind: 'forage', itemType: 'leaf', textureKey: 'oak_leaf', x: 830, y: 470, displayHeight: 58, charges: 1, maxCharges: 1, label: 'Fallen Oak Leaf' },
      { id: 'leaf_4', kind: 'forage', itemType: 'leaf', textureKey: 'oak_leaf', x: 545, y: 750, displayHeight: 64, flipX: true, charges: 1, maxCharges: 1, label: 'Fallen Oak Leaf' },

      // Dry Oak Sticks (need 3 for Tent)
      { id: 'stick_1', kind: 'forage', itemType: 'stick', textureKey: 'fallen_stick', x: 895, y: 735, displayHeight: 68, charges: 1, maxCharges: 1, label: 'Dry Oak Stick' },
      { id: 'stick_2', kind: 'forage', itemType: 'stick', textureKey: 'fallen_stick', x: 655, y: 685, displayHeight: 64, flipX: true, charges: 1, maxCharges: 1, label: 'Dry Oak Stick' },
      { id: 'stick_3', kind: 'forage', itemType: 'stick', textureKey: 'fallen_stick', x: 1090, y: 585, displayHeight: 66, charges: 1, maxCharges: 1, label: 'Dry Oak Stick' },
      { id: 'stick_4', kind: 'forage', itemType: 'stick', textureKey: 'fallen_stick', x: 485, y: 475, displayHeight: 62, charges: 1, maxCharges: 1, label: 'Dry Oak Stick' },

      // Giant 2.5D woodland mushrooms & ferns (walk behind & in front of for rich Y-sorting!)
      { id: 'scenery_mush_1', kind: 'scenery', textureKey: 'mushroom_log', x: 740, y: 785, displayHeight: 132, charges: 0, maxCharges: 0 },
      { id: 'scenery_mush_2', kind: 'scenery', textureKey: 'mushroom_log', x: 1035, y: 485, displayHeight: 118, flipX: true, charges: 0, maxCharges: 0 },
      { id: 'scenery_fern_1', kind: 'scenery', textureKey: 'forest_fern', x: 585, y: 830, displayHeight: 145, charges: 0, maxCharges: 0 },
      { id: 'scenery_fern_2', kind: 'scenery', textureKey: 'forest_fern', x: 1245, y: 605, displayHeight: 140, flipX: true, charges: 0, maxCharges: 0 }
    ];

    // Hand-placed coordinates are relative to the home clearing (centre cell of the 3x3 world)
    this.props = initialProps.map((p) => ({ ...p, x: p.x + CELL_W, y: p.y + CELL_H, respawnTimer: 0 }));
  }

  private showToast(msg: string, duration: number = 3.2): void {
    this.toastMessage = msg;
    this.toastTimer = duration;
  }

  public update(_time: number, dt: number): void {
    this.sceneTime += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMessage = '';
    }

    // [M] Paper-collage map (pauses the woods while open)
    if (this.app.input.wasPressed('KeyM')) {
      this.map.toggle();
      if (this.map.open) this.hud.bagOpen = false;
      this.app.audio.playLeafStep();
    }
    if (this.map.open) {
      if (this.app.input.wasPressed('Escape')) this.map.open = false;
      this.app.input.consumeClick();
      return;
    }

    // Global UI hotkeys
    if (this.app.input.wasPressed('Tab') || this.app.input.wasPressed('KeyI')) {
      this.hud.bagOpen = !this.hud.bagOpen;
    }
    if (this.app.input.wasPressed('Escape') && this.hud.bagOpen) {
      this.hud.bagOpen = false;
    }

    // Hotbar 1-5 selection
    for (let i = 1; i <= 5; i++) {
      if (this.app.input.wasPressed(`Digit${i}`)) {
        this.inventory.activeHotbarIndex = i - 1;
        this.hud.selectedBagSlot = i - 1;
      }
    }

    // Pointer clicks (HUD, Hotbar, or Bag/Craft modal)
    if (this.app.input.consumeClick()) {
      const px = this.app.input.pointer.x;
      const py = this.app.input.pointer.y;
      this.hud.handlePointerClick(px, py, {
        onEatBerry: () => this.eatBerry(),
        onFeedSparrow: () => this.feedSparrow(),
        onCraftTent: () => this.craftTent(),
        onPlaceTent: () => this.tryPlaceTent()
      });
    }

    if (this.hud.bagOpen) {
      return;
    }

    // Quick-consume / companion keys
    if (this.app.input.wasPressed('KeyR')) {
      this.eatBerry();
    }
    if (this.app.input.wasPressed('KeyF')) {
      this.feedSparrow();
    }

    // [C] Summon Companion: Maple Leaf takes flight, flies across the screen, and lands beside player
    if (this.app.input.wasPressed('KeyC')) {
      this.summonMapleLeaf();
    }

    // [Spacebar] Mount & Fly toggle per GAME_DESIGN_SPEC.md Section 4
    if (this.app.input.wasPressed('Space')) {
      this.handleSpacebarMountOrFly();
    }

    // [E] Interact / Gather / Pitch Tent
    if (this.app.input.wasPressed('KeyE')) {
      this.handleInteract();
    }

    // 8-directional WASD movement
    this.updateMovement(dt);

    // Update Maple Leaf companion state (summon arc, flight altitude, following)
    this.updateSparrow(dt);

    // Gentle hunger & energy drain
    this.player.hunger = Math.max(0, this.player.hunger - dt * 0.42);
    if (this.player.hunger <= 0) {
      this.player.health = Math.max(10, this.player.health - dt * 1.5);
    }
    if (this.sparrow.isFlying) {
      this.sparrow.energy = Math.max(0, this.sparrow.energy - dt * 1.4);
      if (this.sparrow.energy <= 0) {
        this.sparrow.isFlying = false;
        this.sparrow.targetAltitude = 0;
        this.showToast('Maple Leaf grew tired and glided gently back down. Feed her seeds [F]!');
      }
    }

    // Respawn depleted forageables over time so player never soft-locks
    for (const prop of this.props) {
      if (prop.kind === 'forage' && prop.charges <= 0) {
        prop.respawnTimer += dt;
        if (prop.respawnTimer >= 22) {
          prop.charges = prop.maxCharges;
          prop.respawnTimer = 0;
        }
      }
    }

    // Update leaf dust particles
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.dust.splice(i, 1);
    }

    // Update drifting canopy autumn leaves (wrapped around the camera view)
    for (const lf of this.fallingLeaves) {
      lf.x += lf.vx * dt;
      lf.y += lf.vy * dt;
      lf.rot += lf.vRot * dt;
      if (lf.x > this.camX + 900) lf.x -= 1800;
      if (lf.x < this.camX - 900) lf.x += 1800;
      if (lf.y > this.camY + 560) {
        lf.y -= 1120;
        lf.x = this.camX + (Math.random() - 0.5) * 1800;
      }
      if (lf.y < this.camY - 560) lf.y += 1120;
    }

    // Lift the fog around the acorn — Maple Leaf sees much further from the sky
    this.fog.reveal(this.player.x, this.player.y, this.sparrow.isFlying ? 640 : 410);
    for (const lm of LANDMARKS) {
      if (this.discovered.has(lm.id)) continue;
      const near = Math.hypot(lm.x - this.player.x, (lm.y - this.player.y) * 1.15) < (this.sparrow.isFlying ? 760 : 620);
      if (near || this.fog.isRevealed(lm.x, lm.y)) {
        this.discovered.add(lm.id);
        // Seeing a landmark reveals the whole of it, not just the edge you walked up to
        this.fog.reveal(lm.x, lm.y, 380);
        this.app.audio.playCraftSuccess();
        const msg = lm.id === 'post' && this.storyFlags.sweetpeaArrived
          ? "Discovered Sweetpea's Traveling Post! A patchwork wagon is parked in the clearing."
          : lm.discoverToast;
        this.showToast(msg + '  (Added to your map [M])', 5.5);
      }
    }

    // Smooth camera follow + flight altitude zoom-out
    const targetZoom = this.sparrow.isFlying ? 0.92 : 1.04;
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 3.5);

    const focusY = this.player.y - this.sparrow.altitude * 0.45;
    this.camX += (this.player.x - this.camX) * Math.min(1, dt * 6);
    this.camY += (focusY - this.camY) * Math.min(1, dt * 6);

    const halfViewW = (this.app.width / 2) / this.camZoom;
    const halfViewH = (this.app.height / 2) / this.camZoom;
    this.camX = Math.max(halfViewW, Math.min(this.worldWidth - halfViewW, this.camX));
    this.camY = Math.max(halfViewH, Math.min(this.worldHeight - halfViewH, this.camY));
  }

  private updateMovement(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.app.input.isDown('KeyW') || this.app.input.isDown('ArrowUp')) dy -= 1;
    if (this.app.input.isDown('KeyS') || this.app.input.isDown('ArrowDown')) dy += 1;
    if (this.app.input.isDown('KeyA') || this.app.input.isDown('ArrowLeft')) dx -= 1;
    if (this.app.input.isDown('KeyD') || this.app.input.isDown('ArrowRight')) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }

    const baseSpeed = this.sparrow.isFlying ? 310 : this.sparrow.isMounted ? 215 : 175;
    this.player.isMoving = dx !== 0 || dy !== 0;

    if (this.player.isMoving) {
      if (dx < -0.05) this.player.facingLeft = true;
      else if (dx > 0.05) this.player.facingLeft = false;

      const nextX = this.player.x + dx * baseSpeed * dt;
      const nextY = this.player.y + dy * baseSpeed * dt;

      // Solid scenery (oak trunk, lake water, Claud's boot) blocks walking, but
      // Maple Leaf can soar right over it. Slide along obstacles axis by axis.
      const flying = this.sparrow.isFlying;
      if (isWalkable(nextX, nextY, flying)) {
        this.player.x = nextX;
        this.player.y = nextY;
      } else if (isWalkable(nextX, this.player.y, flying)) {
        this.player.x = nextX;
      } else if (isWalkable(this.player.x, nextY, flying)) {
        this.player.y = nextY;
      }
      this.player.walkPhase += dt * 11;

      // Walking leaf-dust particles & soft step rustle when on foot
      if (!this.sparrow.isFlying) {
        this.player.dustTimer -= dt;
        if (this.player.dustTimer <= 0) {
          this.player.dustTimer = 0.11;
          this.spawnLeafDust(this.player.x, this.player.y + 4);
        }
        this.player.stepSoundTimer -= dt;
        if (this.player.stepSoundTimer <= 0) {
          this.player.stepSoundTimer = 0.28;
          this.app.audio.playLeafStep();
        }
      }
    }
  }

  private spawnLeafDust(x: number, y: number): void {
    const palette = ['#d89b44', '#b87932', '#e4bc74', '#8f632e'];
    for (let i = 0; i < 2; i++) {
      this.dust.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 28,
        vy: -12 - Math.random() * 18,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        size: 3 + Math.random() * 3.5,
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }
  }

  private updateSparrow(dt: number): void {
    this.sparrow.flapPhase += dt * (this.sparrow.isFlying || this.sparrow.summoning ? 15 : 3);

    if (this.sparrow.summoning) {
      this.sparrow.summonProgress = Math.min(1, this.sparrow.summonProgress + dt * 1.25);
      const t = this.sparrow.summonProgress;
      const ease = 1 - Math.pow(1 - t, 3);

      this.sparrow.x = this.sparrow.summonFromX + (this.sparrow.summonTargetX - this.sparrow.summonFromX) * ease;
      this.sparrow.y = this.sparrow.summonFromY + (this.sparrow.summonTargetY - this.sparrow.summonFromY) * ease;
      this.sparrow.altitude = Math.sin(t * Math.PI) * 130;
      this.sparrow.facingLeft = this.sparrow.summonTargetX < this.sparrow.summonFromX;

      if (t >= 1) {
        this.sparrow.summoning = false;
        this.sparrow.altitude = 0;
        this.spawnLeafDust(this.sparrow.x, this.sparrow.y);
        this.app.audio.playSparrowChirp();
      }
      return;
    }

    if (this.sparrow.isMounted) {
      this.sparrow.x = this.player.x;
      this.sparrow.y = this.player.y;
      this.sparrow.facingLeft = this.player.facingLeft;

      // Smoothly lift into the air or descend to land
      const speed = this.sparrow.targetAltitude > this.sparrow.altitude ? 160 : 140;
      if (Math.abs(this.sparrow.targetAltitude - this.sparrow.altitude) > 1) {
        this.sparrow.altitude += Math.sign(this.sparrow.targetAltitude - this.sparrow.altitude) * speed * dt;
      } else {
        this.sparrow.altitude = this.sparrow.targetAltitude;
      }
    } else {
      this.sparrow.altitude = Math.max(0, this.sparrow.altitude - dt * 140);
    }
  }

  private summonMapleLeaf(): void {
    if (this.sparrow.isMounted) {
      // Dismount if currently grounded and mounted
      if (!this.sparrow.isFlying) {
        this.sparrow.isMounted = false;
        this.sparrow.x = this.player.x + 75;
        this.showToast('Hopped off Maple Leaf.');
      } else {
        this.showToast('Press [Space] to land first before dismounting!');
      }
      return;
    }

    const dist = Math.hypot(this.sparrow.x - this.player.x, this.sparrow.y - this.player.y);
    // Start dramatic swoop across clearing to land right beside the player
    this.sparrow.summoning = true;
    this.sparrow.summonProgress = 0;
    this.sparrow.summonFromX = dist < 160 ? this.player.x - 460 : this.sparrow.x;
    this.sparrow.summonFromY = dist < 160 ? this.player.y - 240 : this.sparrow.y;
    this.sparrow.summonTargetX = this.player.x + (this.player.facingLeft ? -82 : 82);
    this.sparrow.summonTargetY = this.player.y + 6;
    this.app.audio.playSparrowChirp();
    this.app.audio.playWingFlap();
    this.showToast('Summoned Maple Leaf! Press [Space] beside her to mount & fly.');
  }

  private handleSpacebarMountOrFly(): void {
    if (this.sparrow.summoning) return;

    if (!this.sparrow.isMounted) {
      const dist = Math.hypot(this.sparrow.x - this.player.x, this.sparrow.y - this.player.y);
      if (dist <= 145) {
        this.sparrow.isMounted = true;
        this.sparrow.isFlying = false;
        this.sparrow.targetAltitude = 0;
        this.player.x = this.sparrow.x;
        this.player.y = this.sparrow.y;
        this.app.audio.playSparrowChirp();
        this.showToast('Mounted Maple Leaf! Press [Space] to take off into flight, or [C] to dismount.');
      } else {
        this.showToast('Too far from Maple Leaf — walk closer or press [C] to summon her!');
      }
      return;
    }

    // Already mounted: toggle flight takeoff / landing!
    if (!this.sparrow.isFlying) {
      if (this.sparrow.energy < 8) {
        this.showToast('Maple Leaf needs energy! Feed her Golden Grass Seeds [F].');
        return;
      }
      this.sparrow.isFlying = true;
      this.sparrow.targetAltitude = 145;
      this.app.audio.playWingFlap();
      this.showToast('Soaring above the clearing! Press [Space] again to land.');
    } else {
      if (!isWalkable(this.player.x, this.player.y, false)) {
        this.showToast("Can't land here — find solid ground away from the water and big roots!");
        return;
      }
      this.sparrow.isFlying = false;
      this.sparrow.targetAltitude = 0;
      this.app.audio.playWingFlap();
      this.showToast('Landed safely on the forest floor. Press [C] to hop off, or [Space] to fly again.');
    }
  }

  private handleInteract(): void {
    if (this.sparrow.isFlying) {
      this.showToast('Press [Space] to land before gathering on the forest floor!');
      return;
    }

    // 1. If holding Leaf-and-Stick Tent kit in active hotbar slot, place it!
    const activeSlot = this.inventory.getActiveSlot();
    if (activeSlot && activeSlot.id === 'tent_kit') {
      this.tryPlaceTent();
      return;
    }

    // 2. Check nearest interactable tent or forageable prop
    const nearest = this.findNearestInteractable();
    if (nearest) {
      if (nearest.kind === 'tent') {
        this.player.health = this.player.maxHealth;
        this.sparrow.energy = Math.min(this.sparrow.maxEnergy, this.sparrow.energy + 25);
        this.app.audio.playCraftSuccess();
        this.showToast('Rested snugly beneath your Leaf-and-Stick Tent! Health restored.');
        return;
      }

      if (nearest.kind === 'forage' && nearest.itemType && nearest.charges > 0) {
        if (this.inventory.add(nearest.itemType, 1)) {
          nearest.charges--;
          this.app.audio.playGather();
          this.spawnLeafDust(nearest.x, nearest.y);
          const def = ITEMS[nearest.itemType];
          const leaves = this.inventory.count('leaf');
          const sticks = this.inventory.count('stick');
          if (!this.tentBuilt && leaves >= 2 && sticks >= 3 && nearest.itemType !== 'berry' && nearest.itemType !== 'seed') {
            this.showToast(`Gathered ${def.name}! You have 2 Leaves & 3 Sticks — open [Tab] to craft your Tent!`);
          } else {
            this.showToast(`Gathered +1 ${def.name}`);
          }
        } else {
          this.showToast('Your 10-slot satchel is full!');
        }
        return;
      }
    }

    // 3. Talk / inspect nearby points of interest (Claud, signpost, lake, oak door)
    const spot = this.findNearestHotspot();
    if (spot) spot.onInteract();
  }

  private eatBerry(): void {
    if (this.inventory.remove('berry', 1)) {
      this.player.hunger = Math.min(this.player.maxHunger, this.player.hunger + 28);
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 10);
      this.app.audio.playGather();
      this.showToast('Ate sweet Woodland Berries (+28 Hunger)');
    } else {
      this.showToast('No berries in satchel! Gather red berries [E] from bushes.');
    }
  }

  private feedSparrow(): void {
    if (this.inventory.remove('seed', 1)) {
      this.sparrow.energy = Math.min(this.sparrow.maxEnergy, this.sparrow.energy + 35);
      this.app.audio.playSparrowChirp();
      this.showToast('Maple Leaf happily pecked Golden Grass Seeds (+35 Flight Energy)!');
    } else {
      this.showToast('No grass seeds in satchel! Gather tall golden seed stalks [E].');
    }
  }

  private craftTent(): void {
    const recipe = PHASE1_RECIPES[0];
    if (this.crafting.craft(recipe)) {
      this.app.audio.playCraftSuccess();
      this.hud.bagOpen = false;
      this.showToast('Crafted Leaf-and-Stick Tent! Stand in the clearing & press [E] to pitch it.', 4.5);
    } else {
      this.showToast('Need 2 Fallen Oak Leaves and 3 Dry Oak Sticks first!');
    }
  }

  private tryPlaceTent(): void {
    if (!this.inventory.remove('tent_kit', 1)) {
      this.showToast('Select your crafted Leaf-and-Stick Tent first!');
      return;
    }

    let tentX = this.player.x + (this.player.facingLeft ? -95 : 95);
    let tentY = this.player.y - 10;
    if (!isWalkable(tentX, tentY, false)) {
      tentX = this.player.x;
      tentY = this.player.y - 10;
    }

    this.props.push({
      id: `tent_${Date.now()}`,
      kind: 'tent',
      textureKey: 'leaf_tent',
      x: tentX,
      y: tentY,
      displayHeight: 175,
      charges: 1,
      maxCharges: 1,
      respawnTimer: 0,
      label: 'Leaf-and-Stick Tent'
    });

    this.tentBuilt = true;
    this.tentPos = { x: tentX, y: tentY };
    this.spawnLeafDust(tentX, tentY);
    this.app.audio.playCraftSuccess();
    this.showToast('Leaf-and-Stick Tent pitched! It now marks "Home" on your map. Press [E] near it anytime to rest.', 5.0);
  }

  private findNearestInteractable(): WorldProp | null {
    let best: WorldProp | null = null;
    let bestDist = 98;

    for (const p of this.props) {
      if (p.kind !== 'forage' && p.kind !== 'tent') continue;
      if (p.kind === 'forage' && p.charges <= 0) continue;
      const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  private computeContextPrompt(): string {
    if (this.sparrow.isFlying) {
      return 'Soaring on Maple Leaf  •  [WASD] Fly Over Canopy  •  [Space] Land  •  [M] Map';
    }

    const activeSlot = this.inventory.getActiveSlot();
    if (activeSlot && activeSlot.id === 'tent_kit') {
      return 'Press [E] to pitch your Leaf-and-Stick Tent here!';
    }

    const near = this.findNearestInteractable();
    if (near) {
      if (near.kind === 'tent') {
        return 'Press [E] to rest beneath your cozy Leaf-and-Stick Tent';
      }
      return `Press [E] to gather ${near.label}`;
    }

    if (!this.sparrow.isMounted) {
      const birdDist = Math.hypot(this.sparrow.x - this.player.x, this.sparrow.y - this.player.y);
      if (birdDist <= 115) {
        return 'Press [Space] to mount Maple Leaf  •  [F] Feed Grass Seeds';
      }
    } else {
      return 'Mounted on Maple Leaf  •  Press [Space] to Take Off  •  [C] Dismount';
    }

    const spot = this.findNearestHotspot();
    if (spot) return spot.prompt;

    return '';
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const w = this.app.width;
    const h = this.app.height;

    ctx.fillStyle = '#1b120a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    // 1. Hand-drawn watercolour zones (feathered together, only visible ones drawn)
    const halfW = w / 2 / this.camZoom;
    const halfH = h / 2 / this.camZoom;
    this.background.render(ctx, this.camX - halfW, this.camY - halfH, this.camX + halfW, this.camY + halfH);

    // 2. Ground shadows (always stay on the ground even during high flight!)
    this.renderGroundShadows(ctx);

    // 3. Leaf dust particles on forest floor
    for (const p of this.dust) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.75;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#3a2412';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.65, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Native 2.5D Y-Depth Sorted Drawables (Props, Tent, Acorn, Maple Leaf)
    const drawList: { ySort: number; draw: () => void }[] = [];

    for (const prop of this.props) {
      if (prop.kind === 'forage' && prop.charges <= 0) continue;
      // Skip props well outside the camera view (the world is large now)
      if (Math.abs(prop.x - this.camX) > halfW + 260 || prop.y < this.camY - halfH - 60 || prop.y - prop.displayHeight > this.camY + halfH + 60) continue;
      drawList.push({
        ySort: prop.y,
        draw: () => this.renderProp(ctx, prop)
      });
    }

    if (this.sparrow.isMounted) {
      // Mounted or Flying sprite
      const sortY = this.sparrow.isFlying ? 9999 : this.player.y;
      drawList.push({
        ySort: sortY,
        draw: () => this.renderMountedPair(ctx)
      });
    } else {
      // Separate Acorn & Sparrow Y-sorted independently
      drawList.push({
        ySort: this.player.y,
        draw: () => this.renderAcorn(ctx)
      });
      drawList.push({
        ySort: this.sparrow.summoning ? 9998 : this.sparrow.y,
        draw: () => this.renderGroundedSparrow(ctx)
      });
    }

    drawList.sort((a, b) => a.ySort - b.ySort);
    for (const item of drawList) {
      item.draw();
    }

    // 5. Highlight indicator ring on nearest interactable prop / point of interest
    const near = this.findNearestInteractable();
    if (near && !this.sparrow.isFlying) {
      this.renderInteractBadge(ctx, near.x, near.y - near.displayHeight - 10, `[E] ${near.kind === 'tent' ? 'Rest' : 'Gather'}`);
    } else if (!this.sparrow.isFlying) {
      const spot = this.findNearestHotspot();
      if (spot) this.renderInteractBadge(ctx, spot.x, spot.y - 130, spot.badge);
    }

    // 6. Drifting golden oak leaves
    this.renderCanopyAtmosphere(ctx);

    ctx.restore();

    // 7. Fog over the undiscovered woods
    this.fog.renderWorldFog(ctx, this.camX, this.camY, this.camZoom, w, h, this.sceneTime);

    // Warm golden morning sunbeams (screen space)
    const sunGrad = ctx.createLinearGradient(0, 0, 820, 560);
    sunGrad.addColorStop(0, 'rgba(255, 224, 150, 0.22)');
    sunGrad.addColorStop(0.55, 'rgba(255, 205, 120, 0.06)');
    sunGrad.addColorStop(1, 'rgba(255, 205, 120, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);

    // 8. Dual Storybook Parchment HUD & Bag/Crafting Interface
    this.hud.render(ctx, {
      acornHealth: this.player.health,
      acornMaxHealth: this.player.maxHealth,
      acornHunger: this.player.hunger,
      acornMaxHunger: this.player.maxHunger,
      birdHealth: this.sparrow.health,
      birdMaxHealth: this.sparrow.maxHealth,
      birdEnergy: this.sparrow.energy,
      birdMaxEnergy: this.sparrow.maxEnergy,
      isMounted: this.sparrow.isMounted,
      isFlying: this.sparrow.isFlying,
      tentBuilt: this.tentBuilt,
      contextPrompt: this.computeContextPrompt(),
      toastMessage: this.toastMessage
    });

    // 9. Paper-collage map overlay
    this.map.render(ctx, {
      fog: this.fog,
      playerX: this.player.x,
      playerY: this.player.y,
      tent: this.tentPos,
      discovered: this.discovered,
      sweetpeaArrived: this.storyFlags.sweetpeaArrived,
      time: this.sceneTime
    });
  }

  private renderGroundShadows(ctx: CanvasRenderingContext2D): void {
    // Props soft ink-wash shadows
    for (const prop of this.props) {
      if (prop.kind === 'forage' && prop.charges <= 0) continue;
      if (prop.itemType === 'leaf' || prop.itemType === 'stick') continue;
      ctx.fillStyle = 'rgba(34, 21, 10, 0.28)';
      ctx.beginPath();
      const rx = prop.kind === 'tent' ? 76 : 46;
      ctx.ellipse(prop.x, prop.y - 2, rx, rx * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.sparrow.isMounted) {
      // Shadow remains anchored on the ground at (player.x, player.y) while sprite lifts into the air!
      const altFactor = Math.max(0.45, 1 - this.sparrow.altitude / 240);
      ctx.fillStyle = `rgba(28, 17, 8, ${0.34 * altFactor})`;
      ctx.beginPath();
      ctx.ellipse(this.player.x, this.player.y + 4, 54 * altFactor, 19 * altFactor, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Acorn shadow
      ctx.fillStyle = 'rgba(28, 17, 8, 0.34)';
      ctx.beginPath();
      ctx.ellipse(this.player.x, this.player.y + 2, 24, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sparrow shadow
      const sAltFactor = Math.max(0.4, 1 - this.sparrow.altitude / 240);
      ctx.fillStyle = `rgba(28, 17, 8, ${0.32 * sAltFactor})`;
      ctx.beginPath();
      ctx.ellipse(this.sparrow.x, this.sparrow.y + 3, 46 * sAltFactor, 16 * sAltFactor, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderProp(ctx: CanvasRenderingContext2D, prop: WorldProp): void {
    const tex = this.app.getTexture(prop.textureKey);
    if (!tex) return;

    const scale = prop.displayHeight / tex.height;
    const dw = tex.width * scale;
    const dh = prop.displayHeight;

    ctx.save();
    ctx.translate(prop.x, prop.y);
    if (prop.flipX) ctx.scale(-1, 1);
    ctx.drawImage(tex, -dw / 2, -dh + 8, dw, dh);
    ctx.restore();
  }

  private renderAcorn(ctx: CanvasRenderingContext2D): void {
    const tex = this.app.getTexture('acorn_idle');
    if (!tex) return;

    // Tiny acorn height ~108px (with twig antlers) vs ~128px sparrow body (~2x acorn body mass)
    const targetH = 108;
    const scale = targetH / tex.height;
    const dw = tex.width * scale;
    const dh = targetH;

    const bob = this.player.isMoving ? Math.abs(Math.sin(this.player.walkPhase)) * 6 : 0;
    const tilt = this.player.isMoving ? Math.sin(this.player.walkPhase) * 0.07 : 0;

    ctx.save();
    ctx.translate(this.player.x, this.player.y - bob);
    ctx.rotate(tilt);
    // Sprite faces slightly right by default; flip when walking left
    if (this.player.facingLeft) ctx.scale(-1, 1);
    ctx.drawImage(tex, -dw / 2, -dh + 6, dw, dh);
    ctx.restore();
  }

  private renderGroundedSparrow(ctx: CanvasRenderingContext2D): void {
    const key = this.sparrow.summoning ? 'mounted_flight' : 'sparrow_ground';
    const tex = this.app.getTexture(key);
    if (!tex) return;

    const targetH = this.sparrow.summoning ? 155 : 132;
    const scale = targetH / tex.height;
    const dw = tex.width * scale;
    const dh = targetH;

    const breathe = Math.sin(this.sparrow.flapPhase) * (this.sparrow.summoning ? 7 : 1.8);

    ctx.save();
    ctx.translate(this.sparrow.x, this.sparrow.y - this.sparrow.altitude - breathe);

    // sparrow_ground.png faces LEFT natively; mounted_flight.png faces RIGHT natively
    if (key === 'sparrow_ground') {
      if (!this.sparrow.facingLeft) ctx.scale(-1, 1);
    } else {
      if (this.sparrow.facingLeft) ctx.scale(-1, 1);
    }

    ctx.drawImage(tex, -dw / 2, -dh + 8, dw, dh);
    ctx.restore();
  }

  private renderMountedPair(ctx: CanvasRenderingContext2D): void {
    const flyingSprite = this.sparrow.isFlying || this.sparrow.altitude > 12;
    if (flyingSprite) {
      const tex = this.app.getTexture('mounted_flight');
      if (!tex) return;

      const altitudeScale = 1 + (this.sparrow.altitude / 115) * 0.16;
      const targetH = 168 * altitudeScale;
      const scale = targetH / tex.height;
      const dw = tex.width * scale;
      const dh = targetH;
      const hoverBob = Math.sin(this.sparrow.flapPhase) * 6;
      const wingPulse = 1 + Math.sin(this.sparrow.flapPhase) * 0.04;

      ctx.save();
      ctx.translate(this.player.x, this.player.y - this.sparrow.altitude + hoverBob);
      // mounted_flight.png faces RIGHT natively
      if (this.player.facingLeft) ctx.scale(-1, wingPulse);
      else ctx.scale(1, wingPulse);

      ctx.drawImage(tex, -dw / 2, -dh + 16, dw, dh);
      ctx.restore();
    } else {
      // Mounted on ground waiting for Spacebar takeoff: draw grounded sparrow + acorn perched on back
      const birdTex = this.app.getTexture('sparrow_ground');
      const acornTex = this.app.getTexture('acorn_idle');
      if (!birdTex || !acornTex) return;

      ctx.save();
      ctx.translate(this.player.x, this.player.y);

      const bH = 132;
      const bScale = bH / birdTex.height;
      const bW = birdTex.width * bScale;

      const aH = 88;
      const aScale = aH / acornTex.height;
      const aW = acornTex.width * aScale;

      // Acorn perched snugly on Maple Leaf's back
      ctx.save();
      ctx.translate(this.player.facingLeft ? 8 : -8, -58);
      if (this.player.facingLeft) ctx.scale(-1, 1);
      ctx.drawImage(acornTex, -aW / 2, -aH + 10, aW, aH);
      ctx.restore();

      ctx.save();
      if (!this.player.facingLeft) ctx.scale(-1, 1);
      ctx.drawImage(birdTex, -bW / 2, -bH + 8, bW, bH);
      ctx.restore();

      ctx.restore();
    }
  }

  private renderInteractBadge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
    ctx.save();
    ctx.font = '700 13px "Lora", Georgia, serif';
    const tw = ctx.measureText(text).width + 22;
    ctx.fillStyle = 'rgba(246, 234, 208, 0.94)';
    ctx.strokeStyle = '#2b1b0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, y - 24, tw, 26, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2b1a0e';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 6);
    ctx.restore();
  }

  private renderCanopyAtmosphere(ctx: CanvasRenderingContext2D): void {
    const leafTex = this.app.getTexture('oak_leaf');
    if (leafTex) {
      for (const lf of this.fallingLeaves) {
        ctx.save();
        ctx.translate(lf.x, lf.y);
        ctx.rotate(lf.rot);
        ctx.globalAlpha = 0.82;
        const lw = leafTex.width * lf.scale;
        const lh = leafTex.height * lf.scale;
        ctx.drawImage(leafTex, -lw / 2, -lh / 2, lw, lh);
        ctx.restore();
      }
    }
  }
}
