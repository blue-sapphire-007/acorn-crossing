import { GameApp } from '../engine/GameApp.ts';
import type { Scene } from '../engine/GameApp.ts';
import { InventorySystem, ITEMS } from '../systems/InventorySystem.ts';
import type { ItemId } from '../systems/InventorySystem.ts';
import { CraftingSystem, PHASE1_RECIPES } from '../systems/CraftingSystem.ts';
import { StorybookHUD } from '../ui/StorybookHUD.ts';

interface WorldProp {
  id: string;
  kind: 'forage' | 'scenery' | 'tent';
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

export class ClearingScene implements Scene {
  public readonly key = 'ClearingScene';
  private app!: GameApp;
  private inventory!: InventorySystem;
  private crafting!: CraftingSystem;
  private hud!: StorybookHUD;

  // Expanded playable world dimensions (panning smoothly with camera follow)
  private readonly worldWidth: number = 1760;
  private readonly worldHeight: number = 990;

  // Camera state
  private camX: number = 880;
  private camY: number = 540;
  private camZoom: number = 1.0;

  // Acorn protagonist state
  private player = {
    x: 780,
    y: 585,
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
    x: 885,
    y: 580,
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
  private toastMessage: string = '';
  private toastTimer: number = 0;

  public init(app: GameApp): void {
    this.app = app;
  }

  public enter(): void {
    this.inventory = new InventorySystem();
    this.crafting = new CraftingSystem(this.inventory);
    this.hud = new StorybookHUD(this.app, this.inventory, this.crafting);

    this.tentBuilt = false;
    this.props = [];
    this.dust = [];
    this.fallingLeaves = [];

    this.populateClearing();

    // Gentle drifting autumn leaves across the canopy
    for (let i = 0; i < 18; i++) {
      this.fallingLeaves.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        vx: 18 + Math.random() * 22,
        vy: 24 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 1.8,
        scale: 0.08 + Math.random() * 0.06
      });
    }

    this.showToast('Welcome to the Autumn Clearing! Gather 2 Oak Leaves & 3 Sticks to build shelter.', 5.0);
  }

  public exit(): void {}

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

    this.props = initialProps.map((p) => ({ ...p, respawnTimer: 0 }));
  }

  private showToast(msg: string, duration: number = 3.2): void {
    this.toastMessage = msg;
    this.toastTimer = duration;
  }

  public update(_time: number, dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMessage = '';
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

    // Update drifting canopy autumn leaves
    for (const lf of this.fallingLeaves) {
      lf.x += lf.vx * dt;
      lf.y += lf.vy * dt;
      lf.rot += lf.vRot * dt;
      if (lf.x > this.worldWidth + 60) lf.x = -50;
      if (lf.y > this.worldHeight + 60) {
        lf.y = -50;
        lf.x = Math.random() * this.worldWidth;
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

      let nextX = this.player.x + dx * baseSpeed * dt;
      let nextY = this.player.y + dy * baseSpeed * dt;

      // Ground walkable clearing bounds (when flying high, can soar freely over roots!)
      if (!this.sparrow.isFlying) {
        nextX = Math.max(250, Math.min(1510, nextX));
        nextY = Math.max(365, Math.min(895, nextY));
        // Prevent walking straight through the giant upper-right oak trunk unless flying
        if (nextX > 1130 && nextY < 515) {
          if (this.player.x <= 1130) nextX = 1130;
          else nextY = 515;
        }
      } else {
        nextX = Math.max(140, Math.min(this.worldWidth - 140, nextX));
        nextY = Math.max(180, Math.min(this.worldHeight - 100, nextY));
      }

      this.player.x = nextX;
      this.player.y = nextY;
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

    // 3. Check tiny arched oak root doorway in upper-right clearing
    if (Math.hypot(this.player.x - 1295, this.player.y - 475) < 115) {
      this.showToast('Ancient Oak Hollow Door: Sturdy winter housing upgrade (Chapter 2: Winter).');
    }
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

    const tentX = Math.max(460, Math.min(1180, this.player.x + (this.player.facingLeft ? -95 : 95)));
    const tentY = Math.max(450, Math.min(800, this.player.y - 10));

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
    this.spawnLeafDust(tentX, tentY);
    this.app.audio.playCraftSuccess();
    this.showToast('Leaf-and-Stick Tent pitched in the clearing! Press [E] near it anytime to rest.', 5.0);
  }

  private findNearestInteractable(): WorldProp | null {
    let best: WorldProp | null = null;
    let bestDist = 98;

    for (const p of this.props) {
      if (p.kind === 'scenery') continue;
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
      return 'Soaring on Maple Leaf  •  [WASD] Fly Over Canopy  •  [Space] Land';
    }

    const activeSlot = this.inventory.getActiveSlot();
    if (activeSlot && activeSlot.id === 'tent_kit') {
      return 'Press [E] to pitch your Leaf-and-Stick Tent here in the clearing!';
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

    if (Math.hypot(this.player.x - 1295, this.player.y - 475) < 115) {
      return 'Press [E] to inspect Ancient Oak Root Doorway';
    }

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

    // 1. Hand-Drawn Watercolor & Cross-Hatched Woodland Clearing Background
    const bg = this.app.getTexture('clearing_bg');
    if (bg) {
      ctx.drawImage(bg, 0, 0, this.worldWidth, this.worldHeight);
    }

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

    // 5. Highlight indicator ring on nearest interactable prop
    const near = this.findNearestInteractable();
    if (near && !this.sparrow.isFlying) {
      this.renderInteractBadge(ctx, near.x, near.y - near.displayHeight - 10, `[E] ${near.kind === 'tent' ? 'Rest' : 'Gather'}`);
    }

    // 6. Drifting golden oak leaves + warm sunlight shafts
    this.renderCanopyAtmosphere(ctx);

    ctx.restore();

    // 7. Dual Storybook Parchment HUD & Bag/Crafting Interface
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

    // Warm golden morning sunbeams from upper-left forest mist
    const sunGrad = ctx.createLinearGradient(0, 0, 820, 560);
    sunGrad.addColorStop(0, 'rgba(255, 224, 150, 0.22)');
    sunGrad.addColorStop(0.55, 'rgba(255, 205, 120, 0.06)');
    sunGrad.addColorStop(1, 'rgba(255, 205, 120, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
  }
}
