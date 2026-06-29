// Phase 7 GATE — the Catching 2.0 in-game lesson (scripting + triggers).
// The forgiving battle behaviour is proven in scenes/catch.test.ts; this
// pins the SCRIPT side: the lab lesson fires once + sets the tutorial-done
// flag (TELL/SHOW/EQUIP), and the Route 31 guided catch fires once on tall
// grass. Data tests over the shipped map JSON (the source of truth).

import { describe, expect, test } from 'vitest';
import lab from './maps/lab.json';
import {
  TUTORIAL_CATCH_SPECIES,
  TUTORIAL_FOE_PROMPT,
  TUTORIAL_WINDOW_PROMPT,
  TUTORIAL_CORRECTION,
} from './tutorialCatch';

type Cmd = { kind: string; [k: string]: unknown };
type ScriptObj = {
  type: string;
  x: number;
  y: number;
  trigger?: string;
  once?: boolean;
  flag?: string;
  requiresFlag?: string;
  commands?: Cmd[];
};

// Flatten a command list, descending into if-flag branches, so a test can
// assert on the lesson's commands wherever they sit in the tree.
function flatten(cmds: Cmd[] | undefined): Cmd[] {
  const out: Cmd[] = [];
  for (const c of cmds ?? []) {
    out.push(c);
    if (c.kind === 'if-flag') out.push(...flatten(c.commands as Cmd[] | undefined));
  }
  return out;
}

describe('Catching lesson — the lab beat fires once + sets the tutorial-done flag', () => {
  // The lesson is appended to the existing post-theft step-on script, so it
  // inherits its once-guard: KAMON bolts, then Larch teaches — exactly once.
  const theft = (lab.objects as ScriptObj[]).find(
    (o) => o.type === 'script' && o.trigger === 'step-on' && o.x === 5 && o.y === 9,
  )!;
  const cmds = flatten(theft.commands);

  test('the carrier script is a one-time trigger', () => {
    expect(theft).toBeDefined();
    expect(theft.once).toBe(true);
    expect(theft.flag).toBe('kamon_theft_fired'); // the once-marker
  });

  test('it sets the tutorial-done flag (catch_lesson_done)', () => {
    const done = cmds.find((c) => c.kind === 'set-flag' && c.flag === 'catch_lesson_done');
    expect(done).toBeDefined();
  });

  test('EQUIP: it grants starting BALLs into the bag', () => {
    const give = cmds.find((c) => c.kind === 'give-item' && c.itemId === 'BALL');
    expect(give).toBeDefined();
    expect((give as unknown as { qty: number }).qty).toBeGreaterThan(0);
  });

  test('TELL: the dialogue frames BOTH catch paths (read window + the willing choose)', () => {
    const text = cmds
      .filter((c) => c.kind === 'dialog')
      .flatMap((c) => c.lines as string[])
      .join(' ');
    expect(text).toMatch(/read/i); // Path 1 — the read window ("out-read it")
    expect(text).toMatch(/choose you/i); // Path 2 — planted as concept only
  });

  test('SHOW: the demo surfaces the read -> window -> throw beats on a FLITPECK', () => {
    const text = cmds
      .filter((c) => c.kind === 'dialog')
      .flatMap((c) => c.lines as string[])
      .join(' ');
    expect(text).toContain(TUTORIAL_CATCH_SPECIES); // demonstrated on FLITPECK
    expect(text).toMatch(/Brace/); // force the opening (the read)
    expect(text).toMatch(/NOW the throw/); // the throw cue
  });
});

// The live-route guided-catch (it's ONE zone-entry trigger over §1 grass, gated by
// catch_lesson_done, fires once) is verified on the Tiled-built ROUTE31 in
// route31expansion.test.ts (the old data-driven route31.violet.json was retired).

describe('Catching lesson — the forgiving values live in one isolated module', () => {
  // A guard against the prompts/correction being re-defined ad hoc elsewhere:
  // they are exported constants, consumed by the gated battle layer + mirrored
  // by the scripted demo. (Behavioural isolation is proven in catch.test.ts.)
  test('the tutorial strings are defined (the single source for the gated layer)', () => {
    expect(TUTORIAL_FOE_PROMPT).toMatch(/Brace/);
    expect(TUTORIAL_WINDOW_PROMPT).toMatch(/throw/i);
    expect(TUTORIAL_CORRECTION).toMatch(/opening/i);
  });
});
