# Status Engine — Build Scope (Increment 1: the scaffolding)

**Status:** SCOPE for the FIRST combat-enrichment build increment. The plumbing that statuses/effect-moves/momentum-reshape all plug into — built in ISOLATION, no specific effects wired yet. Sim-gated. Drop in `docs/`, then CC builds against it.

## Why this first
Per the combat-engine map (`combat-engine-extensibility-map.md`), the status system is DESIGN-complete (`combat-depth-types-status.md`) but ENGINE-absent. This increment builds the engine SCAFFOLDING — the state, schema, events, constants — WITHOUT yet wiring specific statuses or effect moves. It unblocks everything downstream and is testable on its own (no balance change yet → minimal sim risk). Effect-move design (the creative work) then plugs INTO a working engine.

## What this increment BUILDS (the gaps B identified)

### 1. `SideState` status field (types.ts:90)
Add status state to `SideState` (currently only hp/st/exhausted/staggered/momentum/focus/jumpstartArmed). Needs to carry:
- The active DEBUFF (one at a time — per the locked "1 debuff" rule) + its remaining duration.
- Active BUFFS (multiple, stacking — per "buffs stack") + their durations.
- Per the design: a debuff has {kind, duration}; buffs are a list of {kind, duration}. (Diminishing-returns tracking — the 3→2→1→resists fade — may need a per-status application-count too; see status doc lever 2.)
- Design toward the reserved schema (dexLoader `statusTendencies?` etc.) but those stay inert this increment.

### 2. `Move` effect field (types.ts:70)
Extend `Move` (currently {name, tier, type}) with an optional effect descriptor — what status/buff a move applies, on what condition (read-win), and its reduced-damage property (effect moves deal reduced damage + apply on read-win). Keep it OPTIONAL so the 43 existing damage moves are unaffected (no effect field = pure damage, as today). Bit-identical for existing moves.

### 3. Status `BattleEvent`s (events.ts)
Add events for the status lifecycle: apply / tick (duration decrement + DoT) / clear / break / resist (diminishing-returns rejection). So the battle log + replay can narrate statuses (per the locked display: 3-letter tags + battle-log sentences). No status exists to fire these yet this increment — the events are the channel.

### 4. Resolve `CallKind` (the bond-gated status defense)
Add `resolve` to the CallKind set (currently getAway/hangInThere/recover/dodge). Resolve = the locked counterplay: clears status + brief immunity, bond-gated (unlocks at bond Stage 4). This increment adds the KIND + its plumbing; the bond-gating + effect can be stubbed/minimal until the status system it defends against exists.

### 5. Status constants (config.ts)
The tunable numbers: base durations (2-3 rounds, Taunt=1), diminishing-returns curve (3→2→1→resists), effect-move reduced-damage factor, application costs. Centralized so they're sim-tunable. Values are PLACEHOLDERS this increment (real tuning comes with the effect moves + sim).

## What this increment does NOT do (explicitly OUT of scope)
- NO specific statuses wired (no Burn, Daze, Silence, Sap Focus, etc. — those come with the effect moves).
- NO effect moves named/added (the ~34 — separate design + build).
- NO two-pool move model (separate increment — reshapes learnsets + UI).
- NO momentum-economy reshape (phased-unlock/behind-penalty — separate increment).
- NO terrain/environment (deferred Phase 8).
- The Resolve effect + bond-gating can be minimal/stubbed (nothing to defend against yet).
This is PLUMBING ONLY — the state, schema, events, constants. Effects plug in later.

## Sim gate (critical)
- B's map: status changes combat math → ladder re-validation. BUT this increment wires NO active status, so the scaffolding SHOULD be bit-identical (the new fields are inert/unused until effects are added). 
- **Required:** confirm the existing suite stays green + the sim is bit-identical (the new optional fields don't change any existing move/round resolution). If it's NOT bit-identical, something's wrong (the scaffolding leaked into live resolution) — STOP and report.
- This is the value of scaffolding-first: it's the one increment that SHOULD be bit-identical, so it's the safe foundation.

## Constraints for CC
- EXISTING systems only — extend SideState/Move/events/config; do not restructure resolveRound's logic.
- Optional fields — the 43 damage moves + current resolution UNCHANGED (no effect field = behaves exactly as today).
- Bit-identical REQUIRED (no active status yet → no math change). Re-baseline only if proven necessary (it shouldn't be).
- One Terminal A task. Suite green. No git add -A.
- This is scaffolding — resist wiring any actual status/effect (that's the next increment, against this foundation).

## After this increment
With the engine scaffolding in place + bit-identical, the next steps (separate, each scoped + sim-gated):
1. Design the effect-move sample (name/spec the ~34, assign to types) — CREATIVE design work.
2. Wire specific statuses + effect moves INTO the scaffolding (sim-gated — now math changes).
3. The two-pool move model (learnsets + UI).
4. The momentum-economy reshape (phased-unlock, behind-penalty, hold-vs-spend).
