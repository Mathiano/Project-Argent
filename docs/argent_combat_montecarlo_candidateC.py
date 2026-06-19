"""
Argent Combat — CANDIDATE C: "Focus as a 4th stance" (merged model) Monte Carlo.

This is a candidate COMBAT SYSTEM (one of three explored):
  A) base triangle only (Layer 1) — shipped.
  B) distinct two-steps (Charge/Hide/Feint visible wind-ups) — shipped Layer 2.
  C) THIS — Focus is a 4th first-class stance; round-2 release is HIDDEN. Merges
     the "Focus = readable 4th stance, punishable by Aggression in R1" idea with
     the "hidden round-2 release (rotation triangle)" idea.

MODEL:
  Round-1 menu = {AGG, FLUID, BRACE, FOCUS} (four first-class choices, no commit
    modifier — GBC-console-friendly).
  FOCUS on the round-1 triangle: punished by AGGRESSIVE (caught committing),
    ~neutral to FLUID, ignored by BRACE. (So initiating a two-step is itself a
    readable gamble with a clean counter = Aggression.)
  If FOCUS survives R1, R2 = the HIDDEN release (HEAVY/FEINT/HIDE) resolved vs the
    opponent's simultaneous single-step via the ROTATION TRIANGLE:
        HEAVY > Brace ; FEINT > Aggressive ; HIDE > Fluid  (each beats one)
  BOTH focus same round -> FLIPPED triangle (HIDE>HEAVY>FEINT>HIDE).
  TIMING-MISMATCH (the edge case found in design): one side RELEASING while the
    other is FOCUS-WINDING-UP (offset two-steps). Modeled explicitly:
        your focus-wind-up vs their release:
          loses to their HEAVY (devastated while gathering),
          beats their FEINT (you're committing, not defending -> their feint whiffs),
          ~neutral vs their HIDE (both doing their own thing).
  Base single-step triangle AGG>FLUID>GUARD (Fluid acts first) unchanged.

QUESTION: with the timing-mismatch modeled, is there a dominant line? is the
spread healthy? is focusing worth-it-sometimes (Adaptive tops, FocusSpam below)?
"""
import numpy as np
from collections import defaultdict
rng=np.random.default_rng(23)

AGG,FLU,GUA,FOCUS=0,1,2,3
SNAME={AGG:"AGG",FLU:"FLUID",GUA:"BRACE",FOCUS:"FOCUS"}
HEAVY,FEINT,HIDE=0,1,2
RNAME={HEAVY:"HEAVY",FEINT:"FEINT",HIDE:"HIDE"}

# --- Round-1 stance triangle, now 4x4 (FOCUS included) ---
# value to actor (row) vs opp (col). FOCUS punished by AGG, neutral-ish else.
# (FOCUS's "real" payoff comes in R2; in R1 it's just a vulnerable setup.)
# TUNED: AGG-punishes-FOCUS softened to ~0.3 (a gentle "think twice", not a trap) per the sweep
R1_MEAN=np.array([
#opp:   AGG    FLU    GUA    FOCUS
[       0.0,   1.1,  -1.1,   0.3],  # AGG  (focus-punish softened 1.0->0.3)  : beats FLUID, loses BRACE, PUNISHES a focuser
[      -0.9,   0.0,   0.6,   0.1],  # FLUID: loses AGG, beats BRACE, ~neutral vs focus
[       1.2,  -0.6,   0.0,   0.0],  # BRACE: beats AGG, loses FLUID, ignores focus
[      -0.3,  -0.1,   0.0,   0.0],  # FOCUS (punished gently by AGG): PUNISHED by AGG, ~neutral FLUID/BRACE/mirror (R1 setup cost is implicit)
])
R1_STD=np.full((4,4),1.0); R1_STD[AGG]=1.4; R1_STD[FLU]=0.9; R1_STD[GUA]=0.9; R1_STD[FOCUS]=0.9
FLU_INIT=0.3
def r1_pay(a,o):
    v=rng.normal(R1_MEAN[a,o],R1_STD[a,o])
    if a==FLU: v+=FLU_INIT
    return v

# --- Round-2 release vs opponent single-step (rotation triangle) ---
REL_MEAN=np.array([
#opp R2:  AGG    FLU    GUA
[         0.2,  -1.3,   1.9],  # HEAVY: crush BRACE(+status), dodged FLUID, neutral AGG
[         1.7,  -0.1,  -1.2],  # FEINT: beats AGG, both-hit FLUID, whiff BRACE
[        -1.2,   1.6,  -0.2],  # HIDE : flushed AGG, catches FLUID, stalemate BRACE
])
REL_STD=np.array([[1.5,1.5,1.5],[1.2,1.2,1.2],[1.2,1.2,1.2]])
def rel_pay(rel,o): return rng.normal(REL_MEAN[rel,o],REL_STD[rel,o])

# --- both focus same round -> flipped triangle ---
FLIP={(HIDE,HEAVY):1.3,(HEAVY,HIDE):-1.3,(HEAVY,FEINT):1.3,(FEINT,HEAVY):-1.3,
      (FEINT,HIDE):1.4,(HIDE,FEINT):-1.4,(HIDE,HIDE):0,(HEAVY,HEAVY):0,(FEINT,FEINT):0}

# --- TIMING-MISMATCH: your focus-wind-up vs their release ---
# value to the FOCUSER (winding up). loses to HEAVY, beats FEINT, ~neutral HIDE.
MISMATCH_VS_REL={HEAVY:-1.8, FEINT:1.3, HIDE:0.0}  # (their release -> your focus-windup value)
MISMATCH_STD=1.2

FOCUS_COST=1.1  # the balance knob from the focus-model sim

def pol(base, focus_rate, rel_mix, call=0.3):
    b=np.array(base,dtype=float); b=b/b.sum()
    return dict(base=b, fr=focus_rate, rel=np.array(rel_mix,dtype=float)/np.sum(rel_mix), call=call)
POLICIES={
 "NoFocus_Bal": pol([.34,.33,.33,0],0.0,[1,1,1]),
 "NoFocus_Agg": pol([.55,.2,.25,0],0.0,[1,1,1]),
 "FocusLover":  pol([.25,.25,.2,.3],0.0,[1,1,1]),   # high focus via the 4th-stance weight
 "Balanced":    pol([.3,.25,.25,.2],0.0,[1,1,1]),
 "HeavySpam":   pol([.3,.2,.2,.3],0.0,[3,1,1]),
 "FeintSpam":   pol([.3,.2,.2,.3],0.0,[1,3,1]),
 "HideSpam":    pol([.3,.2,.2,.3],0.0,[1,1,3]),
 "AntiFocus":   pol([.5,.2,.3,0],0.0,[1,1,1]),       # aggression-heavy to punish focusers
 "Adaptive":    pol([.3,.25,.25,.2],0.0,[1,1,1],call=0.5),
}
DMG=6.0
def choose(p,recent):
    a=rng.choice(4,p=p["base"])
    if len(recent)>=2 and recent[-1]==a and recent[-2]==a and a!=FOCUS:
        a=rng.choice([x for x in range(4) if x!=a],p=None)
    return a

def battle(pA,pB,max_rounds=40):
    hpA=hpB=100.0; rA=[];rB=[]; useA=defaultdict(int)
    pendA=None; pendB=None  # pending release if mid-focus
    for _ in range(max_rounds):
        # choose actions
        if pendA is not None: actA=("rel",pendA); pendA=None
        else:
            a=choose(pA,rA)
            if a==FOCUS:
                rel=rng.choice(3,p=pA["rel"]); pendA=rel; actA=("focus",rel)
            else:
                actA=("single",a); rA.append(a); rA=rA[-3:]
        if pendB is not None: actB=("rel",pendB); pendB=None
        else:
            b=choose(pB,rB)
            if b==FOCUS:
                rel=rng.choice(3,p=pB["rel"]); pendB=rel; actB=("focus",rel)
            else:
                actB=("single",b); rB.append(b); rB=rB[-3:]
        useA[actA[0]+":"+(SNAME[actA[1]] if actA[0]=="single" else RNAME[actA[1]])]+=1

        kA,kB=actA[0],actB[0]; nA=nB=0.0
        if kA=="focus": nA-=FOCUS_COST/DMG
        if kB=="focus": nB-=FOCUS_COST/DMG

        if kA=="single" and kB=="single":
            nA+=r1_pay(actA[1],actB[1]); nB+=r1_pay(actB[1],actA[1])
        elif kA=="focus" and kB=="single":
            nA+=r1_pay(FOCUS,actB[1]); nB+=r1_pay(actB[1],FOCUS)
        elif kB=="focus" and kA=="single":
            nB+=r1_pay(FOCUS,actA[1]); nA+=r1_pay(actA[1],FOCUS)
        elif kA=="focus" and kB=="focus":
            nA+=r1_pay(FOCUS,FOCUS); nB+=r1_pay(FOCUS,FOCUS)  # both setup; flip resolves at release
        elif kA=="rel" and kB=="single":
            nA+=rel_pay(actA[1],actB[1]); nB+=r1_pay(actB[1],FLU)*0.2
        elif kB=="rel" and kA=="single":
            nB+=rel_pay(actB[1],actA[1]); nA+=r1_pay(actA[1],FLU)*0.2
        elif kA=="rel" and kB=="rel":
            v=rng.normal(FLIP.get((actA[1],actB[1]),0),1.0); nA+=v; nB-=v
        elif kA=="rel" and kB=="focus":   # A releases, B winding up (timing mismatch) -> B is focuser
            mv=rng.normal(MISMATCH_VS_REL[actA[1]],MISMATCH_STD)  # value to focuser(B)
            nB+=mv; nA-=mv*0.8
        elif kB=="rel" and kA=="focus":
            mv=rng.normal(MISMATCH_VS_REL[actB[1]],MISMATCH_STD)  # value to focuser(A)
            nA+=mv; nB-=mv*0.8

        if nA<-0.9 and rng.random()<pA["call"]: nA=max(nA,-0.2)
        if nB<-0.9 and rng.random()<pB["call"]: nB=max(nB,-0.2)
        hpB-=max(0,nA)*DMG*0.5+DMG*0.4; hpA-=max(0,nB)*DMG*0.5+DMG*0.4
        if nA<0: hpA-=(-nA)*DMG*0.5
        if nB<0: hpB-=(-nB)*DMG*0.5
        if hpA<=0 and hpB<=0: return 0.5,useA
        if hpB<=0: return 1.0,useA
        if hpA<=0: return 0.0,useA
    return (1.0 if hpA>hpB else 0.0 if hpB>hpA else 0.5),useA

def rr(policies,n=500):
    names=list(policies);wins=defaultdict(float);games=defaultdict(int);use=defaultdict(int)
    for na in names:
        for nb in names:
            if na==nb: continue
            for _ in range(n):
                r,u=battle(policies[na],policies[nb]);wins[na]+=r;games[na]+=1
                for k,v in u.items(): use[k]+=v
    return {x:wins[x]/games[x] for x in names},use

print("="*78)
print("CANDIDATE C — FOCUS as a 4th stance (merged), w/ timing-mismatch modeled")
print("  R1 menu {AGG,FLUID,BRACE,FOCUS}; FOCUS punished by AGG; R2 hidden release")
print("  rotation HEAVY>Brace FEINT>Agg HIDE>Fluid; both-focus=flip; mismatch modeled")
print(f"  FOCUS_COST={FOCUS_COST}")
print("="*78)
res,use=rr(POLICIES,500)
print("\nPOLICY WIN-RATES:")
for n_,w in sorted(res.items(),key=lambda x:-x[1]):
    print(f"  {n_:<13} {w*100:5.1f}%  {'#'*int(w*40)}")
vals=np.array(list(res.values()))
print(f"\n  spread={(vals.max()-vals.min())*100:.1f}pp  std={vals.std()*100:.1f}pp  top={max(res,key=res.get)}")
print("\nACTION USAGE:")
tot=sum(use.values())
for k,v in sorted(use.items(),key=lambda x:-x[1]):
    print(f"  {k:<16} {v/tot*100:5.1f}%  {'#'*int(v/tot*70)}")
