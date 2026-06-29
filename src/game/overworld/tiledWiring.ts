// Tiled marker → Argent definition WIRING layer (Phase 8, completes the loop).
//
// The importer (tiledImport.ts) carries named markers through as `importedObjects`
// (name + grid position) but does NOT author behaviour. This layer resolves those
// markers to REAL Argent definitions, emitting the engine's existing inline
// MapObjects into `map.objects` (and spawn points into `map.spawns`) — so a marker
// becomes an actual interactable NPC / a working warp via the SAME system every
// hand-authored map uses (createOverworldScene reads map.objects / map.spawns).
//
// The naming convention IS the contract (Tiled = where, CC = what, joined by name):
//   npc_<id>       → NPC_DEFS["npc_<id>"]       → an inline npc MapObject at the marker
//   warp_<id>      → WARP_DEFS["warp_<id>"]     → a warp MapObject (target "MAP:spawn")
//   sign_<id>      → SIGN_DEFS["sign_<id>"]     → a sign MapObject (lines)
//   encounter_<id> → ENCOUNTER_DEFS[...]        → an encounter_zone over the marker
//                    RECTANGLE (x/y/w/h) with the def's species + rate
//   mon_<id>       → MON_DEFS["mon_<id>"]       → an overworld creature (sprite NPC)
//   spawn_<name>   → map.spawns["<name>"]       → a spawn point (facing from the
//                    marker's `facing` property, default down) warps can land on
//   script_<id>    → SKIPPED — scripts stay code-authored (logic, not spatial markers)
// Unknown prefix / missing definition → WARN + skip (never crash) — same robustness
// as the importer. See docs/tiled-importer.md §wiring.

import type { MapData, MapObject, Spawn } from './types';

// A definition is the inline MapObject MINUS its placement (type/x/y) — the marker
// supplies x/y, the registry supplies the behaviour.
export type NpcDef = Omit<Extract<MapObject, { type: 'npc' }>, 'type' | 'x' | 'y'>;
export type WarpDef = { readonly target: string };
export type SignDef = Omit<Extract<MapObject, { type: 'sign' }>, 'type' | 'x' | 'y'>;
// An encounter-zone def: the marker rectangle supplies x/y/w/h (where + how big),
// the def supplies the wild table (what mons) + the per-step roll rate.
export type EncounterDef = { readonly species: readonly string[]; readonly rate: number };
// A `mon_*` marker → an overworld creature: a sprite NPC (the existing npc `sprite`
// path — a visible, examinable mon in the world, e.g. a lost FLITPECK).
export type MonDef = Omit<Extract<MapObject, { type: 'npc' }>, 'type' | 'x' | 'y'>;

export interface WiringDefs {
  readonly npc: { readonly [name: string]: NpcDef };
  readonly warp: { readonly [name: string]: WarpDef };
  readonly sign?: { readonly [name: string]: SignDef };
  readonly encounter?: { readonly [name: string]: EncounterDef };
  readonly mon?: { readonly [name: string]: MonDef };
}

// Trainer winFlags whose victory unlocks the Call economy (the designed bond-gated
// unlock — the mon-defends-you moment). main.ts's pushTrainerFight reads THIS set
// and sets the EXISTING run.catchBreathUnlocked (what callsUnlocked() checks) — NOT a
// parallel flag. JAY is the Route 31 unlock beat. See docs/tiled-importer.md.
export const CALLS_UNLOCK_ON_WIN: ReadonlySet<string> = new Set(['r31big_jay_beaten']);

// CC-maintained marker definitions. Add an entry here to give a Tiled marker
// behaviour; Mathias places the matching-named marker in the map. Seeded with the
// test markers so the importer→wiring loop is demonstrably complete.
export const DEFAULT_DEFS: WiringDefs = {
  npc: {
    npc_test: {
      color: '#d22f2f',
      interact: [
        { kind: 'dialog', lines: ['A test NPC, placed in Tiled.', 'The marker wired to a real def —', 'the loop is closed.'] },
      ],
    },
    // Kitchen-sink: a real TRAINER NPC — blocks until beaten, talks then battles,
    // pays a reward, and has a post-win line. Minimal content, real wiring.
    npc_trainer_1: {
      color: '#3a6ea5',
      facing: 'down',
      blockedUntilFlag: 'kitchen_trainer_1_beaten',
      interact: [
        { kind: 'dialog', lines: ['YOUNGSTER JOEY:', "You can't walk past me!", "Let's battle!"] },
        { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'kitchen_trainer_1_beaten', reward: 200 },
      ],
      interactAfterFlag: [
        { kind: 'dialog', lines: ['YOUNGSTER JOEY:', 'My FLITPECK is still the best!'] },
      ],
    },
    // Kitchen-sink: a flavor dialogue NPC.
    npc_flavor_1: {
      color: '#7c4fa8',
      interact: [{ kind: 'dialog', lines: ['A traveller rests by the path.', "Nice day for a walk, isn't it?"] }],
    },

    // ── Route 31 Phase 2 — real content (Argent tone: mature, TW3/ME-toned) ──

    // JAY — the gentle roadside robber (carried-forward canon) + THE Calls-unlock
    // beat. approachOnEnter: he walks up on entry. The mon steps in front to defend
    // the player → post-win, that bond moment unlocks the Call economy (wired in
    // main.ts via CALLS_UNLOCK_ON_WIN ← winFlag 'r31big_jay_beaten'). The dialogue is
    // the narrative wrapper; the flag is the payload.
    npc_jay: {
      color: '#c2491a',
      approachOnEnter: true,
      blockedUntilFlag: 'r31big_jay_beaten',
      interact: [
        { kind: 'dialog', lines: [
          'JAY: Hand over your — ...huh.',
          "You've barely got anything, have you.",
          'Just started. ...Forget it.',
          "Battle me anyway. A guy's got to",
          'win at SOMETHING today.'] },
        { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'r31big_jay_beaten', reward: 500 },
      ],
      interactAfterFlag: [
        { kind: 'dialog', lines: [
          '...It stepped in front of you.',
          'JAY: Took the hit FOR you. Nobody',
          'told it to. That’s not a pet you',
          'caught — that’s a partner who chose you.',
          'JAY: Whatever just settled between',
          'you two — lean on it. Call to it,',
          'and it’ll answer. ...Go on. Get.'] },
      ],
    },

    // BIRDWATCHER — obsessive, precise; his count is OFF and it unsettles him (a
    // faint seed of the route's wrongness).
    npc_birdwatcher_1: {
      color: '#5a7a4a',
      interact: [{ kind: 'dialog', lines: [
        'BIRDWATCHER: Forty-one GALEHAWK on',
        'this stretch. I know every one by',
        'the notch in its wing.',
        'BIRDWATCHER: There were forty-three',
        'in spring. Birds don’t just leave.',
        'BIRDWATCHER: ...Something moved them',
        'on. I’d give a great deal to know what.'] }],
    },

    // AFRAID OF STONES — semi-comic (the Matko register), but the kernel is real:
    // GRITHOAX camouflage means you genuinely can't tell which rock is alive.
    npc_afraid_of_stones: {
      color: '#9a8a6a',
      interact: [{ kind: 'dialog', lines: [
        'He stands well back from the cave rocks.',
        'MAN: Don’t. Don’t go near the stones.',
        'One of them MOVED. I felt it watching.',
        'MAN: ...A GRITHOAX, you’ll say. A fat',
        'rock-toad. Sure. Looks just like a stone.',
        'MAN: That’s the whole PROBLEM, isn’t it.',
        'Which ones aren’t?'] }],
    },

    // HEALER — a weary field-medic of the dying era. Heals via the EXISTING heal-party
    // verb. "Ask nicely" is in the writing (the system has no dialog choice yet).
    npc_healer: {
      color: '#b86a8a',
      interact: [
        { kind: 'dialog', lines: [
          'WOMAN: You carry them like they',
          'matter. Most don’t, these days.',
          'WOMAN: Sit them down. I’ve set more',
          'bones this year than the ten before.',
          'The roads turned hard.'] },
        { kind: 'heal-party' },
        { kind: 'dialog', lines: [
          'WOMAN: There. Good as the morning.',
          'WOMAN: Mind how you go — and mind WHO',
          'you trust out here. Not everyone asks',
          'as kindly as you did.'] },
      ],
    },

    // LOST KID (PIP's owner) — the lost-FLITPECK quest. blockedUntilFlag flips to the
    // reunion once the bird is found (mon_lost_bird sets r31big_pip_found). Reward is
    // dialogue-only here; a one-time item reward is a code-authored step-on script
    // (PROPOSED — see report). Carries real weight in a darker world.
    npc_lost_kid: {
      color: '#9aaecf',
      blockedUntilFlag: 'r31big_pip_found',
      interact: [{ kind: 'dialog', lines: [
        'KID: Have you seen PIP? A FLITPECK —',
        'small, scared of his own shadow.',
        'KID: We got split in the grass. He',
        'sings three notes, can’t hold a fourth',
        'to save his life. If you hear it...',
        'KID: ...please. He’s never been alone.'] }],
      // PIP stays at its find-spot (no follower-mon mechanic yet —
      // docs/follower-mon-mechanic-BACKLOG.md), so the reunion is narrative: the kid
      // goes to PIP. The one-time SUPER POTION reward is a code-authored step-on
      // script injected at the build (route 31 phase-2), the live-route pattern.
      interactAfterFlag: [{ kind: 'dialog', lines: [
        'KID: You found him? By the reeds — really?',
        '(The kid is already moving, calling',
        'PIP’s name, the three-note whistle',
        'spilling out wrong and not caring.)',
        'KID: Wait — here. For helping. Go on, take it.'] }],
    },
  },

  // mon_* markers → overworld creatures (sprite NPCs).
  mon: {
    // PIP, the lost FLITPECK. Wary until you whistle the three notes the kid taught
    // you (the find beat); sets r31big_pip_found, which flips both PIP and the kid.
    mon_lost_bird: {
      sprite: 'FLITPECK', spriteType: 'GALE',
      blockedUntilFlag: 'r31big_pip_found',
      interact: [
        { kind: 'dialog', lines: [
          'A FLITPECK, ruffled and wary, wedged',
          'under a root. It won’t let you near —',
          'until you whistle the three notes.',
          'It freezes. Then it hops, once,',
          'toward you. Toward home.'] },
        { kind: 'set-flag', flag: 'r31big_pip_found' },
      ],
      interactAfterFlag: [{ kind: 'dialog', lines: [
        'PIP pads after you, peeping its',
        'three-note song — braver now.'] }],
    },
  },
  warp: {
    // Trivial-but-real destination: HEARTHWICK has a "fromRoute" spawn. Stepping on
    // the warp tile transitions maps, proving the wired warp works.
    warp_test: { target: 'HEARTHWICK:fromRoute' },
    // Kitchen-sink: a second warp to a different map. NOTE: the destination comes
    // from HERE (WARP_DEFS), NOT from the marker's target_map/target_z properties.
    warp_next_map: { target: 'VIOLET:fromRoute' },
    // Route 31 Phase 1: the two route boundary warps (Hearthwick ↔ Violet).
    warp_north: { target: 'HEARTHWICK:fromRoute' },
    warp_south: { target: 'VIOLET:fromRoute' },
  },
  encounter: {
    // A small test wild zone (the marker rectangle decides where/how big).
    encounter_test: { species: ['FLITPECK'], rate: 0.18 },
    // Kitchen-sink + Route 31: distinct zone types share a def by name. route31a =
    // grassland, route31b = cave, water1a = water (species/rates per the B spec). Each
    // same-named marker becomes its own zone at its own rectangle.
    encounter_route31a: { species: ['FLITPECK', 'GALEHAWK'], rate: 0.18 },
    encounter_route31b: { species: ['GRITHOAX'], rate: 0.45 },
    encounter_water1a: { species: ['MARSHMASH'], rate: 0.3 },
  },
};

export interface WireResult {
  readonly map: MapData;
  readonly warnings: readonly string[];
}

// Resolve an imported map's markers into real MapObjects / spawns. Returns a NEW
// MapData with `objects`/`spawns` populated and `importedObjects` consumed (removed
// so the placeholder markers no longer render — the real objects do). Unresolved
// markers are warned + dropped.
export function wireImportedMap(map: MapData, defs: WiringDefs = DEFAULT_DEFS): WireResult {
  const warnings: string[] = [];
  const objects: MapObject[] = [...map.objects];
  const spawns: { [id: string]: Spawn } = { ...map.spawns };

  for (const m of map.importedObjects ?? []) {
    const prefix = m.name.split('_')[0];
    if (prefix === 'npc') {
      const def = defs.npc[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no NPC definition (add it to NPC_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'npc', x: m.x, y: m.y, ...def });
    } else if (prefix === 'mon') {
      const def = defs.mon?.[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no MON definition (add it to MON_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'npc', x: m.x, y: m.y, ...def }); // overworld creature = a sprite NPC
    } else if (prefix === 'warp') {
      const def = defs.warp[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no WARP definition (add it to WARP_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'warp', x: m.x, y: m.y, target: def.target });
    } else if (prefix === 'sign') {
      const def = defs.sign?.[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no SIGN definition (add it to SIGN_DEFS) — skipped.`);
        continue;
      }
      objects.push({ type: 'sign', x: m.x, y: m.y, ...def });
    } else if (prefix === 'encounter') {
      const def = defs.encounter?.[m.name];
      if (!def) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) has no ENCOUNTER definition (add it to ENCOUNTER_DEFS) — skipped.`);
        continue;
      }
      objects.push({
        type: 'encounter_zone',
        x: m.x, y: m.y, width: m.w, height: m.h,
        species: def.species, rate: def.rate,
      });
    } else if (prefix === 'spawn') {
      const spawnName = m.name.slice('spawn_'.length);
      if (!spawnName) {
        warnings.push(`marker "${m.name}" at (${m.x},${m.y}) — a spawn marker needs a name (spawn_<name>) — skipped.`);
        continue;
      }
      // Facing from the marker's `facing` custom property (e.g. a south gate that
      // should face up); defaults to 'down' when unset.
      spawns[spawnName] = { x: m.x, y: m.y, facing: m.facing ?? 'down' };
    } else if (prefix === 'script') {
      // HYBRID DECISION: scripts (give-item, set-flag, quest chains, tutorial-catch)
      // stay CODE-AUTHORED — they're logic, not spatial markers. Not wired from Tiled.
      warnings.push(`marker "${m.name}" at (${m.x},${m.y}) — scripts are code-authored, not Tiled markers — skipped.`);
    } else {
      warnings.push(`marker "${m.name}" at (${m.x},${m.y}) — unknown prefix (expected npc_/mon_/warp_/sign_/spawn_/encounter_) — skipped.`);
    }
  }

  // Drop the now-resolved placeholder markers; keep the imported tile layers.
  const { importedObjects: _consumed, ...rest } = map;
  void _consumed;
  return { map: { ...rest, objects, spawns }, warnings };
}
