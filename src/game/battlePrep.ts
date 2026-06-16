// Battle-prep: how a party SideState is prepared to ENTER a battle.
//
// firstroad-fixes S1 (Mathias ruling): STAMINA resets to full at the
// start of every battle. HP is the PERSISTENT resource (the cost of
// fighting — healed at Centers/potions); ST is the PER-BATTLE TACTICAL
// resource (fresh each fight). Non-resetting ST + the tuned higher TTK
// forced constant healing — the grind the design rejects.
//
// Pure + headless so it's unit-tested directly (main.ts's buildPlayerTeam
// funnels every player battle through it). Foes already build fresh via
// createSide (st 100); this brings the carried-over party in line.

import type { SideState } from '../engine';

// Full stamina (the engine's createSide also starts mons here; ST is
// clamped to [0,100] everywhere).
export const FULL_ST = 100;

// Prepare one carried-over party mon to enter a battle: HP / momentum /
// species carry over unchanged; ST resets to full; round-local flags
// (exhausted / staggered) clear.
export function freshBattleSide(side: SideState): SideState {
  return { ...side, st: FULL_ST, exhausted: false, staggered: false };
}
