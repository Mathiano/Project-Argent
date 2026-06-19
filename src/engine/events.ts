import type { Side, Stance } from './types';

export type CommitDescriptor =
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance }
  | { readonly kind: 'rest'; readonly reason: 'softlock' | 'exhaustion' }
  | { readonly kind: 'catchBreath' }
  | { readonly kind: 'throwBall' };

export interface SideSnapshot {
  readonly hp: number;
  readonly maxHp: number;
  readonly st: number;
  readonly momentum: number;
  readonly exhausted: boolean;
  readonly staggered: boolean;
}

export type BattleEvent =
  | {
      readonly kind: 'roundStart';
      readonly round: number;
      readonly player: SideSnapshot;
      readonly foe: SideSnapshot;
    }
  | { readonly kind: 'commit'; readonly side: Side; readonly action: CommitDescriptor }
  | {
      readonly kind: 'initiative';
      readonly playerInit: number;
      readonly foeInit: number;
      readonly first: Side | null;
    }
  | { readonly kind: 'catchBreath'; readonly side: Side; readonly restored: number }
  | { readonly kind: 'clash'; readonly winner: Side }
  | { readonly kind: 'strike'; readonly side: Side; readonly move: string; readonly damage: number; readonly effectiveness: number }
  // Legacy (pre-Layer-1): a Fluid defender evaded an Aggressive strike. NO
  // LONGER EMITTED after the Layer-1 triangle fix (Aggressive beats Fluid →
  // `punish`). Kept for replay/back-compat; safe to remove once nothing reads it.
  | { readonly kind: 'dodge'; readonly side: Side }
  // Layer 1: an Aggressive strike CAUGHT a Fluid defender (the dodger
  // committed) — the read-win on the A>F edge. `side` is the AGGRESSOR (who
  // charges ★). The damage already includes the punish multiplier.
  | { readonly kind: 'punish'; readonly side: Side; readonly damage: number; readonly effectiveness: number }
  // Layer 1: a side picked the same stance 3 rounds running → DAZED this
  // round (took extra damage). `side` is the dazed (predictable) mon.
  | { readonly kind: 'dazed'; readonly side: Side }
  | { readonly kind: 'opening'; readonly side: Side; readonly damage: number; readonly effectiveness: number }
  | { readonly kind: 'counter'; readonly side: Side; readonly damage: number }
  | { readonly kind: 'staggered'; readonly side: Side }
  | { readonly kind: 'momentum'; readonly side: Side; readonly total: number }
  // The bond jumpstart fired: an armed mon's first read-win this battle
  // banked an extra ★ (the momentum event carries the new total; this marks
  // WHY). Emitted only for an armed side — never present in legacy/sim runs.
  | { readonly kind: 'bondJumpstart'; readonly side: Side }
  | {
      readonly kind: 'stamina';
      readonly side: Side;
      readonly before: number;
      readonly after: number;
      readonly netDelta: number;
    }
  | { readonly kind: 'winded'; readonly side: Side }
  | { readonly kind: 'exhausted'; readonly side: Side }
  | { readonly kind: 'ko'; readonly side: Side }
  | {
      readonly kind: 'breakProgress';
      readonly progress: number;
      readonly threshold: number;
    }
  | {
      readonly kind: 'break';
      readonly newPhase: number;
    }
  | {
      readonly kind: 'switchOut';
      readonly side: Side;
      readonly fromIndex: number;
      readonly species: string;
    }
  | {
      readonly kind: 'switchIn';
      readonly side: Side;
      readonly toIndex: number;
      readonly species: string;
    }
  | {
      readonly kind: 'faint';
      readonly side: Side;
      readonly species: string;
    }
  | {
      readonly kind: 'forcedSwitch';
      readonly side: Side;
      readonly toIndex: number;
      readonly species: string;
    };
