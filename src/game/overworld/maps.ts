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
import route31Data from '../maps/route31.json';
import violetData from '../maps/violet.json';
import violetAcademyData from '../maps/violet_academy.json';
import gymData from '../maps/gym.json';
import route31VioletData from '../maps/route31.violet.json';
import route32Data from '../maps/route32.json';
import outdoorVioletTileset from '../../../assets/tilesets/outdoor_violet.tileset.json';
// Registry asset — authored in Argent Studio, resolved by name (manifest.json).
// Proof-of-integration: a Hearthwick grass patch references a tile from this sheet.
import heartwickGrassTileset from '../../../assets/tilesets/heartwick_grass_test.tileset.json';
// PCT pipeline-verification (dev-only) — the re-seeded pack tiles + a tiny fixture
// map (__PCT_VERIFY__) that opts into them via tileRef, so the PRODUCTION renderer
// can be exercised on them (?skip=pct-prod, pctProdRender.test.ts). Not shipping
// content; reachable only via the dev hook/test. See docs/pct-pipeline-verify.md.
import pctGrassTileset from '../../../assets/tilesets/pct_grass.tileset.json';
import pctPathTileset from '../../../assets/tilesets/pct_path.tileset.json';
import pctWaterTileset from '../../../assets/tilesets/pct_water.tileset.json';
import pctTreesTileset from '../../../assets/tilesets/pct_trees.tileset.json';
// Phase-8 Tiled importer: the sheets the test map paints with + the importer + a
// snapshot of Mathias's export (?skip=tiled-test). See docs/tiled-importer.md.
import pctPath02Tileset from '../../../assets/tilesets/pct_path02.tileset.json';
import pctHillsTileset from '../../../assets/tilesets/pct_hills.tileset.json';
import pctBushanimTileset from '../../../assets/tilesets/pct_bushanim.tileset.json';
import pctVerifyData from '../maps/pct_verify.json';
import testMapTmj from '../maps/tiled/test-map.tmj.json';
import kitchenSinkTmj from '../maps/tiled/test-map-kitchen-sink.tmj.json';
import houseVioletPrefab from '../../../assets/prefabs/house_violet.prefab.json';
import gymVioletPrefab from '../../../assets/prefabs/gym_violet.prefab.json';
import treeBigPrefab from '../../../assets/prefabs/tree_big.prefab.json';
import { loadMap } from './mapLoader';
import type { GrayboxMapJson, DataDrivenMapJson } from './mapLoader';
import { importTiledMap, defaultResolveSheet } from './tiledImport';
import type { TiledMapJson } from './tiledImport';
import { wireImportedMap } from './tiledWiring';
import { makeCenter, makeMart } from './interiorGen';
import { getTileset, hasTileset, registerPrefab, registerTileset } from './tilesetCatalog';
import type { PrefabJson, TilesetJson } from './tileset';
import type { MapData } from './types';

// Register tilesets + prefabs first so map loaders can resolve refs.
registerTileset(outdoorVioletTileset as TilesetJson);
registerTileset(heartwickGrassTileset as TilesetJson);
registerTileset(pctGrassTileset as TilesetJson);
registerTileset(pctPathTileset as TilesetJson);
registerTileset(pctWaterTileset as TilesetJson);
registerTileset(pctTreesTileset as TilesetJson);
registerTileset(pctPath02Tileset as TilesetJson);
registerTileset(pctHillsTileset as TilesetJson);
registerTileset(pctBushanimTileset as TilesetJson);
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

// Phase-8: import a snapshotted Tiled export through the real importer + wiring (so
// the ?skip hooks render Mathias's painted maps via the verified production tile
// path). tileExists prunes GIDs that hit a blank/un-ingested registry cell; warnings
// surface in the console.
function importAndWire(tmj: unknown, name: string): MapData {
  const imported = importTiledMap(tmj as TiledMapJson, {
    name,
    resolveSheet: defaultResolveSheet,
    tileExists: (pct, key) => hasTileset(pct) && getTileset(pct).tiles[key] !== undefined,
  });
  for (const w of imported.warnings) console.warn(`[tiled-import:${name}] ${w}`);
  const wired = wireImportedMap(imported.map);
  for (const w of wired.warnings) console.warn(`[tiled-wiring:${name}] ${w}`);
  return wired.map;
}

const REGISTRY: { [name: string]: () => MapData } = {
  BEDROOM: () => loadMap(bedroomData as GrayboxMapJson),
  HOUSE: () => loadMap(houseData as GrayboxMapJson),
  KAMON_HOUSE: () => loadMap(kamonHouseData as GrayboxMapJson),
  HEARTHWICK: () => loadMap(hearthwickData as GrayboxMapJson),
  // Interiors are GENERATED from data (interiorGen.ts), not hand-authored JSON.
  // Hearthwick uses the defaults (its text IS the default); a new town's pair is two
  // lines: makeCenter('NEWTOWN') + makeMart('NEWTOWN', [...stock]).
  HEARTHWICK_CENTER: () => loadMap(makeCenter('HEARTHWICK')),
  HEARTHWICK_MART: () => loadMap(makeMart('HEARTHWICK', ['BALL', 'POTION', 'SUPER POTION', 'FULL HEAL'])),
  LAB: () => loadMap(labData as GrayboxMapJson),
  ROUTE31: chooseRoute31,
  // Phase 7: Violet is now data-driven (plaster city). Its Center + Mart
  // are real enterable interiors (graybox, like Hearthwick's pair).
  VIOLET: () => loadMap(violetData as DataDrivenMapJson),
  VIOLET_CENTER: () =>
    loadMap(
      makeCenter('VIOLET', {
        nurseGreeting: ['NURSE: Welcome to the', 'Violet City Center.', '', 'Rest your team before', 'you climb to the roof?'],
        nurseHealed: ['(The machine hums.)', '(A soft chime.)', '', 'NURSE: All restored.', "FALKNER won't go easy."],
        notice: ['A noticeboard.', 'VIOLET GYM — rooftop.', 'Heal before you ascend.'],
      }),
    ),
  VIOLET_MART: () =>
    loadMap(
      makeMart('VIOLET', ['BALL', 'POTION', 'SUPER POTION', 'FULL HEAL'], {
        clerkGreeting: ['CLERK: Welcome to the', 'VIOLET POKÉ MART.', '', 'Stocking up for the', 'gym climb?'],
        shelfSign: ['Shelves of supplies.', 'A few SUPER POTIONs', 'for the harder road.'],
      }),
    ),
  // Phase 7 (violet-city-design.md): the Academy core — an enterable stub.
  VIOLET_ACADEMY: () => loadMap(violetAcademyData as GrayboxMapJson),
  GYM: () => loadMap(gymData as GrayboxMapJson),
  // Phase 7 — the Route 32 boundary stub (opened by beating KAMON at the
  // Violet south gate). End-of-chapter; Route 32 proper is later content.
  ROUTE32: () => loadMap(route32Data as GrayboxMapJson),
  // DEV/VERIFICATION ONLY — pct-tile pipeline check (?skip=pct-prod). Not in play.
  __PCT_VERIFY__: () => loadMap(pctVerifyData as GrayboxMapJson),
  // DEV ONLY — Phase-8 Tiled importer demo (?skip=tiled-test). Mathias's painted
  // test map, imported live. Not in play.
  __TILED_TEST__: () => importAndWire(testMapTmj, 'TILED TEST'),
  // DEV ONLY — Phase-8 kitchen-sink (?skip=tiled-kitchen): EVERY feature at once
  // (collision + 3 NPCs incl. a trainer + 2 warps + 2 spawns + 4 encounter zones).
  __KITCHEN_SINK__: () => importAndWire(kitchenSinkTmj, 'KITCHEN SINK'),
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
