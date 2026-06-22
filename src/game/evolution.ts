// Phase 6b — Evolution (bond-gated, boss-capped). Build from
// docs/evolution-design.md. NOT level-based. Two gates per evolution:
//   1. bond — the mon's bond has reached the stage this evo sits at
//   2. progress — the gating badge/boss has been beaten
// Whichever is satisfied SECOND triggers it. The 8-badge uncap: an evo
// with progressGate = null (anything that'd gate beyond Gym 8, or a
// post-8-badge catch) is BOND-ONLY. All pure + game-side.

import { bondStage, bondStageName } from './catching';

export interface EvoEntry {
  readonly from: string; // species name (the pre-evo form)
  readonly evolvesTo: string; // species name (the next form)
  readonly bondStage: number; // gate: required bond stage (1–7)
  readonly progressGate: string | null; // required badge id; null = bond-only (uncapped)
}

// CH1 LINES ONLY (the currently-obtainable mons). The other ~185
// manifest mons slot into this same structure per-chapter later.
// Badge ids: ZEPHYR = Gym 1 (Falkner), HIVE = Gym 2 (Bugsy, not built —
// so those stage-2→3 evos are correctly blocked in the demo).
export const CH1_EVOLUTIONS: readonly EvoEntry[] = [
  // STARTERS — stage 1→2 at Companions + Gym 2 (HIVE), stage 2→3 at Partners +
  // Gym 2. The first-evo PROGRESS gate is HIVE (badge 2), NOT ZEPHYR (badge 1):
  // the KAMON first-fight sits at the Violet→Route 32 gate (after ZEPHYR, before
  // HIVE), and its fairness is sim-gated on a STILL-STAGE-1 starter lead — so the
  // starter must not evolve until badge 2 (rivalCard sim; main-story §7). The
  // bond gate is unchanged (stage 3). OTHER CH1 lines keep their ZEPHYR gate.
  { from: 'KINDRAKE', evolvesTo: 'KILNDRAKE', bondStage: 3, progressGate: 'HIVE' },
  { from: 'KILNDRAKE', evolvesTo: 'FORTDRAKE', bondStage: 5, progressGate: 'HIVE' },
  { from: 'GRUBLEAF', evolvesTo: 'VINESNAP', bondStage: 3, progressGate: 'HIVE' },
  { from: 'VINESNAP', evolvesTo: 'WYRMFERN', bondStage: 5, progressGate: 'HIVE' },
  { from: 'SILTSKIP', evolvesTo: 'BRACKSLAP', bondStage: 3, progressGate: 'HIVE' },
  { from: 'BRACKSLAP', evolvesTo: 'CRASHMAW', bondStage: 5, progressGate: 'HIVE' },
  // Route bird — FLITPECK → GALEHAWK (Gym 1).
  { from: 'FLITPECK', evolvesTo: 'GALEHAWK', bondStage: 3, progressGate: 'ZEPHYR' },
  // Cave TERRA line — GRITHOAX → CAVELURE → CHASMTRAP.
  { from: 'GRITHOAX', evolvesTo: 'CAVELURE', bondStage: 3, progressGate: 'ZEPHYR' },
  { from: 'CAVELURE', evolvesTo: 'CHASMTRAP', bondStage: 5, progressGate: 'HIVE' },
  // MARSHMASH — single-stage, no evolution.
];

export function evolutionFor(speciesName: string): EvoEntry | null {
  return CH1_EVOLUTIONS.find((e) => e.from === speciesName) ?? null;
}

export interface EvoGateInput {
  readonly speciesName: string;
  readonly bondValue: number;
  readonly badges: readonly string[];
}

export function bondGateMet(e: EvoEntry, bondValue: number): boolean {
  return bondStage(bondValue) >= e.bondStage;
}
// S3 — the 8-badge uncap: a null progressGate is auto-satisfied (bond-only).
export function progressGateMet(e: EvoEntry, badges: readonly string[]): boolean {
  return e.progressGate === null || badges.includes(e.progressGate);
}
// Both gates (the two-gate rule) on an arbitrary entry — exported so the
// uncap (null progressGate) is directly testable.
export function gatesSatisfied(e: EvoEntry, bondValue: number, badges: readonly string[]): boolean {
  return bondGateMet(e, bondValue) && progressGateMet(e, badges);
}

// The two-gate check (S1): returns the evo entry when BOTH gates are met
// (whichever was satisfied second is what made this flip true), else null.
export function evolutionReady(input: EvoGateInput): EvoEntry | null {
  const e = evolutionFor(input.speciesName);
  if (!e) return null;
  return gatesSatisfied(e, input.bondValue, input.badges) ? e : null;
}

// S4b — the summary readiness line. Null = don't tease (no evo, or bond
// not close yet).
export function evolutionReadiness(input: EvoGateInput): string | null {
  const e = evolutionFor(input.speciesName);
  if (!e) return null;
  const bondMet = bondGateMet(e, input.bondValue);
  const badgeMet = progressGateMet(e, input.badges);
  if (bondMet && badgeMet) return 'Ready to evolve!';
  if (bondMet && !badgeMet) return 'Ready once you earn the next badge.';
  return null;
}

// S4a — the "ask your mon" flavored response (bond + readiness).
export function askResponse(input: EvoGateInput): string {
  const e = evolutionFor(input.speciesName);
  const stage = bondStage(input.bondValue);
  if (e) {
    const bondMet = bondGateMet(e, input.bondValue);
    const badgeMet = progressGateMet(e, input.badges);
    if (bondMet && badgeMet) return 'It thrums with a restless light — it’s ready to change, here and now.';
    if (bondMet && !badgeMet) {
      return 'It’s nearly ready — but it’s waiting to see you prove yourself against the next gym first.';
    }
  }
  if (stage >= 6) return 'It leans its weight into you, unhurried. It trusts you completely.';
  if (stage >= 4) return 'It meets your eyes, steady and sure. The two of you are in step.';
  if (stage >= 2) return 'It’s warming to you — there’s the start of something real here.';
  return 'It’s still taking your measure. Fight beside it, and it’ll come around.';
}

// The bond-stage NAME for the summary (when there's no readiness line).
export { bondStageName };
