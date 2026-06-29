// Tiled marker → Argent definition WIRING layer (Phase 8, completes the loop).
//
// The importer (tiledImport.ts) carries named markers through as `importedObjects`
// (name + grid position) but does NOT author behaviour. This layer resolves those
// markers to REAL Argent definitions, emitting the engine's existing inline
// MapObjects into `map.objects` (and spawn points into `map.spawns`) — so a marker
// becomes an actual interactable NPC / a working warp via the SAME system every
// hand-authored map uses (createOverworldScene reads map.objects / map.spawns).
//
// The naming convention IS the contract (Tiled = where, CC = what, joined by name):
//   npc_<id>       → NPC_DEFS["npc_<id>"]       → an inline npc MapObject at the marker
//   warp_<id>      → WARP_DEFS["warp_<id>"]     → a warp MapObject (target "MAP:spawn")
//   sign_<id>      → SIGN_DEFS["sign_<id>"]     → a sign MapObject (lines)
//   encounter_<id> → ENCOUNTER_DEFS[...]        → an encounter_zone over the marker
//                    RECTANGLE (x/y/w/h) with the def's species + rate
//   spawn_<name>   → map.spawns["<name>"]       → a spawn point (facing from the
//                    marker's `facing` property, default down) warps can land on
//   script_<id>    → SKIPPED — scripts stay code-authored (logic, not spatial markers)
// Unknown prefix / missing definition → WARN + skip (never crash) — same robustness
// as the importer. See docs/tiled-importer.md §wiring.

import type { MapData, MapObject, Spawn } from './types';

// A definition is the inline MapObject MINUS its placement (type/x/y) — the marker
// supplies x/y, the registry supplies the behaviour.
export type NpcDef = Omit<Extract<MapObject, { type: 'npc' }>, 'type' | 'x' | 'y'>;
export type WarpDef = { readonly target: string };
export type SignDef = Omit<Extract<MapObject, { type: 'sign' }>, 'type' | 'x' | 'y'>;
// An encounter-zone def: the marker rectangle supplies x/y/w/h (where + how big),
// the def supplies the wild table (what mons) + the per-step roll rate.
export type EncounterDef = { readonly species: readonly string[]; readonly rate: number };

export interface WiringDefs {
  readonly npc: { readonly [name: string]: NpcDef };
  readonly warp: { readonly [name: string]: WarpDef };
  readonly sign?: { readonly [name: string]: SignDef };
  readonly encounter?: { readonly [name: string]: EncounterDef };
}

// CC-maintained marker definitions. Add an entry here to give a Tiled marker
// behaviour; Mathias places the matching-named marker in the map. Seeded with the
// test markers so the importer→wiring loop is demonstrably complete.
export const DEFAULT_DEFS: WiringDefs = {
  npc: {
    npc_test: {
      color: '#d22f2f',
      interact: [
        { kind: 'dialog', lines: ['A test NPC, placed in Tiled.', 'The marker wired to a real def —', 'the loop is closed.'] },
      ],
    },
  },
  warp: {
    // Trivial-but-real destination: HEARTHWICK has a "fromRoute" spawn. Stepping on
    // the warp tile transitions maps, proving the wired warp works.
    warp_test: { target: 'HEARTHWICK:fromRoute' },
  },
  encounter: {
    // A small test wild zone (the marker rectangle decides where/how big).
    encounter_test: { species: ['FLITPECK'], rate: 0.18 },
  },
};

export interface WireResult {
  readonly map: MapData;
  readonly warnings: readonly string[];
}

// Resolve an imported map's markers into real MapObjects / spawns. Returns a NEW
// MapData with `objects`/`spawns` populated and `importedObjects` consumed (removed
// so the placeholder markers no longer render — the real objects do). Unresolved
// markers are warned + dropped.
export function wireImportedMap(map: MapData, defs: WiringDefs = DEFAULT_DEFS): WireResult {
  const warnings: string[] = [];
  const objects: MapObject[] = [...map.objects];
  const spawns: { [id: string]: Spawn } = { ...map.spawns };

  for (const m of map.importedObjects ?? []) {
    const prefix = m.name.split('_')[0];
    if (prefix === 'npc') {
      const def = defs.npc[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no NPC definition (add it to NPC_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'npc', x: m.x, y: m.y, ...def });
    } else if (prefix === 'warp') {
      const def = defs.warp[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no WARP definition (add it to WARP_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'warp', x: m.x, y: m.y, target: def.target });
    } else if (prefix === 'sign') {
      const def = defs.sign?.[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no SIGN definition (add it to SIGN_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'sign', x: m.x, y: m.y, ...def });
    } else if (prefix === 'encounter') {
      const def = defs.encounter?.[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no ENCOUNTER definition (add it to ENCOUNTER_DEFS) — skipped.`);
        continue;
      }
      objects.push({
        type: 'encounter_zone',
        x: m.x, y: m.y, width: m.w, height: m.h,
        species: def.species, rate: def.rate,
      });
    } else if (prefix === 'spawn') {
      const spawnName = m.name.slice('spawn_'.length);
      if (!spawnName) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) — a spawn marker needs a name (spawn_<name>) — skipped.`);
        continue;
      }
      // Facing from the marker's `facing` custom property (e.g. a south gate that
      // should face up); defaults to 'down' when unset.
      spawns[spawnName] = { x: m.x, y: m.y, facing: m.facing ?? 'down' };
    } else if (prefix === 'script') {
      // HYBRID DECISION: scripts (give-item, set-flag, quest chains, tutorial-catch)
      // stay CODE-AUTHORED — they're logic, not spatial markers. Not wired from Tiled.
      warnings.push(`marker "${m.name}" at (${m.x},${m.y}) — scripts are code-authored, not Tiled markers — skipped.`);
    } else {
      warnings.push(`marker "${m.name}" at (${m.x},${m.y}) — unknown prefix (expected npc_/warp_/sign_/spawn_/encounter_) — skipped.`);
    }
  }

  // Drop the now-resolved placeholder markers; keep the imported tile layers.
  const { importedObjects: _consumed, ...rest } = map;
  void _consumed;
  return { map: { ...rest, objects, spawns }, warnings };
}
