// gym2-plan Step 6 — badge ids + the badge → world-flag table.

import { describe, expect, it } from 'vitest';
import { BADGE_FLAGS, HIVE_BADGE, ZEPHYR_BADGE } from './badges';
import { CH1_EVOLUTIONS } from './evolution';

describe('badges', () => {
  it('the flag table has the ZEPHYR row only (HIVE raises no flag yet)', () => {
    expect(BADGE_FLAGS).toEqual([{ badge: 'ZEPHYR', flag: 'zephyr_earned' }]);
    expect(BADGE_FLAGS.some((r) => r.badge === HIVE_BADGE)).toBe(false);
  });

  it('every evolution progress gate names a known badge id', () => {
    const known = new Set([ZEPHYR_BADGE, HIVE_BADGE]);
    for (const e of CH1_EVOLUTIONS) {
      if (e.progressGate !== null) expect(known.has(e.progressGate), `${e.from} gates on ${e.progressGate}`).toBe(true);
    }
  });
});
