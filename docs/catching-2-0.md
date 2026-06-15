# Catching 2.0 — design note (the two-path catch system)

**Status:** design locked. Build is **Phase 6** (catching + evolution). This supersedes the placeholder catch and the original single-path Catching 2.0 sketch in the feature scope — it adds a **second, parallel catch path** that makes the system express the game's central thesis.

**Cross-references:** `BUILD-ROADMAP.md` (Phase 6 — where this is built) · `feature-ambition-scope.md` §1 (the original single-path sketch this **supersedes**) · `bond-track-v2.md` (Path 2's bond bonus) · `combat-2-0-spec.md` (Path 1's read-windows + Wariness). The one open tuning item — the **Path-2 acceptance formula** — is settled at the **Phase 6 kickoff** (see "Open tuning" below).

## The core idea — two paths, two themes

Argent's whole argument is **strength/skill vs. bonds/mercy**. Catching now embodies that argument directly: there are two ways to add a wild mon to your team, and they are philosophically opposite.

### Path 1 — The Read Window (catching as battling)
The mon is conscious; you catch it by **out-playing** it. (This is the original Catching 2.0 spec.)
- You can only attempt a catch during a **window you create** by winning a read: a counter, a dodge, an opening, a clash-win → a 1-round window. An **exhausted** foe → a stronger window. A **Broken** foe (rare wilds carry small Break bars) → the best window.
- Catch chance = species rarity × window quality (read-win ×1.0, exhausted ×1.5, Broken ×2.0) × ball/band type × a mild HP factor.
- Throwing **outside** a window auto-fails and raises **Wariness**; high Wariness → the mon telegraphs it will flee next round (never instant-poof RNG).
- This path keeps catching as *the same skill as battling* — you earn the catch by reading the mon, not by beating it senseless.

### Path 2 — The Willing Join (catching as mercy) — NEW
The mon has **fainted** — and you cannot catch a fainted mon by force (no KO-and-grab; that would collapse Path 1 into ball-spam). **But** you may choose to **show it mercy**: use a healing item/medicine on the fainted wild mon, and it may then **choose to join you willingly.**
- This is the *compassion* path — you spared and helped it instead of finishing it, and it decides whether to follow you.
- It is **never guaranteed** — the mon can refuse and leave.
- **Gating (the odds it says yes):** primarily your **badge count** (accomplished trainers inspire loyalty — and this scales with progress, so the path works from the early game onward), with the **mon's level/rarity** as the difficulty it's measured against, and the **bond of your active mon** as a *bonus modifier* (a deeply-bonded partner makes the wild one more willing). Badges are the primary gate specifically because bond is the slow campaign-long track and would leave this path near-dead early when it's most needed.
- **On refusal:** the mon leaves (you don't get it), BUT you **learn something** — a hint about what it wanted / why it wasn't ready ("it didn't yet trust a trainer with so few badges" / "it sensed your partner's bond wasn't deep enough"). Refusal teaches the system rather than just punishing — the player learns what to improve, turning a loss into a lesson. (Aligns with the no-dead-ends, teaching-through-play philosophy.)

## Why two paths is the right design

- **It IS the thesis, playable:** Path 1 = win by skill/strength (the read). Path 2 = win by bond/mercy (sparing it). The two catch routes are the game's two themes made mechanical. A player who believes in bonds can catch differently than one who min-maxes reads.
- **It resolves the "I couldn't make the window in time" worry:** if the foe's HP runs out before you create a read-window, you're not locked out — the mercy path is the fallback. But because Path 2 is bond/badge-gated and refusable, it's a *meaningful alternative*, NOT a dominant "just KO and heal" exploit. Read-windows remain the reliable, skill-based route.
- **It protects Path 1:** because you canNOT force-catch a fainted mon, the read-window stays the primary, optimal catch method — catching never degrades into brainless attrition.

## The storage question — RESOLVED: balls stay

- Mons are stored in **balls** (and the PC box system, box-access-anywhere per the scope). The ball is load-bearing for the Silver premise and Argent inherits it.
- **The reframe that fits the bonds philosophy:** the mons are **happy** in their balls — it's a home they return to willingly, not a prison. This makes the ball *more* on-theme, not less.
- **Deferred flavor (later polish):** how mons are let out of their balls to walk with you during downtime/camping — a warmth layer, designed later. Not a Phase 6 requirement.

## Crafted bands (the apricorn/Kurt slot) — Path 1 depth, later

Per the feature scope: crafted bands each favor one window type (a band for exhausted targets, one for Broken, one for full-★ throws). This is Path-1 depth and can come **after** the core two-path catch lands — a later catching pass, not Phase 6 core.

## Build scope (Phase 6)

**Core (Phase 6):**
- Path 1: read-created windows (read-win / exhausted / Broken), catch-chance math, Wariness + flee telegraph, throwing a ball during a window.
- Path 2: the willing-join — heal a fainted wild mon → badge/level/bond-gated acceptance roll → join or refuse-with-a-hint.
- Balls as items (the Mart gains a ball; the bag's ball pocket, declared since 5a, now populates).
- Caught mons enter the party/box.

**Deferred (later catching pass):**
- Crafted bands / apricorn crafting.
- The Preserve (the Safari-Zone analog — Path 1 with no-KO rules + rare spawns).
- Marked-mon (shiny) catch interactions.
- The let-them-out-of-the-ball camping flavor.

## Open tuning (settle at the Phase 6 kickoff)

- Exact Path-2 acceptance formula (badge weight vs. mon level/rarity vs. bond bonus) — sim/playtest-tuned so it's a real gamble, never a guaranteed KO-and-heal.
- Whether a refused mon is gone for that encounter only or that *instance* permanently (recommend: gone for the encounter; it can respawn).
- Path-1 window durations and the rarity × quality catch-rate bands.

## Sequencing

- **Design: locked now** (this doc).
- **Build: Phase 6** (with evolution). Catching is the system the demo's hard-starter path is waiting on — it's what makes "prepare for the gym" (catch a GALE counter before Falkner) real, fulfilling "preparation is gameplay."
- Until built: the placeholder catch stands; the hard-starter (GRUBLEAF) path into Falkner has no prep tool yet.
