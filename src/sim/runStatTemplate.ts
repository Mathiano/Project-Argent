// `npx tsx src/sim/runStatTemplate.ts` — the evidence for the PROPOSED archetype
// stat template (src/sim/statTemplate.ts; docs/stat-template-proposal.md).
//   1. RECONSTRUCTION — does the template regenerate the 15 shipped CH1 mons?
//   2. PARITY — all 8 archetypes at ONE budget, one neutral kit, `reader` on both
//      sides: does any shape dominate, or fall over, when only stats differ?
//   3. THE CH2 TABLE — what approving the template would produce for the bucket.
// Report-only. Gates nothing.

import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  isTeamWiped,
  loadMoves,
  mulberry32,
  parseManifest,
  registerMoves,
  resolveRound,
} from '../engine';
import type { DexEntryJson, MoveJson, RNG, Species } from '../engine';
import { reader } from './archetypes';
import { SHAPES, STAMINA_BASE, STAGE1_BUDGET, templateStats } from './statTemplate';
import type { Archetype, Rarity } from './statTemplate';

registerMoves(loadMoves(movesData as MoveJson[]));
const manifest = parseManifest(
  readFileSync(fileURLToPath(new URL('../../docs/mon-manifest.csv', import.meta.url)), 'utf8'),
);
const N = Number(process.env.N ?? 400);
const SEED = Number(process.env.SEED ?? 7);
const pct = (v: number, w = 6) => `${v.toFixed(1)}%`.padStart(w);

// ── 1. Reconstruction ───────────────────────────────────────────────────────
console.log('\n1. RECONSTRUCTION — template vs the 15 shipped CH1 mons (no statFlavor nudge)\n');
console.log('   name        arch          r   st  shipped hp/atk/dfn/spd/sta   template            max|Δ|');
let worstNonStarter = 0;
for (const e of ch1BatchData as DexEntryJson[]) {
  const row = manifest.find((r) => r.name === e.name)!;
  const t = templateStats({
    archetype: e.archetype as Archetype,
    rarity: e.rarity as Rarity,
    stage: row.stage,
    stagesTotal: row.stages_total,
  });
  const s = e.stats;
  const pairs: [number, number][] = [[s.hp, t.hp], [s.atk, t.atk], [s.dfn, t.dfn], [s.spd, t.spd]];
  const maxRel = Math.max(...pairs.map(([a, b]) => Math.abs(b - a) / a));
  if (e.rarity !== 'starter') worstNonStarter = Math.max(worstNonStarter, maxRel);
  console.log(
    `   ${e.name.padEnd(11)} ${e.archetype.padEnd(13)} ${e.rarity.slice(0, 3)} s${row.stage}  ` +
      `${[s.hp, s.atk, s.dfn, s.spd, s.stamina ?? 0].join('/').padEnd(22)}  ` +
      `${[t.hp, t.atk, t.dfn, t.spd, t.stamina].join('/').padEnd(19)} ${pct(maxRel * 100)}`,
  );
}
console.log(`   → worst per-stat error, non-starters: ${pct(worstNonStarter * 100, 0)}`);

// ── 2. Parity round-robin ───────────────────────────────────────────────────
// Neutral kit: the null-typed TACKLE + HEADBUTT and one heavy. Every mon is the
// same untyped species apart from its stats, so type can't move a single game.
const KIT = ['TACKLE', 'HEADBUTT', 'STAMPEDE'];
const ARCHS = Object.keys(SHAPES) as Archetype[];

// OPTION B (illustrative, NOT proposed): keep every archetype's SHAPE, but scale
// its whole line so hp·atk·dfn equals the roster centroid's — i.e. pay for the
// speed the engine does not value by raising the total. Breaks pillar #2's
// "never raw total", which is exactly why it is a ruling and not a default.
let COMPENSATE = false;
function compensated(t: { hp: number; atk: number; dfn: number; spd: number; stamina: number }, ref: number) {
  const k = Math.cbrt(ref / (t.hp * t.atk * t.dfn));
  return { hp: Math.round(t.hp * k), atk: Math.round(t.atk * k), dfn: Math.round(t.dfn * k), spd: Math.round(t.spd * k), stamina: t.stamina };
}
function refProduct(rarity: Rarity, stage: number, total: number): number {
  const ps = ARCHS.map((a) => { const t = templateStats({ archetype: a, rarity, stage, stagesTotal: total }); return t.hp * t.atk * t.dfn; });
  return ps.reduce((x, y) => x + y, 0) / ps.length;
}

function monOf(a: Archetype, budgetRarity: Rarity, stage: number, total: number, flatStamina: boolean): Species {
  const raw = templateStats({ archetype: a, rarity: budgetRarity, stage, stagesTotal: total });
  const t = COMPENSATE ? compensated(raw, refProduct(budgetRarity, stage, total)) : raw;
  return {
    name: a.toUpperCase().replace(/[^A-Z]/g, ''),
    types: ['BASIC'],
    hp: t.hp, atk: t.atk, dfn: t.dfn, spd: t.spd,
    stamina: flatStamina ? 100 : t.stamina,
    moves: KIT,
  };
}

function game(a: Species, b: Species, rng: RNG): number {
  let state = createBattleState(createTeam([createSide(a)]), createTeam([createSide(b)]));
  for (let r = 0; r < 200; r += 1) {
    const fA = reader.chooseAction(state, 'foe', rng);
    const pA = reader.chooseAction(state, 'player', rng, fA);
    state = resolveRound(state, pA, fA, rng).state;
    const pDead = isTeamWiped(state.player);
    const fDead = isTeamWiped(state.foe);
    if (pDead && fDead) return 0.5;
    if (fDead) return 1;
    if (pDead) return 0;
  }
  const p = activeMon(state.player).hp / activeMon(state.player).maxHp;
  const f = activeMon(state.foe).hp / activeMon(state.foe).maxHp;
  return p > f ? 1 : f > p ? 0 : 0.5;
}

function parity(label: string, rarity: Rarity, stage: number, total: number, flatStamina: boolean): void {
  const mons = ARCHS.map((a) => monOf(a, rarity, stage, total, flatStamina));
  const score = new Map<string, number[]>(ARCHS.map((a) => [a, []]));
  const matrix: number[][] = ARCHS.map(() => ARCHS.map(() => 0));
  let seed = SEED;
  for (let i = 0; i < ARCHS.length; i += 1) {
    for (let j = 0; j < ARCHS.length; j += 1) {
      let s = 0;
      for (let k = 0; k < N; k += 1) s += game(mons[i]!, mons[j]!, mulberry32((seed += 1)));
      matrix[i]![j] = s / N;
      score.get(ARCHS[i]!)!.push(s / N);
      score.get(ARCHS[j]!)!.push(1 - s / N);
    }
  }
  console.log(`\n2. PARITY — ${label}   (n=${N}/ordered pair, reader vs reader, neutral kit)\n`);
  console.log('   row beats column, as the player seat:');
  console.log('   ' + ''.padEnd(13) + ARCHS.map((a) => a.slice(0, 6).padStart(7)).join(''));
  ARCHS.forEach((a, i) => console.log('   ' + a.padEnd(13) + matrix[i]!.map((v) => pct(v * 100, 7)).join('')));
  console.log('\n   aggregate (both seats, all opponents incl. mirror):');
  const agg = ARCHS.map((a) => [a, score.get(a)!.reduce((x, y) => x + y, 0) / score.get(a)!.length] as const)
    .sort((x, y) => y[1] - x[1]);
  for (const [a, v] of agg) {
    const t = monOf(a, rarity, stage, total, flatStamina);
    console.log(`   ${a.padEnd(13)} ${pct(v * 100)}   ${[t.hp, t.atk, t.dfn, t.spd].join('/')} st${t.stamina}  total ${t.hp + t.atk + t.dfn + t.spd}`);
  }
  const vals = agg.map(([, v]) => v * 100);
  console.log(`   → spread ${(Math.max(...vals) - Math.min(...vals)).toFixed(1)}pp`);
}

parity(`common stage 1 (budget ${STAGE1_BUDGET.common}), template stamina`, 'common', 1, 3, false);
parity(`common stage 1 (budget ${STAGE1_BUDGET.common}), FLAT stamina 100 — shape alone`, 'common', 1, 3, true);
parity('common 3-stage FINAL (budget 376), template stamina', 'common', 3, 3, false);
COMPENSATE = true;
parity('OPTION B (illustrative) — common stage 1, shapes kept, hp·atk·dfn equalised', 'common', 1, 3, false);
COMPENSATE = false;

// ── 3. The CH2 table ────────────────────────────────────────────────────────
console.log('\n3. CH2 — what approving the template produces (before any statFlavor nudge)\n');
console.log('   line s  name        types           arch          rarity    hp  atk  dfn  spd   st  total');
for (const r of manifest.filter((m) => m.bucket === 'CH2')) {
  const t = templateStats({
    archetype: r.archetype as Archetype,
    rarity: r.rarity as Rarity,
    stage: r.stage,
    stagesTotal: r.stages_total,
  });
  const types = [r.type1, r.type2].filter(Boolean).join('/');
  console.log(
    `   ${r.line_id} ${r.stage}  ${(r.name || '(unnamed)').padEnd(11)} ${types.padEnd(15)} ${r.archetype.padEnd(13)} ` +
      `${r.rarity.padEnd(8)} ${[t.hp, t.atk, t.dfn, t.spd, t.stamina].map((v) => String(v).padStart(4)).join(' ')}  ${t.hp + t.atk + t.dfn + t.spd}`,
  );
}
void STAMINA_BASE;
