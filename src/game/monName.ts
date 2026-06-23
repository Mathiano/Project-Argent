import type { SideState } from '../engine';

// The player-facing display name for one of the PLAYER's own mons: the chosen
// nickname when set, otherwise the species name. Wild/enemy mons are never named
// through this — they always show their species. Validation/sanitizing happens
// once, at nickname-set time (see scenes/nameEntry); this is a pure read so it
// is safe to call on every render frame and in battle log lines.
export function monDisplayName(mon: Pick<SideState, 'nickname' | 'species'>): string {
  return mon.nickname && mon.nickname.length > 0 ? mon.nickname : mon.species.name;
}
