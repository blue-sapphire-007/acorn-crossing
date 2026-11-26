export type ItemId = 'berry' | 'seed' | 'leaf' | 'stick' | 'tent_kit';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  textureKey: string;
  maxStack: number;
  actionHint?: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  berry: {
    id: 'berry',
    name: 'Woodland Berries',
    description: 'Plump crimson berries gathered from the clearing edge. Restores Acorn hunger (+28).',
    textureKey: 'berry_bush',
    maxStack: 30,
    actionHint: 'Press [R] or click Use to eat (+28 Hunger)'
  },
  seed: {
    id: 'seed',
    name: 'Golden Grass Seeds',
    description: 'Sun-ripened wild grass seeds. Maple Leaf’s favorite meal (+35 Companion Energy).',
    textureKey: 'seed_grass',
    maxStack: 30,
    actionHint: 'Press [F] near Maple Leaf to feed (+35 Energy)'
  },
  leaf: {
    id: 'leaf',
    name: 'Fallen Oak Leaf',
    description: 'A broad, sturdy golden-ochre oak leaf. Collect 2 leaves + 3 sticks for a tent.',
    textureKey: 'oak_leaf',
    maxStack: 30
  },
  stick: {
    id: 'stick',
    name: 'Dry Oak Stick',
    description: 'Seasoned fallen branch segment. Collect 3 sticks + 2 leaves to build shelter.',
    textureKey: 'fallen_stick',
    maxStack: 30
  },
  tent_kit: {
    id: 'tent_kit',
    name: 'Leaf-and-Stick Tent',
    description: 'A cozy A-frame shelter woven from 2 oak leaves and 3 sturdy sticks.',
    textureKey: 'leaf_tent',
    maxStack: 5,
    actionHint: 'Press [E] in the open clearing to pitch your tent!'
  }
};

export interface BagSlot {
  id: ItemId;
  count: number;
}

export class InventorySystem {
  public readonly bagSize: number = 10;
  public readonly hotbarSize: number = 5;
  public readonly slots: (BagSlot | null)[];
  public activeHotbarIndex: number = 0;

  constructor() {
    this.slots = new Array(this.bagSize).fill(null);
    // Starter provisions from Valley Oak Metropolis before the storm
    this.add('berry', 3);
    this.add('seed', 3);
  }

  public add(id: ItemId, amount: number = 1): boolean {
    const def = ITEMS[id];
    let remaining = amount;

    // Stack into existing matching slots first
    for (let i = 0; i < this.bagSize; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id && slot.count < def.maxStack) {
        const space = def.maxStack - slot.count;
        const delta = Math.min(space, remaining);
        slot.count += delta;
        remaining -= delta;
        if (remaining <= 0) return true;
      }
    }

    // Fill empty slots
    for (let i = 0; i < this.bagSize; i++) {
      if (!this.slots[i]) {
        const delta = Math.min(def.maxStack, remaining);
        this.slots[i] = { id, count: delta };
        remaining -= delta;
        if (remaining <= 0) return true;
      }
    }

    return remaining === 0;
  }

  public remove(id: ItemId, amount: number = 1): boolean {
    if (this.count(id) < amount) return false;
    let remaining = amount;

    for (let i = this.bagSize - 1; i >= 0; i--) {
      const slot = this.slots[i];
      if (slot && slot.id === id) {
        if (slot.count > remaining) {
          slot.count -= remaining;
          return true;
        } else {
          remaining -= slot.count;
          this.slots[i] = null;
          if (remaining <= 0) return true;
        }
      }
    }
    return true;
  }

  public count(id: ItemId): number {
    let total = 0;
    for (const s of this.slots) {
      if (s && s.id === id) total += s.count;
    }
    return total;
  }

  public swap(indexA: number, indexB: number): void {
    if (indexA < 0 || indexA >= this.bagSize || indexB < 0 || indexB >= this.bagSize) return;
    const tmp = this.slots[indexA];
    this.slots[indexA] = this.slots[indexB];
    this.slots[indexB] = tmp;
  }

  public getActiveSlot(): BagSlot | null {
    return this.slots[this.activeHotbarIndex] || null;
  }
}
