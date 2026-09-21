// The CONTENT half of the scout-report economy: every gated line must have a SHOP.
//
// `scout.ts` is pure data, so a line can name an intel flag that nothing in the
// world ever sets — the report would then advertise a source that does not exist,
// which is worse than having no economy at all. These tests walk the real maps and
// assert that each flag is a real trainer's win-flag, that the trainer who sells it
// actually TALKS about it afterwards, and that the two skippable sources really are
// skippable (that is what makes the intel a currency rather than a formality).

import { describe, expect, it } from 'vitest';
import './overworld/maps';
import { getMap } from './overworld/maps';
import type { MapData, MapObject, ScriptCommand } from './overworld/types';
import { FALKNER_REPORT, intelFlagsOf } from './scout';

const GYM = getMap('GYM');
const ROUTE31 = getMap('ROUTE31');
const VIOLET = getMap('VIOLET');
const WORLD: readonly MapData[] = [GYM, ROUTE31, VIOLET];

type Npc = Extract<MapObject, { type: 'npc' }>;

function npcs(map: MapData): readonly Npc[] {
  return map.objects.filter((o): o is Npc => o.type === 'npc');
}

// The NPC whose trainer battle sets `flag`, across every map we ship.
function sellerOf(flag: string): { map: MapData; npc: Npc } | null {
  for (const map of WORLD) {
    for (const npc of npcs(map)) {
      const sells = npc.interact.some(
        (c: ScriptCommand) => c.kind === 'start-trainer-battle' && c.winFlag === flag,
      );
      if (sells) return { map, npc };
    }
  }
  return null;
}

function followupText(npc: Npc): string {
  return (npc.interactAfterFlag ?? [])
    .flatMap((c: ScriptCommand) => (c.kind === 'dialog' ? c.lines : []))
    .join(' ');
}

describe('every gated report line has a real shop', () => {
  it.each(intelFlagsOf(FALKNER_REPORT))('%s is a real trainer win-flag', (flag) => {
    expect(sellerOf(flag), `no trainer on any map sets "${flag}"`).not.toBeNull();
  });

  it('every seller SAYS what it sold (the handover is in-fiction, not a banner)', () => {
    for (const flag of intelFlagsOf(FALKNER_REPORT)) {
      const seller = sellerOf(flag)!;
      const text = followupText(seller.npc);
      expect(text.length, `${flag} seller has no follow-up dialogue`).toBeGreaterThan(0);
      expect(text.toUpperCase(), `${flag} seller never mentions the report`).toContain('REPORT');
    }
  });

  it('names the FACT it hands over, keyed to the report line', () => {
    // If a line's source changes, this fails rather than silently leaving the
    // trainer talking about intel they no longer sell.
    const says = (flag: string) => followupText(sellerOf(flag)!.npc).toUpperCase();
    expect(says('gym_trainer_beaten')).toContain('RHYTHM');
    expect(says('gym_trainer_2_beaten')).toContain('STONE'); // the weakness list
    expect(says('gym_trainer_3_beaten')).toContain('ROSTER');
    expect(says('gym_trainer_4_beaten')).toContain('OPENING');
    expect(says('gym_trainer_4_beaten')).toContain('BREAK');
    expect(says('route31_birdkeeper_beaten')).toContain('GUSTBORNE');
  });
});

describe('the currency is real — two sources are genuinely skippable', () => {
  it('the RHYTHM seller stands OFF the sight-lines', () => {
    // An NPC with `sightRange` drags you into the fight when you cross its row, so
    // it cannot be skipped. The deepest tell hangs off the one gym trainer who has
    // none: walk around him and you climb to Falkner without the gust count.
    const seller = sellerOf('gym_trainer_beaten')!;
    expect(seller.map.name).toBe(GYM.name);
    expect(seller.npc.sightRange).toBeUndefined();
  });

  it('the other three gym sellers DO hold sight-lines (so a thin report is thin, not empty)', () => {
    for (const flag of ['gym_trainer_2_beaten', 'gym_trainer_3_beaten', 'gym_trainer_4_beaten']) {
      const seller = sellerOf(flag)!;
      expect(seller.npc.sightRange, `${flag} should be unavoidable`).toBeGreaterThan(0);
    }
  });

  it('the TRAIT seller lives on another map entirely', () => {
    const seller = sellerOf('route31_birdkeeper_beaten')!;
    expect(seller.map.name).toBe(ROUTE31.name);
  });
});

describe('the world signposts the economy', () => {
  it("VIOLET's gym guide names the report AND the off-site source", () => {
    const text = npcs(VIOLET)
      .flatMap((n) => n.interact.flatMap((c: ScriptCommand) => (c.kind === 'dialog' ? c.lines : [])))
      .join(' ')
      .toUpperCase();
    expect(text).toContain('SCOUT');
    // Without this pointer the one line the gym never sells is undiscoverable.
    expect(text).toContain('ROUTE 31');
  });
});
