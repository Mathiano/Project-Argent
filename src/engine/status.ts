import { COMBAT, STATUS } from './config';
import type { BattleEvent } from './events';
import type { Move, Side, SideState, Stance, StatusKind } from './types';

// Statuses that resolve INSTANTLY on application (an immediate ★/ST swing) and
// leave NO lingering status — so they don't occupy the one-debuff slot or a
// buff entry. The rest are lingering (checked at their economy/combat sites).
//   sapFocus −1★ · secondWind +1★ (Wave A) · sap burst-drains stamina (Wave B).
const INSTANT_STATUSES: ReadonlySet<string> = new Set(['sapFocus', 'secondWind', 'sap']);

// CONTROL stance-locks (Wave B): they force the bearer's stance and carry
// diminishing returns on re-apply (escapability — re-locking shrinks then
// RESISTS, so a controller can't chain-lock to death).
const CONTROL_STATUSES: ReadonlySet<string> = new Set(['frozen', 'inception', 'taunt']);

// SELF-ESCALATION statuses (tuning pass #5): repeatable self-buffs / heals /
// ★-gain that a turtle could otherwise spam every turn to invulnerability or
// ★-farm to dominance. They carry the SAME applied-counter DR the control debuffs
// use — the count lives in `side.escalations[status]` and shrinks the effect's
// value on repeat (see escalationFactor + the apply/consume sites below).
// CAST-counted self-escalation (count bumps on each APPLICATION) — the INSTANT
// self-effects: repeated casts diminish (tideMend heal shrinks; secondWind ★-gain
// resists). A long-duration buff would barely move here (cast once, held for many
// rounds), so those are TICK-counted instead (below).
const SELF_ESCALATION_STATUSES: ReadonlySet<string> = new Set(['tideMend', 'secondWind']);

// TICK-counted self-escalation — the LINGERING mitigation/regen buffs. Held
// round-after-round they'd be full-strength forever, so the count bumps once per
// end-of-round TICK (in tickStatuses) and the effect weakens the LONGER the buff
// is maintained: BULWARK/SET STANCE mitigation decays toward neutral, UNDERTOW
// regen shrinks — so a turtle can't hold one buff up to invulnerability. Read by
// buffDamageTakenMult / guardBuffMult / the undertow tick.
const LINGERING_ESCALATION_STATUSES: ReadonlySet<string> = new Set(['bulwark', 'setStance', 'undertow']);

// Diminishing-returns factor for a self-escalation status applied `count` times
// this battle (1 = first cast → 1.0/full). Each repeat shrinks it linearly by
// STATUS.selfEscalationStep, floored at `floor`. The continuous buffs/heals pass
// the config floor (they stay a real edge); SECOND WIND passes 0 so it can fully
// resist (tempo-negative ★-farming). count 0 (never applied / legacy absent) → 1.
function escalationFactor(count: number, floor: number): number {
  if (count <= 1) return 1;
  return Math.max(floor, 1 - STATUS.selfEscalationStep * (count - 1));
}

// The count of prior+this applications of a self-escalation status on a side.
function escalationCount(side: SideState, status: string): number {
  return side.escalations?.[status] ?? 0;
}

// Remove a side's single active debuff (used to CONSUME Corrode when it fizzles
// the bearer's next technique). No-op if there is no debuff.
export function clearDebuff(side: SideState): SideState {
  if (side.debuff === undefined) return side;
  const { debuff: _drop, ...rest } = side;
  return rest;
}

// ── Effect-move + status MECHANISM helpers (Increment 1a) ───────────────────
// Pure + headless. resolveRound wires these into the EXISTING stance triangle
// (no parallel resolution): a technique deals reduced chip damage, a buff
// mitigates incoming damage, and the status lifecycle (apply / tick / clear)
// lives here. Every helper is GATED so a side WITHOUT statuses / a move WITHOUT
// an effect is bit-identical — multipliers collapse to 1.0 (exact in IEEE754)
// and no status events fire.

// A status a strike WILL apply, resolved AFTER the end-of-round tick so a
// freshly-cast status does not tick on its own cast round (the "exposure is the
// cost; the payoff lands next round" rule).
export interface PendingEffect {
  readonly target: Side;
  readonly status: StatusKind;
  readonly polarity: 'buff' | 'debuff';
  readonly duration: number;
  // The forced stance for a stance-lock control debuff (Wave B). Absent otherwise.
  readonly stance?: Stance;
}

// Effect moves deal REDUCED chip damage (so a missed read isn't a dead turn).
// Returns 1 for the 43 damage moves (no effect) → bit-identical.
export function effectDamageFactor(move: Move): number {
  const e = move.effect;
  if (e === undefined) return 1;
  return e.damageFactor ?? STATUS.effectMoveDamageFactor;
}

// Incoming-damage multiplier from a side's active BUFFS — buffs stack → multiply.
// BULWARK/ENTANGLE REDUCE incoming (defensive, <1); GLASS EDGE INCREASES it
// (the glass-cannon's real, sim-measurable cost, >1). SET STANCE is NOT here —
// it is GUARD-CONDITIONAL (guardBuffMult), not a flat DR. Returns 1 when the
// side has no relevant buff → bit-identical for every legacy/sim side.
export function buffDamageTakenMult(side: SideState): number {
  const buffs = side.buffs;
  if (buffs === undefined || buffs.length === 0) return 1;
  let m = 1;
  for (const b of buffs) {
    // BULWARK's mitigation weakens with the self-escalation count (tuning pass #5):
    // a re-cast-every-turn turtle's damage reduction decays toward neutral, so it
    // can't compound to invulnerability. First cast = full 0.85; count 0 (legacy /
    // never re-applied) → factor 1 → full → bit-identical.
    if (b.kind === 'bulwark') {
      const f = escalationFactor(escalationCount(side, 'bulwark'), STATUS.selfEscalationFloor);
      m *= 1 - (1 - STATUS.bulwarkDamageTaken) * f;
    } else if (b.kind === 'entangle') m *= STATUS.entangleDamageTaken;
    else if (b.kind === 'glassEdge') m *= STATUS.glassEdgeDamageTaken;
  }
  return m;
}

// Outgoing-damage multiplier from a side's active OFFENSE buffs (FOCUS UP +
// GLASS EDGE deal more; buffs stack → multiply). Applied to the attacker's
// damage in both the single-step (resolveStrike) and focus (rawHit) paths.
// Returns 1 when the side has no offense buff → bit-identical.
export function buffDamageDealtMult(side: SideState): number {
  const buffs = side.buffs;
  if (buffs === undefined || buffs.length === 0) return 1;
  let m = 1;
  for (const b of buffs) {
    if (b.kind === 'focusUp') m *= STATUS.focusUpDamageDealt;
    else if (b.kind === 'glassEdge') m *= STATUS.glassEdgeDamageDealt;
  }
  return m;
}

// SET STANCE (STONE poker) — the extra mitigation a BRACING bearer gets. Returns
// <1 only when the side holds a setStance buff (the caller applies it ONLY on
// the Guard-defense path, so the buff strengthens Brace specifically rather than
// being a flat DR); 1 otherwise → bit-identical.
export function guardBuffMult(side: SideState): number {
  const buffs = side.buffs;
  if (buffs === undefined || buffs.length === 0) return 1;
  if (!buffs.some((b) => b.kind === 'setStance')) return 1;
  // SET STANCE's Guard mitigation weakens with the self-escalation count (tuning
  // pass #5) — the conditional-DR turtle's edge is capped like BULWARK's.
  const f = escalationFactor(escalationCount(side, 'setStance'), STATUS.selfEscalationFloor);
  return 1 - (1 - STATUS.setStanceGuardTaken) * f;
}

// Base duration for a freshly-applied status — per-kind via STATUS.statusDurations
// (Silence/Call Lock bounded short, Echo a single round), else the base duration.
export function durationForStatus(kind: StatusKind): number {
  return STATUS.statusDurations[kind] ?? STATUS.baseDuration;
}

// Apply a pending status onto its target side. A DEBUFF REPLACES the single
// active debuff (the locked "one debuff at a time" rule). DIFFERENT buffs STACK
// (cumulative self-improvement); re-applying the SAME buff REFRESHES its
// duration rather than stacking a second multiplier — the canonical
// diminishing-returns anti-spam lever (combat-design-canonical.md §4), which
// also stops a same-buff turtle from compounding DR to invulnerability. Emits
// statusApply. Caller guards target.hp > 0.
export function applyPendingEffect(
  side: SideState,
  pe: PendingEffect,
  sideKey: Side,
  events: BattleEvent[],
): SideState {
  // CONTROL re-apply DIMINISHING RETURNS — checked BEFORE announcing, so a
  // resisted re-lock emits statusResist (not statusApply). Re-applying the SAME
  // lock while active shrinks the new duration; once it would be ≤0 it RESISTS,
  // guaranteeing the bearer eventually breaks free (escapability). A fresh lock
  // (none active) falls through to the full-duration apply below.
  if (pe.polarity === 'debuff' && CONTROL_STATUSES.has(pe.status) && side.debuff?.kind === pe.status) {
    const applied = (side.debuff.applied ?? 1) + 1;
    const dur = Math.max(0, pe.duration - (applied - 1));
    if (dur <= 0) {
      events.push({ kind: 'statusResist', side: sideKey, status: pe.status });
      return side; // resisted — the lock does not refresh
    }
    events.push({ kind: 'statusApply', side: sideKey, status: pe.status, duration: dur });
    return {
      ...side,
      debuff: { kind: pe.status, duration: dur, applied, ...(pe.stance ? { stance: pe.stance } : {}) },
    };
  }
  // SELF-ESCALATION DR bookkeeping (tuning pass #5): count THIS application of a
  // repeatable self-escalation status (bulwark/setStance/tideMend/secondWind), and
  // stamp the bumped counter onto whatever side each path returns (withEsc). The
  // effect paths below read escCount to shrink their value. Non-escalation statuses
  // → escCount 0, withEsc a no-op → bit-identical.
  const escCount = SELF_ESCALATION_STATUSES.has(pe.status) ? escalationCount(side, pe.status) + 1 : 0;
  const withEsc = (s: SideState): SideState =>
    escCount > 0 ? { ...s, escalations: { ...(s.escalations ?? {}), [pe.status]: escCount } } : s;
  // ── Wave C instant SELF-effects (heal / lifesteal / cleanse) ────────────────
  // Resolve the swing NOW and leave NO lingering buff (so no buff entry, no
  // statusApply). Reached via the buff path; SIPHON's 'drain' is read-win-gated
  // at the CALL site (resolveStrike), so by here it has already earned its heal.
  if (pe.status === 'tideMend' || pe.status === 'drain') {
    // tideMend is a REPEATABLE self-heal → DR its heal % (a heal-turtle can't
    // out-sustain safe-damage indefinitely). SIPHON's 'drain' is read-win-gated
    // (it earned the heal), so it keeps full potency.
    const basePct = pe.status === 'tideMend' ? STATUS.tideMendHealPct : STATUS.siphonHealPct;
    const pct =
      pe.status === 'tideMend' ? basePct * escalationFactor(escCount, STATUS.selfEscalationHealFloor) : basePct;
    const hp = Math.min(side.maxHp, side.hp + Math.round(side.maxHp * pct));
    if (hp !== side.hp) events.push({ kind: 'recover', side: sideKey, healed: hp - side.hp });
    return withEsc({ ...side, hp });
  }
  // WANE / STEADY (cleanse) + REFORGE (cleanse + minor heal): clear the bearer's
  // single active debuff (the non-Resolve counterplay valve), and REFORGE also
  // patches a little HP. A statusBreak narrates the forcibly-ended debuff.
  if (pe.status === 'cleanse' || pe.status === 'reforge') {
    let s = side;
    if (s.debuff !== undefined) {
      events.push({ kind: 'statusBreak', side: sideKey, status: s.debuff.kind });
      s = clearDebuff(s);
    }
    if (pe.status === 'reforge') {
      const hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * STATUS.reforgeHealPct));
      if (hp !== s.hp) events.push({ kind: 'recover', side: sideKey, healed: hp - s.hp });
      s = { ...s, hp };
    }
    return s;
  }
  events.push({ kind: 'statusApply', side: sideKey, status: pe.status, duration: pe.duration });
  // ── Instant effects — apply the swing now, leave no lingering status. ───────
  // SAP (Wave B, debuff): burst-drain the foe's stamina.
  if (pe.status === 'sap') {
    const st = Math.max(0, side.st - STATUS.sapStaminaBurst);
    events.push({ kind: 'stamina', side: sideKey, before: side.st, after: st, netDelta: st - side.st });
    return { ...side, st, exhausted: st <= 0 ? true : side.exhausted };
  }
  // SAP FOCUS −1★ (Wave A) / SECOND WIND +1★ (Wave A).
  if (INSTANT_STATUSES.has(pe.status)) {
    // SECOND WIND is a REPEATABLE self-★-gain → only the first `secondWindMaxCasts`
    // casts grant ★; the rest RESIST (→ 0). One early FULL POWER nuke otherwise
    // snowballs, so capping the productive casts makes ★-farming tempo-negative.
    const secondWindGain = escCount <= STATUS.secondWindMaxCasts ? STATUS.secondWindAmount : 0;
    const total =
      pe.status === 'secondWind'
        ? Math.min(COMBAT.momentumCap, side.momentum + secondWindGain)
        : Math.max(0, side.momentum - STATUS.sapFocusAmount); // sapFocus
    events.push({ kind: 'momentum', side: sideKey, total });
    return withEsc({ ...side, momentum: total });
  }
  if (pe.polarity === 'debuff') {
    // Fresh debuff (incl. a first-time control lock → applied:1 + forced stance).
    return {
      ...side,
      debuff: {
        kind: pe.status,
        duration: pe.duration,
        ...(CONTROL_STATUSES.has(pe.status) ? { applied: 1 } : {}),
        ...(pe.stance ? { stance: pe.stance } : {}),
      },
    };
  }
  const buffs = side.buffs ?? [];
  const fresh = { kind: pe.status, duration: pe.duration };
  const hasSame = buffs.some((b) => b.kind === pe.status);
  const next = hasSame
    ? buffs.map((b) => (b.kind === pe.status ? fresh : b)) // refresh in place
    : [...buffs, fresh]; // a new, distinct buff → stack
  // Lingering self-escalation buffs (bulwark/setStance) carry the bumped counter;
  // buffDamageTakenMult / guardBuffMult read it to DR the mitigation on repeat.
  return withEsc({ ...side, buffs: next });
}

// End-of-round tick for the statuses CARRIED INTO this round: DoT damage (Burn)
// + duration decrement + expiry. A fainted mon (hp ≤ 0) does not tick. Emits
// statusTick / statusClear (and a 'ko' if DoT drops the bearer — the faint flow
// in resolveRound then narrates the faint). No status → returns the same side,
// no events (bit-identical).
export function tickStatuses(
  side: SideState,
  sideKey: Side,
  events: BattleEvent[],
): SideState {
  if (side.hp <= 0) return side;
  let s = side;

  // Active debuff: DoT (Burn HP / Drained stamina) then decrement / expire.
  if (s.debuff !== undefined) {
    const deb = s.debuff; // captured (narrowed) before the drained reassign below
    const kind = deb.kind;
    const remaining = deb.duration - 1;
    const dot = kind === 'burn' ? Math.round(s.maxHp * STATUS.burnDotPct) : 0;
    const hp = dot > 0 ? Math.max(0, s.hp - dot) : s.hp;
    // DRAINED (Wave B): bleed stamina each round (a separate 'stamina' event).
    if (kind === 'drained') {
      const st = Math.max(0, s.st - STATUS.drainedStaminaDot);
      if (st !== s.st) {
        events.push({ kind: 'stamina', side: sideKey, before: s.st, after: st, netDelta: st - s.st });
        s = { ...s, st, exhausted: st <= 0 ? true : s.exhausted };
      }
    }
    events.push({
      kind: 'statusTick',
      side: sideKey,
      status: kind,
      remaining: Math.max(0, remaining),
      ...(dot > 0 ? { damage: dot } : {}),
    });
    if (remaining <= 0) {
      events.push({ kind: 'statusClear', side: sideKey, status: kind });
      const { debuff: _drop, ...rest } = s;
      s = { ...rest, hp };
    } else {
      // Preserve applied (DR count) + stance (the forced stance) across ticks.
      s = { ...s, hp, debuff: { ...deb, duration: remaining } };
    }
    if (hp <= 0) events.push({ kind: 'ko', side: sideKey });
  }

  // Stacking buffs: decrement each, drop expired.
  const buffs = s.buffs;
  if (buffs !== undefined && buffs.length > 0) {
    const kept: { kind: StatusKind; duration: number }[] = [];
    for (const b of buffs) {
      const remaining = b.duration - 1;
      // TICK-counted self-escalation DR (tuning pass #5): a lingering mitigation /
      // regen buff bumps its escalation count once per tick, so holding it longer
      // weakens it (the count is read at the mitigation/regen sites). count 0
      // (legacy, never ticked) → factor 1 → full → bit-identical.
      if (LINGERING_ESCALATION_STATUSES.has(b.kind)) {
        s = { ...s, escalations: { ...(s.escalations ?? {}), [b.kind]: escalationCount(s, b.kind) + 1 } };
      }
      // UNDERTOW (AQUA HoT): heal a slice of maxHp each tick (regenerating tank),
      // scaled by its now-bumped escalation factor — a heal-turtle can't out-heal
      // safe-damage indefinitely (no unkillable healer / stall).
      if (b.kind === 'undertow' && s.hp > 0) {
        const f = escalationFactor(escalationCount(s, 'undertow'), STATUS.selfEscalationHealFloor);
        const hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * STATUS.undertowHealPct * f));
        if (hp !== s.hp) {
          events.push({ kind: 'recover', side: sideKey, healed: hp - s.hp });
          s = { ...s, hp };
        }
      }
      events.push({
        kind: 'statusTick',
        side: sideKey,
        status: b.kind,
        remaining: Math.max(0, remaining),
      });
      if (remaining <= 0) events.push({ kind: 'statusClear', side: sideKey, status: b.kind });
      else kept.push({ kind: b.kind, duration: remaining });
    }
    if (kept.length > 0) s = { ...s, buffs: kept };
    else {
      const { buffs: _drop, ...rest } = s;
      s = rest;
    }
  }

  return s;
}
