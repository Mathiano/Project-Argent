# Project Argent — Design Journal (combat & world-scoping session)

**Purpose:** capture the *reasoning* behind this session's design calls, not just the outcomes. Designed for: (a) a new chat session picking up the project, (b) future sessions months later, (c) future-Mathias re-orienting on why the systems are shaped the way they are. The AS-BUILT docs + canon describe WHAT we built; this describes WHY, and the PRACTICE that produced it. Cross-ref combat-enrichment-roadmap, combat-focus-redesign, trainer-combat-profiles, world-scope-skeleton, combat-backlog-banked.

---

## Part 1 — The decisions that shaped this session

### D1. Diagnosing Fluid dominance (the session's opening problem)
The session began with Mathias's playtest instinct: "Fluid is always the safe option — combat will get stale." Diagnosed by Monte Carlo: PureFLUID won 99.7%. The structural insight that anchored everything downstream: **you cannot fix a dominant SAFE option by adding RISKY options — you must make the safe option PUNISHABLE.** Adding new risky stances left Fluid at 99.2%; making Aggressive *beat* Fluid + raising Fluid's variance dropped it to 37.5%. *Lesson banked:* fix the dominant strategy at its source, don't pile complexity on top.

### D2. Three combat-model candidates (the deepest design fork)
Confronted with the "guess two turns out" readability problem (the shipped distinct-wind-ups Layer 2 had a telegraphed release), we explored three combat candidates rigorously:
- **B (shipped distinct wind-ups):** sim-balanced but telegraphed.
- **The FOCUS model:** shared "gathering energy" wind-up + hidden round-2 release via rotation triangle (HEAVY>Brace, FEINT>Aggressive, HIDE>Fluid). Mathias's design.
- **Candidate C ("Focus as 4th stance"):** Focus on the R1 base triangle, punishable by Aggression.

All three were Monte Carlo simulated. **The FOCUS model was chosen** for: (a) converts a hard 2-turn prediction into a clean 1-turn read, (b) self-balancing cost (focus-round damage is the clean knob), (c) Call synergy (Focus telegraphs A release → defender's Hang-On/Get-Away read). Candidate C archived because at a strong R1 focus-punish it over-punishes focusing (anti-focus aggression dominates 60%); at a gentle punish (~0.3) it balances, but adds higher tuning sensitivity for the input-cleanliness win — not worth the risk vs the cleaner separate-commit model. *Documented:* combat-system-candidates-decision.md.

### D3. The R2 rotation triangle (completing Mathias's idea)
Mathias proposed Focus → Heavy/Feint/Hide as releases but was "unsure about Hide" against the round-2 single-step. The clean completion: **Heavy>Brace, Feint>Aggressive, Hide>Fluid** — each release beats one R2 stance, loses to one, neutral on one. Thematically: Heavy crushes the turtle, Feint catches the aggressor, Hide catches the dancer. *This rotation triangle is the heart of the read-war.*

### D4. The wind-up chip (CC's tuning insight, banked as a principle)
During Layer 2 sim work, CC found that "two-stepping was self-defeating until I added a small wind-up chip — that pulled the dominant pure-reader down from 86%→60% without touching FluidSpam." *Lesson banked:* a winding mon isn't a passive punching bag — giving the wind-up *some* presence is what makes two-stepping *viable* (not just punishable). A targeted fix, not a global rebalance.

### D5. The L2.7 ★-award nuance (the "survives a gamble" case)
The momentum-★ award rule for two-step interactions has THREE cases, not two:
- Two-step vs two-step → mutual read → flipped-triangle winner gets ★. ✓
- Single-step punishes a two-step's phase-1 → the punisher gets ★. ✓
- Two-step **survives** a non-punishing single-step → **NOBODY gets ★** (it was a gamble, not a read). ✗
*Lesson banked:* "winning by surviving a gamble is NOT out-reading anyone." This subtlety mattered — CC's initial assumption ("two-step win → +★") would have gotten case 3 wrong.

### D6. The bond-gated Calls insight (trainer profiles)
When Mathias surfaced "their use of Calls depends on the level of bond they have with their mons," it elevated the trainer-profile schema from "AI personality" to "characterization through mechanics." Low-bond trainers CAN'T Call (you can commit a Charge and they can't Get Away — they're *locked in*). High-bond trainers have the full toolkit. **Concord trainers have manufactured loyalty → pseudo-Calls but no true ceiling-breaker** — strong-but-brittle, the climax demonstration: your earned bond beats their manufactured loyalty. *The same bonds-over-strength rule that governs the player governs the enemies. This is the thesis made mechanical at the enemy side.*

### D7. The information-warfare layer (Mathias's "hidden momentum" → Layer 3.5)
What started as "should foe momentum be hidden?" turned into a *whole layer*: information visibility itself becomes a progression axis. Early game leaks everything; post-gym-1 opponents progressively hide intent/momentum/bluff; elites/Concord hide everything. **Difficulty scales by REMOVING information, not adding mechanics.** Leak-cap-safe (no new per-turn resources). The Concord = masters of information denial. *This was the moment the difficulty curve found its real shape.*

### D8. The 2-of-3 narrowing vocabulary (Mathias's design, "focuses to attack/outwit/move fast")
When the player faced an opaque trainer Focus with no read, Mathias spotted the curve-flattener: even an easy trainer was Elite-Four-opaque. His fix — three 2-of-3 narrowings ("focuses to attack/outwit/move fast"), each leaving a 50/50 read between two specific releases — was the *implementation* of Layer 3.5. The vocabulary is *learned* ("the player will have to memorize these"), name-salted per trainer for consistency, and scales cleanly: open tier shows the narrowing, vague tier shows "is focusing intently," opaque tier shows nothing. **One mechanism scales from teaching-baseline through Champion** — the same dial, turned per trainer.

### D9. Phase-clarity verbs (wind-up vs release)
When Mathias's playtest showed "focuses to attack" repeating across both phases of one Focus and being confusing, his fix was: keep the lens vocabulary, change the verb — "is *charging* to attack" (wind-up) → "*focuses* to attack" (release). This added a *second channel* of information (lens = what's coming, verb = which phase). The bonus: "is charging to..." became a *tactical invitation* — the player now knows to consider Aggressive to interrupt the wind-up. **A UI text change that surfaced a hidden mechanic as an actionable choice.** Same legibility theme as every other "bug": *the mechanic was right; the player couldn't see it.*

### D10. Falkner's signature integration (loosening the 3/6/9 lock)
When Falkner got Focus but his existing 3/6/9 "forced Aggressive" rhythm prevented him from Focusing on his signature beats, the fix was Option B: change the lock from "forced Aggressive" to "forced commitment (Aggressive OR Focus→HEAVY)" so his signature gust BECOMES a charged Focus on his signature beats. Mathias's "gust-stamina-tax" idea (the more radical alternative) was banked for Layer 3 environments, where it belongs systemically. *Lesson banked:* don't fix in one location what wants to live in another system; bank the better-systemic-home version, do the surgical local fix now.

### D11. Perfect Silver 2.0 scope (the world frame)
The world's shape was settled as: **tight Johto mirror in structure** (8 gyms, Elite Four, Champion, Kanto post-game), but with **higher content density** (more sub-areas/activities per area) and **best-of-Gen-1-4 biomes** (fuller frozen region, volcano + hot springs, etc.). The *biome earn-their-slot rule:* a biome qualifies only if it (a) houses mons we're making and (b) makes a distinct combat environment. **And the anime Championships were reframed from "post-game filler" to "the bond-thesis capstone"** — the mechanical and thematic foil to the Concord's manufactured-loyalty ceiling. *The endgame became the thesis made manifest.*

### D12. The trainer-archetype two-tier model
Most trainers are **archetypes** (Youngster, Bug Catcher, Policeman — readable, templated, sprite-as-tell). Elites (Elite Four, Champion, Concord enforcers, gym leaders' high end) are **bespoke** (unreadable, hard regardless of look). *The exception to the read-the-sprite rule is what makes elites feel elite.* The catalog will treat them differently from the start.

---

## Part 2 — The principles that emerged (the practice)

These are the meta-lessons of HOW we worked, distilled. A future session should keep this practice.

### P1. Sim-gate, then feel-gate
Every major combat layer was Monte Carlo simulated *before* CC built it (or, for tuning, after — but ALWAYS before sign-off). The sim catches *strategic* balance (no dominant strategy, every option used, healthy spread). The feel-test catches *magnitude* (Heavy was sim-balanced but feel-overshot at the released damage). **Both gates matter — they catch different failures.** Never ship a combat change on one alone.

### P2. Legibility before mechanics
Recurring theme: when "something feels broken," the first hypothesis should be *"is it firing but invisible?"* before *"is it broken?"* — because in this project it's been the former at least 80% of the time. EXH, bond stars, two-step outcomes, the KO callout, "focuses to attack" repeating — all "bugs" were legibility gaps. **A working system the player can't see is indistinguishable from a broken one.** Surface the mechanic before tuning it.

### P3. The player learns the language
Good combat doesn't always self-explain — sometimes it teaches a vocabulary the player memorizes. "Focuses to attack" doesn't tell you it means Heavy-or-Feint; the player learns it. Once learned, it's *fast*. Don't try to make every tell self-explanatory; trust the player to learn. (But onboard the *existence* of the vocabulary somewhere — see banked item #4: teach the tell-tiers in-game.)

### P4. Earn their slot
Don't add mechanics/biomes/options "because they'd be cool" — earn them. The biome rule: housing required mons AND making a distinct combat environment. The leak cap: if an option goes unused in sim, cut it. The 7-dimension trainer profile: only build the dimensions that materially differentiate fights. **Scope discipline is the difference between a tight system and bloat.**

### P5. The mechanic was right; the player couldn't see it
The single most recurring lesson. Worth its own line. (Subset of P2 but worth restating because of how often it came up.)

### P6. Stage load-bearing builds
Layer 4 (trainer AI) was the riskiest single build (touches every trainer's foe-action path). Staged it: Stage 1 = wiring + 2 dimensions (stance + two-step tendency) on a few trainers. Stage 2+ = the richer dimensions later. *De-risks the wiring + delivers feel-able progress fast.* Don't try to ship the whole masterfile in one go when the risk is in the wiring.

### P7. Isolate new systems from the proven path
Every combat build kept the existing single-step path BIT-IDENTICAL. The two-step branch sat *beside* it. Layer 4 left wild AI untouched (only profiled trainers got new AI). This is why ladders stayed bit-identical across every major build. **Additive, isolated branches are the safest way to grow a system without regressing it.**

### P8. Bank the better-systemic-home version
Mathias's "gust-stamina-tax" idea was better than the local Falkner fix — but it wanted to live in Layer 3 (environments). Banked there; surgical Option B done now. *Don't compromise the better idea by jamming it in the wrong place; bank it for its right home, ship the local fix now.*

### P9. Diagnose by trace, not by inference
When my "the 3/6/9 lock prevents Focus" diagnosis was wrong, CC verified the actual code first and found the real cause (50% coin-flip + winded-lock on stamina). *When CC has direct code access, its diagnosis beats armchair reasoning from a playtest report.* Lesson for me: I should hedge my root-cause claims when CC can verify them.

### P10. Watch the canon-vs-code drift
Several times in this session, my mental model of the build lagged the actual code (the docs being untracked-not-missing; CC's "ready for Layer 2 kickoff" when Layer 2 was already shipped; etc.). **The repo wins; flag don't assert when my snapshot contradicts CC's live view.** Audit when in doubt.

---

## Part 3 — The state of the project at session close

### Shipped + feel-validated (the combat foundation)
- Base triangle (Layer 1) — sim-gated.
- Focus two-step (Layer 2 — the FOCUS model) — shared wind-up + hidden release rotation triangle, sim-validated, damage-tuned, feel-validated ("much more fun, especially with Falkner").
- Calls (★ economy) — Catch Breath / Get Away / Hang In There, bond-gated.
- 17-type chart, dual-type multiplicative.
- Bond — challenge-scaled, per-fighter credit, stage beats, ★-jumpstart, Call-unlock.
- Catching, evolution, the full Hearthwick→Falkner spine, save, menus.
- Layer 4 Stage 1 — trainer AI core: stance + two-step tendency, 3 distinct route trainers + Falkner now Focuses, isolation held (wild bit-identical).
- Layer 3.5 foundation — information-discipline (open/vague/opaque), 2-of-3 narrowings ("focuses to attack/outwit/move fast"), phase-aware verbs ("charging to..." → "focuses to..."), name-salted lens consistency. Difficulty-as-graduated-opacity is now a real dial.
- Phase clarity surfaces the wind-up vulnerability as a tactical invitation.

### Designed + scoped (next builds)
- Trainer-archetype catalog (TODO, the next big design piece) — class → sprite identity → 7-dim profile → typical mons, archetype-vs-elite two tiers. *Mathias's idea, scoped by the world skeleton.*
- World scope: Perfect Silver 2.0 — Johto-mirror structure, higher density, best-of-Gen-1-4 biomes, anime Championships as the bond-thesis capstone.

### Banked for later (real, not lost)
From combat-backlog-banked.md:
1. SoulSilver-quality UI upgrade (presentation-layer).
2. Move-vs-stance/release mapping (a real unresolved design question — how Tackle/Flame Snap relate to Heavy/Feint/Hide).
3. More anime-style Calls (the combat x-factor vein).
4. Teach the focus-tell tiers in-game (onboarding gap).
Plus: Layer 3 environments (with Falkner's gust-stamina-tax as the design hook), Layer 4 Stages 2/3 (bond-gated Calls, info-discipline beyond the foundation, terrain affinity, adaptivity), status effects (Phase 8), the Concord faction, the Practice Arena.

### The next phase (the bridge)
**Combat is done as foundation. The next phase is the experience layer:**
1. Trainer-archetype catalog (pure design with Mathias).
2. Audio (highest feel-per-effort cheap win — event bus + emit points exist, zero subscribers).
3. Follower-mon + the shown JAY beat (banked, plan-ready).
4. Art production (more CH1 sprites + a real player sprite).
5. SoulSilver-quality UI pass.
6. Then deeper combat (Layer 3 environments, Layer 4 Stages 2/3, status, the moves question) onto the proven foundation.

---

## For a new session picking this up
Read this doc + CLAUDE.md + the doc map in README. The canon is fully in the repo. The combat system is *settled* — don't second-guess the foundation; build on it. The practice (Part 2) is more important than any specific decision (Part 1) — *that* is what makes the next phase go well. And remember: the project's center of gravity has shifted from "systems design" to "making it feel like a game." Different work, same loop: diagnose by feel, design from principle, validate (sim where applicable, feel always), ship in slices, bank what surfaces.
