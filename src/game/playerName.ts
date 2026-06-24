// Player character name — the source of the [player] token (e.g. KAMON's CH1
// ending sign-off "See you out there, [player]"). Captured at new-game start via
// the reusable nameEntry primitive (see scenes/nameEntry.ts), stored on the run,
// and persisted (additive save field). This module owns the one rule the token
// consumers depend on: resolve a stored value to a usable name, or to null.
//
// null = the GRACEFUL DROP: token consumers (kamonGateLines) omit the address
// entirely, exactly as they did before a name system existed. A blank/whitespace
// name therefore never breaks a line — and a real name is always preferred.

import { sanitizeName } from './scenes/nameEntry';

export function resolvePlayerName(stored: string | null | undefined): string | null {
  const s = sanitizeName(stored ?? '');
  return s.length > 0 ? s : null;
}
