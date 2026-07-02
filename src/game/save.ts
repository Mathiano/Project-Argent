// Save / load — the one and only state shape that persists across a
// page reload, and the same serialization seam the in-memory writeback
// uses after a battle (so the two paths can never drift).
//
// Per the Phase 2 design ruling:
//   - PERSISTED:  party (hp/st/momentum), position (map/x/y/facing),
//                 flags, catchBreathUnlocked, rngSeed.
//   - NOT persisted: maxHp (recomputed from species), exhausted /
//                    staggered (round-local), partyTypes (derived),
//                    active BattleState (no mid-battle save).
//
// localStorage adapter lives here too. Node tests inject the storage
// shim so we don't depend on the DOM.

import type { Facing } from './overworld/types';
import { createSide } from '../engine';
import type { SideState, Species } from '../engine';
import { isCatchOrigin } from './catching';
import type { CatchOrigin } from './catching';

export interface SaveState {
  readonly version: 1;
  readonly party: readonly SavedSide[];
  readonly position: SavedPosition;
  readonly flags: readonly string[];
  readonly catchBreathUnlocked: boolean;
  // RNG: fresh mulberry32(seed) on load. Overworld encounter rolls run
  // through this seeded rng too (overworld's required `random` opt), so
  // encounter sequences are deterministic — not raw Math.random.
  readonly rngSeed: number;
  // Phase 5a bag. Additive — pre-Phase-5a saves don't carry this
  // field; applySave treats missing as []. Keeps version=1 since
  // older clients reading a newer save just ignore the unknown
  // field (validator pre-Phase-5a didn't require it either).
  readonly bag?: readonly SavedBagEntry[];
  // Phase 5b wallet. Additive, same pattern as bag — pre-5b saves
  // don't carry it; applySave treats missing as the starting wallet
  // (STARTING_MONEY) so an old save isn't penniless. version stays 1.
  readonly money?: number;
  // Demo-complete: earned gym badges (ids, e.g. 'ZEPHYR'). Additive —
  // pre-badge saves load with badges undefined → applySave treats as
  // []. version stays 1.
  readonly badges?: readonly string[];
  // Phase 6a — interim per-mon bond, index-aligned with `party`.
  // Additive; missing → defaults per-mon on load.
  readonly partyBond?: readonly number[];
  // Phase 6a — the box (caught mons when the party is full). Additive.
  readonly box?: readonly SavedSide[];
  // Phase 6.5 — bond for boxed mons, index-aligned with `box`. Additive;
  // missing → defaults per-mon on load (same pattern as partyBond).
  readonly boxBond?: readonly number[];
  // Phase 6.5 — the seen/caught registry. Additive; missing → empty dex.
  readonly dex?: SavedDex;
  // living-world.md Feature 3 — HOW each mon was caught, index-aligned
  // with `party` / `box`. Additive; impossible to backfill (set at catch
  // time). Missing → best-effort default on load. Nothing reads it yet.
  readonly partyOrigin?: readonly CatchOrigin[];
  readonly boxOrigin?: readonly CatchOrigin[];
  // Player character name (the [player] token source). Additive — pre-naming
  // saves omit it; absent → null → the address drops gracefully (the same
  // behaviour as before a name system existed). Only emitted when set, so a
  // no-name run's wire shape is unchanged. version stays 1.
  readonly playerName?: string;
}

// Phase 6.5 — the dex save shape (seen/caught species names). Mirrors
// SavedDex in dex.ts; redeclared here to keep save's wire shape local.
export interface SavedDex {
  readonly seen: readonly string[];
  readonly caught: readonly string[];
}

export interface SavedBagEntry {
  readonly itemId: string;
  readonly qty: number;
}

export interface SavedSide {
  readonly speciesName: string;
  readonly hp: number;
  readonly st: number;
  readonly momentum: number;
  // Player-chosen nickname. Additive — pre-nickname saves omit it; absent →
  // the mon displays its species name (backward-compatible). Never backfilled.
  readonly nickname?: string;
}

export interface SavedPosition {
  readonly map: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

// Serialization seam — used by save/load AND by the post-battle
// writeback. Round-local fields (exhausted, staggered) are dropped on
// purpose; they reset at the start of the next battle anyway.
export function toSavedSide(side: SideState): SavedSide {
  return {
    speciesName: side.species.name,
    hp: side.hp,
    st: side.st,
    momentum: side.momentum,
    // Only emit when set, so a no-nickname mon's wire shape is unchanged.
    ...(side.nickname ? { nickname: side.nickname } : {}),
  };
}

// Inverse seam. Resolves the species via a dex lookup (the player
// can't mutate species data yet, so species is a name reference).
// Reconstructs maxHp from the species definition; clamps hp to that.
// Round-local fields reset (exhausted false, staggered false).
export function fromSavedSide(
  saved: SavedSide,
  resolveSpecies: (name: string) => Species,
): SideState {
  const species = resolveSpecies(saved.speciesName);
  const fresh = createSide(species);
  return {
    ...fresh,
    hp: Math.max(0, Math.min(fresh.maxHp, saved.hp)),
    // Clamp to the mon's OWN max stamina (per-mon now; fresh.maxSt from species).
    st: Math.max(0, Math.min(fresh.maxSt, saved.st)),
    momentum: Math.max(0, Math.min(2, saved.momentum)),
    // Restore the nickname when present (absent on old saves → species name).
    ...(saved.nickname ? { nickname: saved.nickname } : {}),
  };
}

// ---- localStorage adapter -------------------------------------------------

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'argent.save.v1';

// Resolves the platform storage at call time so a Node test can pass
// its own shim. Returns null when no storage is available (e.g., SSR
// or sandboxed) — callers treat null as "save disabled".
function defaultStorage(): StorageLike | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function saveToStorage(state: SaveState, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    // Quota exceeded, private-mode lockout, etc. — swallow; the
    // autosave is best-effort, not load-bearing for the round.
    console.warn('Argent save: storage write failed', err);
  }
}

export function loadFromStorage(storage: StorageLike | null = defaultStorage()): SaveState | null {
  if (!storage) return null;
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateSave(parsed);
  } catch (err) {
    console.warn('Argent save: parse failed; treating as no save', err);
    return null;
  }
}

export function wipeStorage(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  storage.removeItem(SAVE_KEY);
}

export function hasSave(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  return storage.getItem(SAVE_KEY) !== null;
}

// Loud-fail validator. A malformed save is treated as no save (the
// Continue option is hidden, the player starts fresh). Versions other
// than 1 are likewise rejected until a migrator exists.
function validateSave(value: unknown): SaveState | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return null;
  if (!Array.isArray(v.party)) return null;
  for (const m of v.party) {
    if (typeof m !== 'object' || m === null) return null;
    const mm = m as Record<string, unknown>;
    if (typeof mm.speciesName !== 'string') return null;
    if (typeof mm.hp !== 'number') return null;
    if (typeof mm.st !== 'number') return null;
    if (typeof mm.momentum !== 'number') return null;
    if (mm.nickname !== undefined && typeof mm.nickname !== 'string') return null;
  }
  if (typeof v.position !== 'object' || v.position === null) return null;
  const pos = v.position as Record<string, unknown>;
  if (typeof pos.map !== 'string') return null;
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
  if (pos.facing !== 'up' && pos.facing !== 'down' && pos.facing !== 'left' && pos.facing !== 'right') {
    return null;
  }
  if (!Array.isArray(v.flags) || v.flags.some((f) => typeof f !== 'string')) return null;
  if (typeof v.catchBreathUnlocked !== 'boolean') return null;
  if (typeof v.rngSeed !== 'number') return null;
  // bag is optional (pre-Phase-5a saves). When present, validate
  // each entry — a single bad row nukes the save (loud-fail).
  if (v.bag !== undefined) {
    if (!Array.isArray(v.bag)) return null;
    for (const e of v.bag) {
      if (typeof e !== 'object' || e === null) return null;
      const ee = e as Record<string, unknown>;
      if (typeof ee.itemId !== 'string') return null;
      if (typeof ee.qty !== 'number') return null;
    }
  }
  // money is optional (pre-5b saves). When present it must be a number;
  // a non-number nukes the save (loud-fail, same as a bad bag row).
  if (v.money !== undefined && typeof v.money !== 'number') return null;
  // badges optional (pre-badge saves). When present, must be a string[].
  if (v.badges !== undefined) {
    if (!Array.isArray(v.badges) || v.badges.some((b) => typeof b !== 'string')) return null;
  }
  // partyBond optional (pre-6a saves). When present, a number[].
  if (v.partyBond !== undefined) {
    if (!Array.isArray(v.partyBond) || v.partyBond.some((b) => typeof b !== 'number')) return null;
  }
  // box optional (pre-6a saves). When present, validate each saved side.
  if (v.box !== undefined) {
    if (!Array.isArray(v.box)) return null;
    for (const m of v.box) {
      if (typeof m !== 'object' || m === null) return null;
      const mm = m as Record<string, unknown>;
      if (typeof mm.speciesName !== 'string') return null;
      if (typeof mm.hp !== 'number' || typeof mm.st !== 'number' || typeof mm.momentum !== 'number') return null;
      if (mm.nickname !== undefined && typeof mm.nickname !== 'string') return null;
    }
  }
  // boxBond optional (pre-6.5 saves). When present, a number[].
  if (v.boxBond !== undefined) {
    if (!Array.isArray(v.boxBond) || v.boxBond.some((b) => typeof b !== 'number')) return null;
  }
  // dex optional (pre-6.5 saves). When present, { seen: string[], caught: string[] }.
  if (v.dex !== undefined) {
    if (typeof v.dex !== 'object' || v.dex === null) return null;
    const d = v.dex as Record<string, unknown>;
    if (!Array.isArray(d.seen) || d.seen.some((s) => typeof s !== 'string')) return null;
    if (!Array.isArray(d.caught) || d.caught.some((s) => typeof s !== 'string')) return null;
  }
  // partyOrigin / boxOrigin optional (pre-Feature-3 saves). When present,
  // each entry must be a valid CatchOrigin — a bad row nukes the save.
  if (v.partyOrigin !== undefined) {
    if (!Array.isArray(v.partyOrigin) || v.partyOrigin.some((o) => !isCatchOrigin(o))) return null;
  }
  if (v.boxOrigin !== undefined) {
    if (!Array.isArray(v.boxOrigin) || v.boxOrigin.some((o) => !isCatchOrigin(o))) return null;
  }
  // playerName optional (pre-naming saves). When present, must be a string.
  if (v.playerName !== undefined && typeof v.playerName !== 'string') return null;
  return value as SaveState;
}
