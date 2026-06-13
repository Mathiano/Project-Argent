# Consolidation sprint — clean base before 6v6

Short hardening sprint BEFORE the 6v6 refactor. No new features. Lower-risk keystone so the foundation sprint has solid ground.

1. **Fix the TRAITS mutable-global pattern** (the smell flagged in the audit): traits become injected/registered data like the type chart, not a mutated global. `main.ts` and `falknerLadder.ts` stop mutating a shared `TRAITS` object. Same for `MOVES`/`SPECIES` if they share the pattern — registries, not mutated globals. **Constraint: fixture ladder AND Falkner ladder both stay bit-identical** (this is a refactor, not a behavior change). New tests proving the registry path.

2. **Wire `BossCard.statScale`:** Falkner's HP×1.15 must come from the card data, not manual application in `main.ts`. Delete the manual path. If `statScale` can't cleanly express it, report why instead of hacking. Ladder stays bit-identical.

3. **Spec sync** — patch `combat-2-0-spec.md` to v0.3.4: document the real `BattleState` shape (`bossCard`, `breakProgress`, `phase`, `rhythmAnchor`), the Break-bar mechanic, the arena-rhythm schedule, and GUSTBORNE as shipped. Docs must match code; flag any remaining drift you find.

4. **Add the 18 LOC of high-leverage tests** recommended in the audit: overworld pure functions (8), `auditBatch` (4), `validateAction` throw paths (6).

## Acceptance
Both ladders bit-identical, all new + existing tests green, CI green, spec matches code, no mutable-global trait pattern remains. Report: confirm bit-identical ladders and the new test count. Then the 6v6 kickoff issues against the cleaned base.

Also commit `docs/silver-parity-checklist.md` (re-uploaded) as a design-authority reference — do not build from it this sprint.
