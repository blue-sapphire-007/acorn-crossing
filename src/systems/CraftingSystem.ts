import { InventorySystem } from './InventorySystem.ts';
import type { ItemId } from './InventorySystem.ts';

export interface CraftingRecipe {
  id: string;
  name: string;
  outputId: ItemId;
  outputCount: number;
  description: string;
  ingredients: { id: ItemId; required: number }[];
}

export const PHASE1_RECIPES: CraftingRecipe[] = [
  {
    id: 'leaf_and_stick_tent',
    name: 'Leaf-and-Stick Tent',
    outputId: 'tent_kit',
    outputCount: 1,
    description: 'Weave 2 broad golden oak leaves over a tied tripod of 3 dry sticks to shelter you and Maple Leaf through chilly autumn nights.',
    ingredients: [
      { id: 'leaf', required: 2 },
      { id: 'stick', required: 3 }
    ]
  }
];

export class CraftingSystem {
  private inventory: InventorySystem;

  constructor(inventory: InventorySystem) {
    this.inventory = inventory;
  }

  public canCraft(recipe: CraftingRecipe): boolean {
    return recipe.ingredients.every((ing) => this.inventory.count(ing.id) >= ing.required);
  }

  public craft(recipe: CraftingRecipe): boolean {
    if (!this.canCraft(recipe)) return false;

    for (const ing of recipe.ingredients) {
      this.inventory.remove(ing.id, ing.required);
    }
    this.inventory.add(recipe.outputId, recipe.outputCount);

    // Auto-select the hotbar slot holding the newly crafted tent if visible
    for (let i = 0; i < this.inventory.hotbarSize; i++) {
      const s = this.inventory.slots[i];
      if (s && s.id === recipe.outputId) {
        this.inventory.activeHotbarIndex = i;
        break;
      }
    }
    return true;
  }
}
