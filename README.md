# Acorn Crossing — Phase 1 Scaffolding

Hand-drawn *Winter Burrow*-inspired pen-and-ink & watercolor woodland survival game built in TypeScript (`1280 × 720` 16:9 letterboxed viewport).

## Quick Commands
- `npm run dev` — Starts the TypeScript dev server on `http://localhost:3000`
- `npm run build` — Exports a 100% static client-side bundle into `./dist` (ready for itch.io or GitHub Pages)

## Controls (per `GAME_DESIGN_SPEC.md`)
- `W`, `A`, `S`, `D` — 8-directional movement with walking bounce & leaf-dust particles
- `E` — Gather nearby resources (berries, golden grass seeds, oak leaves, sticks) or pitch/rest in your **Leaf-and-Stick Tent**
- `C` — Summon **Maple Leaf** (swoops across the clearing to land beside you) or dismount when landed
- `Spacebar` — Mount Maple Leaf when close; press `Space` once to take off into flight, press `Space` again to land (`Space` also skips the opening Prologue)
- `1`–`5` — Select bottom parchment hotbar slot
- `Tab` / `I` — Open the 10-slot Explorer Satchel (30 stack size) & Woodland Crafting spread (2 Leaves + 3 Sticks → Leaf-and-Stick Tent)
- `R` / `F` — Quick-eat Woodland Berries (`R`) or feed Golden Grass Seeds to Maple Leaf (`F`)
- `M` — Open/fold the hero's **paper-collage map** (`Esc` also closes it; the woods pause while it's open)

## The Expanded Woods (slides 7 & 8)
The world is a 3×3 grid of hand-painted zones (`src/world/WorldLayout.ts`), with the Home clearing in the centre:

| | West | Centre | East |
|---|---|---|---|
| **North** | Pinecone Lake | Meadow | Sweetpea's Traveling Post |
| **Middle** | Pine meadow | **Home clearing** | Meadow |
| **South** | Claud's Rubber Boot | Pine meadow | Meadow |

- **Fog of war** (`src/systems/FogOfWar.ts`): drifting parchment mist covers unexplored woods. Walking lifts it nearby; flying on Maple Leaf lifts it much further.
- **Collage map** (`src/ui/CollageMap.ts`): dark kraft paper with taped pine cutouts, landmark cutouts, handwritten labels and a brass compass. Unexplored areas are covered by tan paper marked with "?".
- **Claud**: an acorn adventurer who lives in a rubber boot. Press `E` to chat.
- **Sweetpea**: a travelling acorn merchant who does *not* arrive until later in the game. Until then her post is just wagon ruts and a signpost. To preview her early, add `?sweetpea=1` to the URL; in code, call `ClearingScene.arriveSweetpea()`.
- Every zone has extra forage spots (berries, seeds, leaves, sticks). They are placed by a fixed seed, so the layout is the same every session.
