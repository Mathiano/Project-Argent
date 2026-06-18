"""
Argent Combat — Two-Layer Monte Carlo (Option A: simultaneous commit).

Tests the full design:
  BASE triangle (single-step, HARD counters): AGG > FLUID > GUARD > AGG.
    - Fluid gets INITIATIVE (acts first) but loses the exchange to AGG.
  TWO-STEP layer (Charge=Agg+, Hide=Fluid+, Feint=Guard+): each is a 2-round
    commitment with a PHASE-1 vulnerability.
    - FLIPPED triangle when BOTH commit two-steps: Hide > Charge > Feint > Hide.
    - Soft counter when a SINGLE-step responds to a seen two-step (phase-1 is
      visible next round, so the responder tilts but doesn't auto-win).
    - Only a CALL escapes a committed enemy Charge (not a stance).
  SIMULTANEOUS: round-1 actions lock blind; two-step commitment is revealed at
    resolution, not before the opponent commits.
  THRICE-repeat -> self-daze (predictability punished).
  CALLS: ★-powered overrides; "Get Away" = guaranteed no-hit; "Hang In There" =
    can't die this round. Limited by ★ economy.

Question: does any single option/policy dominate? Is every layer USED?
"""
import numpy as np
from collections import defaultdict
rng = np.random.default_rng(7)

# Actions: 3 base + 3 two-step initiators
AGG, FLU, GUA, CHG, HID, FNT = range(6)
NAME = {AGG:"AGG",FLU:"FLUID",GUA:"GUARD",CHG:"CHARGE",HID:"HIDE",FNT:"FEINT"}
IS_TWOSTEP = {CHG,HID,FNT}
BASE_OF = {CHG:AGG, HID:FLU, FNT:GUA}  # which base a two-step extends

# ---- BASE single-step payoff (actor vs opp), HARD counters, AGG>FLUID>GUARD ----
# net advantage to actor (positive good). AGG beats FLUID now (the fix).
BASE_MEAN = np.array([
#opp:  AGG   FLU   GUA
[      0.0,  1.2, -1.2],  # AGG  : beats FLUID, loses GUARD
[     -1.0,  0.0,  0.6],  # FLUID: loses AGG, beats GUARD (slips it); FLUID also acts first (modeled below)
[      1.3, -0.7,  0.0],  # GUARD: beats AGG, loses FLUID
])
BASE_STD = np.array([
[1.5,1.5,1.5],   # AGG high variance
[0.9,0.9,0.9],   # FLUID mid (no longer ultra-safe)
[0.9,0.9,0.9],   # GUARD mid
])
FLUID_INIT_BONUS = 0.35  # fluid acts first -> small guaranteed value even when it loses net

def base_payoff(a, o):
    # a,o in {AGG,FLU,GUA}
    v = rng.normal(BASE_MEAN[a,o], BASE_STD[a,o])
    if a==FLU: v += FLUID_INIT_BONUS  # initiative: gets its lick in first
    return v

# ---- TWO-STEP vs TWO-STEP: FLIPPED triangle  HIDE > CHARGE > FEINT > HIDE ----
# Indexed by the two-step action. Payoff to actor when BOTH committed two-steps,
# resolved on the RELEASE round.
TS_FLIP_MEAN = {
    (HID,CHG): 1.3, (CHG,HID): -1.3,   # Hide beats Charge (hidden when blow lands)
    (CHG,FNT): 1.3, (FNT,CHG): -1.3,   # Charge beats Feint (overpowers the bluff)
    (FNT,HID): 1.4, (HID,FNT): -1.4,   # Feint HARD-ish beats Hide (catches the evader) - you wanted this strong
    (HID,HID): 0.0, (CHG,CHG): 0.0, (FNT,FNT): 0.0,
}
TS_FLIP_STD = 1.0
TS_FLIP_SCALE = 0.8  # two-step exchanges are swingy but the flip is real

# ---- PHASE-1 vulnerability: if you initiate a two-step and the opponent plays
# a SINGLE step that turns out to punish your wind-up, you eat a soft hit.
# (You're exposed in phase-1.) This is the cost of two-stepping into a non-escalator.
# Soft counters (responder sees nothing yet at commit-time, but phase-1 exposure):
# CHARGE wind-up punished by AGG (interrupt) and FLUID(dodge & poke); HIDE punished
# by GUARD-ish pressure (corner the hider) lightly; FEINT punished by AGG (just hit through).
PHASE1_VULN = {  # TUNED: phase-1 hurts MORE (cannot always escalate safely)
    (CHG,AGG): -1.6, (CHG,FLU): -1.4, (CHG,GUA): -0.2,  # charging exposed -> punished hard by reads
    (HID,AGG): -0.4, (HID,FLU): -0.9, (HID,GUA): -1.2,  # hiding into pressure -> cornered
    (FNT,AGG): -1.5, (FNT,FLU): -0.6, (FNT,GUA): -1.0,  # feint that's read -> wasted, exposed
}
PHASE1_STD = 0.8
# The RELEASE round of a two-step vs a single-step: the two-step pays off (it
# resolved its setup) -> a boosted version of its base, IF it survived phase-1.
TS_RELEASE_BONUS = 0.8  # released two-steps hit harder than the base single step

# ---- CALLS ----
# A player has a ★ economy. "Get Away" (dodge, guaranteed no-hit this round) and
# "Hang In There" (can't die this round). Modeled as: when caught in a losing
# round AND has ★, may spend to negate the loss. Limited ★ per battle.
STAR_MAX = 4  # how many call-overrides per battle (tunable)

# ---------------------------------------------------------------------------
# A policy now must decide each round: base stance OR initiate two-step, plus
# whether to spend a Call when in danger. We model policies as mixes + a
# "twostep_rate" + a "call_threshold".
# ---------------------------------------------------------------------------
def make_policy(base_mix, twostep_rate, call_thresh, terrain_bias=None):
    return dict(base=np.array(base_mix)/np.sum(base_mix),
                ts=twostep_rate, call=call_thresh, terrain=terrain_bias)

POLICIES = {
    "FluidSpam":   make_policy([0.05,0.9,0.05], 0.0, 0.0),     # the old dominant - should now fail
    "BaseBalanced":make_policy([0.34,0.33,0.33], 0.0, 0.3),    # solid single-step reads, no two-steps
    "AggHeavy":    make_policy([0.7,0.15,0.15], 0.1, 0.3),
    "GuardHeavy":  make_policy([0.15,0.15,0.7], 0.1, 0.3),
    "TwoStepLover":make_policy([0.3,0.3,0.4], 0.6, 0.4),       # escalates to two-steps a lot
    "Mixed":       make_policy([0.3,0.3,0.4], 0.3, 0.4),       # balanced incl. some two-steps
    "ChargeSpam":  make_policy([0.5,0.2,0.3], 0.7, 0.5),       # charge-heavy
    "HideSpam":    make_policy([0.2,0.6,0.2], 0.7, 0.4),       # hide-heavy
    "Adaptive":    make_policy([0.33,0.33,0.34], 0.25, 0.5),   # measured
}

def choose_action(pol, recent):
    """Pick this round's action. recent = last 2 actions (for thrice-daze avoidance)."""
    # decide two-step vs base
    if rng.random() < pol["ts"]:
        # initiate a two-step: map a base draw to its two-step
        b = rng.choice(3, p=pol["base"])
        ts = {AGG:CHG, FLU:HID, GUA:FNT}[b]
        return ts
    else:
        a = rng.choice(3, p=pol["base"])
        # avoid thrice-repeat if it would self-daze (smart policies avoid it)
        if len(recent)>=2 and recent[-1]==a and recent[-2]==a:
            # pick a different base
            alt = [x for x in range(3) if x!=a]
            a = rng.choice(alt)
        return a

def resolve_round(aA, aB, midA, midB):
    """
    Returns (netA, netB) advantage this round.
    midA/midB: whether each is mid-two-step (in release phase) carrying a pending ts.
    Simplified: we handle the four cases (both base, both twostep-initiate,
    mixed) and the release resolution.
    """
    aT, bT = aA in IS_TWOSTEP, aB in IS_TWOSTEP
    if not aT and not bT:
        # both single step -> base triangle
        return base_payoff(aA,aB), base_payoff(aB,aA)
    if aT and bT:
        # both initiate two-steps THIS round (phase-1 for both). The actual flipped
        # resolution happens on release, but we approximate the exchange value here
        # as the flipped-triangle outcome (they're committing simultaneously).
        m = TS_FLIP_MEAN.get((aA,aB), 0.0)
        v = rng.normal(m*TS_FLIP_SCALE, TS_FLIP_STD)
        return v, -v + rng.normal(0,0.3)  # near zero-sum w/ noise
    # one two-steps, other single-steps -> phase-1 vulnerability for the two-stepper,
    # but if it survives, the release is boosted. Model expected value of the sequence.
    if aT and not bT:
        vuln = rng.normal(*( (PHASE1_VULN[(aA,bB:=aB)], PHASE1_STD) ))
        # release payoff (boosted base of the two-step vs the opp's base)
        rel = base_payoff(BASE_OF[aA], aB) + TS_RELEASE_BONUS*0.5
        net = 0.5*vuln + 0.5*rel  # blended across the 2 rounds
        return net, -0.4*net + rng.normal(0,0.4)
    else:
        vuln = rng.normal(*((PHASE1_VULN[(aB,aA)], PHASE1_STD)))
        rel = base_payoff(BASE_OF[aB], aA) + TS_RELEASE_BONUS*0.5
        net = 0.5*vuln + 0.5*rel
        return -0.4*net + rng.normal(0,0.4), net

def battle(pA, pB, max_rounds=40):
    hpA=hpB=100.0; starA=starB=STAR_MAX
    recentA=[]; recentB=[]; usageA=defaultdict(int); usageB=defaultdict(int)
    for _ in range(max_rounds):
        aA=choose_action(pA,recentA); aB=choose_action(pB,recentB)
        usageA[aA]+=1; usageB[aB]+=1
        recentA.append(aA if aA not in IS_TWOSTEP else BASE_OF[aA]); recentA=recentA[-3:]
        recentB.append(aB if aB not in IS_TWOSTEP else BASE_OF[aB]); recentB=recentB[-3:]
        nA,nB=resolve_round(aA,aB,False,False)
        # CALLS: if a side is taking a big loss and has stars and policy says so, negate
        if nA < -0.8 and starA>0 and rng.random()<pA["call"]:
            nA=0.0; starA-=1
        if nB < -0.8 and starB>0 and rng.random()<pB["call"]:
            nB=0.0; starB-=1
        DMG=7.0
        hpB-=max(0,nA)*DMG*0.5+DMG*0.45
        hpA-=max(0,nB)*DMG*0.5+DMG*0.45
        if nA<0: hpA-=(-nA)*DMG*0.5
        if nB<0: hpB-=(-nB)*DMG*0.5
        if hpA<=0 and hpB<=0: return 0.5, usageA, usageB
        if hpB<=0: return 1.0, usageA, usageB
        if hpA<=0: return 0.0, usageA, usageB
    return (1.0 if hpA>hpB else 0.0 if hpB>hpA else 0.5), usageA, usageB

def round_robin(policies, n=500):
    names=list(policies.keys()); wins=defaultdict(float); games=defaultdict(int)
    total_usage=defaultdict(int)
    for na in names:
        for nb in names:
            if na==nb: continue
            for _ in range(n):
                r,uA,uB=battle(policies[na],policies[nb])
                wins[na]+=r; games[na]+=1
                for k,v in uA.items(): total_usage[k]+=v
    return {n_:wins[n_]/games[n_] for n_ in names}, total_usage

print("="*78)
print("TWO-LAYER SYSTEM — Option A (simultaneous), 500 battles/pairing")
print("  BASE: AGG>FLUID>GUARD (hard) | TWO-STEP flipped: HIDE>CHARGE>FEINT>HIDE")
print("  Calls escape big losses (★ limited) | thrice-repeat avoided")
print("="*78)
res, usage = round_robin(POLICIES, n=500)
print("\nPOLICY WIN-RATES:")
for n_,w in sorted(res.items(),key=lambda x:-x[1]):
    print(f"  {n_:<13} {w*100:5.1f}%  {'#'*int(w*40)}")
vals=np.array(list(res.values()))
print(f"\n  DOMINANCE: spread={ (vals.max()-vals.min())*100:.1f}pp  std={vals.std()*100:.1f}pp")
print(f"  top={max(res.items(),key=lambda x:x[1])[0]}  bottom={min(res.items(),key=lambda x:x[1])[0]}")

print("\nACTION USAGE (is every option used? unused = dead weight):")
tot=sum(usage.values())
for a in range(6):
    print(f"  {NAME[a]:<8} {usage[a]/tot*100:5.1f}%  {'#'*int(usage[a]/tot*80)}")
