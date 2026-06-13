import { runFalknerLadder } from './falknerLadder';
import type { FalknerCellResult } from './falknerLadder';

interface Lever {
  readonly gustBorneDmgMult: number;
  readonly aceHpMult: number;
}

const TARGETS: { readonly [name: string]: readonly [number, number] } = {
  'button-masher': [25, 35],
  brute: [10, 20],
  'naive-triangle': [55, 70],
  'stamina-reader': [85, 92],
  'human-ish': [65, 75],
};

const ARCHETYPE_ORDER = ['button-masher', 'brute', 'naive-triangle', 'stamina-reader', 'human-ish'];
const STARTER_ORDER = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'];

function cellOf(cells: readonly FalknerCellResult[], archetype: string, player: string): FalknerCellResult | undefined {
  return cells.find((c) => c.archetype === archetype && c.player === player);
}

function inBand(cell: FalknerCellResult | undefined): boolean {
  if (!cell) return false;
  const target = TARGETS[cell.archetype];
  if (!target) return false;
  return cell.winPct >= target[0] && cell.winPct <= target[1];
}

function distance(cell: FalknerCellResult | undefined): number {
  if (!cell) return Infinity;
  const target = TARGETS[cell.archetype];
  if (!target) return 0;
  if (cell.winPct < target[0]) return target[0] - cell.winPct;
  if (cell.winPct > target[1]) return cell.winPct - target[1];
  return 0;
}

function summary(cells: readonly FalknerCellResult[]): { inBand: number; totalDistance: number } {
  let band = 0;
  let dist = 0;
  for (const cell of cells) {
    if (inBand(cell)) band += 1;
    dist += distance(cell);
  }
  return { inBand: band, totalDistance: dist };
}

function printTable(label: string, cells: readonly FalknerCellResult[]): void {
  console.log(`\n=== ${label} ===`);
  console.log('  archetype       | KINDRAKE | GRUBLEAF | SILTSKIP | target');
  console.log('  ----------------+----------+----------+----------+-------');
  for (const archetype of ARCHETYPE_ORDER) {
    const target = TARGETS[archetype]!;
    const fmt = (c: FalknerCellResult | undefined): string => {
      if (!c) return '   N/A  ';
      const flag = inBand(c) ? ' ' : '*';
      return `${c.winPct.toFixed(1).padStart(5)}%${flag}`;
    };
    const row = STARTER_ORDER.map((s) => fmt(cellOf(cells, archetype, s))).join(' | ');
    console.log(`  ${archetype.padEnd(15)} | ${row} | ${target[0]}-${target[1]}%`);
  }
  const s = summary(cells);
  console.log(`  → ${s.inBand}/15 in band, total miss-distance ${s.totalDistance.toFixed(1)}pp`);
}

const SEED = 0x1f;
const N = 2000;
const SWEEP: Lever[] = [
  { gustBorneDmgMult: 1.3, aceHpMult: 1.15 },
  { gustBorneDmgMult: 1.2, aceHpMult: 1.15 },
  { gustBorneDmgMult: 1.4, aceHpMult: 1.15 },
  { gustBorneDmgMult: 1.3, aceHpMult: 1.05 },
  { gustBorneDmgMult: 1.3, aceHpMult: 1.25 },
];

let best: { lever: Lever; cells: FalknerCellResult[]; band: number; dist: number } | null = null;

for (const lever of SWEEP) {
  const cells = runFalknerLadder({
    gustBorneDmgMult: lever.gustBorneDmgMult,
    aceHpMult: lever.aceHpMult,
    n: N,
    seed: SEED,
  });
  const s = summary(cells);
  printTable(`gust=${lever.gustBorneDmgMult} hp=${lever.aceHpMult}`, cells);
  if (
    !best ||
    s.inBand > best.band ||
    (s.inBand === best.band && s.totalDistance < best.dist)
  ) {
    best = { lever, cells, band: s.inBand, dist: s.totalDistance };
  }
}

console.log(`\n\nBEST LEVERS: gust=${best!.lever.gustBorneDmgMult} hp=${best!.lever.aceHpMult}`);
console.log(`  ${best!.band}/15 cells in band, total miss ${best!.dist.toFixed(1)}pp`);
