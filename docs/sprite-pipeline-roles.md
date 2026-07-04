# Argent Sprite Pipeline — Roles & Workflow (four agents)

> **SUPERSEDED in part by `docs/DECISION-sprite-canon-112.md` (pipeline v2, 112px native, per-mon palettes) — roles below describe the pre-Studio loop.**

**Purpose:** define exactly who does what in sprite production, so the pipeline is clear and nothing falls between the agents. Derived from the L001 constraint-sheet pilot, which taught us the real boundaries (esp. that Claude Design draws *structure*, not creature silhouettes — those drift; real-animal anchoring in the Gemini brief is the actual drift-fix).

## The four agents

| Agent | Role | Owns |
|---|---|---|
| **Chat (this chat / "Fable")** | Design authority + brief author | The mon's locked concept (from the manifest), the **real-animal-anchored sprite brief**, the aesthetic check, the front/back/icon spec, and the final design sign-off before a slot goes to Gemini. Validates Identity JSON. |
| **Claude Design (CD)** | Palette + structure layer (NARROW) | Per-type **palette ramps** (the molten/frost/etc. swatch sheets), the **layout/structure** of a constraint sheet (headers, archetype tags, "NOT this" panels as text/structure), proportion callouts. **NOT creature silhouettes** (its vector primitives drift to generic blobs — see pilot). |
| **Gemini** | Sprite generation | The actual **56px GBC creature art** — front sprite, back sprite, dex icon — one mon at a time, from Chat's real-animal-anchored brief + CD's palette. The only agent that draws the creature. |
| **Claude Code (CC)** | Integration + pipeline | Ingesting approved sprites via `sprite_ingest.py` (the 56px scale check, the 320×180 battle mock, front/back/icon variants), wiring them into the game (sprites.ts, the render path), the manifest↔art consistency. |
| **Mathias** | Creative director | Individual sign-off on EVERY sprite before it's ingested (no bulk auto-accept). Final veto on feel/look. |

## The end-to-end workflow (per mon / per line)

```
1. CHAT  — pull the locked concept from the manifest (name, type, archetype,
           biome, the concept note) → write the REAL-ANIMAL-ANCHORED sprite
           brief (the creature described via real animals Gemini knows +
           the "NOT this" anti-drift list + front/back/icon spec).
           Aesthetic-check it (grounded/creature-authentic/cool).
        ↓
2. CD    — (optional, per type not per mon) produce the TYPE PALETTE RAMP
           + a structural constraint sheet (header/archetype/"NOT this"
           layout) IF a visual structure helps. NOT the silhouette.
        ↓
3. GEMINI — generate the sprite (front + back + dex icon) from Chat's brief
           + CD's palette. One mon at a time. Style-ref attached.
        ↓
4. MATHIAS — review the candidate. Accept / regenerate. (Per-mon veto.)
        ↓
5. CHAT  — 56px ingest sanity check (does it read at game scale? does it
           match the concept/archetype/silhouette intent?).
        ↓
6. CC    — ingest via sprite_ingest.py (front/back/icon + battle mock),
           wire into the game, confirm manifest↔art consistency.
```

## The key lesson from the L001 pilot (drives the whole method)

**Real-animal anchoring beats both prose concepts AND drawn silhouettes.**
- Prose alone ("armored fortress drake") → Gemini drifted to a BEAR.
- A CD-drawn silhouette → drifted to a HIPPO (vector primitives make generic bulky blobs).
- **The fix:** anchor the brief to **real animals Gemini already knows** ("the low plated build of an ankylosaurus + a crocodile's snout + a molten-basalt hide") + an explicit **"NOT this"** list. Real-animal anchors are far more drift-resistant than abstract concepts or schematic drawings.

So: **Chat's brief carries the anti-drift load (via real-animal anchors), NOT a drawn silhouette.** CD supports with palette/structure only.

## What each agent should NOT do

- **CD** does not draw the final sprite, does not draw the creature silhouette (drifts), does not own the concept.
- **Gemini** does not invent the concept (works from Chat's brief) and does not self-approve (Mathias vetoes each).
- **CC** does not generate art and does not change the concept; it ingests + integrates what's approved.
- **Chat** does not draw pixels; it authors the brief + validates + checks ingest.

## Cross-ref
mon-aesthetic.md (the creature north-star the brief enforces), mon-design-template.md (the per-mon spec the brief draws from), visual-north-star.md (the front/back framing + the art layers), monmanifest.csv (the concept source), the Gemini briefing doc (the real-animal-anchored brief method + governance).
