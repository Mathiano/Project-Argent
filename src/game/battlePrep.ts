// Battle-prep: how a party SideState is prepared to ENTER a battle.
//
// firstroad-fixes S1 (Mathias ruling): STAMINA resets to full at the
// start of every battle. HP is the PERSISTENT resource (the cost of
// fighting — healed at Centers/potions); ST is the PER-BATTLE TACTICAL
// resource (fresh each fight). Non-resetting ST + the tuned higher TTK
// forced constant healing — the grind the design rejects.
//
// MOMENTUM-★ is the SAME kind of resource (per-battle): it RESETS TO ZERO
// each fight. ★ is earned-and-spent WITHIN one battle (the "spend now or
// bank for later THIS fight" tension); if it carried over, the player could
// farm ★ on easy trainers and dump it on a boss — an exploit. So ST and ★
// reset per fight; HP and bond persist across the journey. (The Tier-I
// jumpstart re-arms each battle in buildPlayerTeam — a per-battle perk, not
// a carryover of banked ★.)
//
// Pure + headless so it's unit-tested directly (main.ts's buildPlayerTeam
// funnels every player battle through it). Foes already build fresh via
// createSide (st = the mon's maxSt, momentum 0); this brings the carried-over
// party in line.

import type { SideState } from '../engine';

// Base stamina cap for a mon with no authored stamina (matches createSide's
// `sp.stamina ?? 100`). Per-mon stamina (stat-foundation) supersedes it: a
// carried-over side resets to its OWN maxSt below.
export const FULL_ST = 100;

// Prepare one carried-over party mon to enter a battle: HP / species carry
// over unchanged; ST resets to the mon's OWN full stamina (maxSt — per-mon now)
// and MOMENTUM-★ resets to 0 (both per-battle resources); round-local flags
// (exhausted / staggered) clear.
export function freshBattleSide(side: SideState): SideState {
  return { ...side, st: side.maxSt, momentum: 0, exhausted: false, staggered: false };
}
