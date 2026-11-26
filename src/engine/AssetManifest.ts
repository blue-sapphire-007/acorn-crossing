export interface AssetDefinition {
  key: string;
  url: string;
}

export const ASSET_MANIFEST: AssetDefinition[] = [
  { key: 'clearing_bg', url: './assets/clearing_bg.jpg' },
  { key: 'prologue_storm', url: './assets/prologue_storm.jpg' },
  { key: 'concept_art', url: './assets/concept_art.jpg' },
  { key: 'acorn_idle', url: './assets/acorn_idle.png' },
  { key: 'sparrow_ground', url: './assets/sparrow_ground.png' },
  { key: 'mounted_flight', url: './assets/mounted_flight.png' },
  { key: 'leaf_tent', url: './assets/leaf_tent.png' },
  { key: 'berry_bush', url: './assets/berry_bush.png' },
  { key: 'seed_grass', url: './assets/seed_grass.png' },
  { key: 'fallen_stick', url: './assets/fallen_stick.png' },
  { key: 'oak_leaf', url: './assets/oak_leaf.png' },
  { key: 'mushroom_log', url: './assets/mushroom_log.png' },
  { key: 'forest_fern', url: './assets/forest_fern.png' },

  // Expanded world zones (3x3 grid around the home clearing)
  { key: 'zone_lake', url: './assets/zone_lake.jpg' },
  { key: 'zone_boot', url: './assets/zone_boot.jpg' },
  { key: 'zone_post', url: './assets/zone_post.jpg' },
  { key: 'zone_meadow_a', url: './assets/zone_meadow_a.jpg' },
  { key: 'zone_meadow_b', url: './assets/zone_meadow_b.jpg' },

  // Paper-collage map overlay
  { key: 'map_kraft', url: './assets/map_kraft.jpg' },
  { key: 'map_tree', url: './assets/map_tree.png' },
  { key: 'map_home', url: './assets/map_home.png' },
  { key: 'map_boot', url: './assets/map_boot.png' },
  { key: 'map_wagon', url: './assets/map_wagon.png' },
  { key: 'map_compass', url: './assets/map_compass.png' },
  { key: 'map_lake', url: './assets/map_lake.png' },

  // Fellow acorn adventurers
  { key: 'npc_claud', url: './assets/npc_claud.png' },
  { key: 'npc_sweetpea', url: './assets/npc_sweetpea.png' },
  { key: 'sweetpea_wagon', url: './assets/sweetpea_wagon.png' },
  { key: 'post_sign', url: './assets/post_sign.png' }
];
