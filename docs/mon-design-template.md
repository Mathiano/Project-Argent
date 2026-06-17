# How to Design an Argent Mon — the per-mon template

**Purpose:** a repeatable spec for designing any Argent mon, so the 200-mon roster is *systematic* instead of daunting. Designing a mon = **filling this sheet + passing the pillar checklist.** It extends the manifest's planning fields (line_id, stage, name, bucket, habitat, type, archetype, rarity, evolve_at, note) into the *full design*. Use it per-chapter as the world builds — NOT all 200 at once.

**How to use:** copy the SPEC SHEET per mon (or per evolution line), fill every field, then run the CHECKLIST. If any check fails, revise before the mon is "done." The manifest holds the skeleton; this sheet is what turns a skeleton row into a designed creature.

---

## THE SPEC SHEET (fill one per mon / per evolution line)

### Identity
- **Line ID / Name(s):** [manifest line_id; the name(s) per stage]
- **Stage / Stages-total:** [e.g. 1 of 3]
- **Concept (one line):** [what IS this creature — the locked silhouette idea, e.g. "quadruped armored fortress drake, NOT a fire-bird"]
- **Bucket / Chapter:** [CH1, CH2… / POSTGAME / MT_SILVER]
- **Rarity:** [common / uncommon / rare / starter / legendary]

### Type & combat identity
- **Type(s):** [one or two of the 17 — BASIC/FLAME/AQUA/NATURE/SPARK/FROST/BRAWN/VENOM/TERRA/GALE/PSI/INSECT/STONE/SPIRIT/DRAKE/UMBRA/FORGE]
- **Type identity it expresses:** [the mechanical identity from combat-depth-types-status.md — e.g. FLAME=Burn/hard-hitter, TERRA=Stunned, UMBRA=Doubt, FORGE=bulky-tank. A mon's type should MEAN something mechanically, per its type's identity.]
- **Archetype:** [Wall / Dodger / Counter-tank / Glass nuke / Brawler / Drainer / Trickster / Pacer — the combat ROLE; drives the silhouette shape]
- **Stat SHAPE (not numbers — the tradeoff):** [e.g. "bulky-slow: high HP/DEF, low SPD/ATK" — a SHAPE with a real tradeoff, NEVER raw +stats. Per the no-power-creep pillar: stats are species-static, gentle curve, every strength has a cost.]
- **Signature/notable move(s) or trait:** [e.g. trait GUSTBORNE; a marquee move if any — ties to move-mastery-trials if it has a trial-gated move]

### Character (the "someone" substrate — per mon-character.md)
- **Personality archetype:** [one of: Timid / Bold / Gentle / Proud / Loyal / Wild / Serene / Imperious — Imperious reserved for legendaries. Drives world-reactions × bond.]
- **Preferred / disliked environment:** [emotional affinities — e.g. prefers forests, dislikes deserts. Feeds reactions; distinct from spawn habitat.]
- **Quirk:** [one small unique behavioral tic — the individual touch, e.g. "hums three notes, can't hold a fourth" (PIP)]
- **"Ask your mon" flavor lean:** [how it responds when queried, colored by personality — a line or two of voice]

### World placement
- **Habitat (spawn):** [where it appears — route grass / cave / pond / forest / etc. Drives the encounter table.]
- **Habitat (player-facing dex string, discovery-gated):** [the "where to find" text shown once encountered]
- **Catch path lean (optional):** [does it lean read-path or mercy-path? any special catch flavor]

### Evolution (per evolution-design.md — bond + badge, NOT levels)
- **Evolves to:** [next stage name, or none]
- **Bond gate:** [the bond STAGE required — Wary/Warming/Companions/In Sync/Partners in Kind/Kindred/Inseparable]
- **Progress gate (badge cap):** [which gym/badge caps this evo — or null if post-8-badges / final stage. NEVER gated beyond Gym 8.]
- **Evolution silhouette arc:** [how the shape grows across the line — the "strong silhouette evolution arc" so a line reads as one growing family]

### Art (per visual-north-star.md)
- **Silhouette (reads at a glance):** [the distinctive shape — must be identifiable in silhouette alone; archetype-driven]
- **FRONT sprite:** [the foe-facing sprite — shown when this mon is the OPPONENT]
- **BACK sprite:** [the over-the-shoulder sprite — shown when this mon is the PLAYER's. NOTE: every mon needs BOTH front + back per the battle-framing lean — this doubles the sprite count, plan for it.]
- **Dex icon:** [the small list/registry icon]
- **Animation notes (Phase 7+ art pass):** [later — idle/attack/hit animation intent; static placeholder for now]
- **Color identity:** [its type's flavor color as the base palette anchor]

### Dex entry (per the SCAN + dex schema)
- **Flavor description (dexEntry):** [the prose entry — authored per-chapter; placeholder fine]
- **Role tag (for SCAN):** [the combat role surfaced when scanned — e.g. "Bulwark / Striker / Disruptor"]
- **Status tendencies (for SCAN):** [what it tends to inflict — derived from type identity + movepool]

---

## THE PILLAR CHECKLIST (every mon must pass — revise if any fail)

Run these after filling the sheet. They encode Argent's non-negotiable design pillars. **In addition to these 8 mechanical checks, every mon must pass the AESTHETIC test** — grounded · creature-authentic · cool (real animal / mythic beast with edge, never a gimmick or abstract object). See **`docs/mon-aesthetic.md`** (the creature north-star, with the reference set). A mon must pass the mechanical checklist AND fit the aesthetic.

1. **☐ Distinct type identity** — does the mon's type MEAN something mechanically (per its type's identity), not just a damage color? A FLAME mon should hit hard / Burn; a TERRA mon should Stun; etc. If the type is decorative, it fails.

2. **☐ No power-creep (stat SHAPE, not +stats)** — is the stat line a SHAPE WITH A TRADEOFF (bulky-but-slow, fast-but-fragile), never "just bigger numbers"? A later-chapter mon must not simply out-stat an earlier one. Stats are species-static + gentle-curve. If it wins by being a bigger number, it fails.

3. **☐ Silhouette reads at a glance** — is the mon identifiable from its SHAPE alone (archetype-driven, distinct from its neighbors)? If two mons are confusable in silhouette, it fails.

4. **☐ Bonds-over-strength honored** — does the mon fit the thesis? Its evolution is bond+badge (earned, not grinded); its power comes through partnership (bond unlocks moves/Calls/Resolve), not raw stats. If it's designed as a stat-checker or grind-reward, it fails.

5. **☐ Evolution is bond+badge, capped ≤ Gym 8** — is the evo gated by a bond stage + a badge (whichever second triggers it), with no gate beyond Gym 8? If it uses "levels" or gates past Johto, it fails.

6. **☐ Character is present** — does it have a personality archetype, an affinity, and (ideally) a quirk, so it's a *someone*, not a statline? A legendary should be Imperious, not Timid. If it's characterless, it fails.

7. **☐ Type-chart counter exists** — for any mon a player must BEAT (gym aces especially), is there an accessible counter in the roster (the prep-loop)? Every gym is counter-accessible. If it's an unbeatable wall with no answer, it fails.

8. **☐ Fits its chapter/biome** — does its habitat, rarity, and power level fit where it appears? An early-route common shouldn't be a pseudo-legendary. If it's misplaced in the progression, it fails.

---

## NOTES ON USING THIS WELL

- **Design by LINE, not by mon** — design a whole evolution line together (the silhouette arc, the bond/badge gates across stages) so it reads as one growing family.
- **Per-chapter, not all-at-once** — fill these for a chapter's roster as you build that chapter. The manifest's 200 slots are the plan; this sheet fills them in order.
- **The ecological spread (reference for the full roster):** starters, route birds, early critters, cave mons, volcano/hot-spring mons, forest mons, water/beach mons, rocky-area mons, sky mons, pseudo-legendaries, lesser legendaries, the cover legendary, the stance-beasts. Each chapter draws from this palette; the manifest assigns which.
- **The front+back sprite cost is real** — every mon = 2 sprites (front for when it's the foe, back for when it's yours) + a dex icon. Factor this into the art pipeline's throughput planning (Gemini generates; the framing lean doubles the count).
- **Legendaries are special-cased** — Imperious personality, often single-stage, often a unique fight mechanic (the stance-beasts fight pure-stance; the cover legendary has the moon-phase rhythm). The checklist still applies, but legendaries can bend rarity/stat-shape norms by design.

## Sequencing
- This template is READY NOW (it's process, against the settled schema).
- **First application:** CH1's roster (the mons that exist) designed through it as the proven example — the template's first real use.
- **Then:** per-chapter as the world builds, drawing from the manifest's plan.
- Cross-ref: monmanifest.csv (the skeleton this fills), mon-aesthetic.md (the creature-feel north-star every mon must fit), combat-depth-types-status.md (type identities), mon-character.md (the character substrate), evolution-design.md (bond+badge gates), visual-north-star.md (silhouette + front/back sprites), catching-2-0.md (catch-path lean), bond-track-v2.md (the bond stages the evo gates use).
