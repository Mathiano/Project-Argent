import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  createBattleState,
  createSide,
  mulberry32,
  resolveRound,
} from '../../engine';
import type { BattleState, Stance } from '../../engine';
import { FOE_HABIT_STANCE, counterStanceFor, prepPlanLines } from './prep';

// ── The SCOUT REPORT teaches the CURRENT triangle — never a stale line ───────
// The prep-scene bug: it taught "FLUID dodges his Aggressive" — a LOSING line
// after the A>F punish flip. The plan now DERIVES the counter from the triangle;
// this test pins the taught counter to the ENGINE's actual resolution, so a future
// triangle change that isn't mirrored in the teaching FAILS here (can't go stale).

const STANCES: readonly Stance[] = ['A', 'G', 'F'];
const READ_WIN_KINDS = new Set(['counter', 'opening', 'punish']); // the player won the exchange
function makeState(): BattleState {
  return createBattleState(createSide(SPECIES.EMBERCUB!), createSide(SPECIES.AQUAFIN!));
}

describe('prep scout report — the taught counter matches the engine triangle', () => {
  test('counterStanceFor(habit) actually BEATS that habit in the engine (all three)', () => {
    for (const habit of STANCES) {
      const counter = counterStanceFor(habit);
      // The player adopts the TAUGHT counter; the foe plays its habit. Full-HP
      // fixtures + a light move so no KO pre-empts the read-win event.
      const r = resolveRound(
        makeState(),
        { kind: 'move', move: 'TACKLE', stance: counter },
        { kind: 'move', move: 'TACKLE', stance: habit },
        mulberry32(42),
      );
      const playerWonRead = r.events.some((e) => 'side' in e && e.side === 'player' && READ_WIN_KINDS.has(e.kind));
      expect(playerWonRead, `taught counter ${counter} must beat habit ${habit} in the engine`).toBe(true);
    }
  });

  test('the counter is the post-flip relation (GUARD beats Aggressive, not FLUID)', () => {
    expect(counterStanceFor('A')).toBe('G'); // GUARD turns Aggression (was the FLUID punish trap)
    expect(counterStanceFor('G')).toBe('F'); // FLUID slips Guard
    expect(counterStanceFor('F')).toBe('A'); // AGGRESSION punishes a dodge
  });

  test('the PLAN text names GUARD vs the ALL-OUT-ATK foe — the FLUID losing line is gone', () => {
    expect(FOE_HABIT_STANCE).toBe('A'); // "ALL-OUT ATK" = Aggressive
    const plan = prepPlanLines(FOE_HABIT_STANCE).join(' ');
    expect(plan).toContain('GUARD');
    expect(plan).toContain('counter and charge ★');
    expect(plan).not.toContain('FLUID'); // the pre-flip, now-losing advice is gone
  });
});

// ── The SCOUT REPORT screen renders the intel ECONOMY, not a wall of prose ────
// The old screen printed ~20 literals unconditionally, including "Break bar 2"
// against a card that had long since moved to 4. These tests assert the opposite
// property: what the player reads is derived from the LIVE card and gated behind
// the flags they earned.

import ch1BatchData from '../../../docs/ch1-batch.json';
import typeChartData from '../../../docs/typechart.json';
import { loadDex } from '../../engine';
import type { BossCard, DexEntryJson, Species, TypeChart } from '../../engine';
import { createFalknerPrepScene } from './falknerPrep';
import { PALETTE } from '../palette';
import { LOGICAL_H, LOGICAL_W } from '../canvas';

const TYPECHART = typeChartData as TypeChart;
const PREP_CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const PREP_ACE: Species = { ...PREP_CH1.GALEHAWK!, trait: 'GUSTBORNE' };
const PREP_CARD: BossCard = {
  species: PREP_ACE,
  statScale: { hp: 1.15 },
  arenaSchedule: { rhythmEveryN: 3, heavyExtraCost: 8, heavyExtraInitWeight: 1.3, telegraphAheadBy: 1 },
  breakBar: 4,
  teamSize: 2,
  openingMomentum: 2,
};

// `left` is the real left edge: drawTextRight aligns via ctx.textAlign='right' and
// hands fillText the RIGHT anchor, so a naive x would read ~4px/char too wide.
interface Drawn { readonly text: string; readonly x: number; readonly y: number; readonly left: number; readonly fill: string }
function prepTextsFrom(card: BossCard, hasFlag: (f: string) => boolean): readonly Drawn[] {
  const drawn: Drawn[] = [];
  const noop = () => {};
  let align = 'start';
  let fill = '#000000';
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'fillText')
          return (text: string, x: number, y: number) => {
            const t = String(text);
            drawn.push({ text: t, x, y, left: align === 'right' ? x - t.length * 4 : x, fill });
          };
        if (prop === 'measureText') return (t: string) => ({ width: String(t).length * 4 });
        if (prop === 'canvas') return { width: LOGICAL_W, height: LOGICAL_H };
        if (prop === 'textAlign') return align;
        return noop;
      },
      set: (_t, p, v) => {
        if (p === 'textAlign') align = String(v);
        if (p === 'fillStyle') fill = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const scene = createFalknerPrepScene({
    playerSpecies: PREP_CH1.GRUBLEAF!,
    foeSpecies: PREP_ACE,
    card,
    typeChart: TYPECHART,
    hasFlag,
    onContinue: () => {},
  });
  scene.update?.(0);
  scene.draw(ctx);
  return drawn;
}
const prepTexts = (hasFlag: (f: string) => boolean) => prepTextsFrom(PREP_CARD, hasFlag);
const joined = (d: readonly Drawn[]) => d.map((x) => x.text).join(' | ');
// drawText splits a mixed string into per-font RUNS (m3x6 + the small symbol font),
// so '2★ banked' arrives as three fillTexts. Re-join tight to assert on a whole line.
const tight = (d: readonly Drawn[]) => d.map((x) => x.text).join('');

describe('Falkner scout report — the screen renders the economy', () => {
  test('with NO intel: every gated fact is redacted and names its source', () => {
    const all = joined(prepTexts(() => false));
    expect(all).toContain('INTEL 0/6');
    expect(all).toContain('??? — GYM TRAINER, by the door');
    expect(all).toContain('??? — WREN, on ROUTE 31');
    expect(all).toContain('??? — ACE, inside');
    // The free header still reads — you can see the bird itself.
    expect(all).toContain("FALKNER's GALEHAWK — GALE");
    // Nothing leaks: no gust count, no break number, no trait name.
    expect(all).not.toContain('GUSTBORNE');
    expect(all).not.toMatch(/\d clean reads/);
    expect(all).not.toMatch(/gust every \d/);
  });

  test('with FULL intel: every line reads, straight off the card', () => {
    const all = joined(prepTexts(() => true));
    expect(all).toContain('INTEL 6/6');
    expect(all).toContain('a gust every 3 rounds.');
    expect(all).toContain('RHYTHM');
    expect(all).toContain('GUSTBORNE — the wind lends force.');
    expect(all).toContain('2 on the wing.');
    expect(tight(prepTexts(() => true))).toContain('walks in with 2★ banked.');
    expect(all).toContain('4 clean reads crack him.');
    expect(all).toContain('TERRA'); // the load-bearing CH1 type edge
    expect(all).not.toContain('???');
  });

  test('the FALSE literal is gone for good — the number tracks the card', () => {
    // The shipped screen said "Break bar 2" while the card was 4. The only 'BREAK'
    // line now comes from card.breakBar, so a re-baseline moves the text with it.
    expect(joined(prepTexts(() => true))).not.toContain('Break bar 2');
    const moved = joined(prepTextsFrom({ ...PREP_CARD, breakBar: 9 }, () => true));
    expect(moved).toContain('9 clean reads crack him.');
    expect(moved).not.toContain('4 clean reads');
  });

  test('a partial report is partial — one source buys one line', () => {
    const all = joined(prepTexts((f) => f === 'gym_trainer_beaten'));
    expect(all).toContain('INTEL 1/6');
    expect(all).toContain('a gust every 3 rounds.');
    expect(all).toContain('??? — ACE, inside');
  });

  test('compound advice stays hidden until the rhythm is known', () => {
    expect(joined(prepTexts(() => false))).not.toContain('Catch Breath on it');
    expect(joined(prepTexts((f) => f === 'gym_trainer_beaten'))).toContain('Catch Breath on it');
  });

  test('nothing inside the panel is drawn paper-on-parchment', () => {
    // The shipped screen blinked 'A: FIGHT' in PALETTE.paper on top of the
    // parchment panel — the same warm cream, so the only prompt on the screen was
    // invisible. Anything drawn inside drawPanel must use an ink.
    const PAPERS = new Set<string>([PALETTE.paper, PALETTE.frameParchment, PALETTE.frameParchmentDim]);
    for (const d of prepTexts(() => true)) {
      const insidePanel = d.y >= 13 && d.y <= LOGICAL_H - 7;
      if (!insidePanel) continue; // the title row sits on the dark backdrop
      expect(PAPERS.has(d.fill), `"${d.text}" is paper-on-parchment`).toBe(false);
    }
  });

  test('every line fits the 320×180 panel (both extremes of the report)', () => {
    for (const hasFlag of [() => false, () => true]) {
      for (const d of prepTexts(hasFlag)) {
        expect(d.y, d.text).toBeGreaterThanOrEqual(0);
        expect(d.y + 8, d.text).toBeLessThanOrEqual(LOGICAL_H);
        expect(d.left, d.text).toBeGreaterThanOrEqual(0);
        // 4px/char is the UI font's average (ui.ts UI_CHAR_W).
        expect(d.left + d.text.length * 4, d.text).toBeLessThanOrEqual(LOGICAL_W);
      }
    }
  });
});
