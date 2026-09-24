// PROPOSED archetype base-stat template — NOT canon until Mathias approves it.
// Proposal + evidence: docs/stat-template-proposal.md.
//
// `ch1-batch-sheet.md:23` derives every CH1 stat line from an "archetype base
// table", and `mon-commission-kit.md:76` from "archetype template + stage band ±
// statFlavor nudge (capped ±8%)" — but the table itself was never written down,
// which blocks every CH2 species (gym2-rulings-packet C1). This reconstructs it:
//
//   · SHAPE — each archetype's share of the stat budget, FITTED from the 15
//     shipped CH1 mons (within-line spread ≤ 0.037, so the sheet was clearly
//     template-generated). Pacer + Drainer have no CH1 data and are DERIVED from
//     the fitted six, not invented freehand (see PACER/DRAINER below).
//   · BUDGET — hp+atk+dfn+spd, by rarity (stage 1) × stage position. Archetype
//     never moves the budget: mon-design-template pillar #2, "stat SHAPE with a
//     tradeoff, never raw total".
//   · STAMINA — straight from stat-foundation-stamina-design.md (stage-1 bases;
//     the doc's own Wall curve 120→132→148 gives the stage ratios).
//
// Report-only: nothing in the game or the engine reads this module.

export type Archetype =
  | 'Wall'
  | 'Counter-tank'
  | 'Dodger'
  | 'Glass nuke'
  | 'Trickster'
  | 'Brawler'
  | 'Pacer'
  | 'Drainer';

export type Rarity = 'common' | 'uncommon' | 'starter';

// [hp, atk, dfn, spd] shares of the budget. Each row sums to 1.
export type Shape = readonly [number, number, number, number];

// FITTED from CH1 (the starters' stage 1 uses the v1 sheet values — the
// archetype-true shapes — not the post-rebalance 330 lines, which were bent
// deliberately by starter-trio-rebalance.md and are not a template).
const FITTED: { readonly [k in Exclude<Archetype, 'Pacer' | 'Drainer'>]: Shape } = {
  Wall: [0.2, 0.26, 0.37, 0.17],
  'Counter-tank': [0.19, 0.28, 0.33, 0.2],
  Dodger: [0.16, 0.27, 0.2, 0.37],
  'Glass nuke': [0.16, 0.31, 0.17, 0.36],
  Trickster: [0.19, 0.26, 0.26, 0.29],
  Brawler: [0.19, 0.35, 0.25, 0.21],
};

// The mean of the six fitted shapes — "balanced" relative to THIS roster, not
// to an equal 25/25/25/25 split (HP runs on a smaller scale than the others).
function centroid(): Shape {
  const rows = Object.values(FITTED);
  const mean = [0, 1, 2, 3].map((i) => rows.reduce((a, r) => a + r[i]!, 0) / rows.length);
  return normalise(mean as unknown as Shape);
}

function normalise(s: Shape): Shape {
  const t = s[0] + s[1] + s[2] + s[3];
  return [s[0] / t, s[1] / t, s[2] / t, s[3] / t];
}

// PACER — pilot-exit-decisions.md:50 "Stamina war | balanced, regen perk".
// Balanced ⇒ the roster centroid. Its identity is carried by stamina (110) and
// the (unbuilt, ruling C3) regen perk, not by a stat lean.
const PACER: Shape = centroid();

// DRAINER — pilot-exit-decisions.md:51 "mid stats"; stamina doc: "sustain/toxic
// attrition (long game)". The centroid, leaned toward HP by exactly the maximum
// statFlavor nudge (+8%, paid from ATK — attrition over burst). So a Drainer's
// shape never goes further than any mon's flavor adjective already could.
const DRAINER: Shape = (() => {
  const c = centroid();
  const lift = c[0] * 0.08;
  return normalise([c[0] + lift, c[1] - lift, c[2], c[3]]);
})();

export const SHAPES: { readonly [k in Archetype]: Shape } = { ...FITTED, Pacer: PACER, Drainer: DRAINER };

// Stage-1 budget by rarity. common/uncommon/starter are fitted; rare and
// legendary have no CH1 data and CH2 needs neither, so they are NOT proposed.
export const STAGE1_BUDGET: { readonly [k in Rarity]: number } = {
  common: 270, // GRITHOAX 264; MARSHMASH (a single) 300 = 270 × the single uplift
  uncommon: 285, // FLITPECK 286
  starter: 330, // the shared starter budget (starter-trio-rebalance.md)
};

// Budget multipliers from stage 1, by line length and stage.
export const STAGE_MULT = {
  single: 1.1, // a one-stage line compresses the ladder (move-pool.md:57): MARSHMASH 300/270
  twoStageFinal: 1.24, // GALEHAWK 354/286
  threeStageMid: 1.19, // CAVELURE 320/264, starters' s2 ≈ 390/330
  threeStageFinal: 1.19 * 1.17, // CHASMTRAP 382/264, starters' s3 ≈ 453/330
} as const;

// Stage-1 stamina — stat-foundation-stamina-design.md's table, verbatim.
export const STAMINA_BASE: { readonly [k in Archetype]: number } = {
  Wall: 120,
  'Counter-tank': 115,
  Drainer: 115,
  Pacer: 110,
  Brawler: 105,
  Dodger: 95,
  Trickster: 90,
  'Glass nuke': 75,
};
// The doc's own Wall curve (120→132→148) gives the 3-stage ratios; GALEHAWK
// (75→84) gives the 2-stage final. Shipped non-starters match within ±1.
export const STAMINA_MULT = { single: 1, twoStageFinal: 1.12, threeStageMid: 1.1, threeStageFinal: 148 / 120 } as const;

export interface TemplateSlot {
  readonly archetype: Archetype;
  readonly rarity: Rarity;
  readonly stage: number;
  readonly stagesTotal: number;
}

export interface TemplateStats {
  readonly hp: number;
  readonly atk: number;
  readonly dfn: number;
  readonly spd: number;
  readonly stamina: number;
}

function stageKey(stage: number, total: number): keyof typeof STAGE_MULT | 'stage1' {
  if (total === 1) return 'single';
  if (stage === 1) return 'stage1';
  if (total === 2) return 'twoStageFinal';
  return stage === 2 ? 'threeStageMid' : 'threeStageFinal';
}

export function budgetFor(slot: TemplateSlot): number {
  const k = stageKey(slot.stage, slot.stagesTotal);
  return Math.round(STAGE1_BUDGET[slot.rarity] * (k === 'stage1' ? 1 : STAGE_MULT[k]));
}

// Largest-remainder rounding: the four stats always sum EXACTLY to the budget.
function apportion(budget: number, shape: Shape): [number, number, number, number] {
  const raw = shape.map((s) => s * budget);
  const out = raw.map(Math.floor) as [number, number, number, number];
  let left = budget - out.reduce((a, v) => a + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] = out[i]! + 1;
    left -= 1;
  }
  return out;
}

export function templateStats(slot: TemplateSlot): TemplateStats {
  const [hp, atk, dfn, spd] = apportion(budgetFor(slot), SHAPES[slot.archetype]);
  const k = stageKey(slot.stage, slot.stagesTotal);
  const stamina = Math.round(STAMINA_BASE[slot.archetype] * (k === 'stage1' ? 1 : STAMINA_MULT[k]));
  return { hp, atk, dfn, spd, stamina };
}
