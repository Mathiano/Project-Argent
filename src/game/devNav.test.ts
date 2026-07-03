// Dev playtest navigation — the pure parse/resolve layer + the debug-menu primitive.
// main.ts applies these plans via the existing map-warp / flag / party setters under
// the import.meta.env.DEV gate; here we pin the contract: the plan a given set of
// dev params produces, that it's INERT without the dev flag, and that the menu drives
// the same callbacks. (The main.ts application + the DEV_BUILD read are browser-only.)

import { describe, expect, test, vi } from 'vitest';
import { AT_TARGETS, PRESETS, FORGE_FOES, buildDevPlan, parsePartySpec, parseFight, parseBond, parseSeed, resolvePresets } from './devNav';
import { createDevMenuScene, type DevMenuItem } from './scenes/devMenu';

describe('dev-nav — dev-gating (inert without the dev flag)', () => {
  test('a non-dev build is fully inert REGARDLESS of params', () => {
    const plan = buildDevPlan({ dev: false, search: '?at=academy&state=postfalkner&party=grubleaf:12' });
    expect(plan.active).toBe(false);
    expect(plan.at).toBeNull();
    expect(plan.flags).toEqual([]);
    expect(plan.badges).toEqual([]);
    expect(plan.party).toBeNull();
    expect(plan.fight).toBeNull();
    expect(plan.bond).toBeNull();
  });

  test('a dev build with no dev-nav param is inert (falls through to legacy/title)', () => {
    expect(buildDevPlan({ dev: true, search: '' }).active).toBe(false);
    expect(buildDevPlan({ dev: true, search: '?skip=wild' }).active).toBe(false); // legacy skip not claimed
    expect(buildDevPlan({ dev: true, search: '?party=grubleaf' }).active).toBe(false); // party alone doesn't claim
  });
});

describe('dev-nav — ?at= location warp', () => {
  test('resolves a map alias to (map, spawn)', () => {
    expect(buildDevPlan({ dev: true, search: '?at=academy' }).at).toEqual({ map: 'VIOLET_ACADEMY', spawn: 'fromViolet' });
    expect(buildDevPlan({ dev: true, search: '?at=violet' }).at).toEqual({ map: 'VIOLET', spawn: 'fromRoute' });
    expect(buildDevPlan({ dev: true, search: '?at=route32' }).at).toEqual({ map: 'ROUTE32', spawn: 'fromViolet' });
  });

  test('is case/space tolerant; an unknown map → at:null but still active', () => {
    expect(buildDevPlan({ dev: true, search: '?at=HEARTHWICK' }).at).toEqual(AT_TARGETS.hearthwick);
    const bogus = buildDevPlan({ dev: true, search: '?at=nowhere' });
    expect(bogus.active).toBe(true); // claimed (at param present)
    expect(bogus.at).toBeNull(); // unknown → main.ts defaults to a sensible landing
  });
});

describe('dev-nav — ?state= progression presets (composable)', () => {
  test('postfalkner sets the gym-cleared flags + the ZEPHYR badge', () => {
    const p = buildDevPlan({ dev: true, search: '?state=postfalkner' });
    expect(p.flags).toEqual(expect.arrayContaining(['player_has_starter', 'falkner_beaten', 'academy_promoted']));
    expect(p.badges).toContain('ZEPHYR');
  });

  test('kamon adds kamon_beaten on top of the gym-cleared state', () => {
    const p = buildDevPlan({ dev: true, search: '?state=kamon' });
    expect(p.flags).toContain('kamon_beaten');
    expect(p.flags).toContain('falkner_beaten');
    expect(p.badges).toContain('ZEPHYR');
  });

  test('opening sets the post-intro flags (no badge)', () => {
    const p = buildDevPlan({ dev: true, search: '?state=opening' });
    expect(p.flags).toEqual(expect.arrayContaining(['player_has_starter', 'kamon_theft_fired', 'catch_lesson_done']));
    expect(p.badges).toEqual([]);
  });

  test('presets compose + dedupe; unknown presets are ignored', () => {
    const { flags, badges } = resolvePresets('opening,kamon,bogus');
    expect(flags).toContain('catch_lesson_done'); // from opening
    expect(flags).toContain('kamon_beaten'); // from kamon
    expect(new Set(flags).size).toBe(flags.length); // deduped
    expect(badges).toEqual(['ZEPHYR']);
  });
});

describe('dev-nav — ?party= loadout (mon:level)', () => {
  test('parses names (upper-cased) + optional level; bad/absent level → null', () => {
    expect(parsePartySpec('grubleaf:12, kindrake')).toEqual([
      { name: 'GRUBLEAF', level: 12 },
      { name: 'KINDRAKE', level: null },
    ]);
    expect(parsePartySpec('siltskip:0')).toEqual([{ name: 'SILTSKIP', level: null }]); // non-positive → default band
    expect(parsePartySpec('  ')).toEqual([]);
  });

  test('a full composed plan carries at + state + party together', () => {
    const p = buildDevPlan({ dev: true, search: '?at=academy&state=postfalkner&party=grubleaf:12,kindrake:8' });
    expect(p.active).toBe(true);
    expect(p.at).toEqual(AT_TARGETS.academy);
    expect(p.flags).toContain('falkner_beaten');
    expect(p.party).toEqual([
      { name: 'GRUBLEAF', level: 12 },
      { name: 'KINDRAKE', level: 8 },
    ]);
  });
});

describe('dev-nav v2 — ?fight= battle forge', () => {
  test('parses foe (upper) + optional profile (lower)', () => {
    expect(buildDevPlan({ dev: true, search: '?fight=galehawk:duelist' }).fight).toEqual({ foe: 'GALEHAWK', profile: 'duelist' });
    expect(buildDevPlan({ dev: true, search: '?fight=FLITPECK' }).fight).toEqual({ foe: 'FLITPECK', profile: null });
  });
  test('?fight claims the boot; parseFight rejects a missing foe', () => {
    expect(buildDevPlan({ dev: true, search: '?fight=galehawk' }).active).toBe(true);
    expect(parseFight('')).toBeNull();
    expect(parseFight('  :duelist')).toBeNull();
  });
});

describe('dev-nav v2 — FORGE_FOES table (enumerated, no hardcoded drift)', () => {
  test('holds real CH1 species + the fixtures; upper-cased, deduped', () => {
    expect(FORGE_FOES.length).toBeGreaterThan(5);
    expect(FORGE_FOES).toContain('GALEHAWK'); // CH1 species (from the manifest)
    expect(FORGE_FOES).toContain('EMBERCUB'); // permanent fixture
    expect(new Set(FORGE_FOES).size).toBe(FORGE_FOES.length); // deduped
    for (const f of FORGE_FOES) expect(f).toBe(f.toUpperCase());
  });
});

describe('dev-nav v2 — ?bond= stage set', () => {
  test('accepts the feel rungs 0/2/4/6 only; claims the boot', () => {
    for (const s of [0, 2, 4, 6]) expect(parseBond(String(s))).toBe(s);
    expect(parseBond('3')).toBeNull();
    expect(parseBond('7')).toBeNull();
    expect(parseBond('x')).toBeNull();
    expect(buildDevPlan({ dev: true, search: '?bond=6' }).bond).toBe(6);
    expect(buildDevPlan({ dev: true, search: '?bond=6' }).active).toBe(true);
  });
});

describe('dev-nav v2 — ?seed= rng seed', () => {
  test('parses hex (0x optional) to an unsigned int; rejects non-hex / overlong', () => {
    expect(parseSeed('a9c0')).toBe(0xa9c0);
    expect(parseSeed('0xA9C0')).toBe(0xa9c0);
    expect(parseSeed('FF')).toBe(255);
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('xyz')).toBeNull();
    expect(parseSeed('123456789')).toBeNull(); // > 8 hex digits
  });
});

describe('dev-nav — preset/table integrity', () => {
  test('every AT_TARGETS entry has a map + spawn; every PRESET is well-formed', () => {
    for (const t of Object.values(AT_TARGETS)) {
      expect(typeof t.map).toBe('string');
      expect(typeof t.spawn).toBe('string');
    }
    for (const eff of Object.values(PRESETS)) {
      expect(Array.isArray(eff.flags)).toBe(true);
      expect(Array.isArray(eff.badges)).toBe(true);
    }
  });
});

describe('dev-nav — debug menu drives the same callbacks', () => {
  test('↑/↓ move the cursor, A runs the selected item, B closes', () => {
    const ran: string[] = [];
    let closed = false;
    const items: DevMenuItem[] = [
      { label: 'go: violet', run: () => ran.push('violet') },
      { label: 'state: kamon', run: () => ran.push('kamon') },
    ];
    const scene = createDevMenuScene(items, () => { closed = true; });
    scene.input!('a'); // run item 0
    expect(ran).toEqual(['violet']);
    scene.input!('down'); // → item 1
    scene.input!('a');
    expect(ran).toEqual(['violet', 'kamon']);
    scene.input!('b');
    expect(closed).toBe(true);
  });

  test('renders without throwing on a stub ctx', () => {
    const item: DevMenuItem = { label: 'go: hearthwick', run: vi.fn() };
    const scene = createDevMenuScene([item], () => {});
    const noop = () => {};
    const ctx = new Proxy({}, { get: (_t, p) => (p === 'canvas' ? { width: 320, height: 180 } : noop), set: () => true }) as unknown as CanvasRenderingContext2D;
    expect(() => scene.draw(ctx)).not.toThrow();
  });
});
