# Trainer Combat-Profile Masterfile (Combat Layer 4 — DESIGN)

**Status:** design for the trainer-AI variety system — "the same combat system, opponents who think differently" (the biggest depth-per-effort in combat-enrichment-roadmap.md, Layer 4). This is the structured catalog that makes battling feel WORTH it: every trainer is a distinct READ. Build incrementally (start with a few profiles, expand per chapter). Cross-ref combat-enrichment-roadmap (all layers), bond-track-v2 (Calls gate on bond), the-concord (manufactured-loyalty trainers), living-world (terrain).

## The core idea
Today the AI archetypes only single-step (never commit two-steps), so every trainer fights the same. A trainer COMBAT PROFILE makes each opponent a distinct personality: how they use the base triangle, whether/how they two-step, whether they can Call (gated by THEIR bond with THEIR mon), what information they hide, and how their home terrain biases all of it. A specific trainer is a POINT in this dimension-space + terrain.

---

## THE PROFILE DIMENSIONS (a trainer = a value on each)

### 1. Stance tendency (base-triangle preference)
How they weight the three base stances when not two-stepping:
- **Aggressor** — favors Aggressive (punishes passivity; you bait their commitment).
- **Bulwark** — favors Guard (counters aggression; you slip with Fluid).
- **Evader** — favors Fluid (initiative/first-strike; you catch with Aggressive).
- **Balanced** — even mix (a genuine read, no easy tell).

### 2. Two-step tendency
- **Single-only** — never two-steps (early-game trainers; readable, the base game). *This is the current AI default.*
- **Occasional** — two-steps situationally (the strong play — like the sim's "Adaptive").
- **Frequent** — escalates often (exploitable if you read the phase-1 windows).
- **Signature two-step** — leans on ONE: a "Charger" (Charge-heavy, pierces Guard — punish by reading the wind-up), a "Trickster" (Feint-heavy — punish by just attacking, don't take the bait), an "Ambusher" (Hide-heavy — punish with Feint).

### 3. Bond level (THE layer — gates their Call access)
A trainer's bond WITH THEIR OWN mon gates their Call toolkit — the SAME bonds-over-strength rule that governs the player:
- **Low-bond / no-bond** — CANNOT Call (or only the most basic). Their mon fights without the partnership escape-hatches. Mechanically: you can commit a Charge and they CAN'T GET AWAY — they're locked in. (Makes low-bond trainers feel mechanically *limited*, on-thesis.)
- **Mid-bond** — basic Calls (e.g. Recover Breath / a defensive Call).
- **High-bond** — full Call toolkit (Get Away, Hang In There, the works) — a genuinely hard fight; they escape your commitments.
- **THE CONCORD (special)** — *manufactured* loyalty: their mons are STRONG-BUT-BRITTLE (per the-concord). They may have augmentation-granted pseudo-Calls but CANNOT exceed their programming — no true bond-ceiling-breakers (no Resolve-equivalent). So a Concord mon is powerful but can't pull off the desperate, bond-driven comeback a truly-bonded mon can. (This is the climax demonstration: your bond beats their augmentation.)

### 4. Call behavior (GIVEN they can Call — how they use it)
- **Clutch** — saves Calls for emergencies (escaping your Charge at low HP) — efficient, hard to bait.
- **Liberal** — Calls often (spends ★ freely — you can bait them dry, then commit).
- **Defensive** — mostly Get Away / Hang In There (survival).
- **Never** (low-bond) — N/A.

### 5. Information discipline (Layer 3.5 — what they HIDE)
- **Open** — shows intent + (their own) momentum (early-game; teaches the read).
- **Veiled intent** — their intent-tell is vague/absent (you read patterns, not readouts) — post-gym-1+.
- **Hidden momentum** — you don't know if they can Call (bluff tension) — note: the PLAYER never sees foe momentum by default (Layer 3.5), but a "tell" trainer might LEAK it; a disciplined one never does.
- **Bluffer** — actively fakes (telegraphs a Charge they won't throw; feigns low resources) — elite/Concord.

### 6. Terrain affinity (Layer 3 — home-turf bias)
A trainer on their home terrain PLAYS TO IT — and you can anticipate this:
- Maps to the environment tilts (frozen → avoids Brace, favors Aggressive; fog → favors Evader/Hide; forest → Fluid/Ambush; rocky → Guard; etc.).
- The PROFILE should bias toward what their terrain rewards (a frozen-gym leader is an Aggressor *because* bracing is bad on ice — and the player can read that going in).
- Off their home terrain (rematch elsewhere), they're less optimized — a subtle reward for fighting them away from home.

### 7. Adaptivity
- **Fixed** — plays its profile regardless of the player (readable once you learn it; early trainers).
- **Reactive** — reads the PLAYER and counter-adjusts (notices you favor Aggressive → Braces more) — gym leaders, rivals, Concord. The hardest fights read you back.

---

## THE IF-THEN MOVE-SELECTION LOGIC (how a profile picks a move each round)

Each round, a trainer's profile resolves to an action via roughly:

```
1. THREAT CHECK (if Call-capable):
   IF I'm about to be KO'd / caught in a committed enemy Charge at low HP
      AND bond ≥ Call-threshold AND have ★:
      → Call (Get Away / Hang In There) per Call-behavior (clutch vs liberal).

2. RELEASE CHECK:
   IF I'm mid-two-step (winding) → release this round (locked in).

3. READ THE PLAYER (if Reactive):
   Estimate the player's likely stance from their recent pattern / current
   tells → bias my choice toward the counter.

4. ESCALATION CHECK (per two-step-tendency):
   IF profile says two-step now (frequency roll, situational triggers —
      e.g. Charger vs a player who's been Bracing → Charge to pierce):
      → commit the signature/chosen two-step (accept the phase-1 risk).

5. BASE STANCE (default):
   → pick a base stance weighted by stance-tendency + terrain bias
      (+ reactive counter-bias), avoiding the thrice-repeat self-daze.
```

The PROFILE is the set of weights/thresholds feeding this; the logic is shared. So "a complex line of IF-THEN" = a shared decision tree, parameterized per trainer.

---

## WORKED EXAMPLE PROFILES

**ROUTE TRAINER (early, e.g. Youngster Milo)** — the teaching baseline:
Stance: Balanced · Two-step: Single-only · Bond: Low (no Calls) · Info: Open · Terrain: none · Adaptivity: Fixed.
→ A clean read: shows everything, single-steps, can't Call. Teaches the base triangle. You can commit Charges freely (he can't Get Away).

**FALKNER (Gym 1, Gale)** — first real test, still mostly readable:
Stance: Evader (Gale/flying favors Fluid initiative) · Two-step: Occasional (a signature Charge "gust") · Bond: Mid (a basic Call) · Info: Open (his gust is telegraphed — the scout report says "count the rounds") · Terrain: open/height (favors his aggression) · Adaptivity: Fixed.
→ Readable but introduces ONE two-step to learn (the telegraphed gust-charge — Guard or dodge it).

**A FROZEN-GYM LEADER (later)** — terrain-driven aggression:
Stance: Aggressor (because Brace is bad on ice) · Two-step: Frequent Charger (pierces; ice rewards commitment) · Bond: High (full Calls) · Info: Veiled intent · Terrain: frozen (you KNOW they won't Brace — anticipate) · Adaptivity: Reactive.
→ A hard fight you can prep for: the terrain tells you they'll be aggressive and Charge-heavy; bring Guard/counters, but watch for the Call escapes.

**A CONCORD ENFORCER (mid/late, antagonist)** — the brittle juggernaut:
Stance: Aggressor · Two-step: Frequent · Bond: Manufactured (pseudo-Calls, NO true ceiling-breaker) · Info: Bluffer (cold, unreadable, fakes tells) · Terrain: varies · Adaptivity: Reactive.
→ Powerful, unreadable, escalates hard — but CANNOT pull the desperate bond-comeback. The climax demonstration: out-LAST their brittleness with YOUR bond's ceiling-breaker. Beating them is the thesis made mechanical.

---

## PROGRESSION (how profiles scale difficulty — leak-free)
- **Pre-gym-1:** Single-only, Open info, Low-bond, Fixed. The base game, fully legible.
- **Gyms 1-3:** introduce Occasional two-steps, Mid-bond Calls, first Veiled intent. Terrain affinity begins to matter.
- **Mid game:** Frequent/Signature two-steps, High-bond full Calls, Hidden momentum, Reactive play, terrain mastery.
- **Late / Concord / Elite:** Bluffers, full information denial, Reactive, manufactured-loyalty juggernauts. The read-war at its deepest.
Difficulty scales by COMBINING the dimensions (more two-steps + better Calls + more hidden info + reactivity), NOT by new mechanics. Leak-cap-safe.

## STAGE 1 — AS BUILT (2026-06-20, KICKOFF-trainer-ai-layer4-stage1.md +
## KICKOFF-falkner-tune-+-focus-intent.md)
The trainer-AI CORE is shipped: the profile data structure + the shared
decision tree, with THREE Stage-1 dimensions live — **stance tendency**,
**two-step tendency**, and **information discipline (for the Focus tell)**. The
remaining dimensions (Calls/bond, Call behavior, terrain, adaptivity, bluffing)
are deferred; hook points are marked inline in `src/engine/trainerAI.ts`.

### Falkner gust tune (Item 1)
Falkner's 3/6/9 rhythm beat is now a forced **COMMITMENT**: a charged gust
(FOCUS→HEAVY) at rate 0.7 when a heavy is affordable, else a hard Aggressive
DIVE BOMB (and when winded, a lighter single-step). His signature now reliably
lands ON his signature beats (was a 50/50 that stamina-drain often skipped).
Ladder re-baselined (rate 0.7): readers unchanged (100% fair · 30/27 hard,
fair-vs-hard intact); no-read mashers rose modestly (brute ~64→72 fair) but are
still punished on the hard skill path — capped at 0.7 (always-charge spiked
brute to ~85). `FALKNER_GUST_FOCUS_RATE` in `bossAI.ts`.

### Focus Foe-Intent tell (Item 2 — info-discipline)
A profiled trainer's Focus narrows which release is coming, per its `info`
discipline (`'open'`/`'vague'`/`'opaque'` on `TrainerProfile`):
- **open** → a truthful 2-of-3 narrowing — "focuses to attack" (HEAVY/FEINT),
  "focuses to outwit" (HIDE/FEINT), "focuses to move fast" (HEAVY/HIDE). A
  learnable 50/50, consistent per trainer (salted by name), never collapsing
  into a perfect tell. Stage-1 trainers (Youngster/JAY/Lass) = open.
- **vague** → "is focusing intently" (FALKNER — a gym leader hints, doesn't
  narrow). **opaque** → just "FOCUSING" (elites/Concord, later).
The tell PHRASES live in `src/game/scenes/battle.ts` (`focusIntentTell`,
`FOCUS_NARROW_HINTS`) with the other intent tells; `degradeIntent` routes a
focus commit (predicting the release) AND the mid-focus release through it.
Wired via the `foeFocusInfo` scene option. PRESENTATION only — no engine
effect, ladders unperturbed. Bluffing (lying tells) is the later 'bluffer' tier.

- **Where:** `src/engine/trainerAI.ts` — pure policy (`trainerPolicy(profile)`),
  the `TrainerProfile` type, the `TRAINER_PROFILES` registry, and the win-flag
  routing (`TRAINER_PROFILE_BY_FLAG` / `foeProfileForFlag`). Wired in
  `src/game/main.ts` (`pushTrainerFight`): a PROFILED trainer fights via
  `trainerPolicy`; an UNPROFILED trainer (and every wild encounter) keeps
  `wildFoeAI` unchanged → wild battles stay bit-identical.
- **The headline:** trainers can now **FOCUS** — the player faces a trainer's
  hidden release + the flipped (both-focus) triangle for the first time. Reuses
  the player's focus/release machinery (no engine-math change).
- **Stage-1 roster (clearly distinct):** YOUNGSTER MILO (`route31_youngster_beaten`)
  = Balanced / Single-only (teaching baseline); JAY (`route31_trainer_beaten`)
  = Aggressor / Occasional **Charger** (focuses into HEAVY); LASS BRYN
  (`route31_lass_beaten`) = Bulwark / Single-only (slip it with Fluid).
- **FALKNER** (boss, `falknerBossAI`): upgraded to Focus on his signature gust
  (Evader / Occasional / signature) — his gust round sometimes winds up a
  FOCUS→HEAVY two-step. His bespoke rhythm/phase identity is intact.
- **Sim-gate** (`src/sim/trainerProfiles.test.ts`, SPROUTLE mirror vs a
  competent reading player, n=800): fair-but-distinct — foe win% youngster
  38.9 / jay 38.1 / lass 58.0 (competitive, none unbeatable/trivial); action
  distributions distinct (jay leans A + focuses ~19% into HEAVY; lass leans G
  ~45%; youngster even, never focuses). Falkner ladder re-baselined (he Focuses
  now; readers unchanged, mashers rose — see falknerLadder.test.ts). Rival/bond/
  wild ladders bit-identical.
- **Unit tests:** `src/engine/trainerAI.test.ts` (decision tree per stance
  tendency, two-step rates, mid-focus release, anti-self-daze, forced rest, a
  trainer focus→release through the engine, the both-focus flip vs a trainer,
  profile-vs-wildAI routing).

## BUILD NOTES
- The AI currently single-steps only (never commits) — that's the "Single-only / Low-bond / Open / Fixed" baseline already in code. Layer 4 = adding the OTHER dimension values + the shared IF-THEN tree + per-trainer parameter sets.
- Start small: give a FEW trainers Occasional two-steps + the first Reactive behavior; verify it feels like a different fight; expand.
- SIM-GATE each new profile-class: a trainer profile shouldn't be unbeatable OR trivially exploitable — run it against balanced player policies, confirm it's a fair-but-distinct fight.
- Each trainer's profile lives as data (the parameter set) matched to their character + their terrain; the decision tree is shared engine logic.
- Cross-ref: combat-enrichment-roadmap (Layers 1-3.5), bond-track-v2 (Call gating), the-concord (manufactured loyalty), living-world (terrain), and the per-region trainer authoring as content builds.
