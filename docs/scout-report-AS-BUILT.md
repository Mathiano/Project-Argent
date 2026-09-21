# Scout-report economy — AS-BUILT (code-truth)

**Status: SHIPPED 2026-09-21.** Delivers the P0 line in `project-argent-scope.md`
§Prep Phase: *"Scout report — Leader's roster, ace, known patterns — earned via gym
trainers and phone contacts; **intel is a currency**."*

This doc is **code-truth**. Where it and a design doc disagree, flag the conflict
(CLAUDE.md) — do not silently edit either.

---

## What was there before

Both prep screens printed authored strings unconditionally. Two consequences:

1. **The economy was fiction.** Violet's GYM GUIDE said *"beat his trainers first —
   they hand out a scout report"*, and nothing in the game backed that sentence. A
   player who walked straight past every trainer saw the identical sheet.
2. **The strings drifted from the card.** The screen advertised **"Break bar 2 — two
   reads cracks him"** while Falkner's live card carried **`breakBar: 4`** (the
   Spine-1 2→4 re-baseline, `docs/combat-build-status.md`). It shipped that false
   number for months. `docs/ARCHITECTURE-AUDIT.md` §239 had predicted exactly this
   and named the fields to derive from instead.

---

## The build

### `src/game/scout.ts` — pure, headless, unit-tested

| Piece | What it does |
|---|---|
| `ScoutFacts` | Everything a line may quote, read off the **live** `BossCard` + `Species` + `TypeChart` |
| `bossScoutFacts()` | Builds the facts from a card. No literals. |
| `weaknessesOf(types, chart)` | Derives the type edge by ATTACKER row, multiplied across a dual-type defender |
| `ScoutLineDef` | One row: `id`, `label`, optional `intelFlag`, `sourceHint`, optional `requires`, `tone`, `render(facts)` |
| `buildScoutReport(def, facts, hasFlag)` | Resolves a def against the player's flags → entries + `known`/`total` |
| `intelFlagsOf(def)` | Every flag that buys a line |
| `FALKNER_REPORT` | The Violet Gym sheet (below) |

A line with no `intelFlag` is **free** (you will see it the moment the fight opens,
so redacting it would be theatre). A line with `requires` is **derived**: it is not
purchasable and does not count toward `total` — it stays hidden until its
prerequisite is known. Redacted entries carry `hint`, never the real text, so the
value cannot leak through the render layer.

### Falkner's sheet — six purchasable lines

| Row | Source flag | Seller | Skippable? |
|---|---|---|---|
| *(free)* ace + type | — | — | — |
| *(free)* speed | — | — | — |
| `WEAK TO` | `gym_trainer_2_beaten` | BIRDKEEPER (gym) | no — holds a sight-line |
| `TRAIT` | `route31_birdkeeper_beaten` | **WREN (Route 31)** | **yes** — another map entirely |
| `RHYTHM` | `gym_trainer_beaten` | **GYM TRAINER by the door** | **yes** — no `sightRange` |
| `ROSTER` | `gym_trainer_3_beaten` | FLEDGLING (gym) | no |
| `OPENING` | `gym_trainer_4_beaten` | ACE (gym) | no |
| `BREAK` | `gym_trainer_4_beaten` | ACE (gym) | no |
| `TEMPO` *(derived)* | requires `RHYTHM` | — | — |

**Why two skippable sources.** If every seller were unavoidable the report would be
a formality — everyone arrives at 6/6 and nothing is a currency. The gym's first
trainer stands off the sight-lines (`gym.json` (7,12), no `sightRange`) and WREN is
an optional Route 31 trainer, so a beeline arrives at 4/6 without the gust count or
the trait, and an explorer arrives at 6/6. That difference *is* the economy.
`src/game/scoutWiring.test.ts` pins both the skippability and the sight-lines.

**Why the ACE sells two lines.** One source may sell several facts. That is why each
row carries a **`label`**: a redacted row shows `OPENING  ??? — ACE, inside` rather
than two anonymous `???` rows pointing at the same trainer.

### The handover is in-fiction, not a banner

Each seller's `interactAfterFlag` dialogue was re-authored to actually say what it
just told you, and Violet's GYM GUIDE now signposts the off-site source (without
that pointer, the one line the gym never sells is undiscoverable). Authored in
multiples of 3 lines — `overworld.ts` paginates at `DIALOG_LINES_PER_PAGE = 3`.

There is deliberately **no "SCOUT REPORT UPDATED" modal**. The trainer says it, and
the sheet's `INTEL n/6` counter carries the state.

### Dev hook

`?skip=scout&intel=<flags|all>` opens Falkner's sheet with a chosen slice of intel
(omit `&intel` for an empty report). The report is a pure function of the flags, so
this is the whole surface a playtest needs without replaying the gym. It is
**`scout`**, not `prep` — `?skip=prep` is the generic KAMON-style prep scene.

---

## Findings surfaced while building

- **The prep screen lied about the break bar.** Fixed by derivation, and
  `docs/combat-2-0-spec.md` §Break bar (which still says "Falkner: 2") is annotated
  as the stale doc rather than edited — `combat-build-status.md` records the 2→4
  change with sim evidence.
- **The `A: FIGHT` prompt was invisible.** It was drawn in `PALETTE.paper` on top of
  the parchment panel — the same warm cream. `prep.test.ts` now fails any text drawn
  inside `drawPanel` using a paper colour.
- **The ace portrait is 112px battle art** — half the logical screen. It is drawn at
  an exact 2:1 downscale; `drawSpriteInSlot`'s `slotSize` only anchors, it does not
  resize, so passing a small `slotSize` silently overflowed the panel.

---

## Not built

- **The generic prep scene (`prep.ts`) still hardcodes `FOE_HABIT_STANCE = 'A'`.**
  Its own comment says it should come from the trainer profile's stance tendency.
  KAMON is an `aggressor`, so today the literal happens to be right — which is
  exactly how the break-bar lie survived. Deriving it is the obvious follow-on.
- **Only Falkner has a report.** The def format is generic; a second boss is data.
- **No phone contacts.** The scope doc's other named intel source (Phone 2.0, P1).
- **No mirror rule** (Hard+ leaders scout *you*) — P1, unbuilt.
