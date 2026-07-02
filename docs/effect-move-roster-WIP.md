# Effect-Move Roster (WIP) — the 29 built technique moves (2/type planned; tempo cut)

**Status:** DESIGN IN PROGRESS. The TECHNIQUE-pool moves delivering the locked statuses (`combat-depth-types-status.md`) under the framework (`effect-move-framework-additions.md`). Naming law: 1-2 words ALL CAPS, status-readable, distinct from the 43 damage names. Potency→tier. All carry chip damage unless pure self-buff. Drop in `docs/` when the roster's complete.

## SAMPLE (5 types — established the patterns)
- **SPARK:** STATIC HAZE (Daze, T0-1) · THUNDERCLAP (Sap Focus — foe loses ★/can't gain 2rds, T1-2, read-win)
- **PSI:** MIND SNARE (Inception — force-repeat-stance, T1) · FALSE ECHO (Echo — force-repeat-Call, T1-2)
- **UMBRA:** CREEPING DOUBT (Doubt — Calls cost more ★, T1) · DEAD SILENCE (Silence — mon can't hear Calls, T2, read-win)
- **STONE:** SET STANCE (Brace-buff = poker tell-for-power, T0-1, Buff) · SECOND WIND (gain 1★, T1-2, Buff, maybe bond-gated)
- **FLAME:** SEAR (Burn — HP DoT 2-3rds, T0-1) · KINDLE (Attunement — next Call cheaper, T1, Buff)

## BATCH 1 (control & resource — FINAL)
- **FROST:** FROST BIND (Frozen — stance-lock 1-2rds, T2, read-win) · GLASS EDGE (self-buff: next attack hits harder but more exposed — the FROST best-offense/worst-defense identity, T1, Buff)
- **BRAWN:** CHALLENGE (Taunt — force foe Aggressive 1rd + Daze, T1) · WARCRY (Call Lock — foe can't spend ★ on Calls 1-2rds, T2, read-win)
- **VENOM:** TOXIC SAP (Drained — stamina-bleed 2-3rds, T1) · CORRODE (foe's next technique costs more/fizzles — anti-utility, T1-2)
- **TERRA:** tempo pair (UPHEAVAL/TREMOR) **CUT** — TERRA's techniques are TBD (see below).

## TEMPO — **CUT** (2026-07-02, `9b7c83d`)
Tempo was NARROW (KO-race only — in the simultaneous triangle, order only affects who strikes first when both could be lethal, not the triangle outcome). Per Mathias's standing caveat ("if the narrow version can't work without touching the triangle → CUT tempo entirely"), it was **CUT** — the TERRA tempo pair (UPHEAVAL/TREMOR) is gone, no design hole (the read-war carries the depth). Recorded for history; nothing to build.
(Historical: FROST's original weak tempo move Cold Snap was cut earlier for the same thinness → replaced with GLASS EDGE.)

## Momentum/Call-economy effects — placement so far
Sap Focus→SPARK, Silence→UMBRA, Echo→PSI, Second Wind→STONE, Attunement→FLAME, Call Lock→BRAWN, Amplify→INSECT (batch 2). The core economy is touched by many types (good spread). (tempo→TERRA was here — CUT, see above.)

## STILL TO DESIGN (batch 2+)
- INSECT (Sap + Amplify/SWARM), GALE, AQUA, NATURE, BASIC, SPIRIT, DRAKE, FORGE.
- (INSECT was drafted: LEECH BITE (Sap, T1) · SWARM (Amplify — double-★-next-read, T2, Buff, ⚠️snowball-risk sim-gate hard) — confirm in batch 2.)

---

# KEY REFRAME — statuses are a SHARED VOCABULARY, not type-exclusive (Mathias)

Earlier framing (1 type = 1 status, 1:1) was OVER-CONSTRAINED. Correct model:
- There's a shared VOCABULARY of effects (Daze, Burn, heal, stamina-drain, the momentum/Call-economy ones, etc.). [tempo was in this pool — CUT.]
- Each type has a SIGNATURE anchor (its locked status from combat-depth-types-status.md) — but that's a thematic anchor, NOT an exclusivity rule.
- A status can be delivered by MULTIPLE types (Daze on SPARK AND GALE; healing on AQUA AND GALE). A type's 2 technique slots can MIX from the shared pool as fits its character.
- Richer + less one-trick + better coverage (several types can answer the same need). Mirrors how Pokémon actually distributes effects.

# BATCH 2 (FINAL — with Mathias's calls)
- **INSECT:** LEECH BITE (Sap — burst stamina-drain, T1) · SWARM (Amplify — double-★-next-read, T2, Buff, ⚠️snowball sim-gate hard)
- **SPIRIT:** VEIL (Shrouded — hide own tell 2-3rds, T1, Buff) · WANE (Cleanse — clear one debuff, T1, Buff). [Defensive/evasive identity — both self-buffs.]
- **DRAKE:** DREAD GAZE (Daunt — foe can't enter Aggressive 1-2rds, T2, read-win) · PRIMAL ROAR (gain ★ + presence, T2, Buff). [Apex — both Tier 2.]
- **GALE:** UPDRAFT (momentum-PERCEPTION buff — act as if +1★ for TIER-ACCESS this turn, WITHOUT real ★; distinct from Second Wind; very GALE/mobility, T1, Buff) · WING FLARE (Daze — buffet scrambles focus; Daze drawn from shared pool, T1, Debuff)
- **AQUA:** TIDE MEND (Recover — move-property self-heal, T1, Buff) · UNDERTOW (2nd sustain/defensive — AQUA counter-tank; heal-over-time or Drained-debuff, T1). [Healer anchor.]
- **NATURE:** SIPHON (Drain — move-property damage+heal lifesteal, T1) · ENTANGLE (open — 2nd sustain, or root, or an evasive buff fitting NATURE "Dodger", T1). [Healer/lifesteal anchor.]
- **BASIC:** FOCUS UP (generic self-buff, T0-1, Buff) · STEADY (generic minor Cleanse, T0-1, Buff). ["Basic stays basic" — plain universal utility, no flavor-pretension.]
- **FORGE:** BULWARK (take 25% less damage 2-3 turns, T1, Buff) · REFORGE (self-Cleanse + minor heal, OR 2nd defensive buff, T1-2, Buff). [Fortress — both defensive self-buffs.]

## GALE's UPDRAFT — note the distinction (it's a NEW economy effect)
"Act as if +1★ for tier-access" = a temporary TIER-UNLOCK without real momentum. Distinct from:
- Second Wind (gain a REAL ★), 
- the behind-penalty (damage scaling),
- the phased-unlock gate (UPDRAFT lets you reach one tier higher than your real ★ this turn).
A new momentum-economy lever — sim-gate (could be strong: cheap tier-jump). Fits GALE mobility/speed identity.

## Still-open small bits (low-stakes, can finalize at wiring)
- AQUA UNDERTOW exact effect (HoT vs Drained-debuff).
- NATURE ENTANGLE exact effect (sustain vs root vs dodge-buff).
- FORGE REFORGE exact (Cleanse+heal vs 2nd buff).
- Whether INSECT SWARM/Amplify needs bond-gating or higher tier (snowball).
These are tuning-level; the anchors are set.

## ROSTER STATUS: all 17 types have 2 techniques drafted (5 sample + 4 batch1 + 8 batch2). Ready for a consolidation pass + the wiring brief.
