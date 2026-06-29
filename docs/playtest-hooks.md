# Playtest hooks — permanent infrastructure

The `?skip=…` URL parameters are **permanent playtest infrastructure**, not throwaway scaffolding. They let Mathias playtest any slice of the game in isolation without replaying from the start each time.

**Contract — maintained every sprint:**

1. Every scene that lands in the codebase gets a `?skip=` hook the same sprint it ships.
2. When a scene is refactored, its hook moves with it.
3. When a scene is deleted, the hook entry comes out of this table in the same commit.
4. Each hook is exercised by at least one test (or asserted to construct without throw), so the hook table stays alive as the code shifts.

The hooks live in `src/game/main.ts` near the bottom (`const skip = url.get('skip')` chain). Edit there and update this table in the same commit.

---

## Active hooks

URL: `http://localhost:5173/?skip=<value>[&starter=<species>]`

| `?skip=`        | What it loads                                                        | Notes                                                                 |
|-----------------|----------------------------------------------------------------------|-----------------------------------------------------------------------|
| _(none)_        | Title screen, the cold-start                                         | The Phase 0 gate is the cold-start path with no skip.                |
| `title`         | _(same as none, when set explicitly)_                                 | — currently no-op since absence already routes to title.              |
| **`intro`**     | **Phase 3 canonical cold-start: New Game → BEDROOM.**                 | **Same as picking New Game on the title with no save.** Walk through bedroom (letter) → house (parent) → Hearthwick (town) → lab (Larch + starter ceremony + KAMON theft + push south) → Route 31. |
| `starter`       | Same as `?skip=intro` (back-compat — starter pick is now in-lab)      | Drops player at the bedroom; the starter ceremony lives on Larch's NPC interact in the lab. |
| `bedroom`       | Overworld at BEDROOM, default spawn                                   | Direct-jump for layout testing.                                       |
| `lab`           | Overworld at LAB, default spawn                                       | Phase 3 lab. Starter ceremony is on the Larch NPC; KAMON theft is a step-on near the door, gated by `player_has_starter`. South door → HEARTHWICK. |
| `house`         | Overworld at HOUSE, fromBedroom spawn                                 | Phase 3 furnished interior — parent NPC + furniture signs. Stairs up to BEDROOM, door south to HEARTHWICK. |
| `hearthwick`    | Overworld at HEARTHWICK, fromHouse spawn                              | Small town. 3 flavor NPCs + sign. Player house top-left, lab top-right, south path warp → Route 31. Sets the active starter via `?starter` / `?party`. |
| `overworld`     | Overworld at ROUTE31, default spawn                                   | Re-skinned tileset (`?graybox=1` toggles legacy). Phase 3: the northern building now warps to HEARTHWICK, not LAB. |
| **`overworld-party`** | **Overworld at ROUTE31 with a 3-mon party (GRUBLEAF + KINDRAKE + SILTSKIP)** | **Phase 4 hook — exercises the pause/party menus + reorder out of the box.** `?party=A,B,C` overrides the default roster. Phase 5a: also seeds the default 3 POTIONs, and `?bag=` overrides the seeded inventory. Sets `player_has_starter` so the south gate is open. |
| **`center`**    | **Overworld at HEARTHWICK_CENTER with a 3-mon party pre-damaged to 40% HP + 35 ST** | **Phase 5a hook — exercises the Pokémon Center heal loop AND the bag (3 POTIONs seeded by default; `?bag=` overrides).** Talk to the NURSE → full party heal. Open BAG via START → use a POTION on a damaged mon. `?party=` / `?starter=` work normally. `?money=` seeds the wallet. |
| **`mart`**      | **Overworld at HEARTHWICK_MART with a ₽5000 wallet + 2 POTIONs**     | **Phase 5b hook — exercises the Poké Mart BUY/SELL loop.** Talk to the CLERK → BUY (stock: POTION / SUPER POTION / FULL HEAL) or SELL (half price). `?money=N` overrides the wallet; `?bag=` overrides the seeded stock; `?party=` / `?starter=` work normally. |
| **`violet`**    | **Overworld at VIOLET CITY (the gym hub), fromRoute spawn**           | **Demo-complete hook — the gym slice in one click.** Walk the path north to the gym door → `GYM`. `?party=` / `?starter=` / `?bag=` / `?money=` work. Route 31 → Violet → gym is the real cold-start spine. |
| **`catch`**     | **Route 31 + an immediate catchable wild encounter; 10 balls, 5 potions, 3 badges** | **Phase 6a hook — both catch paths fast.** Path 1: win a read (Guard a foe's Aggression for a COUNTER, or Fluid its Guard for an OPENING) → the BALL row's window opens → throw. Path 2: KO the wild mon → the spare offer → YES tends it with medicine → it joins or refuses. The encounter pops back to the route; the tall grass re-rolls more. `?party=` / `?bag=` / `?money=` work. |
| `gym`           | Overworld at GYM, fromRoute spawn                                     | Sets the active starter via `?starter` (default GRUBLEAF). The gym door now returns to VIOLET (not ROUTE31). |
| `wild`          | Wild battle vs FUZZLET (legacy SPECIES)                               | Legacy path; reset via end → showTitle.                               |
| **`test-battle`** | **Wild battle vs FLITPECK with a CH1 starter; restarts on end** | **Canonical Phase 0 combat-in-isolation hook.** Sets `?starter`.   |
| **`test-battle-2v2`** | **2-mon player party (GRUBLEAF lead + SILTSKIP bench) vs wild KILNDRAKE** | **Phase 1 hook — switching-as-a-read.** Lead is at type disadvantage (FLAME→NATURE 1.3 punish); SILTSKIP (AQUA) is the bench answer (AQUA→FLAME 1.3). Exercises voluntary switch + forced-switch + bench indicators. Restarts on resolve. Override the party with `?party=A,B`. |
| `prep`          | Rival prep scene (legacy EMBERCUB vs KAMON-counter)                   | Legacy demo flow.                                                     |
| `rival`         | Rival battle (legacy)                                                  | Legacy demo flow.                                                     |
| `falkner`       | Falkner boss fight (2-mon FLITPECK→GALEHAWK)                          | Sets the active starter via `?starter` (default GRUBLEAF). On a win it now awards the **ZEPHYR badge** + fanfare beat (same as the real gym), then the demo-end → title. |
| `pct-tiles`     | PCT sample tiles at 320×180 — NATIVE drawImage vs INDEXED side-by-side | Pipeline EYE-CHECK scene (debug bypass; not the production renderer). A/B exits. |
| **`pct-prod`**  | **Walk the `__PCT_VERIFY__` fixture — pct_* tiles through the REAL overworld renderer** | **Production-path confidence check before Tiled (tileRef → registry → indexed decode → draw). Verified headless by `pctProdRender.test.ts`; see `docs/pct-pipeline-verify.md`.** |
| **`tiled-test`** | **Mathias's painted `test-map.tmj` IMPORTED live + walked in-engine** | **Phase-8 Tiled importer demo — multi-layer pct_* tiles + carried `npc_*`/`warp_*` markers, rendered through the real path. Import warnings log to the console. See `docs/tiled-importer.md`.** |
| `end`           | End scene (won = true)                                                | Used to verify the end → onRestart loop.                              |

### Modifiers

| Parameter           | Effect                                                                                |
|---------------------|---------------------------------------------------------------------------------------|
| `?starter=KINDRAKE` | Pick the cold-start starter for any hook that needs one. Valid: `KINDRAKE` / `GRUBLEAF` / `SILTSKIP`. Default: `GRUBLEAF`. |
| `?party=A,B,C`      | Build a multi-mon test party from a comma-separated species list. Wins over `?starter` when present. RNG seeded by a stable hash of the party (same party → same seed). Species must exist in STARTERS or the CH1 dex. Examples: `?party=GRUBLEAF,SILTSKIP` (Phase 1 default); `?party=GRUBLEAF,KINDRAKE,SILTSKIP` (full triangle). |
| `?graybox=1`        | Force the legacy graybox tilemap for any map that has both a graybox and a data-driven version. Useful for layout-vs-art comparison. |
| `?wipe`             | Clears the localStorage save before any other handling runs. Phase 2 — used to QA the New Game / first-time-player path repeatedly without leaving the browser. Stacks with any `?skip=`. |
| `?bag=POTION:3,SUPER POTION:1` | Phase 5a — override the seeded bag inventory for any hook that seeds one (`?skip=center`, `?skip=overworld-party`, `?skip=mart`, `?skip=hearthwick`). Comma-separated `ID:qty` pairs; whitespace around the comma is allowed. Unknown item ids warn-and-skip. |
| `?money=2500`       | Phase 5b — seed the wallet (₽) for shop testing. Non-negative integer; a bad value warns-and-ignores. Applied by the economy hooks (`?skip=mart`, `?skip=center`, `?skip=hearthwick`, `?skip=overworld-party`) after party/bag seeding. |

### Example URLs

- `http://localhost:5173/?skip=test-battle` — drop straight into a wild battle with GRUBLEAF vs FLITPECK.
- `http://localhost:5173/?skip=test-battle&starter=SILTSKIP` — same, but with SILTSKIP.
- `http://localhost:5173/?skip=test-battle-2v2` — Phase 1 2v2 scenario; GRUBLEAF lead at type disadvantage, SILTSKIP on the bench.
- `http://localhost:5173/?skip=test-battle-2v2&party=GRUBLEAF,KINDRAKE,SILTSKIP` — same 2v2 hook with a 3-mon party.
- `http://localhost:5173/?skip=falkner&starter=KINDRAKE` — jump to the Falkner fight as KINDRAKE.
- `http://localhost:5173/?skip=falkner&party=GRUBLEAF,SILTSKIP` — Falkner with a 2-mon party.
- `http://localhost:5173/?skip=overworld&graybox=1` — Route 31 in legacy graybox tiles.
- `http://localhost:5173/?wipe` — clear save, then show the title (no save → no Continue offered).
- `http://localhost:5173/?wipe&skip=test-battle` — clear save, then drop straight into the test battle.
- `http://localhost:5173/?skip=center` — Phase 5a Pokémon Center, party pre-damaged + 3 POTIONs in the bag. Heal via NURSE or via BAG → POTION → target.
- `http://localhost:5173/?skip=center&bag=POTION:1,SUPER POTION:2,FULL HEAL:1` — same hook with a custom inventory.
- `http://localhost:5173/?skip=overworld-party&bag=FULL HEAL:1` — Phase 4 party hook with a single FULL HEAL on hand.
- `http://localhost:5173/?skip=mart` — Phase 5b Poké Mart, ₽5000 wallet + 2 POTIONs. Talk to the CLERK to BUY / SELL.
- `http://localhost:5173/?skip=mart&money=300` — same hook with a tight wallet, to exercise the can't-overspend gate.

### Phase 4 / 5a — the pause + party + bag menu

Press **START** (Enter) in the overworld to open the pause menu. Rows: POKEMON, BAG, SAVE, OPTIONS, BOX (greyed — Phase 6), EXIT. Up/down skips the greyed BOX row. A/Start confirms; B/Start closes.

- **POKEMON** → party list. Each row shows species, lead/fainted tag, and an HP bar. A on a mon → action sub-menu (SUMMARY / MOVE / BACK). SUMMARY shows types, HP/ST, moveset + tier tags, and a labelled BOND placeholder (the forward-hook for the bond system). MOVE lifts the mon — up/down swap it with its neighbour, A or B drops it. B in the list closes back to the pause menu.
- **BAG** (Phase 5a) → pocket tabs along the top: MEDIC / ITEMS / BERRY / KEY / BALLS. ←/→ cycle pockets; ↑/↓ move through the focused pocket. A on a usable item opens a target picker (party list with HP bars) — A confirms, B backs out. Use mutates run.party + decrements bag qty + autosaves; uses on a full-HP / fainted mon show a "no effect" toast and don't consume. Empty pockets show `— empty —` so the player can see Phase 5b/6 surface area.
- **SAVE** = manual save on top of Phase 2's autosave. Flashes "Saved." for a beat.
- **OPTIONS** = stub. "Text speed, audio, controls — coming in a later sprint."
- **EXIT** closes back to the overworld.

Combat-only test hooks (`?skip=test-battle`, etc.) don't wire `onPauseMenu`, so START in those scenes is a no-op.

### Phase 5a — Pokémon Center + items survival loop

The first Pokémon Center is wired in Hearthwick (south side of town, marked by a sign). Inside, talking to the NURSE NPC runs the `heal-party` script verb — main.ts fully restores every party member's HP, ST, momentum, and clears exhausted/staggered, then autosaves. A second sign ("MART — coming soon") flags the Phase 5b surface area.

New Game seeds **3 POTIONs** in the bag. Items live in `src/game/items.ts` (data-driven registry, pockets, pure-function `applyItemEffect`). The Phase 5a starter set is medicine-only:
- **POTION** — restore 20 HP (clamped to maxHp; no-op at full).
- **SUPER POTION** — restore 50 HP.
- **FULL HEAL** — restore HP to full AND clear exhausted/staggered.

`?bag=…` overrides the seeded inventory for the seeding hooks. The bag schema persists via the Phase 2 save (additive `bag?: SavedBagEntry[]` field — pre-Phase-5a saves load with no bag and `version:1` is unchanged).

**Out of scope for Phase 5a** (deferred per kickoff): money, Poké Mart shopping, berries / balls / key-item effects. (In-battle item use is **not** deferred — it is **cut by canon**: items heal in the overworld, the Recover Call heals in battle. See `combat-2-0-spec.md`.)

### Phase 5b — money + Poké Mart (the economy)

The town loop now earns and spends. `run.money` (₽) is seeded by New Game (`STARTING_MONEY = 3000`) and persisted via the Phase 2 save (additive `money?` field — a pre-5b save loads as `STARTING_MONEY`, version stays `1`).

- **Earning.** Winning a **trainer** battle awards money — a per-trainer `reward` declared on the `start-trainer-battle` script command, paid in the game layer (`main.ts`) on resolve, then autosaved. Wild wins pay nothing (trainers-only, anti-grind). Demo-loop trainers: YOUNGSTER JAY on Route 31 (₽500, NPC at (8,5), gated by `route31_trainer_beaten`) and the gym trainer (₽800).
- **Spending.** A real **Poké Mart** sits in Hearthwick (bottom-right building, door at (14,11) → `HEARTHWICK_MART`), the classic Center+Mart pair. The CLERK NPC runs the `open-mart` script verb (terminal, like `show-starter-pick`) → the Mart scene. **BUY** (stock: POTION / SUPER POTION / FULL HEAL) charges the listed price and adds to the bag; a quantity selector caps to what the wallet can afford — **overspending is impossible**. **SELL** gives half price (classic) and decrements the bag. The Phase-5a "MART — coming soon" noticeboard in the Center now points at the open shop.
- **Bag integration.** Purchases feed the same `run.bag` the Phase 5a bag UI shows; money is displayed top-right in both the bag and the Mart.
- Prices live on the item registry (`items.ts`); the buy/sell/payout math is pure in `economy.ts`. **Engine untouched** — money is a game-layer concern; both ladders stay bit-identical.

**Out of scope for Phase 5b** (deferred): held items, item effects beyond healing, balls / catching (Phase 6), berries' effects, the Game Corner (cut). In-battle item use is **cut by canon** — battle healing is the Recover Call (`combat-2-0-spec.md`).

### Phase 6a — Catching 2.0 (both paths)

`?skip=catch` drops onto Route 31 and pushes a catchable wild encounter immediately (10 BALLs, 5 POTIONs, 3 badges seeded so both paths are a real gamble).

- **Path 1 — the read window.** Winning a read against the wild mon opens a CATCH WINDOW: a **COUNTER** (Guard its Aggression), an **OPENING** (Fluid past its Guard — the cleanest opener), a **dodge**, or a clash-win = a 1-round window; an **EXHAUSTED** foe is a standing window. The battle menu's **BALL** row throws during the window (chance scales read ×1.0 / exhausted ×1.5 / Broken ×2.0 × rarity × ball × mild HP). Throwing **out of window** auto-fails and raises **Wariness**; at Wariness 3 the mon telegraphs ("looking for an escape!") then **flees** — never instant-poof.
- **Path 2 — the willing join (mercy).** A fainted wild mon can't be ball-caught. KO it and the **spare offer** appears (when you hold medicine): **YES** tends it → a willing-join roll (badges primary, the lead's bond a bonus, rarity the difficulty) → it **joins** or **refuses with a hint** (a lesson). NO claims the normal win.
- Caught/joined mons enter the **party** (or the box if full). **BALL** is in the Mart + the starting bag. A minimal **per-mon bond** is tracked + persisted (read-wins/boss-clears bump it) — the interim the full Phase-8 bond system layers onto.
- **Engine hook:** a sanctioned `throwBall` Action (turn mechanics only — the thrower forgoes its strike, the foe acts, no stamina change). The catch math is game-side. Sim bots never throw → both ladders bit-identical.

### Phase 6b — Evolution (bond-gated, boss-capped)

`?skip=evolve` seeds a **bond-ready FLITPECK + the ZEPHYR badge** (both evo gates met) and pushes a wild fight — **win it to see FLITPECK evolve into GALEHAWK** at the end-of-fight beat. Open the party menu (START) → **ASK** (a flavored bond/readiness response) or **SUMMARY** (the BOND line shows the named stage + "Ready to evolve!").

- **Two gates (S1):** a mon evolves when its **bond stage** (read from the interim 6a bond value) AND its **gating badge** are BOTH met; whichever is satisfied second triggers it, at the end of the qualifying battle. Blocked when only one gate is met.
- **CH1 data (S2):** the 3 starter lines, FLITPECK→GALEHAWK, GRITHOAX→CAVELURE→CHASMTRAP. Stage-2→3 evos gate on the Gym 2 (HIVE) badge — correctly **blocked** in the demo (Gym 2 isn't built). `docs/evolution-design.md` is canon; "16/34" is gone.
- **8-badge uncap (S3):** an evo with no progress gate (post-Gym-8) is bond-only — built and correct.
- **Catch Breath** now restores **50% of max ST (+50)**, up from +35 flat (Phase 6b balance).

### Phase 3 — the opening intro

The cold-start `?skip=intro` walks the player through the six beats of `docs/opening-design.md`: bedroom letter → furnished house + parent → Hearthwick town (3 flavor NPCs + "trainers are rare" sign) → lab (Larch's inheritance speech + starter ceremony) → KAMON theft (gated by `player_has_starter`, branched per starter via `if-flag`) → push south → Route 31.

Flags the intro sets, in order:
- `spoke_to_parent` — talked to Mom in the house
- `player_has_starter` — set by the starter-pick onPick (also `starter_<name>`)
- `kamon_theft_fired` — set by the step-on script in the lab (one-shot marker)
- `kamon_took_<species>` — the species KAMON took (counter-type to your pick)
- `pushed_south` — set by Larch's post-theft push speech

**HARD gate (system-critical):** the Hearthwick south exit (the only path to Route 31) is blocked by a TOWN ELDER NPC until `player_has_starter` is set. This prevents a starterless player reaching wild encounters they can't fight. All other intro beats (letter, Mom, town flavor NPCs) are SOFT — reachable but skippable.

Combat in isolation still bypasses the intro: `?skip=test-battle`, `?skip=test-battle-2v2`, `?skip=falkner` all preload a starter and skip the ceremony.

### Phase 2 — save / load + the Continue path

- **Autosave** fires silently on every overworld scene-transition (warp completion, battle resolve) and on `window.beforeunload` (tab close / refresh). Never mid-battle.
- **Continue** appears on the title screen only when a save exists. Selecting it restores party (hp/st/momentum), position (map/x/y/facing), flags, call-unlock, and the RNG seed. `New Game` wipes the save.
- **Save shape** is `version: 1` (see `src/game/save.ts`). Unknown / older versions are treated as no save.
- To test the New Game flow without ending up with a stale save: append `?wipe` to whatever URL you're loading.

---

## When you add a scene

In the sprint that introduces the scene:

1. Wire its show/push helper into `main.ts`.
2. Add a `?skip=<name>` branch in the URL handler at the bottom of `main.ts`.
3. Add a row to the table above.
4. Add a test that constructs the scene (typically by including it in the integration test or a per-scene test).

If a scene needs a non-trivial precondition (a starter pick, a flag set, a party state), prefer either:
- a dedicated `show<Scene>FromSkip` helper that sets up the preconditions, OR
- a new URL modifier that the scene consumes (like `?starter=`).

Don't ship a scene without a hook — the cost is that future bugs in that scene can only be reproduced by replaying the whole game, which is exactly what this file exists to prevent.

---

## Why this is permanent infrastructure

The `BUILD-ROADMAP.md` ruling: we build the real game in dependency order, but Mathias must be able to playtest any slice without replaying from the start. These hooks are how that promise is kept. They are NOT throwaway scaffolding — they get maintained every sprint. A sprint that ships a scene without its hook is incomplete; a sprint that breaks a hook without updating this file is a regression.
