# THE 6v6 keystone refactor

1v1 → 1–6v1–6 team battles. Architecture audit sized this (~800 LOC across types/state/resolveRound/bossAI + 3 sim + 2 game); this kickoff follows that scoping.

## Design rulings baked in
- **Variable team size 1–6 per side** (NOT fixed 6). Boss cards carry `teamSize`; wild battles are 1v1; the authentic curve is Falkner 2 → late Johto ~5 → Champion 6. The engine must not assume 6.
- **Switching is a turn action** (costs the turn). The KO-stamina memo's rule applies: when a mon faints mid-round, the surviving side's settle still resolves; the fainted side forfeits its remaining action.
- A faint opens a **forced switch** (free, not the turn action) for the team that lost the mon, unless they're out of mons (→ battle ends).

## Part A — engine (the careful part)
A1. **BattleState:** each side becomes a team (active index + bench of `SideState`). Preserve the EXACT single-mon code path as the `teamSize-1` case so the 15-cell fixture ladder stays bit-identical. THIS IS THE CRITICAL CONSTRAINT — the audit flagged that team construction may reshape RNG ordering; the 1v1 path must produce identical RNG draws. Prove it before anything else.
A2. **resolveRound:** add switch as an action type; handle faint → forced switch → battle-end. Initiative/stamina/clash math UNCHANGED for the active pair.
A3. **Switch events** for the renderer (`switchOut` / `switchIn` / `faint` / `forcedSwitch`).
A4. **bossAI:** boss switching policy (start minimal — switch only on a hard type disadvantage; Falkner's 2-mon team barely uses it, which is fine — this is infrastructure for later gyms).

## Part B — sim
B1. **RE-BASELINE GATE:** run the 15-cell rival ladder AND Falkner ladder on the new team-capable engine at `teamSize 1`. They MUST be bit-identical to the locks. If they are not, STOP and report the diff — do not re-lock new numbers without review. This is the whole-project regression canary.
B2. Add one multi-mon sim case: a 2v2 to exercise switch/faint/forced-switch paths deterministically. New regression with fixed seed.

## Part C — game
C1. Battle scene renders switching: party state, switch menu (PKMN), the forced-switch-on-faint prompt, faint animation.
C2. Falkner becomes a real 2-mon fight (FLITPECK lead → GALEHAWK ace) per the boss card, replacing the GALEHAWK-only slice.
C3. Trainer fights and starter battles support teams from data.

## Acceptance
2v2 sim deterministic + locked; BOTH ladders bit-identical at teamSize 1 (report this explicitly — it's the gate); Falkner fights as 2 mons end-to-end; all tests green; CI green; push.

Report: the bit-identical confirmation FIRST, then switch screenshots, then any ambiguities flagged-not-invented.
