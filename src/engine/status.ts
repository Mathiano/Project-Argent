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

// Incoming-damage multiplier from a side's active BUFFS (only BULWARK reduces
// damage today; buffs stack → multiply). Returns 1 when the side has no buffs
// → bit-identical for every legacy/sim side.
export function buffDamageTakenMult(side: SideState): number {
  const buffs = side.buffs;
  if (buffs === undefined || buffs.length === 0) return 1;
  let m = 1;
  for (const b of buffs) if (b.kind === 'bulwark') m *= STATUS.bulwarkDamageTaken;
  return m;
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
    const total =
      pe.status === 'secondWind'
        ? Math.min(COMBAT.momentumCap, side.momentum + STATUS.secondWindAmount)
        : Math.max(0, side.momentum - STATUS.sapFocusAmount); // sapFocus
    events.push({ kind: 'momentum', side: sideKey, total });
    return { ...side, momentum: total };
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
  return { ...side, buffs: next };
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
