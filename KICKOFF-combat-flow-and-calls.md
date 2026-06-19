# KICKOFF — Combat flow, ★ economy, Call legibility

Playtest fixes, by priority.

## BUG 1 (PRIORITY) — ★/momentum carries over between battles (exploitable)
SYMPTOM: ★ persists battle-to-battle → farm ★ on easy trainers, bank it,
dump on a hard fight. Breaks the economy — ★ is meant to be earned-and-spent
WITHIN one fight, not stockpiled across the route.
FIX: ★ RESETS TO ZERO at the start of every battle (wild + trainer). Same as
the ST fix: ST and ★ are PER-BATTLE (reset each fight); HP + bond are JOURNEY
resources (persist). The Tier-I jumpstart's free-★-on-first-read-win still
applies fresh each battle (a per-battle perk, not carryover).
Test: ★ starts at 0 each battle; reads build it; it does not carry over.

## FLOW 1 — post-battle NPC dialogue AUTO-STARTS
SYMPTOM: after a trainer/robber fight the player must manually walk up and
talk to get important info → missable.
FIX: post-battle dialogue auto-triggers the moment a forced/story battle
ends (like Pokémon). Robber + story/gym trainers auto-start their follow-up.
Optional trainers may stay tap-to-talk; story-critical ones must auto-start.

## LEGIBILITY 1 — explain when/why Calls unlock
SYMPTOM: Calls unlock at bond stage 2 (Warming) but nothing explains it.
FIX: at the Warming crossing, a message tying the power to the bond moment:
"Your bond has deepened — you can now CALL to [MON]! (Recover Breath
unlocked)." Fold into the bond-stage-cross beat. (Robber may also mention
Calls exist — optional onboarding.)

## LEGIBILITY 2 — bond-deepened message names the mon
SYMPTOM: "Your bond deepened — Wary → Warming" doesn't say WHICH mon.
FIX: name it: "[MON] — Wary → Warming".

## PRESENTATION 1 (meaty) — combat text flow is janky
SYMPTOM: text advance is inconsistent — sometimes one press skips the whole
round, sometimes three presses. Target: flowing text like modern Pokémon.
FIX: a proper text model:
- Text STREAMS at a readable pace (progressive reveal), not instant dumps.
- ONE press skips to the end of the CURRENT message (reveals it fully).
- The NEXT press advances to the next message.
- Consistent EVERY time; one message at a time; predictable advance.
- Log messages queue + present one-at-a-time at a consistent rhythm.
Foundational — every fight runs through this. Match Gen 4+ feel.

## REPORT
1. ★ resets per-battle (no carryover) — tested.
2. Post-battle NPC dialogue auto-starts (robber + story trainers).
3. Call-unlock explained (tied to the bond moment); bond message names the mon.
4. Battle text flows consistently (stream + one-press-per-message). Describe
   the model.
Sim-gate: the ★-reset is state-init, not math — run ladders to confirm
bit-identical. Existing tests green.
