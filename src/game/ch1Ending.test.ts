// CH1 ending beat (docs/ch1-ending-design.md): the branch-aware KAMON gate
// exchange + Concord stinger, the Route 32 quiet-resolve, the chapter card, and
// the placard replacement. Pure-text builders + scene renders + map data.

import { describe, expect, test } from 'vitest';
import { kamonGateLines, quietResolveLines, CHAPTER_CARD } from './ch1Ending';
import { createMessageScene } from './scenes/messageScene';
import { createChapterCardScene } from './scenes/chapterCard';
import route32 from './maps/route32.json';

function stubCtx(): CanvasRenderingContext2D & { texts: string[] } {
  const texts: string[] = [];
  const noop = () => {};
  let fill = '';
  return new Proxy(
    { texts },
    {
      get(t, p) {
        if (p === 'texts') return (t as { texts: string[] }).texts;
        if (p === 'fillStyle') return fill;
        if (p === 'fillText') return (s: string) => texts.push(String(s));
        if (p === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set(_t, p, v) {
        if (p === 'fillStyle') fill = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D & { texts: string[] };
}
const join = (lines: readonly string[]) => lines.join(' ');

describe('CH1 ending — the KAMON gate exchange (both branches advance)', () => {
  const win = kamonGateLines(true, null);
  const loss = kamonGateLines(false, null);

  test('WIN branch fires its own opener (he felt the bond gap)', () => {
    const t = join(win);
    expect(t).toContain('I trained harder'); // WIN opener
    expect(t).toContain('held its strike');
    expect(t).toContain("wasn't sure it wanted to win");
    expect(t).not.toContain('Stronger. Told you'); // not the loss opener
  });

  test('LOSS branch fires its own opener', () => {
    const t = join(loss);
    expect(t).toContain('Stronger. Told you'); // LOSS opener
    expect(t).toContain('fought like it wanted'); // "it wanted to be there"
    expect(t).not.toContain('I trained harder'); // not the win opener
  });

  test('BOTH branches converge on the deflection + Concord stinger + sign-off', () => {
    for (const t of [join(win), join(loss)]) {
      expect(t).toContain('the Concord');
      expect(t).toContain("doesn't"); // "a partner that doesn't hesitate"
      expect(t).toContain('See you out there');
      expect(t).toContain("up the road"); // he leaves north (narrated)
    }
  });

  test('[player] token: a name is woven in; null drops the address cleanly', () => {
    expect(join(kamonGateLines(true, 'ASH'))).toContain('See you out there, ASH.');
    expect(join(kamonGateLines(true, null))).toContain('See you out there.');
    // no dangling token in either branch / either name state
    for (const lines of [win, loss, kamonGateLines(true, 'ASH'), kamonGateLines(false, 'ASH')]) {
      expect(join(lines)).not.toMatch(/\[player\]|\[starter\]/);
    }
  });
});

describe('CH1 ending — the Route 32 quiet-resolve + chapter card', () => {
  test('quiet-resolve weaves the [starter] display name (nickname-aware) in', () => {
    const t = join(quietResolveLines('Sparky'));
    expect(t).toContain('Sparky steps up beside you');
    expect(t).toContain('It never has'); // it doesn't hesitate
    expect(t).toContain("ready for it");
    expect(t).not.toMatch(/\[starter\]/);
  });

  test('the chapter card is CHAPTER ONE / Kindled / To be continued', () => {
    expect(CHAPTER_CARD.chapter).toBe('CHAPTER ONE');
    expect(CHAPTER_CARD.title).toBe('Kindled');
    expect(CHAPTER_CARD.footer).toBe('To be continued.');
  });
});

describe('CH1 ending — scenes render + advance', () => {
  test('the message scene renders its lines and fires onDone when paged through', () => {
    let done = 0;
    const scene = createMessageScene({ lines: kamonGateLines(true, 'ASH'), onDone: () => (done += 1) });
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('trained harder'))).toBe(true); // a WIN line is on screen
    for (let i = 0; i < 30 && done === 0; i += 1) scene.input!('a'); // page to the end
    expect(done).toBe(1);
  });

  test('the chapter card renders its three lines and dismisses on A', () => {
    let done = 0;
    const scene = createChapterCardScene({ ...CHAPTER_CARD, onDone: () => (done += 1) });
    const ctx = stubCtx();
    scene.draw(ctx);
    const t = ctx.texts.join(' | ');
    expect(t).toContain('CHAPTER ONE');
    expect(t).toContain('Kindled');
    expect(t).toContain('To be continued.');
    scene.input!('a');
    expect(done).toBe(1);
  });
});

describe('CH1 ending — the card replaces the Route 32 placard', () => {
  test('the old end-of-chapter SIGN is gone from Route 32 (the card replaces it)', () => {
    const signs = route32.objects.filter((o) => o.type === 'sign');
    expect(signs.length).toBe(0); // no placard sign
    const joined = JSON.stringify(route32.objects);
    expect(joined).not.toContain('End of the current chapter');
    // the exit warp back north is preserved
    expect(route32.objects.some((o) => o.type === 'warp' && o.target === 'VIOLET:fromRoute32')).toBe(true);
  });
});
