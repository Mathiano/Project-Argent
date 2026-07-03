// Hearthwick depth (hearthwick-design.md) — the dressed hometown. Covers the
// new content this pass adds: KAMON's house (the one new enterable interior;
// enter + exit warps), the TOWN ELDER's departure trigger (bench line pre-
// starter, departure word post-starter, the gate that blocks the south exit
// until you have a partner), and the departure THRESHOLD (the Route 31 sign +
// the canonical "Come home for the winters" note). Pure-data + driven-scene.
//
// Isolation: none of this touches the theft (lab.json), the catch-tutorial, or
// the combat/KAMON card — those are exercised by their own suites and unchanged.

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import { getMap } from '../overworld/maps';
import type { MapObject } from '../overworld/types';
import type { InputKey, Scene } from '../scene';

// ── minimal mocks (mirrors overworld.test.ts) ────────────────────────────────
function mockFlags() {
  const s = new Set<string>();
  return { has: (f: string) => s.has(f), set: (f: string) => void s.add(f), unset: (f: string) => void s.delete(f) };
}
function mockInput() {
  const held = new Set<InputKey>();
  return {
    pressed: (k: InputKey) => held.has(k),
    press: (k: InputKey) => void held.add(k),
    release: (k: InputKey) => void held.delete(k),
    releaseAll: () => held.clear(),
  };
}
function stubCtx() {
  const texts: string[] = [];
  const noop = () => {};
  let fill = '';
  return new Proxy(
    { texts },
    {
      get(t, p) {
        if (p === 'texts') return (t as { texts: string[] }).texts;
        if (p === 'fillStyle') return fill;
        if (p === 'fillText') return (text: string) => texts.push(String(text));
        if (p === 'measureText') return () => ({ width: 10 });
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

type Drive = ReturnType<typeof createOverworldScene>;
function tick(scene: Drive, durationSec = 0.3): void {
  for (let t = 0; t < durationSec; t += 0.02) scene.update?.(0.02);
}
function walkOne(scene: Drive, input: ReturnType<typeof mockInput>, dir: 'up' | 'down' | 'left' | 'right'): void {
  const start = scene.currentPosition();
  input.press(dir);
  for (let i = 0; i < 30; i += 1) {
    scene.update?.(0.02);
    const p = scene.currentPosition();
    if (p.x !== start.x || p.y !== start.y) break;
  }
  input.release(dir);
  for (let i = 0; i < 14; i += 1) scene.update?.(0.02);
}

function makeScene(
  map: string,
  spawnAt: { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' },
  flags: ReturnType<typeof mockFlags>,
  onWarp: (t: string) => void,
): { scene: Drive; input: ReturnType<typeof mockInput> } {
  const input = mockInput();
  const scene = createOverworldScene({
    map,
    spawn: 'default',
    spawnAt,
    inputState: input,
    flags,
    onWarp,
    onEncounter: () => {},
    onTrainerBattle: () => {},
    onBossBattle: () => {},
    random: () => 0.999, // never roll an encounter
  });
  return { scene, input };
}

// Open the dialog for the NPC/sign the player is facing, render a frame, and
// return the captured on-screen text. Closes with B (which only advances/closes
// a dialog — unlike A, it never RE-opens it by re-facing the NPC).
function readFacing(scene: Drive): string {
  (scene as Scene).input?.('a'); // open
  const ctx = stubCtx();
  scene.draw?.(ctx);
  const text = ctx.texts.join(' | ');
  for (let i = 0; i < 8; i += 1) (scene as Scene).input?.('b'); // page closed (no re-open)
  return text;
}

const npcs = (map: string) => getMap(map).objects.filter((o): o is Extract<MapObject, { type: 'npc' }> => o.type === 'npc');
const signs = (map: string) => getMap(map).objects.filter((o): o is Extract<MapObject, { type: 'sign' }> => o.type === 'sign');

describe('Hearthwick depth — KAMON house (the one new enterable interior)', () => {
  test('KAMON_HOUSE registers and its warp resolves back to HEARTHWICK', () => {
    const kh = getMap('KAMON_HOUSE');
    expect(kh.spawns.fromHearthwick).toBeTruthy();
    const back = kh.objects.find((o): o is Extract<MapObject, { type: 'warp' }> => o.type === 'warp');
    expect(back?.target).toBe('HEARTHWICK:fromKamonHouse');
    // the destination spawn exists on the town map (the round trip is wired)
    expect(getMap('HEARTHWICK').spawns.fromKamonHouse).toBeTruthy();
  });

  test('HEARTHWICK has a door warp into KAMON_HOUSE (available during town exploration)', () => {
    const door = getMap('HEARTHWICK').objects.find(
      (o): o is Extract<MapObject, { type: 'warp' }> => o.type === 'warp' && o.target === 'KAMON_HOUSE:fromHearthwick',
    );
    expect(door).toBeTruthy();
    // no flag gate on the door object → reachable before the lab beat
    expect(door && 'requiresFlag' in door).toBe(false);
  });

  test('the room characterizes KAMON via the canonical examine objects', () => {
    const text = signs('KAMON_HOUSE').map((s) => s.lines.join(' ')).join(' || ');
    expect(text).toContain('Not enough. Faster.'); // training log
    expect(text).toContain('the one on the left'); // faded photo
    expect(text).toContain('He kept it anyway.'); // outgrown toy
    expect(text).toContain('bare hook'); // ribbon shelf
  });

  test('ENTER: walking into the KAMON door fires the warp to the interior', () => {
    let warp: string | null = null;
    // Authored-map door: warp_kamon_house @(16,13); the return spawn fromKamonHouse
    // is (16,14), one tile below the door (walkable; the house sits above it).
    const { scene, input } = makeScene('HEARTHWICK', { x: 16, y: 14, facing: 'up' }, mockFlags(), (t) => (warp = t));
    walkOne(scene, input, 'up'); // step onto the door (16,13)
    tick(scene); // let the warp fade resolve
    expect(warp).toBe('KAMON_HOUSE:fromHearthwick');
  });

  test('EXIT: walking out the interior door returns to HEARTHWICK', () => {
    let warp: string | null = null;
    const { scene, input } = makeScene('KAMON_HOUSE', { x: 4, y: 6, facing: 'up' }, mockFlags(), (t) => (warp = t));
    walkOne(scene, input, 'down'); // step onto the door (4,7)
    tick(scene);
    expect(warp).toBe('HEARTHWICK:fromKamonHouse');
  });
});

describe('Hearthwick depth — the TOWN ELDER departure trigger', () => {
  test('the elder carries BOTH canonical lines (bench line + departure word)', () => {
    // find by the gate flag — the COMPANION mon's examine also says "Forty winters"
    const elder = npcs('HEARTHWICK').find((n) => n.blockedUntilFlag === 'player_has_starter');
    expect(elder).toBeTruthy();
    expect(elder!.blockedUntilFlag).toBe('player_has_starter');
    expect(JSON.stringify(elder!.interact)).toContain('Forty winters'); // bench line
    expect(JSON.stringify(elder!.interactAfterFlag)).toContain('Off already'); // departure word
  });

  test('PRE-starter: the elder blocks their tile and gives the bench line', () => {
    // Authored-map elder: npc_town_elder @(18,34), one tile above the Route 31 exit
    // (18,35); approach from (18,33) facing down. NOTE (flagged in the round-trip
    // report): the south-exit corridor is >1 tile wide, so the elder blocks the
    // DIRECT path but the player can currently walk around him — a map-geometry fix
    // for Mathias, not a wiring bug. The gate mechanism (blockedUntilFlag) is intact.
    const flags = mockFlags(); // no player_has_starter
    const { scene, input } = makeScene('HEARTHWICK', { x: 18, y: 33, facing: 'down' }, flags, () => {});
    walkOne(scene, input, 'down'); // into the elder's tile (18,34) — blocked
    expect(scene.currentPosition()).toMatchObject({ x: 18, y: 33 });
    // facing the elder, A reads the bench line (thesis whisper), not the goodbye
    const text = readFacing(scene);
    expect(text).toContain('Forty winters');
    expect(text).not.toContain('Off already');
  });

  test('POST-starter: the gate opens AND the elder gives the departure word', () => {
    const flags = mockFlags();
    flags.set('player_has_starter');
    const { scene, input } = makeScene('HEARTHWICK', { x: 18, y: 33, facing: 'down' }, flags, () => {});
    const text = readFacing(scene); // facing the elder (18,34)
    expect(text).toContain('Off already'); // the departure word fires once developed
    // and the elder no longer blocks — the player can step onto (18,34)
    walkOne(scene, input, 'down');
    expect(scene.currentPosition()).toMatchObject({ x: 18, y: 34 });
  });

  // NOTE — DROPPED CONTENT (flagged in the round-trip report): the graybox town's
  // FOUR ambient mon-NPCs (the elder's grey-muzzled companion GALEHAWK, two
  // MARSHMASH, a GRITHOAX) have no marker in the authored map. If Mathias wants them
  // back he adds mon_* markers + we add MON_DEFS. Their examine text ("Forty winters"
  // companion, etc.) is not asserted here because the map no longer places them.
});

describe('Hearthwick depth — the departure threshold', () => {
  // The authored town ships TWO signs (sign_pokecenter + sign_pokemart, STUB text
  // flagged for Mathias's voice pass). The graybox's ~15 flavor signs — incl. the
  // "ROUTE 31 · Come home for the winters" threshold note — are DROPPED (no markers
  // in the authored map); flagged in the round-trip report as content to re-place.
  test('the town signs wire from Tiled markers (pokecenter + pokemart)', () => {
    const text = signs('HEARTHWICK').map((s) => s.lines.join(' ')).join(' || ');
    expect(signs('HEARTHWICK').length).toBe(2);
    expect(text).toContain('POKÉCENTER');
    expect(text).toContain('POKÉMART');
  });

  test('the south exit warps to Route 31 (threshold intact, Route 31 untouched)', () => {
    let warp: string | null = null;
    const flags = mockFlags();
    flags.set('player_has_starter'); // gate open — elder @(18,34) is passable
    const { scene, input } = makeScene('HEARTHWICK', { x: 18, y: 33, facing: 'down' }, flags, (t) => (warp = t));
    walkOne(scene, input, 'down'); // (18,33) -> (18,34), past the now-open elder gate
    walkOne(scene, input, 'down'); // (18,34) -> (18,35) exit (warp_to_route31)
    tick(scene);
    expect(warp).toBe('ROUTE31:fromHearthwick');
  });
});

// The authored Tiled town's WIRING is complete: every door round-trips, every NPC/
// sign resolves, the collision border holds, and the dev landing is sane. This is
// the round-trip gate that retires the graybox (hearthwick.json).
describe('Hearthwick — the authored Tiled town (round-trip completeness)', () => {
  // [town→interior warp target, interior map id, the return spawn HEARTHWICK provides]
  const BUILDINGS: ReadonlyArray<readonly [string, string, string]> = [
    ['HOUSE:fromHearthwick', 'HOUSE', 'fromHouse'],
    ['KAMON_HOUSE:fromHearthwick', 'KAMON_HOUSE', 'fromKamonHouse'],
    ['LAB:fromHearthwick', 'LAB', 'fromLab'],
    ['HEARTHWICK_CENTER:fromHearthwick', 'HEARTHWICK_CENTER', 'fromCenter'],
    ['HEARTHWICK_MART:fromHearthwick', 'HEARTHWICK_MART', 'fromMart'],
  ];
  const warps = (map: string) => getMap(map).objects.filter((o): o is Extract<MapObject, { type: 'warp' }> => o.type === 'warp');

  test('every building door → a real interior entry spawn, and the interior returns to a real town spawn', () => {
    const town = getMap('HEARTHWICK');
    const targets = new Set(warps('HEARTHWICK').map((w) => w.target));
    for (const [target, interior, ret] of BUILDINGS) {
      expect(targets.has(target), target).toBe(true); // town → interior
      const [mapId, spawn] = target.split(':');
      expect(getMap(mapId!).spawns[spawn!], `${interior} entry spawn ${spawn}`).toBeTruthy();
      expect(town.spawns[ret], `HEARTHWICK:${ret} (return from ${interior})`).toBeTruthy(); // interior → town
    }
  });

  test('Route 31 round-trip: town → ROUTE31:fromHearthwick, ROUTE31 → HEARTHWICK:fromRoute (both spawns real)', () => {
    const town = getMap('HEARTHWICK');
    expect(warps('HEARTHWICK').some((w) => w.target === 'ROUTE31:fromHearthwick')).toBe(true);
    expect(getMap('ROUTE31').spawns.fromHearthwick).toBeTruthy();
    expect(town.spawns.fromRoute).toBeTruthy(); // ROUTE 31 returns here (injected by buildHearthwick)
  });

  test('the four authored NPCs wire (boy, farmer, elder-with-gate, forest ranger)', () => {
    const ns = npcs('HEARTHWICK');
    const blob = JSON.stringify(ns);
    expect(blob).toContain('Larch is in the lab'); // npc_boy
    expect(blob).toContain('Trainers used to come'); // npc_farmer
    expect(blob).toContain('north track'); // npc_forest_ranger (stub)
    expect(ns.some((n) => n.blockedUntilFlag === 'player_has_starter')).toBe(true); // npc_town_elder gate
    expect(ns.length).toBe(4);
  });

  test('go: hearthwick (devNav → fromHouse) lands on a real, walkable spawn', () => {
    const town = getMap('HEARTHWICK');
    const s = town.spawns.fromHouse;
    expect(s).toBeTruthy();
    expect(town.solidOverrides?.[s!.y]?.[s!.x] ?? false).toBe(false); // not a solid cell
  });

  test('the collision border holds (the authored Collide layer imported as solid cells)', () => {
    const town = getMap('HEARTHWICK');
    let solidCount = 0;
    for (const row of town.solidOverrides ?? []) for (const c of row) if (c) solidCount += 1;
    expect(solidCount).toBeGreaterThan(100); // 405 solid cells in the authored map (masses + borders)
  });
});
