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

export type ScriptCommand =
  | { readonly kind: 'dialog'; readonly lines: readonly string[] }
  | { readonly kind: 'warp'; readonly target: string }
  | { readonly kind: 'start-battle'; readonly species: string }
  | { readonly kind: 'set-flag'; readonly flag: string }
  | { readonly kind: 'move-player'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'start-trainer-battle'; readonly foeSpecies: string; readonly winFlag: string }
  | { readonly kind: 'start-boss-battle'; readonly bossId: string }
  | { readonly kind: 'if-flag'; readonly flag: string; readonly commands: readonly ScriptCommand[] };

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
  readonly tiles: string;
  readonly tileset: { readonly [key: string]: TileDef };
  readonly objects: readonly MapObject[];
  readonly spawns: { readonly [id: string]: Spawn };
}

export function tileAt(map: MapData, x: number, y: number): TileDef | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const row = map.tiles.split('\n')[y];
  if (!row) return null;
  const ch = row[x];
  if (!ch) return null;
  return map.tileset[ch] ?? null;
}

export function isWalkable(map: MapData, x: number, y: number): boolean {
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
