# Architecture Audit — 2026-06-13

Status snapshot between sprints. Report only — nothing changed in source. Produced at commit `af11078` (Falkner seam close).

```
src/engine   12 files (8 src + 4 test)
src/game     20 files (12 src + 8 scene/util)  + 4 JSON maps
src/sim       9 files (6 src + 3 runners) + 2 test
docs/        15 design docs + 3 data JSON (typechart, moves, ch1-batch)
```

---

## 1. Module map

### `src/engine/` — pure rules, no DOM (compiler-enforced via sub-tsconfig)

| File | Owns |
|---|---|
| `types.ts` | Public type definitions: `Side`, `Stance`, `TierName`, `ElementType` (alias for `string`), `TypeChart`, `Tier`, `Move`, `Species`, `SideState`, `BattleState`, `Action`, `StatScale`, `ArenaSchedule`, `BossCard`. Also exports `isRhythmRound`, `traitMods`, and the **mutable** `TRAITS` table (only GUSTBORNE currently). |
| `events.ts` | `BattleEvent` discriminated union (16 kinds: `roundStart` w/ snapshot, `commit`, `initiative`, `catchBreath`, `clash`, `strike`, `dodge`, `opening`, `counter`, `staggered`, `momentum`, `stamina`, `winded`, `exhausted`, `ko`, `breakProgress`, `break`). `CommitDescriptor` + `SideSnapshot` helpers. |
| `config.ts` | Combat constants (`COMBAT.dmgScale`, regen, costs, stance modifiers, dodge, momentum cap, etc) + `TIERS` table. The one and only sanctioned home for tunable combat numbers. |
| `data.ts` | The **FIXTURE** dataset for the rival-fight regression ladder: `MOVES`, `SPECIES` (EMBERCUB/SPROUTLE/AQUAFIN/FUZZLET), `COUNTER_MAP`, `LEGACY_TYPE_CHART` (the pinned 1.5/0.67 chart), plus the chart-aware `typeMult` function. **Intentionally pinned — do not touch.** |
| `rng.ts` | `RNG` interface, `mulberry32` seeded implementation, `rngPick`/`rngInt` helpers, `fixedRng` test fixture. The only RNG source the engine is allowed to consume. |
| `state.ts` | `createSide`, `createBattleState(player, foe, setup?)` (setup carries optional typeChart + bossCard), affordability/legality predicates (`canAfford`, `isWinded`, `moveLegal`, `affordableMoves`, `forcedAction`), `validateAction`, and the in-engine `REGISTERED_MOVES` extension registry + `registerMoves`/`lookupMove`. |
| `dexLoader.ts` | Pure JSON loaders: `loadSpeciesAt(entry, level)` (filters learnset, returns Species), `loadDex`, `loadMoves`. Owns the `DexEntryJson` / `MoveJson` shapes. **No file IO — caller supplies parsed JSON.** |
| `bossAI.ts` | `BossPolicy` signature + `falknerBossAI` implementation (phase-aware, rhythm-aware, modal-read at phase 2, Catch Breath when low ST). The only boss AI shipped to date. |
| `resolveRound.ts` | The one and only pure transition function. Validates actions, snapshots, computes initiative + arena rhythm, emits events for clash/strike/opening/counter/dodge, applies stamina settle, tracks Break progress and phase transitions, forward-carries `typeChart` + `bossCard` into the next state. |
| `index.ts` | Public API barrel (everything `src/game` and `src/sim` are allowed to call). See §2. |
| `resolveRound.test.ts` | 22 tests covering counter survival, KO mid-exchange, exhaustion, softlock, winded lock, stagger init, clash, F-vs-G ordering override, momentum charging, Catch Breath, determinism, type-chart injection (A1). |
| `arena.test.ts` | 6 tests covering `isRhythmRound`, `TRAITS.GUSTBORNE`, GUSTBORNE damage mult on rhythm, +8 ST on heavy gust rounds, no-arena-no-rhythm regression, Break-bar fill + phase shift + rhythmAnchor reset. |
| `dexLoader.test.ts` | 5 tests: learnset level filter, static stats, dual-type loading, loadDex returns dict, loadMoves returns dict. |
| `bossAI.test.ts` | 4 tests: phase-1 DIVE BOMB only on rhythm, phase-1 Aggressive on rhythm, phase-2 50/50 bait WING CUT, low-ST Catch Breath. |

### `src/game/` — rendering, input, scenes, audio. DOM-enabled.

| File | Owns |
|---|---|
| `main.ts` | Game entrypoint. Loads CH1 dex + moves at boot, mounts canvas + input dispatcher, sets up the `flagStore` + `run` state, defines the entire flow (title → starter → LAB → ROUTE31 → GYM → puzzle → trainer → Falkner → end), wires `?skip=` QA routes. Constructs all boss cards inline (Falkner's `ArenaSchedule` lives here). |
| `canvas.ts` | 320×180 backing canvas, integer-scale fit + letterbox + `imageSmoothingEnabled=false`. Exports `LOGICAL_W`/`LOGICAL_H` constants. |
| `palette.ts` | v0 master palette (panel/ink/bar/stance/star colors). Single source of color truth. |
| `scene.ts` | `Scene` interface (`enter`/`exit`/`update`/`input`/`draw`) + `SceneStack` push/pop/replace + `InputKey` union. |
| `input.ts` | `createInputDispatcher(onKey)` — keyboard (arrows + Z/X/C/Enter mapping) + on-screen touch overlay (D-pad / A-B / SELECT-START), held-key state via `pressed(key)` for game-loop polling. Hidden by default on non-touch (override `?touch=1`). |
| `ui.ts` | Shared UI primitives: `drawPanel`, `drawBar`, `hpColor`, `drawWindedNotch`, `drawStanceBadge`, `drawMomentum`, `drawText`, `drawTextRight`, plus `STANCE_NAME`/`STANCE_COLOR` maps. |
| `sprite.ts` | `Sprite` interface (rows + palette + size + optional facing), `validateSprite`, `drawSprite` (1× native), `drawSpriteInSlot` (bottom-anchored). |
| `sprites.ts` | Sprite registry. Imports `embercub.sprite.json` + `GRUBLEAF` + `KINDRAKE` (production 56×56), inlines the 4 demo 14×14 sprites, exposes `getSprite`, type-palette `drawPlaceholder` (covers legacy + CH1 type tints), `drawSpeciesInSlot` with facing-aware flip. |
| `engine-types.ts` | Type-only re-export shim (Action, BattleEvent, BattleState, ElementType, Side, SideState, Species, Stance, Tier, TierName) so UI modules don't pull engine values. |
| `overworld/types.ts` | `MapData`, `TileDef`, `Spawn`, `MapObject` union (warp/sign/encounter_zone/script/npc/gust_pulse), `ScriptCommand` union (8 kinds including the new if-flag/start-trainer-battle/start-boss-battle), `tileAt`, `isWalkable`, `findObjectAt`, `parseTarget`. |
| `overworld/maps.ts` | Static registry of map JSON imports + `getMap(name)`. |
| `maps/lab.json` | Graybox LAB interior (12×9). 1 sign, 1 south-door warp to ROUTE31. |
| `maps/house.json` | Graybox HOUSE interior (10×8). 1 sign, 1 south-door warp to ROUTE31. |
| `maps/route31.json` | Outdoor route (20×15). 2 building warps (lab + cave), grass encounter zone (FLITPECK), cave encounter zone (GRITHOAX), 1 sign, 1 one-shot step-on script ("a flutter…"), 1 gym door warp at (11,13). |
| `maps/gym.json` | Violet gym rooftop (16×16). 2 gust_pulse lanes (opposite phase), 2 NPCs (trainer + Falkner) gated by flags, 1 south-door warp, 1 sign, 1 auto-script firing the SPROUT-without-TERRA nudge via `if-flag`. |
| `scenes/boot.ts` | Sprite-system smoke scene (shows the 5 species side-by-side). Reachable only as a fallback. |
| `scenes/title.ts` | Title splash with flanking starter sprites + blinking PRESS START. |
| `scenes/starterPick.ts` | 3-slot starter picker. Takes `starters: readonly Species[]` (loaded externally). |
| `scenes/end.ts` | Win/lose flavor card with restart prompt. |
| `scenes/prep.ts` | **Generic** rival-style scout report (KAMON template). Now used only by the deprecated wild→prep→rival flow. |
| `scenes/falknerPrep.ts` | Falkner-specific scout report (GUSTBORNE callout, gust rhythm habit line, Break bar reminder, ★ Catch-Breath tempo tip). |
| `scenes/overworld.ts` | Tile-locked grid movement, held-key polling, camera follow with edge clamp, warps with fade, dialog overlay, NPC interaction + flag-gated blocking, gust pulse renderer + push physics, script command executor (dialog/warp/start-battle/set-flag/move-player/start-trainer-battle/start-boss-battle/if-flag), step-on + auto trigger dispatch. |
| `scenes/battle.ts` | Battle scene with full state machine (text/menu/move/resolve/end). Foe-commits-first telegraph, A-skip event drain, sprite-shake animations, HP/ST bars with winded notch, momentum pips, **2-pip Break bar widget**, **gust-telegraph banner**, **0.6s Break flash**, intent strip, stance selector, move menu (with stamina cost + locked dimming), CALL menu, battle log. |

### `src/sim/` — bot archetypes + ladder runners. No DOM (Node + tsx).

| File | Owns |
|---|---|
| `archetypes.ts` | The 5 canonical archetypes (static-guard, brute, naive-triangle, stamina-reader, human-ish), plus `buttonMasher` (Falkner ladder) and the demo's `rivalAI` (KAMON). `BotArchetype` interface with `chooseAction(state, side, rng, telegraph?)`. |
| `ladder.ts` | `runMatch` (single battle) + `runLadder` (n-shot stats). Tracks wins, mean rounds, exhaustion rate, and per-match event counters (dodge/counter/opening/clash). |
| `falknerLadder.ts` | Falkner-specific runner. Builds the GALEHAWK ace via dex loader + StatScale, applies arena schedule + breakBar=2, supports `gustBorneDmgMult` lever (mutates the `TRAITS` table). |
| `ch1Batch.ts` | B2 batch sim: 15-species × 5-archetype matrix vs a reference foe, with `auditBatch` flagging drift >±3pp from per-archetype mean and exhaustion >40%. |
| `runLadder.ts` | `npm run sim` entrypoint. Prints the rival-fight ladder. |
| `runFalknerLadder.ts` | Lever-sweep printer for B1 tuning. |
| `runCh1Batch.ts` | B2 audit printer. |
| `ladder.test.ts` | 15-cell exact-wins regression at n=2000, seed=1. The "fixture ladder bit-identical" guarantee lives here. |
| `falknerLadder.test.ts` | 15-cell ±2pp lock at n=2000, seed=0x1f, gust=1.4, hp=1.15. The B1 "closest fit" baseline. |

### Boundary checks

- **DOM imports in `src/engine`:** none. (Sub-tsconfig has `lib: ['ES2022']` only — `document`/`window`/`HTMLCanvas*` would not even resolve. The one `grep` hit on `bossAI.ts` matched the word "window" in the comment "kill window".)
- **Cyclic dependencies:** none detected. Engine is layered: `types` → `events`/`config`/`rng` → `data` → `state` → `resolveRound`/`bossAI`/`dexLoader` → `index`. Game imports only engine + sim. Sim imports only engine.
- **`src/game` reaching into engine internals past the public API:** none. Every game file imports from `../engine` (= `engine/index.ts`). No file deep-paths into `../engine/state.ts` or similar. The only direct file-path import is `src/game/main.ts` → `../engine` (barrel) and `src/sim/archetypes` (sanctioned by the game tsconfig reference).
- One **layering quirk** worth flagging: `src/game/main.ts` imports `rivalAI` from `../sim/archetypes` (game → sim). This is sanctioned (game tsconfig has a `references` entry for sim) and was deliberate during the Sprint 1 demo flow. The rival fight currently uses sim's KAMON AI; this is the only game↔sim coupling.

---

## 2. Engine public API surface

The exact contract `src/engine/index.ts` exposes to `src/game` and `src/sim`. **This is what you can call. Anything not on this list is internal.**

### Types (re-exported via `export * from './types'` + `export * from './events'`)

```
Side, Stance, TierName, ElementType, TypeChart, Tier, Move, Species,
SideState, TurnHistoryEntry, BattleState, Action, StatScale,
ArenaSchedule, BossCard,
SideSnapshot, CommitDescriptor, BattleEvent,
RNG, DexEntryJson, MoveJson, BossPolicy, RoundResult
```

### Values (functions, classes, constants)

```
// Combat data (rules + fixture)
COMBAT, TIERS, LEGACY_TYPE_CHART, MOVES, SPECIES, COUNTER_MAP, TRAITS

// Pure helpers
typeMult(chart, attType, defTypes)
isRhythmRound(schedule, round, anchor?)
traitMods(side, rhythmRound)

// RNG
mulberry32(seed)
rngPick(rng, arr)
rngInt(rng, n)
fixedRng(values)

// State builders + queries
createSide(species, scale?)
createBattleState(player, foe, setup?)
lookupMove(name)
registerMoves(extras)
canAfford(side, move)
isWinded(side)
moveLegal(side, moveName)
affordableMoves(side)
forcedAction(side)
validateAction(side, action)

// Data loaders
loadSpeciesAt(entry, level)
loadDex(entries, level)
loadMoves(entries)

// Boss AI
falknerBossAI

// The one and only transition
resolveRound(state, playerAction, foeAction, rng)
```

35 names total. Two of them — `MOVES` and `SPECIES` — are mutable globals (the fixture registries). `TRAITS` is also runtime-mutable (and is mutated by `main.ts` + `falknerLadder.ts` to set the Falkner gust damage mult). **These three mutable globals are the only side-channels in the engine.** See §4.

---

## 3. Actual shapes (drift detection)

### `BattleState`

```ts
{
  player: SideState,                  // ← 1v1 hardcoded — see §5
  foe: SideState,                     // ← 1v1 hardcoded
  round: number,
  history: readonly TurnHistoryEntry[],
  typeChart: TypeChart,
  bossCard?: BossCard,                // added in A4
  breakProgress?: number,             // added in A5
  phase?: number,                     // added in A5 (starts at 1)
  rhythmAnchor?: number,              // added in A5 (defaults to 0)
}
```

**Doc drift:** `docs/combat-2-0-spec.md` describes a "Format contract" + "Turn resolution" + "Stances" + "Stamina" but **never specifies the BattleState shape itself**. The v0.3.3 "Renderer event stream" section is the closest, and it does not mention `bossCard` / `breakProgress` / `phase` / `rhythmAnchor` as state fields — these were added in A4+A5 with no spec update. The spec describes Break + arena rhythm conceptually but doesn't reflect the engine's state representation.

### `Species`

```ts
{
  name: string,
  types: readonly ElementType[],      // array now (A1 — replaces single type)
  hp: number,
  atk: number,
  dfn: number,
  spd: number,
  moves: readonly string[],
  spr?: string,
  trait?: string,                     // added in A3
}
```

**Doc drift:** `docs/pilot-exit-decisions.md §2` lists the Species schema as `id, name, types[], stats{hp,atk,dfn,spd}, archetype, learnset[{move,level}], evoLine{stage,evolvesTo,at}, dexEntry, habitatTags[], encounterRarity, spriteRef`. The runtime `Species` is a **flattened subset** — no archetype, learnset, evoLine, dexEntry, habitatTags, encounterRarity. Those fields exist on `DexEntryJson` (loader's input shape) but are stripped by `loadSpeciesAt`. The loader is the choke point that decides what the engine sees.

`spr` on `Species` is a leftover from the demo days — `src/game/sprites.ts` keys its registry by `species.name`, not `species.spr`. The field is set by the loader but never read. **Should remove.**

### `BossCard`

```ts
{
  species: Species,
  statScale?: StatScale,              // exists, unused (Falkner applies HP×1.15 manually in main.ts)
  breakBar?: number,                  // used by A5
  arenaSchedule?: ArenaSchedule,      // used by A4
}
```

**Doc drift:** `docs/falkner-boss-card.md` describes the Falkner card as: roster (FLITPECK + GALEHAWK), kit, behavior script (phase 1 / phase 2 / read rates), Break bar 2, scout report, sim targets, tuning levers, **and 4 sanctioned engine hooks (arena rhythm, trait, Break bar, boss-card loader)**. The runtime `BossCard` shape has **no representation for the roster** (1v1 only — see §5), **no representation for the behavior script** (the policy lives in `bossAI.ts` as code, not data), **no representation for read rate or the Catch list**. The card's behavior is half data (arenaSchedule + breakBar), half hardcoded TS (phase logic, 15% read, baits). Worth a design decision on whether to push the rest into JSON or accept the split.

### Notable absences

- No `Trainer` / `BossCardData` JSON shape exists in the engine. Boss cards are constructed inline in `main.ts`.
- No `Party` / `Team` type — `SideState` is the active mon, not a roster. See §5.
- No move-effect / status / terrain types — `Move.tier` is the only categorisation. The spec mentions all of these as future P1; the engine has zero hooks for them.

---

## 4. What's hardcoded that should be data

Drift-by-file. **Pinned-by-design** items are intentional and called out separately at the bottom.

### `src/engine/bossAI.ts` (Falkner policy)

- **'DIVE BOMB' / 'WING CUT' string literals** (lines 21, 25, 27): the boss's move repertoire is hardcoded. Should live on the BossCard as a stance×rhythm move table.
- **Catch Breath trigger `me.st < 25`** (line 66): the 25 threshold is a magic number. Should be on the boss card (or shared with Falkner's spec doc).
- **Phase-2 read rate `rng.next() < 0.15`** (line 79): hardcoded. Should be `bossCard.phases[phase].readRate`.
- **Off-rhythm stance distribution** (`pickRandomFalknerStance`, lines 95-103): `0.5 / 0.3 / 0.2` for `F/G/A`. Should be on the boss card.

### `src/game/main.ts`

- **`FALKNER_ARENA` literal** (lines 71-76): `{rhythmEveryN: 3, heavyExtraCost: 8, heavyExtraInitWeight: 1.3, telegraphAheadBy: 1}`. Duplicated in `src/sim/falknerLadder.ts` (lines 36-41). Single source of truth wanted — `docs/bosses.json` or similar.
- **`TRAITS.GUSTBORNE` runtime mutation to `{dmgMult: 1.4, initMult: 1.25}`** (lines 79-82): the B1 locked lever, applied via type-assertion cast. Same mutation lives in `falknerLadder.ts`. Both sites are intentional but the mutation pattern is fragile.
- **`STARTERS` hardcoded list** (line 70): `['KINDRAKE', 'GRUBLEAF', 'SILTSKIP']` as a CH1 dex lookup. Should be a `chapter` config (chapter 1 → these three starters).
- **Wild AI stance distribution** (line 141 area, `wildFoeAI`): `0.4 / 0.3 / 0.3` for A/G/F. Should be a "wild profile" config; would also reduce duplication with the demo's KAMON 0.55/0.35/0.10.
- **Stat scales hardcoded** (line 186 rival, line 212 Falkner ace HP×1.15): the `atk: 0.85, dfn: 0.85` and the `Math.round(galehawkBase.hp * 1.15)` should come from data — the `StatScale` type exists for exactly this and is currently unused on `BossCard`.
- **Signpost rule `'SPROUT' / 'TERRA'` magic strings** (`recomputeSignpostFlags`): the rule "SPROUT lead + no TERRA in party → nudge" is hardcoded in TS. Should be a rule list in a story-progression JSON.

### `src/sim/archetypes.ts`

- **`me.st < 30` Catch Breath threshold in `staminaReader`** (~line 108): magic number. Should be an archetype config field. The Falkner boss AI has the same kind of constant at 25 — both should externalize together.
- **`me.st > 70` heavy-move gate in `rivalMovePick`** (~line 169): magic number. Same treatment.
- **`0.55 / 0.9 / 0.1` weighted rival stance distribution** (lines ~147-148): magic numbers. The "demo's KAMON" identity is encoded here as constants; per the canonical archetype doc this should be on a sim profile.

### `src/sim/falknerLadder.ts`

- Duplicates `FALKNER_ARENA` literal (above) and the `TRAITS.GUSTBORNE` mutation. Two sources will eventually drift.
- Encounter level `STARTER_LEVEL = 13` + `FALKNER_ACE_LEVEL = 15` are sim-only test fixtures — acceptable here but if the game ever needs "starter level at gym 1" it should be one source of truth.

### `src/game/scenes/falknerPrep.ts`

- **Strategy text strings** like `'TYPE: GALE — hits SPROUT'`, `'TRAIT: GUSTBORNE'`, `'Gusts every 3rd round'`, `'Break bar 2'` (lines 50-65): hardcoded strings. Should be derived from `boss.species.types`, `boss.species.trait`, `boss.arenaSchedule.rhythmEveryN`, `boss.breakBar`. UI is brittle to future card changes.

### Pinned-by-design — DO NOT REFACTOR

- `src/engine/data.ts`: `MOVES`, `SPECIES` (EMBERCUB/SPROUTLE/AQUAFIN/FUZZLET), `COUNTER_MAP`, `LEGACY_TYPE_CHART`. These are the FIXTURE dataset the rival-fight 15-cell regression ladder depends on; touching them breaks the bit-identical lock.
- `src/engine/types.ts`: `TRAITS.GUSTBORNE = {dmgMult: 1.3, initMult: 1.25}` is the **engine default**; mutations by main.ts / falknerLadder.ts are deliberate overrides for the Falkner content layer.
- `src/engine/config.ts`: every constant. This file is canonical.

### Suggested consolidation (sized at <100 LOC of new data + loader, 0 LOC of engine change)

1. New `docs/bosses.json` with one Falkner entry: arenaSchedule + breakBar + statScale + phases[] (per-phase read rate + move table + stance distribution + Catch Breath ST trigger).
2. Extend `dexLoader.ts` with `loadBossCard(entry, dex)` that constructs a `BossCard` from JSON + the loaded dex.
3. `main.ts` and `falknerLadder.ts` both call `loadBossCard('falkner', ...)` instead of building inline.

---

## 5. Team-battle gap

For each file, what's bound to 1v1 and what the 6v6 refactor will need to change. **Files not listed are already side-agnostic or have no game-state coupling.**

### Engine — the gravity well

| File | What's 1v1 | Refactor to 6v6 |
|---|---|---|
| `types.ts` | `BattleState.player: SideState` and `.foe: SideState` are the active mon, no roster. | Add `Team` (or `Party`) type — e.g., `{ active: SideState, bench: SideState[], lead: number, swappedThisRound?: boolean }`. `BattleState.player/foe: Team`. |
| `state.ts` | `createSide`, `createBattleState` take a single Species per side. | Add `createTeam(speciesList, scales?)`. Change `createBattleState(player: Team, foe: Team, setup?)`. The lookup/validation helpers all still accept `SideState` — they'll work on `team.active` unchanged. |
| `resolveRound.ts` | `validateAction(state.player, …)` / `validateAction(state.foe, …)` (lines 224-225); `let pl = state.player` / `let foe = state.foe` (lines 237-238) read the side directly. KO check checks `pl.hp <= 0` (lines 286, 299) → ends the match. Stamina settle + Break logic also reads pl/foe. | Introduce `state.player.active`/`state.foe.active` references. KO check becomes "active fainted" → trigger forced switch (or "team wiped" → match ends). Add pre-round optional switch action, post-KO forced switch flow. **Break + arena rhythm logic is already side-level and unchanged.** |
| `bossAI.ts` | `state[side]` reads the SideState directly (line 14). No team awareness, no switch decision. | Read `state[side].active`. Add boss-side switch policy when the active mon is KO'd (currently boss can only have one mon). |

### Sim — runners assume 1v1

| File | What's 1v1 | Refactor to 6v6 |
|---|---|---|
| `ladder.ts` | `MatchSpec` has `player: SideSpec` with single species. `runMatch` calls `createBattleState(createSide(...), createSide(...))`. Win detection on `state.player.hp <= 0`. | `MatchSpec.player: TeamSpec` with `species: string[]`. `createBattleState(createTeam(...), createTeam(...))`. Win when **all** team mons fainted. Also adds switch-decision hook on the archetype. |
| `falknerLadder.ts` | Same — single starter vs single GALEHAWK. The card's stated roster (FLITPECK lead, GALEHAWK ace) is **not expressible** today. | Same `createTeam` change + the boss card grows a roster array (currently `BossCard.species` is one mon). |
| `archetypes.ts` | `BotArchetype.chooseAction(state, side, rng, telegraph?)` takes `state` directly. Each policy reads `state[side]` for the active mon. No switch decisions. | Extend `BotArchetype` with optional `chooseSwitch(state, side, rng): number \| null` — bench index to swap in, or null to stay. Action chooser unchanged if it reads `state[side].active`. |

### Game — rendering assumes one slot per side

| File | What's 1v1 | Refactor to 6v6 |
|---|---|---|
| `scenes/battle.ts` | `FOE_SLOT`, `PL_SLOT` are single positions (lines 39-40). `display.player` / `display.foe` track one mon's HP/ST/momentum. All `state.player.species.name` / `.moves` reads target the active mon implicitly. Menu has FIGHT / CALL / RUN — no PKMN/SWITCH option. No bench rendering. | Add bench-slot rendering (3 mini-portraits per side per pilot-exit's "≤8 colors discipline"). Add PKMN/SWITCH menu entry that opens a party screen. Display snapshot tracks team. Switch event in the renderer event stream (new event kind — engine work). |
| `main.ts` | Every battle-pushing helper builds with one Species per side (`createBattleState(createSide(player), createSide(foe), …)`). `run.playerSpecies` is single — not a party. `partyTypes` is a Set but it's a derived signal for the signpost, not a roster. | `run.party: Species[]`. All callers become `createBattleState(createTeam(run.party), createTeam([foe]), …)`. Trainer fights pass a roster; boss fights too. |

### Already team-agnostic — no change needed

- `engine/config.ts`, `engine/data.ts`, `engine/events.ts` (with one addition — a `switch` event kind), `engine/rng.ts`, `engine/dexLoader.ts`
- `game/canvas.ts`, `palette.ts`, `ui.ts`, `sprite.ts`, `sprites.ts`, `input.ts`, `scene.ts`, all non-battle scenes, all overworld code
- `sim/ch1Batch.ts` (uses the same `createBattleState` plumbing — will inherit the change)

### Scope estimate for the 6v6 sprint

```
ENGINE     ~250 LOC changed across 4 files
           + 1 new event kind ('switch')
           + new types (Team, switch Action variant)
           + new pre-round switch window in resolveRound
           + KO → forced-switch flow + team-wipe terminal condition

SIM        ~150 LOC across 3 files
           + BotArchetype.chooseSwitch optional method
           + ladder/MatchSpec extended to take team specs
           + REGRESSION RE-BASELINE for the 15-cell rival ladder
             (since 1-mon "team" creation may reshape RNG ordering;
             worth verifying with a test pass before lock-in)

GAME       ~400 LOC across 2 files
           + bench rendering (3-mon strip per side)
           + party screen (new scene)
           + run.party as Species[]
           + switch animations + the new event handler

DOCS       1 spec update (combat spec — formalise switch + team-wipe rule)
           1 boss-card schema update (roster field)
```

**Total: ~800 LOC + the regression re-baseline + a design pass on switch mechanics (Set vs. Shift, free-switch-on-KO yes/no, prediction window for trainer switches).**

Recommended as **its own sprint** — touches the engine's foundational shape (BattleState), the ladder regression contract (re-baseline), and the renderer's biggest scene. Splitting across sprints would leave the codebase in an "is-it-1v1-or-team" limbo.

---

## 6. Test coverage map

```
TOTAL    67 passing tests across 5 files
ENGINE   4 test files, 37 assertions
SIM      2 test files, 30 assertions (parameterised: 15 cells × 2 ladders)
```

### Engine — tested

| File | Coverage |
|---|---|
| `resolveRound.test.ts` (22) | Counter survival, KO mid-exchange, exhaustion (forcedAction + ×1.25 taken), softlock auto-rest, winded heavy lock, stagger init halving, clash (both winners), F-vs-G ordering override, momentum from each read-win + cap, Catch Breath spend + illegality at 0★, determinism, **A1 type-chart injection**. |
| `arena.test.ts` (6) | `isRhythmRound` arithmetic, `TRAITS.GUSTBORNE` shape, **A3 GUSTBORNE damage ×1.3 on rhythm only**, **A4 heavy +8 ST on rhythm**, no-bossCard-no-modifier regression, **A5 Break-bar fill across rounds + phase shift + rhythmAnchor reset**. |
| `dexLoader.test.ts` (5) | Learnset level filter (inclusive), static stats across levels, dual-type loading, batch loadDex returns dict, loadMoves returns dict. |
| `bossAI.test.ts` (4) | Phase-1 DIVE BOMB only on rhythm, phase-1 Aggressive on rhythm, phase-2 50/50 WING CUT bait distribution (200 seeds), low-ST Catch Breath. |

### Sim — locked

| File | Coverage |
|---|---|
| `ladder.test.ts` (15) | **15-cell rival-fight ladder at n=2000, seed=1, exact wins per cell.** This is the bit-identical guarantee the entire engine has been refactored under. |
| `falknerLadder.test.ts` (15) | **15-cell Falkner ladder at n=2000, seed=0x1f, gust=1.4, hp=1.15 ±2pp tolerance.** The B1 "closest fit" lock. |

### Load-bearing, untested

These files have no direct test coverage. Most are exercised indirectly by `resolveRound.test.ts` (via `createBattleState` etc.) or `ladder.test.ts` (via `runLadder`).

| File | Risk | Coverage path |
|---|---|---|
| `engine/state.ts` | LOW — every public helper is exercised by `resolveRound.test.ts` and the ladders. | Indirect, comprehensive. |
| `engine/data.ts` | LOW — fixture data, locked by the ladder regression. | Bit-identical lock. |
| `engine/config.ts` | LOW — pure constants, no logic. | n/a. |
| `engine/rng.ts` | LOW — mulberry32 verified by the determinism test. `fixedRng` used in 5 tests. | Indirect. |
| `engine/events.ts` | LOW — typed union, no runtime logic. | n/a. |
| `engine/index.ts` | LOW — barrel re-export. | n/a. |
| `sim/archetypes.ts` | **MEDIUM** — all 5 archetypes (and rivalAI, buttonMasher) are run through the locked ladders, but only the win-rate outcome is asserted. Logic-level bugs that don't shift the locked ladder result by >0 wins would pass silently. | Outcome-only coverage. |
| `sim/ladder.ts` + `falknerLadder.ts` + `ch1Batch.ts` | MEDIUM — runner logic is exercised by the test runs but the audit-flagging logic (`auditBatch`) has no unit test. | Partial. |
| `game/canvas.ts`, `palette.ts`, `ui.ts`, `sprite.ts`, `sprites.ts`, `input.ts`, `scene.ts` | **NO TESTS.** Render correctness verified only by headless-Chrome screenshots in the working session. SceneStack push/pop semantics are simple enough to be obvious but a bug would be hard to catch automatically. | Visual only. |
| `game/scenes/*.ts` | **NO TESTS.** Scene flow has no integration coverage. Falkner fight cold-walk works in screenshots only. | Visual only. |
| `game/overworld/types.ts` + `maps.ts` + scene | **NO TESTS.** `isWalkable`, `findObjectAt`, `parseTarget`, the gust-pulse pulse math, the if-flag script evaluator — none have unit tests. The session flag store has no test for the unset path. | None. |
| `game/main.ts` | **NO TESTS.** The entire run-state machine + onResolve callbacks + flag bookkeeping is uncovered. The `recomputeSignpostFlags` rule (SPROUT + no TERRA → nudge) has no test. | None. |

### Recommended test additions before 6v6

Light, high-leverage:
1. **`game/overworld/types.ts`**: 6-8 tests on `isWalkable`/`findObjectAt`/`parseTarget` + a couple on gust-pulse activation math. These are pure functions — fast tests, prevent silent map-data breakage when the 6v6 sprint touches the rendering side.
2. **`sim/ch1Batch.ts` `auditBatch`**: 3-4 tests on the drift threshold + the softlock canary, so the audit tool itself doesn't silently break when archetypes evolve.
3. **`engine/state.ts` `validateAction`**: 6 tests on each throw path (invalid rest, invalid catchBreath, exhausted-can't-move, unknown move, winded-heavy, can't-afford). These are short, would close a real coverage gap.

Deferred until renderer matures:
- Scene transition / battle flow integration tests (would need DOM mocking — skip).
- Visual regression for the renderer (would need playwright or similar — skip).
