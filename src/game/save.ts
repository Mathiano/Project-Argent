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

// Where a save that could not be loaded is set aside. The autosave fires on every
// overworld transition, so a save the loader rejects would otherwise be OVERWRITTEN
// within seconds of the player pressing New Game — a run lost to a bad byte with no
// warning. Moving the raw string here first makes that recoverable.
export const QUARANTINE_KEY = 'argent.save.broken';

// ---- Versioning + migration ------------------------------------------------
//
// The shape has always grown ADDITIVELY: every field since Phase 5a is optional
// with a documented default, which is why it is still version 1. That works until
// a change is NOT additive (a renamed field, a re-shaped party entry), and at that
// point `version` has to move — so the chain has to exist BEFORE it is needed,
// because the alternative is discarding saves.
export const CURRENT_SAVE_VERSION = 1;

// A step from version N to N+1, operating on the raw parsed object. Steps must be
// PURE and total: given any object that passed version N's validator, return one
// that passes version N+1's. Register each step under the version it upgrades FROM.
export type SaveMigration = (raw: Record<string, unknown>) => Record<string, unknown>;

export const SAVE_MIGRATIONS: { readonly [fromVersion: number]: SaveMigration } = {
  // (empty — version 1 is current. A v1→v2 step lands here in the same commit
  // that bumps CURRENT_SAVE_VERSION, and `migrateSave` picks it up with no other
  // change. `save.test.ts` exercises the chain with a synthetic step so the
  // machinery is proven before a real migration depends on it.)
};

export type LoadFailure =
  // The stored blob is not JSON at all.
  | 'unparseable'
  // It parsed, but does not match the shape this build expects.
  | 'corrupt'
  // It comes from a LATER build than this one. Downgrading is not something a
  // migration chain can do, so this is never silently discarded.
  | 'future';

export interface LoadResult {
  readonly save: SaveState | null;
  // null when there was simply no save to load — the ordinary first-run case,
  // which is NOT a failure and must never be reported as one.
  readonly failure: LoadFailure | null;
}

function versionOf(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = (raw as Record<string, unknown>).version;
  return typeof v === 'number' ? v : null;
}

/**
 * Walk a parsed save up to CURRENT_SAVE_VERSION. Returns the migrated object, or a
 * failure when it cannot get there: an unknown/missing version reads as `corrupt`,
 * a NEWER one as `future` (a chain upgrades, it cannot downgrade), and a gap in the
 * chain as `corrupt` rather than a half-migrated object handed to the validator.
 */
export function migrateSave(
  raw: unknown,
  migrations: { readonly [fromVersion: number]: SaveMigration } = SAVE_MIGRATIONS,
  target: number = CURRENT_SAVE_VERSION,
): { readonly value: Record<string, unknown> } | { readonly failure: LoadFailure } {
  const from = versionOf(raw);
  if (from === null) return { failure: 'corrupt' };
  if (from > target) return { failure: 'future' };
  let value = { ...(raw as Record<string, unknown>) };
  for (let v = from; v < target; v += 1) {
    const step = migrations[v];
    if (!step) return { failure: 'corrupt' };
    value = { ...step(value), version: v + 1 };
  }
  return { value };
}

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

/**
 * Load, reporting WHY when it fails, and quarantining the raw blob so the next
 * autosave cannot destroy it. `loadFromStorage` is the thin back-compat wrapper.
 */
export function loadFromStorageResult(
  storage: StorageLike | null = defaultStorage(),
): LoadResult {
  if (!storage) return { save: null, failure: null };
  const raw = storage.getItem(SAVE_KEY);
  // No save at all is the ordinary first-run case, not a failure — and must not
  // quarantine anything.
  if (!raw) return { save: null, failure: null };

  const fail = (failure: LoadFailure, err?: unknown): LoadResult => {
    quarantineRaw(storage, raw, failure);
    console.warn(`Argent save: ${failure}; moved aside to ${QUARANTINE_KEY}`, err);
    return { save: null, failure };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (err) {
    return fail('unparseable', err);
  }
  const migrated = migrateSave(parsed);
  if ('failure' in migrated) return fail(migrated.failure);
  const save = validateSave(migrated.value);
  if (!save) return fail('corrupt');
  return { save, failure: null };
}

export function loadFromStorage(storage: StorageLike | null = defaultStorage()): SaveState | null {
  return loadFromStorageResult(storage).save;
}

// Copy a rejected save aside, with why and when, then clear the live slot so the
// next autosave writes to a clean key instead of on top of it. Best-effort: a
// storage that refuses the write must not stop the game from starting.
function quarantineRaw(storage: StorageLike, raw: string, reason: LoadFailure): void {
  try {
    storage.setItem(
      QUARANTINE_KEY,
      JSON.stringify({ reason, at: new Date().toISOString(), raw }),
    );
    storage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn('Argent save: quarantine write failed', err);
  }
}

/** The quarantined save, if one is waiting. Nothing reads this in-game yet. */
export function readQuarantine(
  storage: StorageLike | null = defaultStorage(),
): { readonly reason: LoadFailure; readonly at: string; readonly raw: string } | null {
  if (!storage) return null;
  const blob = storage.getItem(QUARANTINE_KEY);
  if (!blob) return null;
  try {
    const v = JSON.parse(blob) as Record<string, unknown>;
    if (typeof v.reason !== 'string' || typeof v.raw !== 'string') return null;
    return { reason: v.reason as LoadFailure, at: String(v.at ?? ''), raw: v.raw };
  } catch {
    return null;
  }
}

export function wipeStorage(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  storage.removeItem(SAVE_KEY);
  // ?wipe means "give me a clean slate" — leaving a quarantined blob behind would
  // make the next failure report look like this one.
  storage.removeItem(QUARANTINE_KEY);
}

export function hasSave(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  return storage.getItem(SAVE_KEY) !== null;
}

// Loud-fail validator. It runs AFTER the migration chain, so by here the object
// should already be at CURRENT_SAVE_VERSION; anything else is a bug in a migration
// step, not an old save. A rejection no longer means "start fresh over the top" —
// loadFromStorageResult quarantines the raw blob first.
function validateSave(value: unknown): SaveState | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== CURRENT_SAVE_VERSION) return null;
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
