# Argent — Gemini Sprite Production Briefing & Governance

**For: Gemini (sprite generation).** This is the standing governance for generating creature sprites for *Project Argent* — an original-IP, grounded, GBC-style monster-battler in the spirit of Pokémon Gold/Silver. Read this once as the framework; each mon then comes with its own brief that follows this format.

---

## 1. THE AESTHETIC LAW (every sprite must obey)

**GROUNDED · CREATURE-AUTHENTIC · COOL.**

Every Argent creature reads as a **believable animal or mythic beast** — a real lizard, bird, predator, dragon, or prehistoric thing — **elevated with edge, menace, or elegance.** They could plausibly *exist* (or belong in myth).

**Reference sensibility (the taste anchor — capture the *energy*, do not copy):** Scizor (sleek bladed predator), Lucario (noble martial-beast), Tyranitar (imposing armored kaiju), Salamence (brutal apex dragon), Typhlosion (creature-real mammal), Kabutops (prehistoric bladed predator), Seadra, the Nidoran line. The era: **Gen 1-2 / Sinnoh "real monster" cool.**

**FORBIDDEN (these fail the aesthetic — never generate):**
- **Abstract-object designs** — a creature based on an ice cream, keys, trash, a chandelier. If the core is "an object that's secretly a monster," it's wrong.
- **Overly-cute mascot designs** — cute-as-the-whole-point. (Some charm is fine; mascot-cuteness as the point is not.)
- **"Ran out of ideas" whimsy** — the abstract/joke-concept direction of some recent games.
- **Generic blandness** — no edge, no distinct silhouette.

**The test for every sprite:** *"Would this look at home in Gen 1-2, or as a cool Sinnoh mon? Does it read as a real animal or mythic beast with edge?"* If it feels like a gimmick, an object, or a mascot — it's wrong.

---

## 2. THE ANTI-DRIFT METHOD (the most important rule)

Sprites drift from their concept when the brief is abstract. We learned this the hard way:
- "Armored fortress drake" (prose) → drifted into a **bear.**
- A drawn schematic silhouette → drifted into a **hippo.**

**THE FIX: every brief anchors the creature to REAL ANIMALS you already know, plus an explicit "NOT THIS" list.**

- ✅ "The low, plated build of an **ankylosaurus**, with a **crocodile's** snout and a molten-basalt hide" — real anchors you can render accurately.
- ❌ "A fortress drake" — too abstract, drifts.

**So each mon's brief gives you:**
1. **Real-animal anchors** — 1-3 real creatures whose *specific features* (build, posture, head shape, limbs) define the silhouette.
2. **The elevation** — what makes it a *monster*, not just the animal (the molten hide, the bladed arms, the spectral glow).
3. **A "NOT THIS" list** — the specific wrong directions to avoid (drift traps).

**Obey the "NOT THIS" list strictly.** It exists because those are the exact drifts that have happened or would happen.

---

## 3. THE FORMAT SPEC (GBC-style, game-ready)

- **Style:** Game Boy Color-era sprite art — clean, readable, limited-palette pixel art. The feel of Gen 2 (Gold/Silver/Crystal) creature sprites, elevated.
- **Palette:** limited, per the type's palette ramp (provided per mon / per type). Roughly **4-8 meaningful colors** per sprite (hardware-era discipline) — dark base + the type's accent (e.g. FLAME = dark basalt + glowing magma orange/red).
- **Per mon, generate THREE views:**
  1. **FRONT sprite** — the creature facing the viewer (shown when it's the OPPONENT in battle).
  2. **BACK sprite** — the creature from behind / over-the-shoulder (shown when it's the PLAYER's mon).
  3. **DEX ICON** — a small, simplified version for lists/registry.
- **Silhouette must read at a glance** — the shape alone should identify the creature and its archetype (a "Wall" reads bulky/low; a "Glass nuke" reads sharp/fast).
- **Clean edges, transparent background**, suitable for ingest into the game's 56px battle scale.

---

## 4. THE ARCHETYPE → SHAPE LANGUAGE (silhouette guidance)

Each mon has a combat archetype that shapes its silhouette:
- **Wall** — bulky, low, heavily-armored, immovable mass.
- **Dodger** — sleek, tall, lean, agile.
- **Counter-tank** — rounded, heavy, sturdy.
- **Glass nuke** — sharp, angular, aggressive (often bladed or bird-like).
- **Brawler** — bulky-upright, powerful, limbed for striking.
- **Drainer / Trickster / Pacer** — distinct lean/eerie/graceful forms per the brief.

The brief states the archetype; honor its shape language.

---

## 5. GOVERNANCE (the production rules)

- **One mon at a time.** No bulk generation. Each sprite is reviewed and individually approved before the next.
- **Each generation works from its brief** (concept + real-animal anchors + "NOT this" + archetype + palette). Don't invent beyond the brief.
- **Evolution lines read as one family** — a line's stages should share visual DNA and grow more imposing/elaborate across stages (the silhouette arc).
- **Front + back + icon per mon** (the framing doubles the per-mon count — plan for it).
- **Rejection is normal** — if a generation drifts (wrong silhouette, wrong feel, breaks the "NOT this"), regenerate against the same brief. A bad sprite is worse than a slow one.
- **The human director (Mathias) signs off on every sprite individually.** Nothing ships on auto-accept.

---

## 6. WORKED EXAMPLE — L001, the FLAME starter line

This is the format every mon's brief follows. (This line previously drifted to a bear, then a hippo — so the real-animal anchoring matters here especially.)

**Line:** KINDRAKE → KILNDRAKE → FORTDRAKE (FLAME; stage 3 = FLAME/DRAKE)
**Archetype:** Wall (bulky, low, armored, immovable)
**Concept:** a quadruped armored drake of living molten basalt — a walking fortress.

**REAL-ANIMAL ANCHORS:**
- The **low, broad, heavily-plated build and armored back of an ANKYLOSAURUS** (this is the core silhouette — low, long, ground-hugging, plated).
- A **CROCODILE's** angular, fanged snout and reptilian head (NOT a rounded mammalian face).
- Stocky, powerful **reptilian/draconic limbs** — four legs, low stance.
- (Stage 3) a heavier, more citadel-like version — thicker plates, a fortress profile.

**THE ELEVATION (what makes it a monster):**
- The hide is **dark basalt stone-plate with glowing magma seams** cracking between the plates — coals glowing in the gaps. The "fire" is *molten rock*, not flames.
- Across the line: KINDRAKE (cub — small, ember-veined) → KILNDRAKE (kiln-hot, magma cracking through thickening plate) → FORTDRAKE (a walking citadel of molten basalt, low and immovable).

**NOT THIS (strict — these are the actual drifts to avoid):**
- ❌ **NOT a bear / NOT mammalian** (the first drift — no ursine body, no mammal face).
- ❌ **NOT a hippo / NOT a smooth rounded blob** (the second drift — it must be ANGULAR and PLATED, not smooth ovals).
- ❌ **NOT a fire-bird / NOT Charizard-like** — no wings, not bipedal, not a flying-dragon silhouette.
- ❌ **NOT tall / NOT upright** — it is LOW and LONG (height-to-length roughly 1:1.5 or wider), ground-hugging.

**PROPORTION:** low and long, not tall. Mass and armor. A living fortress on four legs.

**PALETTE (FLAME molten ramp):** dark basalt grays/near-black base + glowing magma orange/red seams + ember-yellow highlights. Limited GBC-style set.

**VIEWS:** front (facing viewer), back (over-the-shoulder), dex icon. 3/4 front-facing angle for the battle sprites.

---

## 7. SOURCE OF EACH MON'S DETAILS

Every mon's concept, type, archetype, and biome come from the Argent manifest (maintained by the design team). Each brief you receive is derived from that canonical source. If a brief seems to contradict the aesthetic law (section 1) or lacks real-animal anchors (section 2), flag it — a good brief always has both.
