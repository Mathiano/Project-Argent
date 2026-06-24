// Map registry. Registers all asset JSONs (tilesets, prefabs, maps) at
// module load and exposes getMap(name) → runtime MapData.
//
// ?graybox=1 in the URL forces the legacy graybox maps over the
// re-skinned data-driven versions — useful when comparing the design
// pass against the original layout, or when art is broken.

import labData from '../maps/lab.json';
import houseData from '../maps/house.json';
import kamonHouseData from '../maps/kamon_house.json';
import bedroomData from '../maps/bedroom.json';
import hearthwickData from '../maps/hearthwick.json';
import hearthwickCenterData from '../maps/hearthwick_center.json';
import hearthwickMartData from '../maps/hearthwick_mart.json';
import route31Data from '../maps/route31.json';
import violetData from '../maps/violet.json';
import violetCenterData from '../maps/violet_center.json';
import violetMartData from '../maps/violet_mart.json';
import violetAcademyData from '../maps/violet_academy.json';
import gymData from '../maps/gym.json';
import route31VioletData from '../maps/route31.violet.json';
import route32Data from '../maps/route32.json';
import outdoorVioletTileset from '../../../assets/tilesets/outdoor_violet.tileset.json';
// Registry asset — authored in Argent Studio, resolved by name (manifest.json).
// Proof-of-integration: a Hearthwick grass patch references a tile from this sheet.
import heartwickGrassTileset from '../../../assets/tilesets/heartwick_grass_test.tileset.json';
import houseVioletPrefab from '../../../assets/prefabs/house_violet.prefab.json';
import gymVioletPrefab from '../../../assets/prefabs/gym_violet.prefab.json';
import treeBigPrefab from '../../../assets/prefabs/tree_big.prefab.json';
import { loadMap } from './mapLoader';
import type { GrayboxMapJson, DataDrivenMapJson } from './mapLoader';
import { registerPrefab, registerTileset } from './tilesetCatalog';
import type { PrefabJson, TilesetJson } from './tileset';
import type { MapData } from './types';

// Register tilesets + prefabs first so map loaders can resolve refs.
registerTileset(outdoorVioletTileset as TilesetJson);
registerTileset(heartwickGrassTileset as TilesetJson);
registerPrefab(houseVioletPrefab as PrefabJson);
registerPrefab(gymVioletPrefab as PrefabJson);
registerPrefab(treeBigPrefab as PrefabJson);

function isGrayboxForced(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('graybox');
}

function chooseRoute31(): MapData {
  if (isGrayboxForced()) return loadMap(route31Data as GrayboxMapJson);
  return loadMap(route31VioletData as DataDrivenMapJson);
}

const REGISTRY: { [name: string]: () => MapData } = {
  BEDROOM: () => loadMap(bedroomData as GrayboxMapJson),
  HOUSE: () => loadMap(houseData as GrayboxMapJson),
  KAMON_HOUSE: () => loadMap(kamonHouseData as GrayboxMapJson),
  HEARTHWICK: () => loadMap(hearthwickData as GrayboxMapJson),
  HEARTHWICK_CENTER: () => loadMap(hearthwickCenterData as GrayboxMapJson),
  HEARTHWICK_MART: () => loadMap(hearthwickMartData as GrayboxMapJson),
  LAB: () => loadMap(labData as GrayboxMapJson),
  ROUTE31: chooseRoute31,
  // Phase 7: Violet is now data-driven (plaster city). Its Center + Mart
  // are real enterable interiors (graybox, like Hearthwick's pair).
  VIOLET: () => loadMap(violetData as DataDrivenMapJson),
  VIOLET_CENTER: () => loadMap(violetCenterData as GrayboxMapJson),
  VIOLET_MART: () => loadMap(violetMartData as GrayboxMapJson),
  // Phase 7 (violet-city-design.md): the Academy core — an enterable stub.
  VIOLET_ACADEMY: () => loadMap(violetAcademyData as GrayboxMapJson),
  GYM: () => loadMap(gymData as GrayboxMapJson),
  // Phase 7 — the Route 32 boundary stub (opened by beating KAMON at the
  // Violet south gate). End-of-chapter; Route 32 proper is later content.
  ROUTE32: () => loadMap(route32Data as GrayboxMapJson),
};

// Each call rebuilds from the JSON so any in-place editing during dev
// surfaces immediately. Cheap — graybox is just object spread, the
// data-driven path stamps prefabs (few hundred cells).
export function getMap(name: string): MapData {
  const loader = REGISTRY[name];
  if (!loader) throw new Error(`Argent overworld: unknown map "${name}"`);
  return loader();
}

export function listMaps(): readonly string[] {
  return Object.keys(REGISTRY);
}
