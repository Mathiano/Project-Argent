// Gym BADGES — the ids a leader win pushes into run.badges, plus the table of
// world flags DERIVED from them (gym2-plan Step 6).
//
// Before this the one badge lived as a lone constant in main.ts and its flag was a
// hand-written if/else in recomputeSignpostFlags; a second gym would have meant a
// second hand-written branch. Now a badge's world flag is one row here.
//
// Ids only — which leader awards which badge lives on the leader's spec
// (leaders.ts); which evolutions a badge unlocks lives in evolution.ts.
// Pure data, no DOM.

// Gym 1 — Falkner.
export const ZEPHYR_BADGE = 'ZEPHYR';
// Gym 2 — the id evolution.ts already gates the starter + stage-2→3 evos on.
// No leader awards it yet (the Gym-2 card is an open ruling), so it raises no flag.
export const HIVE_BADGE = 'HIVE';

export interface BadgeFlagRow {
  readonly badge: string;
  // Set while the badge is held, unset otherwise — recomputed on load, so it can
  // never drift from run.badges.
  readonly flag: string;
}

export const BADGE_FLAGS: readonly BadgeFlagRow[] = [
  // Gates the Violet→Route 32 obstacle (gone once earned) and KAMON's spawn
  // (present once earned).
  { badge: ZEPHYR_BADGE, flag: 'zephyr_earned' },
];
