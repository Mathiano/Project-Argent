// Trainer combat-profile AI (Combat Layer 4 — STAGE 1). docs/trainer-combat-
// profiles.md. A PURE POLICY layer (deterministic given the RNG; no engine-
// math change): a PROFILED trainer picks its foe action from a stance-tendency
// + two-step-tendency profile via the shared decision tree below. The same
// `focus`/`release` machinery the player uses resolves the foe's choice — so a
// trainer can now FOCUS (the player faces a hidden release + the flipped
// triangle for the first time).
//
// Wild encounters (and any UNPROFILED trainer) keep `wildFoeAI` — this module
// is wired ONLY for profiled trainers, so wild battles stay bit-identical.
//
// STAGE 1 = exactly TWO dimensions: stance tendency + two-step tendency. The
// other profile dimensions from the design doc are deferred; their hook points
// are marked inline so later stages slot in without restructuring:
//   - Bond-gated Calls + Call behavior  → STAGE 2 (THREAT CHECK, step 1)
//   - Reading the player back (Reactive) → STAGE 2/3 (READ THE PLAYER, step 3)
//   - Information discipline (veiled/bluff) → STAGE 3 (presentation layer)
//   - Terrain affinity → Layer 3 (biases the stance mix)

import { affordableMoves, forcedAction, lookupMove } from './state';
import type { RNG } from './rng';
import type { Action, BattleState, ReleaseKind, Side, SideState, Stance } from './types';
import { activeMon, defaultReleaseForStance } from './types';

// A trainer policy has the same shape as a boss policy: (state, side, rng) →
// the foe's Action. (Kept structurally identical to BossPolicy, declared here
// to avoid a bossAI ↔ trainerAI import edge.)
export type TrainerPolicy = (state: BattleState, side: Side, rng: RNG) => Action;

// ── The Stage-1 dimensions ─────────────────────────────────────────────────
export type StanceTendency = 'aggressor' | 'bulwark' | 'evader' | 'balanced';
export type TwoStepTendency = 'single-only' | 'occasional' | 'frequent' | 'signature';
// Information discipline (Layer 3.5, simplest form) — how much a trainer LEAKS
// about a Focus's hidden release. 'open' → a truthful 2-of-3 narrowing (a
// learnable 50/50); 'vague' → a non-specific tell; 'opaque' → nothing (just
// "FOCUSING"). Difficulty scales by tightening this. The TELL PHRASES live in
// the game layer (battle scene) with the other intent tells; this is the data.
export type InfoDiscipline = 'open' | 'vague' | 'opaque';

export interface TrainerProfile {
  readonly name: string;
  // Base-triangle preference when single-stepping.
  readonly stance: StanceTendency;
  // Whether & how often the trainer FOCUSES (two-steps).
  readonly twoStep: TwoStepTendency;
  // The release this trainer FOCUSES into (a Charger → 'heavy', a Trickster →
  // 'feint', an Ambusher → 'hide'). Omitted → a focus releases the default for
  // its drawn base stance. A 'signature' two-step should always set this.
  readonly favoredRelease?: ReleaseKind;
  // Information discipline for the FOCUS tell (Stage-1 info-warfare seam).
  // Omitted → treated as 'open' (early trainers leak). Only the Focus tell uses
  // this in Stage 1; single-stance intent is unchanged.
  readonly info?: InfoDiscipline;
  // --- Later-stage hooks (NOT read in Stage 1; documented so the data shape
  // is forward-compatible) ---
  // bond?: 'none' | 'mid' | 'high';        // STAGE 2 — gates the Call toolkit
  // callBehavior?: 'clutch' | 'liberal' | 'defensive';  // STAGE 2
  // bluffs?: boolean;                       // STAGE 3 — info 'bluffer' (lying tells)
  // terrain?: string;                       // Layer 3 — home-turf bias
  // adaptive?: boolean;                     // STAGE 2/3 — read the player back
}

// Base-stance weights [A, G, F] per stance tendency.
const STANCE_MIX: { readonly [k in StanceTendency]: readonly [number, number, number] } = {
  aggressor: [0.6, 0.2, 0.2],
  bulwark: [0.2, 0.6, 0.2],
  evader: [0.2, 0.2, 0.6],
  balanced: [0.34, 0.33, 0.33],
};

// How often the trainer initiates a Focus, per two-step tendency. 'signature'
// focuses at a moderate rate but ALWAYS into its favoredRelease.
const FOCUS_RATE: { readonly [k in TwoStepTendency]: number } = {
  'single-only': 0,
  occasional: 0.25,
  frequent: 0.5,
  signature: 0.35,
};

// The base stance a Focus must carry so its release resolves as intended
// (inverse of defaultReleaseForStance): HEAVY←A, HIDE←F, FEINT←G.
const STANCE_FOR_RELEASE: { readonly [k in ReleaseKind]: Stance } = {
  heavy: 'A',
  hide: 'F',
  feint: 'G',
};

function drawStance(mix: readonly [number, number, number], rng: RNG): Stance {
  const total = mix[0] + mix[1] + mix[2];
  let r = rng.next() * total;
  if ((r -= mix[0]) < 0) return 'A';
  if ((r -= mix[1]) < 0) return 'G';
  return 'F';
}

// A committed Focus wants the heaviest affordable move (the wind-up pays its
// move cost; the release strike then rides that move's power).
function pickFocusMove(aff: readonly string[]): string {
  return aff.find((n) => lookupMove(n).tier === 'heavy') ?? pickSustainableMove(aff);
}

// A single-step wants a sustainable mid/light move (stamina-frugal).
function pickSustainableMove(aff: readonly string[]): string {
  return (
    aff.find((n) => lookupMove(n).tier === 'mid') ??
    aff.find((n) => lookupMove(n).tier === 'light') ??
    aff[0]!
  );
}

// The side's last two SINGLE-STEP stances (focus/release rounds record null and
// are skipped — they don't feed the single-step thrice-repeat daze).
function recentSingleStances(state: BattleState, side: Side): Stance[] {
  return state.history
    .map((h) => h[side])
    .filter((s): s is Stance => s !== null)
    .slice(-2);
}

// Avoid the thrice-repeat self-daze: if the last two single-steps were both
// `want`, picking it a third time dazes us — shift to a different stance.
function avoidSelfDaze(want: Stance, state: BattleState, side: Side): Stance {
  const recent = recentSingleStances(state, side);
  if (recent.length === 2 && recent[0] === want && recent[1] === want) {
    return want === 'A' ? 'G' : want === 'G' ? 'F' : 'A';
  }
  return want;
}

// The shared decision tree (the IF-THEN logic from the design doc, Stage-1
// dimensions only), parameterized by a profile.
export function trainerPolicy(profile: TrainerProfile): TrainerPolicy {
  return (state, side, rng) => {
    const me: SideState = activeMon(state[side]);

    // 0. Forced action (exhaustion rest / softlock) — same as every policy.
    const forced = forcedAction(me);
    if (forced) return forced;

    // 2. RELEASE CHECK — mid-two-step → release this round (locked in). The
    //    favored release (or the focus's default for its base stance).
    if (me.focus !== undefined) {
      const release = profile.favoredRelease ?? defaultReleaseForStance(me.focus.stance);
      return { kind: 'release', release };
    }

    // 1. THREAT CHECK (Call) — STAGE 2 hook: bond-gated Calls go here, BEFORE
    //    escalation (escape a feared player Charge). Stage-1 trainers cannot Call.
    // 3. READ THE PLAYER — STAGE 2/3 hook: Reactive trainers bias toward the
    //    counter of the player's recent pattern here. Stage-1 trainers are Fixed.

    const aff = affordableMoves(me);
    if (aff.length === 0) return { kind: 'rest' };

    // 4. ESCALATION CHECK — two-step roll per tendency. A focus commits a base
    //    stance tied to the release we intend (favored, or a drawn one).
    const focusRate = FOCUS_RATE[profile.twoStep];
    if (focusRate > 0 && rng.next() < focusRate) {
      const baseStance = profile.favoredRelease
        ? STANCE_FOR_RELEASE[profile.favoredRelease]
        : drawStance(STANCE_MIX[profile.stance], rng);
      return { kind: 'move', move: pickFocusMove(aff), stance: baseStance, commit: true };
    }

    // 5. BASE STANCE — weighted by tendency (+ terrain bias later), avoiding
    //    the thrice-repeat self-daze.
    const stance = avoidSelfDaze(drawStance(STANCE_MIX[profile.stance], rng), state, side);
    return { kind: 'move', move: pickSustainableMove(aff), stance };
  };
}

// ── STAGE-1 PROFILE REGISTRY ────────────────────────────────────────────────
// A few representative trainers with CLEARLY distinct profiles so the contrast
// is felt. Keyed by a stable profile id (the game maps each trainer's win-flag
// to one of these). Falkner is NOT here — he keeps his bespoke boss AI, upgraded
// in bossAI.ts to FOCUS on his signature gust (Evader / Occasional / signature).
export const TRAINER_PROFILES: { readonly [id: string]: TrainerProfile } = {
  // The teaching baseline: a clean base-triangle read, never focuses.
  youngster: { name: 'YOUNGSTER MILO', stance: 'balanced', twoStep: 'single-only', info: 'open' },
  // The Charger: pressures with Aggressive and sometimes FOCUSES into HEAVY —
  // the player's first lesson in reading a trainer's hidden release. Open info:
  // his Focus leaks a learnable narrowing ("focuses to attack" → HEAVY/FEINT).
  jay: { name: 'JAY', stance: 'aggressor', twoStep: 'occasional', favoredRelease: 'heavy', info: 'open' },
  // The Bulwark: Guard-heavy wall — the player slips it with Fluid. A distinct
  // third read (no focus), rounding out the stance-tendency spread.
  lass: { name: 'LASS BRYN', stance: 'bulwark', twoStep: 'single-only', info: 'open' },
};

// Which trainer (by its overworld win-flag) gets which profile. The game maps a
// trainer encounter's win-flag through here: a flag WITH a profile fights via
// trainerPolicy; a flag WITHOUT one (and every wild encounter) falls back to
// wildFoeAI — so unprofiled trainers + wild battles stay bit-identical. Both
// Route 31 map variants reuse these flags. (Falkner is a boss → falknerBossAI.)
export const TRAINER_PROFILE_BY_FLAG: { readonly [winFlag: string]: string } = {
  route31_youngster_beaten: 'youngster',
  route31_trainer_beaten: 'jay',
  route31_lass_beaten: 'lass',
};

// The routing primitive: a trainer's profile, or undefined → caller uses
// wildFoeAI. Pure + testable (the profile-vs-wildAI routing gate).
export function foeProfileForFlag(winFlag: string): TrainerProfile | undefined {
  const id = TRAINER_PROFILE_BY_FLAG[winFlag];
  return id ? TRAINER_PROFILES[id] : undefined;
}
