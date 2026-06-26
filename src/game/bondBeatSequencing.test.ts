// Fix 1 — the bond tier-up beat must NOT be swallowed by a trainer's post-win
// dialogue. The bug: pushRivalGateFight (the KAMON gate) discarded the bond
// crossings and pushMessage'd the gate line immediately, so a stage crossed in
// that fight grew bond with NO celebratory beat. The fix routes the dialogue
// through showBondBeats' completion: bond beat FIRST, then the dialogue.
//
// main.ts isn't directly unit-testable (it owns module-global scene state), so
// this pins the SEQUENCING CONTRACT against the REAL createBondStageScene + a
// SceneStack — the same replica altitude spine.test.ts / coldstart.test.ts use.
// It mirrors main.ts's showBondBeats exactly; if that helper's shape changes,
// update this in lockstep.

import { describe, expect, test } from 'vitest';
import { SceneStack } from './scene';
import type { Scene } from './scene';
import { createBondStageScene } from './scenes/bondStage';

interface Cross {
  readonly species: string;
  readonly fromName: string;
  readonly toName: string;
  readonly toValue: number;
  readonly unlocksCalls: boolean;
}

// Verbatim mirror of main.ts:showBondBeats — pushes a bond beat per crossing;
// each beat's onContinue pops it and recurses; the LAST one runs onComplete.
function showBondBeats(scenes: SceneStack, crossings: readonly Cross[], onComplete: () => void): void {
  if (crossings.length === 0) {
    onComplete();
    return;
  }
  const [head, ...rest] = crossings;
  scenes.push(
    createBondStageScene({
      species: head!.species,
      fromName: head!.fromName,
      toName: head!.toName,
      toValue: head!.toValue,
      unlocksCalls: head!.unlocksCalls,
      onContinue: () => {
        scenes.pop();
        showBondBeats(scenes, rest, onComplete);
      },
    }),
  );
}

const crossing: Cross = {
  species: 'GRUBLEAF',
  fromName: 'Warming',
  toName: 'Companions',
  toValue: 31,
  unlocksCalls: false,
};

// A stand-in for the trainer's post-win dialogue (KAMON's gate line).
function dialogueScene(onShown: () => void): Scene {
  return { enter: onShown, draw: () => {}, input: () => {} };
}

describe('Fix 1 — bond beat fires before the trainer post-win dialogue', () => {
  test('a crossing on a trainer win shows the bond beat FIRST, dialogue only after', () => {
    const scenes = new SceneStack();
    let dialogueShown = false;
    // The FIXED gate flow: bond beat, THEN the dialogue.
    showBondBeats(scenes, [crossing], () =>
      scenes.push(dialogueScene(() => { dialogueShown = true; })),
    );

    // The bond beat is up; the dialogue has NOT pre-empted it (the bug).
    expect(scenes.depth()).toBe(1);
    expect(dialogueShown).toBe(false);
    // It IS a bond beat (renders the tier-up headline + transition).
    const ctx = recordingCtx();
    scenes.update(0.2);
    scenes.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('Companions'))).toBe(true);

    // Dismiss the beat → NOW the dialogue runs.
    scenes.input('a');
    expect(dialogueShown).toBe(true);
  });

  test('no crossing → straight to the dialogue, no spurious beat', () => {
    const scenes = new SceneStack();
    let dialogueShown = false;
    showBondBeats(scenes, [], () =>
      scenes.push(dialogueScene(() => { dialogueShown = true; })),
    );
    expect(dialogueShown).toBe(true);
    expect(scenes.depth()).toBe(1); // only the dialogue, no bond beat
  });
});

interface RecCtx extends CanvasRenderingContext2D { readonly texts: string[]; }
function recordingCtx(): RecCtx {
  const noop = () => {};
  const texts: string[] = [];
  return new Proxy(
    { texts },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'fillText') return (t: string) => texts.push(String(t));
        if (prop === 'beginPath') return () => ({ fill: noop, stroke: noop, ellipse: noop });
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set: () => true,
    },
  ) as unknown as RecCtx;
}
