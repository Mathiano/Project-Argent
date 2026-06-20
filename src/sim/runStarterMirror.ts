// Standalone report for the starter mirror-sim: `npx tsx src/sim/runStarterMirror.ts`.
import ch1BatchData from '../../docs/ch1-batch.json';
import type { DexEntryJson } from '../engine';
import { runStarterMirror, STARTERS } from './starterMirror';
import type { Starter } from './starterMirror';

const N = 2000;
const SEED = 1;
const res = runStarterMirror(N, SEED);

const totals = (name: Starter): number => {
  const e = (ch1BatchData as DexEntryJson[]).find((x) => x.name === name)!;
  return e.stats.hp + e.stats.atk + e.stats.dfn + e.stats.spd;
};

console.log(`\n=== Starter mirror-sim (n=${N}/pair, seed=${SEED}, reader v reader, CH1 chart) ===`);
console.log('  player \\ foe   | KINDRAKE | GRUBLEAF | SILTSKIP |  AGG   | total');
console.log('  ---------------+----------+----------+----------+--------+------');
for (const a of STARTERS) {
  const row = STARTERS.map((b) => `${res.matrix[a][b].toFixed(1).padStart(6)}% `).join('| ');
  console.log(
    `  ${a.padEnd(14)} | ${row}| ${res.aggregate[a].toFixed(1).padStart(5)}% | ${totals(a)}`,
  );
}
const vals = STARTERS.map((s) => res.aggregate[s]);
console.log(
  `  → spread ${(Math.max(...vals) - Math.min(...vals)).toFixed(1)}pp (lower = healthier; target each ~50%)`,
);
