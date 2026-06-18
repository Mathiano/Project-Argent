# Bond Growth Model — refinement (supplements bond-track-v2.md)

**Status:** ruling, supersedes the relevant parts of bond-track-v2's "anti-grind math." Captures a refinement to HOW bond grows, resolving two holes in the pure "quality-only" model. Build to THIS for the growth mechanic.

## The two holes in pure "quality-only"

bond-track-v2 said bond XP = "read-wins, boss clears, Calls landed" only (to block weak-wild farming). Correct intent, but it created two problems:

1. **Route/city trainer battles would reward ~zero bond** — but fighting trainers along the way IS the core Pokémon loop. Draining bond-value from legitimate trainer fights guts the activity the game is built around.
2. **New / late-game mons would have no bond-fuel** — if bond comes only from finite sources (bosses, gym clears), a mon caught at hour 30 can never catch up (the fuel is spent/behind you). Bond fuel CANNOT be finite, or late team-changes become punishing and "any mon can be your partner" breaks.

## The resolution: CHALLENGE-scaled, not boss-gated (and renewable forever)

Bond grows from **how much a fight genuinely challenged THIS mon** — not from repetition, and not only from bosses.

- **Real trainer battle / fight near your level** (a fight you could plausibly lose) → **meaningful bond.** ✓ Route + city trainers MATTER.
- **Trivial farming** (same weak wild repeatedly, stomping under-leveled foes) → **near-zero bond.** ✓ The foe didn't challenge you, so there's nothing to bond over. Anti-grind firewall HOLDS.
- **A new / under-leveled mon** fights *appropriate* opposition (trainers + wilds near ITS level) and **earns bond from those** — because *for that mon*, those are real challenges. ✓ Renewable path for any mon, any time.

**The key insight: "challenge" is relative to the mon and renewable forever.** A boss is finite; "fights that genuinely test *this* mon" are *always available* (there's always a next route, trainer, or appropriately-leveled wild). So bond-fuel NEVER runs out — you just have to *actually engage* (fight real opposition), not farm trivia.

**Mechanically:** bond XP scales with the fight's challenge relative to the mon — foe strength/level relative to the mon, whether it was a trainer (weighted higher than a wild), read-wins under pressure, clutch moments, boss clears (still a big bonus), Calls landed. A trivial/over-leveled foe → a tiny fraction; a real challenge → full value. Same firewall, but the line is **challenge vs. triviality**, not **boss vs. everything-else.**

## The curve (not a hard split)

The "easy early, earned late" feel comes from the TIER THRESHOLDS widening, not a rule-change:
- **Early tiers fill fast** — when thresholds are small, every real fight contributes meaningfully. A favored mon visibly grows close quickly.
- **Late tiers take sustained engagement** — thresholds widen, so deep bond *organically* requires lots of real challenge over time.
- No hard "tier 1-4 from X, tier 5-7 from Y" switch — it's one continuous challenge-scaled curve that simply *demands more* at the top. (Considered a hard split; rejected as fiddly/arbitrary — the curve gives the same "earned late" feel cleanly.)

## Max-bond stays HORIZONTAL — the line we hold

**Top-tier bond NEVER grants stats.** This is the single most important rule. Argent's thesis is "bonds over *strength*" — bonds give better *partnership* (Calls, Resolve, the kit), not bigger *numbers*. The moment bond → stats:
- the stat-grind returns through the back door, AND
- the thesis inverts (bonds would BE strength — exactly what the Concord believes and the game argues *against*).

**The max-bond reward is a TRANSFORMED TACTICAL TOOLKIT, not a stat boost:** the second Call slot, Resolve (status-clear), the bond-gated signature move, the ★-economy upgrades. A fully-bonded mon feels *dramatically more capable* — through OPTIONS, not numbers. That keeps the thesis intact while making max-bond a massive, satisfying reward. (Considered a small capstone stat-bump; rejected — it breaks the horizontal rule and undermines the whole game's argument. Held firm.)

## The renewable high-tier source: the Practice Arena (closes the late-mon hole)

**The remaining hole the challenge-model alone doesn't fully close:** a mon caught LATE and high-level has scarce challenge available — wilds are now *trivial* to it (→ near-zero bond), and finite bosses remain. So a late/strong mon could STALL before tier 7 (too strong for wilds to challenge, too few bosses left). "Renewable forever" needs one concrete renewable source that's *always level-appropriate*.

**The fix: the Practice Arena** — a facility in a LATER-game city where you fight **scaling, always-appropriate, genuinely hard** opposition (real reads vs. tough AI), repeatably and infinitely.

**Why it's "repeatable challenge," NOT "grind" (the needle-threading):**
- Old-Pokémon grind = fight the same weak foe 100×, brain off, meter ticks up. *Mindless repetition.*
- The Arena = fight scaling, tough, real-read opponents as many times as you want. **Each fight demands actual skill.** You *can* "farm" bond here, but ONLY by *playing well repeatedly* — which is the *fun* core of the game, not tedium.
- The scaling difficulty makes mindless autopilot *impossible* (you can't sleepwalk a hard read), so the Arena is "grindable" in the sense of *repeatable + reliable*, but never "grind" in the sense Argent forbids (*trivial* repetition).

**This is uniquely right for Argent:** in a game whose core fun IS the read-war, "grinding" bond = "playing the good part of the game repeatedly," which is fine. The only thing forbidden is *mindless* repetition — and the Arena's scaling forbids exactly that.

**Design specifics:**
- **Later-game city facility** — an endgame/late bond-maxing resource, NOT an early shortcut (you can't rush a mon to tier 7 in Chapter 2; deep bond stays earned over the journey, and the Arena is where late/extra mons get their renewable challenge).
- **"The Practice Arena"** (working name) — go there to *train* mons against scaling tough opposition.
- **The renewable bond source** that makes "get ALL your mons to max bond" *theoretically achievable* for any mon at any level — the always-level-appropriate, infinite, skill-demanding fuel.
- **Doubles as endgame content** (fills the end-game gap from design-risks-and-gaps.md).
- **Builds later** (it's a late-city facility) — but banked now because it's the piece that makes the bond growth model *complete* (without it, "renewable forever" has a hole for late/strong mons).

- Bond is horizontal (never HP/ATK/DFN/SPD) — now reinforced as absolute.
- The two tracks: bond-gated moves + the Call economy.
- The tier ladder (Familiar→Bonded) and its unlocks.
- The ≤3% ladder gate (bond's combat effects shift the archetype ladder ≤3%).
- Bond persists + travels with the mon; levels still gate base moveset + evolution.

## Cross-ref
bond-track-v2.md (the system this refines), combat-depth-types-status (Resolve as the max-bond status-clear), the-concord (why bonds-≠-stats is thesis-critical), catching-2-0 (catch-origin as one bond input).
