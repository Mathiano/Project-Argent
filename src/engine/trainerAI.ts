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

import { COMBAT } from './config';
import {
  affordableAttacks,
  affordableMoves,
  affordableTechniques,
  forcedAction,
  isWinded,
  lookupMove,
} from './state';
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
  // FUTURE-ADOPT Calls (Part C) — DATA ONLY, UNREAD by the tree this increment.
  // The trainer casts only the CLASSIC toolkit now (trainerCall below). The
  // info-war pair (readThem/throwOff) enters trainer policy at part-B/Reactive
  // (a trainer READ THEM has nothing to act on until Reactive reads exist);
  // COME BACK enters when multi-mon trainer switching AI lands. Flagged here so
  // that increment ADOPTS by reading this field, not by re-deciding per profile.
  readonly futureCalls?: readonly ('readThem' | 'throwOff' | 'comeBack')[];
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

// Rate at which a profiled trainer casts a technique from its 2 TECHNIQUE slots
// (two-pool §2) on a non-focus single-step round, when one is affordable. Low —
// so battles FEATURE techniques without a trainer turtling on a buff/heal. A
// starting value (Part A); smarter tech-AI is the AI-refinement pass.
const TECH_CAST_RATE = 0.25;

// The pickers below choose a DAMAGE move — always from the ATTACKS pool (a
// technique is never a damage pick; the tree casts techniques via an explicit
// branch). Callers pass affordableAttacks(me).
// A committed Focus wants the heaviest affordable ATTACK (the wind-up pays its
// move cost; the release strike then rides that move's power).
function pickFocusMove(atk: readonly string[]): string {
  return atk.find((n) => lookupMove(n).tier === 'heavy') ?? pickSustainableMove(atk);
}

// A single-step wants a sustainable mid/light ATTACK (stamina-frugal).
function pickSustainableMove(atk: readonly string[]): string {
  return (
    atk.find((n) => lookupMove(n).tier === 'mid') ??
    atk.find((n) => lookupMove(n).tier === 'light') ??
    atk[0]!
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

// HP fraction at/below which a clutch/defensive trainer reaches for RECOVER.
const TRAINER_RECOVER_HP_PCT = 0.4;

// ── STAGE 2 — bond-gated trainer Calls ──────────────────────────────────────
// A trainer's Call TOOLKIT is gated by its bond with its mon, and its SPENDING
// PERSONALITY by callUse — same ★ costs as the player (symmetric + baitable):
//   TOOLKIT   none → no Calls · mid → Catch Breath + Get Away · high → the full
//             classic kit (+ Recover, Dodge, Full Power).
//   PERSONALITY  clutch  hoards ★ (escape a feared release; heal only when low;
//                        bank ST when winded) · liberal spends freely (Dodge on
//                        a feared release; Full Power dump — in the tree) ·
//                        defensive survival-only (Get Away / Recover / Catch
//                        Breath, NEVER Full Power).
// PLAYER-EXCLUSIVE mechanics (bond JUMPSTART, the bond-MOMENT) are SideState
// flags the game arms, never foe Actions — so there is nothing to gate foe-side.
// The three player-exclusive Calls (readThem/throwOff/comeBack) are Part-B/-C
// future-adopt (futureCalls) — a trainer casts none of them this increment.
//
// DETERMINISTIC (no RNG) so a profile's Call behavior is CONSISTENT — the sprite
// tell extends to Calls. GATED on bond mid/high FIRST → a no-bond trainer takes
// this branch to `null` drawing ZERO rng, so every shipped (no-bond) trainer is
// bit-identical. Returns a Call Action, or null to fall through to normal play.
// (Full Power is a fullPower MOVE, not a Call → handled in the tree where the
// affordable ATTACK pool is known.)
function trainerCall(profile: TrainerProfile, state: BattleState, side: Side): Action | null {
  const bond = profile.bond;
  if (bond !== 'mid' && bond !== 'high') return null; // toolkit: none → no Calls
  const use = profile.callUse;
  if (use === undefined || use === 'never') return null;
  const me = activeMon(state[side]);
  if (me.exhausted) return null; // the engine forbids a Call / Catch Breath while exhausted
  if (me.momentum < 1) return null; // every Call costs ≥1★
  const opp = activeMon(state[side === 'player' ? 'foe' : 'player']);
  const full = bond === 'high'; // the full classic kit (Recover / Dodge / Full Power)
  // The opponent carries a focus → it RELEASES this round; escape the hit.
  const oppReleasing = opp.focus !== undefined;
  const lowHp = me.hp <= me.maxHp * TRAINER_RECOVER_HP_PCT;

  // Escape a feared release: liberal spends the clean DODGE (full kit); everyone
  // else the cheaper GET AWAY graze (mid kit). (Reader-bot's proven escape logic.)
  if (oppReleasing) {
    return full && use === 'liberal'
      ? { kind: 'call', call: 'dodge' }
      : { kind: 'call', call: 'getAway' };
  }
  // Survival heal — RECOVER is ONCE PER BATTLE for trainers (Mathias's ruling):
  // a single dramatic gym-ace heal ("no — it healed!") is the beat + a natural
  // second act; the once-rule is a KIT-RULE bound (like player-exclusives are
  // player rules) — same ★1 cost, symmetric. Player Recover stays UNBOUNDED
  // (already skill-gated: ★ only comes from won reads). Tracked engine-side per
  // mon (recoveredThisBattle).
  //
  // SIM NOTE (measured): the once-rule kills the repeatable-heal LOOP in principle
  // but barely moves the win rate (93.5→92.1% vs the reader) — one 50%-maxHP heal
  // on a mitigating profile ≈ a 97% win when it lands. That residual "wall" is
  // ACCEPTED vs the reader FLOOR yardstick specifically: the reader has no heal /
  // burst / Full Power / bait game (the Call expansion outgrew it), and no stall
  // exists (~14 rounds). PROVISIONAL, like the rival bands — the TRUE fairness gate
  // for a real healing elite is its BOSS-CARD ladder + playtest (a human has Full
  // Power / their own Recover / READ THEM / the bait). If playtest shows a real
  // wall → the heal-SIZE lever, with evidence. These profiles are DORMANT, so
  // nothing ships at 92% yet. (Banked: a reader-toolset upgrade as a future
  // deliberate re-baseline — the yardstick should learn the game it measures.)
  if (full && lowHp && me.recoveredThisBattle !== true && (use === 'clutch' || use === 'defensive')) {
    return { kind: 'call', call: 'recover' };
  }
  // Bank stamina when winded (UNIFIES the existing stamina-aware Catch Breath —
  // a bond trainer routes through here; a no-bond two-stepper through the tree).
  if (isWinded(me)) return { kind: 'catchBreath' };
  return null;
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

    // 1. THREAT / CALL CHECK (Stage 2) — bond-gated Calls (escape a feared
    //    release, heal when low, bank stamina when winded), gated on
    //    profile.bond + profile.callUse. No-bond → null (bit-identical, no rng).
    const call = trainerCall(profile, state, side);
    if (call) return call;
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
    const atk = affordableAttacks(me); // damage picks are ATTACKS only

    // FULL POWER dump (liberal, full kit) — a liberal high-bond trainer "rarely
    // banks past 2★": on an attack round with ≥fullPowerCost ★ it spends them on
    // a +50% strike instead of hoarding. A fullPower MOVE (engine resolves it
    // foe-side via foeStrikeMult), never a release. Gated on high-bond+liberal →
    // dead for every shipped (no-bond) trainer → bit-identical.
    if (
      profile.bond === 'high' &&
      profile.callUse === 'liberal' &&
      atk.length > 0 &&
      me.momentum >= COMBAT.fullPowerCost
    ) {
      return { kind: 'move', move: pickSustainableMove(atk), stance: 'A', fullPower: true };
    }

    // 4. ESCALATION CHECK — two-step roll per tendency. A focus commits a base
    //    stance tied to the release model's SIGNATURE (or a drawn stance when
    //    no model is set); the actual R2 release is picked above on release. The
    //    wind-up rides an ATTACK's power (never a technique).
    if (twoSteps && atk.length > 0 && rng.next() < focusRate) {
      const baseStance = profile.release
        ? STANCE_FOR_RELEASE[signatureRelease(profile.release)]
        : drawStance(STANCE_MIX[profile.stance], rng);
      return { kind: 'move', move: pickFocusMove(atk), stance: baseStance, commit: true };
    }

    // 4b. TECHNIQUE CAST (two-pool §2) — occasionally cast from the 2 TECHNIQUE
    //     slots so battles FEATURE techniques. Buffs cast in Guard (low exposure);
    //     debuffs in Aggressive (a chance to land the read on a dodger). The `&&`
    //     short-circuits the rng draw when there is no technique → bit-identical
    //     for tech-less mons (fixtures). Not brilliant by design (Part A).
    const techs = affordableTechniques(me);
    if (techs.length > 0 && rng.next() < TECH_CAST_RATE) {
      const tech = techs[Math.floor(rng.next() * techs.length)]!;
      const isBuff = lookupMove(tech).effect?.polarity === 'buff';
      return { kind: 'move', move: tech, stance: isBuff ? 'G' : 'A' };
    }

    // 5. BASE STANCE — weighted by tendency (+ terrain bias later), avoiding
    //    the thrice-repeat self-daze. Single-step damage is an ATTACK.
    const stance = avoidSelfDaze(drawStance(STANCE_MIX[profile.stance], rng), state, side);
    return { kind: 'move', move: pickSustainableMove(atk), stance };
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
  // ── DORMANT mid/elite catalog profiles (docs/trainer-archetype-catalog.md) ──
  // Bond + callUse ENCODED as data so the Call system has real trainers to drive
  // when they're wired (the mid/elite tiers stamp later). NOT in
  // TRAINER_PROFILE_BY_FLAG → no shipped trainer uses them → the CH1 ladders stay
  // bit-identical. `futureCalls` (Part C) flags the Reactive/team-tempo Calls a
  // profile ADOPTS in a later increment (unread now). adaptive is likewise DATA.
  charger: {
    name: 'CHARGER', stance: 'aggressor', twoStep: 'signature',
    release: { feintRate: 0.35, signature: 'heavy' }, infoLevel: 'veiled',
    bond: 'mid', callUse: 'clutch',
  },
  trickster: {
    name: 'TRICKSTER', stance: 'evader', twoStep: 'signature',
    release: { feintRate: 0.35, signature: 'feint' }, infoLevel: 'veiled',
    bond: 'mid', callUse: 'liberal', adaptive: true, futureCalls: ['readThem', 'throwOff'],
  },
  stonewall: {
    name: 'STONEWALL', stance: 'bulwark', twoStep: 'occasional',
    release: { feintRate: 0.3, signature: 'heavy' }, infoLevel: 'veiled',
    bond: 'high', callUse: 'defensive',
  },
  drifter: {
    name: 'DRIFTER', stance: 'balanced', twoStep: 'occasional',
    release: { feintRate: 0.3, signature: 'heavy' }, infoLevel: 'veiled',
    bond: 'mid', callUse: 'clutch', adaptive: true, futureCalls: ['readThem', 'throwOff', 'comeBack'],
  },
  duelist: {
    name: 'DUELIST', stance: 'evader', twoStep: 'frequent',
    release: { feintRate: 0.3, signature: 'heavy' }, infoLevel: 'veiled',
    bond: 'high', callUse: 'clutch', adaptive: true, futureCalls: ['readThem', 'throwOff', 'comeBack'],
  },
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
