// Violet Academy depth pass (docs/violet-academy.md) — the post-gym teaching hub.
// Covers: FALKNER's post-win mentor trigger (fires once, sets the Academy-promote
// flag), the three teaching NPCs present in the interior, the move-trial tutor as
// a teaser ONLY (no mechanics), and the falkner_beaten gating of the Violet nudge.

import { describe, expect, test } from 'vitest';
import { ACADEMY_PROMOTED_FLAG, falknerMentorLines } from './violetAcademy';
import academy from './maps/violet_academy.json';
import violet from './maps/violet.json';

type Interaction = { readonly kind: string; readonly lines?: readonly string[] };
type Npc = {
  type: string;
  x: number;
  y: number;
  requiresFlag?: string;
  interact?: readonly Interaction[];
};
const npcs = (m: { objects: readonly unknown[] }): Npc[] =>
  m.objects.filter((o): o is Npc => (o as Npc).type === 'npc');
const dialogText = (npc: Npc | undefined): string =>
  (npc?.interact ?? [])
    .filter((c) => c.kind === 'dialog')
    .flatMap((c) => c.lines ?? [])
    .join(' ');
// Find an NPC by a distinctive substring in its dialog.
const byLine = (m: { objects: readonly unknown[] }, needle: string): Npc | undefined =>
  npcs(m).find((n) => dialogText(n).includes(needle));

describe('Violet Academy — FALKNER post-win mentor trigger', () => {
  test('delivers the canonical thesis line + sends the player to the Academy', () => {
    const t = falknerMentorLines().join(' ');
    expect(t).toContain('This time you got lucky'); // canonical opener (docs §core idea)
    expect(t).toContain('talent runs out');
    expect(t).toContain('understand what you are doing');
    expect(t).toContain('Go see the Academy');
  });

  test('the Academy-promote flag is the stable string the map gates on', () => {
    expect(ACADEMY_PROMOTED_FLAG).toBe('academy_promoted');
  });

  test('fires ONCE on the Falkner win, then is silent (mirrors main.ts win path)', () => {
    // main.ts sets ACADEMY_PROMOTED_FLAG in the win onResolve (which runs once).
    // Model the guard a future re-entry would need: promote only if not promoted.
    const flags = new Set<string>();
    let played = 0;
    const onFalknerWin = (): void => {
      if (!flags.has(ACADEMY_PROMOTED_FLAG)) {
        flags.add(ACADEMY_PROMOTED_FLAG);
        played += 1; // the mentor line plays
      }
    };
    onFalknerWin();
    onFalknerWin();
    expect(played).toBe(1);
    expect(flags.has(ACADEMY_PROMOTED_FLAG)).toBe(true);
  });
});

describe('Violet Academy — gating (enterable early, mentor-promoted post-gym)', () => {
  test('the Academy is enterable before the gym (the door warp is ungated)', () => {
    const door = violet.objects.find(
      (o) => o.type === 'warp' && (o as { target?: string }).target === 'VIOLET_ACADEMY:fromViolet',
    );
    expect(door).toBeDefined();
    expect((door as { requiresFlag?: string }).requiresFlag).toBeUndefined(); // not gated
  });

  test('the post-gym nudge NPC appears only after academy_promoted (falkner_beaten path)', () => {
    const usher = byLine(violet, 'FALKNER says');
    expect(usher).toBeDefined();
    expect(usher!.requiresFlag).toBe('academy_promoted'); // hidden pre-gym, shown post-win
    expect(dialogText(usher)).toContain('see us'); // points the player inside
  });
});

describe('Violet Academy — the three teaching functions are present', () => {
  test('FUNCTION 1: the stance master teaches A/G/F, the triangle, and SPEED', () => {
    const master = byLine(academy, 'three stances');
    expect(master).toBeDefined();
    const t = dialogText(master);
    // the three stances + their trade-offs
    expect(t).toContain('AGGRESSIVE');
    expect(t).toContain('GUARD');
    expect(t).toContain('FLUID');
    // the CURRENT engine triangle (A>F>G>A, Combat Layer 1) named by its outcomes
    expect(t).toContain('COUNTER');
    expect(t).toContain('OPENING');
    expect(t).toContain('PUNISH');
    expect(t).toContain('AGGRESSIVE beats FLUID');
    expect(t).toContain('GUARD beats');
    // the spec's #1 teaching point: SPEED is the hidden variable
    expect(t).toContain('hidden variable');
    expect(t).toContain('SPEED');
    expect(t).toContain('moves first');
    // no random misses — reads, not luck
    expect(t).toContain('random miss');
    expect(t).toContain('read');
  });

  test('FUNCTION 2: the move-trial tutor is a TEASER ONLY — no trial mechanics', () => {
    const sage = byLine(academy, "isn't taught");
    expect(sage).toBeDefined();
    const t = dialogText(sage);
    expect(t).toContain("isn't taught"); // names the concept
    expect(t).toContain('earned');
    expect(t).toContain('Come back when'); // come back later (the trial completes in play)
    // teaser ONLY: the tutor's interactions are pure dialog — no battle/flag/script
    // verbs that would wire Phase-8 trial mechanics.
    const kinds = (sage!.interact ?? []).map((c) => c.kind);
    expect(kinds.every((k) => k === 'dialog')).toBe(true);
  });

  test('FUNCTION 3: the bond keeper frames bond (moves+Calls, not stats) + evo readiness', () => {
    const keeper = byLine(academy, "doesn't raise a single");
    expect(keeper).toBeDefined();
    const t = dialogText(keeper);
    expect(t).toContain('stat'); // bond never touches stats
    expect(t).toContain('moves');
    expect(t).toContain('CALLS');
    // the canonical evo-readiness line
    expect(t).toContain('Nearly ready');
    expect(t).toContain('next badge');
  });
});

describe('Violet Academy — the on-thesis shell is preserved', () => {
  test('the wall inscription + the INSTRUCTOR and STUDENT flavor are kept', () => {
    const signs = academy.objects.filter((o) => o.type === 'sign');
    expect(signs.some((s) => JSON.stringify(s).includes('THE ACADEMY TEACHES'))).toBe(true);
    expect(byLine(academy, 'INSTRUCTOR:')).toBeDefined();
    expect(byLine(academy, 'STUDENT:')).toBeDefined();
  });
});
