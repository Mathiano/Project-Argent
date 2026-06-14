// Map registry. Registers all asset JSONs (tilesets, prefabs, maps) at
// module load and exposes getMap(name) → runtime MapData.
//
// ?graybox=1 in the URL forces the legacy graybox maps over the
// re-skinned data-driven versions — useful when comparing the design
// pass against the original layout, or when art is broken.

import labData from '../maps/lab.json';
import houseData from '../maps/house.json';
import bedroomData from '../maps/bedroom.json';
import hearthwickData from '../maps/hearthwick.json';
import hearthwickCenterData from '../maps/hearthwick_center.json';
import hearthwickMartData from '../maps/hearthwick_mart.json';
import route31Data from '../maps/route31.json';
import gymData from '../maps/gym.json';
import route31VioletData from '../maps/route31.violet.json';
import outdoorVioletTileset from '../../../assets/tilesets/outdoor_violet.tileset.json';
import houseVioletPrefab from '../../../assets/prefabs/house_violet.prefab.json';
import gymVioletPrefab from '../../../assets/prefabs/gym_violet.prefab.json';
import { loadMap } from './mapLoader';
import type { GrayboxMapJson, DataDrivenMapJson } from './mapLoader';
import { registerPrefab, registerTileset } from './tilesetCatalog';
import type { PrefabJson, TilesetJson } from './tileset';
import type { MapData } from './types';

// Register tilesets + prefabs first so map loaders can resolve refs.
registerTileset(outdoorVioletTileset as TilesetJson);
registerPrefab(houseVioletPrefab as PrefabJson);
registerPrefab(gymVioletPrefab as PrefabJson);

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
  HEARTHWICK: () => loadMap(hearthwickData as GrayboxMapJson),
  HEARTHWICK_CENTER: () => loadMap(hearthwickCenterData as GrayboxMapJson),
  HEARTHWICK_MART: () => loadMap(hearthwickMartData as GrayboxMapJson),
  LAB: () => loadMap(labData as GrayboxMapJson),
  ROUTE31: chooseRoute31,
  GYM: () => loadMap(gymData as GrayboxMapJson),
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
