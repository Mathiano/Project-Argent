# Bond Legibility — Design (Lane A)

**Status:** DECIDED. The legibility/UX layer for the *existing, live* bond system — making the player **see and feel** the progression that already runs under the hood. NOT a new progression system (bond is built — see below); this is rendering it. Drop in `docs/`. Cross-ref `bond-track-v2.md` + `bond-growth-refinement.md` (the bond *system* this surfaces), `what-argent-is.md` (the thesis), the B bond-state audit (verified the system is LIVE).

## Why this exists (the T1.1/T1.2 finding)

The design-opportunities pass + an independent review both flagged the same load-bearing risk: **a grind-less 40-hour RPG must make progression LEGIBLE, or it feels unrewarding.** Argent already *answers* progression-without-grind well — bond is the horizontal growth that replaces stat-leveling (`bond-track-v2.md`). The gap was never the *system*; it was that the player can't **see** bond climbing or **feel** the reads that drive it. This doc closes that gap.

## What's already LIVE (verified — do not rebuild)

Per the B bond-state audit (origin/master @ 710fbff):
- **Bond state is wired end-to-end** — per-mon 0–100, 7 named stages (Wary→Warming→Companions→In Sync→Partners in Kind→Kindred→Inseparable), persists per mon through save/box/evolution, grows challenge-scaled from real fights (`awardBondForFight` on every win path), anti-grind firewall intact, sim-gated.
- **`bond-stage-cross` fires from REAL growth** and already drives a post-battle beat scene (`createBondStageScene`). The sound we wired rides a genuine tier-cross.
- **Read-win → ★ momentum is live and already in the battle scene** (`gainMomentum` on every read-win edge; `drawMomentum` renders the ★ meter; a CLASH callout already shows read-wins charging ★).

So all three surfaces below ride **events that already fire**. This is display work, not system work — with one small wiring gap (threading bond into the battle scene).

## The model — ONE loop, the bond bar is the spine

The player experiences a single causal story; the system keeps bond **horizontal (only grows, never drops)**. The unification (decided): **the bond bar IS bond** (the XP-bar-under-the-mon — fills, never drops); **the read-win is the visible spark that feeds it.** One loop to the eye; bond stays the accumulation. There is **NO separate read-accuracy meter** — the consequence of misreading (you lose the exchange) IS the skill feedback; a meter would be redundant and off-tone.

**Crucial reality (from the audit) — bond moves POST-fight, not mid-round:** bond is awarded once, after the battle (`awardBondForFight`). So the bar behaves like **Pokémon XP**: static during combat (shows the mon's current standing), then **advances on the post-fight victory beat**. This is *better* than a live-fill — "an increase in bond is more of an *event*," earned from the whole fight's challenge, not trickled per-round. (Mathias's refinement; resolves the audit's static-bar constraint by embracing it.)

## THE THREE SURFACES (build order)

### ① Bond bar under the mon (the spine — small build)
- **A bar under the player's mon in the combat window** showing current bond standing (stage + progress toward the next stage). Uses the existing pure math (`stageProgress`/`bondStage`/`bondStageName`).
- **Static during the fight** (correct — bond doesn't move mid-round). **Advances on the post-fight beat**, XP-style. Caps visually at 100% within a fight, then advances after (a tier-cross becomes the surface-② event).
- **The one build (a wiring gap):** `bondValue` is NOT currently passed into the battle scene (`battle.ts` gets momentum but never bond). Thread `run.partyBond[i]` into the battle scene's props/render. Small, but it IS a build, not just a draw call.
- Foe bond is **hidden** (consistent with foe ★ being hidden — information discipline).

### ② Tier-up beat (enhance the EXISTING post-fight scene)
- When bond crosses a stage, the **existing** `createBondStageScene` post-battle beat fires (already wired, already plays the `bond-stage-cross` sound). 
- **The work is ENHANCING it**, not building it: make the tier-up feel like a *reward event* — a satisfying visual beat + the "your partner deepened / unlocked [X]" acknowledgment (where an unlock actually happens — e.g. a Call slot at the relevant bond tier).
- **Cannot fire mid-combat** (bond doesn't move mid-round) — it's the post-fight seam. Correct per design (bond-deepening is an event, not a tick).

### ③ Read-win mon-reaction (pure render — cheapest)
- When the player wins a read (the moment ★ is granted), give a **small, satisfying, diegetic reaction** — a "ping," a subtle mon reaction — *beyond* the ★ ticking up. The +1 ★ already shows; this adds a **felt acknowledgment** that the *read* landed (the skill being exercised).
- **Pure rendering on the existing momentum event** — zero engine/state work. The event already fires and is already consumed in `battle.ts`.
- **Tone guard:** subtle and diegetic, NOT a score/grade-card. Argent's register is elegiac; a "GOOD READ! +73%" popup is wrong. A small mon reaction / soft ping is right.

## What this is NOT (scope fence)
- **NOT** a read-accuracy meter (reasoned out — the consequence is the feedback).
- **NOT** a live-filling combat bar (bond moves post-fight; the bar is XP-style).
- **NOT** new bond *system* work (the system is live; this is display + one wiring gap).
- **NOT** the Call effects (that's Lane B — separate, sim-gated combat work).
- Does **NOT** touch combat resolution, the AI, the sim, or bond *growth* math — pure presentation + threading bond into the scene.

## Sim/safety
Lane A is presentation + a read-only thread of existing bond state into the battle scene. It must **not** change combat behavior or perturb any ladder (it displays bond, it doesn't alter it). Bit-identical ladders expected.
