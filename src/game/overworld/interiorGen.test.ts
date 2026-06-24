// The town-interior generator (interiorGen.ts). The migrated Hearthwick/Violet
// interiors are proven behavior-identical by their existing scene tests (firstRoad,
// items, save, spine, overworld — all still green); here we pin the generator itself:
// a fresh town id produces a valid, loadable interior with the right warps / spawns /
// verbs, and the "new town = two lines" win.

import { describe, expect, test } from 'vitest';
import { makeCenter, makeMart } from './interiorGen';
import { loadMap } from './mapLoader';
import type { MapData, MapObject } from './types';

type Warp = Extract<MapObject, { type: 'warp' }>;
type Npc = Extract<MapObject, { type: 'npc' }>;
const warp = (m: MapData) => m.objects.find((o): o is Warp => o.type === 'warp')!;
const npcWith = (m: MapData, verb: string) =>
  m.objects.find((o): o is Npc => o.type === 'npc' && o.interact.some((c) => c.kind === verb));

describe('interior generator — makeCenter', () => {
  const m = loadMap(makeCenter('AZALEA')); // loads clean ⇒ a valid graybox map

  test('names + return warp derive from the town id', () => {
    expect(m.name).toBe('AZALEA_CENTER');
    expect(warp(m).target).toBe('AZALEA:fromCenter');
  });
  test('entry spawn key = from<Town>, plus the blackout `wake` spawn (Center-only)', () => {
    expect(m.spawns.fromAzalea).toMatchObject({ x: 4, y: 6, facing: 'up' });
    expect(m.spawns.wake).toBeTruthy();
  });
  test('carries the generic heal-party + open-box verbs (nurse + PC)', () => {
    expect(npcWith(m, 'heal-party')).toBeTruthy();
    expect(npcWith(m, 'open-box')).toBeTruthy();
  });
  test('flavor overrides apply; defaults otherwise', () => {
    const signOf = (j: ReturnType<typeof makeCenter>) =>
      (j.objects ?? []).find((o) => o.type === 'sign') as Extract<MapObject, { type: 'sign' }> | undefined;
    expect(signOf(makeCenter('X', { notice: ['Custom notice.'] }))?.lines).toEqual(['Custom notice.']);
    expect((signOf(makeCenter('Y'))?.lines.length ?? 0)).toBeGreaterThan(0); // a default noticeboard
  });
});

describe('interior generator — makeMart', () => {
  const stock = ['BALL', 'POTION', 'SUPER POTION'];
  const m = loadMap(makeMart('AZALEA', stock));

  test('names + return warp derive from the town id', () => {
    expect(m.name).toBe('AZALEA_MART');
    expect(warp(m).target).toBe('AZALEA:fromMart');
  });
  test('the clerk sells the GIVEN stock via open-mart', () => {
    const clerk = npcWith(m, 'open-mart')!;
    const shop = clerk.interact.find((c) => c.kind === 'open-mart') as Extract<typeof clerk.interact[number], { kind: 'open-mart' }>;
    expect(shop.stock).toEqual(stock);
  });
  test('a Mart has NO PC and NO blackout wake spawn (unlike the Center)', () => {
    expect(npcWith(m, 'open-box')).toBeUndefined();
    expect(m.spawns.wake).toBeUndefined();
    expect(m.spawns.fromAzalea).toBeTruthy();
  });
});

describe('interior generator — the "new town = two lines" win', () => {
  test('makeCenter + makeMart for a fresh town both load with their verbs', () => {
    const center = loadMap(makeCenter('NEWTOWN'));
    const mart = loadMap(makeMart('NEWTOWN', ['POTION']));
    expect(npcWith(center, 'heal-party')).toBeTruthy();
    expect(npcWith(mart, 'open-mart')).toBeTruthy();
    // the matched pair shares the door warp + entry spawn skeleton
    expect(warp(center)).toMatchObject({ x: 4, y: 7 });
    expect(warp(mart)).toMatchObject({ x: 4, y: 7 });
    expect(center.spawns.fromNewtown).toEqual(mart.spawns.fromNewtown);
  });
});
