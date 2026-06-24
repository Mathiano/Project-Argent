# Project Argent — Trainer Archetype Catalog (the profile library)

**Status:** the catalog CORE — the reusable library of trainer profiles every area stamps from. Built on the 7-dimension schema (full defs in `trainer-combat-profiles.md`) plus the release-variability knob added at kickoff. Authoring model: define profiles ONCE here, stamp them onto classic-Pokémon classes per area, instantiate with local mons. Cross-ref `trainer-combat-profiles.md` (dimension defs + IF-THEN tree), `world-scope-skeleton.md` (which areas), `monmanifest.csv` (mons/biomes), `combat-focus-redesign.md` (the focus model), `design-journal-session-combat.md` (D8/D10/D12, the calls).

---

## Operating rules (the six kickoff calls, encoded)

1. **Release variability is a profile knob.** OFF (fixed-Heavy) for the teaching floor (JAY, Falkner); ON (mixes Feint, which beats Aggressive) from Gym 2 up. Makes D8's 50/50 real and bounds the masher. "Punish the wind-up" = open at the floor by design, bounded from Gym 2.
2. **Info legibility is one unified level** (open → veiled → opaque), ramping with badges, setting BOTH the stance-tell and the focus-tell. Per-axis override reserved for bespoke elites (the Bluffer).
3. **Profile-first, overlay-only.** Everything is data (the 8 knobs) unless it needs a mechanic the knobs can't express — then a thin bespoke overlay sits on top (Falkner = Duelist profile + rhythm-gust overlay). Target: ~90% of trainers are pure data.
4. **Focusers are stamina-aware** (engine): they bank stamina (catch-breath) to set up a signature, so a Charger reliably expresses. Distinct from the banked gust-stamina-*tax* (a Layer-3 environment mechanic).
5. **One canonical sim yardstick.** Every profile is gated "fair-but-distinct" against one named shared reading-bot (see CC handoff).
6. **Two tiers, two roster modes** (below).

**The 8 knobs each profile fills:** Stance · Two-step · Release(var) · Bond→Calls · Call-use · Info · Terrain · Adaptivity. (Release applies only to two-stepping profiles.)

**Two roster modes:** *area-locked* (default — fields the local biome pool) · *flexible* (the exceptions — Concord + city people field any mons, cross-area).

**Two tiers:** *standard* (templated, readable, sprite-as-tell) · *elite* (bespoke-leaning, hard regardless of look — the exception to read-the-sprite is what makes elites feel elite).

---

## STANDARD profiles — the floor (pre-gym → early)

One per stance. Single-only, low-bond, open, fixed, area-locked. These teach the base triangle.

**GREENHORN** — *floor*
- Classes: Youngster, Lass, Schoolkid, early Bug Catcher
- Look → tell: bright, bouncy, unguarded → "rookie, no tricks"
- Profile: Balanced · Single-only · Release n/a · Low-bond (no Calls) · Call: never · **Open** · Terrain — · Fixed
- Mons: 1 low-stage local common
- The read: pure base-triangle practice. Commit Charges freely — can't Get Away.

**BRUISER** — *floor*
- Classes: Camper, Tough, young Biker, light Hiker
- Look → tell: hunched, fists up, scuffed → "comes straight at you"
- Profile: **Aggressor** · Single-only · Release n/a · Low-bond · Call: never · Open · Terrain — · Fixed
- Mons: a local Brawler / Glass-nuke
- The read: leans Aggressive — bait the commit with Guard/Brace. Low-bond = locked in; counter hard, he can't escape.

**TURTLE** — *floor*
- Classes: Hiker, Picnicker, early Gentleman
- Look → tell: planted, heavy pack, calm → "won't budge"
- Profile: **Bulwark** · Single-only · Release n/a · Low-bond · Call: never · Open · Terrain (rocky) · Fixed
- Mons: a local Wall / Counter-tank
- The read: Guard-heavy — slip past with Fluid; don't throw Aggressive into the Brace.

**SKIRMISHER** — *floor*
- Classes: Fisherman, Sailor, Bird Keeper
- Look → tell: light, restless, leaning to move → "quick, hard to pin"
- Profile: **Evader** · Single-only · Release n/a · Low-bond · Call: never · Open · Terrain (water/open) · Fixed
- Mons: a local Dodger / Pacer
- The read: Fluid-initiative first-strikes — catch it with Aggressive. Low-bond means it can't punish you back.

---

## STANDARD profiles — the mid tier (Gyms 2–4)

Occasional/signature two-steps, **variable release ON**, mid-bond Calls, first veiled info, terrain begins to matter. This is where the read starts to bite.

**CHARGER** — *mid* — **the variable-release pivot (call #1)**
- Classes: Biker, Black Belt, Ace-ish
- Look → tell: braced wind-up posture, heavy gear → "winding up something big"
- Profile: Aggressor · Signature Charge (Heavy-lean) · **Variable (mixes Feint)** · Mid-bond · Call: Clutch · Open→Veiled · Terrain (open/frozen rewards it) · Fixed
- Mons: a Glass-nuke or Brawler ace
- The read: respect the wind-up — but don't blind-mash; the Feint catches mashers. The Charge pierces Guard. Bait his one Call or race it.

**TRICKSTER** — *mid*
- Classes: Psychic, Juggler, Beauty
- Look → tell: loose, feinting, watching you → "wants you to flinch"
- Profile: Evader · Signature Feint (Feint-lean) · Variable · Mid-bond · Call: Liberal · Veiled · Terrain — · Reactive-lite
- Mons: a Trickster / Drainer
- The read: don't take the bait — just attack; a Feint loses to a committed hit. He Calls freely, so bait him dry then commit.

**AMBUSHER** — *mid* — **terrain-keyed (Layer 3 hook)**
- Classes: Hunter, forest Camper, stalker types
- Look → tell: low, using cover, hard to spot → "strikes from nowhere"
- Profile: Balanced/Evader · Signature Hide (Hide-lean) · Variable · Mid-bond · Call: Clutch · Veiled · **Terrain-dependent (forest/shadow)** · Reactive-lite
- Mons: SPIRIT / TERRA Trickster types
- The read: Hide beats Fluid — don't dance; Feint punishes the Hide. Strongest on home terrain — fight him in the open and he's declawed.

**STONEWALL** — *mid*
- Classes: veteran Hiker, defensive-gym chaff
- Look → tell: immovable, armored, patient → "you'll break before he does"
- Profile: Bulwark · Occasional (Brace-Charge) · Variable · High-bond · Call: Defensive · Veiled · Terrain (rocky) · Fixed
- Mons: Wall / Forge types
- The read: attrition war — commit through the Guard (Charge pierces), but he Braces + Calls to survive. Out-patience him or out-commit him.

**DRIFTER** — *mid → elite bridge* — **first Reactive generalist**
- Classes: Ace Trainer, Cooltrainer
- Look → tell: composed, neutral, reading you → "no easy tell"
- Profile: Balanced · Occasional (mixed) · Variable · Mid/High-bond · Call: Clutch · Veiled · Terrain-aware · **Reactive**
- Mons: a balanced 2-stage line
- The read: he adapts to your pattern — vary your play. The genuine no-tell fight; the step right before elites.

---

## ELITE profiles (bespoke-leaning)

Hard regardless of look. Per-axis info override allowed (call #2/#3). Gym leaders, Elite Four, Champion, Concord, Rival.

**DUELIST** — *elite — the gym-leader base*
- Stamps: every gym leader, + a thin signature overlay
- Profile: strong stance (type-keyed) · Occasional→Frequent signature · Variable · High-bond (full Calls) · Call: Clutch · Veiled · **terrain-mastery** · Reactive
- Roster: type/area-locked (their gym type)
- The read: a real test — reads you, escapes your commits, masters home terrain. The per-leader thing to learn is the signature overlay.
- **Falkner = DUELIST(Evader/Gale) + fixed-Heavy rhythm-gust overlay, floor-tuned** — his fixed release is the deliberate Gym-1 exception (call #1).

**WARDEN** — *elite — the Elite Four base*
- Stamps: Elite Four members, + bespoke signatures
- Profile: mastery stance · Frequent two-steps · Variable · High-bond full Calls · Call: Clutch · **Hidden-momentum** · deep terrain · Reactive
- The read: mastery test — full toolkit, and you can't see whether he can Call (bluff tension on every commit).

**BLUFFER** — *elite — the Concord enforcer*
- Stamps: Concord antagonists/enforcers
- Profile: Aggressor · Frequent · Variable · **Manufactured bond (pseudo-Calls, NO true ceiling-breaker)** · Call: Liberal-fake · **Bluffer info (fakes tells — per-axis override)** · Reactive
- Roster: **flexible — cross-area manufactured mons, any type; strong-but-brittle**
- The read: powerful, unreadable, escalates hard — but cannot pull the desperate bond-comeback. Out-last the brittleness with YOUR ceiling-breaker. The thesis made mechanical.

**CHAMPION** — *elite — the apex (bespoke, 1 instance)*
- Profile: Balanced-mastery (no exploitable lean) · full two-step fluency · Variable · max-bond full Calls **+ Resolve ceiling-breaker** · full info denial · deeply Reactive
- The read: the summit — the hardest FAIR fight; the anime-Championships bond-thesis capstone.

**RIVAL** — *elite — recurring (special case)*
- Profile: **escalates with the player** — Greenhorn-ish early → Duelist-ish late, across encounters · High-bond · Reactive · his own ace line
- Roster: flexible (his evolving team)
- The read: grows alongside you — every rematch harder; his bond vs yours, the thematic mirror to the player's arc.

---

## Class → profile quick-index (authoring shortcut)

| Class | Default profile(s) | Roster |
|---|---|---|
| Youngster / Lass / Schoolkid | GREENHORN | area-locked |
| Bug Catcher | GREENHORN → BRUISER (later routes) | area-locked |
| Camper / Tough | BRUISER; forest Camper → AMBUSHER | area-locked |
| Hiker / Picnicker | TURTLE → STONEWALL (veteran) | area-locked |
| Fisherman / Sailor / Bird Keeper | SKIRMISHER | area-locked |
| Biker / Black Belt | CHARGER | area-locked |
| Psychic / Juggler / Beauty | TRICKSTER | area-locked |
| Hunter / stalker | AMBUSHER | area-locked |
| Ace Trainer / Cooltrainer | DRIFTER | area-locked |
| Gym Leader | DUELIST (+ overlay) | type-locked |
| Elite Four | WARDEN (+ overlay) | flexible |
| Champion | CHAMPION (bespoke) | flexible |
| Concord | BLUFFER | flexible |
| Rival | RIVAL | flexible |
| City folk | any standard profile | flexible |

The look telegraphs the profile (sprite-as-tell) for every STANDARD entry; elites deliberately break that (the unreadable sprite is the point).

---

## CC handoff (engine / infra, gated by the six calls) — ✅ BUILT 2026-06-20

KICKOFF-trainer-archetype-engine.md. Engine/infra only; no shipped trainer data
beyond the migrated CH1 floor; wild AI bit-identical; Falkner's gust untouched.

- ✅ **Release-variability param** — `TrainerProfile.release: 'fixed-Heavy' | {feintRate, signature?}` (`src/engine/trainerAI.ts`), honored in the R2 `pickRelease`. The focus TELL narrows to the lens containing EVERY possible release (a {heavy,feint} variable set → "to attack", truthful + a real 50/50, consistent across phases).
- ✅ **Stamina-aware focusers** — the tree banks stamina (Catch Breath, self-gated on ≥1 ★ since the engine doesn't validate foe actions) when a two-stepper is winded, so the signature charge fires reliably.
- ✅ **Generic-tree absorption** — `TrainerProfile` declares all 8 knobs as data; the tree implements the LIVE ones (stance, two-step, release, info, stamina-aware) and hooks the rest (bond→Calls, call-use, terrain, adaptivity — behavior in later stages). Falkner stays a bespoke overlay (`bossAI.ts`).
- ✅ **Unified info level** — `TrainerProfile.infoLevel: open|veiled|opaque` drives BOTH tells (mapped at wiring: `infoLevelToReliability` for stance, the level itself for focus). `infoOverride` is the reserved per-axis Bluffer hook ('vague' → 'veiled').
- ✅ **Canonical sim yardstick** — the `reader` bot (`src/sim/archetypes.ts`, documented in `sim-archetypes.md`); every profile gates fair-but-distinct against it (`src/sim/trainerProfiles.ts`).

---

## What stamps from this next

1. **CH1 trainer sets** (detailed) — Route 31 + Violet, stamping the floor profiles + Falkner onto CH1 classes with the CH1 mon pool (L008 / L023 / L027 + the gym ace). *Next build.*
2. **Gyms 2–8 area sets** (sketched placeholders) — as each region's biome + classes are decided (per `world-scope-skeleton.md`).
3. **Bespoke overlays** — per gym leader / E4 / Champion / Concord signature, authored as those fights are built.
