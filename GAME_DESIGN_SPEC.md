# Acorn Crossing — Game Design & Technical Specification

> **Status**: Approved for Scaffolding  
> **Platform**: Desktop Web Browser (Google Chrome)  
> **Engine**: TypeScript + Vite + Phaser 3 (WebGL Hardware Accelerated)  
> **Art Style**: *Winter Burrow*-inspired hand-drawn pen-and-ink with warm watercolor washes  

---

## 1. Premise & Storyline

* **Protagonist**: A spirited little acorn who lives in Valley Oak Metropolis. Your parents tame birds for flight, but your dream is to follow in your adventurous grandfather’s footsteps.
* **Companion**: **Maple Leaf**, a loyal, sturdy chipping sparrow mount.
* **Inciting Incident**: A sudden autumn storm catches you mid-flight. After seeking emergency shelter, you find yourself stranded far away in an unfamiliar woodland clearing.
* **Core Loop**: Establish a safe forest settlement across changing seasons, managing hunger, health, crafting shelter, preparing food reserves, and braving seasonal threats.

---

## 2. Architectural & Technical Decisions

| Category | Decision | Details |
| :--- | :--- | :--- |
| **Development Setup** | Cloud Devbox via Chrome Web UI | Avoids local Electron/Mac resource sluggishness; all building, dev servers, and toolchains run smoothly in the cloud. |
| **Source Control** | Local Git in Workspace (Option C) | Kept 100% private. No external account required initially; ready to push to a private GitHub repo whenever desired. |
| **Sharing / Hosting** | Static Client-Side Build | 100% client-side game in Chrome. Exports to static files (`index.html` + bundle) deployable directly to itch.io (secret link/password) or GitHub Pages. |
| **Engine Choice** | **Phaser 3 + TypeScript (Vite)** | Hardware-accelerated 2D/2.5D WebGL engine. Delivers instant load times, native Y-depth sorting (walking in front of / behind tree roots), camera follow, flight altitude scaling, and rich audio handling. |
| **Canvas Viewport** | 1280 × 720 (16:9) | Auto-scales crisply with letterboxing to match any browser window. |

---

## 3. Visual & Art Direction (*Winter Burrow* Aesthetic)

* **Illustrative Style**: Hand-drawn dark ink outlines with detailed cross-hatching and warm, earthy watercolor washes (golden ochre, moss green, russet, and warm bark browns).
* **Scale Contrast**: Tiny acorn scale vs. giant forest environment (towering oak roots, giant mushrooms, huge clover leaves, tall reeds).
* **Character Designs**:
  * **Acorn Protagonist**: Knobby acorn cap, branching twig antlers, twig arms/legs, and a cozy wrapped raffia/fiber scarf.
  * **Maple Leaf (Chipping Sparrow)**: Realistic proportions (approx. 2× acorn height), chestnut/rufous crown cap, crisp white eyebrow stripe, brown-streaked wings, and soft grey-white breast.
* **Concept Art Reference**: Saved in `assets/concept_art.jpg`.

---

## 4. Controls & Input Mapping

| Action | Key / Input | Behavior |
| :--- | :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` | Smooth 8-directional movement with walking animation and leaf dust particles. |
| **Interact / Gather** | `E` | Dynamic prompt appears when near resources (berries, seeds, sticks, leaves) or structures. |
| **Summon Companion** | `C` | Maple Leaf takes flight from the clearing, flies across the screen, and lands beside the player. |
| **Mount & Fly** | `Spacebar` | • When close to Maple Leaf: Mount onto her back.<br>• While mounted: Press `Space` once to take off; press `Space` again to land.<br>• Flight lifts the sprite into the air while the shadow stays on the ground; travel speed increases. |
| **Hotbar Selection** | `1`, `2`, `3`, `4`, `5` | Directly select active item slots on the bottom hotbar. |
| **Bag Menu** | `Tab` / `I` / Click | Expands full 10-slot bag (stack size: 30 items per slot). |

---

## 5. Dual HUD & Interface

* **Top-Left (Acorn Status)**:
  * Health Bar (Red): Depleted by starvation, extreme winter cold, or squirrel attacks.
  * Hunger / Energy Bar (Gold/Orange): Slowly drains over time; restored by eating harvested berries.
* **Top-Right (Maple Leaf Status)**:
  * Companion Health Bar (Red): Displays Maple Leaf's physical state.
  * Companion Energy Bar (Amber): Restored by feeding her collected grass seeds.
* **Bottom Screen**:
  * 5-slot parchment hotbar with slot numbers (`1`–`5`) and stack counters.
* **Opening Prologue**:
  * Story sequence with animated panels, ambient wind/rain, and narrative text scrolling along the bottom, with a `Space` button to skip directly to gameplay.

---

## 6. Seasonal Progression Roadmap

### Chapter 1: Autumn (Phase 1 Scope)
* **Pacing**: Peaceful, cozy settlement founding. **No squirrels** (they are hibernating).
* **Objectives**:
  1. Forage berries (for you) and seeds (for Maple Leaf).
  2. Collect building materials: **2 Leaves + 3 Sticks**.
  3. Craft and place your first **Leaf-and-Stick Tent** in the forest clearing.

### Chapter 2: Winter
* **Mechanics**: Freezing snow causes gradual health drain unless warm clothes are crafted.
* **Food Scarcity**: Natural food sources diminish; reliance on autumn reserves.
* **Housing Upgrade**: Expand beyond the tent into a sturdy, insulated house:
  * *Option A*: Hollow out a dwelling inside the giant ancient oak tree base.
  * *Option B*: Construct a freestanding wooden lodge in the open clearing.

### Chapter 3: Spring & Summer
* **Threats**: Squirrels awaken from hibernation and actively hunt for food and acorns.
* **Combat & Defense**: Crafting weapons (axes, shovels, swords) and fortifying the settlement perimeter.
* **Fauna**: Friendly mice arrive to forage; can be tamed by feeding and petting them to stay year-round.

---

## 7. Next Steps: Scaffolding Phase 1

1. Initialize project files with `vite`, `typescript`, and `phaser`.
2. Configure local Git repository.
3. Build the core asset manifest (high-res illustrated character & environment sprites).
4. Implement the scene pipeline:
   * `BootScene`: Asset and font preloading.
   * `PrologueScene`: Story cinematic with bottom text ticker.
   * `ClearingScene`: 2.5D clearing with Y-sorting, WASD controls, E-gathering, C-summoning Maple Leaf, and Spacebar flight toggle.
   * `CraftingSystem`: Leaf-and-stick tent crafting and placement.
