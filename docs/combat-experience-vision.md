# Combat Experience Vision — the North Star for Combat Enrichment

**Status:** DESIGN VISION (Mathias). This LEADS the combat-enrichment lanes — it steers move-mapping (#2) and status (#1), which build TOWARD it. Reordered rationale: the experience-vision determines what attacks the game needs → which determines what statuses matter. So vision → moves → status → playstyle-systems. NOT a build yet — a design doc to develop, then it becomes build briefs. Drop in `docs/`.

## The thesis (the leading principle)
**Every battle should tell a story and be an experience — even a short one.** The anti-pattern: in the anime, if Charizard just walked up and Fire Blasted from the start, the battle's over — no story. Argent battles must UNFOLD: a beginning (probe/read), a middle (maneuver), a climax (mastery pays off).

**No levels → trainer experience is the progression axis.** Argent has no levels — so you don't win by out-leveling (grinding). You win by being a **better trainer/mon combination**: out-reading your opponent, using the environment, playing to your strengths. Mastery — not stats — determines outcomes. This is the bond-over-strength thesis made MECHANICAL, and it's the core of "push what Silver/Ruby can be."

## What "battle as story" requires (the design target)
Mechanics that make a fight an unfolding arc where TRAINER SKILL (not mon level) decides it:
- The battle BUILDS (you don't have everything at the start; capability rises as you play well).
- READING is rewarded (out-reading the opponent advances your position).
- The ENVIRONMENT matters (the battlefield is a tactical layer).
- MON IDENTITY is expressive (a mon's nature creates options).

## Three candidate mechanics (exploration — not yet committed)

### A — Phased / progressive attack unlock
Earn your 4 attacks DURING the fight (don't start with all). Creates an arc. 
- ✅ Story-building.
- ⚠️ Needs an IN-FICTION reason for the gating (mon warms up? trust builds? you've read enough to attempt the harder move?) — else it feels arbitrary/gamey. The reason must have soul.
- NOTE: may be SUBSUMED by Idea C (a better-motivated version).

### B — Environmental advantages (HIGH potential, complexity risk)
Mons interact with the battlefield by their nature: gale (flying) mons soar to gain advantage; water mons dive; BUT diving in a frozen environment fails, etc. Environment × mon-type × counters.
- ✅ Gorgeous for "story + experience" — battlefield matters, mon identity is expressive, creates readable tactical choices ("it went airborne — bring it down").
- ✅ Very Argent (environment as a combat layer).
- ⚠️ COMPLEXITY EXPLOSION risk (Mathias flagged: "a lot of possible parameters"). Design challenge = make it ELEGANT (a SMALL set of legible interactions, not a sprawling matrix). Direction excellent; execution must stay tight.

### C — Momentum-gated attack tiers (Mathias's FAVORITE — strongest)
Out-reading the opponent earns momentum (★). Attacks have TIERS. Holding 1 or 3 ★ UNLOCKS access to the better attack tiers — but using them does NOT consume ★. Instead, holding ★ for attacks means you CAN'T spend it on Calls. Momentum = a continuous tension: HOLD ★ for power, or SPEND ★ on Calls (heal/dodge/burst). Not both.
- ✅ Makes every ★ a live decision (hold-for-power vs. spend-for-utility) — momentum is continuously meaningful, not just "save for a Call."
- ✅ Ties READING → POWER (out-read → ★ → better attacks) = the no-levels/trainer-skill thesis MECHANIZED. You get stronger by reading better, not leveling.
- ✅ Creates the arc (A's "story") WITHOUT arbitrary gating — attack access rises as you earn reads; the battle naturally builds toward your power moves.
- ✅ The "doesn't consume, but blocks Calls" twist = a SOFT cost (opportunity cost, not expenditure) — powerful attacks stay available once earned, but the hold-vs-Call tension is continuous.
- **C likely SUBSUMES A** — it's phased-unlock done right (gated on earned momentum + a resource-tension layer, not arbitrary progress).

## How this steers the other lanes (the reordering payoff)
- **Moves (#2)** get designed to HAVE tiers (for C) + environment-interactions (for B) + the arc-structure (for A/C). The move catalog is built TO SERVE this vision.
- **Status (#1)** gets designed knowing which statuses MATTER for this experience (e.g. statuses that interact with momentum, environment, or the read-war).
- So designing this vision FIRST avoids building moves/status in a vacuum then retrofitting.

## Open design questions (to develop)
- C: what are the attack TIERS? How many ★ thresholds (1 and 3 — what about 2)? Does every mon have tiered attacks, or some?
- C: the hold-vs-spend tension — is it legible to the player (do they SEE "hold ★ for your tier-3 attack, or spend on a Call")?
- B: how to make environment ELEGANT — a small fixed set of environment types + a small set of mon-nature interactions? Which environments (water, sky, frozen, ...)? 
- B + C interaction: do environment-advantages also feed momentum/tiers? (Could unify B and C.)
- A vs C: is A still needed if C does phased-unlock-via-momentum? (Likely C replaces A.)
- The arc: what does a FULL battle arc look like beat-by-beat under these mechanics? (Probe → read → build momentum → unlock tiers / use environment → climax.)
- Sim: ALL of this is sim-gated (it changes combat math). Each mechanic needs Monte Carlo validation that no degenerate line dominates + the read-war stays central.

## Next
Develop the vision (esp. C — the favorite — and how B stays elegant), settle on an elegant system, THEN it cascades into move-catalog design (#2) + status design (#1) + the build (sim-gated). Creativity now; elegance before build.

---

# LOCKED CORE MODEL (the momentum economy — settled with Mathias)

The three ideas consolidated into ONE economy. This is the settled core (details/numbers still to workshop + sim-tune, but the MODEL is locked).

## Momentum is the universal currency, earned by out-reading
Out-reading the opponent earns momentum (★, cap 3). It's ONE pool with competing uses (the central tension below).

## Phased unlock (HARD GATE) — momentum unlocks better attacks
- Mon's attacks span tiers: **Tier 0 Basic** (always available) → **Tier 1 Advanced** (needs 1★ held) → **Tier 2 Powerful** (2★) → **Tier 3 Devastating** (3★) — IF the mon has learned them.
- **The better attacks are LOCKED until you hold enough momentum.** Hard gate, not soft scaling.
- **Attempting a move you lack momentum for FAILS meaningfully** — you whiff or get struck while "conjuring" it (the wind-up leaves you exposed, like casting a screen you can't yet afford). UI warns: "this won't work without the momentum." The Academy teaches this if too subtle.
- **The gate has a FICTION** (building to a bigger move takes earned momentum; attempting it unprepared exposes you) — so it's earned, not arbitrary. (This is the in-fiction reason phased-unlock needed.)

## The behind-penalty (the "gap," simplified — NOT full gap-scaling)
- **The more momentum the opponent holds OVER you, the less damage you do to them** — a linear −X% per momentum-behind (exact % = workshop + sim-tune).
- This handles the matched/near-matched standoff (two players both high-momentum blunt each other) WITHOUT complex continuous gap-scaling. Tiers have flat base damage; this penalty is the only modulator.
- (Rejected: full "gap scales all power" — too complex. Rejected: 3-v-3 50/50 miss — whiff-feel too punishing. This linear behind-penalty is the clean middle.)

## Damage ceiling — NO one-shots
- Even a Tier-3 Devastating at full advantage does BIG damage (~70% HP, tune later) but NEVER one-shots. The battle always has a next beat. Protects "every battle tells a story" from collapsing into "first to 3★ deletes them." (Consistent with the prior releaseBase down-tuning to prevent Focus+Heavy one-shots.)

## THE KEY TENSION (the heart of the system)
**Momentum: HOLD it to keep powerful attacks unlocked, OR SPEND it on Calls (heal/dodge/burst) + utility (screens/transforms). Not both.** Spending drops your attack tier; holding denies you Calls. "Should I spend my momentum or not? — because Calls aren't bad either" is the continuous per-turn decision. THIS TENSION IS THE GAME.

## Momentum also gates non-attacks (the generalization)
Utility moves that aren't classical attacks (Light Screen, Transform/Change-Type) also cost momentum — ★ is THE currency for any special action (power attack, Call, or utility). Player is always choosing how to spend/hold the one pool.

## Environment layer (attaches to the economy — WORKSHOP MORE)
Each environment adds situational option(s) + drawback(s) that tilt the field:
- Drawback example: Brace is debuffed in the cold.
- Unlock example: a cold area unlocks a "slide on the ice" Call → your mon can attack aggressively before Fluid (or "slide+aggressive punishes Brace even more in the cold").
- Keep it ELEGANT: a SMALL set of situational interactions per environment (not a sprawling matrix). Possibly environment plays also feed momentum/tiers (unifies environment into the core economy). NEEDS WORKSHOPPING.

## AI / trainer strategies (consolidate with trainer-combat-profiles)
- Trainers get **2-3 strategies each** (NOT know-it-alls). Build on / consolidate the existing `trainer-combat-profiles.md` (8-knob schema) — maybe those become secondary or fold in.
- **Weaker trainers allowed irrational randomness** (e.g. a fire mon using a poison-status move for no reason — they don't optimize). Skill-expressed-as-AI-coherence: stronger trainers play the momentum economy well; weaker ones don't.

## Anti-snowball (emergent, free)
The behind-penalty means being way ahead hits full, but as they claw back momentum your hits soften — keeping fights close/dramatic without an artificial rubber-band. Emerges from the core, not bolted on.

## Still to workshop / sim-tune
- The behind-penalty exact % (linear slope).
- The damage ceiling exact number (~70%?).
- Tier base damages (e.g. Advanced 50 / Devastating 100 — illustrative).
- Environment interactions (the elegant small set).
- AI strategy sets per trainer type.
- ALL sim-gated — Monte Carlo must confirm no degenerate line dominates + the read-war + hold-vs-spend tension stays central.

## How this leads the other lanes (the reorder payoff)
- **Moves (#2):** the catalog is built TO HAVE tiers (0/1/2/3) per mon, + which carry status, + environment interactions. Designed to serve THIS.
- **Status (#1):** designed knowing which statuses matter for THIS experience (interact with momentum? environment? the read-war?).
- So: vision (this) → move catalog (#2) → status (#1) → the sim-gated build.
