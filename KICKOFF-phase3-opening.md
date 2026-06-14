# Phase 3 — The Opening (intro + context)

Per `BUILD-ROADMAP.md` Phase 3. Built from `docs/opening-design.md`.

**Gate:** a new player understands who they are, where they are, and why they're leaving — without us explaining it.

## Constraints (stay disciplined)
- NO new engine systems. Built entirely on existing verbs: dialog, script, flag, warp, interactable, npc, auto-trigger.
- NO combat changes, NO save changes (Phase 2 covers persistence — but the intro must set correct initial save state on New Game).
- Placeholder art only (furniture as OBJECTS matters, not their art).
- Placeholder names: ⟨Larch⟩ professor, ⟨Hearthwick⟩ town — working names, flagged for the rename pass. KAMON is locked.

## Scope (the six beats from the design doc)

### S1 — Furnished interiors
Player bedroom + house. Furniture as collidable/interactable objects (bed, desk, TV, table, plants). The desk holds the letter from Prof ⟨Larch⟩ (Beat 1 hook). A parent NPC downstairs with the wistful goodbye lines (Beat 2).

### S2 — ⟨Hearthwick⟩ town map
Small: a few houses + the lab + 2-3 NPCs. Warp south to the EXISTING Route 31. One NPC line plants "trainers are rare now" (Beat 3).

### S3 — Lab interior
Starter-choice ceremony RE-HOMED here with context (Beat 4): Prof ⟨Larch⟩'s inheritance framing, then the existing starter pick (KINDRAKE/GRUBLEAF/SILTSKIP, scout hints). His thesis line lands here: *"Strength fades. The bond is what lasts."*

### S4 — KAMON theft scene
Auto-trigger script + flag (Beat 5). He takes the counter-type starter, states his strength-over-bonds belief. The theft is the new beat; the rival FIGHT stays where it is for now (KAMON v2 fight-tuning is a separate queued task — do not rebalance here).

### S5 — The push out
⟨Larch⟩ gives a reason to head south (a delivery/errand to the next town) routing onto Route 31 (Beat 6). Hand-off connects intro → existing content.

### S6 — Wire New Game → intro
New Game starts in the bedroom with correct initial save state (empty party until the lab, position = bedroom, flags clean). Continue still resumes from save (Phase 2 unchanged). All beats flag-gated so they fire ONCE.

## Playtest hooks (the contract)
Add `?skip=intro` (jump to bedroom start) and keep all existing hooks working. `?skip=overworld` still drops to Route 31 for combat testing without replaying the intro. Update `docs/playtest-hooks.md`.

## Gate (Phase 3 done when)
- Cold New Game → bedroom → letter → furnished house → parent → town → lab → starter-in-context → KAMON theft → pushed south → arrive Route 31.
- A playtester reaching Route 31 can answer "who am I, where am I, why am I out here?" unaided.
- All existing tests green; both ladders bit-identical (engine untouched); CI green.

## Report as audit
Feel sign-off is Mathias playing the cold New Game intro start-to-finish.
