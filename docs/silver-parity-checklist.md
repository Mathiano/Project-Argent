# Silver-Parity Checklist v0.1 — the base game underneath the new features

**The risk this doc exists to kill:** every sprint so far has built a *2026 difference-maker* (Combat 2.0, gust rhythm, Break bars, the dex pipeline). Those are the roof. The **foundation — the actual systems that make Pokémon Silver a game** — is mostly still on paper. This checklist makes the base-game gap visible and schedulable, so Argent doesn't become a brilliant combat engine with no game around it.

Rule: Argent = Silver's whole structure, minus the tedium we explicitly cut (HMs, grind, missables), plus the new layer. Everything in Silver that ISN'T on the cut list must be carried over. The cut list (from the scope doc): HM field tax, grind/level-farming as a requirement, permanently missable content, IV/EV lottery, Game Corner gambling. Everything else ships.

## Legend
✅ built · 🟡 partial · ❌ not started · ✂️ deliberately cut · 🔜 next sprint

## 1. Overworld & exploration

| Silver system | Argent status | Notes |
|---|---|---|
| Grid movement + collision | ✅ | overworld kernel |
| Maps / routes / towns | 🟡 | 3 graybox maps; needs all Johto + Kanto |
| Warps (doors, caves, stairs) | ✅ | kernel |
| Signs / interactables | ✅ | kernel |
| NPCs (static + walking) | 🟡 | data shape exists; walk paths = P1 |
| Encounter zones | ✅ | kernel; CH1 species wired |
| Day/night clock | ❌ | palette-tint design locked, not built |
| Hidden items / field interactions | ❌ | |
| Field skills (HM replacement) | ❌ | charms/key-items design (zero move slots) — pillar law, unbuilt |
| Bicycle / running shoes / speed | ❌ | |
| Surf/whirlpool/waterfall traversal | ❌ | becomes field-skill keys, not HMs |

## 2. The core RPG loop (THE BIG GAPS)

| Silver system | Argent status | Notes |
|---|---|---|
| **Party menu** (view/reorder/summary) | ❌ | load-bearing; nothing exists |
| **PC Box system** (store/withdraw, box-access-anywhere is our P0) | ❌ | |
| **Bag / inventory** | ❌ | |
| **Item usage** (potions, status heal, in & out of battle) | 🟡 | battle assumes a potion bag in sim tuning; no real item system |
| **Shops / Poké Mart** (buy/sell, money) | ❌ | no economy at all yet |
| **Pokémon Center / healing** | ❌ | no heal-and-restore loop — fundamental |
| **Save / load** | ❌ | **critical — the game cannot be shipped or even playtested long without this** |
| **Catching** (basic) | 🟡 | demo-style simple catch in slice; Catching 2.0 is the P0 spec |
| **Money / rewards economy** | ❌ | |
| **Trainer rewards / payout** | ❌ | |

## 3. Battle (the one strong area)

| Silver system | Argent status | Notes |
|---|---|---|
| Turn-based 1v1 | ✅ | engine |
| **6v6 team battles** | ❌ | **architectural gap — flagged twice, next core sprint** |
| Switching | ❌ | depends on team battles |
| Type chart | ✅ | 13×13 canon, injected |
| Moves / PP→stamina | ✅ | stamina model |
| Status conditions (poison, burn, sleep, para…) | ❌ | P1 effect-move hooks; none built |
| Catching in battle | 🟡 | simple; 2.0 pending |
| Run from wild | ✅ | |
| Trainer battles | 🟡 | single-mon only until 6v6 |
| Gym leaders / bosses | 🟡 | Falkner only; boss-card system proven |
| Wild encounters | ✅ | |
| EXP / leveling | 🟡 | level gates movesets (ruling); curve = "gentle" (B), unbuilt as stat growth |
| Evolution | ❌ | 16/34 design locked; **not implemented** — high priority, identity-critical |

## 4. Progression & story

| Silver system | Argent status | Notes |
|---|---|---|
| 8 Johto gyms | 🟡 | 1 of 8 |
| Elite Four + Champion | ❌ | boss ladder designed |
| Rival arc | 🟡 | KAMON demo fight; hesitation arc designed, v2 card pending |
| Team Rocket arc | ❌ | radio tower / well / hideout designed per chapter |
| Full Kanto (8 more gyms) | ❌ | |
| Mt. Silver / Red | ❌ | the thesis fight |
| Badges + gates | 🟡 | Falkner badge awards; gating logic minimal |
| Story scripting / cutscenes | 🟡 | auto-trigger verb exists; no story authored |
| HM-gate replacements (field keys) | ❌ | |

## 5. Systems & menus

| Silver system | Argent status | Notes |
|---|---|---|
| Pokédex (our "journal") | 🟡 | dex DATA exists; no in-game dex UI |
| Save slots / continue | ❌ | see save/load above |
| Options (text speed, etc.) | ❌ | |
| Trainer card / badges display | ❌ | |
| Phone / contacts (our Phone 2.0) | ❌ | P1 design |
| Trade | ✂️/🔜 | no link trades; in-world trade NPCs are P1 content |
| Held items | ❌ | P0 in combat scope, unbuilt |

## The honest read

Argent has the **hardest** part (a novel combat engine, sim-gated and proven) and is missing most of the **standard** part (the RPG scaffolding any Pokémon game needs). The base-game scaffolding is *well-understood, lower-risk* work — but it's a lot of it, and some pieces (save/load, party menu, healing loop, evolution, 6v6) are load-bearing for everything else.

## Proposed foundation sprint order (slot between feature sprints)

1. **6v6 team battles** — unblocks switching, real trainer fights, every boss, bond track. The keystone refactor.
2. **Evolution** — 16/34 trigger; identity-critical, players expect it, currently absent.
3. **Save/load** — can't playtest a 42-hour game without it.
4. **Party + Box + Bag menus** — the core management loop; box-access-anywhere is the P0 promise.
5. **Healing + economy** (Center, Mart, money, rewards) — the route→town→heal→shop rhythm that *is* Pokémon.
6. **Catching 2.0** — upgrade the placeholder catch to the read-based spec.
7. **Status conditions + held items** — the P1 combat-depth hooks.

Features (gyms 2–8, story arcs, Phone 2.0, day/night) interleave — but the foundation list is what turns "a great fight" into "a game."
