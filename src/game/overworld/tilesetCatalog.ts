// Registries of decoded Tilesets and Prefabs. Keep this thin — it's a
// lookup; the actual decode lives in tileset.ts. Maps reference assets
// by name (e.g., tilesetRef: "outdoor_violet"), the loader pulls them
// from here. Drop a new tileset JSON + a register() call in maps.ts
// to ship a new area look; no code edits anywhere else.

import type { Prefab, Tileset } from './tileset';
import { loadPrefab, loadTileset } from './tileset';
import type { PrefabJson, TilesetJson } from './tileset';

const TILESETS: { [name: string]: Tileset } = {};
const PREFABS: { [name: string]: Prefab } = {};

export function registerTileset(json: TilesetJson): Tileset {
  const ts = loadTileset(json);
  TILESETS[ts.name] = ts;
  return ts;
}

export function registerPrefab(json: PrefabJson): Prefab {
  const p = loadPrefab(json);
  PREFABS[p.name] = p;
  return p;
}

export function getTileset(name: string): Tileset {
  const ts = TILESETS[name];
  if (!ts) throw new Error(`Argent tileset: unknown "${name}" (registered: ${Object.keys(TILESETS).join(', ') || 'none'})`);
  return ts;
}

export function getPrefab(name: string): Prefab {
  const p = PREFABS[name];
  if (!p) throw new Error(`Argent prefab: unknown "${name}" (registered: ${Object.keys(PREFABS).join(', ') || 'none'})`);
  return p;
}

export function hasTileset(name: string): boolean {
  return TILESETS[name] !== undefined;
}

// Test/debug only — clears registries so unit tests can start cleanly.
export function _resetCatalogs(): void {
  for (const k of Object.keys(TILESETS)) delete TILESETS[k];
  for (const k of Object.keys(PREFABS)) delete PREFABS[k];
}
