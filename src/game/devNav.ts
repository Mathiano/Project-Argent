// Dev playtest navigation — PURE parsing of dev URL params into a normalized plan
// that main.ts applies via the existing map-warp / flag / party-construction paths.
// No DOM, no engine imports: the dev gate (import.meta.env.DEV) lives in main.ts and
// is passed in as `dev`, so this module is unit-testable and inert-by-contract.
//
// This is a dev ENTRY layer over existing systems, not a new game system. The same
// AT_TARGETS / PRESETS tables drive both the URL form and the in-game debug menu.
//
// Syntax (all dev-only):
//   ?at=<map>            jump to a map at a sensible spawn (see AT_TARGETS keys)
//   ?state=<p[,p...]>    composable progression presets (see PRESETS keys)
//   ?party=<mon[:lvl],…> starting party; level gates the learnset band (no stat scaling)
//   ?fight=<foe>[:<prof>] spawn a Battle Forge matchup (species + a real trainer profile)
//   ?bond=<0|2|4|6>      set party slot 1's bond to that stage (feel rungs: tells 4/6)
//   ?seed=<hex>          set the RNG seed at boot (reproducible feel tests)
// e.g. ?at=academy&state=postfalkner   ?at=violet&party=grubleaf:12,kindrake:8
//      ?fight=galehawk:duelist&bond=6&seed=a9c0

// A JSON data import (the CH1 manifest) — the SAME source main.ts loads the dex
// from, so the forge foe list can't drift from shipping content. Not an engine
// import; keeps this module DOM-free + unit-testable.
import ch1BatchData from '../../docs/ch1-batch.json';

export interface AtTarget {
  readonly map: string;
  readonly spawn: string;
}

export interface DevPartyMember {
  readonly name: string;
  // Learnset band (Argent has no stat-leveling — level only widens the moveset).
  // null = use the default CH1 band.
  readonly level: number | null;
}

export interface DevFight {
  readonly foe: string; // species name (validated against the real dex in main.ts)
  readonly profile: string | null; // trainer-profile key, or null → the forge default
}

export interface DevPlan {
  // false ⇒ INERT: either not a dev build, or no dev-nav param present. main.ts
  // falls through to its normal boot (legacy ?skip chain / title) when inactive.
  readonly active: boolean;
  readonly at: AtTarget | null;
  readonly flags: readonly string[];
  readonly badges: readonly string[];
  readonly party: readonly DevPartyMember[] | null;
  readonly fight: DevFight | null;
  readonly bond: number | null; // target bond STAGE (0|2|4|6) for party slot 1
}

// The permanent sim-fixture species (docs/data.ts — the forever trio). Stable
// names, safe to list; the CH1 roster is enumerated from the manifest below.
const FIXTURE_FOES = ['EMBERCUB', 'SPROUTLE', 'AQUAFIN'] as const;
// The Battle Forge's selectable foes: every registered CH1 species (from the
// manifest — no hardcoded copy that could drift) + the fixtures.
export const FORGE_FOES: readonly string[] = [
  ...new Set([
    ...(ch1BatchData as ReadonlyArray<{ readonly name: string }>).map((e) => e.name.toUpperCase()),
    ...FIXTURE_FOES,
  ]),
];

// "galehawk:duelist" → {foe:'GALEHAWK', profile:'duelist'}. Profile omitted → null.
export function parseFight(spec: string): DevFight | null {
  const s = (spec ?? '').trim();
  if (!s) return null;
  const [rawFoe, rawProf] = s.split(':');
  const foe = (rawFoe ?? '').trim().toUpperCase();
  if (!foe) return null;
  const profile = rawProf !== undefined && rawProf.trim() ? rawProf.trim().toLowerCase() : null;
  return { foe, profile };
}

const BOND_STAGE_SET: ReadonlySet<number> = new Set([0, 2, 4, 6]);
// ?bond → one of the feel-relevant stage rungs (0|2|4|6), else null.
export function parseBond(spec: string): number | null {
  const n = Number.parseInt((spec ?? '').trim(), 10);
  return Number.isFinite(n) && BOND_STAGE_SET.has(n) ? n : null;
}

// ?seed → an unsigned 32-bit hex seed (with or without 0x), else null.
export function parseSeed(spec: string): number | null {
  const s = (spec ?? '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{1,8}$/.test(s)) return null;
  const n = Number.parseInt(s, 16);
  return Number.isFinite(n) ? n >>> 0 : null;
}

// Map alias → (mapId, spawn). The canonical set of dev-reachable maps; shared by
// the URL `?at=` form and the debug menu so they can never drift.
export const AT_TARGETS: Readonly<Record<string, AtTarget>> = {
  bedroom: { map: 'BEDROOM', spawn: 'default' },
  house: { map: 'HOUSE', spawn: 'fromBedroom' },
  hearthwick: { map: 'HEARTHWICK', spawn: 'fromHouse' },
  lab: { map: 'LAB', spawn: 'default' },
  center: { map: 'HEARTHWICK_CENTER', spawn: 'fromHearthwick' },
  mart: { map: 'HEARTHWICK_MART', spawn: 'fromHearthwick' },
  route31: { map: 'ROUTE31', spawn: 'default' },
  violet: { map: 'VIOLET', spawn: 'fromRoute' },
  academy: { map: 'VIOLET_ACADEMY', spawn: 'fromViolet' },
  gym: { map: 'GYM', spawn: 'fromRoute' },
  route32: { map: 'ROUTE32', spawn: 'fromViolet' },
};

export interface PresetEffect {
  readonly flags: readonly string[];
  readonly badges: readonly string[];
}

// Progression presets → the flags/badges they set (real game flags, applied via the
// existing flag/badge paths; zephyr_earned is then derived from the badge on recompute).
//   opening    — post-intro: starter granted, theft fired, catch lesson done
//   zephyr/falkner/postfalkner — opening + Falkner beaten + Academy promoted + ZEPHYR badge
//   kamon      — the above + the KAMON gate fight resolved
//   chapterend/ch1 — alias for kamon (entering Route 32 then closes the chapter)
const OPENING = ['player_has_starter', 'kamon_theft_fired', 'catch_lesson_done'];
const ZEPHYR = [...OPENING, 'falkner_beaten', 'academy_promoted'];
const KAMON = [...ZEPHYR, 'kamon_beaten'];
export const PRESETS: Readonly<Record<string, PresetEffect>> = {
  opening: { flags: OPENING, badges: [] },
  'skip-opening': { flags: OPENING, badges: [] },
  zephyr: { flags: ZEPHYR, badges: ['ZEPHYR'] },
  falkner: { flags: ZEPHYR, badges: ['ZEPHYR'] },
  postfalkner: { flags: ZEPHYR, badges: ['ZEPHYR'] },
  kamon: { flags: KAMON, badges: ['ZEPHYR'] },
  chapterend: { flags: KAMON, badges: ['ZEPHYR'] },
  ch1: { flags: KAMON, badges: ['ZEPHYR'] },
};

// "grubleaf:12, kindrake" → [{name:'GRUBLEAF',level:12},{name:'KINDRAKE',level:null}].
// Names upper-cased to match the dex; a non-positive/garbage level → null (default band).
export function parsePartySpec(spec: string): DevPartyMember[] {
  const out: DevPartyMember[] = [];
  for (const entry of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [rawName, rawLvl] = entry.split(':');
    const name = (rawName ?? '').trim().toUpperCase();
    if (!name) continue;
    let level: number | null = null;
    if (rawLvl !== undefined) {
      const n = Number.parseInt(rawLvl.trim(), 10);
      level = Number.isFinite(n) && n > 0 ? n : null;
    }
    out.push({ name, level });
  }
  return out;
}

// Compose progression presets (comma-separated) into a deduped flag/badge set.
export function resolvePresets(state: string): { flags: string[]; badges: string[] } {
  const flags = new Set<string>();
  const badges = new Set<string>();
  for (const name of state.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const eff = PRESETS[name];
    if (!eff) continue;
    eff.flags.forEach((f) => flags.add(f));
    eff.badges.forEach((b) => badges.add(b));
  }
  return { flags: [...flags], badges: [...badges] };
}

// THE dev gate + parser. Returns an inert plan (active:false) when not a dev build,
// or when no dev-nav param (?at / ?state) is present — so a normal build, and an
// ordinary URL, are completely unaffected.
export function buildDevPlan(opts: { dev: boolean; search: string | URLSearchParams }): DevPlan {
  const inert: DevPlan = { active: false, at: null, flags: [], badges: [], party: null, fight: null, bond: null };
  if (!opts.dev) return inert; // ← dev-gate: inert in a normal (production) build
  const p = typeof opts.search === 'string' ? new URLSearchParams(opts.search) : opts.search;
  const at = p.get('at');
  const state = p.get('state');
  const party = p.get('party');
  const fight = p.get('fight');
  const bond = p.get('bond');
  // Claim the boot only when a dev-nav param is actually present (?party alone is
  // also understood by the legacy chain, so it doesn't on its own claim the boot).
  if (at === null && state === null && fight === null && bond === null) return inert;
  const { flags, badges } = state !== null ? resolvePresets(state) : { flags: [], badges: [] };
  return {
    active: true,
    at: at !== null ? (AT_TARGETS[at.trim().toLowerCase()] ?? null) : null,
    flags,
    badges,
    party: party !== null ? parsePartySpec(party) : null,
    fight: fight !== null ? parseFight(fight) : null,
    bond: bond !== null ? parseBond(bond) : null,
  };
}
