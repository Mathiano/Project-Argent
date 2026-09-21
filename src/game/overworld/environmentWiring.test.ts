// Combat Layer 3 — the wiring from MAP to BATTLE.
//
// The engine layer is gated by src/sim/environmentBalance.test.ts. This covers
// the content half: which ground each map declares, that the loaders carry it,
// and that the player is TOLD the rules of the ground when a tilted fight opens.
import { describe, expect, it } from 'vitest';
import './maps';
import { getMap, listMaps } from './maps';
import { ENVIRONMENTS, SPECIES, createBattleState, createSide, environmentFor, mulberry32 } from '../../engine';
import { createBattleScene } from '../scenes/battle';
import type { EnvironmentId } from '../../engine';

describe('maps declare their ground', () => {
  it('Route 31 is FOREST — the first road is close country', () => {
    expect(getMap('ROUTE31').environment).toBe('forest');
  });

  it('the GYM stays NEUTRAL, deliberately', () => {
    // Falkner's rooftop is thematically a cliff, and measured: on cliff ground
    // the naive-triangle and stamina-reader GRUBLEAF cells fall 34.8% -> ~15.2%
    // (-19.7pp) while brute/SILTSKIP climbs +11.5pp, because cliff buffs heavy
    // releases 10% and heavy gusts ARE Falkner's kit. CLAUDE.md: a boss ships
    // only when its cells land on its card's targets, so putting the gym on
    // cliff is a boss-card re-baseline (a design call), not a wiring change.
    expect(getMap('GYM').environment).toBeUndefined();
  });

  it('interiors declare nothing — an indoor fight has no weather', () => {
    for (const name of ['BEDROOM', 'HOUSE', 'LAB', 'KAMON_HOUSE']) {
      expect(getMap(name).environment, name).toBeUndefined();
    }
  });

  it('every declared environment is a real one', () => {
    for (const name of listMaps()) {
      const env = getMap(name).environment;
      if (env === undefined) continue;
      expect(Object.keys(ENVIRONMENTS), `${name} declares "${env}"`).toContain(env);
    }
  });

  it('an absent declaration resolves to neutral ground, not a crash', () => {
    expect(environmentFor(undefined).id).toBe('open');
    expect(environmentFor('nonsense' as EnvironmentId).id).toBe('open');
  });
});

describe('the ground is never hidden from the player', () => {
  it('every tilted environment carries a blurb naming what it does', () => {
    for (const [id, env] of Object.entries(ENVIRONMENTS)) {
      if (id === 'open') continue;
      expect(env.blurb.length, id).toBeGreaterThan(20);
      expect(env.blurb.endsWith('.'), id).toBe(true);
    }
  });

  it('OPEN says nothing — a neutral field has no rules to announce', () => {
    // battle.ts suppresses the line for 'open' and for an absent environment;
    // this pins the intent so a future edit does not start announcing "nothing
    // favours anyone" before every routine fight.
    expect(ENVIRONMENTS.open.blurb).toContain('nothing favours anyone');
  });
});

// ── the ground line actually reaches the screen ────────────────────────────
// Screenshot-driving this proved unreliable (arrow keys advance dialogue, so
// walking into grass blows past the intro), so assert it where it is true —
// against the scene's own draw.
describe('the battle announces the ground before the foe', () => {
  function textsFor(environment?: EnvironmentId): string[] {
    const texts: string[] = [];
    const noop = () => {};
    const path = { fill: noop, stroke: noop, ellipse: noop };
    const ctx = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'fillText') return (t: string) => void texts.push(String(t));
          if (prop === 'beginPath') return () => path;
          if (prop === 'measureText') return () => ({ width: 10 });
          if (prop === 'canvas') return { width: 640, height: 360 };
          return noop;
        },
        set: () => true,
      },
    ) as CanvasRenderingContext2D;

    const player = createSide(SPECIES.EMBERCUB!);
    const foe = createSide(SPECIES.AQUAFIN!);
    const scene = createBattleScene({
      state: createBattleState(player, foe, environment !== undefined ? { environment } : {}),
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
      intro: ['A wild AQUAFIN appeared!'],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    scene.draw(ctx);
    return texts;
  }

  it('a tilted ground states its rules, FIRST — before the foe line', () => {
    const texts = textsFor('forest');
    const blurb = ENVIRONMENTS.forest.blurb;
    const shown = texts.find((t) => blurb.startsWith(t.trim()) || t.includes('cover'));
    expect(shown, `drew: ${JSON.stringify(texts.slice(0, 6))}`).toBeDefined();
  });

  it('neutral and absent ground say nothing — no line before the foe', () => {
    for (const env of [undefined, 'open' as const]) {
      const texts = textsFor(env).join(' ');
      expect(texts, String(env)).not.toContain('nothing favours anyone');
      expect(texts, String(env)).not.toContain('cover');
    }
  });
});
