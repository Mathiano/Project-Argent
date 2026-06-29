import { STATUS } from './config';
import type { BattleEvent } from './events';
import type { Move, Side, SideState, StatusKind } from './types';

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

// Base duration for a freshly-applied status. Control-class statuses (none of
// the 3 samples) would use the short duration; the rest use the base. Kept a
// function so the wiring increment can branch per-kind without touching callers.
export function durationForStatus(_kind: StatusKind): number {
  return STATUS.baseDuration;
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
  events.push({ kind: 'statusApply', side: sideKey, status: pe.status, duration: pe.duration });
  if (pe.polarity === 'debuff') {
    return { ...side, debuff: { kind: pe.status, duration: pe.duration } };
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

  // Active debuff: DoT (Burn) then decrement / expire.
  if (s.debuff !== undefined) {
    const kind = s.debuff.kind;
    const dot = kind === 'burn' ? Math.round(s.maxHp * STATUS.burnDotPct) : 0;
    const hp = dot > 0 ? Math.max(0, s.hp - dot) : s.hp;
    const remaining = s.debuff.duration - 1;
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
      s = { ...s, hp, debuff: { kind, duration: remaining } };
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
