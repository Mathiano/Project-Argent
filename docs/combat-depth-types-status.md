# Combat Depth — Type Identities & Status System (DESIGN ONLY, build Phase 6-8)

**Status:** design locked. Build is the **status/held-items combat-depth phase (6-8)**, on engine hooks the move-pool already flagged ("effect moves — status/terrain/drain, blocked on engine hooks"). This doc fills that hole. Everything here is deterministic — **no RNG** — honoring the core pillar (*outcomes come from reads, not luck*). It is additive: until built, mons run on damage moves + stances only.

**Naming: RESOLVED — 17-type canon (2026-06-15).** The type roster is locked to the canonical 17 (Gen-2 parity, Argent names): **BASIC · FLAME · AQUA · NATURE · SPARK · FROST · BRAWN · VENOM · TERRA · GALE · PSI · INSECT · STONE · SPIRIT · DRAKE · UMBRA · FORGE**. `move-pool.md`, `typechart.json`, `ch1-batch.json`, `mon-manifest.csv` and this doc all use exactly these names (the old `FIELD/VOLT/SPLASH/SPROUT` are gone: FIELD→BASIC, VOLT→SPARK, SPLASH→AQUA, SPROUT→NATURE; PSI/INSECT/STONE/UMBRA are the 4 new types). The authoritative 17×17 multiplier grid lives in **typechart.json** — this doc does NOT redefine those numbers; it defines per-type *mechanical identity* on top of them. (The legacy 3-type sim FIXTURES — `Flame/Sprout/Splash`, mixed case, in `src/engine/data.ts` — are a SEPARATE permanent vocabulary and intentionally unchanged; the rival ladder depends on them.) ⚠️ The 4 new types' **move names** and their **type-chart matchup rows/columns** are PROPOSED (Gen-2-mapped) pending Mathias's approval — see `move-pool.md` and `type-chart.md`.

---

## Part 1 — The core principle: status attacks the CONVERSATION, not the body

Classic status is a condition on a body (RNG paralysis, sit-there sleep). Argent's battle is a conversation of reads between two minds, so status here distorts **the read, the rhythm, the triangle, or the bond** — deterministically. This makes status native to Argent's engine and impossible to copy from other games.

---

## Part 2 — The 17 type identities

Each type has a distinct MECHANICAL identity (the canonical 17-type roster — see "Naming" above). Crucially, these are **different categories of mechanic** (DoT, sustain, immunity, tank, disruption) — not 17 flavors of "inflict a status." That variety is what keeps a 200-mon roster from feeling samey and prevents a single dominant meta. **SPIRIT (Ghost) and UMBRA (Dark) are SEPARATE types** — SPIRIT = Shrouded (hide your OWN intent), UMBRA = Doubt (attack the BOND). An earlier draft conflated them; they are distinct.

| Type | Identity | Category |
|---|---|---|
| **BASIC** | Neutral floor kit — no status (the honest baseline every roster needs) | floor |
| **FLAME** | Hard hitters + **Burn** (small HP loss over 2-3 rounds) | damage + DoT |
| **AQUA** | **Recover** — moves that self-heal a little | sustain (defensive) |
| **NATURE** | **Drain** — moves that absorb HP from the foe to the user | sustain (offensive) |
| **SPARK** | Inflicts **Daze** (foe's intent tell becomes unreliable) | disruption (info) |
| **FROST** | Inflicts **Frozen** (foe locked in current stance) | disruption (control) |
| **BRAWN** | Inflicts **Taunt** (force foe Aggressive next turn, 1 turn) + **Daze** | disruption (aggro) |
| **VENOM** | Inflicts **Drained** (bleeds STAMINA each round) | disruption (resource) |
| **TERRA** | Inflicts **Stunned** (via heavy impact — acts last regardless of speed) | disruption (tempo) |
| **GALE** | Glass cannon (fast + fragile); notably **WEAK to TERRA/Ground (×1.3)** — that vulnerability is what gives a GALE gym a clean counter | mobility |
| **PSI** | Inflicts **Inception** (force foe to repeat last stance) | disruption (control) |
| **INSECT** | Inflicts **Sap** (burst STAMINA-drain on a read-win) — *NEW* | disruption (resource) |
| **STONE** | **Brace** (self-buff — strengthens the user's next Guard) — *NEW* | defense (self-buff) |
| **SPIRIT** | **Shrouded** (hide the user's OWN intent — the foe commits blind) | disruption (info) |
| **DRAKE** | Inflicts **Daunt** (foe can't enter Aggressive — cowed by presence) | disruption (prestige) |
| **UMBRA** | Inflicts **Doubt** (attacks the BOND — Calls cost more ★ / hesitate) | disruption (bond) |
| **FORGE** | Defensive archetype — innately bulky (high base HP/DFN, low speed/damage) | tank (stat-shape) |

### The pillar guard on FORGE / GALE (important)
FORGE and GALE express identity through **stat/rule shape**, not a status. This is fine and desirable — but it MUST honor the no-power-creep pillar:
- **FORGE = a species ARCHETYPE tradeoff** (bulky-but-slow-and-weak-hitting), NOT a stat bonus. A FORGE mon is *designed* tanky with a real cost (low speed/damage). It is never "FORGE mons get +stats."
- **GALE = fast-but-fragile**, and **notably WEAK to TERRA/Ground (×1.3)** — a rule of the chart, not a stat. Glass cannon with a movement advantage, whose Ground vulnerability is the *designed* counter to a GALE gym (the Falkner prep-loop: catch a TERRA cave mon → it hits Falkner's GALE mons ×1.3). GALE is **not** resistant or immune to Ground; the no-immunities ruling (2026-06-15) holds trivially here (1.3 is the opposite of an immunity).
Both are *shapes with tradeoffs*, so they can't out-stat anyone — they trade one axis for another.

### The category meta (why no single type dominates)
Tanks (FORGE) outlast hitters (FLAME); disruptors (the status types) break tanks; hitters race disruptors before status lands; sustain (NATURE/AQUA) grinds attrition. It's rock-paper-scissors at the *category* level, on top of the type-multiplier triangle — a living meta, not a solved one.

---

## Part 3 — The status conditions (full list)

All deterministic. Each has a TYPE trigger, an effect, and sits in the economy (Part 4).

### Information layer (attack the read)
- **Daze** (SPARK / BRAWN) — the afflicted mon's intent tell becomes *unreliable* (scrambled/lying). Replaces classic paralysis. You can't trust what you see.
- **Shrouded** (SPIRIT — the Ghost type's signature self-buff) — hides the USER's own intent from the foe; the foe commits blind. (The defensive/trickster buff; renamed from "Blindside/Masked". SPIRIT owns Shrouded; UMBRA is the separate bond-attacker, Doubt.)
- **Brace** (STONE — *NEW*, self-buff) — strengthens the user's **next Guard** (a bigger counter / more mitigation on the following round). The Rock type's defensive set-up: telegraph a wall, punish the read.

### Control layer (attack the stance choice)
- **Inception** (PSI) — forces the afflicted mon to *repeat its last stance* for the duration. "Enter their mind." Makes them predictable → exploitable. Renamed from "Mirror".
- **Frozen** (FROST) — the afflicted mon is *locked in its current stance*, can't switch. Predictable, exploitable. (Replaces classic freeze — exploitable, not helpless.)
- **Daunt** (DRAKE) — the afflicted mon *cannot enter Aggressive* for the duration (cowed by the dragon's presence). Defensive lockout.
- **Taunt** (BRAWN) — forces the afflicted mon into **Aggressive for the NEXT TURN ONLY** (1 turn). This is read-MANIPULATION: you now know they're Aggressive → Guard → Counter them. Powerful but self-limiting at 1 turn.

### Tempo layer (attack rhythm/resource)
- **Drained** (VENOM) — bleeds **stamina** each round (not HP — "Pokémon and blood don't match"). Pressures the stamina economy → forces rest. Replaces classic poison.
- **Sap** (INSECT — *NEW*) — a **burst** stamina-drain landed on a read-win (a one-shot chunk, vs VENOM's per-round bleed). The Bug type's tempo-spike: out-read them and they're suddenly winded.
- **Stunned** (TERRA / heavy impact) — the afflicted mon *acts last regardless of speed* for the duration. Loses initiative, eats openings. (Triggered by heavy-impact moves.)
- **Overheat** (mechanic, not a type) — using the *same move 3 times in a row* causes escalating extra stamina cost on that mon. A self-inflicted anti-repetition tax. Encourages varied play.

### DoT / sustain (HP economy)
- **Burn** (FLAME) — small HP loss over 2-3 rounds. The one straightforward DoT (FLAME is the hard-hitter, this is its bonus bite).
- **Drain** (NATURE, offensive sustain) — a MOVE property: damages the foe AND heals the user a fraction.
- **Recover** (AQUA, defensive sustain) — a MOVE property: the user self-heals a little.

### Bond layer (UNIQUE TO ARGENT — attack/defend the relationship)
- **Doubt** (UMBRA) — strains the bond: the afflicted mon's Calls cost more ★, and/or it hesitates (reduced effect) until "reached." The foe attacks your PARTNERSHIP. No other monster game has a status that attacks the trainer-mon relationship — this is the most on-thesis mechanic in the game.
- **Resolve** (the positive counter — see Part 4) — the bond-powered status DEFENSE.

---

## Part 4 — The status ECONOMY (the critical design — prevents spam, enables counterplay)

Without this, status-spam = free win. Three levers, all Argent-native:

### Lever 1 — Application cost (can't spam)
- Status moves cost **significant stamina**, AND most land only **through a read-win** (like a catch window — you must out-read the foe to apply status). Application is itself a skill check, not a mash button. Spamming Inception drains your own stamina and only works when you win the read.

### Lever 2 — Duration + diminishing returns (re-applying fades)
- **Short base duration: 2-3 rounds** (Taunt = 1). Status is a *window of advantage*, never a permanent state.
- **Diminishing returns on re-application**: the SAME status on the SAME mon lasts shorter each time (e.g. 3 → 2 → 1 → resists). You cannot lock a foe in Inception/Frozen forever. This is the core anti-spam mechanism.

### Lever 3 — Counterplay (how you break out / defend)
- **Stance-break**: certain reads/stances *clear* a status (e.g. winning a Counter shakes Drained; a stamina-costing stance-switch breaks Frozen). You play OUT through the triangle — not wait out a dice roll.
- **Resolve** (the bond-gated answer): an active **Call** (spend ★) that **clears a status + grants brief immunity**. Gated by bond: **unlocks at bond Stage 4, strengthens at Stage 6-7**. Weaker-bond mons must *eat* the status for its duration. → **the bond IS the status-defense.** Thematically perfect: the foe attacks the partnership (Doubt), and the partnership breaks free (Resolve).
- **Cleansing items**: minor antidote-equivalents, but **out of battle only** (consistent with the "items heal in overworld, Calls heal in battle" ruling).

### Bond baseline Calls (new, locked)
A strongly-bonded mon **starts each battle with 1-2 ★ banked** (scaling with bond stage) — so it can Resolve or Call from turn one. The relationship pays off immediately. (Extends the bond-track Call economy.)

---

## Part 4B — Status DISPLAY (the legibility layer) — LOCKED

Status only teaches if the player can *read* it. Display is **dual-layer, exactly like stances**: a terse machine-readable **TAG** on the mon's status bar for at-a-glance state, plus the **full plain-language sentence in the battle log** for the teaching loop. The tag is the glanceable reminder; the log sentence is where the player *learns* what it means (same pattern as the stance-resolution lines).

### The two layers
- **Bar TAG** — a small 3-letter box on the afflicted mon's status bar. Glanceable, persistent while the status lingers.
- **Battle-log sentence** — full plain-language on application (and on notable ticks/expiry): *"GRUBLEAF is doubtful!"* · *"KINDRAKE is frozen — locked in stance!"* · *"FLITPECK is drained — its stamina is bleeding!"* Same teaching-loop voice as stance resolutions.

### Lingering-only rule (what gets a tag)
**Only LINGERING statuses get a bar tag.** INSTANT effects (NATURE **Drain**, AQUA **Recover** — they resolve the moment the move lands) **just narrate in the log** — no persistent tag, because there's no ongoing state to remind the player of. A tag means "this condition is still on me."

### The tags + colors
Color reads **BOTH valence AND source**: negatives take their **inflicting type's flavor color** (so the bar hints *what hit you*); positives are **GREEN** (so green always = good for me). Two signals in one swatch.

| Status | Tag | Valence | Bar color (source) |
|---|---|---|---|
| Burn (FLAME) | **BRN** | negative | fire-red |
| Frozen (FROST) | **FRZ** | negative | ice-blue |
| Daze (SPARK/BRAWN) | **DAZ** | negative | electric-yellow |
| Drained — stamina bleed (VENOM) | **DRN** | negative | venom green/purple |
| Stunned (TERRA) | **STN** | negative | earth-brown |
| Inception (PSI) | **INC** | negative | psychic-magenta |
| Sap (INSECT) | **SAP** | negative | bug-olive |
| Daunt (DRAKE) | **DNT** | negative | drake-violet |
| Doubt (UMBRA) | **DBT** | negative | shadow-purple |
| Taunt (BRAWN) | **TNT** | negative | fighting-orange |
| Overheat (mechanic) | **OVR** | negative (self-tax) | hot-orange |
| Brace (STONE) | **BRC** | **positive** | GREEN |
| Shrouded (SPIRIT) | **SHR** | **positive** | GREEN |
| Resolve (bond) | **RSV** | **positive** | GREEN |

### Rules
- **Small boxes**: tag boxes are sized so **3 stack on a status bar without overflow**.
- **The negative CAP = 3.** A mon carries at most **3 negative statuses** at once; applying a 4th **drops the oldest**. This bounds the worst case and keeps the bar legible.
- **Positives are tracked SEPARATELY** (Brace / Shrouded / Resolve) and **do NOT count toward the negative cap** — a mon can carry its own positive buff *and* up to 3 negatives.
- **Stacking 3 stays RARE/earned.** The status economy (Part 4) gates it: each application is a read-win + significant stamina + diminishing returns. Three-at-once is a hard-won blowout, not a baseline — the cap is a ceiling the economy rarely lets you reach.
- **Log sentences are full plain-language** (Part 3's effects, voiced for a player): the tag is the shorthand, the sentence is the lesson. Never show a tag without having taught it in the log first.

---

## Part 5 — The two near-term combat issues this raises (separate from the status build)

### Issue A — Intent reliability ramp NOT enforced (load-bearing)
**Problem (found in playtest):** intent is fully honest *everywhere*, including on Falkner — so optimal play is "read tell → pick hard counter → always win," collapsing the triangle into a solved puzzle. Mathias confirmed he could perfectly counter Falkner.
**Fix (enforce the existing intent-tells ramp):** early wild mons = honest tells (easy is fine, tutorial fodder); **trainers/gym leaders = AMBIGUOUS tells** (read probabilities, not certainties); late bosses/Champion = opaque/lying; and **Daze** makes intent actively untrustworthy. Against anything that matters, you CAN'T reliably see what to counter — which is the whole difficulty curve.
**Ruling:** enforce SOON (near-term), not deferred — it's load-bearing for combat staying fun over 42 hours. (Per intent-tells-design-note.md — this is enforcing what's already designed.)

### Issue B — Time-to-kill too short for depth
**Problem (found in playtest):** a type-advantaged fight can end in ~3 turns — before status/Calls/comebacks have room to matter. The tactical layer needs *time to breathe*.
**Fix:** a dedicated **TTK tuning pass** — sim-test modestly bigger HP pools + moderate damage so meaningful fights last ~5-8 exchanges. The 1.3×/0.7× type multiplier (already gentle vs classic 2×) helps. This is sim-and-playtest tuned, NOT a guess, and interacts with the whole damage formula. Its own focused sprint.

---

## Part 6 — Type matchups (advantages/weaknesses)

**Source of truth: `typechart.json` (the locked 13×13).** This doc does NOT override it. Design constraints the chart already satisfies (for reference):
- **Starter triangle:** FLAME > NATURE > AQUA > FLAME.
- **DRAKE neutral** to NATURE and AQUA (both directions).
- Multipliers **1.3× (advantage) / 0.7× (disadvantage)**, band fixed (gentler than classic 2×/0.5× — this is part of why TTK and "no stat-check" hold).
- Every gym is **counter-accessible** (a catchable answer exists — e.g. TERRA/GRITHOAX answers Falkner's GALE).
- Classic-intuitive anchors preserved where they make sense: AQUA > FLAME, FLAME > NATURE, NATURE > AQUA, TERRA > SPARK, GALE immune to TERRA (the identity above), etc.

**Action for the build:** when status lands, ensure each type's *status* and its *multiplier* matchups together don't create an unbeatable combo (e.g. a type that both resists you AND status-locks you). Sim-gate the type×status cross-product the way the bond cross-product is gated (≤ the agreed ladder shift). Every type must have both clear advantages AND clear weaknesses — no type is all-upside.

---

## Part 7 — In-battle Dex lookup (SCAN the foe) — LOCKED (build later, schema reserved now)

A battle-menu option to **SCAN** the current foe surfaces its dex entry **mid-fight** — turning the Dex from a passive journal into a live combat tool. Crucially, **what SCAN reveals is GATED BY YOUR DEX KNOWLEDGE of that species**:

| Your dex status | SCAN reveals |
|---|---|
| **CAUGHT** | **FULL scan** — type(s), combat **ROLE** (tanky / striker / disruptor), and **STATUS TENDENCIES** (what it tends to inflict). |
| **SEEN, not caught** | **PARTIAL** — type only (or *"combat style unknown"*). |
| **NEW / unseen** | **Little-to-nothing** — *"No data — never encountered."* |

### Why this is on-thesis
- **Catching literally improves your combat knowledge** — knowledge = power. Catching a species isn't just collection; it *unlocks intel* you can read mid-fight forever after. A concrete, mechanical reason to catch.
- **First encounters stay scary.** You can't scan the unknown — a brand-new foe is a genuine question mark, exactly as it should feel.
- **It pairs with the intent ramp into a two-tier info game:** **dex = what the SPECIES tends to do** (its role + status tendencies, learned by catching); **intent = what THIS individual is about to do** (its tell, reliability-ramped per Part 5 Issue A). Species-knowledge and individual-read are two different axes of information — SCAN feeds the first, the intent system the second.

### Schema impact — these dex fields become LOAD-BEARING (reserve now, populate later)
SCAN makes four dex fields *mechanically* meaningful (not just flavor), so the **schema slots are RESERVED NOW** to avoid retrofitting ~200 mons later. Population happens later (statusTendencies depends on the status system existing; habitat/description fill in per-chapter as the world is built):
- **`role`** — combat archetype tag (tanky / striker / disruptor), tied to the type identities (Part 2). The FULL-scan headline.
- **`statusTendencies`** — which statuses this species tends to inflict; **derivable later** from its type identity + movepool, but reserved as an explicit field so SCAN reads one place.
- **`habitat`** — location / where-to-find. **DISPLAY GATED BY DISCOVERY** — only shown for species the player has encountered (you don't get a free atlas of unmet mons). Populated as routes are built. *(Distinct from the existing generation-side `habitatTags`; `habitat` is the player-facing, discovery-gated display string.)*
- **`description`** — flavor prose. **Already served by the existing `dexEntry` field** — no new slot needed; authored per-chapter, placeholder until then. (Listed here so the four-field set is explicit; `dexEntry` IS the description.)

**Build dependency:** SCAN's FULL tier depends on the status system (for `statusTendencies`) → build alongside / after the status phase. The TYPE and SEEN/UNSEEN gating tiers could ship earlier (they need only type + dex status, both of which exist today) — a possible early sliver if desired.

---

## Build scope (Phase 6-8)

**Core:**
- The status state system (apply/tick/expire, diminishing returns, the read-win application gate, stamina costs).
- The 13 type identities (Burn/Drain/Recover/immunity/tank-shape + the disruption statuses).
- Resolve as a bond-gated Call; Doubt as UMBRA's signature; bond-baseline-★.
- Effect moves (the 2-per-type the move pool budgeted) authored with their status.
- **Status DISPLAY (Part 4B):** the dual-layer bar TAG + battle-log sentence; lingering-only tagging; 3-negative cap with positives tracked separately; thematic tag colors.
- Sim-gate the type×status cross-product.
- **In-battle SCAN (Part 7):** the dex-knowledge-gated foe lookup. FULL tier depends on `statusTendencies` (so build with/after status); the type-only / unseen tiers could ship earlier. **Schema slots (`role`, `statusTendencies`, `habitat`) reserved now** in `src/engine/dexLoader.ts` so content isn't retrofitted.

**Separate near-term sprints (Part 5):** intent-ramp enforcement; TTK tuning.

**Deferred:** held items (their own system); terrain/weather field-state (Phase 8, ties to arenas); the full Hard/Champion intent tiers (Phase 8).

## Sequencing
- **Design: locked now** (this doc).
- **Build: Phase 6-8 combat-depth phase**, on the effect-move engine hooks the move pool flagged.
- **Near-term, separately:** intent-ramp enforcement (Issue A) + TTK tuning (Issue B) — both load-bearing for combat feel now, both their own focused sprints.
- Until built: damage + stances only (the current, working combat).

---

## DESIGN RADAR — Foe AI competence (assess later, do NOT build now)

**Why this is first-class:** in a read-war, the **AI *is* the difficulty** — not stats. So there must be an **AI-COMPETENCE RAMP that scales WITH the intent-reliability ramp**: wild = simple play + honest intent; gym leaders = sharper + ambiguous intent; Champion/Red = masterful + opaque intent. **The two ramps together define the difficulty curve** (one hides info, the other uses it well). A dumb AI with hidden intent is just noise; a smart AI with honest intent is solvable — the curve needs both rising in lockstep.

**Questions it must answer (capture now, answer later):**
- **Stance reading** — does the foe read + counter the player's *patterns* (not just react)? At which tiers does pattern-reading switch on, and how deep (last move? rolling history? stamina-state-conditioned)?
- **STATUS intelligence** — does it apply status *smartly* (Inception vs a predictable player, Drained vs a stamina-stressed one, Daunt to shut down an aggressive player) or randomly? **Smart status use is where bosses feel cunning** — it's the difference between "the boss has status moves" and "the boss read me."
- **Call timing** — once foe trainers can Call: *when* do they Resolve / Distract / heal? (Reactive panic-heal reads as dumb; a Call that pre-empts the player's plan reads as masterful.)
- **Resource / stamina play** — does it bait the player into wasting stamina or committing bad reads (e.g. feign an opening, punish the over-commit)?
- **Per-tier definition** — gym-leader vs E4 vs Champion vs Red, defined in **BEHAVIOR terms** (what each tier does/doesn't do), mapped to the **read-rate ramp** in `content-progression-scope.md`.
- **★ THE FAIRNESS LINE (load-bearing):** a read-war AI must **NEVER see the player's committed move before choosing its own.** It reads patterns/tells/stamina like the player does — symmetric information. The moment it peeks at the committed action it stops being a fair read and becomes **the computer cheating**. It must feel like it **OUT-READ you, not PEEKED.** (The current engine already commits the foe action *before* the player chooses — so this line is honored today; any future "smarter" AI must preserve it. The boss card / archetype must derive its choice only from pre-commit state.)

**Assess when:** (a) status exists for the AI to use, AND (b) foe trainers can Call — **both later.** This is a radar note, not a task.

**Cross-refs:** `content-progression-scope.md` (the read-rate ramp this AI ramp parallels), `intent-tells-design-note.md` (the info-hiding ramp the competence ramp scales alongside), `sim-archetypes.md` (where the bot/archetype behaviors live), Part 4's Resolve/Doubt + the bond Call economy (what the AI gets to use).
