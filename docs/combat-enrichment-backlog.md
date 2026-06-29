# Combat Enrichment — Backlog (banked, NOT started)

**Status:** BANKED for after the Tiled-CC sprint closes (Phase 8: importer ✅, wiring ✅, collision 🔨, Route 31 migration ⬜). Do NOT start these until Phase 8 is capped. Each is a design-then-build lane; design happens with Mathias + coordinator, sim-gated where it touches balance. Drop in `docs/`.

**Ordering note:** these are combat/systems lanes that come AFTER the Tiled sprint and likely interleave with status-effects implementation. Sequence TBD when we get there — this doc just ensures nothing is lost.

---

## 1. Status effects — SCOPED, ready to review→implement
Already designed earlier (see `combat-depth-types-status.md` and the reserved `statusTendencies?` / `dexLoader.ts` stub). The plan: review the existing scope, then implement.
- **Gates:** unblocks **Shake It Off** (the locked Call — clear-status), the reserved `statusTendencies` trainer field, and the **Resolve** ceiling-breaker.
- **Approach:** review the scoped design first (it exists), then build — engine work, sim-gated (status effects change combat math; the reader-bot/ladders must be re-validated).
- **First step when we get there:** re-read the existing status scope doc, confirm it's still right, then a build brief.

## 2. Move/attack mapping — the full move pool (NOT started, needs design)
Argent needs a **complete catalog of moves/attacks and what each does** — like real Pokémon, where moves have varied effects (some inflict status, some buff/debuff, some have special mechanics, not just damage).
- **The work:** map out ALL the moves — for each: damage profile, type, and **effect** (inflicts a status? buffs? debuffs? special interaction with the read-war / stances / Focus?). Some moves → status effects (so this interlocks with lane 1). Others → other effects.
- **Design questions to resolve:** how many moves? how do move-effects interact with the stance/triangle/Focus combat model? which moves carry status (ties to lane 1)? how do moves map to the archetype system (Wall/Dodger/Glass-nuke etc. from the trainer catalog)?
- **Connects to:** lane 1 (status-carrying moves), lane 3 (which moves unlock progressively), the mon/dex design, the trainer archetype catalog.
- **A design session, then a build.** This is foundational for combat depth — currently moves are likely a small/placeholder set.

## 3. Progressive in-encounter attack unlock + PLAYSTYLES (NOT started, needs design — the rich one)
The idea: instead of bringing all 4 attacks available from the start of a battle, **unlock your 4 attacks progressively DURING each encounter** by playing well. AND — the bigger vision — **create distinct playstyles**:
- One playstyle plays to **unlock attacks** (progressive access rewards good play → more options)
- Another plays for **Calls** (the ★/momentum economy — heal/evade/burst)
- Another plays for **heavy attacks** (aggression/burst focus)
- etc.
- **The vision:** different *ways to win* / build identities, so the read-war has strategic diversity (not one optimal line). This is a genuine depth/replayability lever.
- **Design questions:** what gates each attack's unlock in-encounter (reads won? momentum? a resource)? does it reset per fight? how do the playstyles differ mechanically — are they player *choices*, mon *archetypes*, or build *paths*? how does this interact with the Call economy (lane) and the bond-gated toolkit? Does "play for attacks" vs "play for Calls" create real, balanced divergence (no dominant line)?
- **⚠️ Heavy combat-design + sim-gating** — this reshapes the core combat loop and MUST be sim-validated (does a playstyle dominate? is the divergence real?). The biggest/richest of these lanes.
- **Connects to:** lane 2 (which attacks unlock), the Call economy, bond-gated moves (`bond-track-v2`), the momentum/★ system, the archetype catalog.
- **A major design session, then careful sim-gated build.**

## 4. Speed / initiative — FINE AS-IS for now (banked, low priority)
The current speed logic (Fluid acts first; evasion emergent from SPEED; no discrete dodge stat — per `combat-focus-redesign.md`) is **acceptable to Mathias as-is.** Banked only in case it wants revisiting later (connects to `combat-initiative-modifier-BACKLOG.md`). NOT a priority — explicitly fine for now.

---

## Cross-lane connections (why these interlock)
- **Status effects (1)** ↔ **move mapping (2):** status-carrying moves can't be finalized until both the status system AND the move catalog exist. Likely build status first (the system), then map moves (some of which use it).
- **Move mapping (2)** ↔ **progressive unlock (3):** which moves unlock progressively depends on having the move catalog.
- **Progressive unlock + playstyles (3)** ↔ **Call economy** (shipped) ↔ **bond-gated moves** (`bond-track-v2`): the playstyles ("play for attacks" vs "play for Calls" vs "heavy attacks") span all the combat resource systems — designing them means looking at the whole combat economy together.
- So a likely sequence when we get there: **status effects (review→build) → move catalog (design→build) → progressive-unlock/playstyles (design→sim-gated build)** — but TBD; decide when the Tiled sprint closes.

## Banked combat lanes from earlier (still open, see also call-effects-design.md)
- Call cooldown/throttle (prevent Recover spam) — likely needed once playstyles/heavy-Call use is real
- Dodge counter-window (distinguish from Get Away's graze)
- Unevadable attacks (counterplay to full-evade)
- A Call-using sim archetype (to actually measure Call balance — current sim only proves isolation)
- Trainer-profile retune for cap-3 momentum-hoarding (when it surfaces in playtest)

---

## Documentation discipline (reminder)
Per the established pattern: **produce/commit a design doc for each lane at design time** (Claude Chat authors the .md; CC commits it). This is what made the context-clear safe — state lives in committed docs, not chat context. Every lane above gets its own design doc when we engage it, before the build.
