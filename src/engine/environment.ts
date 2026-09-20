// Combat Layer 3 — ENVIRONMENTS (docs/combat-enrichment-roadmap.md §LAYER 3).
//
// Where you fight matters, mechanically. Each environment TILTS the stance
// triangle and the FOCUS releases a little, and carries a META-READ: a trainer
// who knows this ground plays to it, so the terrain telegraphs their tendency
// before the fight starts. That is the layer's real depth — an anticipatory
// read stacked on top of the per-round one, and it ties combat to the
// "journeys, not corridors" content pillar.
//
// VOCABULARY NOTE. The roadmap's table predates the FOCUS rebuild and is
// written in the superseded two-step words (Charge / Brace / Hide). Mapped onto
// the shipped model: "Brace" is the GUARD stance, "Charge" is the HEAVY
// release, "Hide" is the HIDE release. Every multiplier below traces to one
// phrase in that table — nothing is invented:
//
//   Forest/tall grass  helps Fluid, Hide      hurts Charge
//   Fog/rain           helps Fluid            hurts Aggressive (miss)
//   Frozen/ice         helps Aggressive       hurts Guard/Brace
//   Rocky/cover        helps Guard, Hide      hurts Fluid
//   Cliff/height       helps Charge, Aggr.    hurts Hide
//   Sand/mud           helps Guard            hurts Fluid, Charge
//
// LEAK CAP (the roadmap's discipline): this adds NO new per-turn resource and
// NO new number to track. It re-weights choices the player already makes, and
// the whole tilt is legible as one line of arena text.

import type { EnvironmentId, ReleaseKind, Stance } from './types';

export type { EnvironmentId };

export interface Environment {
  readonly id: EnvironmentId;
  readonly label: string;
  // The player-facing tell, shown when the battle opens. The tilt is never a
  // hidden number — Layer 3.5 hides RESOURCES, not the rules of the ground.
  readonly blurb: string;
  // × on damage DEALT while in this stance.
  readonly stanceDealt: Readonly<Record<Stance, number>>;
  // × on damage TAKEN while in this stance. This is where a defensive stance's
  // edge lives: bracing on ice protects LESS (>1), bracing on rock more (<1).
  readonly stanceTaken: Readonly<Record<Stance, number>>;
  // × on a FOCUS release's damage.
  readonly release: Readonly<Record<ReleaseKind, number>>;
  // FLAT stamina delta per round, for the side holding this stance. NEGATIVE
  // costs, POSITIVE gives back.
  //
  // This is the layer's PRIMARY lever, and the damage tilts above are the
  // garnish — a sim sweep showed raw damage is remarkably weak here: cutting
  // Aggressive damage 24% in one biome moved its win rate by 2pp, because the
  // triangle's structural effects (punish, counter-reflect, stagger, daze) and
  // the stamina economy decide fights, not marginal damage. Stamina is the
  // lever that bites, and it is also what the design doc actually describes:
  // mud "slows mobility", forest leaves "no room to wind up". Against a +8
  // base regen, a -6 here nearly cancels a stance's recovery — terrain you
  // have to fight around, which is the point.
  readonly stanceStamina: Readonly<Record<Stance, number>>;
  // The META-READ. A trainer whose profile claims this terrain plays TO it:
  // leaning into `favors`, away from `avoids`. Null = no lean.
  readonly favors: Stance | null;
  readonly avoids: Stance | null;
}

const NONE = { A: 1, G: 1, F: 1 } as const;
const NO_REL = { heavy: 1, feint: 1, hide: 1 } as const;
const NO_ST = { A: 0, G: 0, F: 0 } as const;

// Tilts are deliberately SMALL (±8–12%). The Monte Carlo finding the roadmap
// records is that this system's failure mode is a dominant strategy, so an
// environment must colour a fight, never decide it. Gated by
// src/sim/environmentBalance.test.ts, which asserts no stance runs away with
// any biome.
export const ENVIRONMENTS: { readonly [K in EnvironmentId]: Environment } = {
  open: {
    id: 'open', label: 'OPEN FIELD', blurb: 'Open ground — nothing favours anyone.',
    stanceDealt: NONE, stanceTaken: NONE, release: NO_REL, stanceStamina: NO_ST, favors: null, avoids: null,
  },
  forest: {
    id: 'forest', label: 'FOREST', blurb: 'Close cover — good for slipping and hiding, no room to wind up.',
    stanceDealt: { A: 1, G: 1, F: 1.1 }, stanceTaken: NONE,
    release: { heavy: 0.88, feint: 1, hide: 1.12 },
    // Cover to slip through; nowhere to plant your feet and wind up.
    stanceStamina: { A: -3, G: 0, F: 3 }, favors: 'F', avoids: null,
  },
  fog: {
    id: 'fog', label: 'FOG', blurb: 'You can barely see — precise aggression goes wide.',
    stanceDealt: { A: 0.88, G: 1, F: 1.08 }, stanceTaken: NONE,
    release: NO_REL,
    // You cannot commit to what you cannot see; drifting is cheap.
    stanceStamina: { A: -4, G: 0, F: 2 }, favors: 'F', avoids: 'A',
  },
  ice: {
    id: 'ice', label: 'ICE', blurb: 'Slick ground — momentum pays, standing still does not.',
    stanceDealt: { A: 1.1, G: 1, F: 1 }, stanceTaken: { A: 1, G: 1.12, F: 1 },
    release: NO_REL,
    // Momentum is free on ice; setting your feet to brace is not.
    stanceStamina: { A: 3, G: -6, F: 0 }, favors: 'A', avoids: 'G',
  },
  rocky: {
    id: 'rocky', label: 'ROCKY', blurb: 'Hard cover — easy to brace behind, hard to flow through.',
    // Guard HOLDS better here but CONVERTS worse: you win nothing from behind
    // a rock. That second half is load-bearing, not flavour — see the note on
    // stanceDealt.G in mud.
    stanceDealt: { A: 1, G: 0.92, F: 0.9 },
    // NO extra Guard mitigation here. Guard already mitigates to 0.60 and is
    // the strongest pure stance in the open; stacking a mitigation bonus on top
    // of the stamina reward made PureGUARD DOMINANT on this ground (68% and
    // beating Balanced) — the exact in-biome dominant strategy the Layer 3 gate
    // exists to catch. The ground still "helps Guard", through stamina alone.
    stanceTaken: NONE,
    release: { heavy: 1, feint: 1, hide: 1.1 },
    // Hard cover rewards the brace and breaks up any flowing line.
    // Guard gets NOTHING directly. It already regens +6 and is the stamina
    // king; handing the strongest stance more stamina is what made this ground
    // dominant (65%, still topping Balanced) even after the mitigation bonus
    // came off. The ground "helps Guard" RELATIVELY, by taxing the flowing
    // line — which is also the truer reading of hard cover.
    stanceStamina: { A: 0, G: 0, F: -2 }, favors: 'G', avoids: 'F',
  },
  cliff: {
    id: 'cliff', label: 'HEIGHTS', blurb: 'Nowhere to hide up here — commitment wins.',
    stanceDealt: { A: 1.1, G: 1, F: 1 }, stanceTaken: NONE,
    release: { heavy: 1.1, feint: 1, hide: 0.85 },
    // Exposed ground: committing forward is easy, circling is not.
    stanceStamina: { A: 3, G: 0, F: -3 }, favors: 'A', avoids: null,
  },
  mud: {
    id: 'mud', label: 'MUD', blurb: 'Heavy going — the patient hold beats the quick step.',
    // The G:0.94 is a COMPENSATION, and the reason is structural. In an
    // A>F>G>A triangle you cannot tax one stance without paying another: Fluid
    // is Guard's ONLY losing matchup, so any ground that hurts Fluid protects
    // Guard exactly where it is weakest, and Guard runs away with the biome
    // (measured: 68%, above Balanced — a dominant strategy). Slowing Guard's
    // conversion cancels that knock-on without touching the doc's "hurts Fluid".
    stanceDealt: { A: 1, G: 0.92, F: 0.88 },
    stanceTaken: NONE, // same reason as rocky — see above
    release: { heavy: 0.92, feint: 1, hide: 1 },
    // Every step costs; the patient hold barely moves at all.
    stanceStamina: { A: -2, G: 0, F: -3 }, favors: 'G', avoids: 'F', // relative, as rocky
  },
};

export const ENVIRONMENT_IDS: readonly EnvironmentId[] = Object.keys(ENVIRONMENTS) as EnvironmentId[];

// Resolve an environment for a battle. Absent/unknown → OPEN, whose every
// multiplier is 1, so an un-environmented battle is bit-identical.
export function environmentFor(id: EnvironmentId | undefined): Environment {
  return id !== undefined ? ENVIRONMENTS[id] ?? ENVIRONMENTS.open : ENVIRONMENTS.open;
}

export function envStanceDealt(env: Environment | undefined, stance: Stance): number {
  return env ? env.stanceDealt[stance] : 1;
}
export function envStanceTaken(env: Environment | undefined, stance: Stance): number {
  return env ? env.stanceTaken[stance] : 1;
}
export function envRelease(env: Environment | undefined, release: ReleaseKind): number {
  return env ? env.release[release] : 1;
}
// Flat ST the ground gives (+) or takes (-) from a side holding this stance.
export function envStamina(env: Environment | undefined, stance: Stance): number {
  return env ? env.stanceStamina[stance] : 0;
}

// The meta-read, as a stance-weight nudge. A trainer only plays to terrain it
// CLAIMS (profile.terrain) — a visitor fights the same everywhere, which is
// itself information: the local reads the ground, the stranger does not.
export const TERRAIN_LEAN = 1.6; // × on the favoured stance's weight
export const TERRAIN_SHUN = 0.5; // × on the shunned one's

export function terrainStanceMix(
  mix: readonly [number, number, number],
  env: Environment | undefined,
  profileTerrain: string | undefined,
): readonly [number, number, number] {
  if (!env || profileTerrain === undefined || profileTerrain !== env.id) return mix;
  if (env.favors === null && env.avoids === null) return mix;
  const idx: Record<Stance, 0 | 1 | 2> = { A: 0, G: 1, F: 2 };
  const out: [number, number, number] = [mix[0], mix[1], mix[2]];
  if (env.favors) out[idx[env.favors]] *= TERRAIN_LEAN;
  if (env.avoids) out[idx[env.avoids]] *= TERRAIN_SHUN;
  return out;
}
