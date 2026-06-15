# PROJECT ARGENT — Combat 2.0 Spec v0.3.4 (sim-validated)

**Format contract:** 320×180 screen, sprites + text box, D-pad/A/B/SELECT/START. No new buttons, no twitch inputs.
**Budget rule:** every new system costs ≤1 bar or ≤1 glyph on screen. If it can't fit, it's cut.
**Untouched:** type chart, 4 move slots, 6v6, full-turn commit. The soul stays.

---

## Screen layout

```
┌──────────────────────────────┐
│ NEXT▸ [YOU][FOE][YOU][FOE]   │ ← action timeline
│ MILTANK ♀ L20      ⚔?        │ ← foe: stance/intent glyph
│ HP ████████░░  ST ██████░░   │ ← foe stamina bar
│              ┌────────┐      │
│  ~pool~      │  FOE   │      │
│              └────────┘      │
│  ┌────────┐        ▓pillar▓  │ ← terrain as sprites
│  │  YOU   │                  │
│  └────────┘  QUILAVA L19     │
│        HP ██████░ ST ████░ ★ │ ← ★ = Call ready
│┌────────────────────────────┐│
││ FIGHT  PKMN    SEL: stance ││
││ PACK   RUN     STA: call ★ ││
│└────────────────────────────┘│
└──────────────────────────────┘
```

**Input grammar:** D-pad navigate · A confirm · B back · **SELECT cycles stance** on the move screen · **START fires a Trainer Call** when ★ is lit. The entire combat fits the original control surface.

---

## Turn resolution (if/then order)

1. **Commit:** pick Move + Stance (+ Call if ★)
2. **Reveal:** stance triangle resolves → modifiers set
3. **Timeline:** actions execute by action speed (move weight, stance-adjusted)
4. **Clash check:** colliding attacks trigger a Clash
5. **Execute:** hits land with terrain hooks; counters fire
6. **Settle:** stamina, fatigue states, Momentum/★, Break bar, timeline repost

---

## Stances — the anime verbs

The stance layer IS the show's vocabulary: *"Dodge it!" / "Brace!" / "Press the attack!"* — declared with your move, one SELECT press.

| Stance | Glyph | Your move | You take | Stamina |
|---|---|---|---|---|
| **Aggressive** | ⚔ | 1.25× damage | 1.15× | move cost ×1.15 |
| **Guard** | 🛡 | 0.75× damage | 0.6× | +6 bonus regen |
| **Fluid** | 〜 | 1.0× | evade chance (below) | +12 flat — dodging is tiring |

**Triangle:** Guard > Aggressive > Fluid > Guard. Two hard edges, one contested:

| Matchup | Result |
|---|---|
| Guard vs Aggressive | **Counter** — attacker eats 0.5× of pre-mitigation damage (post-attacker-stance multiplier, pre-defender mitigation), staggered (timeline push) |
| Fluid vs Guard | **Opening** — act first, their counter whiffs, your hit lands at 1.15× through a degraded guard (0.85× instead of 0.6×) |
| Aggressive vs Fluid | **Speed contest** — dodge succeeds only with a real Speed edge; slow mons cannot dodge the big hit, fast ones can. The anime rule, made mechanical |
| Mirror | No bonus exchange, base effects only |

---

## Stamina (replaces PP)

Pool: 100 base, species-modified ±20. One bar under HP, both sides.

| Action | Cost | Weight |
|---|---|---|
| Status move | 8 | — |
| Light (≤60 BP) | 12 | 0.85 |
| Mid (61–90) | 22 | 1.00 |
| Heavy (91–120) | 35 | 1.15 |
| Nuke (>120) | 55 + next action delayed | 1.30 |
| Regen | +8 per action · Guard +6 · full rest +25 | — |

> Sim note v0.2: regen cut from 12 — at +12, light moves were stamina-free and Guard was an infinite engine (turtle won every matchup). At +8/+6 even light spam slowly drains, exhaustion appears ~1 in 2 battles, and stall dies to the Opening.

**Fatigue states (scenic + mechanical):**
- ≤25% — **Winded:** panting sprite frame; heavy/nuke moves locked. *No Hyper Beam while gasping.*
- 0% — **Exhausted:** loses the action, forced rest, takes +25% this turn.

Sprites visibly tire: idle → panting → one-knee. The show's exhaustion arc, on a Game Boy.

---

## Action timeline

Top strip shows the next 4–5 actions as face chips. Heavy moves visibly push your chip right; light moves bring it back sooner. Staggers (counters, clash losses) shove a chip backward in real time — every read-win is *seen* on the strip.

---

## Clash (beam struggles)

**Trigger:** both sides Aggressive + both damaging moves land in the same timeline window.
**Resolution:** power × current stamina% × move-type matchup. No mashing.
**Result:** winner's move pushes through at 0.7×; loser staggers + chip damage.
**Presentation:** center-screen collision, screen shake, palette flash.
**Tactic:** higher stamina wins ties → bait clashes while fresh, refuse them tired.

---

## Trainer Calls (START, requires ★)

Momentum fills from read-wins, dodges, super-effective hits, clash wins → ★ lights. One charge held at a time. **Selecting CALL opens a submenu** (the FIGHT→moves pattern) that reads the set below — never an instant fire; **B** exits it. Locked Calls render greyed + cursor-skipped (a later pass hides them until unlocked). A Call is never silent: committing one fires a **shout line** first (the trainer command), then the effect.

The full Call set — the submenu reads this, so adding a Call is **data, not a rewrite**. ★ costs are draft (tuned with the Call economy).

| Call | ★ | Effect | Unlock source | Shout line (`{MON}` = active mon) | Status |
|---|---|---|---|---|---|
| **Catch Breath** | 1 | Skip move, +35 stamina | first Call unlock (the earned bond moment — see `bond-track-v2.md` / the Jay robbery) | `{MON}, catch your breath!` | **BUILT** |
| **Recover** | 1 | Skip move, heal HP and/or clear a status (the canonical in-battle heal — items heal in the overworld) | Call economy (bond tier) | `{MON}, shake it off!` | designed |
| **Dodge** | 1 | Guarantee an evade of the incoming attack (the anime "Dodge it!") | Call economy (bond tier) | `{MON}, dodge it!` | designed |
| **Hang On** | 1 | Survive this action at 1 HP | Call economy (bond tier) | `{MON}, hang on!` | designed |
| **Full Power** | 2 | Next move +50%, ignores stance modifiers | Call economy (bond tier) | `Now — {MON}, full power!` | designed |
| **Get Back** | 1 | Free pivot switch that evades the incoming move | Call economy (bond tier) | `{MON}, get back!` | designed |

Only **Catch Breath** is built today (commits the engine's `catchBreath` action); the rest are **designed**, built with the Call economy (the Bugsy slice). The in-game `CALL_SET` (`src/game/scenes/battle.ts`) mirrors this table.

Leaders have Calls too — with bark-line tells (*"Miltank, wear them down..."*) that double as readable boss telegraphs.

### In-battle healing is a CALL, not an item (canon — Mathias, 2026-06-15)

**Mid-battle healing and status-cure come from the "Recover" Call — never from items.** It's anime-true (you call out to your mon; you don't spray a potion mid-fight) and bonds-over-stuff aligned. This is the canonical resolution of the long-deferred **"in-battle item use"** question: **we do not build it.**

- **Items heal in the OVERWORLD** (the bag, Phase 5a). **Calls heal in BATTLE** (the Recover Call).
- The Recover Call lands with the **Call economy** (the Bugsy slice, per the Falkner-card ratification) — not before. The bag's "in-battle item use deferred / needs an engine Action kind" notes are **retired** in favor of this ruling.
- ★-cost and exact heal/cure values are tuned with the rest of the Call set; treat the row above as the design intent, not final numbers.

---

## Arenas — terrain as strategy and scenery

Every arena renders 1–2 features as field sprites with real hooks.

| Gym | Feature | Hook |
|---|---|---|
| Falkner | Rooftop gusts | Fluid rides gusts: free evade charge; airborne mons drift on the timeline |
| Bugsy | Web lines | Fluid is slowed through webs; Fire moves burn them away (arena alter) |
| Whitney | Pillar floor | Guard behind a pillar upgrades the counter; Rollout smashes pillars — arena degrades turn by turn |
| Morty | Candle dark | Intents hidden while candles are out; Fire/Electric moves relight them |
| Pryce | Ice floor | Aggressive overshoots (self-stagger); Fluid skates (evade buff) |
| Clair | Den pool + mist | Electric chains off the pool; mist phases hide stance glyphs |

---

## Intent & difficulty

| Difficulty | Foe intent | Foe stance | Foe bars | AI |
|---|---|---|---|---|
| Normal | Move category + target | Visible | Visible | Honest |
| Hard | Category glyph only | Hidden until reveal | Visible | Predicts, baits |
| Champion | None | Hidden | **Hidden — read fatigue frames and tells, like the show** | Full Fable, tells vary between rematches |

---

## Boss layer (gym aces, E4, legendaries)

- **Break bar:** fills only on your read-wins and dodges; full = Break → long stagger + phase shift. Bosses are beaten by reads, not raw damage.
- **Phases:** arena feature changes per phase (Whitney's last pillar falls; Morty's candles all die).
- **Ace entry:** letterbox bars + leader face cut-in. Signature move has a unique tell line.
- Leaders hold 2 Calls and use them like players do.

---

## Boss card — Whitney's ace (sim-tuned, ~50k fights)

**Stats vs player ace:** HP ×1.4 · Def ×1.25 · Spd ×0.64 (the wall: can never dodge, can always be dodged)

**Kit:**
| Move | Numbers |
|---|---|
| Rollout | 40 power, ×1.5 per consecutive hit, cap 4 stacks (40→135). *Relentless:* halves dodge chance. Chain breaks on counter, dodge, or Break |
| Body Slam | 80 power — and her stomp when she's read your Guard habit (Fluid stance, punches through) |
| Defense Curl | Next chain starts pre-stacked |
| Milk Drink ×2 | Heals 45% |

**She reads you:** 30% of turns in phase 1, 75% in phase 2 — answering your modal stance (Guard habit → Fluid stomp · Aggression → brace-and-counter · dodging → relentless Rollout). Her 2 Calls: *Hang on* below 20%, *Full Power* on a built chain or a phase-2 stomp.

**Arena:** 2 pillars — Guard in cover takes ×0.55 and reflects ×0.65; a chained Rollout landing on your Guard smashes one. **Break bar: 4** read-wins → she loses a round, chain resets, phase up. Tuning assumes a bag of 2 potions (30%).

**Validated win-rate ladder (3000 fights/cell):**
| Player | Normal | Hard (stances hidden, same stats) |
|---|---|---|
| Button-masher | 15% | 16% |
| Brute force (heavy spam) | **3%** | 4% |
| Simple read-rule | 94% | 85% |
| Mixed/optimal play | 89% | 84% |

The difficulty gap is *pure information* — identical stats both columns. Open lever: stomp power, to pull predictable players on Hard toward ~75%.

---

## Worked turn — Whitney's ace, pillar arena

Foe intent: ⚔ physical (Rollout building). You: Quilava, 62 ST, behind a pillar.

1. You commit **Guard** + counter-class move. Triangle: Guard > Aggressive → **Counter fires**, pillar bonus stacks it.
2. Miltank eats 0.5× reflected, staggers — her timeline chip shoves back; Rollout chain resets.
3. Read-win lights ★. Next turn: **"Now — full power!"** + Aggressive heavy while she's slow.
4. Her player would have Fluid-dodged turn 2 — but Miltank is slow: Aggressive-vs-Fluid speed contest fails her. The wall has a weakness and it's tempo.

---

## Presentation kit (the cinematic language, sprite-native)

- Sprites physically move: melee lunges cross the field, knockback hops, dodge afterimages
- 4 body-language frames per mon: idle / winded / staggered / triumphant
- Palette weather shifts, letterbox reveals, trainer face cut-ins on Calls
- Clash collision animation; finisher slow-flash on the last hit
- Champion mode = "anime mode": no enemy numbers, pure body language

---

## P2 parking lot

- **Range lanes** (close/far per side; push/pull moves; melee cheap close, ranged cheap far) — prototype in the vertical slice, cut if it muddies
- Doubles ladder inherits all systems unchanged

## Renderer event stream (v0.3.3)

`resolveRound` returns a typed `BattleEvent[]` the renderer replays. No combat rule changes from v0.3.2; the event surface gained three entries so the renderer no longer needs to remember pre-round state or re-derive initiative:

- `roundStart` now carries a `SideSnapshot` for each side (`hp`, `maxHp`, `st`, `momentum`, `exhausted`, `staggered`). Seeds display state at the head of the round.
- `initiative` fires after the order resolves, carrying `playerInit`, `foeInit`, and `first` (the side that acts, or `null` if neither side has a move). Unblocks the action-timeline strip.
- `stamina` fires once per side during settle (unless skipped on KO mid-round) with `before`, `after`, and `netDelta` — lets the renderer animate the ST bar instead of snapping.

These are purely informational: no extra RNG calls, no rule shifts, ladder regressions unchanged.

## BattleState shape (v0.3.4)

The engine's `BattleState` is the round-to-round container the renderer + sim consume. As shipped (post-Falkner seam + consolidation):

```ts
BattleState {
  player: SideState                // active mon (1v1 today — 6v6 refactor pending)
  foe:    SideState
  round:  number                    // 1-indexed, increments at end of resolveRound
  history: TurnHistoryEntry[]       // {player: Stance|null, foe: Stance|null} per round
  typeChart: TypeChart              // INJECTED at setup; defaults to LEGACY_TYPE_CHART
  traits:    TraitTable             // INJECTED at setup; defaults to LEGACY_TRAIT_TABLE
  bossCard?: BossCard               // present for boss fights only
  breakProgress?: number            // player's progress toward Break (Break-bar mechanic)
  phase?:         number            // 1 at battle start, +1 per Break
  rhythmAnchor?:  number            // round when the gust cycle was last anchored (defaults 0)
}
```

`SideState` carries `species`, `hp`, `maxHp`, `st`, `exhausted`, `staggered`, `momentum`. `Species` carries `name`, `types[]`, stats, `moves[]`, optional `spr`, optional `trait`.

## Type chart as injected data

The chart is per-battle, not global. `createBattleState(player, foe, { typeChart })` carries the chart through `state.typeChart`; `typeMult(chart, attType, defTypes)` is the only lookup. Defender dual types multiply (1.3 × 0.7 = 0.91 per `docs/type-chart.md` rule 8). Default = `LEGACY_TYPE_CHART` (the pinned 1.5/0.67 demo matrix used by the rival-fight regression ladder). All CH1+ content passes `docs/typechart.json` (1.3/0.7).

## Species traits as injected data

Traits are conditional modifiers active on **arena-rhythm rounds only**. A trait id (e.g., `GUSTBORNE`) lives on `Species.trait`; the runtime lookup table `TraitTable: { [id]: { dmgMult, initMult } }` lives on `BattleState.traits` (injected at setup, defaults to `LEGACY_TRAIT_TABLE` shipped with the engine).

Shipped trait — **GUSTBORNE** (Falkner's GALEHAWK + FLITPECK):
- Active only on rhythm rounds (otherwise neutral 1×/1×)
- Damage `×1.3`, initiative `×1.25`
- Boss content overrides via per-battle `traits` arg without mutating any global. The B1 Falkner lock uses `GUSTBORNE: { dmgMult: 1.4, initMult: 1.25 }`.

## Arena rhythm (BossCard.arenaSchedule)

Boss cards carry an optional `ArenaSchedule` describing the recurring board effect. As shipped:

```ts
ArenaSchedule {
  rhythmEveryN: number             // gust every Nth round
  heavyExtraCost: number           // +ST cost for heavy moves on rhythm rounds
  heavyExtraInitWeight: number     // initiative-weight multiplier for heavy moves
  telegraphAheadBy: number         // renderer-only: telegraph N rounds early
}
```

A rhythm round is defined by `(round - rhythmAnchor) % rhythmEveryN === 0`. On rhythm rounds:
- Heavy moves cost `+heavyExtraCost` ST for **both sides**.
- Heavy moves have their initiative weight `× heavyExtraInitWeight` for **both sides**.
- Trait modifiers apply to trait-bearing species (see GUSTBORNE).

The renderer reads the next round's rhythm status to draw the "the wind is rising…" telegraph. Falkner's schedule: `{ rhythmEveryN: 3, heavyExtraCost: 8, heavyExtraInitWeight: 1.3, telegraphAheadBy: 1 }`.

## Break bar (BossCard.breakBar)

Bosses optionally declare a Break threshold (Falkner: 2). The engine tracks `breakProgress` on `BattleState`; each player **read-win** (counter landed, opening landed, dodge succeeded, clash won) increments it. When `breakProgress >= breakBar`:

- Engine emits `breakProgress` event (with `progress`/`threshold`) per round when progress changes
- Engine emits `break` event with `newPhase`
- `breakProgress` resets to 0
- `phase` increments
- `rhythmAnchor` resets to the current round → the gust cycle restarts

Phase is purely informational data the boss AI policy reads (e.g., Falkner reads at 0% in phase 1, 15% in phase 2). The engine does not coerce the boss to rest on Break; the boss AI is responsible for respecting the phase change.

## BossCard shape

```ts
BossCard {
  species: Species
  statScale?: StatScale       // { hp?, atk?, dfn?, spd? } applied via createSide(species, statScale)
  breakBar?: number           // omitted = no break mechanic
  arenaSchedule?: ArenaSchedule
}
```

`statScale` is applied at side construction (`createSide(species, scale)`), not via manual mutation. Falkner card: `{ hp: 1.15 }` on GALEHAWK.

## Deliberately not in v0.3.4

- **Team battles (6v6).** `BattleState.player`/`foe` are single active mons. Full team support is the next sprint; see `docs/ARCHITECTURE-AUDIT.md` §5.
- **Leader Calls.** Falkner intentionally Call-less per ratification — the Call system lands in the Bugsy slice where the player owns one symmetrically.
- **Effect moves / status / terrain.** Move pool is damage-tier only (light/mid/heavy/nuke). Status, drain, terrain hooks are P1 (per `docs/move-pool.md`).

## Deliberately not doing

- No twitch/reaction inputs — Fluid is a declared read, never a reflex test
- No combo strings, no super meters beyond ★
- No 5th move slot, no stamina items spam (one Ether-class item per battle, cap enforced)

## Input contract — dialog semantics (Phase 0)

The battle scene uses two kinds of text dialog with different B behaviour:

- **Dismissable dialogs** (sub-dialogs surfaced from menu/move): `A` / `Start` advance; `B` immediately backs out to the prior phase. Examples: "Calls unlock after your first win.", "No ★ yet —", "Too winded for heavy moves!", "Not enough stamina!", "No running from a rival!"
- **Forced/sequential dialogs** (intro, end-text, "Got away safely!" exit-text): `A` / `Start` advance; `B` is a no-op — these must be read.

The split lives on `setText`'s `dismissable` flag; default is forced. Pinned by `src/game/scenes/battle.test.ts` (B-on-dialog block).

## Menu surface — Phase 1 (PKMN + party picker)

Battle menu rows are FIGHT / PKMN / CALL / RUN, in display order. The cursor skips disabled rows (CALL when locked, PKMN when no bench survivor). Switching is a turn action.

- **Voluntary switch** (PKMN row): A on PKMN opens the party picker; cursor lands on the first selectable bench mon; A confirms (commits `{kind: 'switch', toIndex}`); B cancels back to menu. Picker shows party as a vertical list with HP, fainted/active tags, cursor-skip on fainted mons and on the current active.
- **Forced switch** (faint on the player's active with at least one bench survivor): same party picker, opened by the engine's `forcedSwitch` event. The engine's auto-advance (`firstSurvivor`) becomes the **default highlight** — the player CHOOSES the next mon (can confirm the auto-pick or override). B is a no-op (must pick). After confirmation, resolve resumes draining remaining events.
- **Bench indicators**: tucked under each side's HP/ST panel — one 4×4 dot per team member, tinted active / alive / fainted. Suppressed during resolve to keep focus on the strike. Solo "teams" render no dots (no team to indicate).
- **Forced switch is a tactical READ**, not a confirmation — picking the next mon is core to the pillar, not polish.

Pinned by `src/game/team-battle.test.ts`.

## Resolve replay — cadence + stance labels (Phase 1 legibility pass)

Combat is mechanically correct; the replay surfaces it for human reading:

- **Cadence**: between non-hold log lines, the renderer auto-advances at ~0.9s — slow enough to read short lines without animation help.
- **Holds (read-required beats)**: auto-play PAUSES indefinitely on consequential events until A/Start. Consequential = `commit` (move), `strike` (every one, so faster-then-slower turn order is a visible beat — not a simultaneous resolve), `dodge`, `opening`, `counter`, `clash`, `faint`, `break`.
- **A on a hold**: releases just that hold; auto-play continues to the next hold.
- **A when NOT held**: still flushes via `skipResolve` (impatient replay).
- **Stance labels on stance-interaction lines** (teach the player WHY a stance outcome happened):
  - dodge: `"X's FLUID dodged it!"`
  - opening: `"FLUID slips past GUARD — opening!"`
  - counter: `"X's GUARD counters!"`

Pinned by `src/game/scenes/battle.test.ts` (resolve-cadence + stance-labels block).
