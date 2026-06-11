export type Side = 'player' | 'foe';

export type Stance = 'A' | 'G' | 'F';

export type TierName = 'light' | 'mid' | 'heavy' | 'nuke';

export type ElementType = 'Flame' | 'Sprout' | 'Splash';

export interface Tier {
  readonly name: TierName;
  readonly power: number;
  readonly cost: number;
  readonly weight: number;
  readonly delayNext?: boolean;
}

export interface Move {
  readonly name: string;
  readonly tier: TierName;
  readonly type: ElementType | null;
}

export interface Species {
  readonly name: string;
  readonly type: ElementType | null;
  readonly hp: number;
  readonly atk: number;
  readonly dfn: number;
  readonly spd: number;
  readonly moves: readonly string[];
  readonly spr?: string;
}

export interface SideState {
  readonly species: Species;
  readonly hp: number;
  readonly maxHp: number;
  readonly st: number;
  readonly exhausted: boolean;
  readonly staggered: boolean;
  readonly momentum: number;
}

export interface TurnHistoryEntry {
  readonly player: Stance | null;
  readonly foe: Stance | null;
}

export interface BattleState {
  readonly player: SideState;
  readonly foe: SideState;
  readonly round: number;
  readonly history: readonly TurnHistoryEntry[];
}

export type Action =
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance }
  | { readonly kind: 'rest' }
  | { readonly kind: 'catchBreath' };

export interface StatScale {
  readonly hp?: number;
  readonly atk?: number;
  readonly dfn?: number;
  readonly spd?: number;
}

export interface BossCard {
  readonly species: Species;
  readonly statScale?: StatScale;
  readonly breakBar?: number;
}
