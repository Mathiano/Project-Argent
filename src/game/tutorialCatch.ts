// Catching 2.0 — the in-game TEACHING layer (Phase 7 tutorial-UX, NOT new
// mechanics). The Catching 2.0 math lives in catching.ts and is consumed
// unchanged; this module is the ISOLATED home for the guided-catch tutorial:
// its practice species, the live read->window->throw prompts, and the
// FORGIVING guard-rail values (no-flee, no-Wariness, gentle correction).
//
// Everything here only takes effect when a battle is launched with
// `tutorial: true` — the scripted lab demo (SHOW, in lab.json) and the
// Route 31 first-grass beat (DO, via the start-tutorial-catch verb). Wild and
// trainer catches never import these, so they keep the full rules (Wariness
// rises, the mon can flee). Design: docs/catching-2-0.md (the two-path teach).

import { activeMon, affordableMoves, forcedAction } from '../engine';
import type { Action, BattleState, RNG } from '../engine';

// The contained practice mon (LOCKED). A common early-route bird — the same
// species the player meets wild right after, so the lesson transfers 1:1.
export const TUTORIAL_CATCH_SPECIES = 'FLITPECK';

// ── The guided-catch TRIGGER (onboarding redesign, docs/guided-catch-redesign-note)
// The guided catch fires on the player's FIRST WILD ENCOUNTER on Route 31 (contextual
// — a real mon to catch), NOT on a grass step (which fired in a vacuum). It wraps that
// first encounter as the guided tutorial, then never again. main.ts's onEncounter
// consults this; the practice mon is always TUTORIAL_CATCH_SPECIES (FLITPECK), so the
// tutorial is reliable regardless of which species the zone rolls.
export const GUIDED_CATCH_MAP = 'ROUTE31';
export const GUIDED_CATCH_GATE_FLAG = 'catch_lesson_done'; // the lab lesson is done
export const GUIDED_CATCH_DONE_FLAG = 'route31_guided_catch_done'; // the once-marker

// True when an encounter on `map` should be intercepted as the guided catch: on
// Route 31, after the lab lesson, exactly once.
export function shouldFireGuidedCatch(map: string, has: (flag: string) => boolean): boolean {
  return map === GUIDED_CATCH_MAP && has(GUIDED_CATCH_GATE_FLAG) && !has(GUIDED_CATCH_DONE_FLAG);
}

// The live read->window->throw prompts. The scripted lab DEMO (lab.json)
// mirrors these in dialogue so the watch-the-mentor beat surfaces the exact
// prompts the player then uses live. Placeholder voice — final script pass later.
export const TUTORIAL_INTRO: readonly string[] = [
  'A contained FLITPECK — practice.',
  'Read it, force an opening,',
  'then throw. It cannot flee.',
];

// Shown each decision turn while no opening is exposed yet — the read tell.
export const TUTORIAL_FOE_PROMPT = "It's gathering to lunge — Brace to force an opening!";
// Shown the moment an opening exists (a read window, or an exhausted foe).
export const TUTORIAL_WINDOW_PROMPT = 'NOW — throw the ball!';
// Replaces the Wariness "missed!" beat on an out-of-window throw — a gentle
// correction, NOT the real Wariness spiral (which only wild catches get).
export const TUTORIAL_CORRECTION = 'Too soon — wait for the opening you create.';

// Benign practice-foe AI (the "can't punish" guard-rail). It always telegraphs
// an AGGRESSIVE lunge with its first affordable move, so the taught response —
// Brace (Guard) — counters it (G>A) and opens the read window every round.
// Fully predictable + low-threat; it never feints, hides, or capitalises on a
// slip. Lives here (game layer) so the forgiving behaviour stays out of the
// canonical wildFoeAI, which is byte-identical for real encounters.
export function tutorialFoeAI(state: BattleState, _rng: RNG): Action {
  const me = activeMon(state.foe);
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[0]!; // first affordable — deterministic, never a surprise
  return { kind: 'move', move, stance: 'A' };
}
