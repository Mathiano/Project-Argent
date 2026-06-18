# KICKOFF — Bond System Core

Build the BOND system core — the keystone everything cantilevers off.
Build to `docs/bond-track-v2.md` + `docs/bond-growth-refinement.md` (the
refinement REVISES the growth model — follow it where it supersedes).

**Scope = CORE + GROWTH + VISIBLE METER** (prove the growth FEELS right
first); defer the deep combat-unlocks. SIM-GATE the anti-grind firewall +
the ≤3% ladder gate.

## WHAT TO BUILD (core)

**B1 — Bond as real horizontal persisted state** (replace the interim number):
per-mon bond, persisted (save infra + the partyBond/boxBond pattern),
travels through box like origin/catchOrigin. HORIZONTAL — NEVER touches
HP/ATK/DFN/SPD (absolute rule).

**B2 — THE GROWTH MODEL — CHALLENGE-scaled, renewable forever** (per
`bond-growth-refinement.md`, which REVISES bond-track-v2 here):
- Bond XP scales with how much a fight CHALLENGED THIS MON (foe
  strength/level RELATIVE to the mon; trainer fights weighted above wilds;
  read-wins under pressure; clutch moments; boss clears = big bonus;
  Calls landed).
- Real trainer battle / fight near the mon's level → MEANINGFUL bond.
  (Route + city trainers MUST matter — this is the core loop.)
- Trivial farming (weak/under-leveled foes, repetition) → NEAR-ZERO.
  (Anti-grind firewall: the line is CHALLENGE-vs-TRIVIALITY, NOT
  boss-vs-everything.)
- A new/under-leveled mon earns bond from appropriate opposition (fights
  near ITS level) — so bond-fuel is RENEWABLE for any mon, any time,
  FOREVER. (Late mons can always catch up by actually fighting.)
- Hook bond-XP to the existing event stream (gameEvents bus +
  read-resolution): hit-landed-with-effectiveness / ko / boss-defeat /
  trainer-defeat / catch-origin, CHALLENGE-WEIGHTED.

**B3 — THE TIER CURVE** (Familiar→Bonded per the doc table), thresholds
that WIDEN with tier (easy early, earned late — as a CURVE, not a hard
split): early tiers fill fast (a favored mon visibly grows close quickly);
late tiers need sustained real challenge.

**B4 — THE VISIBLE METER** (so the player FEELS it — make-or-break):
a legible bond readout (current tier + sense of progress) on the party/mon
screen (+ a subtle in-battle cue if cheap). The player must SEE a favored
mon growing closer. Show the RELATIONSHIP deepening, not a grindy XP bar.

**B5 — ONE bond effect wired end-to-end** (proof-of-life, the gentle early
one): Tier I "Familiar" → first read-win each battle grants ★ free (the
jumpstart). Smallest real PAYOFF so bond visibly DOES something. (The deep
unlocks — ★ cap raises, 2nd Call slot, Resolve/status-clear, bond-gated
signature moves — are the DEFERRED follow-up.)

## SCHEMA RESERVATION
Reserve a `bondTier` field alongside `level` in the dex learnset schema
(for bond-gated moves later — don't wire them now). Schema-ready only.

## MAX-BOND IS HORIZONTAL (the held line — encode it)
Bond NEVER grants stats, at ANY tier. Max-bond's reward is a TRANSFORMED
TACTICAL TOOLKIT (2nd Call, Resolve, signature move — the deferred
follow-up), never numbers. Thesis-critical (bonds-over-STRENGTH). No
stat-bump path anywhere in the bond code.

## SIM-GATE (critical validation)
- **ANTI-GRIND PROOF:** sim a farming run (spam weak/under-leveled
  encounters) vs a well-played run (real fights near-level + trainers) —
  confirm farming yields NEAR-ZERO bond while quality play progresses.
  Report the curve. The firewall must demonstrably hold.
- **RENEWABLE PROOF:** sim a fresh under-leveled mon fighting appropriate
  opposition — confirm it earns meaningful bond (the fuel is renewable,
  not finite/behind-you). Report.
- **≤3% LADDER GATE:** bond's combat effect (the Tier-I ★-jumpstart)
  shifts the archetype ladder ≤3%. Run both ladders; report the shift.
  (It's a read-economy nudge, not a stat change — should be small.)
- Confirm bond is ADDITIVE; engine math untouched; ladders move only by
  the intended ★-nudge, within 3%.

## DEFERRED (follow-up, NOT now)
Full Call-economy deepening (★ cap 2→3, 2nd Call slot, signature-Call
discount); Resolve/status-clear (needs status system); bond-gated
signature/coverage moves (needs bondTier wiring + the moves).

## THE GATE
Bond is real horizontal persisted state; grows CHALLENGE-scaled (trainers
+ near-level fights matter, farming → near-zero, new mons have a renewable
path — all proven in sim); tiers progress on a widening curve; the player
SEES/feels a mon growing closer; the Tier-I ★-jumpstart fires end-to-end;
max-bond grants NO stats anywhere; ≤3% ladder gate holds; bond additive
(engine untouched). Existing tests green. Tests: bond grows on a real
trainer/near-level fight; NEAR-ZERO on farmed weak foes (firewall); a
fresh under-leveled mon earns meaningful bond (renewable); bond persists +
travels through box; tier thresholds widen; the ★-jumpstart fires; no code
path grants stats from bond; ladder shift ≤3%.

## FEEL SIGN-OFF (Mathias)
Play the route, win real fights (trainers, near-level wilds), and confirm
bond grows in a way that feels EARNED and VISIBLE (a favored mon getting
closer) — AND that you can't cheese it by farming weaklings — AND that a
freshly-caught mon can grow bond by just fighting real opposition with it.
The make-or-break feel-test: does bond feel like a relationship deepening,
or a bar filling?

Report as audit + the anti-grind curve + the renewable-fuel proof + the
ladder-shift number.
