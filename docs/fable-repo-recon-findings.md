# Fable's repo reconnaissance — dormant assets + corrected build-state map (roadmap enrichment)
Source: Fable independent repo audit. NOTE: Fable audited an OLD snapshot (~9b7c83d/b7ecbe8, 891 pass) — BEFORE this session's battle-UI rebuild + Q2 + stamina. So its "all pending resolved / all green" is STALE re: current work (we're at 2fe6487, 893 pass, + stamina in flight). Its VALUE is the dormant-asset + build-state reconnaissance below (which doesn't depend on latest commits).

## Corrected build-state map (things MORE built than our notes assumed)
- **Bond core is LIVE** (not "unbuilt/pull-forward"): stages, quality-only growth, Warming Call-gate, jumpstart (B5), bond bar drawn in battle. REMAINING: tiers III–V effects (per-mon ★ cap, Call discount, 2nd slot) + Track A bond-gated moves.
- **Catching willing-join is BUILT**: badges × rarity × bond formula, tested; catchOrigin reserved + save-validated. REMAINING: Steady Throw (★ spend), crafted bands, wild Break bars (the "broken" window exists but nothing SETS it).
- **Evolution is BUILT** (evolution.ts + tests — already known/verified this session).
- **Intent tells PARTIALLY built**: degradeIntent reliability ramp + verb tells ("braces") live. REMAINING: flavored body-language vocabulary + species variants (the richness layer).
- **Profiled trainers DO cast techniques** (rate-capped, buffs from Guard); bespoke bosses (Falkner) don't. So "leader-signature-technique" play is still valid for gyms 2–8.
- **KAMON 0.85 hesitation factor is LIVE** (KAMON_BOND_FACTOR=0.85, seeded in lab dialogue "the SILTSKIP hesitates") — but NOT legible during the actual rival battle.
- **Break bar is a generic knob** (bossCard.breakBar) — extending to any boss/wild is pure data; wild-side version unbuilt.
- Shake It Off blocker is STALE: clearDebuff() is live (Wave C cleanse uses it), resolve in CallKind. Shake It Off is BUILDABLE TODAY (S-effort). (Hang In There survive-at-1HP marked RETIRED.)

## Dormant assets (built, unused — sleeping potential)
- **The EVENT STREAM = the biggest sleeping asset**: 30+ event kinds (clash/strike/counter/status lifecycle…), fully replayable, NO consumer beyond the battle/dev log. Could power: replays, a Daily Puzzle mode, a dex-journal.
- **statusTendencies** — reserved-inert (dex field, for SCAN).
- **Wild Card mons** — banked (low-bond mons ignore Calls — very on-thesis).
- **Call expansion** — already live in a Fable chat ("Read Them!" fills the no-Call-touches-the-read-war gap).

## Enrichment candidates (roadmap slot-ins, NOT now — stamina is in flight)
- Event-stream consumers (replays / Daily Puzzle / dex-journal) — biggest sleeping asset
- Shake It Off (now trivial — clearDebuff live)
- Wild Break bars — close the catch loop (generic breakBar knob → wild encounters; the "broken" catch window exists but nothing sets it)
- In-battle KAMON hesitation tell — surface the live-but-invisible 0.85 factor during rival fights
- Tells vocabulary upgrade (flavored body-language + species variants)
- The attack/technique EXPLAINER — 29 effects need a legibility home (roadmap's open question)
