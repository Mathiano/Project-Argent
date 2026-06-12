import random
from collections import Counter

# tuned v0.3 core + boss layer
CFG = dict(
    pool=100, dmg_scale=0.85,
    cost={'status': 8, 'light': 12, 'mid': 22, 'heavy': 35, 'nuke': 55},
    regen=8, guard_regen=6, fluid_cost=12, aggr_cost_mult=1.15,
    winded=25, exh_taken=1.25, rest_regen=25,
    aggr_dmg=1.25, aggr_taken=1.15,
    guard_dmg=0.75, guard_taken=0.60, reflect=0.50,
    opening_dmg=1.15, opening_taken=0.85,
    dodge_slope=2.0, dodge_cap=0.90,
    # --- boss layer ---
    break_bar=4,            # read-wins to Break
    star_threshold=2,       # momentum per ★
    pillars=2, pillar_reflect=0.65, pillar_taken=0.55,
    rollout_base=40, rollout_mult=1.5, rollout_maxstk=4, rollout_cost=15,
    rollout_relentless=0.5,  # multiplies dodge chance vs Rollout
    milk_heal=0.45, milk_uses=2, milk_cost=20,
    call_fullpower=1.5, call_breath=40,
    boss_calls=2,
    potions=2, potion_heal=0.30,
    miltank=dict(hp=420, atk=100, dfn=125, spd=70),
    player=dict(hp=300, atk=100, dfn=100, spd=110),
    timeout=40,
)
TIERS = {'light': 55, 'mid': 80, 'heavy': 110, 'nuke': 140}
WEIGHT = {'light': 0.85, 'mid': 1.0, 'heavy': 1.15, 'nuke': 1.3,
          'rollout': 0.9, 'slam': 1.0, 'curl': 0.8, 'milk': 0.8, 'rest': 0.8, 'potion': 0.8}


class Mon:
    def __init__(self, d):
        self.maxhp = d['hp']; self.hp = d['hp']; self.st = CFG['pool']
        self.atk = d['atk']; self.dfn = d['dfn']; self.spd = d['spd']
        self.staggered = False; self.exhausted = False
        self.momentum = 0; self.star = False
        self.fullpower = False
        self.hist = []
        self.potions = 0


def affordable(m):
    out = []
    for t, c in CFG['cost'].items():
        if t == 'status': continue
        if m.st >= c and not (t in ('heavy', 'nuke') and m.st <= CFG['winded']):
            out.append(t)
    return out


def dmg_roll(att, dfn, power):
    return power * att.atk / dfn.dfn * CFG['dmg_scale'] * random.uniform(0.9, 1.0)


def gain_momentum(m):
    m.momentum += 1
    if m.momentum >= CFG['star_threshold'] and not m.star:
        m.star = True; m.momentum = 0


# ---------- Whitney brain ----------
class Whitney:
    def __init__(self):
        self.mon = Mon(CFG['miltank'])
        self.chain = 0; self.curl = False
        self.milk_left = CFG['milk_uses']
        self.calls_left = CFG['boss_calls']
        self.phase = 1
        self.hang_on = False
        self.seen = []  # player stance history

    def read(self):
        if len(self.seen) < 2: return None
        p = 0.30 if self.phase == 1 else 0.75
        if random.random() > p: return None
        return Counter(self.seen[-3:]).most_common(1)[0][0]

    def choose(self):
        m = self.mon
        heal_at = 0.35 if self.phase == 1 else 0.50
        # leader Calls
        call = None
        if self.calls_left > 0 and m.star:
            if m.hp / m.maxhp < 0.20:
                call = 'hang'; self.calls_left -= 1; m.star = False
            elif self.chain >= 2:
                call = 'fullpower'; self.calls_left -= 1; m.star = False
                m.fullpower = True
        if m.hp / m.maxhp < heal_at and self.milk_left and m.st >= CFG['milk_cost']:
            return ('milk', 'G', call)
        # read the player
        modal = self.read()
        if modal == 'G' and m.st >= CFG['cost']['mid'] + CFG['fluid_cost']:
            if self.phase >= 2 and self.calls_left > 0 and m.star and call is None:
                call = 'fullpower'; self.calls_left -= 1
                m.star = False; m.fullpower = True
            return ('slam', 'F', call)      # stomp through the opening
        if modal == 'A' and m.st >= CFG['cost']['mid']:
            return ('slam', 'G', call)      # brace and counter
        if modal == 'F' and m.st >= CFG['rollout_cost']:
            return ('rollout', 'A', call)   # relentless — punish the dodger
        if self.chain == 0 and not self.curl and m.st >= CFG['cost']['status'] and \
           random.random() < (0.4 if self.phase == 1 else 0.8):
            return ('curl', 'G', call)
        if m.st >= CFG['rollout_cost']:
            return ('rollout', 'A', call)
        if m.st >= CFG['cost']['mid']:
            return ('slam', 'A', call)
        return ('rest', 'G', call)


# ---------- player policies ----------
# policies see Whitney's intent (move + stance) — Normal difficulty
def p_naive(me, w, intent):
    ts = affordable(me)
    if not ts: return ('rest', 'G', None)
    call = random.choice(['hang', 'fullpower', 'breath', 'getback', None]) if me.star else None
    return (random.choice(ts), random.choice('AGF'), call)

def p_brute(me, w, intent):
    ts = affordable(me)
    if not ts: return ('rest', 'G', None)
    call = 'fullpower' if me.star else None
    return (max(ts, key=lambda t: TIERS[t]), 'A', call)

def _tier(me, broken):
    ts = affordable(me)
    if not ts: return None
    if broken:  # free hit window
        for p in ('nuke', 'heavy', 'mid'):
            if p in ts: return p
    if me.st > 70:
        for p in ('heavy', 'mid'):
            if p in ts: return p
    if me.st > 40: return 'mid' if 'mid' in ts else ts[0]
    return 'light' if 'light' in ts else ts[0]

def p_reader(me, w, intent):
    mv, ws, broken = intent
    call = None
    if me.star:
        if broken: call = 'fullpower'
        elif me.st < 30: call = 'breath'
        elif mv == 'rollout' and w.chain >= 2 and me.hp / me.maxhp < 0.35: call = 'hang'
    if call == 'breath':
        return ('rest', 'G', 'breath')
    t = _tier(me, broken)
    if t is None: return ('rest', 'G', None)
    s = 'G' if ws == 'A' else 'F'   # counter attacks, punch openings in setup/heal
    if broken: s = 'A'
    return (t, s, call)

def p_optimal(me, w, intent):
    mv, ws, broken = intent
    call = None
    if me.star:
        if broken: call = 'fullpower'
        elif w.mon.fullpower or (mv == 'rollout' and w.chain >= 2): call = 'getback'
        elif me.st < 35 and ws == 'G': call = 'breath'
    if call == 'breath': return ('rest', 'G', 'breath')
    if broken:
        t = _tier(me, True)
        return (t or 'rest', 'A', call)
    ts = [t for t in affordable(me) if t != 'nuke']  # nukes saved for Breaks
    if not ts: return ('rest', 'G', None)
    if ws == 'F':  # she's stomping — too slow to dodge back: punish, but stay cheap
        return (('mid' if 'mid' in ts else ts[0]), 'A', call)
    if ws == 'A':
        if len(me.hist) >= 2 and me.hist[-1] == 'G' and me.hist[-2] == 'G':
            return (('mid' if 'mid' in ts else ts[0]), 'F', call)  # break my own pattern
        return (('light' if me.st < 40 else 'mid') if 'mid' in ts or 'light' in ts else ts[0], 'G', call)
    return (('mid' if 'mid' in ts else ts[0]), 'F', call)

POLICIES = {'Naive': p_naive, 'Brute': p_brute, 'Reader': p_reader, 'Optimal': p_optimal}


# ---------- fight ----------
def fight(policy, hard=False):
    me = Mon(CFG['player'])
    me.potions = CFG['potions']
    w = Whitney()
    bar = 0; pillars = CFG['pillars']
    stats = Counter()
    broken_rounds = 0

    for rnd in range(1, CFG['timeout'] + 1):
        stats['rounds'] = rnd
        # exhausted recovery
        for m in (me, w.mon):
            if m.exhausted:
                m.st = min(CFG['pool'], m.st + CFG['rest_regen'])

        boss_broken = broken_rounds > 0
        wmv, wst, wcall = ('rest', 'G', None) if (boss_broken or w.mon.exhausted) else w.choose()
        if w.mon.exhausted: w.mon.exhausted = False
        w.hang_on = (wcall == 'hang')

        shown = wst if not hard else ('A' if wmv in ('rollout', 'slam') else 'G')
        pmv, pst, pcall = policy(me, w, (wmv, shown, boss_broken))
        if me.exhausted:
            pmv, pst, pcall = 'rest', 'G', None
            me.exhausted = False
            stats['p_exhaust'] += 1
        if me.potions > 0 and me.hp / me.maxhp < 0.35 and not boss_broken and pmv != 'rest':
            pmv, pst, pcall = 'potion', 'G', pcall if pcall in ('hang', 'getback') else None
            me.potions -= 1; stats['potions'] += 1
        w.seen.append(pst)
        me.hist.append(pst)
        if pcall == 'fullpower': me.fullpower = True
        if pcall: me.star = False
        hang = pcall == 'hang'
        getback = pcall == 'getback'
        if pcall: stats['calls'] += 1

        # initiative
        pi = me.spd / WEIGHT.get(pmv, 1.0) * (0.5 if me.staggered else 1)
        wi = w.mon.spd / WEIGHT.get(wmv, 1.0) * (0.5 if w.mon.staggered else 1)
        me.staggered = w.mon.staggered = False
        order = [('p', 'w'), ('w', 'p')] if (pi > wi or (pi == wi and random.random() < 0.5)) else [('w', 'p'), ('p', 'w')]
        if pst == 'F' and wst == 'G': order = [('p', 'w'), ('w', 'p')]
        if wst == 'F' and pst == 'G': order = [('w', 'p'), ('p', 'w')]

        for actor, _ in order:
            if me.hp <= 0 or w.mon.hp <= 0: break
            if actor == 'p':
                if pmv == 'rest': continue
                if pmv == 'potion':
                    me.hp = min(me.maxhp, me.hp + CFG['potion_heal'] * me.maxhp)
                    continue
                power = TIERS[pmv]
                d = dmg_roll(me, w.mon, power)
                if pst == 'A': d *= CFG['aggr_dmg']
                if pst == 'G': d *= CFG['guard_dmg']
                fp = me.fullpower
                if fp: d *= CFG['call_fullpower']; me.fullpower = False
                if pst == 'F' and wst == 'G' and not boss_broken:  # player opening
                    w.mon.hp -= d * CFG['opening_dmg'] * CFG['opening_taken']
                    bar += 1; gain_momentum(me); stats['openings'] += 1
                else:
                    pre = d
                    if wst == 'A': d *= CFG['aggr_taken']
                    if wst == 'G' and not fp: d *= CFG['guard_taken']
                    w.mon.hp -= d
                    if pst == 'A' and wst == 'G' and not boss_broken:  # her counter
                        me.hp -= pre * CFG['reflect']
                        me.staggered = True
                        gain_momentum(w.mon); stats['w_counters'] += 1
                        if me.hp <= 0 and hang: me.hp = 1; hang = False
                if w.mon.hp <= 0 and w.hang_on:
                    w.mon.hp = 1; w.hang_on = False
            else:
                if wmv == 'rest': continue
                if wmv == 'curl': w.curl = True; continue
                if wmv == 'milk':
                    w.mon.hp = min(w.mon.maxhp, w.mon.hp + CFG['milk_heal'] * w.mon.maxhp)
                    w.milk_left -= 1; stats['heals'] += 1; continue
                if wmv == 'rollout':
                    stk = min(w.chain + (1 if w.curl else 0), CFG['rollout_maxstk'])
                    power = CFG['rollout_base'] * (CFG['rollout_mult'] ** stk)
                else:
                    power = TIERS['mid']
                d = dmg_roll(w.mon, me, power) * (CFG['aggr_dmg'] if wst == 'A' else 1.0)
                if w.mon.fullpower: d *= CFG['call_fullpower']; w.mon.fullpower = False
                landed = True
                if getback:
                    landed = False; stats['p_dodges'] += 1
                    bar += 1; gain_momentum(me)
                elif pst == 'F' and wst == 'A':
                    p = min(max((me.spd / w.mon.spd - 1) * CFG['dodge_slope'], 0), CFG['dodge_cap'])
                    if wmv == 'rollout': p *= CFG['rollout_relentless']
                    if random.random() < p:
                        landed = False; stats['p_dodges'] += 1
                        bar += 1; gain_momentum(me)
                    else:
                        gain_momentum(w.mon)  # her read-win
                if landed:
                    if wst == 'F' and pst == 'G':  # her opening — stomps through the guard
                        me.hp -= d * CFG['opening_dmg'] * CFG['opening_taken']
                        gain_momentum(w.mon); stats['w_openings'] += 1
                        if me.hp <= 0 and hang: me.hp = 1; hang = False
                    else:
                        taken = d
                        if pst == 'A': taken *= CFG['aggr_taken']
                        if pst == 'G':
                            taken *= CFG['pillar_taken'] if pillars > 0 else CFG['guard_taken']
                        me.hp -= taken
                        if me.hp <= 0 and hang: me.hp = 1; hang = False
                        if pst == 'G' and wst == 'A':  # player counter
                            refl = CFG['pillar_reflect'] if pillars > 0 else CFG['reflect']
                            w.mon.hp -= d * refl
                            w.mon.staggered = True
                            w.chain = 0; w.curl = False
                            bar += 1; gain_momentum(me); stats['counters'] += 1
                            if w.mon.hp <= 0 and w.hang_on:
                                w.mon.hp = 1; w.hang_on = False
                        elif wmv == 'rollout':
                            w.chain = min(w.chain + 1, CFG['rollout_maxstk'])
                            if w.chain >= 2 and pst == 'G' and pillars > 0:
                                pillars -= 1; stats['pillars_smashed'] += 1
                else:
                    w.chain = 0; w.curl = False

        # stamina settle
        def pay(m, mv, st_):
            if mv == 'rest':
                m.st = min(CFG['pool'], m.st + CFG['rest_regen']); return
            if mv == 'potion':
                m.st = min(CFG['pool'], m.st + CFG['regen']); return
            c = CFG['rollout_cost'] if mv == 'rollout' else \
                CFG['milk_cost'] if mv == 'milk' else \
                CFG['cost']['mid'] if mv == 'slam' else \
                CFG['cost']['status'] if mv == 'curl' else CFG['cost'][mv]
            if st_ == 'A': c *= CFG['aggr_cost_mult']
            if st_ == 'F': c += CFG['fluid_cost']
            m.st -= c
            m.st += CFG['regen'] + (CFG['guard_regen'] if st_ == 'G' else 0)
            if m.st <= 0: m.st = 0; m.exhausted = True
            else: m.st = min(CFG['pool'], m.st)
        pay(me, pmv, pst)
        pay(w.mon, wmv, wst)

        if broken_rounds > 0: broken_rounds -= 1
        if bar >= CFG['break_bar']:
            bar = 0; broken_rounds = 1
            w.chain = 0; w.curl = False
            w.phase += 1
            stats['breaks'] += 1

        if me.hp <= 0 or w.mon.hp <= 0: break

    win = w.mon.hp <= 0 and me.hp > 0
    return win, stats


def run(n=3000, hard=False):
    print(f"{'policy':>8} {'win%':>6} {'rounds':>7} {'breaks':>7} {'counters':>9} "
          f"{'dodges':>7} {'heals':>6} {'calls':>6}")
    for name, pol in POLICIES.items():
        agg = Counter(); wins = 0
        for _ in range(n):
            wv, st = fight(pol, hard)
            wins += wv
            for k, v in st.items(): agg[k] += v
        print(f"{name:>8} {100*wins/n:>5.0f}% {agg['rounds']/n:>7.1f} {agg['breaks']/n:>7.2f} "
              f"{agg['counters']/n:>9.2f} {agg['p_dodges']/n:>7.2f} {agg['heals']/n:>6.2f} "
              f"{agg['calls']/n:>6.2f}")


if __name__ == '__main__':
    random.seed(23)
    print("=== WHITNEY — NORMAL (stances visible) ===")
    run()
    print()
    print("=== WHITNEY — HARD (stances hidden, same stats) ===")
    run(hard=True)
