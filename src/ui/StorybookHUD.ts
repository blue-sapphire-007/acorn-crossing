import { GameApp } from '../engine/GameApp.ts';
import { InventorySystem, ITEMS } from '../systems/InventorySystem.ts';
import type { ItemId } from '../systems/InventorySystem.ts';
import { CraftingSystem, PHASE1_RECIPES } from '../systems/CraftingSystem.ts';

export interface HudState {
  acornHealth: number;
  acornMaxHealth: number;
  acornHunger: number;
  acornMaxHunger: number;
  birdHealth: number;
  birdMaxHealth: number;
  birdEnergy: number;
  birdMaxEnergy: number;
  isMounted: boolean;
  isFlying: boolean;
  tentBuilt: boolean;
  contextPrompt: string;
  toastMessage: string;
}

export class StorybookHUD {
  private app: GameApp;
  private inventory: InventorySystem;
  private crafting: CraftingSystem;

  public bagOpen: boolean = false;
  public selectedBagSlot: number = 0;

  // Hitboxes for mouse interactions in 1280x720 canvas coords
  private hotbarSlotRects: { x: number; y: number; w: number; h: number }[] = [];
  private bagBtnRect = { x: 964, y: 644, w: 94, h: 58 };
  private craftBtnRect = { x: 750, y: 468, w: 220, h: 42 };
  private useItemBtnRect = { x: 310, y: 468, w: 185, h: 42 };
  private closeBagBtnRect = { x: 960, y: 142, w: 32, h: 32 };

  constructor(app: GameApp, inventory: InventorySystem, crafting: CraftingSystem) {
    this.app = app;
    this.inventory = inventory;
    this.crafting = crafting;
  }

  public handlePointerClick(
    px: number,
    py: number,
    callbacks: {
      onEatBerry: () => void;
      onFeedSparrow: () => void;
      onCraftTent: () => void;
      onPlaceTent: () => void;
    }
  ): boolean {
    // Check Bag toggle button next to hotbar
    if (this.inRect(px, py, this.bagBtnRect)) {
      this.bagOpen = !this.bagOpen;
      return true;
    }

    // Check hotbar slots
    for (let i = 0; i < this.hotbarSlotRects.length; i++) {
      if (this.inRect(px, py, this.hotbarSlotRects[i])) {
        this.inventory.activeHotbarIndex = i;
        this.selectedBagSlot = i;
        return true;
      }
    }

    if (!this.bagOpen) return false;

    // Close button inside Bag modal
    if (this.inRect(px, py, this.closeBagBtnRect)) {
      this.bagOpen = false;
      return true;
    }

    // 10-slot bag grid clicks (2 rows x 5 cols)
    const gx0 = 310;
    const gy0 = 225;
    const cell = 66;
    const gap = 12;
    for (let i = 0; i < this.inventory.bagSize; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const rx = gx0 + col * (cell + gap);
      const ry = gy0 + row * (cell + gap);
      if (px >= rx && px <= rx + cell && py >= ry && py <= ry + cell) {
        if (this.selectedBagSlot !== i) {
          // Clicking another slot while holding Shift swaps, normal click selects
          if (this.app.input.isDown('ShiftLeft') || this.app.input.isDown('ShiftRight')) {
            this.inventory.swap(this.selectedBagSlot, i);
          }
          this.selectedBagSlot = i;
          if (i < 5) this.inventory.activeHotbarIndex = i;
        }
        return true;
      }
    }

    // Use selected item button
    if (this.inRect(px, py, this.useItemBtnRect)) {
      const slot = this.inventory.slots[this.selectedBagSlot];
      if (slot) {
        if (slot.id === 'berry') callbacks.onEatBerry();
        else if (slot.id === 'seed') callbacks.onFeedSparrow();
        else if (slot.id === 'tent_kit') {
          this.bagOpen = false;
          callbacks.onPlaceTent();
        }
      }
      return true;
    }

    // Craft Leaf-and-Stick Tent button
    if (this.inRect(px, py, this.craftBtnRect)) {
      callbacks.onCraftTent();
      return true;
    }

    // Absorb clicks inside modal bounds
    if (px >= 275 && px <= 1005 && py >= 130 && py <= 545) {
      return true;
    }

    // Clicking outside closes bag
    this.bagOpen = false;
    return true;
  }

  private inRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  public render(ctx: CanvasRenderingContext2D, state: HudState): void {
    // 1. Top-Left: Acorn Status Card (Health + Hunger/Energy)
    this.renderParchmentStatusCard(ctx, {
      x: 22,
      y: 18,
      w: 274,
      h: 82,
      portraitKey: 'acorn_idle',
      title: 'Acorn Explorer',
      bar1Label: 'Health',
      bar1Ratio: state.acornHealth / state.acornMaxHealth,
      bar1Fill: '#b83b2b',
      bar2Label: 'Hunger',
      bar2Ratio: state.acornHunger / state.acornMaxHunger,
      bar2Fill: '#d98829'
    });

    // 2. Top-Right: Maple Leaf Companion Status Card (Health + Energy)
    this.renderParchmentStatusCard(ctx, {
      x: 1280 - 296,
      y: 18,
      w: 274,
      h: 82,
      portraitKey: 'sparrow_ground',
      title: state.isFlying ? 'Maple Leaf (Flying)' : state.isMounted ? 'Maple Leaf (Mounted)' : 'Maple Leaf',
      bar1Label: 'Health',
      bar1Ratio: state.birdHealth / state.birdMaxHealth,
      bar1Fill: '#b83b2b',
      bar2Label: 'Energy',
      bar2Ratio: state.birdEnergy / state.birdMaxEnergy,
      bar2Fill: '#e09f3e'
    });

    // 3. Top-Center: Chapter 1 Autumn Objective Banner
    this.renderSeasonBanner(ctx, state);

    // 4. Bottom 5-Slot Parchment Hotbar + Bag Button
    this.renderHotbar(ctx);

    // 5. Contextual Interaction / Toast Prompt above hotbar
    const activeMsg = state.toastMessage || state.contextPrompt;
    if (activeMsg && !this.bagOpen) {
      this.renderPromptBanner(ctx, activeMsg, !!state.toastMessage);
    }

    // 6. Controls whisper strip bottom-left
    if (!this.bagOpen) {
      this.renderControlsLegend(ctx);
    }

    // 7. Full 10-Slot Bag & Crafting Journal Modal
    if (this.bagOpen) {
      this.renderBagModal(ctx);
    }
  }

  private renderParchmentStatusCard(
    ctx: CanvasRenderingContext2D,
    opts: {
      x: number;
      y: number;
      w: number;
      h: number;
      portraitKey: string;
      title: string;
      bar1Label: string;
      bar1Ratio: number;
      bar1Fill: string;
      bar2Label: string;
      bar2Ratio: number;
      bar2Fill: string;
    }
  ): void {
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(20, 12, 5, 0.42)';
    ctx.beginPath();
    ctx.roundRect(opts.x + 3, opts.y + 4, opts.w, opts.h, 10);
    ctx.fill();

    // Warm hand-inked parchment plaque
    ctx.fillStyle = '#f2e3c6';
    ctx.strokeStyle = '#2b1b0e';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(opts.x, opts.y, opts.w, opts.h, 10);
    ctx.fill();
    ctx.stroke();

    // Inner ink hairline
    ctx.strokeStyle = 'rgba(120, 82, 42, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(opts.x + 5, opts.y + 5, opts.w - 10, opts.h - 10, 7);
    ctx.stroke();

    // Portrait medallion
    const px = opts.x + 36;
    const py = opts.y + opts.h / 2;
    ctx.fillStyle = '#e4cfa6';
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const tex = this.app.getTexture(opts.portraitKey);
    if (tex) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.min(46 / tex.width, 46 / tex.height) * 1.15;
      ctx.drawImage(tex, px - (tex.width * s) / 2, py - (tex.height * s) / 2 + 2, tex.width * s, tex.height * s);
      ctx.restore();
    }

    // Title
    ctx.fillStyle = '#2b1a0e';
    ctx.font = '700 14.5px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(opts.title, opts.x + 72, opts.y + 23);

    // Bars
    this.drawInkBar(ctx, opts.x + 72, opts.y + 31, opts.w - 86, 15, opts.bar1Ratio, opts.bar1Fill, opts.bar1Label);
    this.drawInkBar(ctx, opts.x + 72, opts.y + 53, opts.w - 86, 15, opts.bar2Ratio, opts.bar2Fill, opts.bar2Label);

    ctx.restore();
  }

  private drawInkBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    fill: string,
    label: string
  ): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = '#cbb38c';
    ctx.strokeStyle = '#2d1c0e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    if (clamped > 0.01) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, (w - 3) * clamped, h - 3, 3);
      ctx.fill();
    }
    ctx.stroke();

    ctx.fillStyle = '#fff9ee';
    ctx.font = '700 10px "Lora", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 6, y + 11);
  }

  private renderSeasonBanner(ctx: CanvasRenderingContext2D, state: HudState): void {
    const cx = 640;
    const y = 18;
    const w = 360;
    const h = 56;

    ctx.save();
    ctx.fillStyle = 'rgba(242, 227, 198, 0.94)';
    ctx.strokeStyle = '#2b1b0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2b1a0e';
    ctx.font = '700 15px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHAPTER I  •  AUTUMN CLEARING', cx, y + 22);

    const leaves = this.inventory.count('leaf');
    const sticks = this.inventory.count('stick');
    const hasTentKit = this.inventory.count('tent_kit') > 0;

    let goalText = `Shelter Goal: ${Math.min(2, leaves)}/2 Leaves  •  ${Math.min(3, sticks)}/3 Sticks`;
    if (state.tentBuilt) {
      goalText = '✓ Leaf-and-Stick Tent Pitched! Rest or explore.';
    } else if (hasTentKit) {
      goalText = 'Tent Ready! Select in Hotbar & press [E] to pitch.';
    } else if (leaves >= 2 && sticks >= 3) {
      goalText = 'Materials Ready! Open Bag [Tab / I] to craft Tent!';
    }

    ctx.fillStyle = state.tentBuilt ? '#2f6627' : '#6e471b';
    ctx.font = '600 12px "Lora", Georgia, serif';
    ctx.fillText(goalText, cx, y + 42);
    ctx.restore();
  }

  private renderHotbar(ctx: CanvasRenderingContext2D): void {
    const slotSize = 58;
    const gap = 10;
    const count = this.inventory.hotbarSize;
    const totalW = count * slotSize + (count - 1) * gap;
    const startX = (1280 - totalW) / 2 - 48;
    const y = 644;

    this.hotbarSlotRects = [];

    ctx.save();
    // Backing wooden/parchment tray
    ctx.fillStyle = 'rgba(43, 27, 14, 0.88)';
    ctx.strokeStyle = '#241509';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(startX - 12, y - 8, totalW + 24, slotSize + 16, 12);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const sx = startX + i * (slotSize + gap);
      this.hotbarSlotRects.push({ x: sx, y, w: slotSize, h: slotSize });

      const active = this.inventory.activeHotbarIndex === i;
      ctx.fillStyle = active ? '#f8ebd0' : '#e6d2ad';
      ctx.strokeStyle = active ? '#b86f1b' : '#2b1b0e';
      ctx.lineWidth = active ? 3.2 : 2;
      ctx.beginPath();
      ctx.roundRect(sx, y, slotSize, slotSize, 8);
      ctx.fill();
      ctx.stroke();

      // Slot number 1..5
      ctx.fillStyle = '#5c3c1e';
      ctx.font = '700 11px "Lora", Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), sx + 6, y + 14);

      const slot = this.inventory.slots[i];
      if (slot) {
        this.drawItemSpriteInBox(ctx, slot.id, sx + 7, y + 8, slotSize - 14, slotSize - 14);
        ctx.fillStyle = '#2b1a0e';
        ctx.font = '700 12px "Lora", Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(slot.count), sx + slotSize - 5, y + slotSize - 5);
      }
    }

    // Bag + Craft button right next to hotbar
    this.bagBtnRect = { x: startX + totalW + 22, y, w: 108, h: slotSize };
    const b = this.bagBtnRect;
    ctx.fillStyle = this.bagOpen ? '#f8ebd0' : '#e6d2ad';
    ctx.strokeStyle = '#2b1b0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2b1a0e';
    ctx.font = '700 14px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('BAG & CRAFT', b.x + b.w / 2, b.y + 27);
    ctx.fillStyle = '#6e471b';
    ctx.font = '600 11px "Lora", Georgia, serif';
    ctx.fillText('[Tab / I]', b.x + b.w / 2, b.y + 45);
    ctx.restore();
  }

  private drawItemSpriteInBox(
    ctx: CanvasRenderingContext2D,
    id: ItemId,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const def = ITEMS[id];
    const tex = this.app.getTexture(def.textureKey);
    if (!tex) return;
    const scale = Math.min(w / tex.width, h / tex.height);
    const dw = tex.width * scale;
    const dh = tex.height * scale;
    ctx.drawImage(tex, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  private renderPromptBanner(ctx: CanvasRenderingContext2D, message: string, isToast: boolean): void {
    ctx.save();
    ctx.font = '600 15px "Lora", Georgia, serif';
    const textW = ctx.measureText(message).width;
    const bw = Math.max(260, textW + 44);
    const bh = 36;
    const bx = (1280 - bw) / 2;
    const by = 592;

    ctx.fillStyle = isToast ? '#3b2615' : 'rgba(244, 230, 202, 0.95)';
    ctx.strokeStyle = '#241509';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isToast ? '#f8ebd0' : '#2b1a0e';
    ctx.textAlign = 'center';
    ctx.fillText(message, 640, by + 23);
    ctx.restore();
  }

  private renderControlsLegend(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const x = 22;
    const y = 636;
    const w = 310;
    const h = 68;

    ctx.fillStyle = 'rgba(34, 22, 13, 0.84)';
    ctx.strokeStyle = '#8b6534';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f2e3c6';
    ctx.font = '600 11.5px "Lora", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('[WASD] Move   •   [E] Gather / Talk / Pitch Tent', x + 12, y + 21);
    ctx.fillText('[C] Summon Maple Leaf   •   [Space] Mount & Fly', x + 12, y + 40);
    ctx.fillText('[R] Eat   •   [F] Feed Seeds   •   [Tab] Bag   •   [M] Map', x + 12, y + 58);
    ctx.restore();
  }

  private renderBagModal(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(18, 11, 5, 0.62)';
    ctx.fillRect(0, 0, 1280, 720);

    const mx = 275;
    const my = 130;
    const mw = 730;
    const mh = 415;

    // Illustrated storybook spread
    ctx.fillStyle = '#f3e4c6';
    ctx.strokeStyle = '#2b1b0e';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 14);
    ctx.fill();
    ctx.stroke();

    // Inner border & center book crease
    ctx.strokeStyle = '#9c7338';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(mx + 8, my + 8, mw - 16, mh - 16, 10);
    ctx.moveTo(718, my + 24);
    ctx.lineTo(718, my + mh - 24);
    ctx.stroke();

    // Close X button
    const cb = this.closeBagBtnRect;
    ctx.fillStyle = '#dcc397';
    ctx.strokeStyle = '#2b1b0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cb.x, cb.y, cb.w, cb.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b1b0e';
    ctx.font = '700 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', cb.x + cb.w / 2, cb.y + 24);

    // LEFT PAGE: 10-Slot Bag (stack size 30)
    ctx.fillStyle = '#2b1a0e';
    ctx.font = '700 22px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('EXPLORER SATCHEL (10 SLOTS)', 310, 174);
    ctx.fillStyle = '#6e471b';
    ctx.font = 'italic 12.5px "Lora", Georgia, serif';
    ctx.fillText('Slots 1–5 appear on your hotbar. Hold Shift + Click to swap slots.', 310, 198);

    const gx0 = 310;
    const gy0 = 225;
    const cell = 66;
    const gap = 12;

    for (let i = 0; i < this.inventory.bagSize; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const rx = gx0 + col * (cell + gap);
      const ry = gy0 + row * (cell + gap);
      const selected = this.selectedBagSlot === i;

      ctx.fillStyle = selected ? '#fbf1dc' : '#e6d1aa';
      ctx.strokeStyle = selected ? '#b86f1b' : '#3a2412';
      ctx.lineWidth = selected ? 3 : 1.8;
      ctx.beginPath();
      ctx.roundRect(rx, ry, cell, cell, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = i < 5 ? '#8a5216' : '#7a6348';
      ctx.font = '700 10px "Lora", Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(i < 5 ? `${i + 1}` : '•', rx + 6, ry + 14);

      const slot = this.inventory.slots[i];
      if (slot) {
        this.drawItemSpriteInBox(ctx, slot.id, rx + 8, ry + 9, cell - 16, cell - 16);
        ctx.fillStyle = '#2b1a0e';
        ctx.font = '700 12px "Lora", Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${slot.count}/30`, rx + cell - 5, ry + cell - 5);
      }
    }

    // Selected slot inspection panel
    const sel = this.inventory.slots[this.selectedBagSlot];
    if (sel) {
      const def = ITEMS[sel.id];
      ctx.fillStyle = '#2b1a0e';
      ctx.font = '700 16px "Cormorant Garamond", Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${def.name}  (×${sel.count})`, 310, 405);

      ctx.fillStyle = '#4f3319';
      ctx.font = '12.5px "Lora", Georgia, serif';
      this.drawSimpleWrap(ctx, def.description, 310, 426, 380, 17);

      if (sel.id === 'berry' || sel.id === 'seed' || sel.id === 'tent_kit') {
        const ub = this.useItemBtnRect;
        ctx.fillStyle = '#3b2615';
        ctx.strokeStyle = '#1b1008';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(ub.x, ub.y, ub.w, ub.h, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8ebd0';
        ctx.font = '600 13px "Lora", Georgia, serif';
        ctx.textAlign = 'center';
        const btnTxt =
          sel.id === 'berry'
            ? 'Eat Berry (+28)'
            : sel.id === 'seed'
              ? 'Feed Maple Leaf'
              : 'Pitch Tent [E]';
        ctx.fillText(btnTxt, ub.x + ub.w / 2, ub.y + 26);
      }
    } else {
      ctx.fillStyle = '#7a5c3c';
      ctx.font = 'italic 13px "Lora", Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText('Empty satchel pocket — gather berries, seeds, sticks & oak leaves.', 310, 425);
    }

    // RIGHT PAGE: Settlement Crafting (Leaf-and-Stick Tent)
    const recipe = PHASE1_RECIPES[0];
    const rx = 740;
    ctx.fillStyle = '#2b1a0e';
    ctx.font = '700 18.5px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('WOODLAND CRAFTING', rx, 171);

    // Tent illustration preview
    ctx.fillStyle = '#e7d3ad';
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(rx, 192, 232, 128, 10);
    ctx.fill();
    ctx.stroke();
    this.drawItemSpriteInBox(ctx, 'tent_kit', rx + 42, 198, 148, 116);

    ctx.fillStyle = '#2b1a0e';
    ctx.font = '700 17px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(recipe.name, rx, 344);

    ctx.fillStyle = '#4f3319';
    ctx.font = '12px "Lora", Georgia, serif';
    this.drawSimpleWrap(ctx, recipe.description, rx, 364, 234, 16);

    // Ingredients status
    const leaves = this.inventory.count('leaf');
    const sticks = this.inventory.count('stick');
    ctx.font = '700 13px "Lora", Georgia, serif';
    ctx.fillStyle = leaves >= 2 ? '#296322' : '#9c2d23';
    ctx.fillText(`${leaves >= 2 ? '✓' : '○'} Oak Leaves: ${leaves} / 2`, rx, 430);
    ctx.fillStyle = sticks >= 3 ? '#296322' : '#9c2d23';
    ctx.fillText(`${sticks >= 3 ? '✓' : '○'} Dry Sticks: ${sticks} / 3`, rx, 452);

    const canCraft = this.crafting.canCraft(recipe);
    const cbRect = this.craftBtnRect;
    ctx.fillStyle = canCraft ? '#3b5e2b' : '#b8a382';
    ctx.strokeStyle = '#241509';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cbRect.x, cbRect.y, cbRect.w, cbRect.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = canCraft ? '#fdf6e7' : '#594834';
    ctx.font = '700 14px "Lora", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(canCraft ? 'Weave Leaf Tent' : 'Need 2 Leaves & 3 Sticks', cbRect.x + cbRect.w / 2, cbRect.y + 26);

    ctx.restore();
  }

  private drawSimpleWrap(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh: number
  ): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (let i = 0; i < words.length; i++) {
      const t = line + words[i] + ' ';
      if (ctx.measureText(t).width > maxW && i > 0) {
        ctx.fillText(line, x, cy);
        line = words[i] + ' ';
        cy += lh;
      } else {
        line = t;
      }
    }
    ctx.fillText(line, x, cy);
  }
}
