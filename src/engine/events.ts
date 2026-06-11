import type { Side, Stance } from './types';

export type CommitDescriptor =
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance }
  | { readonly kind: 'rest'; readonly reason: 'softlock' | 'exhaustion' }
  | { readonly kind: 'catchBreath' };

export type BattleEvent =
  | { readonly kind: 'roundStart'; readonly round: number }
  | { readonly kind: 'commit'; readonly side: Side; readonly action: CommitDescriptor }
  | { readonly kind: 'catchBreath'; readonly side: Side; readonly restored: number }
  | { readonly kind: 'clash'; readonly winner: Side }
  | { readonly kind: 'strike'; readonly side: Side; readonly move: string; readonly damage: number; readonly effectiveness: number }
  | { readonly kind: 'dodge'; readonly side: Side }
  | { readonly kind: 'opening'; readonly side: Side; readonly damage: number; readonly effectiveness: number }
  | { readonly kind: 'counter'; readonly side: Side; readonly damage: number }
  | { readonly kind: 'staggered'; readonly side: Side }
  | { readonly kind: 'momentum'; readonly side: Side; readonly total: number }
  | { readonly kind: 'winded'; readonly side: Side }
  | { readonly kind: 'exhausted'; readonly side: Side }
  | { readonly kind: 'ko'; readonly side: Side };
