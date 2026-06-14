// Overworld kernel: 16px grid maps + 7 verbs (per pilot-exit-decisions §3).
// Graybox format — flat-color tileset and a 1-char-per-tile grid for now.
// A future Tiled JSON loader can target the same MapData type.

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface TileDef {
  readonly color: string;
  readonly solid: boolean;
  readonly label?: string;
}

export interface Spawn {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

// Map-level prefab placement: stamp the named prefab so its anchor cell
// lands on (x, y). Per-cell solidity from the prefab overrides the
// tileset's `solid` flag (lets a roof have a walkable door cutout).
export interface PrefabPlacement {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export type ScriptCommand =
  | { readonly kind: 'dialog'; readonly lines: readonly string[] }
  | { readonly kind: 'warp'; readonly target: string }
  | { readonly kind: 'start-battle'; readonly species: string }
  | { readonly kind: 'set-flag'; readonly flag: string }
  | { readonly kind: 'move-player'; readonly dx: number; readonly dy: number }
  | {
      readonly kind: 'start-trainer-battle';
      // Single string (back-compat) OR a roster array — the trainer
      // sends out the first surviving mon, then forced-switch handles
      // the rest. Maps written before S6 keep working as-is.
      readonly foeSpecies: string | readonly string[];
      readonly winFlag: string;
    }
  | { readonly kind: 'start-boss-battle'; readonly bossId: string }
  | { readonly kind: 'if-flag'; readonly flag: string; readonly commands: readonly ScriptCommand[] }
  // Phase 3: launches the starter-pick scene (same pattern as the
  // boss/trainer battle launchers). On pick, the scene's onResolve
  // writes the chosen species into run.party and sets the player_has_starter
  // + starter_<name> flags.
  | { readonly kind: 'show-starter-pick' }
  // Phase 5a: Pokémon Center heal. Restores every party member to
  // full HP/ST, clears exhausted/staggered/momentum. The verb is a
  // game-layer call (main.ts mutates run.party + autosaves); the
  // engine doesn't see it.
  | { readonly kind: 'heal-party' };

export type MapObject =
  | { readonly type: 'warp'; readonly x: number; readonly y: number; readonly target: string }
  | { readonly type: 'sign'; readonly x: number; readonly y: number; readonly lines: readonly string[] }
  | {
      readonly type: 'encounter_zone';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly species: readonly string[];
      readonly rate: number;
    }
  | {
      readonly type: 'script';
      readonly x: number;
      readonly y: number;
      readonly trigger: 'step-on' | 'auto';
      readonly commands: readonly ScriptCommand[];
      readonly flag?: string;
      readonly once?: boolean;
      // Phase 3: skip-fire when this flag is NOT set. Used by
      // post-event triggers (e.g., KAMON theft requires player has a
      // starter first) so a player who wanders out early doesn't burn
      // the `flag`+`once` marker on a no-op.
      readonly requiresFlag?: string;
    }
  | {
      readonly type: 'npc';
      readonly x: number;
      readonly y: number;
      readonly color?: string;
      readonly blockedUntilFlag?: string;
      readonly interact: readonly ScriptCommand[];
      readonly interactAfterFlag?: readonly ScriptCommand[];
    }
  | {
      readonly type: 'gust_pulse';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly periodSec: number;
      readonly activeSec: number;
      readonly phaseSec?: number;
      readonly pushDir: Facing;
    };

export interface MapData {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesize: number;
  // Legacy graybox: single char per tile + inline tileset (flat colors).
  readonly tiles: string;
  readonly tileset: { readonly [key: string]: TileDef };
  readonly objects: readonly MapObject[];
  readonly spawns: { readonly [id: string]: Spawn };
  // Data-driven format hook. When `cells` is set, the renderer uses
  // `tilesetRef` (resolved via the tileset registry) instead of the
  // legacy flat-color tileset; `tiles` is then unused. `solidOverrides`
  // captures per-cell collision from stamped prefabs (a door cell in a
  // mostly-solid roof prefab, etc.). Both stay optional so legacy maps
  // load unchanged.
  readonly cells?: ReadonlyArray<ReadonlyArray<string>>;
  readonly solidOverrides?: ReadonlyArray<ReadonlyArray<boolean | null>>;
  readonly tilesetRef?: string;
}

export function tileAt(map: MapData, x: number, y: number): TileDef | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  // Data-driven path: cells hold full tile-ids; the loader synthesizes
  // a flat-color tileset keyed by id so this lookup still resolves a
  // TileDef (color used as fallback when the pixel cache is absent).
  if (map.cells !== undefined) {
    const id = map.cells[y]?.[x];
    if (id === undefined) return null;
    return map.tileset[id] ?? null;
  }
  const row = map.tiles.split('\n')[y];
  if (!row) return null;
  const ch = row[x];
  if (!ch) return null;
  return map.tileset[ch] ?? null;
}

export function isWalkable(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  // Data-driven path: prefab solidOverrides take priority over the
  // tileset's own `solid` flag (so a roof prefab can carve a walkable
  // door cell into an otherwise-solid silhouette).
  if (map.solidOverrides !== undefined) {
    const override = map.solidOverrides[y]?.[x];
    if (override !== null && override !== undefined) return !override;
  }
  const tile = tileAt(map, x, y);
  if (!tile) return false;
  return !tile.solid;
}

export function findObjectAt(
  map: MapData,
  x: number,
  y: number,
  type: MapObject['type'],
): MapObject | null {
  for (const obj of map.objects) {
    if (obj.type !== type) continue;
    if (obj.type === 'encounter_zone') {
      if (x >= obj.x && x < obj.x + obj.width && y >= obj.y && y < obj.y + obj.height) {
        return obj;
      }
    } else {
      if (obj.x === x && obj.y === y) return obj;
    }
  }
  return null;
}

export function parseTarget(target: string): { readonly map: string; readonly spawn: string } {
  const [map, spawn] = target.split(':');
  if (!map || !spawn) throw new Error(`Argent overworld: bad target "${target}" (expected "map:spawn")`);
  return { map, spawn };
}
