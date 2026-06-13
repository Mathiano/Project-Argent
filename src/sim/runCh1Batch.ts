import { auditBatch, runCh1Batch } from './ch1Batch';

const N = 500;
const SEED = 0x2c;
const FOE = 'FLITPECK';

const cells = runCh1Batch({ n: N, seed: SEED, foeName: FOE });

console.log(`CH1 batch sim — vs ${FOE}, n=${N}, seed=${SEED}, level 13\n`);
console.log('  archetype       | player    | win%   | exh%');
console.log('  ----------------+-----------+--------+------');
for (const cell of cells) {
  console.log(
    `  ${cell.archetype.padEnd(15)} | ${cell.player.padEnd(9)} | ${cell.winPct.toFixed(1).padStart(5)}% | ${cell.exhaustionPct.toFixed(1).padStart(4)}%`,
  );
}

const flags = auditBatch(cells);
console.log(`\nFlags (${flags.length}):`);
for (const flag of flags) {
  console.log(`  [${flag.kind.padEnd(8)}] ${flag.player.padEnd(9)} × ${flag.archetype.padEnd(15)} — ${flag.note}`);
}
