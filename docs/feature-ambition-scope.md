# Ambition Scope v0.1 — the fan-feature map

Two filters applied to every candidate: (1) pillar-fit — no grind, respect time, battles are puzzles; (2) leverage — does it use Combat 2.0 (stances/stamina/reads/★) or the on-cartridge AI? Features passing both get tiers. P0 = core path, P1 = first post-launch wave / late chapters, P2 = parked until the spine is done.

---

## 1. Catching 2.0 — P0 (Sprint 4 needs this anyway)

> **Superseded — the canonical spec is now `docs/catching-2-0.md` (the TWO-PATH system).** This section is the original **single-path** sketch (Path 1, the read window). The locked design keeps everything below as Path 1 and adds **Path 2 — the willing-join mercy path** (heal a fainted wild mon → badge/level/bond-gated acceptance → joins or refuses-with-a-hint), making catching express the strength-vs-bonds thesis. Read `docs/catching-2-0.md` for canon; the notes below remain accurate for Path 1.

Gen 2 catching is ball-spam RNG. Ours is a read: **you can only throw during a window you create.**

- Windows: you win a read (counter / dodge / opening / clash-win) → 1-round window; foe exhausted → strong window; foe Broken (rare wilds carry small Break bars) → best window
- Catch chance = species rarity × window quality (read-win ×1.0, exhausted ×1.5, Broken ×2.0) × band type × mild HP factor
- Throwing outside a window auto-fails and raises **Wariness**; high Wariness → the mon telegraphs that it will flee next round (never instant-poof RNG)
- ★ spend: "Steady Throw" holds a window open one extra round
- Crafted bands (the Kurt/apricorn slot): each favors one window type — a band for exhausted targets, one for Broken, one for full-★ throws

Catching becomes the same skill as battling. The Safari-Zone analog (**the Preserve**) is this system with no-KO rules and rare spawns.

## 2. Temperaments & Marked mons — P0.5 ⚠ schema-blocking

Natures reinvented for our economy. Instead of ±10% stat noise, a temperament bends **stance economics** — individuals genuinely play differently:

| Temperament | Effect |
|---|---|
| Stoic | +2 guard regen / dodge cap −0.10 |
| Hotblooded | clash score ×1.15 / counter damage taken +10% |
| Slippery | Fluid surcharge −4 / guard regen −2 |
| Patient | base regen +2 / clash score ×0.9 |
| Reckless | heavy cost −5 / damage taken ×1.05 |
| Steady | stagger penalty halved / damage dealt ×0.95 |
| Proud | starts battle with 1★ / max HP −5% |
| Skittish | dodge slope +0.3 / clash score ×0.8 |

Sim gate: each temperament solo must shift the archetype ladder ≤ ±3%. **Marked** mons = our shinies, upgraded: rare palette variant (palette swaps are nearly free — the same trick that birthed shinies in Gen 2) + a fixed temperament + one off-archetype stat. ⚠ Temperament + Marked fields must enter the dex schema **before** the Chapter 1 species slice locks.

## 3. The living world — the AI flagship cluster

| Feature | Ancestor | Our twist | Tier |
|---|---|---|---|
| Clock & events | Gen 2 day/night | palette tints + weekly events (bug contest, sister-of-the-day) feeding NPC schedules | P1 |
| Phone 2.0 | annoying Joey | trainers who *remember the fight*: "you guard-countered me to death — I've been drilling Fluid," and their rematch AI actually changed; gossip leaks boss intel into your scout reports | P1 |
| Dex-as-journal | static entries | each species page grows field notes from YOUR history with it — battles, catches, signature reads; completing the dex means having *lived* with all 151 | P1 |
| Trade NPCs with arcs | Gen 1 trade NPCs | they text you later about the mon you gave them; the world holds what you did | P1 |
| Trainer Den | R/S secret bases | a room that auto-curates your run: Break-shards from no-loss boss kills, plaques written from your actual battle event logs ("Round 9 vs Whitney: three Rollout reads in a row") | P2 |
| Radio | Gen 2 radio | Battle Radio breaks down famous NPC fights (teaches advanced tech); Rumor station feeds legendary tracking | P2 |

The event stream the renderer replays is also the world's memory — Den plaques, dex notes, and Phone callbacks are all *reads of data we already record*.

## 4. Legendaries & story — P1 content, P0 narrative seed

**The Stance Beasts (3):** roaming legendaries, each the living embodiment of one stance — one fights pure Aggressive, one pure Guard, one pure Fluid, at absurd stats. Beatable (and catchable) *only* by perfect counter-play: the triangle as theology. Tracking is deduction — NPC rumors, radio reports, footprint clues — never random-encounter roulette with mandatory trap moves. Catching one is winning a read-war against a god.

**The cover legendary (4th):** mixes all three stances at Red-tier read rates. The optional catch-superboss above even Mt. Silver.

**The rival arc — already shipping, costs nothing:** the demo canonized that his stolen starter *hesitates* (fights at 0.85). Across his six fights that scale rises 0.85 → 1.0 → beyond, as the mon chooses him. The final fight, it protects him by its own read, not his order. Silver's redemption arc told through a number we already tuned. The villain-team arc (Rocket-analog) stays Silver-shaped: radio tower, well, hideout — beats authored per chapter.

## 5. Endgame & challenge cluster

| Feature | Ancestor | Our twist | Tier |
|---|---|---|---|
| The Gauntlet | Battle Tower | roguelike node-map runs (catch/trade/elite nodes — the Pokelike DNA), weekly seeds, trainer read-rates climbing past Red's; rental floors teach archetypes | P1 (first post-launch) |
| Daily Puzzle | — | a fixed battle state + constraint: "win in 3 rounds from here." Chess puzzles for Combat 2.0 — *every battle is a puzzle*, literalized. Nearly free: it's a battle state + a checker | P1 early |
| Replays & ghosts | — | event streams are replayable by design → save any battle, replay your last E4 attempt as a ghost, share seeds | P1 early |
| Rematch ladder | Gen 2's gap | every leader rematchable at climbing read rates via Phone 2.0 | P1 |
| Challenge modes | community Nuzlocke | built-in: Nuzlocke (permadeath + first-encounter), Mirror rule on Hard, Champion-info toggle, level-cap default, speedrun timer | P1, cheap toggles |

## 6. Side systems

| Feature | Verdict |
|---|---|
| Daycare/breeding | reframed as **the Dojo**: deterministic move-inheritance + temperament blending for build crafting. No passive XP (anti-pillar), no IV lottery. P2 |
| Gym rooms | each gym's puzzle room teaches the *same lesson as its leader* (Falkner's = wind-current routing before the gust fight). P0 rule, authored per boss card |
| Field-skill keys | HM replacement: charms/key items, zero move slots. Already pillar law. P0 |
| Berry/apricorn trees | daily-clock harvest feeding band crafting; small revisit-reasons. P1 small |
| Game Corner | **cut.** Replaced by the Puzzle Parlor (Daily Puzzle building, archived sets) |

## 7. Anti-scope — we will not build

IV/EV grinding economies. Gambling. Daily-login FOMO mechanics. Real-time online PvP (async ghosts/replays may come later). Open-world restructuring — Silver's shape *is* the product. Procedural story.

## 8. Naming debt — flag now, fix later

Mon names are original (shareable by design). Leader names, town names, and "Pokémon"-isms are still Nintendo's. A 1:1 rename pass (Falkner → original bird-master, Violet City → original town) is a known P2 task before anything public. Design docs keep Silver names as coordinates until then.

## 9. Graduation list — entering official scope now

1. **Catching 2.0** → P0, spec'd above, Sprint 4 dependency
2. **Temperaments + Marked** → P0.5, must precede the Chapter 1 dex slice (schema fields)
3. **Rival hesitation arc** → P0 narrative, already mechanically live
4. **Gym-room-teaches-the-leader rule** → P0, added to boss card template
5. **Daily Puzzle + replays** → P1-early (cheapest joy per line of code in the whole doc)
6. **Stance Beasts + cover legendary** → P1 content, names in a dex pass
7. **Phone 2.0 + dex-as-journal + rematch ladder** → P1, the AI flagship
8. Gauntlet stays P1 first-post-launch as scoped; Den, Dojo, Radio parked P2
