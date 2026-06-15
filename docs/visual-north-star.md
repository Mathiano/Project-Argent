# Visual North-Star — what "beautiful Argent" looks like (VISION, build deferred to Phase 7+)

**Status:** vision doc, NOT a build. Captured now so the target is concrete; built in the Phase 7+ art/polish pass, against a frozen, working game. Everything here is a *data swap* on the existing data-driven engine (tilesets, prefabs, sprites, animations are all data) — so none of it requires engine changes, and the architecture is already built to receive it.

## The thesis

Argent is Silver *revamped* — so the visual bar is "**Silver's soul at a fidelity Silver's hardware never allowed.**" Not photoreal, not a different art style — recognizably GBC-descended pixel art, but with the resolution (320×180, 6× the GBC working area), color depth (64-color master palette), and animation budget that 1999 couldn't afford. The reference points are modern pixel-art games that kept retro *language* while adding modern *craft*: Stardew Valley's warmth, Eastward's lighting, the newer fan-Pokémon and HD-2D looks.

**The rule that makes it affordable:** we beautify *last*, against frozen systems, as data. A static sprite → animated sprite is a data swap. A flat tile → animated tile is a data swap. We never re-architect for visuals; we *fill in* the visual layer the engine already consumes.

---

## The five layers (cheapest/most-tractable → hardest/most-labor)

### Layer 1 — Environment art (MOST TRACTABLE — design chat can do this directly)
The world's look. Already proven (the cozy houses, per-city materials, water/edge tiles).
- **Multi-tile buildings** with real architecture — per-city material identity (Violet plaster, Azalea plank, Goldenrod brick), proper roofs, windows, awnings.
- **Full edge/transition tiles** — grass-to-path, grass-to-water, cliffs, ledges, so nothing reads as a hard rectangle seam.
- **Interior richness** — furnished homes, the lab, the Center/Mart/Academy as recognizable, characterful buildings.
- **Detail density** — flowers, signs, fences, clutter that makes a place feel lived-in.
- **Verdict:** confidently achievable, largely by us, already past GBC fidelity. This is the floor we're already standing on.

### Layer 2 — Creature sprites (SOLVED — the Gemini pipeline)
The 200 mon. Already working (KINDRAKE, GRUBLEAF ingested and looking strong).
- Front + back + dex icon per species, ingested via `tools/sprite_ingest.py` (palette-quantized, outlined, game-scale).
- **Verdict:** solved as a pipeline; it's a throughput question (200 mon × the pipeline), not a feasibility one.

### Layer 3 — Character & overworld animation (MODERATE LABOR)
The world *moving*.
- **Player + NPC walk cycles** (3-4 frames, directional) — the basic version exists; the polished version is smoother and characterful.
- **NPC behaviors** — idle animations, NPCs that walk paths, turn, react, sit, work. The "living world" the scope doc wants.
- **Animated tiles** — water ripples, grass sways, flowers bob, flags wave, lab equipment flickers, the Center's healing machine. 2-3 frames each; the world *breathes*.
- **Door/warp animation** — doors that open, stairs that feel like descent, the screen transition between maps.
- **Verdict:** very doable, real but moderate labor. Animated tiles are high-impact-per-frame; NPC behavior is where the "alive" feeling comes from.

### Layer 4 — Battle presentation (HIGH IMPACT — the biggest single visual leap)
The thing the eye most wants, and the thing Silver most lacked.
- **Moves that connect** — a melee lunge that crosses the field, a projectile that travels, knockback hops, the attacker physically *doing* the move instead of two sprites staring while text scrolls. THIS is the single biggest upgrade available.
- **Impact frames** — hit flashes, screen-shake on heavy blows, a finisher slow-flash on the last hit.
- **Body-language frames** per mon — idle / winded / staggered / triumphant (the combat-2-0 spec already calls for these). The intent-tells system *renders* through these (a mon "leans forward" = an actual animation).
- **Stance & Call theater** — a Counter that visibly reflects, an Opening that visibly slips past, a Call that brings a trainer-shout cut-in. The legibility we built in *text* becomes legibility in *motion*.
- **Boss cinematics** — letterbox ace entries, the GUST ROUND visibly gusting, the Break beat visibly *breaking* the foe, phase-shift arena changes.
- **★ The CATCH SEQUENCE (REQUIRED, not optional polish)** — the ball flying out, the wild mon pulled in, the ball dropping and **wiggling 2–3 times** (the anticipation beat that IS the tension), then the **click** (caught) or the **breakout** (escaped). Catching 2.0 is mechanically built (Phase 6a) but currently resolves in a line of text; **it does not *feel* like a catch without this sequence.** Flagged high-priority for the visual pass — the read-window + Wariness tension the systems create only *lands* when the wiggle/click sells it. (Mirror for Path 2's willing-join: a gentler "it rises and steps to your side" beat.)
- **Verdict:** the highest-value visual work, and a significant labor investment (animation × every move × every mon). Correctly deferred to last — but it's the layer that turns "good combat" into "*thrilling* combat." The catch sequence specifically is the cheapest *required* item here (one reusable animation, not per-mon).

### Layer 5 — Effects, lighting & atmosphere (POLISH — the final 10% that reads as 50%)
The shine.
- **Day/night palette shifts** (already designed) — dawn/day/dusk/night tints, the Gen-2 clock soul, nearly free as a palette swap.
- **Weather** — rain, snow, fog as particle + palette layers, tied to field-state combat.
- **Particle touches** — dust when running, leaves in wind, **the catch click's star-sparkle confirm** (the payoff flash the moment the ball locks — pairs with the Layer-4 catch sequence), embers near fire mon.
- **Lighting moments** — a warm glow from the lab window at night, the Center's light, torch-lit caves.
- **Evolution sequence** — the iconic silhouette-morph-flash, a real ceremony.
- **Verdict:** mostly cheap *individually* (palette + particle tricks), enormously high-impact *collectively*. This is what makes screenshots look special.

---

## The honest labor map (where the mountains are)

| Layer | Tractability | Who | When |
|---|---|---|---|
| 1 — Environment | High | Design chat directly | Phase 7+ (interleaved) |
| 2 — Creature sprites | Solved (pipeline) | Gemini pipeline | Ongoing, throughput |
| 3 — Overworld animation | Moderate | Design chat + possibly a hand | Phase 7+ |
| 4 — Battle animation | **The mountain** | Likely needs dedicated time / a pixel-animator for full polish | Phase 7+, the long pole |
| 5 — Effects/atmosphere | Cheap-ish, high-impact | Design chat | Phase 7+ |

**The one clear-eyed caveat:** Layer 4 (full battle animation across 200 mon × every move) is the single largest labor investment in the project. It's the place where "how beautiful" is ultimately decided by how much dedicated time — or how many hands (a pixel artist/animator, the way real Pokémon games have art teams) — go into the final pass. Layers 1, 2, 3, 5 we can take a long way ourselves; Layer 4's *full* ambition realistically benefits from more hands or a long dedicated pass. Better to know that now than discover it at Phase 7.

## The target, in one sentence

A cohesive, warm, *living* pixel world — recognizably Silver's descendant, animated and atmospheric in ways Silver's hardware never allowed — where the overworld breathes, the towns each have character, and battles are *thrilling to watch*, not just to read.

## Sequencing (unchanged discipline)

- **Now:** placeholder/first-pass art; systems first (per BUILD-ROADMAP). The current tileset is enough to not be graybox.
- **Phase 7:** the first real chapter gets the Layer-1 environment pass + Layer-3 animated tiles, so one slice of the world is genuinely beautiful as a proof.
- **Phase 7-8+:** battle animation (Layer 4) and effects/atmosphere (Layer 5) roll in, against the frozen, working game.
- **Everything is a data swap** — no engine work, no re-architecture, because the engine was built data-driven for exactly this.
