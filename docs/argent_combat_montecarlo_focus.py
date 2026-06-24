"""
Argent Combat — the FOCUS two-step model (redesign) Monte Carlo.

REDESIGN (vs the shipped distinct-wind-ups Layer 2):
  Round 1 = FOCUS: a SHARED wind-up ("gathering energy"). You take damage /
    deal none (the guaranteed COST — the balance knob). The opponent knows A
    release is coming but NOT which.
  Round 2 = the HIDDEN release (Heavy / Feint / Hide), resolved against the
    opponent's simultaneous single-step via a ROTATION TRIANGLE:
        Heavy > Brace   (crush, +status)   ; Heavy loses to Fluid (dodged)
        Feint > Aggressive (they fall for it); Feint loses to Brace (whiff)
        Hide  > Fluid   (catch the dancer)  ; Hide loses to Aggressive (flushed)
    (each release beats one R2 stance, loses to one, neutral on one)
  WHY: converts the old "guess their move TWO turns out" into a clean ONE-turn
    round-2 read. Cost (focus round) + amplified payoff (win the read) is the
    risk/reward. Base triangle (AGG>FLUID>GUARD) unchanged; both-focus uses the
    FLIPPED triangle (HIDE>CHARGE>FEINT).

QUESTION: is any release dominant? is two-stepping (Focus) worth-it-sometimes
but not always (so reading beats spamming)? is the focus-cost tuned right?
"""
import numpy as np
from collections import defaultdict
rng = np.random.default_rng(11)

# Single-step actions
AGG, FLU, GUA = 0,1,2
SNAME={AGG:"AGG",FLU:"FLUID",GUA:"GUARD"}
# Releases (round 2 of a focus)
HEAVY, FEINT, HIDE = 0,1,2
RNAME={HEAVY:"HEAVY",FEINT:"FEINT",HIDE:"HIDE"}

# --- base single-step triangle (AGG>FLUID>GUARD), Fluid acts first ---
BASE_MEAN=np.array([
#opp:  AGG   FLU   GUA
[      0.0,  1.1, -1.1],  # AGG
[     -0.9,  0.0,  0.6],  # FLUID (acts first: +init below)
[      1.2, -0.6,  0.0],  # GUARD
])
BASE_STD=np.full((3,3),1.0); BASE_STD[AGG]=1.4; BASE_STD[FLU]=0.9; BASE_STD[GUA]=0.9
FLU_INIT=0.3
def base_pay(a,o):
    v=rng.normal(BASE_MEAN[a,o],BASE_STD[a,o])
    if a==FLU: v+=FLU_INIT
    return v

# --- ROUND-2 release vs opponent single-step: the rotation triangle ---
# value to the RELEASER (positive good). Heavy>Brace, Feint>Agg, Hide>Fluid.
REL_MEAN=np.array([
#opp R2:  AGG    FLU    GUA
[         0.2,  -1.3,   1.9],  # HEAVY: crush GUARD(+status big), dodged by FLUID, neutral-trade vs AGG
[         1.7,  -0.1,  -1.2],  # FEINT: beats AGG(fall for it), whiff vs GUARD, both-hit vs FLUID
[        -1.2,   1.6,  -0.2],  # HIDE : flushed by AGG, catches FLUID, stalemate vs GUARD
])
REL_STD=np.array([
[1.5,1.5,1.5],   # heavy swingy
[1.2,1.2,1.2],
[1.2,1.2,1.2],
])
# Status bonus: HEAVY vs GUARD and FEINT vs AGG also apply a daze (extra value) -
# folded into the means above (the 1.9 / 1.7). 

def release_pay(rel, opp_single):
    return rng.normal(REL_MEAN[rel,opp_single], REL_STD[rel,opp_single])

# --- both-focus (two-step vs two-step): FLIPPED triangle HIDE>CHARGE>FEINT ---
# (Charge=Heavy here). value to actor.
FLIP={(HIDE,HEAVY):1.3,(HEAVY,HIDE):-1.3,(HEAVY,FEINT):1.3,(FEINT,HEAVY):-1.3,
      (FEINT,HIDE):1.4,(HIDE,FEINT):-1.4,(HIDE,HIDE):0,(HEAVY,HEAVY):0,(FEINT,FEINT):0}
FLIP_STD=1.0

# --- THE FOCUS COST (the balance knob): during the focus round you take damage,
# deal none. Modeled as a fixed self-cost applied in round 1 of a focus. ---
FOCUS_COST=1.1   # TUNED: the sweet spot (Adaptive tops, FocusSpam below balanced, ~10pp spread)

# Policies: mix over single-steps + a focus_rate + (if focus) a release mix +
# a call propensity.
def pol(base, focus_rate, rel_mix, call=0.3):
    return dict(base=np.array(base)/np.sum(base), fr=focus_rate,
                rel=np.array(rel_mix)/np.sum(rel_mix), call=call)
POLICIES={
 "NoFocus_Bal": pol([.34,.33,.33], 0.0, [1,1,1]),
 "NoFocus_Agg": pol([.6,.2,.2], 0.0, [1,1,1]),
 "FocusLover":  pol([.3,.3,.4], 0.6, [1,1,1]),
 "Balanced":    pol([.33,.33,.34], 0.3, [1,1,1]),
 "HeavySpam":   pol([.4,.2,.4], 0.5, [3,1,1]),
 "FeintSpam":   pol([.3,.4,.3], 0.5, [1,3,1]),
 "HideSpam":    pol([.3,.4,.3], 0.5, [1,1,3]),
 "Adaptive":    pol([.33,.33,.34], 0.25, [1,1,1], call=0.5),
}

DMG=6.0
def choose_single(p, recent):
    a=rng.choice(3,p=p["base"])
    if len(recent)>=2 and recent[-1]==a and recent[-2]==a:
        a=rng.choice([x for x in range(3) if x!=a])
    return a

def battle(pA,pB,max_rounds=40):
    hpA=hpB=100.0
    rA=[]; rB=[]; useA=defaultdict(int)
    # focus state: None or pending release
    focA=None; focB=None
    for _ in range(max_rounds):
        # decide actions
        if focA is None:
            doFocusA = rng.random()<pA["fr"]
        else: doFocusA=False
        if focB is None:
            doFocusB = rng.random()<pB["fr"]
        else: doFocusB=False

        # determine each side's "move" this round
        # A
        if focA is not None:  # releasing
            relA=focA; actA=("rel",relA); focA=None
        elif doFocusA:
            relA=rng.choice(3,p=pA["rel"]); focA=relA; actA=("focus",relA)
        else:
            sA=choose_single(pA,rA); actA=("single",sA); rA.append(sA); rA=rA[-3:]
        # B
        if focB is not None:
            relB=focB; actB=("rel",relB); focB=None
        elif doFocusB:
            relB=rng.choice(3,p=pB["rel"]); focB=relB; actB=("focus",relB)
        else:
            sB=choose_single(pB,rB); actB=("single",sB); rB.append(sB); rB=rB[-3:]

        useA[actA[0]+":"+ (SNAME[actA[1]] if actA[0]=="single" else RNAME[actA[1]])]+=1

        nA=nB=0.0
        kA,kB=actA[0],actB[0]
        # resolve
        if kA=="focus":  # A pays cost this round
            nA-=FOCUS_COST/DMG  # self-cost (deal none, take damage)
        if kB=="focus":
            nB-=FOCUS_COST/DMG
        # both releasing same round -> flipped triangle
        if kA=="rel" and kB=="rel":
            v=rng.normal(FLIP.get((actA[1],actB[1]),0)*1.0, FLIP_STD); nA+=v; nB-=v
        elif kA=="rel" and kB=="single":
            nA+=release_pay(actA[1], actB[1])
            nB+=base_pay(actB[1], FLU)*0.2  # the single-stepper still acts a bit
        elif kB=="rel" and kA=="single":
            nB+=release_pay(actB[1], actA[1])
            nA+=base_pay(actA[1], FLU)*0.2
        elif kA=="single" and kB=="single":
            nA+=base_pay(actA[1],actB[1]); nB+=base_pay(actB[1],actA[1])
        # focus vs single (the focuser is winding up; single-stepper acts normally vs a focusing foe)
        elif kA=="focus" and kB=="single":
            nB+=base_pay(actB[1],FLU)*0.5  # gets a partial free hit on the focuser
        elif kB=="focus" and kA=="single":
            nA+=base_pay(actA[1],FLU)*0.5
        elif kA=="focus" and kB=="focus":
            pass  # both winding up, both paid cost
        elif kA=="focus" and kB=="rel":
            nB+=release_pay(actB[1], FLU)*0.6  # B releases into a focusing A
        elif kB=="focus" and kA=="rel":
            nA+=release_pay(actA[1], FLU)*0.6

        # Calls: negate a big incoming loss if have propensity (simplified, unlimited-ish)
        if nA<-0.9 and rng.random()<pA["call"]: nA=max(nA,-0.2)
        if nB<-0.9 and rng.random()<pB["call"]: nB=max(nB,-0.2)

        hpB-=max(0,nA)*DMG*0.5+DMG*0.4
        hpA-=max(0,nB)*DMG*0.5+DMG*0.4
        if nA<0: hpA-=(-nA)*DMG*0.5
        if nB<0: hpB-=(-nB)*DMG*0.5
        if hpA<=0 and hpB<=0: return 0.5,useA
        if hpB<=0: return 1.0,useA
        if hpA<=0: return 0.0,useA
    return (1.0 if hpA>hpB else 0.0 if hpB>hpA else 0.5),useA

def rr(policies,n=500):
    names=list(policies); wins=defaultdict(float); games=defaultdict(int); use=defaultdict(int)
    for na in names:
        for nb in names:
            if na==nb: continue
            for _ in range(n):
                r,u=battle(policies[na],policies[nb]); wins[na]+=r; games[na]+=1
                for k,v in u.items(): use[k]+=v
    return {x:wins[x]/games[x] for x in names}, use

print("="*78)
print("FOCUS two-step model — 500 battles/pairing")
print("  R1 Focus (shared wind-up, costs you) -> R2 hidden release")
print("  rotation: HEAVY>Brace, FEINT>Agg, HIDE>Fluid | both-focus = flipped tri")
print(f"  FOCUS_COST={FOCUS_COST} (the balance knob)")
print("="*78)
res,use=rr(POLICIES,500)
print("\nPOLICY WIN-RATES:")
for n_,w in sorted(res.items(),key=lambda x:-x[1]):
    print(f"  {n_:<13} {w*100:5.1f}%  {'#'*int(w*40)}")
vals=np.array(list(res.values()))
print(f"\n  spread={ (vals.max()-vals.min())*100:.1f}pp  std={vals.std()*100:.1f}pp")
print("\nACTION USAGE:")
tot=sum(use.values())
for k,v in sorted(use.items(),key=lambda x:-x[1]):
    print(f"  {k:<16} {v/tot*100:5.1f}%  {'#'*int(v/tot*70)}")
