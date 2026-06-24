// Overworld kernel: 16px grid maps + 7 verbs (per pilot-exit-decisions §3).
// Graybox format — flat-color tileset and a 1-char-per-tile grid for now.
// A future Tiled JSON loader can target the same MapData type.

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface TileDef {
  readonly color: string;
  readonly solid: boolean;
  readonly label?: string;
  // Registry→engine bridge (Phase-2 proof): opt a graybox cell into a real
  // authored pixel tile from the asset registry. `tileset` is a registered
  // tilesetRef (assets/tilesets/<name>.tileset.json), `tile` a tile id inside
  // it. When set, the renderer draws that tile's pixels instead of the flat
  // `color`; `color` stays as the fallback (no DOM / unregistered → flat fill,
  // never a broken tile). Tiled will lean on this same bridge.
  readonly tileRef?: { readonly tileset: string; readonly tile: string };
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

// Layered renderer (Phase 7) — a Y-sorted multi-tile prop (tree / roof / awning).
// Rendered in the depth pass interleaved with the player by `sortY` (the pixel Y
// of its base/feet row's bottom edge): a prop with sortY <= the player's draws
// FIRST (behind the player); sortY > the player's draws AFTER (occluding it — the
// player walks behind tree-tops/roofs). The prop's lower cells register collision
// (solidOverrides); its upper cells are non-solid overlays the player stands behind.
export interface PlacedProp {
  readonly cells: ReadonlyArray<{ readonly tx: number; readonly ty: number; readonly tile: string }>;
  readonly sortY: number;
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
      // Phase 5b: money awarded on a win (a per-trainer reward).
      // Optional — a trainer with no reward (or a legacy map) pays
      // nothing. Awarded in the game layer on resolve, then autosaved.
      readonly reward?: number;
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
  | { readonly kind: 'heal-party' }
  // Phase 5b: Poké Mart. Launches the shop scene with `stock` (item
  // ids for sale). Terminal in the script, same shape as
  // show-starter-pick — the shop scene owns closing back to the
  // overworld. main.ts wires onOpenMart; maps without it no-op.
  | { readonly kind: 'open-mart'; readonly stock: readonly string[] }
  // Phase 6.5: the PC Box. Launches the box scene (deposit/withdraw).
  // Terminal, same delegation shape as open-mart — the box scene owns
  // closing back to the overworld. main.ts wires onOpenBox.
  | { readonly kind: 'open-box' }
  // Phase 7: grant an item to the bag (hidden ground items, event
  // rewards). NON-terminal — the script continues (so a "Found X!" dialog
  // can follow). main.ts wires onGiveItem → bagAdd + autosave. Gate one-
  // time pickups with the script's own `once`+`flag`.
  | { readonly kind: 'give-item'; readonly itemId: string; readonly qty: number }
  // Phase 7: the scripted Catching 2.0 lesson — launch the one-time guided
  // FLITPECK catch (the Route 31 first-grass beat) with the forgiving tutorial
  // layer. TERMINAL (the battle scene takes over). main.ts wires
  // onTutorialCatch -> a battle built with `tutorial: true`. Gate it with the
  // script's own `once`+`flag` so it fires exactly once.
  | { readonly kind: 'start-tutorial-catch' }
  // Phase 7: the KAMON first-fight (the Violet→Route 32 gate). TERMINAL — fires
  // the bespoke RIVAL v2 card (counter-type stolen starter, kamon profile).
  // main.ts wires onRivalBattle -> the fight; both win and loss set
  // kamon_beaten (no soft-lock) so the gate opens either way.
  | { readonly kind: 'start-rival-battle' };

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
      // ZONE step-on (Route 31 expansion): when BOTH width and height are set,
      // the step-on trigger fires anywhere inside the [x, x+width) × [y, y+height)
      // rectangle (a single zone-entry check) instead of on the single (x,y) tile.
      // Lets one object cover a whole grass patch — the guided-catch's first-grass
      // trigger — without a script on every tile. Absent on every legacy script,
      // so single-tile behaviour is unchanged.
      readonly width?: number;
      readonly height?: number;
    }
  | {
      readonly type: 'npc';
      readonly x: number;
      readonly y: number;
      readonly color?: string;
      readonly blockedUntilFlag?: string;
      readonly interact: readonly ScriptCommand[];
      readonly interactAfterFlag?: readonly ScriptCommand[];
      // Phase 7: render this NPC as a species OVERWORLD SPRITE (the
      // type-tinted placeholder when no art is registered) instead of a
      // flat colour square — e.g. a lost mon in the grass the player must
      // SEE to find. `sprite` = species name; `spriteType` tints the
      // placeholder (the element type). Art never blocks gameplay.
      readonly sprite?: string;
      readonly spriteType?: string;
      // Trainer LINE-OF-SIGHT (F2). When `sightRange` is set, this NPC is a
      // sight-trainer: it watches straight ahead along `facing` for that many
      // tiles (blocked by solids/other NPCs). When the player steps into the
      // line, the trainer walks up and forces its `interact` battle — once
      // (the battle's winFlag, reused as blockedUntilFlag, prevents re-fight).
      // Absent on every existing NPC, so behaviour is unchanged.
      readonly facing?: Facing;
      readonly sightRange?: number;
      // FORCED ENTRY confrontation (JAY the robber — the opening bond hook).
      // When true, this trainer WALKS UP to the player the moment they enter
      // the map (if not yet beaten) and starts its `interact` — unmissable,
      // no walk-around. Used where line-of-sight can't cover open terrain.
      readonly approachOnEnter?: boolean;
      // Phase 7 — PRESENCE gating (distinct from blockedUntilFlag, which keeps
      // a non-blocking NPC on the map). These remove the NPC entirely (not
      // drawn, not solid, not interactable). `requiresFlag`: present ONLY when
      // the flag is set. `hiddenAfterFlag`: present ONLY until the flag is set.
      // Used by the Violet→Route 32 gate: a placeholder obstacle (hiddenAfter
      // the ZEPHYR flag) is REPLACED by KAMON (requires ZEPHYR, hiddenAfter
      // beaten). Both absent on every existing NPC, so behaviour is unchanged.
      readonly requiresFlag?: string;
      readonly hiddenAfterFlag?: string;
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
  // Layered renderer (Phase 7). `fringe` = the layer-1 overlay grid drawn ABOVE
  // the base cells and BELOW props/player (decals, ledges, edge decoration);
  // null = empty (transparent). `props` = layer-2 Y-sorted multi-tile structures
  // (trees/roofs) interleaved with the player for depth occlusion. Both optional
  // so every legacy + current map loads and renders exactly as before.
  readonly fringe?: ReadonlyArray<ReadonlyArray<string | null>>;
  readonly props?: readonly PlacedProp[];
  // Registry→engine bridge for the DATA-DRIVEN base layer (mirrors the graybox
  // TileDef.tileRef). Per base-tile-id render override: when a cell's tile id is a
  // key here, the renderer draws that authored tile (from a registered registry
  // tileset) instead of the base tileset's pixels. The base id still resolves
  // normally for collision/fallback. Authored at the map level so a region (or a
  // whole tile id, e.g. `grass`) can be retargeted without touching the tileset.
  readonly tileRefs?: { readonly [tileId: string]: { readonly tileset: string; readonly tile: string } };
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
