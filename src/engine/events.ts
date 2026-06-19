import type { CallKind, ReleaseKind, Side, Stance } from './types';

export type CommitDescriptor =
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance }
  // FOCUS model — R1 a generic Focus (release hidden), or R2 the chosen release.
  | { readonly kind: 'focus' }
  | { readonly kind: 'release'; readonly release: ReleaseKind }
  | { readonly kind: 'call'; readonly call: CallKind }
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
  // ── Combat FOCUS events ───────────────────────────────────────────────
  // A side initiated a FOCUS (R1). Generic — the release is HIDDEN; the
  // opponent only sees "gathering energy". `costDamage` is what the focuser
  // took this round (0 if unopposed); the focuser dealt nothing.
  | { readonly kind: 'focus'; readonly side: Side; readonly costDamage: number }
  // A Focus RELEASED (R2). `release` is the chosen kind; `outcome` is the
  // rotation/flip/mismatch verdict; `damage` is what landed on the opponent.
  | {
      readonly kind: 'release';
      readonly side: Side;
      readonly release: ReleaseKind;
      readonly outcome: 'win' | 'lose' | 'neutral';
      readonly damage: number;
      readonly effectiveness: number;
      // Context for the callout: the opponent's single-step stance it resolved
      // against (null when the opponent also released or was focusing), and
      // whether this was a timing-mismatch (vs a focusing opponent).
      readonly vsStance?: Stance;
      readonly vsFocus?: boolean;
    }
  // Both sides released — the FLIPPED triangle resolved (HIDE>HEAVY>FEINT>HIDE).
  // `winner` null on a mirror. `winnerRelease`/`loserRelease` name the releases.
  | {
      readonly kind: 'flipResolve';
      readonly winner: Side | null;
      readonly winnerRelease?: ReleaseKind;
      readonly loserRelease?: ReleaseKind;
    }
  // A ★-Call override fired. `side` is the caller (spent 1 ★).
  | { readonly kind: 'call'; readonly side: Side; readonly call: CallKind }
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
