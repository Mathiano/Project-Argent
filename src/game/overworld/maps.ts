// Map registry. Registers all asset JSONs (tilesets, prefabs, maps) at
// module load and exposes getMap(name) → runtime MapData.
//
// ROUTE31 is the Tiled-built map (Phase-4 capstone — buildRoute31; the old
// route31.json / route31.violet.json were retired). Other maps stay JSON.

import labData from '../maps/lab.json';
import houseData from '../maps/house.json';
import kamonHouseData from '../maps/kamon_house.json';
import bedroomData from '../maps/bedroom.json';
import violetData from '../maps/violet.json';
import violetAcademyData from '../maps/violet_academy.json';
import gymData from '../maps/gym.json';
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
import pctBushTileset from '../../../assets/tilesets/pct_bush.tileset.json';
import pctWatersheetTileset from '../../../assets/tilesets/pct_watersheet.tileset.json';
import pctFencesTileset from '../../../assets/tilesets/pct_fences.tileset.json';
import pctBuildingsTileset from '../../../assets/tilesets/pct_buildings.tileset.json';
import pctDecorTileset from '../../../assets/tilesets/pct_decor.tileset.json';
import pctFlowersTileset from '../../../assets/tilesets/pct_flowers.tileset.json';
import pctVerifyData from '../maps/pct_verify.json';
import testMapTmj from '../maps/tiled/test-map.tmj.json';
import kitchenSinkTmj from '../maps/tiled/test-map-kitchen-sink.tmj.json';
import route31BigTmj from '../maps/tiled/test-map-kitchen-sink-big.tmj.json';
// HEARTHWICK is now Mathias's authored Tiled town (replaces the graybox hearthwick.json).
import hearthwickTmj from '../maps/tiled/hearthwick.tmj.json';
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
import type { MapData, MapObject, Spawn } from './types';

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
registerTileset(pctBushTileset as TilesetJson);
registerTileset(pctWatersheetTileset as TilesetJson);
registerTileset(pctFencesTileset as TilesetJson);
registerTileset(pctBuildingsTileset as TilesetJson);
registerTileset(pctDecorTileset as TilesetJson);
registerTileset(pctFlowersTileset as TilesetJson);
registerPrefab(houseVioletPrefab as PrefabJson);
registerPrefab(gymVioletPrefab as PrefabJson);
registerPrefab(treeBigPrefab as PrefabJson);


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
  // HEARTHWICK is Mathias's authored Tiled town (buildHearthwick), replacing the
  // retired graybox hearthwick.json.
  HEARTHWICK: buildHearthwick,
  // Interiors are GENERATED from data (interiorGen.ts), not hand-authored JSON.
  // Hearthwick uses the defaults (its text IS the default); a new town's pair is two
  // lines: makeCenter('NEWTOWN') + makeMart('NEWTOWN', [...stock]).
  HEARTHWICK_CENTER: () => loadMap(makeCenter('HEARTHWICK')),
  HEARTHWICK_MART: () => loadMap(makeMart('HEARTHWICK', ['BALL', 'POTION', 'SUPER POTION', 'FULL HEAL'])),
  LAB: () => loadMap(labData as GrayboxMapJson),
  // Phase-4 capstone: Route 31 IS the Tiled-built map (route31.violet.json retired).
  ROUTE31: buildRoute31,
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
  // ?skip=route31-big — an alias to the now-LIVE Route 31 build (enters at the north
  // gate). Kept for the dev hook + tiledRoute31Big.test; same content as ROUTE31.
  __ROUTE31_BIG__: buildRoute31,
};

// THE LIVE Route 31 (Phase-4 capstone): import+wire the Tiled map (terrain/collision/
// water/walk-behind + 6 trainers incl. Jay + flavor + the lost-kid quest + 4 signs +
// 7 encounter zones), then inject the CODE-AUTHORED scripts (the hybrid: Tiled = where,
// code = the logic-scripts). Canonical flags throughout. This replaces the old
// route31.violet.json. See docs/tiled-importer.md / route31-migration-scope.md.
function buildRoute31(): MapData {
  const map = importAndWire(route31BigTmj, 'ROUTE 31');
  // NOTE: the guided-catch tutorial is NOT a grass step-on script anymore — it fires
  // on the player's FIRST WILD ENCOUNTER (main.ts onEncounter + shouldFireGuidedCatch),
  // so it teaches catching with an actual mon present, not in a vacuum
  // (docs/guided-catch-redesign-note.md). The §1 grass step trigger was removed.
  const scripts: MapObject[] = [
    // Two discoverable off-path items (one-time give-item step-ons, the live pattern).
    {
      type: 'script', x: 7, y: 32, trigger: 'step-on', once: true, flag: 'route31_item_forest',
      commands: [
        { kind: 'give-item', itemId: 'POTION', qty: 1 },
        { kind: 'dialog', lines: ['Tucked in the roots — a POTION,', 'left for whoever needed it.'] },
      ],
    },
    {
      type: 'script', x: 12, y: 64, trigger: 'step-on', once: true, flag: 'route31_item_pond',
      commands: [
        { kind: 'give-item', itemId: 'BALL', qty: 2 },
        { kind: 'dialog', lines: ["Two BALLs by the water's edge,", 'a quiet kindness for the road.'] },
      ],
    },
    // The lost-kid reunion reward: returning to the kid after finding PIP gives a
    // SUPER POTION, once (canonical flags route31_lost_mon_found/reunited).
    {
      type: 'script', x: 15, y: 21, trigger: 'step-on',
      requiresFlag: 'route31_lost_mon_found', once: true, flag: 'route31_lost_mon_reunited',
      commands: [
        { kind: 'dialog', lines: ['KID: Mum keeps these for the rough', 'days. You gave PIP back one of his.', 'Take it. Please.'] },
        { kind: 'give-item', itemId: 'SUPER POTION', qty: 1 },
      ],
    },
  ];
  return { ...map, objects: [...map.objects, ...scripts] };
}

// THE LIVE Hearthwick (Mathias's authored 40×36 Tiled town): import+wire the .tmj
// (terrain/collision/props/overhead + 5 building doors + 2 signs + 4 NPCs + the
// Route 31 edge exit), then inject the CODE-AUTHORED return-landing spawns — one per
// warp INTO town — so the round-trips close (same hybrid as buildRoute31: Tiled =
// where, code = the glue). Each spawn sits one tile off its door (walkable; the
// building sits above the door), keyed to the tmj's warp markers. The interiors
// (HOUSE/KAMON_HOUSE/LAB + the generated CENTER/MART) all return to HEARTHWICK:from<X>;
// ROUTE 31 returns to :fromRoute. (warp_to_north is future content — intentionally
// unwired; the forest-ranger NPC is the "north is overgrown" stub.)
function buildHearthwick(): MapData {
  const map = importAndWire(hearthwickTmj, 'HEARTHWICK');
  const spawns: { [id: string]: Spawn } = {
    ...map.spawns,
    fromHouse: { x: 7, y: 14, facing: 'down' }, // warp_player_home @7,13
    fromKamonHouse: { x: 16, y: 14, facing: 'down' }, // warp_kamon_house @16,13
    fromLab: { x: 27, y: 17, facing: 'down' }, // warp_professor_laboratory @27,16
    fromCenter: { x: 8, y: 26, facing: 'down' }, // warp_pokecenter @8,25
    fromMart: { x: 28, y: 26, facing: 'down' }, // warp_pokemart @28,25
    fromRoute: { x: 18, y: 34, facing: 'up' }, // warp_to_route31 @18,35 (return from Route 31)
  };
  return { ...map, spawns };
}

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
