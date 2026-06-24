// Town-interior generator — Pokémon Centers + Poké Marts from DATA, not hand-cloned
// JSON. The template-readiness audit flagged copy-pasted interiors as the #1
// area-stamping speed-killer: every town hand-authored a near-identical
// <TOWN>_CENTER / <TOWN>_MART file. These functions generalize the proven
// HEARTHWICK_/VIOLET_ interiors so a new town's pair is two calls:
//   makeCenter('NEWTOWN')                 + makeMart('NEWTOWN', [...stock])
//
// The heal-party / open-box / open-mart verbs are the existing GENERIC ones — the
// generator only assembles the interior around them. Returns GrayboxMapJson, loaded
// through the same loadMap() path as a hand-authored file (no new render/loader work).
//
// BAKED-IN (constant across towns): the 10×8 layout skeleton, the counter, the door,
// the entry spawn, the per-building tileset palette (Center warm, Mart blue), the
// heal machine + nurse, the storage PC + box, the shopkeeper. PARAMETERIZED (varies
// per town): the town id (→ map name, return-warp target, entry-spawn key), the
// Mart's stock, and optional dialogue/sign flavor (defaults reproduce HEARTHWICK).

import type { GrayboxMapJson } from './mapLoader';
import type { Facing, MapObject, Spawn, TileDef } from './types';

// Shared skeleton: walls, a 4-wide counter at (2..5, y2), a south door at (4,7).
const TILES = 'WWWWWWWWWW\nW........W\nW.CCCC...W\nW........W\nW........W\nW........W\nW........W\nWWWWdWWWWW';
const DOOR = { x: 4, y: 7 };
const ENTRY: Spawn = { x: 4, y: 6, facing: 'up' as Facing }; // stand just inside the door
const DESK = { x: 2, y: 2 }; // the attendant, behind the counter
const SIGN = { x: 7, y: 2 }; // noticeboard / shelf
const PC = { x: 8, y: 2 }; // Center only — the storage terminal

// The spawn key the OUTDOOR map warps to, e.g. HEARTHWICK → 'fromHearthwick'. Must
// match the parent town's existing warp target (the interiors are migrated, not the
// outdoor maps), so this is derived, not invented.
function entrySpawnKey(townId: string): string {
  return 'from' + townId[0]!.toUpperCase() + townId.slice(1).toLowerCase();
}

export interface CenterOpts {
  readonly nurseGreeting?: readonly string[];
  readonly nurseHealed?: readonly string[];
  readonly notice?: readonly string[];
}

// A Pokémon Center: nurse (heal-party) behind the counter, a storage PC (open-box)
// back-right, a noticeboard, and a `wake` spawn (the Center is the blackout respawn).
export function makeCenter(townId: string, opts: CenterOpts = {}): GrayboxMapJson {
  const id = townId.toUpperCase();
  const tileset: { readonly [k: string]: TileDef } = {
    W: { color: '#9c8a78', solid: true, label: 'wall' },
    '.': { color: '#cec3a0', solid: false, label: 'floor' },
    C: { color: '#caa148', solid: true, label: 'counter' },
    d: { color: '#daa520', solid: false, label: 'door' },
  };
  const objects: MapObject[] = [
    { type: 'warp', x: DOOR.x, y: DOOR.y, target: `${id}:fromCenter` },
    {
      type: 'npc',
      x: DESK.x,
      y: DESK.y,
      color: '#e23a1e',
      interact: [
        { kind: 'dialog', lines: opts.nurseGreeting ?? ['NURSE: Welcome to the', 'Pokémon Center.', '', 'Shall I tend to your team?', 'It will only take a moment.'] },
        { kind: 'heal-party' },
        { kind: 'dialog', lines: opts.nurseHealed ?? ['(The machine hums.)', '(A soft chime.)', '', 'NURSE: Your team is restored.', 'Walk well out there.'] },
      ],
    },
    { type: 'sign', x: SIGN.x, y: SIGN.y, lines: opts.notice ?? ['A noticeboard.', 'POKÉ MART now open —', 'just east, across town.'] },
    {
      type: 'npc',
      x: PC.x,
      y: PC.y,
      color: '#3a6ea5',
      interact: [
        { kind: 'dialog', lines: ['The PC hums to life.', '', 'STORAGE SYSTEM ready.', 'Deposit or withdraw a mon.'] },
        { kind: 'open-box' },
      ],
    },
  ];
  return {
    name: `${id}_CENTER`,
    width: 10,
    height: 8,
    tilesize: 16,
    tiles: TILES,
    tileset,
    objects,
    spawns: {
      [entrySpawnKey(id)]: { ...ENTRY },
      wake: { x: 2, y: 3, facing: 'up' }, // blackout respawn — the player wakes at the Center
    },
  };
}

export interface MartOpts {
  readonly clerkGreeting?: readonly string[];
  readonly shelfSign?: readonly string[];
}

// A Poké Mart: clerk (open-mart with `stock`) behind the counter, a shelf sign. Same
// skeleton as the Center (a matched pair), blue palette, no PC, no wake spawn.
export function makeMart(townId: string, stock: readonly string[], opts: MartOpts = {}): GrayboxMapJson {
  const id = townId.toUpperCase();
  const tileset: { readonly [k: string]: TileDef } = {
    W: { color: '#3a4a6a', solid: true, label: 'wall' },
    '.': { color: '#c3c8d6', solid: false, label: 'floor' },
    C: { color: '#5a78b0', solid: true, label: 'counter' },
    d: { color: '#daa520', solid: false, label: 'door' },
  };
  const objects: MapObject[] = [
    { type: 'warp', x: DOOR.x, y: DOOR.y, target: `${id}:fromMart` },
    {
      type: 'npc',
      x: DESK.x,
      y: DESK.y,
      color: '#3a6ea5',
      interact: [
        { kind: 'dialog', lines: opts.clerkGreeting ?? ['CLERK: Welcome to the', 'POKÉ MART!', '', 'Stocking up before the', 'routes? Smart.'] },
        { kind: 'open-mart', stock: [...stock] },
      ],
    },
    { type: 'sign', x: SIGN.x, y: SIGN.y, lines: opts.shelfSign ?? ['A shelf of supplies.', 'POTIONs keep you on', 'the road longer.'] },
  ];
  return {
    name: `${id}_MART`,
    width: 10,
    height: 8,
    tilesize: 16,
    tiles: TILES,
    tileset,
    objects,
    spawns: { [entrySpawnKey(id)]: { ...ENTRY } },
  };
}
