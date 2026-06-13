import type { Side, Stance } from './types';

export type CommitDescriptor =
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance }
  | { readonly kind: 'rest'; readonly reason: 'softlock' | 'exhaustion' }
  | { readonly kind: 'catchBreath' };

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
  | { readonly kind: 'dodge'; readonly side: Side }
  | { readonly kind: 'opening'; readonly side: Side; readonly damage: number; readonly effectiveness: number }
  | { readonly kind: 'counter'; readonly side: Side; readonly damage: number }
  | { readonly kind: 'staggered'; readonly side: Side }
  | { readonly kind: 'momentum'; readonly side: Side; readonly total: number }
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
