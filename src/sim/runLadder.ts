import { PLAYER_ARCHETYPES, rivalAI } from './archetypes';
import { runLadder } from './ladder';

const RIVAL_SCALE = { atk: 0.85, dfn: 0.85 } as const;

const MATCHUPS: ReadonlyArray<{ player: string; foe: string }> = [
  { player: 'SPROUTLE', foe: 'EMBERCUB' },
  { player: 'EMBERCUB', foe: 'AQUAFIN' },
  { player: 'AQUAFIN', foe: 'SPROUTLE' },
];

const N = 2000;
const SEED = 1;

function pct(n: number, w = 5): string {
  return `${n.toFixed(1).padStart(w)}%`;
}

function num(n: number, w: number): string {
  return n.toFixed(2).padStart(w);
}

console.log(`Ladder — n=${N}, master seed=${SEED}, rival 0.85x atk/dfn\n`);
const HEADER =
  '  Matchup                  | Archetype       |   Win%  | Rounds | Dodge | Counter | Opening | Clash | PlExh% | FoeExh%';
const RULE =
  '  -------------------------+-----------------+---------+--------+-------+---------+---------+-------+--------+--------';
console.log(HEADER);
console.log(RULE);

for (const m of MATCHUPS) {
  for (const archetype of PLAYER_ARCHETYPES) {
    const stats = runLadder(
      {
        player: { archetype, species: m.player },
        foe: { archetype: rivalAI, species: m.foe, scale: RIVAL_SCALE },
      },
      N,
      SEED,
    );
    const label = `${m.player} vs ${m.foe}`.padEnd(25);
    const aname = archetype.name.padEnd(15);
    console.log(
      `  ${label}| ${aname} | ${pct(stats.playerWinPct)} | ${num(stats.meanRounds, 6)} | ${num(stats.dodgesPerMatch, 5)} | ${num(stats.countersPerMatch, 7)} | ${num(stats.openingsPerMatch, 7)} | ${num(stats.clashesPerMatch, 5)} | ${pct(stats.playerExhaustionRate * 100, 6)} | ${pct(stats.foeExhaustionRate * 100, 6)}`,
    );
  }
  console.log(RULE);
}
