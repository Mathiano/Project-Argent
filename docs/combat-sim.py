import random
from collections import Counter

TIERS = {'light': 55, 'mid': 80, 'heavy': 110, 'nuke': 140}
WEIGHT = {'light': 0.85, 'mid': 1.0, 'heavy': 1.15, 'nuke': 1.3}
BEATS = {'A': 'G', 'G': 'F', 'F': 'A'}  # to beat key, play value

CFG = dict(
    pool=100, hp=300, dmg_scale=0.85,
    cost={'light': 12, 'mid': 22, 'heavy': 35, 'nuke': 55},
    regen=8, guard_regen=6, fluid_cost=12, aggr_cost_mult=1.15,
    winded=25, exh_taken=1.25, rest_regen=25,
    aggr_dmg=1.25, aggr_taken=1.15,
    guard_dmg=0.75, guard_taken=0.60, reflect=0.50,
    opening_dmg=1.15, opening_taken=0.85,
    dodge_slope=2.0, dodge_cap=0.90,
    clash_mult=0.70, clash_chip=0.08, clash_window=0.15,
    stagger_init=0.5,
)


class Mon:
    def __init__(self, spd=100, atk=100, dfn=100):
        self.hp = CFG['hp']; self.st = CFG['pool']
        self.spd = spd; self.atk = atk; self.dfn = dfn
        self.staggered = False; self.exhausted = False


def affordable(mon):
    out = []
    for t, c in CFG['cost'].items():
        if mon.st >= c:
            if t in ('heavy', 'nuke') and mon.st <= CFG['winded']:
                continue
            out.append(t)
    return out


# ---------------- policies ----------------
def pol_random(me, foe, foe_hist):
    ts = affordable(me)
    if not ts: return None, None
    return random.choice(ts), random.choice('AGF')

def pol_heavyspam(me, foe, foe_hist):
    ts = affordable(me)
    if not ts: return None, None
    best = max(ts, key=lambda t: TIERS[t])
    return best, 'A'

def pol_turtle(me, foe, foe_hist):
    ts = affordable(me)
    if not ts: return None, None
    return ('light' if 'light' in ts else ts[0]), 'G'

def pol_dodger(me, foe, foe_hist):
    ts = affordable(me)
    if not ts: return None, None
    return ('mid' if 'mid' in ts else ts[0]), 'F'

def stamina_tier(me):
    ts = affordable(me)
    if not ts: return None
    if me.st > 70:
        for pref in ('heavy', 'mid', 'light'):
            if pref in ts: return pref
    if me.st > 40:
        return 'mid' if 'mid' in ts else ts[0]
    return 'light' if 'light' in ts else ts[0]

def pol_balanced(me, foe, foe_hist):
    t = stamina_tier(me)
    if t is None: return None, None
    s = 'G' if me.st < 35 else random.choice('AGF')
    return t, s

def pol_reader(me, foe, foe_hist):
    t = stamina_tier(me)
    if t is None: return None, None
    if foe_hist:
        common = Counter(foe_hist[-3:]).most_common(1)[0][0]
        s = BEATS[common]
    else:
        s = random.choice('AGF')
    return t, s

POLICIES = {'Random': pol_random, 'HeavyAggr': pol_heavyspam, 'Turtle': pol_turtle,
            'Dodger': pol_dodger, 'Balanced': pol_balanced, 'Reader': pol_reader}


# ---------------- battle ----------------
def raw_damage(att, dfn, tier):
    return TIERS[tier] * att.atk / dfn.dfn * CFG['dmg_scale'] * random.uniform(0.9, 1.0)

def stance_out(dmg, s):
    if s == 'A': return dmg * CFG['aggr_dmg']
    if s == 'G': return dmg * CFG['guard_dmg']
    return dmg

def stance_in(dmg, s, defender):
    if s == 'A': dmg *= CFG['aggr_taken']
    if s == 'G': dmg *= CFG['guard_taken']
    if defender.exhausted: dmg *= CFG['exh_taken']
    return dmg

def try_dodge(defender, attacker):
    ratio = defender.spd / attacker.spd
    p = min(max((ratio - 1) * CFG['dodge_slope'], 0.0), CFG['dodge_cap'])
    return random.random() < p

def strike(att, dfn, tier, s_att, s_def, stats):
    dmg = stance_out(raw_damage(att, dfn, tier), s_att)
    if s_att == 'A' and s_def == 'F':
        stats['dodge_try'] += 1
        if try_dodge(dfn, att):
            stats['dodge_ok'] += 1
            return
    if s_att == 'F' and s_def == 'G':  # opening found
        stats['openings'] += 1
        d_in = dmg * CFG['opening_dmg'] * CFG['opening_taken']
        if dfn.exhausted: d_in *= CFG['exh_taken']
        dfn.hp -= d_in
        return
    dfn.hp -= stance_in(dmg, s_def, dfn)
    if s_def == 'G' and s_att == 'A':  # counter
        att.hp -= dmg * CFG['reflect']
        att.staggered = True
        stats['counters'] += 1

def pay(mon, tier, stance):
    cost = CFG['cost'][tier]
    if stance == 'A': cost *= CFG['aggr_cost_mult']
    if stance == 'F': cost += CFG['fluid_cost']
    mon.st -= cost
    mon.st += CFG['regen'] + (CFG['guard_regen'] if stance == 'G' else 0)
    if mon.st <= 0:
        mon.st = 0; mon.exhausted = True
        return True
    mon.st = min(CFG['pool'], mon.st)
    return False

def battle(pa, pb, sa=100, sb=100):
    a, b = Mon(spd=sa), Mon(spd=sb)
    ha, hb = [], []
    stats = Counter()
    for rnd in range(1, 61):
        stats['rounds'] = rnd
        # exhausted recovery turns
        for m in (a, b):
            if m.exhausted:
                m.st = min(CFG['pool'], m.st + CFG['rest_regen'])
        acts = {}
        for me, foe, fh, mh, pol in ((a, b, hb, ha, pa), (b, a, ha, hb, pb)):
            if me.exhausted:
                me.exhausted = False  # spent the round resting
                acts[me] = None
                stats['exhaust_rounds'] += 1
                continue
            t, s = pol(me, foe, fh)
            if t is None:
                me.st = min(CFG['pool'], me.st + CFG['rest_regen'])
                acts[me] = None
                stats['forced_rest'] += 1
                continue
            acts[me] = (t, s)
            mh.append(s)
        ta, tb = acts[a], acts[b]
        # initiative
        def init(m, act):
            base = m.spd / WEIGHT[act[0]]
            if m.staggered: base *= CFG['stagger_init']
            return base
        order = []
        if ta and tb:
            ia, ib = init(a, ta), init(b, tb)
            # fluid beats guard: forced first, counter moot
            if ta[1] == 'F' and tb[1] == 'G': order = [(a, b, ta, tb), (b, a, tb, ta)]
            elif tb[1] == 'F' and ta[1] == 'G': order = [(b, a, tb, ta), (a, b, ta, tb)]
            elif ta[1] == 'A' and tb[1] == 'A' and abs(ia - ib) / max(ia, ib) < CFG['clash_window']:
                stats['clashes'] += 1
                pwr_a = TIERS[ta[0]] * a.st / CFG['pool']
                pwr_b = TIERS[tb[0]] * b.st / CFG['pool']
                w, l, tw = (a, b, ta) if pwr_a + random.uniform(-1, 1) >= pwr_b else (b, a, tb)
                dmg = stance_out(raw_damage(w, l, tw[0]), 'A') * CFG['clash_mult']
                l.hp -= stance_in(dmg, 'A', l)
                w.hp -= CFG['hp'] * CFG['clash_chip']
                l.staggered = True
                pay(a, *ta); pay(b, *tb)
                a.staggered = a.staggered and a is l; b.staggered = b.staggered and b is l
                if a.hp <= 0 or b.hp <= 0: break
                continue
            else:
                first = (random.random() < 0.5) if abs(ia - ib) < 1e-9 else (ia > ib)
                order = [(a, b, ta, tb), (b, a, tb, ta)] if first else [(b, a, tb, ta), (a, b, ta, tb)]
        elif ta: order = [(a, b, ta, None)]
        elif tb: order = [(b, a, tb, None)]
        a.staggered = b.staggered = False
        for att, dfn, act, dact in order:
            if att.hp <= 0: continue
            strike(att, dfn, act[0], act[1], dact[1] if dact else 'N', stats)
            if dfn.hp <= 0: break
        if ta: 
            if pay(a, *ta): stats['exhaustions'] += 1
        if tb:
            if pay(b, *tb): stats['exhaustions'] += 1
        if a.hp <= 0 or b.hp <= 0: break
    stats['winded_end'] = int(a.st <= CFG['winded']) + int(b.st <= CFG['winded'])
    if a.hp <= 0 and b.hp <= 0: return 0.5, stats
    if b.hp <= 0: return 1, stats
    if a.hp <= 0: return 0, stats
    return 0.5, stats


def run_matrix(n=2000):
    names = list(POLICIES)
    print(f"{'':>10}", *[f"{x:>9}" for x in names], sep='')
    agg = Counter()
    for pa in names:
        row = [f"{pa:>10}"]
        for pb in names:
            wins = rounds = 0
            for _ in range(n):
                w, st = battle(POLICIES[pa], POLICIES[pb])
                wins += w; rounds += st['rounds']
                for k in ('clashes', 'counters', 'openings', 'exhaustions', 'dodge_try', 'dodge_ok'):
                    agg[k] += st[k]
                agg['battles'] += 1; agg['rounds'] += st['rounds']
            row.append(f"{100*wins/n:>8.0f}%")
        print(''.join(row))
    print(f"\navg rounds {agg['rounds']/agg['battles']:.1f} | "
          f"clash/battle {agg['clashes']/agg['battles']:.2f} | "
          f"counter/battle {agg['counters']/agg['battles']:.2f} | "
          f"openings/battle {agg['openings']/agg['battles']:.2f} | "
          f"exhaustions/battle {agg['exhaustions']/agg['battles']:.2f} | "
          f"dodge rate {100*agg['dodge_ok']/max(1,agg['dodge_try']):.0f}%")


def speed_sweep():
    print("\nDodge speed sweep: HeavyAggr(100 spd) vs Dodger(X spd)")
    print(f"{'dodger spd':>10} {'dodge%':>8} {'dodger win%':>12} {'avg rounds':>11}")
    for spd in (85, 100, 110, 125, 150):
        wins = dt = dk = rr = 0
        n = 2000
        for _ in range(n):
            w, st = battle(POLICIES['HeavyAggr'], POLICIES['Dodger'], sa=100, sb=spd)
            wins += (1 - w); dt += st['dodge_try']; dk += st['dodge_ok']; rr += st['rounds']
        print(f"{spd:>10} {100*dk/max(1,dt):>7.0f}% {100*wins/n:>11.0f}% {rr/n:>11.1f}")


if __name__ == '__main__':
    random.seed(17)
    print("=== CONFIG v0.3 (tuned) ===")
    run_matrix()
    speed_sweep()
