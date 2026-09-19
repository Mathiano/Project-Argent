import { describe, expect, it } from 'vitest';
import { HAIR_PALETTE, npcHairColor } from './npcLook';
import house from '../maps/house.json';
import lab from '../maps/lab.json';
import gym from '../maps/gym.json';
import kamonHouse from '../maps/kamon_house.json';
import type { GrayboxMapJson } from './mapLoader';

describe('npcHairColor', () => {
  it('is deterministic for the same NPC and lands in the palette', () => {
    const a = npcHairColor('GYM', 7, 12);
    expect(npcHairColor('GYM', 7, 12)).toBe(a);
    expect(HAIR_PALETTE).toContain(a);
  });
  it('an explicit hair override wins', () => {
    expect(npcHairColor('LAB', 3, 4, '#c9c9d2')).toBe('#c9c9d2');
  });
  it('the shipped interior cast is not identical — at least four hair colours across it', () => {
    const seen = new Set<string>();
    for (const m of [house, lab, gym, kamonHouse] as GrayboxMapJson[]) {
      for (const o of m.objects ?? []) {
        if (o.type === 'npc') seen.add(npcHairColor(m.name, o.x, o.y, o.hair));
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
