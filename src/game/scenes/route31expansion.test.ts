// Route 31 EXPANSION (route31-expansion-design.md) — the four-section first
// journey. Verifies the new structure + beats AND that every carried-forward pin
// survived the ~3x regen: all encounter zones, JAY's approachOnEnter, the
// ROURKE/WREN/PAX trainers, the PIP chain, and — the hard pin — the guided catch
// STILL FIRES on first §1 grass (now via a single zone-entry script). Data tests
// over the generated map + one driven-scene behaviour test for the catch.

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import type { FlagStore } from './overworld';
import { getMap } from '../overworld/maps';
import type { MapObject } from '../overworld/types';
import type { InputKey } from '../scene';
import type { InputState } from '../input';

const R = getMap('ROUTE31');
const objs = R.objects;
const npcs = objs.filter((o): o is Extract<MapObject, { type: 'npc' }> => o.type === 'npc');
const signs = objs.filter((o): o is Extract<MapObject, { type: 'sign' }> => o.type === 'sign');
const zones = objs.filter((o): o is Extract<MapObject, { type: 'encounter_zone' }> => o.type === 'encounter_zone');
const allSignText = signs.map((s) => s.lines.join(' ')).join(' || ');
const allNpcText = npcs.map((n) => JSON.stringify(n.interact) + JSON.stringify(n.interactAfterFlag ?? '')).join(' || ');

function mockInput(): InputState & { press(k: InputKey): void; release(k: InputKey): void } {
  const held = new Set<InputKey>();
  return { pressed: (k) => held.has(k), press: (k) => void held.add(k), release: (k) => void held.delete(k) };
}
function mockFlags(initial: string[] = []): FlagStore {
  const s = new Set(initial);
  return { has: (f) => s.has(f), set: (f) => void s.add(f), unset: (f) => void s.delete(f) };
}

describe('Route 31 expansion — ~3x, four distinct sections', () => {
  test('the map grew into a real journey (taller, generator-owned)', () => {
    expect(R.height).toBeGreaterThan(60); // was 30; ~3x
    expect(R.width).toBeGreaterThan(0);
  });

  test('all four sections are signposted (Meadowgate → Wood → Wayside → Pondside)', () => {
    expect(allSignText).toContain('ROUTE 31'); // §1 the route signpost (carried forward)
    expect(allSignText).toContain('MEADOWGATE'); // §1 named in-world
    expect(allSignText).toContain('THE WENDING WOOD'); // §2
    expect(allSignText).toContain('THE WAYSIDE'); // §3 named in-world
    expect(allSignText).toMatch(/the first to be trusted/); // §3 the shrine landmark
    expect(allSignText).toContain('STILLWATER POND'); // §4 the pond landmark
  });

  test('endpoints preserved: fromHearthwick spawn + the Violet exit warp', () => {
    expect(R.spawns.fromHearthwick).toBeTruthy();
    expect(objs.some((o) => o.type === 'warp' && o.target === 'HEARTHWICK:fromRoute')).toBe(true);
    expect(objs.some((o) => o.type === 'warp' && o.target === 'VIOLET:fromRoute')).toBe(true);
  });

  test('Hearthwick → Violet stays walkable end-to-end (spine connectivity)', () => {
    const cells = R.cells as string[][];
    const walkable = (x: number, y: number): boolean => {
      const row = cells[y];
      if (!row) return false;
      const id = row[x];
      if (id === undefined) return false;
      return !R.tileset[id]?.solid;
    };
    const start = R.spawns.fromHearthwick!;
    const exit = objs.find((o) => o.type === 'warp' && o.target === 'VIOLET:fromRoute') as Extract<MapObject, { type: 'warp' }>;
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const q: Array<[number, number]> = [[start.x, start.y]];
    const deltas: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of deltas) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || !walkable(nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    expect(seen.has(`${exit.x},${exit.y}`)).toBe(true);
  });
});

describe('Route 31 expansion — new beats', () => {
  test('the fellow first-timer appears TWICE with the canonical lines', () => {
    expect(allNpcText).toContain('You started today too?'); // §1 intro
    expect(allNpcText).toContain("we're not in a hurry"); // §1 intro
    expect(allNpcText).toContain('You made it! I knew you would.'); // §4 reappearance
    expect(allNpcText).toContain('had a good day'); // §4 reappearance
  });

  test('the Wayside Shrine + Overlook landmark carries the canonical text', () => {
    expect(allSignText).toContain('a great winged shape'); // the shrine plaque (first-bond myth + moon-dragon)
    expect(allSignText).toContain('beneath a crescent');
    expect(allSignText).toContain('Violet City. Where you\'re going.'); // the overlook (first sight of Violet)
  });

  test('the environmental detail layer is present (camp, berry bush, tracks, nest, signpost)', () => {
    expect(allSignText).toMatch(/cold campfire/i);
    expect(allSignText).toMatch(/berry bush/i);
    expect(allSignText).toMatch(/Tracks in the mud/i);
    expect(allSignText).toMatch(/nest tucked in the reeds/i);
    expect(allSignText).toMatch(/weathered signpost/i);
  });
});

describe('Route 31 expansion — ALL carried-forward content survived the regen', () => {
  test('every encounter species is still present (rehomed)', () => {
    const species = new Set(zones.flatMap((z) => z.species));
    for (const s of ['FLITPECK', 'GALEHAWK', 'GRITHOAX', 'MARSHMASH']) expect(species.has(s)).toBe(true);
  });

  test('JAY keeps approachOnEnter (the opening bond hook) + the gentle-robber line', () => {
    const jay = npcs.find((n) => n.approachOnEnter);
    expect(jay).toBeTruthy();
    expect(jay!.blockedUntilFlag).toBe('route31_trainer_beaten');
    expect(JSON.stringify(jay!.interact)).toContain('barely got anything'); // canonical tone
  });

  test('ROURKE / WREN / PAX (and the others) keep their combat win-flags', () => {
    const winFlags = new Set(
      npcs.flatMap((n) => n.interact.filter((c) => c.kind === 'start-trainer-battle').map((c) => (c as { winFlag: string }).winFlag)),
    );
    for (const f of ['route31_camper_beaten', 'route31_birdkeeper_beaten', 'route31_youngster2_beaten', 'route31_trainer_beaten'])
      expect(winFlags.has(f)).toBe(true);
  });

  test('the PIP lost-mon chain is intact (lost mon → found flag → gated kid → reward)', () => {
    expect(npcs.some((n) => n.blockedUntilFlag === 'route31_lost_mon_found' &&
      n.interact.some((c) => c.kind === 'set-flag' && (c as { flag: string }).flag === 'route31_lost_mon_found'))).toBe(true);
    expect(objs.some((o) => o.type === 'script' && o.requiresFlag === 'route31_lost_mon_found' &&
      o.flag === 'route31_lost_mon_reunited' && o.commands.some((c) => c.kind === 'give-item'))).toBe(true);
  });
});

describe('Route 31 expansion — the guided catch (single zone-entry, HARD PIN)', () => {
  const catchZone = objs.find((o): o is Extract<MapObject, { type: 'script' }> =>
    o.type === 'script' && o.commands.some((c) => c.kind === 'start-tutorial-catch'))!;

  test('it is ONE zone script over §1 grass (refactored from 35 per-tile triggers)', () => {
    const all = objs.filter((o) => o.type === 'script' && o.commands.some((c) => c.kind === 'start-tutorial-catch'));
    expect(all.length).toBe(1);
    expect(catchZone.width).toBeGreaterThan(1);
    expect(catchZone.height).toBeGreaterThan(1);
    expect(catchZone.requiresFlag).toBe('catch_lesson_done');
    expect(catchZone.once).toBe(true);
  });

  test('it STILL FIRES on first entry into §1 grass (after the lab lesson)', () => {
    let fired = 0;
    const input = mockInput();
    // catch_lesson_done set (lab lesson done) + JAY pre-beaten (skip his approach).
    const flags = mockFlags(['catch_lesson_done', 'route31_trainer_beaten']);
    // Spawn on the path one tile ABOVE the catch zone's top edge, walk DOWN in.
    const scene = createOverworldScene({
      random: () => 0.999, map: 'ROUTE31', spawn: 'default',
      spawnAt: { x: 10, y: catchZone.y - 1, facing: 'down' },
      inputState: input, flags,
      onWarp: () => {}, onEncounter: () => {}, onTrainerBattle: () => {}, onBossBattle: () => {},
      onTutorialCatch: () => { fired += 1; },
    });
    for (let i = 0; i < 4; i += 1) scene.update?.(0.02); // settle
    // step down onto the first zone tile
    input.press('down');
    for (let i = 0; i < 20; i += 1) scene.update?.(0.02);
    input.release('down');
    for (let i = 0; i < 14; i += 1) scene.update?.(0.02);
    expect(fired).toBe(1); // the guided catch fired on entering the grass
    expect(flags.has('route31_guided_catch_done')).toBe(true); // once-marker set
  });
});
