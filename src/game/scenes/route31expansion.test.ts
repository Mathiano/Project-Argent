// Route 31 — the LIVE map (Phase-4 capstone: the Tiled-built ROUTE31 replaced the
// generated route31.violet.json). Verifies the carried-forward content + hard pins:
// every encounter zone, JAY's approachOnEnter, the 5 trainers, the PIP chain, the 4
// signs, end-to-end walkability, and — the HARD PIN — the guided catch STILL FIRES on
// first §1 (Meadowgate) grass via the single zone-entry script.
//
// (The retired generator's extra signs/shrine/overlook/detail layer are intentionally
// not on the Tiled map — Mathias chose 4 signs; those assertions were removed.)

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import type { FlagStore } from './overworld';
import { getMap } from '../overworld/maps';
import { isWalkable } from '../overworld/types';
import type { MapObject } from '../overworld/types';
import type { InputKey } from '../scene';
import type { InputState } from '../input';

const R = getMap('ROUTE31');
const objs = R.objects;
const npcs = objs.filter((o): o is Extract<MapObject, { type: 'npc' }> => o.type === 'npc');
const signs = objs.filter((o): o is Extract<MapObject, { type: 'sign' }> => o.type === 'sign');
const zones = objs.filter((o): o is Extract<MapObject, { type: 'encounter_zone' }> => o.type === 'encounter_zone');
const allSignText = signs.map((s) => s.lines.join(' ')).join(' || ');

function mockInput(): InputState & { press(k: InputKey): void; release(k: InputKey): void } {
  const held = new Set<InputKey>();
  return { pressed: (k) => held.has(k), press: (k) => void held.add(k), release: (k) => void held.delete(k) };
}
function mockFlags(initial: string[] = []): FlagStore {
  const s = new Set(initial);
  return { has: (f) => s.has(f), set: (f) => void s.add(f), unset: (f) => void s.delete(f) };
}

describe('Route 31 (live Tiled map) — a real multi-screen journey', () => {
  test('the map is a tall journey (taller than one screen)', () => {
    expect(R.height).toBeGreaterThan(60); // 74
    expect(R.width).toBeGreaterThan(0);
  });

  test('the 4 signs are placed (Meadowgate / Wayside / Stillwater / the Violet overlook)', () => {
    expect(signs.length).toBe(4); // Mathias chose 4
    expect(allSignText).toContain('MEADOWGATE'); // §1
    expect(allSignText).toContain('THE WAYSIDE'); // §3
    expect(allSignText).toContain('STILLWATER POND'); // §4
    expect(allSignText).toContain("Violet City. Where you're going."); // the overlook
  });

  test('endpoints preserved: fromHearthwick spawn + both boundary warps', () => {
    expect(R.spawns.fromHearthwick).toBeTruthy();
    expect(R.spawns.fromViolet).toBeTruthy();
    expect(objs.some((o) => o.type === 'warp' && o.target === 'HEARTHWICK:fromRoute')).toBe(true);
    expect(objs.some((o) => o.type === 'warp' && o.target === 'VIOLET:fromRoute')).toBe(true);
  });

  test('Hearthwick → Violet stays walkable end-to-end (spine connectivity)', () => {
    const start = R.spawns.fromHearthwick!;
    const exit = objs.find((o) => o.type === 'warp' && o.target === 'VIOLET:fromRoute') as Extract<MapObject, { type: 'warp' }>;
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const q: Array<[number, number]> = [[start.x, start.y]];
    const deltas: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of deltas) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || !isWalkable(R, nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    expect(seen.has(`${exit.x},${exit.y}`)).toBe(true);
  });
});

describe('Route 31 (live) — carried-forward content', () => {
  test('every encounter species is present (grass FLITPECK/GALEHAWK, cave GRITHOAX, water MARSHMASH)', () => {
    const species = new Set(zones.flatMap((z) => z.species));
    for (const s of ['FLITPECK', 'GALEHAWK', 'GRITHOAX', 'MARSHMASH']) expect(species.has(s)).toBe(true);
  });

  test('JAY keeps approachOnEnter (the opening bond hook) + the gentle-robber line', () => {
    const jay = npcs.find((n) => n.approachOnEnter);
    expect(jay).toBeTruthy();
    expect(jay!.blockedUntilFlag).toBe('route31_trainer_beaten');
    expect(JSON.stringify(jay!.interact)).toContain('barely got anything');
  });

  test('all 5 trainers (+ Jay) keep their canonical combat win-flags', () => {
    const winFlags = new Set(
      npcs.flatMap((n) => n.interact.filter((c) => c.kind === 'start-trainer-battle').map((c) => (c as { winFlag: string }).winFlag)),
    );
    for (const f of ['route31_youngster_beaten', 'route31_camper_beaten', 'route31_birdkeeper_beaten',
      'route31_youngster2_beaten', 'route31_lass_beaten', 'route31_trainer_beaten'])
      expect(winFlags.has(f)).toBe(true);
  });

  test('the PIP lost-mon chain is intact (lost mon → found flag → gated kid → reward)', () => {
    expect(npcs.some((n) => n.blockedUntilFlag === 'route31_lost_mon_found' &&
      n.interact.some((c) => c.kind === 'set-flag' && (c as { flag: string }).flag === 'route31_lost_mon_found'))).toBe(true);
    expect(objs.some((o) => o.type === 'script' && o.requiresFlag === 'route31_lost_mon_found' &&
      o.flag === 'route31_lost_mon_reunited' && o.commands.some((c) => c.kind === 'give-item'))).toBe(true);
  });

  test('two discoverable off-path items (one-time give-item step-ons)', () => {
    const items = objs.filter((o) => o.type === 'script' && o.commands.some((c) => c.kind === 'give-item') &&
      (o.flag === 'route31_item_forest' || o.flag === 'route31_item_pond'));
    expect(items.length).toBe(2);
  });
});

describe('Route 31 (live) — the guided catch (single zone-entry, HARD PIN)', () => {
  const catchZone = objs.find((o): o is Extract<MapObject, { type: 'script' }> =>
    o.type === 'script' && o.commands.some((c) => c.kind === 'start-tutorial-catch'))!;

  test('it is ONE zone script over §1 grass, gated by the lab lesson', () => {
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
    // Spawn one tile ABOVE the catch zone's top edge, walk DOWN into it.
    const scene = createOverworldScene({
      random: () => 0.999, map: 'ROUTE31', spawn: 'default',
      spawnAt: { x: catchZone.x + 1, y: catchZone.y - 1, facing: 'down' },
      inputState: input, flags,
      onWarp: () => {}, onEncounter: () => {}, onTrainerBattle: () => {}, onBossBattle: () => {},
      onTutorialCatch: () => { fired += 1; },
    });
    for (let i = 0; i < 4; i += 1) scene.update?.(0.02); // settle
    input.press('down');
    for (let i = 0; i < 20; i += 1) scene.update?.(0.02);
    input.release('down');
    for (let i = 0; i < 14; i += 1) scene.update?.(0.02);
    expect(fired).toBe(1); // the guided catch fired on entering the grass
    expect(flags.has('route31_guided_catch_done')).toBe(true); // once-marker set
  });
});
