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
