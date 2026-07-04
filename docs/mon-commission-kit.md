# Mon Commission Kit v1 — outsourcing the dex to Gemini, safely

Companion to `mon-manifest.csv` (345 slots, 169 lines at HEAD — the manifest is the live source of truth for these counts; it grows, so recount there rather than trusting this line), pre-assigned chapter/habitat/types/archetype/rarity. Gemini fills slots creatively; the pipeline keeps stats, balance, and consistency. The old starter trio (EMBERCUB/SPROUTLE/AQUAFIN) is retired from shipping content and becomes permanent sim fixtures — engine tests never change.

> **Sprite production is now a DEFINED method** — see `docs/sprite-pipeline-roles.md` (the four-agent roles + end-to-end workflow) and `docs/gemini-sprite-briefing.md` (the standing governance brief handed to Gemini: aesthetic law + forbidden list, GBC format, archetype→shape language, and the **anti-drift method** — real-animal anchoring + "NOT this" lists — with a worked L001 example). The L001 pilot established that anti-drift method after prose drifted to a bear and a drawn silhouette drifted to a hippo: brief from a real-animal anchor, and Claude Design supplies palette/structure ONLY (never silhouettes — its primitives drift to blobs).

## Workflow (per chapter batch, ~15–16 mons)

1. Filter the manifest to one bucket (start: CH1 — the new starters live there)
2. Run the **design prompt** below in Gemini with those rows pasted in → returns JSON
3. Send the JSON here → I run validation, derive stats from archetype templates, flag problems, produce the approved batch sheet
4. Sprites are **one generation at a time, never bulk** (bulk = quality collapse). Per approved mon: run the sprite prompt with the style-ref image attached → Mathias eyeballs (silhouette / single creature / bold forms / white bg) → accept or regenerate with one corrective clause (never inpaint/edit) → upload accepted PNGs here in groups of 3–5
5. I ingest via `tools/sprite_ingest.py` → contact sheet + in-context 320×180 battle mock → **final approval happens at game scale (56px)**, not at generation scale
6. Batch sim run → batch enters the repo as data

Style anchor rule: the approved EMBERCUB image seeds the style until the fortress-drake stage 1 is approved; from then on, shipping art anchors shipping art. Back sprites are a second pass (starters first); fronts are the quality bar.

Generation priority: starter fronts (9) → Falkner birds (2) → remaining CH1 (~5) → starter backs (3).

## The design prompt (paste into Gemini, then paste the manifest rows for the batch)

```
You are designing original creatures for a Game Boy Color–style monster-
collecting game (NOT Pokémon — all names and designs must be original and
must not resemble existing Pokémon names or designs).

I will give you a list of design slots. Each slot fixes: line_id, stage,
stages_total, habitat, type1/type2, archetype, rarity, and notes. You invent
the creature for each slot. Rules:

NAMES: 4–9 characters, ALL CAPS, compound words blending an element/material
with a creature/sound (style examples: SKYLANCE, GRUBLING, BULWHALE). Names
within an evolution line must feel related. Never use or closely echo a real
Pokémon name.

DEX ENTRIES: exactly 2 sentences. Entries must teach battle instincts
sideways through lore — hint at whether the creature dodges, guards,
counters, or overwhelms (archetype list: Dodger=evasive speed, Wall=endures,
Counter-tank=punishes attackers, Brawler=meets force with force, Glass
nuke=fragile devastation, Pacer=stamina marathoner, Drainer=saps energy,
Trickster=terrain and misdirection).

DO NOT invent stats, numbers, levels, or moves — those are derived by the
game's balance system. Instead give "statFlavor": one adjective describing
a single stat leaning (e.g. "swift", "ironhided", "frail").

For each slot also write "spriteBrief": one sentence describing pose,
body shape, and 2–3 visual signatures for the sprite artist.

Respect the assigned types, archetype, habitat, and rarity exactly.

OUTPUT: a strict JSON array, one object per slot:
{"line_id":"","stage":1,"name":"","concept":"one-line creature concept",
"dexEntry":"two sentences","statFlavor":"","spriteBrief":""}
No other text.
```

## The sprite prompt (per approved mon — attach the approved style-reference image)

```
Pixel art sprite, Game Boy Color Pokémon Gold/Silver battle sprite style,
matching the attached reference sprite's art style exactly. An original
[type] monster: [spriteBrief from the design JSON]. Dynamic 3/4 battle
pose. Hard-edged pixels, no anti-aliasing, black outline, max 4 colors,
flat white background, single creature, no text, no watermark.
```

Back sprites (player-side species only: starters first): same prompt + "seen from directly behind at a slight low angle, chunky, simpler detail."

## Validation pass (what I check before a batch is approved)

1. Schema compliance and slot coverage (every manifest row answered, no extras)
2. Naming law + collision scan against real Pokémon names and prior batches
3. Concept duplication within and across batches
4. Dex-entry rule (2 sentences, archetype legible)
5. Stat derivation: archetype template + stage band ± statFlavor nudge (capped ±8%)
6. Batch sim: full round-robin + archetype ladder; any mon shifting a ladder cell > ±3% gets re-statted
7. Mathias has final creative veto per batch — a rejected slot goes back to Gemini with notes

## Sequencing notes

- CH1 batch includes the three new starter lines — the rival fight re-tunes against them when its boss card is authored (debt already logged)
- GALE is the thinnest type in the manifest (9 mons) by random draw; if you want a birdier world, say so and I'll rebalance slots before CH1 commissioning
- Manifest is the source of truth for *slots*; Gemini's JSON is the source of truth for *identity*; the pipeline is the source of truth for *numbers*
