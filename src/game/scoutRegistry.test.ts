// gym2-plan Step 6 — scout reports are found by boss id.

import { describe, expect, it } from 'vitest';
import { FALKNER_REPORT, SCOUT_REPORTS, scoutReportFor } from './scout';

describe('scout-report registry', () => {
  it('holds FALKNER_REPORT only, keyed by its own id', () => {
    expect(Object.keys(SCOUT_REPORTS)).toEqual([FALKNER_REPORT.id]);
    expect(scoutReportFor('falkner')).toBe(FALKNER_REPORT);
  });

  it('fails loudly on an unregistered id (or a prototype key)', () => {
    expect(() => scoutReportFor('bugsy')).toThrow(/no scout report/);
    expect(() => scoutReportFor('toString')).toThrow(/no scout report/);
  });
});
