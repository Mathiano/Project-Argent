// `npm run census` — prints the CH1 census table. See src/game/ch1Census.ts.
//
// This answers the risk register's open question with numbers instead of a vibe:
// how many fights a chapter-one run contains, how long each one runs against a
// competent player, whether the ★ economy is exercised, and how much HP a win
// actually costs. It GATES NOTHING — no ladder band reads these figures.

import { ch1Census } from './ch1Census';

const N = Number(process.env.N ?? 300);
const SEED = Number(process.env.SEED ?? 1);
const STARTER = process.env.STARTER ?? 'GRUBLEAF';

const c = ch1Census({ n: N, seed: SEED, starter: STARTER });
const byFlag = new Map(c.metrics.map((m) => [m.flag, m]));

const pad = (s: string, w: number) => s.padEnd(w).slice(0, w);
const num = (n: number, w: number, d = 1) => n.toFixed(d).padStart(w);

console.log(`\nCH1 CENSUS — starter ${STARTER}, n=${N}/fight, seed ${SEED}`);
console.log('player = the canonical `reader` yardstick (docs/sim-archetypes.md)');
console.log('vN = team size on BOTH sides (the player mirrors the trainer\'s count)\n');

console.log(
  '  ' +
    pad('FIGHT', 28) +
    pad('MAP', 12) +
    pad('PROFILE', 17) +
    pad('GROUND', 8) +
    ' vN   WIN%  ROUNDS  ★EARNED  HP-LEFT  SKIP',
);
console.log('  ' + '-'.repeat(110));
for (const f of c.fights) {
  const m = byFlag.get(f.flag);
  const tail = m
    ? `${num(m.winPct, 6)}${num(m.meanRounds, 8)}${num(m.meanStarsEarned, 9, 2)}${num(m.meanHpLeftPct, 8)}%`
    : '   —  (unprofiled, not measured)      ';
  console.log(
    '  ' +
      pad(f.flag, 28) +
      pad(f.map, 12) +
      pad(f.profileName ?? '(none)', 17) +
      pad(f.environment ?? 'open', 8) +
      ` ${f.foeSpecies.length}  ` +
      tail +
      `   ${f.avoidable ? 'yes' : 'no'}`,
  );
}

console.log('\n  WILD ENCOUNTER ZONES');
console.log('  ' + pad('MAP', 12) + pad('RATE', 7) + pad('TILES', 7) + 'SPECIES');
for (const z of c.zones) {
  console.log(
    '  ' + pad(z.map, 12) + pad(`${(z.rate * 100).toFixed(0)}%`, 7) + pad(String(z.tiles), 7) + z.species.join(', '),
  );
}

const t = c.totals;
console.log(`
  TOTALS
    trainer fights .......... ${t.fights}  (${t.avoidableFights} avoidable, ${t.profiledFights} profiled)
    expected rounds of combat ${t.expectedRounds.toFixed(0)}  (trainer fights only — wilds excluded)
    trainer payout .......... ${t.money}
    encounter zones ......... ${t.zones}  across ${t.wildSpecies} wild species`);
if (c.unmeasured.length > 0) console.log(`    UNMEASURED .............. ${c.unmeasured.join(', ')}`);
console.log('');
