export type Side = 'player' | 'foe';

export type Stance = 'A' | 'G' | 'F';

// Combat FOCUS model (docs/combat-focus-redesign.md). A 2-round COMMITMENT:
// R1 = a GENERIC focus (the opponent sees "gathering energy", not which
// release is coming); R2 = a player-chosen HIDDEN release. Replaces the old
// distinct-wind-up two-steps (CHARGE/HIDE/FEINT) — see KICKOFF-combat-focus-rebuild.
export type ReleaseKind = 'heavy' | 'feint' | 'hide';

export type CallKind = 'getAway' | 'hangInThere';

// The default release a Focus falls back to when none is chosen (the internal
// base stance the focus is tied to): Aggressive→HEAVY, Fluid→HIDE, Guard→FEINT.
export function defaultReleaseForStance(s: Stance): ReleaseKind {
  return s === 'A' ? 'heavy' : s === 'F' ? 'hide' : 'feint';
}

// The ROTATION triangle (R2 release vs the opponent's single-step stance):
//   HEAVY > Brace(G) ; loses to Fluid(F) ; neutral vs Agg(A)
//   FEINT > Agg(A)   ; loses to Brace(G) ; neutral vs Fluid(F)
//   HIDE  > Fluid(F) ; loses to Agg(A)   ; neutral vs Brace(G)
export function releaseVsStance(release: ReleaseKind, stance: Stance): 'win' | 'lose' | 'neutral' {
  const beats: { readonly [k in ReleaseKind]: Stance } = { heavy: 'G', feint: 'A', hide: 'F' };
  const losesTo: { readonly [k in ReleaseKind]: Stance } = { heavy: 'F', feint: 'G', hide: 'A' };
  if (beats[release] === stance) return 'win';
  if (losesTo[release] === stance) return 'lose';
  return 'neutral';
}

// The FLIPPED triangle (both focus → both release): HIDE > HEAVY > FEINT > HIDE.
export function flipBeats(a: ReleaseKind, b: ReleaseKind): boolean {
  return (
    (a === 'hide' && b === 'heavy') ||
    (a === 'heavy' && b === 'feint') ||
    (a === 'feint' && b === 'hide')
  );
}

export type TierName = 'light' | 'mid' | 'heavy' | 'nuke';

// Type identifiers are arbitrary strings now (data-driven).
// Legacy fixture content uses 'Flame'|'Sprout'|'Splash' (mixed case);
// CH1+ content from docs/typechart.json uses 'FLAME'|'NATURE'|... (upper).
// Charts and species data within a single battle must use the same casing.
export type ElementType = string;

export type TypeChart = {
  readonly [attacker: string]: { readonly [defender: string]: number };
};

export interface Tier {
  readonly name: TierName;
  readonly power: number;
  readonly cost: number;
  readonly weight: number;
  readonly delayNext?: boolean;
}

export interface Move {
  readonly name: string;
  readonly tier: TierName;
  readonly type: ElementType | null;
}

export interface Species {
  readonly name: string;
  readonly types: readonly ElementType[];
  readonly hp: number;
  readonly atk: number;
  readonly dfn: number;
  readonly spd: number;
  readonly moves: readonly string[];
  readonly spr?: string;
  // Optional trait id (e.g., 'GUSTBORNE'). Trait effects fire on conditions
  // declared by the BossCard's ArenaSchedule.
  readonly trait?: string;
}

export interface SideState {
  readonly species: Species;
  readonly hp: number;
  readonly maxHp: number;
  readonly st: number;
  readonly exhausted: boolean;
  readonly staggered: boolean;
  readonly momentum: number;
  // Generic "jumpstart" flag: when armed, this mon's FIRST read-win of the
  // battle grants one EXTRA ★ (then disarms). The engine is bond-agnostic —
  // it only knows the flag; the GAME arms it for a sufficiently-bonded mon
  // (bond-track-v2.md Call-tier I "Familiar"). Omitted (undefined) on every
  // legacy/sim side, so the field is absent → behaviour is bit-identical.
  readonly jumpstartArmed?: boolean;
  // Combat FOCUS model — a pending focus. Set on the FOCUS round (R1) when this
  // mon initiates a Focus (tied to `stance` internally; `move` is the strike it
  // releases with). Present at the start of the next round means this mon
  // RELEASES (R2, the chosen release) and the field is then cleared. Absent
  // (undefined) on every legacy/sim/single-step side → bit-identical shape.
  readonly focus?: { readonly stance: Stance; readonly move: string };
}

// A side's roster. The active mon is members[active]; the rest are bench.
// maxSize caps how big the team may legally grow (boss cards declare this);
// the runtime never has more members than maxSize.
export interface Team {
  readonly active: number;
  readonly members: readonly SideState[];
  readonly maxSize: number;
}

// Pure helpers (no RNG, no allocation in the 1v1 case).
export function activeMon(team: Team): SideState {
  return team.members[team.active]!;
}

export function isTeamWiped(team: Team): boolean {
  for (const m of team.members) if (m.hp > 0) return false;
  return true;
}

export function hasBenchSurvivor(team: Team): boolean {
  for (let i = 0; i < team.members.length; i += 1) {
    if (i === team.active) continue;
    if (team.members[i]!.hp > 0) return true;
  }
  return false;
}

export function firstSurvivor(team: Team): number | null {
  for (let i = 0; i < team.members.length; i += 1) {
    if (team.members[i]!.hp > 0) return i;
  }
  return null;
}

export interface TurnHistoryEntry {
  readonly player: Stance | null;
  readonly foe: Stance | null;
}

export interface BattleState {
  readonly player: Team;
  readonly foe: Team;
  readonly round: number;
  readonly history: readonly TurnHistoryEntry[];
  readonly typeChart: TypeChart;
  // Trait modifier table for this battle. Defaults to LEGACY_TRAIT_TABLE
  // when caller omits it; bosses can override per-card.
  readonly traits: TraitTable;
  // Boss-side card driving arena rhythm + future hooks. Null/absent for
  // wild and rival fights — neutral state, no modifiers.
  readonly bossCard?: BossCard;
  // Player's progress toward Breaking the boss; resets to 0 on Break.
  readonly breakProgress?: number;
  // Current phase (starts at 1, increments each Break).
  readonly phase?: number;
  // Round number at which the arena rhythm cycle was last anchored
  // (resets to current round on Break so the gust cycle restarts).
  readonly rhythmAnchor?: number;
}

export type Action =
  // `commit: true` INITIATES a FOCUS (R1) tied to `stance` (generic to the
  // opponent — the release is hidden until R2). Absent/false = a normal
  // single-step move (the legacy shape → single-step resolution is bit-identical).
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance; readonly commit?: boolean }
  // R2 of a Focus — the player-chosen HIDDEN release. Submitted by a mon whose
  // `focus` is set (the prior round's commit); resolves via the rotation triangle.
  | { readonly kind: 'release'; readonly release: ReleaseKind }
  | { readonly kind: 'rest' }
  | { readonly kind: 'catchBreath' }
  | { readonly kind: 'switch'; readonly toIndex: number }
  // Phase 6a (Catching 2.0, sanctioned + sim-gated): the player forgoes
  // their strike to throw a ball. The CATCH MATH lives game-side; the
  // engine only governs the turn — the thrower does not strike, the foe
  // acts normally, no stamina change. Sim bots never throw, so the
  // ladders stay bit-identical (this branch is dead code for them).
  | { readonly kind: 'throwBall' }
  // Layer 2 — a ★-powered Call OVERRIDE. The ONLY escape from a committed
  // enemy Charge (not a stance): GET AWAY = guaranteed no-hit this round;
  // HANG IN THERE = cannot drop below 1 hp this round. Spends 1 ★ (momentum);
  // the caller forgoes its strike. Sim/legacy bots never call → bit-identical.
  | { readonly kind: 'call'; readonly call: CallKind };

export interface StatScale {
  readonly hp?: number;
  readonly atk?: number;
  readonly dfn?: number;
  readonly spd?: number;
}

// Per-round arena modifier table. Each Nth round is a "rhythm round"
// (e.g., gust round on Falkner's rooftop). Heavies cost more and weigh
// more on initiative for BOTH sides on rhythm rounds; trait-bearing
// species get their conditional boost.
export interface ArenaSchedule {
  readonly rhythmEveryN: number;
  readonly heavyExtraCost: number;
  readonly heavyExtraInitWeight: number;
  readonly telegraphAheadBy: number;
}

export interface BossCard {
  readonly species: Species;
  readonly statScale?: StatScale;
  readonly breakBar?: number;
  readonly arenaSchedule?: ArenaSchedule;
  // Variable team size — boss cards declare how big the lineup is.
  // Defaults to 1 when omitted (single-mon boss). Falkner ships at 2.
  readonly teamSize?: number;
}

export function isRhythmRound(
  schedule: ArenaSchedule | undefined,
  round: number,
  anchor = 0,
): boolean {
  if (!schedule) return false;
  if (schedule.rhythmEveryN <= 0) return false;
  return (round - anchor) % schedule.rhythmEveryN === 0;
}

// Trait modifier definition: damage + initiative multipliers applied
// to the trait-bearing species on rhythm rounds.
export interface TraitMod {
  readonly dmgMult: number;
  readonly initMult: number;
}

export type TraitTable = { readonly [id: string]: TraitMod };

// Trait lookup is data-driven: the active battle's traits table decides
// the modifiers. traitMods returns the neutral mod for off-rhythm rounds,
// species without a trait, or trait ids not present in the table.
export function traitMods(
  side: SideState,
  rhythmRound: boolean,
  traits: TraitTable,
): TraitMod {
  if (!rhythmRound) return { dmgMult: 1, initMult: 1 };
  const traitId = side.species.trait;
  if (!traitId) return { dmgMult: 1, initMult: 1 };
  return traits[traitId] ?? { dmgMult: 1, initMult: 1 };
}
