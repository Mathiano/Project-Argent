// Trainer combat-profile AI (Combat Layer 4 — the ARCHETYPE ENGINE).
// docs/trainer-archetype-catalog.md + docs/trainer-combat-profiles.md. A PURE
// POLICY layer (deterministic given the RNG; no engine-math change): a PROFILED
// trainer picks its foe action from the 8-knob profile via the shared decision
// tree below. The same `focus`/`release` machinery the player uses resolves the
// foe's choice. Wild encounters (and any UNPROFILED trainer) keep `wildFoeAI`,
// so wild battles stay bit-identical.
//
// The TREE expresses all 8 knobs as DATA so trainers are pure data; a bespoke
// MECHANIC the knobs can't express sits on top as a thin overlay (Falkner =
// Duelist-ish profile + rhythm-gust overlay in bossAI.ts). LIVE knobs: stance,
// two-step, release(variability), info, + stamina-aware focusing. The others
// (bond→Calls, call-use, terrain, adaptivity) are declared as forward-compatible
// DATA with hooks in the tree — their behavior lands in later stages (per the
// catalog's mid/elite tiers).

import { affordableMoves, forcedAction, isWinded, lookupMove } from './state';
import type { RNG } from './rng';
import type { Action, BattleState, ReleaseKind, Side, SideState, Stance } from './types';
import { activeMon, defaultReleaseForStance } from './types';

// A trainer policy has the same shape as a boss policy: (state, side, rng) →
// the foe's Action. (Kept structurally identical to BossPolicy, declared here
// to avoid a bossAI ↔ trainerAI import edge.)
export type TrainerPolicy = (state: BattleState, side: Side, rng: RNG) => Action;

// ── The 8 profile knobs (as data) ──────────────────────────────────────────
export type StanceTendency = 'aggressor' | 'bulwark' | 'evader' | 'balanced';
export type TwoStepTendency = 'single-only' | 'occasional' | 'frequent' | 'signature';

// Release variability (kickoff call #1). 'fixed-Heavy' = always HEAVY (the
// teaching floor + Falkner — D8's tell is learnable-to-certainty, deliberate).
// variable = the signature (default HEAVY) MOSTLY, FEINT mixed in at feintRate
// — FEINT beats Aggressive, so it punishes a blind masher and makes the 50/50
// real. Gym-2+ standard two-steppers. (signature lets a future Trickster/
// Ambusher set feint/hide; the catalog ships those later.)
export type ReleaseModel =
  | 'fixed-Heavy'
  | { readonly feintRate: number; readonly signature?: ReleaseKind };

// Unified information legibility (kickoff call #2). ONE level drives BOTH the
// stance-tell and the focus-tell (mapped at the game wiring layer). 'open' →
// truthful narrowing; 'veiled' → non-specific; 'opaque' → nothing. Per-axis
// override (InfoOverride) is reserved for the BLUFFER elite.
export type InfoLevel = 'open' | 'veiled' | 'opaque';
export interface InfoOverride {
  readonly stance?: InfoLevel;
  readonly focus?: InfoLevel;
}

// Later-stage knob value types — declared as DATA now (forward-compatible);
// their tree behavior lands in Stage 2/3 / Layer 3.
export type BondLevel = 'none' | 'mid' | 'high'; // → the Call toolkit (Stage 2)
export type CallUse = 'never' | 'clutch' | 'liberal' | 'defensive'; // (Stage 2)

export interface TrainerProfile {
  readonly name: string;
  // 1. STANCE — base-triangle preference when single-stepping. [LIVE]
  readonly stance: StanceTendency;
  // 2. TWO-STEP — whether/how often it FOCUSES. [LIVE]
  readonly twoStep: TwoStepTendency;
  // 3. RELEASE — the R2 release model for two-steppers. [LIVE] Omitted → the
  //    default-for-stance (legacy). Two-steppers should set it.
  readonly release?: ReleaseModel;
  // 6. INFO — one level driving both tells (set at the wiring layer). [LIVE]
  //    Omitted → 'open'. infoOverride is the per-axis Bluffer hook. [hook]
  readonly infoLevel?: InfoLevel;
  readonly infoOverride?: InfoOverride;
  // 4. BOND → Calls — gates the Call toolkit. [DATA; behavior Stage 2]
  readonly bond?: BondLevel;
  // 5. CALL-USE — how it spends Calls. [DATA; behavior Stage 2]
  readonly callUse?: CallUse;
  // 7. TERRAIN — home-turf stance bias. [DATA; behavior Layer 3]
  readonly terrain?: string;
  // 8. ADAPTIVITY — reads the player back. [DATA; behavior Stage 2/3]
  readonly adaptive?: boolean;
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

// The SIGNATURE release of a model (what its wind-up base stance is keyed to).
export function signatureRelease(model: ReleaseModel | undefined): ReleaseKind {
  if (model === undefined || model === 'fixed-Heavy') return 'heavy';
  return model.signature ?? 'heavy';
}

// The R2 release pick — honors release variability (kickoff knob #1). fixed →
// always the signature; variable → FEINT at feintRate (beats Aggressive →
// bounds the masher), else the signature. Omitted → default-for-stance (legacy).
function pickRelease(model: ReleaseModel | undefined, focusStance: Stance, rng: RNG): ReleaseKind {
  if (model === undefined) return defaultReleaseForStance(focusStance);
  if (model === 'fixed-Heavy') return 'heavy';
  return rng.next() < model.feintRate ? 'feint' : (model.signature ?? 'heavy');
}

// The SET of releases a model can produce — for the focus TELL's lens, which
// must stay truthful across BOTH phases (a {signature,feint} variable set maps
// to the lens that contains both → a genuine, consistent 50/50). Distinct only.
export function possibleReleases(model: ReleaseModel | undefined): readonly ReleaseKind[] {
  if (model === undefined || model === 'fixed-Heavy') return ['heavy'];
  const sig = model.signature ?? 'heavy';
  return model.feintRate > 0 && sig !== 'feint' ? [sig, 'feint'] : [sig];
}

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

    // 2. RELEASE CHECK — mid-two-step → release this round (locked in), honoring
    //    the release model (fixed-Heavy or variable feint-mix).
    if (me.focus !== undefined) {
      return { kind: 'release', release: pickRelease(profile.release, me.focus.stance, rng) };
    }

    // 1. THREAT CHECK (Call) — STAGE 2 hook: bond-gated Calls (escape a feared
    //    player Charge) go here, gated on profile.bond + profile.callUse.
    // 3. READ THE PLAYER — STAGE 2/3 hook: a profile.adaptive trainer biases
    //    toward the counter of the player's recent pattern here.

    const focusRate = FOCUS_RATE[profile.twoStep];
    const twoSteps = focusRate > 0;

    // STAMINA-AWARE FOCUSING (kickoff): a two-stepper too winded to fuel its
    // signature charge (heavy is winded-locked) banks stamina with Catch Breath
    // so the charge fires reliably next round. Catch Breath needs ≥1 ★ (the
    // engine doesn't validate foe actions, so self-gate). Distinct from the
    // banked gust-stamina-TAX (a Layer-3 environment mechanic, not this).
    if (twoSteps && isWinded(me) && me.momentum >= 1 && !me.exhausted) {
      return { kind: 'catchBreath' };
    }

    const aff = affordableMoves(me);
    if (aff.length === 0) return { kind: 'rest' };

    // 4. ESCALATION CHECK — two-step roll per tendency. A focus commits a base
    //    stance tied to the release model's SIGNATURE (or a drawn stance when
    //    no model is set); the actual R2 release is picked above on release.
    if (twoSteps && rng.next() < focusRate) {
      const baseStance = profile.release
        ? STANCE_FOR_RELEASE[signatureRelease(profile.release)]
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
// The shipped CH1 FLOOR trainers (stamped from the catalog's floor profiles).
// All: single-only or fixed-Heavy, low-bond, OPEN info, area-locked — they
// teach the base triangle. No NEW trainers here until the CH1 trainer-data
// hand-off (per kickoff scope); the mid/elite catalog profiles stamp later.
export const TRAINER_PROFILES: { readonly [id: string]: TrainerProfile } = {
  // GREENHORN floor: a clean base-triangle read, never focuses.
  youngster: { name: 'YOUNGSTER MILO', stance: 'balanced', twoStep: 'single-only', infoLevel: 'open' },
  // BRUISER→Charger floor: pressures Aggressive + sometimes FOCUSES into HEAVY
  // (fixed-Heavy — the Gym-1 teaching tell). The player's first hidden-release
  // read; open info leaks a learnable narrowing.
  jay: { name: 'JAY', stance: 'aggressor', twoStep: 'occasional', release: 'fixed-Heavy', infoLevel: 'open' },
  // TURTLE floor: Guard-heavy wall — slip it with Fluid. No focus.
  lass: { name: 'LASS BRYN', stance: 'bulwark', twoStep: 'single-only', infoLevel: 'open' },
  // ── CH1 floor stamps (docs/trainer-sets-ch1.md) — shared class templates ──
  // Single-only floor: no two-step, no Calls, OPEN info, Fixed, no terrain.
  // Nothing here mixes Feint (variable release is Gym 2). GREENHORN reuses the
  // `youngster` profile above.
  // BRUISER — Aggressor floor: leans Aggressive (punishes passivity); bait the
  // commit with Guard. Low-bond → locked in (can't escape your counter).
  bruiser: { name: 'BRUISER', stance: 'aggressor', twoStep: 'single-only', infoLevel: 'open' },
  // SKIRMISHER — Evader floor: Fluid initiative first-strikes; catch it with
  // Aggressive. Low-bond → can't punish you back.
  skirmisher: { name: 'SKIRMISHER', stance: 'evader', twoStep: 'single-only', infoLevel: 'open' },
  // KAMON — the RIVAL profile at its EARLIEST rung (fight 1; docs/kamon-rival-
  // card-v2.md). Aggressor (raw strength is his creed), Single-only, no-bond
  // (he CAN'T Call — his ideology is his mechanical weakness), Open, Fixed. His
  // arc climbs this profile later (→ two-step, Reactive); his stolen starter's
  // bond-factor 0.85 is the bespoke team modifier (applied at team build, not
  // here). Knobs match the floor Aggressor today; kept distinct for the arc.
  kamon: { name: 'KAMON', stance: 'aggressor', twoStep: 'single-only', infoLevel: 'open' },
};

// Which trainer (by its overworld win-flag) gets which profile. The game maps a
// trainer encounter's win-flag through here: a flag WITH a profile fights via
// trainerPolicy; a flag WITHOUT one (and every wild encounter) falls back to
// wildFoeAI — so unprofiled trainers + wild battles stay bit-identical. Both
// Route 31 map variants reuse these flags. (Falkner is a boss → falknerBossAI.)
export const TRAINER_PROFILE_BY_FLAG: { readonly [winFlag: string]: string } = {
  // Stage-1 originals (unchanged — JAY is the bespoke fixed-Heavy focuser).
  route31_youngster_beaten: 'youngster',
  route31_trainer_beaten: 'jay',
  route31_lass_beaten: 'lass',
  // ── CH1 generic roster (docs/trainer-sets-ch1.md) ──
  route31_camper_beaten: 'bruiser', // ⟨Rourke⟩ Camper
  route31_birdkeeper_beaten: 'skirmisher', // ⟨Wren⟩ Bird Keeper
  route31_youngster2_beaten: 'youngster', // ⟨Pax⟩ Youngster (GREENHORN)
  violet_schoolkid_beaten: 'youngster', // ⟨Dell⟩ Schoolkid (GREENHORN) — optional
  // Violet Gym chaff — Bird Keeper / SKIRMISHER (the NPCs already exist in
  // gym.json; routing their flags is pure data — they were on wildFoeAI before).
  gym_trainer_beaten: 'skirmisher',
  gym_trainer_2_beaten: 'skirmisher',
  gym_trainer_3_beaten: 'skirmisher',
  gym_trainer_4_beaten: 'skirmisher',
};

// The routing primitive: a trainer's profile, or undefined → caller uses
// wildFoeAI. Pure + testable (the profile-vs-wildAI routing gate).
export function foeProfileForFlag(winFlag: string): TrainerProfile | undefined {
  const id = TRAINER_PROFILE_BY_FLAG[winFlag];
  return id ? TRAINER_PROFILES[id] : undefined;
}
