export type Side = 'player' | 'foe';

export type Stance = 'A' | 'G' | 'F';

// Combat FOCUS model (docs/combat-focus-redesign.md). A 2-round COMMITMENT:
// R1 = a GENERIC focus (the opponent sees "gathering energy", not which
// release is coming); R2 = a player-chosen HIDDEN release. Replaces the old
// distinct-wind-up two-steps (CHARGE/HIDE/FEINT) — see KICKOFF-combat-focus-rebuild.
export type ReleaseKind = 'heavy' | 'feint' | 'hide';

// ★-Call overrides (docs/call-effects-design.md). getAway/hangInThere are the
// original Layer-2 escapes; recover/dodge are the new built Calls (Lane B):
//   getAway     — negate the incoming hit this round (★1)
//   hangInThere — floor the user at 1 hp this round (★1) [retired from the UI;
//                 engine effect kept dormant pending the Shake-It-Off repurpose]
//   recover     — heal 50% maxHp (★1)
//   dodge       — full evade: negate the incoming hit (★1; overlaps getAway by
//                 design until the counter-window is added — banked)
//   resolve     — the bond-gated status counterplay (status-engine scaffolding):
//                 clears the bearer's status + grants brief immunity. Bond
//                 Stage-4 gated (game-side). STUBBED this increment — no status
//                 exists to clear yet, so nothing consumes this kind in
//                 resolution (applyHp/applyRecover ignore it → no hp effect),
//                 and no sim bot emits it → bit-identical. See
//                 docs/status-engine-scope.md.
// FULL POWER is NOT a CallKind — it's a `move` modifier (`fullPower: true`)
// because it buffs an attack rather than resolving as a standalone Call.
export type CallKind = 'getAway' | 'hangInThere' | 'recover' | 'dodge' | 'resolve';

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

// ── Status engine scaffolding (docs/status-engine-scope.md) — INERT ────────
// Increment 1 wires NO actual status: these shapes are the plumbing that the
// effect-move / status increment plugs into. Nothing in resolveRound reads
// them yet → every move/side is bit-identical to before. Status ids are
// data-driven strings (like ElementType) so NO specific status is named or
// committed here.
export type StatusKind = string;

// Whether a status helps its bearer (buff: self-cast, always lands) or harms a
// foe (debuff: lands only on a read-win). Reserved for the wiring increment.
export type StatusPolarity = 'buff' | 'debuff';

// A live status instance carried on a SideState. `duration` = rounds left;
// `applied` = how many times THIS status has hit THIS mon this battle (room
// for the future diminishing-returns 3→2→1→resist curve). Absent on every
// legacy/sim side this increment.
export interface StatusInstance {
  readonly kind: StatusKind;
  readonly duration: number;
  readonly applied?: number;
  // The FORCED stance for a stance-lock control debuff (Frozen/Inception lock
  // the stance held when applied; Taunt forces Aggressive). Absent for every
  // non-control status → unchanged shape. (Wave B.)
  readonly stance?: Stance;
}

// An effect-move's effect descriptor. OPTIONAL on Move — the 43 damage moves
// omit it and behave EXACTLY as today; nothing in resolveStrike/rawHit reads
// it this increment. When wired: applies `status` (a debuff to the foe on a
// read-win / a buff to self), dealing `damageFactor`× reduced damage.
export interface MoveEffect {
  readonly status: StatusKind;
  readonly polarity: StatusPolarity;
  // How the status lands: 'readWin' = only when the cast-stance wins the read
  // (the locked debuff rule); 'always' = self-applied buff. Reserved.
  readonly condition: 'readWin' | 'always';
  // Effect moves deal REDUCED damage (× this) so a missed read still chips.
  // Absent ⇒ the wiring increment falls back to STATUS.effectMoveDamageFactor.
  readonly damageFactor?: number;
}

export interface Move {
  readonly name: string;
  readonly tier: TierName;
  readonly type: ElementType | null;
  // ── Status engine scaffolding — OPTIONAL effect descriptor. Absent on every
  // damage move ⇒ pure tier/type damage, bit-identical. Unread in resolution
  // this increment. See docs/status-engine-scope.md.
  readonly effect?: MoveEffect;
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
  // ── Status engine scaffolding (docs/status-engine-scope.md) — INERT ──────
  // The single active DEBUFF (one at a time, per the locked "1 debuff" rule),
  // or ABSENT when none. A new debuff will REPLACE the old when wired.
  // Following the jumpstartArmed/focus/nickname convention, the field is
  // absent (not null) by default so the object shape is bit-identical; the
  // wiring increment reads it as `side.debuff ?? null`. Unread in resolution
  // this increment.
  readonly debuff?: StatusInstance;
  // The stacking BUFFS (multiple, per "buffs stack"), or ABSENT when none.
  // Read as `side.buffs ?? []` by the wiring increment. Unread today.
  readonly buffs?: readonly StatusInstance[];
  // The last Call this mon successfully made (Wave A — for ECHO, the "false
  // echo" that re-maps the foe's next Call to this one). Absent until the mon
  // Calls; absent on every legacy/sim side that never Calls → bit-identical.
  readonly lastCall?: CallKind;
  // Player-chosen display NICKNAME (game-layer cosmetic). The engine never
  // reads it — combat resolution is identity-agnostic — so it's absent on every
  // sim/legacy/foe side and the shape stays bit-identical. The GAME sets it at
  // catch/rename time; display sites show `nickname ?? species.name`. Species /
  // L00x identity is unchanged (the dex still keys on species.name).
  readonly nickname?: string;
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
  // `fullPower: true` is the FULL POWER Call's buffed attack (Lane B): the move
  // deals ×COMBAT.fullPowerMult and spends COMBAT.fullPowerCost ★. It rides a
  // normal single-step move (never a focus commit). Absent on every legacy/sim
  // action → the +50% branch is dead for the ladders (bit-identical).
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance; readonly commit?: boolean; readonly fullPower?: boolean }
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
  // Opening ★ the boss "comes prepared" with (Spine-1 — phased-unlock). Under
  // the ★-gate a boss whose signature is a heavy (Falkner's DIVE BOMB = 2★)
  // would be ★-starved at 0★; a small banked opening ★ lets the signature reach
  // the field. A TUNING lever — enough that the signature fires, not so much the
  // boss is oppressive. Defaults to 0 (omitted) → non-boss / unprepared bosses
  // are bit-identical. Applied to each of the boss's mons at creation.
  readonly openingMomentum?: number;
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
