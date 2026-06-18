"""
Argent Combat — Monte Carlo balance analysis.

GOAL: test whether FLUID is a dominant strategy in the base 3-stance system,
and whether adding CHARGE / AMBUSH / FEINT (the enrichment) produces a
healthier strategy distribution (no single dominant option).

METHOD: model the per-round expected payoff of each stance choice against an
opponent's choice, simulate many full battles between AI "policies" (mixes of
stance preferences), and measure (a) which policies win, (b) how often each
stance is the best response, (c) whether one stance dominates.

This is a DESIGN PROBE, not the game engine. The numbers are modeled from the
design intent (Combat 2.0 spec + the enrichment roadmap), to reveal structural
dominance — the SHAPE of the result is what matters, not exact values.
"""

import numpy as np
from itertools import product
from collections import defaultdict

rng = np.random.default_rng(42)

# ---------------------------------------------------------------------------
# THE STANCE TRIANGLE — base payoff model (attacker row vs defender col)
# Values = net advantage to the ACTOR choosing the row stance, when the
# OPPONENT chose the column stance. Positive = good for the row-chooser.
#
# Design intent (Combat 2.0):
#   AGGRESSIVE beats FLUID? No — Aggressive into faster Fluid WHIFFS.
#     Actually: AGG is strong vs GUARD-that-isn't-bracing, but the triangle is:
#   Stance triangle (rock-paper-scissors-ish):
#     AGGRESSIVE  > GUARD/BRACE is FALSE — Guard COUNTERS aggression.
#   Let's use the SPEC's actual triangle:
#     - AGGRESSIVE beats FLUID-that-commits? The spec: aggression punishes passivity.
#     - GUARD (brace) COUNTERS aggression (turns it back).
#     - FLUID dodges/flows around aggression and slips guard.
#
# So the intended triangle:
#     FLUID    beats AGGRESSIVE (dodges the wild swing)        -> but only if faster/read
#     AGGRESSIVE beats GUARD?  NO. Guard counters aggression.
#
# The REAL design (read war): each stance has a counter, BUT the magnitudes
# differ, and FLUID is LOW-VARIANCE (rarely badly punished) which is the
# suspected dominance. We encode:
#   rows/cols index: 0=AGGRESSIVE, 1=FLUID, 2=GUARD(BRACE)
# ---------------------------------------------------------------------------

A, F, G = 0, 1, 2
STANCE_NAMES = {A: "AGGRESSIVE", F: "FLUID", G: "GUARD"}

# Base mean payoff matrix (actor row vs opp col). Modeled from design intent:
#  - AGG vs FLUID: actor LOSES (whiffs vs dodge)            -> negative
#  - AGG vs GUARD: actor LOSES (countered)                  -> negative
#  - AGG vs AGG:   trade, slight edge to nobody             -> ~0 (both hit)
#  - FLUID vs AGG: actor WINS (dodge + slip)                -> positive
#  - FLUID vs GUARD: actor small win (slips guard)          -> small positive
#  - FLUID vs FLUID: neutral poke                           -> ~0 small
#  - GUARD vs AGG: actor WINS (counter)                     -> positive
#  - GUARD vs FLUID: actor LOSES (fluid slips guard)        -> negative
#  - GUARD vs GUARD: stalemate                              -> ~0
BASE_MEAN = np.array([
    # opp:  AGG     FLUID   GUARD
    [       0.0,   -1.0,   -1.2],   # actor AGGRESSIVE
    [       1.2,    0.1,    0.5],   # actor FLUID
    [       1.3,   -0.8,    0.0],   # actor GUARD
])

# VARIANCE per actor stance (how swingy the outcome is).
# Design intent: AGGRESSIVE is HIGH variance, FLUID is LOW variance, GUARD mid.
# THIS is the suspected dominance lever — Fluid's low variance makes it safe.
BASE_STD = np.array([
    [1.6, 1.6, 1.6],   # AGGRESSIVE — high variance everywhere
    [0.5, 0.5, 0.5],   # FLUID      — LOW variance (the safe option)
    [0.9, 0.9, 0.9],   # GUARD      — mid
])

def round_payoff(actor_stance, opp_stance, mean=BASE_MEAN, std=BASE_STD):
    """Net HP-swing to the actor this round (positive = actor gains advantage)."""
    return rng.normal(mean[actor_stance, opp_stance], std[actor_stance, opp_stance])


# ---------------------------------------------------------------------------
# POLICIES — an AI's stance-choice tendency. A policy is a probability
# distribution over [AGG, FLUID, GUARD]. We test a spread of policies to see
# which WIN and whether any single-stance policy dominates.
# ---------------------------------------------------------------------------
POLICIES = {
    "PureAGG":     np.array([1.0, 0.0, 0.0]),
    "PureFLUID":   np.array([0.0, 1.0, 0.0]),
    "PureGUARD":   np.array([0.0, 0.0, 1.0]),
    "FluidHeavy":  np.array([0.15, 0.70, 0.15]),
    "Balanced":    np.array([0.34, 0.33, 0.33]),
    "AggHeavy":    np.array([0.70, 0.15, 0.15]),
    "GuardHeavy":  np.array([0.15, 0.15, 0.70]),
    "AntiFluid":   np.array([0.50, 0.10, 0.40]),  # tries to punish fluid via agg+guard
}

def choose(policy):
    return rng.choice(3, p=policy)

# ---------------------------------------------------------------------------
# A BATTLE: two policies fight. Each starts at HP=100. Each round both choose a
# stance; payoff swings HP. (We model it as each side's stance giving them an
# advantage that damages the OTHER.) First to drop the other to 0 wins.
# ---------------------------------------------------------------------------
def battle(polA, polB, max_rounds=60):
    hpA, hpB = 100.0, 100.0
    for _ in range(max_rounds):
        sA, sB = choose(polA), choose(polB)
        # A's stance vs B's stance -> A's advantage -> damages B
        advA = round_payoff(sA, sB)
        advB = round_payoff(sB, sA)
        # convert advantage to damage (scaled); advantage to actor reduces opp HP
        DMG = 6.0
        hpB -= max(0.0, advA) * DMG * 0.5 + DMG * 0.5  # base chip + advantage
        hpA -= max(0.0, advB) * DMG * 0.5 + DMG * 0.5
        # disadvantage (negative adv) means you took extra (you got punished)
        if advA < 0: hpA -= (-advA) * DMG * 0.5
        if advB < 0: hpB -= (-advB) * DMG * 0.5
        if hpA <= 0 and hpB <= 0:
            return 0.5  # double KO -> draw
        if hpB <= 0: return 1.0
        if hpA <= 0: return 0.0
    # timeout: higher HP wins
    return 1.0 if hpA > hpB else (0.0 if hpB > hpA else 0.5)

def round_robin(policies, n_per_pair=500):
    names = list(policies.keys())
    wins = defaultdict(float)
    games = defaultdict(int)
    for i, na in enumerate(names):
        for nb in names:
            if na == nb: continue
            for _ in range(n_per_pair):
                r = battle(policies[na], policies[nb])
                wins[na] += r
                games[na] += 1
    return {n: wins[n]/games[n] for n in names}

# ---------------------------------------------------------------------------
# BEST-RESPONSE ANALYSIS: for each opponent stance, what's the best stance to
# pick (highest expected payoff)? If one stance is the best response to MANY
# opponent choices AND is rarely punished, it's dominant.
# ---------------------------------------------------------------------------
def best_response_table(mean=BASE_MEAN, std=BASE_STD, n=20000):
    print("\nBEST-RESPONSE & RISK per stance (expected payoff vs each opp stance):")
    print(f"{'actor':<12}{'vs AGG':>10}{'vs FLUID':>10}{'vs GUARD':>10}{'  | mean':>10}{'  downside(p5)':>14}")
    for a in [A, F, G]:
        row = []
        downs = []
        for o in [A, F, G]:
            samples = rng.normal(mean[a,o], std[a,o], n)
            row.append(samples.mean())
            downs.append(np.percentile(samples, 5))
        print(f"{STANCE_NAMES[a]:<12}{row[0]:>10.2f}{row[1]:>10.2f}{row[2]:>10.2f}{np.mean(row):>10.2f}{np.mean(downs):>14.2f}")

# ===========================================================================
# RUN 1: BASE SYSTEM (no enrichment) — is Fluid dominant?
# ===========================================================================
print("="*78)
print("RUN 1 — BASE 3-STANCE SYSTEM (no enrichment), 500 battles/pairing")
print("="*78)
best_response_table()
results_base = round_robin(POLICIES, n_per_pair=500)
print("\nPOLICY WIN-RATES (round-robin vs all other policies):")
for n, w in sorted(results_base.items(), key=lambda x: -x[1]):
    bar = "#" * int(w*40)
    print(f"  {n:<12} {w*100:5.1f}%  {bar}")


# ===========================================================================
# RUN 2: ENRICHED SYSTEM — sharpened AGG variance + CHARGE + AMBUSH + FEINT
# ===========================================================================
# The enrichment adds special ACTIONS layered on the 3 stances. We model them
# as expanded choices with new payoff structure designed to FIX dominance:
#
#  Core stances (rebalanced):
#   - AGGRESSIVE: sharpened — BIGGER reward when unread, still punished when read.
#   - FLUID: nerfed slightly — still safe but lower ceiling (no longer best+safest).
#   - GUARD/BRACE: counters 1-round aggression hard.
#
#  Special actions:
#   - CHARGE (2-round agg): round 1 telegraphs (vulnerable), round 2 releases a
#       HUGE hit that PUSHES THROUGH GUARD. Countered only by FLUID (dodge) or
#       by interrupting. High risk/high reward, creates a 2-round read.
#   - AMBUSH (terrain only): MUTUAL info blackout for a round; ambusher gets
#       initiative on a surprise agg. Fair coin-flip, not a free punish.
#   - FEINT (brace bluff): fake a charge; if opp reacts defensively, punish+daze.
#       Beaten by opp just attacking (the feint wasted your round).
#
# Expanded action set indices:
EA_AGG, EA_FLU, EA_GUA, EA_CHG, EA_AMB, EA_FNT = 0,1,2,3,4,5
EACT = {EA_AGG:"AGG", EA_FLU:"FLUID", EA_GUA:"GUARD", EA_CHG:"CHARGE", EA_AMB:"AMBUSH", EA_FNT:"FEINT"}

# Expanded mean payoff (actor row vs opp col). 6x6.
# Designed so NO single action dominates: each strong choice has a hard counter.
# Rows=actor action, Cols=opponent action.
ENR_MEAN = np.array([
#opp:   AGG    FLU    GUA    CHG    AMB    FNT
[       0.2,  -0.9,  -1.1,   1.4,  -0.3,   1.2],  # AGG: beats CHARGE(interrupts wind-up) & FEINT; loses to FLUID/GUARD
[       1.1,   0.0,   0.4,   1.3,   0.2,  -0.2],  # FLUID: dodges AGG & CHARGE; neutral; loses slightly to FEINT
[       1.4,  -0.7,   0.0,  -1.6,  -0.2,  -1.1],  # GUARD: counters AGG hard; CRUSHED by CHARGE(pushes through); loses to FEINT
[      -1.2,  -1.3,   1.8,   0.0,  -0.4,   0.6],  # CHARGE: huge vs GUARD; but loses to AGG(interrupt) & FLUID(dodge)
[       0.5,  -0.1,   0.4,   0.6,   0.0,   0.5],  # AMBUSH: mild edge (initiative), mutual blackout -> near-neutral, low ceiling
[      -1.0,   0.3,   1.3,  -0.5,  -0.3,   0.0],  # FEINT: punishes GUARD & passivity; loses to AGG(just hits through bluff)
])

# Variance: AGG & CHARGE high (swingy), FLUID low, AMBUSH moderate (the coin-flip),
# GUARD/FEINT mid.
ENR_STD = np.array([
[1.5,1.5,1.5,1.5,1.5,1.5],   # AGG high
[0.5,0.5,0.5,0.6,0.7,0.6],   # FLUID low
[0.9,0.9,0.9,1.2,0.9,1.0],   # GUARD mid
[1.7,1.7,1.7,1.7,1.6,1.6],   # CHARGE highest
[1.0,1.0,1.0,1.0,1.0,1.0],   # AMBUSH moderate (coin-flip feel)
[1.1,1.1,1.1,1.1,1.1,1.1],   # FEINT mid
])

def enr_round_payoff(a, o):
    return rng.normal(ENR_MEAN[a,o], ENR_STD[a,o])

# Enriched policies — now over 6 actions. Terrain gates AMBUSH (set availability).
ENR_POLICIES = {
    "PureFLUID":   np.array([0,1,0,0,0,0.0]),
    "PureAGG":     np.array([1,0,0,0,0,0.0]),
    "PureGUARD":   np.array([0,0,1,0,0,0.0]),
    "PureCHARGE":  np.array([0,0,0,1,0,0.0]),
    "FluidHeavy":  np.array([0.1,0.6,0.1,0.1,0.05,0.05]),
    "Balanced6":   np.array([0.2,0.2,0.2,0.15,0.1,0.15]),
    "ChargeBait":  np.array([0.3,0.15,0.1,0.3,0.05,0.1]),   # agg+charge mix (commit threats)
    "TrickFeint":  np.array([0.2,0.2,0.15,0.1,0.05,0.3]),   # feint-heavy bluffer
    "Adaptive":    np.array([0.25,0.25,0.2,0.15,0.05,0.1]), # spread
}
for k in ENR_POLICIES: ENR_POLICIES[k] = ENR_POLICIES[k]/ENR_POLICIES[k].sum()

def enr_choose(policy, terrain=True):
    p = policy.copy()
    if not terrain:
        p[EA_AMB] = 0  # no terrain -> ambush unavailable
        p = p/p.sum()
    return rng.choice(6, p=p)

def enr_battle(polA, polB, terrain=True, max_rounds=60):
    hpA, hpB = 100.0, 100.0
    for _ in range(max_rounds):
        sA, sB = enr_choose(polA,terrain), enr_choose(polB,terrain)
        advA = enr_round_payoff(sA, sB)
        advB = enr_round_payoff(sB, sA)
        DMG = 6.0
        hpB -= max(0.0,advA)*DMG*0.5 + DMG*0.5
        hpA -= max(0.0,advB)*DMG*0.5 + DMG*0.5
        if advA < 0: hpA -= (-advA)*DMG*0.5
        if advB < 0: hpB -= (-advB)*DMG*0.5
        if hpA<=0 and hpB<=0: return 0.5
        if hpB<=0: return 1.0
        if hpA<=0: return 0.0
    return 1.0 if hpA>hpB else (0.0 if hpB>hpA else 0.5)

def enr_round_robin(policies, terrain=True, n=500):
    names=list(policies.keys()); wins=defaultdict(float); games=defaultdict(int)
    for na in names:
        for nb in names:
            if na==nb: continue
            for _ in range(n):
                r=enr_battle(policies[na],policies[nb],terrain)
                wins[na]+=r; games[na]+=1
    return {n_:wins[n_]/games[n_] for n_ in names}

def enr_best_response(n=20000):
    print("\nENRICHED BEST-RESPONSE & RISK (expected payoff vs each opp action):")
    hdr = f"{'actor':<9}" + "".join(f"{EACT[o]:>8}" for o in range(6)) + f"{'  mean':>8}{'  p5':>8}"
    print(hdr)
    for a in range(6):
        row=[]; downs=[]
        for o in range(6):
            s=rng.normal(ENR_MEAN[a,o],ENR_STD[a,o],n); row.append(s.mean()); downs.append(np.percentile(s,5))
        print(f"{EACT[a]:<9}" + "".join(f"{v:>8.2f}" for v in row) + f"{np.mean(row):>8.2f}{np.mean(downs):>8.2f}")

print()
print("="*78)
print("RUN 2 — ENRICHED SYSTEM *WITH TERRAIN* (ambush available), 500/pairing")
print("="*78)
enr_best_response()
res_terrain = enr_round_robin(ENR_POLICIES, terrain=True, n=500)
print("\nPOLICY WIN-RATES (with terrain/ambush available):")
for n_,w in sorted(res_terrain.items(),key=lambda x:-x[1]):
    print(f"  {n_:<12} {w*100:5.1f}%  {'#'*int(w*40)}")

print()
print("="*78)
print("RUN 3 — ENRICHED SYSTEM *WITHOUT TERRAIN* (no ambush), 500/pairing")
print("="*78)
res_noterrain = enr_round_robin(ENR_POLICIES, terrain=False, n=500)
print("\nPOLICY WIN-RATES (no terrain — open field, ambush unavailable):")
for n_,w in sorted(res_noterrain.items(),key=lambda x:-x[1]):
    print(f"  {n_:<12} {w*100:5.1f}%  {'#'*int(w*40)}")

# Dominance metric: spread of win-rates (lower = healthier, no dominant strat)
def spread(res):
    vals=np.array(list(res.values()))
    return vals.max()-vals.min(), vals.std()

print()
print("="*78)
print("DOMINANCE SUMMARY (lower spread = healthier; one dominant strat = high spread)")
print("="*78)
for label,res in [("BASE (no enrichment)",results_base),("ENRICHED +terrain",res_terrain),("ENRICHED no-terrain",res_noterrain)]:
    sp,sd = spread(res)
    top = max(res.items(),key=lambda x:x[1])
    print(f"  {label:<24} win-rate spread={sp*100:5.1f}pp  std={sd*100:4.1f}pp  top={top[0]}({top[1]*100:.0f}%)")


# ===========================================================================
# RUN 4: THE REAL FIX — make FLUID PUNISHABLE.
# Insight from Runs 1-3: adding risky options doesn't dethrone a SAFE option.
# Fluid dominates because it has no hard counter + lowest variance.
# FIX: give Fluid a real predator. Design idea:
#   - FLUID = evasive/passive. Its weakness should be: a PATIENT/READING play
#     that punishes evasion. In the lore: if you keep dodging (Fluid), a foe
#     who STALKS/PRESSURES (a "Pressure"/"Read" stance, or GUARD-that-baits)
#     corners you. Fluid into a committed read = Fluid gets caught.
#   - Mechanically: make GUARD/BRACE (or a dedicated counter) BEAT Fluid,
#     and crucially RAISE Fluid's variance/downside so spamming it is risky.
# We rebuild the matrix so EACH stance has a real counter AND Fluid is no
# longer the safest:
ENR2_MEAN = np.array([
#opp:   AGG    FLU    GUA    CHG    AMB    FNT
[       0.2,   1.0,  -1.1,   1.4,  -0.3,   1.2],  # AGG: now BEATS FLUID (aggression catches the dodger committing)
[      -0.9,   0.0,   0.9,   0.4,   0.2,  -0.2],  # FLUID: loses to AGG, beats GUARD, neutral else (no longer dominant)
[       1.4,  -0.7,   0.0,  -1.6,  -0.2,   0.9],  # GUARD: beats AGG, loses FLUID, crushed by CHARGE, beats FEINT now
[      -1.2,   0.6,   1.8,   0.0,  -0.4,   0.6],  # CHARGE: beats GUARD huge; FLUID can still dodge a bit but less
[       0.5,  -0.1,   0.4,   0.6,   0.0,   0.5],  # AMBUSH: initiative edge
[      -1.0,   0.3,  -0.9,  -0.5,  -0.3,   0.0],  # FEINT: punishes passivity; loses to AGG & GUARD
])
# Critically: RAISE Fluid's variance so spamming it is no longer ultra-safe.
ENR2_STD = np.array([
[1.5,1.5,1.5,1.5,1.5,1.5],
[1.1,1.1,1.1,1.1,1.0,1.1],   # FLUID variance UP from 0.5 -> 1.1 (no longer the safe pick)
[0.9,0.9,0.9,1.2,0.9,1.0],
[1.7,1.7,1.7,1.7,1.6,1.6],
[1.0,1.0,1.0,1.0,1.0,1.0],
[1.1,1.1,1.1,1.1,1.1,1.1],
])

def enr2_rp(a,o): return rng.normal(ENR2_MEAN[a,o],ENR2_STD[a,o])
def enr2_battle(pA,pB,terrain=True,max_rounds=60):
    hpA,hpB=100.0,100.0
    for _ in range(max_rounds):
        sA,sB=enr_choose(pA,terrain),enr_choose(pB,terrain)
        aA,aB=enr2_rp(sA,sB),enr2_rp(sB,sA); DMG=6.0
        hpB-=max(0.0,aA)*DMG*0.5+DMG*0.5; hpA-=max(0.0,aB)*DMG*0.5+DMG*0.5
        if aA<0: hpA-=(-aA)*DMG*0.5
        if aB<0: hpB-=(-aB)*DMG*0.5
        if hpA<=0 and hpB<=0: return 0.5
        if hpB<=0: return 1.0
        if hpA<=0: return 0.0
    return 1.0 if hpA>hpB else (0.0 if hpB>hpA else 0.5)
def enr2_rr(policies,terrain=True,n=500):
    names=list(policies.keys()); wins=defaultdict(float); games=defaultdict(int)
    for na in names:
        for nb in names:
            if na==nb: continue
            for _ in range(n):
                r=enr2_battle(policies[na],policies[nb],terrain); wins[na]+=r; games[na]+=1
    return {n_:wins[n_]/games[n_] for n_ in names}
def enr2_br(n=20000):
    print("\nFIXED BEST-RESPONSE & RISK (Fluid now punishable):")
    print(f"{'actor':<9}"+"".join(f"{EACT[o]:>8}" for o in range(6))+f"{'  mean':>8}{'  p5':>8}")
    for a in range(6):
        row=[];downs=[]
        for o in range(6):
            s=rng.normal(ENR2_MEAN[a,o],ENR2_STD[a,o],n); row.append(s.mean()); downs.append(np.percentile(s,5))
        print(f"{EACT[a]:<9}"+"".join(f"{v:>8.2f}" for v in row)+f"{np.mean(row):>8.2f}{np.mean(downs):>8.2f}")

print(); print("="*78)
print("RUN 4 — THE REAL FIX: FLUID MADE PUNISHABLE (+terrain), 500/pairing")
print("="*78)
enr2_br()
res_fixed = enr2_rr(ENR_POLICIES, terrain=True, n=500)
print("\nPOLICY WIN-RATES (Fluid now has a predator + higher variance):")
for n_,w in sorted(res_fixed.items(),key=lambda x:-x[1]):
    print(f"  {n_:<12} {w*100:5.1f}%  {'#'*int(w*40)}")
sp,sd=spread(res_fixed); top=max(res_fixed.items(),key=lambda x:x[1])
print(f"\n  DOMINANCE: spread={sp*100:.1f}pp  std={sd*100:.1f}pp  top={top[0]}({top[1]*100:.0f}%)")
print("  (compare BASE spread=97pp/top=Fluid100%, enriched-but-unfixed spread=78pp/Fluid99%)")
