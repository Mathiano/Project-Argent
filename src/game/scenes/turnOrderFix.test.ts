// turn-order-fix GATE — the legibility guarantees.
//   Symptom 1: the order indicator (orderHint / the move-menu NEXT:) must
//     HONESTLY match the engine's actual resolution order — faster-first,
//     a raw-slower mon first with a lighter move, and the Fluid exception.
//   Symptom 2: a still-alive mon never renders an empty HP bar (so a
//     near-lethal survivor's counter doesn't read as a "fainted mon hit
//     back" mutual KO).

import { describe, expect, test } from 'vitest';
import { createBattleState, createSide, mulberry32, resolveRound, SPECIES } from '../../engine';
import type { BattleState, Stance } from '../../engine';
import { orderHint } from './battle';
import { drawBar } from '../ui';

function engineFirst(
  playerKey: string,
  foeKey: string,
  plMove: string,
  plStance: Stance,
  foeMove: string,
  foeStance: Stance,
): 'player' | 'foe' | null {
  // Phased-unlock: these cases use mid/heavy moves to exercise initiative; bank
  // both sides the ★ so the ★-gate never blocks (it doesn't affect turn order).
  const state: BattleState = createBattleState(
    createSide(SPECIES[playerKey]!, undefined, { openingMomentum: 2 }),
    createSide(SPECIES[foeKey]!, undefined, { openingMomentum: 2 }),
  );
  const r = resolveRound(
    state,
    { kind: 'move', move: plMove, stance: plStance },
    { kind: 'move', move: foeMove, stance: foeStance },
    mulberry32(7),
  );
  const ev = r.events.find((e) => e.kind === 'initiative') as { first?: 'player' | 'foe' | null } | undefined;
  return ev?.first ?? null;
}

function hintFirst(
  playerKey: string,
  foeKey: string,
  plMove: string,
  plStance: Stance,
  foeMove: string,
  foeStance: Stance,
): 'player' | 'foe' | 'tie' {
  const h = orderHint(
    createSide(SPECIES[playerKey]!),
    createSide(SPECIES[foeKey]!),
    plMove,
    plStance,
    foeMove,
    foeStance,
  );
  return h === 'YOU > FOE' ? 'player' : h === 'FOE > YOU' ? 'foe' : 'tie';
}

describe('Symptom 1 — the order indicator matches the engine resolution order', () => {
  const cases: Array<[string, string, string, string, Stance, string, Stance, 'player' | 'foe']> = [
    // [label, player, foe, plMove, plStance, foeMove, foeStance, expected first]
    ['faster acts first', 'EMBERCUB', 'AQUAFIN', 'TACKLE', 'G', 'TACKLE', 'G', 'player'],
    ['foe faster acts first', 'AQUAFIN', 'EMBERCUB', 'TACKLE', 'G', 'TACKLE', 'G', 'foe'],
    // raw-slower SPROUTLE (84) + light move out-initiatives EMBERCUB (108) + heavy
    ['raw-slower first via lighter move', 'SPROUTLE', 'EMBERCUB', 'TACKLE', 'G', 'FX FLAME RUSH', 'G', 'player'],
    // Fluid-vs-Guard overrides speed entirely
    ['Fluid acts first vs faster Guard', 'AQUAFIN', 'EMBERCUB', 'TACKLE', 'F', 'TACKLE', 'G', 'player'],
  ];
  for (const [label, p, f, pm, ps, fm, fs, want] of cases) {
    test(`${label} — indicator == engine`, () => {
      expect(engineFirst(p, f, pm, ps, fm, fs)).toBe(want);
      expect(hintFirst(p, f, pm, ps, fm, fs)).toBe(want); // the display agrees
    });
  }
});

describe('Symptom 2 — a living mon never renders an empty HP bar', () => {
  // Recording ctx: capture every fillRect with its current fillStyle.
  function recCtx() {
    let style = '#000';
    const rects: Array<{ x: number; w: number; style: string }> = [];
    return new Proxy(
      { rects },
      {
        get(t, p) {
          if (p === 'rects') return (t as { rects: typeof rects }).rects;
          if (p === 'fillRect') return (x: number, _y: number, w: number) => rects.push({ x, w, style });
          return () => {};
        },
        set(_t, p, v) {
          if (p === 'fillStyle') style = String(v);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D & { rects: Array<{ x: number; w: number; style: string }> };
  }
  const COLOR = '#3e9a52';

  test('1 HP of 80 still shows a ≥1px coloured sliver (not empty)', () => {
    const ctx = recCtx();
    drawBar(ctx, 0, 0, 120, 1, 80, COLOR); // value rounds to 0px without the fix
    const fill = ctx.rects.find((r) => r.style === COLOR);
    expect(fill).toBeTruthy();
    expect(fill!.w).toBeGreaterThanOrEqual(1);
  });

  test('0 HP renders no coloured fill (a KO truly empties)', () => {
    const ctx = recCtx();
    drawBar(ctx, 0, 0, 120, 0, 80, COLOR);
    const fill = ctx.rects.find((r) => r.style === COLOR);
    expect(fill?.w ?? 0).toBe(0);
  });
});
