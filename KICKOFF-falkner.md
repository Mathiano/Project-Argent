# Falkner Vertical Slice — the convergence sprint

Read first: docs/falkner-boss-card-v2.md, docs/type-chart.md,
docs/ch1-batch-sheet.md, docs/move-pool.md. This sprint sanctions
specific engine additions — each is sim-gated. Nothing else in
src/engine changes.

## Part A — engine hooks (each lands with its own tests + green ladder)

A1. Type system as injected data: engine takes a type chart at battle
    setup. CRITICAL RULING: the fixture trio's regression ladder keeps
    its LEGACY demo chart (1.5/0.67) as pinned test data — the 15-cell
    baseline must stay bit-identical. All new content uses
    docs/typechart.json (1.3/0.7). Chart is data; the engine never
    hardcodes either.
A2. Dex + move loaders: ch1-batch.json and moves.json -> Species/Move
    data. DESIGN RULING: levels gate movesets only (kit available at
    encounter level per learnset); stats are species-static — no
    level->stat scaling exists yet. Do not invent one.
A3. Species trait slot + GUSTBORNE: conditional modifier active on
    arena-rhythm rounds (damage x1.3, initiative x1.25), data-driven.
A4. Arena rhythm schedule on BossCard: round-modifier table (gust every
    3rd round, telegraphed one round ahead; heavies +8 ST and x1.3
    initiative weight for BOTH sides on gust rounds).
A5. Break bar: fills on player read-wins only; full = Break (boss loses
    a round, phase flag, gust cycle resets). Emits events the renderer
    can replay.
A6. Boss card loader: stance/move policy + Call usage driven from
    falkner-boss-card-v2 data (phase 1: DIVE BOMB only on gust rounds,
    0% reads; phase 2: 15% reads, bait WING CUT on gusts, holds "Now —
    full power!" for a low-ST gust round).

## Part B — sim gates

B1. Falkner ladder: 5 archetypes x 3 new starters at band, n=2000/cell.
    Tune ONLY the levers on the boss card, in the card's stated order,
    until every cell lands in its target range. Lock as a vitest
    regression with seeds + tolerance bands.
B2. CH1 batch sim: 15-species round-robin + archetype ladder with
    derived kits. Flag any mon shifting an archetype-ladder cell >±3%
    and any softlock-prone kit (exhaustion-rate validation hook from
    move-pool.md). Report results — re-statting is a design call, not
    yours.

## Part C — the slice (game layer)

C1. Starter pick switches to the new trio (KINDRAKE / GRUBLEAF /
    SILTSKIP) from dex data. GRUBLEAF + KINDRAKE render their real
    sprites (note 'facing' field); everything else placeholder.
C2. Route 31 encounters switch to CH1 species (FLITPECK in grass);
    add a dark-cave-mouth zone with GRITHOAX (the TERRA prep-catch).
C3. Violet gym map (graybox): rooftop walkways with the wind-routing
    puzzle — timed gust pulses push the player; crossing requires
    moving between pulses. Same rhythm the fight demands.
C4. One gym trainer fight (simple archetype AI) whose win adds a line
    to the scout report.
C5. Prep card before Falkner from the boss card's scout section, then
    the fight: FLITPECK lead, GALEHAWK ace, gust telegraph line, intent
    strip, Break bar UI (2 pips), phase shift, Falkner's Call with bark
    line, badge + first Trainer Call slot award, instant retry to prep
    on loss.

## Acceptance
- Cold start: pick a new-trio starter -> route -> optional cave catch
  (catching can remain the demo-style simple catch; Catching 2.0 is
  NOT this sprint) -> gym puzzle -> trainer -> prep -> Falkner with all
  mechanics live -> badge.
- Fixture ladder bit-identical; Falkner ladder + batch sim locked green;
  all tests green; CI green; push per convention.
- Report: sim tables (Falkner cells + batch flags), screenshots of the
  gym and the fight, any spec ambiguities. Do NOT resolve ambiguities
  by inventing design — flag them.
