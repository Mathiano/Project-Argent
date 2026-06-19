# Combat Enrichment — the validated two-layer design (Monte Carlo proven)

**Status:** design direction, VALIDATED by Monte Carlo simulation (scripts: argent_combat_montecarlo_run1-4.py, argent_combat_montecarlo_twolayer.py). Build incrementally, in the order below, playtesting each layer. Cross-ref combat-2-0-spec, combat-depth-types-status, bond-track-v2, design-risks-and-gaps (Risk 2).

---

## THE CORE FINDING: Fluid was a dominant strategy — and the fix

**Monte Carlo Run 1 (base system as-was):** PureFLUID won **99.7%** of battles. Fluid was *strictly* dominant — best mean payoff AND lowest variance (never punished). The game was a single-button non-game: "always pick Fluid."

**Run 2-3 (added Charge/Ambush/Feint as "exciting risky options"):** PureFLUID *still* won **99.2%.**

> **THE KEY DESIGN PRINCIPLE (banked):** You CANNOT fix a dominant *safe* option by adding *risky* alternatives. Risk-averse play just ignores the risky toys and keeps picking the safe one. **The only fix for a dominant safe option is to make it PUNISHABLE** — give it a hard counter and real variance.

**Run 4 (the real fix):** Made **AGGRESSIVE beat FLUID** + raised Fluid's variance. PureFLUID dropped to **37.5%** (now a *losing* spam strategy); win-rate spread collapsed from 97pp -> 43pp; balanced play rose to the top. **Fixed.**

---

## LAYER 1 — the base triangle (the essential fix, build FIRST)

**AGGRESSIVE > FLUID > GUARD > AGGRESSIVE** (hard counters).

- **AGGRESSIVE beats FLUID** — aggression catches the dodger when they commit; the evasive get cornered. (This is the dominance fix. Thematically: Fluid is about slipping past Guard, so it's exposed to direct aggression.)
- **FLUID beats GUARD** — flows around/slips the brace.
- **GUARD beats AGGRESSIVE** — braces and counters the wild swing, turns it back.

**Fluid's repositioned identity = INITIATIVE, not safety.** Fluid still ACTS FIRST (even when slower in raw speed) — it gets its hit/effect in before the opponent. But it LOSES the exchange to Aggressive on net. So Fluid is the *speed/first-strike* option (useful to act first — e.g. to finish a low-HP foe, or escape), NOT the *safe* option. If both pick Fluid, the faster one strikes first.

**Variance:** Aggressive = HIGH (swingy: big reward unread, big punish read). Fluid = MID (no longer ultra-safe). Guard = MID.

**Anti-spam:** the SAME stance chosen THREE rounds running -> self-DAZE (predictability punished). Twice is fine (double-Fluid to act first twice, or set up a two-step); thrice is too readable.

This single layer (just the rebalanced triangle + Fluid-acts-first + thrice-daze) is the **essential, must-build fix.** Monte Carlo proves it breaks Fluid dominance. NO new mechanics required — it's a tuning/rule change to the existing stance system. **Build and verify this FIRST, before any enrichment.**

> **BUILD DEPENDENCY — momentum-★ award follows the win-triangle (do NOT miss this).** The momentum-★ on each exchange is awarded to whoever WINS the read. So flipping the Aggressive/Fluid edge (Fluid-beats-Aggressive → Aggressive-beats-Fluid) MUST ALSO flip the ★ award on that edge: after Layer 1, an Aggressive-vs-Fluid exchange is an *Aggressive* win, so the **Aggressive player gets the ★, not the Fluid dodger.** The damage-result and the momentum-award are two expressions of the same "who won the read" — they flip TOGETHER. (Pre-Layer-1, the Fluid dodger correctly gets the ★ because Fluid currently beats Aggressive; this is consistent NOW and only flips when the edge does.) If the damage flips but the ★ award doesn't, you get an incoherent state — Aggressive wins the hit but Fluid still charges ★. Verify both flip in lockstep; the DODGE/COUNTER/OPENING/CLASH "(+★ you/foe)" callout must reflect the new winner.

---

## LAYER 2 — two-step plays (the depth layer, build AFTER layer 1 is sound)

> **⚠️ SUPERSEDED — the two-step layer is being REBUILT to the FOCUS model (see docs/combat-focus-redesign.md).** The "distinct visible wind-ups" design described below was BUILT (shipped Layer 2) and sim-balanced, but it has the "guess 2 turns out" readability problem: the wind-up telegraphs WHICH release is coming, so the opponent pre-counters a turn early. The adopted replacement (the FOCUS model, sim-validated, ~10pp spread, Adaptive tops) makes R1 a SHARED generic "gathering energy" wind-up and R2 a player-selected HIDDEN release (Heavy/Feint/Hide) resolved via a rotation triangle — converting the hard 2-turn prediction into a clean 1-turn round-2 read. The base triangle (Layer 1), the both-escalate FLIP, and the Call escapes are PRESERVED. The Candidate C "Focus as a 4th stance" variant was explored and ARCHIVED (sim showed it over-punishes focus / promotes defensive play). **For the current two-step design, read combat-focus-redesign.md; the section below is retained as the prior (superseded) design for reference.**

Each base stance has a **two-step**: a 2-round commitment with a setup (phase 1) and a payoff (phase 2).
- **CHARGE** (Aggressive+) — wind up a big hit; phase-2 PUSHES THROUGH GUARD (brace can't block it).
- **HIDE** (Fluid+) — go to cover (intent concealed); phase-2 strikes from concealment (reduced incoming when the blow lands).
- **FEINT** (Guard+) — fake a charge; phase-2 punishes a defensive reaction (daze).

**Mechanically: two-steps are COMMITMENTS initiated from a base stance** (you pick "Charge" instead of "Aggressive" this round -> you're locked into the release next round). They are NOT a separate permanent stance set (that would be 6 stances and leak). The input stays: each round pick {AGG, FLU, GUA} OR initiate {CHARGE, HIDE, FEINT}. Contextual, not always-on clutter.

**Phase 1 is a distinct, COUNTERABLE state.** While you wind up, you're exposed — the opponent (if they read it / play the punishing single-step) hits your vulnerability. **This is the cost of two-stepping, and tuning it is critical (see findings).**

**SIMULTANEOUS commit (Option A — locked):** round-1 actions lock BLIND. Neither side knows if the other two-stepped until resolution. So two-step-vs-two-step is a mutual READ ("will they also escalate?"), not a telegraph-and-react. Preserves the read-war's soul; no peeking.

### The FLIPPED triangle (when BOTH commit two-steps)
**HIDE > CHARGE > FEINT > HIDE** (the base triangle inverts):
- **HIDE beats CHARGE** — you're concealed when the big blow lands (take less).
- **FEINT beats HIDE** — the feint catches the over-committed evader (strong/hard-ish).
- **CHARGE beats FEINT** — raw power overwhelms the bluff.

Logic: single-step rewards *aggression* (commitment beats evasion); two-step rewards *evasion/trickery* (when everyone's going big, the slippery one wins — until the feint punishes them). So "should I escalate to a two-step?" is itself a READ layered on the stance read.

### Counter strength: HARD on base, SOFT on two-steps
- **Base triangle = HARD counters** (decisive — keeps the core read sharp).
- **Two-step counters = SOFT** (probabilistic tilt, not auto-win). CRITICAL because: if you SEE the opponent's phase-1 (e.g. a visible charge wind-up), you have information — a HARD counter would make any telegraphed two-step suicidal. SOFT counters keep two-steps VIABLE even when read (tilts odds, doesn't guarantee).

### Escaping a committed enemy two-step = CALL only, not a stance
The ONLY way out of a committed enemy CHARGE is a Call (★-powered): "GET AWAY" (guaranteed no-hit/dodge) or "HANG IN THERE" (can't die this round). Not a stance. This makes the ★ economy genuinely clutch (saved for "they charged, I'm caught, spend ★ to survive").

### Momentum-★ on two-steps (the award rule for the two-step layer)
★ goes to whoever WON A READ — and a two-step only counts as a "read" when matched against ANOTHER two-step:
- **Two-step vs two-step** → a genuine MUTUAL read (both escalated; the flipped triangle Hide>Charge>Feint resolves who read better). The flipped-triangle WINNER gets ★. ✓
- **Single-step PUNISHES a two-step's phase-1** → the SINGLE-STEPPER read the wind-up and capitalized = a read-win for THEM → they get the ★ (consistent with the base triangle). ✓
- **Two-step "survives" a non-punishing single-step** → NOBODY gets ★. It was a phase-1 GAMBLE (survive/punished), not a read — surviving a gamble isn't out-reading anyone. ✓

So two-stepping is NOT a reliable momentum source — you only earn ★ from a two-step when you out-read another two-stepper (the flipped triangle), or when you (as a single-stepper) punish someone's exposed wind-up. This keeps ★ tied to genuine reads, not to commitment-gambling. (Build with Layer 2; the rule follows the same "★ = won a read" principle as Layer 1.)

---

## MONTE CARLO VALIDATION of the two-layer system

**Two-layer sim (Option A, tuned):** win-rate spread **16pp** (std 6pp) — an *excellent* competitive distribution.
- **FluidSpam, HideSpam, ChargeSpam all sit BELOW the balanced/adaptive policies** (42-46% vs 53-58%). **Spamming any one thing loses to reading + varying.** (The definition of a healthy read-war.)
- **Every action is used** (~22% each base stance, ~10% each two-step). No dead weight; the two-step layer earns its place without dominating. Leak-cap satisfied.

### The CRITICAL TUNING LEVER (the finding to remember when building)
**The phase-1 vulnerability magnitude is the master balance knob.** First sim pass (mild phase-1 penalty) -> two-step-SPAM dominated (HideSpam 71%). Harshening the phase-1 penalty (two-stepping into a single-stepper is genuinely risky) -> balanced (spread 16pp).

> **BUILD FINDING:** two-stepping MUST be a real gamble — being exposed in phase-1 has to HURT (when read/punished), or "always escalate" becomes the new dominant strategy. Tune phase-1 penalties HARSH; verify two-step-spam policies sit BELOW balanced play in sim before shipping.

---

## LAYER 3 — environments (the meta-read layer, build with/after two-steps)

Each environment TILTS the triangle AND biases opponent behavior. Two effects:

### A) Mechanical tilt (helps/hurts specific stances)
| Environment | Helps | Hurts | Logic |
|---|---|---|---|
| Open field | — | — | Baseline, no tilt |
| Forest / tall grass | Fluid, Hide | Charge | Cover favors evasion/ambush; no room to wind up |
| Fog / rain | Fluid | Aggressive (miss) | Low visibility makes precise aggression whiff |
| Frozen / ice | Aggressive | Guard/Brace | Standing still (brace) on ice is bad; momentum rewarded |
| Rocky / cover | Guard, Hide | Fluid | Hard terrain favors bracing; less room to flow |
| Cliff / height | Charge, Aggressive | Hide | Nowhere to conceal; commitment favored |
| Sand / mud | Guard | Fluid, Charge | Slows mobility; favors the patient brace |

### B) The META-READ (the deep part)
**A smart trainer plays to their terrain — so the environment tells you their likely policy.** In a frozen zone, local trainers know bracing is bad there, so they brace less — and YOU can anticipate that (prepare for their aggression). In fog/forest, home trainers MAIN evasion/ambush (their home turf) — read that and bait it. Opponents still VARY, but carry a terrain PREFERENCE you can exploit if you pay attention. This layers a slow, anticipatory read (their style, informed by where you fight) on top of the per-round read. Ties combat to "journeys not corridors" — *where* you fight matters, mechanically. (Monte Carlo TODO: model terrain-biased opponent policies to confirm no environment creates an in-biome dominant strategy.)

---

## LAYER 3.5 — INFORMATION WARFARE (the bluff/hidden-info progression axis)

A third axis of depth, alongside the base triangle and the two-steps: **what the player can SEE.** Difficulty scales not by adding mechanics but by progressively REMOVING information — forcing the player to read behavior/tells instead of explicit readouts. Leak-free difficulty: same system, less spoon-feeding.

### Momentum-★ is HIDDEN information (the foundational case)
- **YOUR own ★/momentum:** visible + clearly LABELED (you know your own resources).
- **The FOE's ★/momentum:** HIDDEN. You do NOT see how much momentum the opponent has banked.
- **Why:** this creates the emotional spike — "do they have ★? can they Call right now? are they about to unleash something?" Not knowing if the foe can escape-Call a committed Charge, or unleash a banked resource, makes every exchange a BLUFF read. The Call economy becomes a bluff layer, not just a resource meter.
- **Consistency with the read-war:** foe INTENT stays visible (that's the core read — the skill is reacting to it). But resource-STATE (momentum) is hidden — you see what you READ, not what they HOARD. Intent = shown (the read); momentum = hidden (the bluff).

### Information visibility as a PROGRESSION CURVE
Early game (tutorial → first gym): lots shown — INTENT, BASE SPD, your own ★ — the game TEACHES the read. **After the first gym and beyond, opponents progressively HIDE information:**
- A skilled trainer doesn't telegraph intent clearly (vaguer/no tells).
- Conceals momentum, bluffs a Call threat they can't afford (or hides one they can).
- Later/elite opponents may hide intent entirely — forcing the player to read PATTERNS and BEHAVIOR, not readouts.
So the read-war DEEPENS by removing the training wheels — the same combat, progressively less explicit. This is a difficulty axis with NO new mechanics (leak-cap-safe).

### Connections
- **The Concord:** their augmented/manufactured-loyalty mons are the MASTERS of information denial — cold, unreadable, no tells. Makes them feel genuinely threatening (you can't read a machine-loyal mon the way you read a bonded one — thematic AND mechanical).
- **Trainer variety (Layer 4):** WHAT information a trainer hides becomes part of their identity, alongside HOW they play. A leader who hides momentum is a different read than one who shows it.
- **Build note:** the foundational piece (hide foe ★, label own ★) ships with the ★/Call economy. The PROGRESSION (opponents hiding more post-gym-1) is a per-trainer/per-chapter dial layered on as content builds — part of trainer-strategy authoring.

---

## LAYER 4 — trainer-strategy variety (the biggest depth-per-effort, ongoing)
The SAME system feels infinitely varied when opponents PLAY DIFFERENTLY: an aggressive trainer charges a lot (bait their commitment); a defensive one braces + feints; a tricky one (Concord/Trickster-user) hides + ambushes. Trainer *style* becomes part of trainer identity — you read not just their stance but their TENDENCIES (informed by their character + their terrain). This is why anime battles feel rich: every opponent THINKS differently. Cheapest, highest-impact depth — zero new mechanics, just varied AI policies. (Risk 5 in the risks doc — the trainer-AI build.)

---

## HOW CALLS INTERACT (the override layer, above everything)
Calls are ★-powered OVERRIDES that FORCE outcomes the stance-read wouldn't give: "Get Away" = guaranteed no-hit; "Hang In There" = can't die this round. They sit ABOVE the base triangle, two-steps, and environments — the "spend resource to break the read / escape a bad spot" layer. ★ is earned in-battle (read-wins/momentum) and gated by bond (bond-track-v2). The two-step layer makes Calls clutch: the only escape from a committed enemy Charge is a Call. The ★ economy = "I can override ~N reads per battle" tension.

---

## BUILD ORDER (essential first, depth layered, each playtested)
1. **Layer 1 — the base triangle fix** (AGG>FLUID>GUARD + Fluid-acts-first + thrice-daze). ESSENTIAL. Sim-proven to break Fluid dominance. No new mechanics. Build + verify FIRST.
2. **Layer 2 — two-steps (the FOCUS model — see combat-focus-redesign.md)** — R1 shared "gathering energy" Focus (focuser pays the focus cost), R2 player-selected HIDDEN release (Heavy/Feint/Hide) via the rotation triangle (Heavy>Brace, Feint>Agg, Hide>Fluid); both-focus = flipped triangle; Call escapes preserved. Sim-validated (~10pp spread, Adaptive tops, FOCUS_COST~1.1 the master knob). The depth layer; verify focus-spam sits below balanced play. (Replaces the superseded "distinct visible wind-ups" version.)
3. **Layer 3 — environments** (mechanical tilts + the meta-read / terrain-biased opponent policies). Ties to the world.
4. **Layer 4 — trainer-strategy variety** (ongoing — varied AI policies per trainer/character/terrain). The cheapest richest depth.

## THE LEAK CAP (unchanged — the discipline)
A new mechanic is SAFE if it makes an EXISTING choice matter more; it LEAKS if it adds a NEW number/state to track every turn. No phys/special, no buff-debuff spirals, no third per-turn resource (stamina + ★ only). The two-layer system passed the Monte Carlo's "every option used" test — keep that bar: if a future addition goes unused in sim, cut it.

## Sequencing
- Layer 1 is the highest-priority combat work after the current bond sign-off.
- Each layer is sim-checkable (re-run the Monte Carlo with the new layer; confirm no dominant strategy + every option used) AND playtested before the next.
- Cross-ref: combat-2-0-spec, combat-depth-types-status, bond-track-v2, living-world (terrain hooks), the-concord (augmented trainer styles), mon-character (Trickster ambush identity), design-risks-and-gaps (Risk 2 leak cap).
