// Batch validator — the commission kit's validation pass, mechanised
// (docs/mon-commission-kit.md "Validation pass"; gym2-plan Step 3). A chapter
// batch (docs/ch1-batch.json today) is checked against the slot manifest
// (docs/mon-manifest.csv) and the doc-settled authoring rules ONLY:
//   · slot coverage per bucket, no extras (kit pass 1)
//   · line_id / stage / types / archetype / rarity match the manifest row
//   · types are UPPERCASE canon types present in docs/typechart.json
//   · naming law: 4–9 chars, ALL CAPS, no collisions (kit prompt NAMES + pass 2)
//   · dexEntry is exactly 2 sentences (kit prompt DEX ENTRIES + pass 4)
//   · every learnset move resolves in the engine registry
//   · movePoolIssues clean at a caller-supplied level (two-pool model §2)
//   · evoLine matches the manifest chain (next stage's name, evolve_at)
//   · no nuke in a learnset except the __SIGNATURE_RESERVED__ slot
//     (move-pool.md: "Nukes … never pool moves … authored individually")
//   · missing stamina is a WARNING (dexLoader defaults it; not an error)
//
// It reports; it re-stats nothing and never edits data. Stat derivation and the
// batch sim (kit passes 5–6) are NOT here — the archetype base table is an open
// ruling, and the batch sim lives in ch1Batch.ts.
//
// Pure: data in, issues out. No fs, no DOM; move lookup goes through the engine
// registry (the same one movePoolIssues reads).

import movesData from '../../docs/moves.json';
import { loadMoves, loadSpeciesAt, lookupMove, movePoolIssues, registerMoves } from '../engine';
import type { DexEntryJson, ManifestRow, MoveJson, TypeChart } from '../engine';

// The reserved stage-3 signature slot (authored later on boss cards / batch
// finalization — ch1-batch-sheet.md). Exempt from the registry + nuke checks.
export const SIGNATURE_RESERVED = '__SIGNATURE_RESERVED__';

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  registerMoves(loadMoves(movesData as MoveJson[]));
  registered = true;
}

// ── Manifest ────────────────────────────────────────────────────────────────

// The manifest row + its parser live in the engine (src/engine/manifest.ts) —
// ONE parser shared with the game's placeholder silhouettes. Re-exported here so
// this module's public surface is unchanged.
export { parseManifest } from '../engine';
export type { ManifestRow } from '../engine';

// ── Issues ──────────────────────────────────────────────────────────────────

export type BatchRule =
  | 'slot-unauthored' // a bucket slot with no batch entry
  | 'slot-extra' // an entry whose line_id+stage is not a slot in the bucket
  | 'slot-duplicate' // two entries answer the same slot
  | 'manifest-mismatch' // types / archetype / rarity differ from the slot row
  | 'name-drift' // the slot row names a different mon (warning — dex_forge's drift scan)
  | 'type-vocab' // not UPPERCASE, or absent from the canon chart
  | 'naming-law' // not 4–9 chars ALL CAPS
  | 'name-collision' // duplicate in batch, a prior name, or another slot's name
  | 'dex-entry' // not exactly 2 sentences
  | 'move-unregistered' // learnset move the engine cannot resolve
  | 'move-pool' // movePoolIssues at the checked level
  | 'evo-chain' // evoLine disagrees with the manifest chain
  | 'nuke' // a nuke-tier learnset move outside the signature slot
  | 'stamina-missing'; // warning only

export interface BatchIssue {
  readonly rule: BatchRule;
  readonly severity: 'error' | 'warning';
  // The entry name, or the slot id (`L106s1`) for an unauthored slot.
  readonly subject: string;
  readonly message: string;
}

// Allowlist key: one per (rule, subject), stable across levels and wording.
export function issueKey(i: Pick<BatchIssue, 'rule' | 'subject'>): string {
  return `${i.rule}:${i.subject}`;
}

export interface BatchValidateOpts {
  readonly manifest: readonly ManifestRow[];
  readonly bucket: string;
  readonly typeChart: TypeChart;
  // The learnset level movePoolIssues is checked at (the caller's band).
  readonly level: number;
  // Names already taken outside this batch (prior batches, the legacy fixtures).
  readonly priorNames?: readonly string[];
}

const slotId = (lineId: string, stage: number): string => `${lineId}s${stage}`;

// Sentences = terminal-punctuation runs followed by whitespace or the end; the
// text must also END on one (no trailing fragment).
export function sentenceCount(text: string): number {
  const t = text.trim();
  if (t === '' || !/[.!?]$/.test(t)) return -1;
  return (t.match(/[.!?]+(?=\s|$)/g) ?? []).length;
}

export function validateBatch(
  entries: readonly DexEntryJson[],
  opts: BatchValidateOpts,
): BatchIssue[] {
  ensureRegistered();
  const issues: BatchIssue[] = [];
  const err = (rule: BatchRule, subject: string, message: string): void => {
    issues.push({ rule, severity: 'error', subject, message });
  };
  const warn = (rule: BatchRule, subject: string, message: string): void => {
    issues.push({ rule, severity: 'warning', subject, message });
  };

  const slots = new Map<string, ManifestRow>();
  for (const r of opts.manifest) {
    if (r.bucket === opts.bucket) slots.set(slotId(r.line_id, r.stage), r);
  }
  // Every named manifest row, bucket-wide or not — a batch name may not take
  // another slot's name.
  const manifestNameSlot = new Map<string, string>();
  for (const r of opts.manifest) {
    if (r.name !== '') manifestNameSlot.set(r.name, slotId(r.line_id, r.stage));
  }
  const bySlot = new Map<string, DexEntryJson>();
  for (const e of entries) {
    const id = slotId(e.line_id, e.stage);
    if (!bySlot.has(id)) bySlot.set(id, e);
  }

  // Slot coverage: every bucket row answered.
  for (const [id, row] of slots) {
    if (!bySlot.has(id)) {
      err('slot-unauthored', id, `${id}${row.name ? ` (${row.name})` : ''} has no batch entry`);
    }
  }

  const prior = new Set(opts.priorNames ?? []);
  const seenNames = new Set<string>();
  const seenSlots = new Set<string>();
  for (const e of entries) {
    const id = slotId(e.line_id, e.stage);
    const row = slots.get(id);

    // Slot identity.
    if (!row) err('slot-extra', e.name, `${id} is not a ${opts.bucket} slot in the manifest`);
    if (seenSlots.has(id)) err('slot-duplicate', e.name, `${id} is answered twice`);
    seenSlots.add(id);
    if (row) {
      const want = row.type2 === '' ? [row.type1] : [row.type1, row.type2];
      if (e.types.join('/') !== want.join('/')) {
        err('manifest-mismatch', e.name, `types ${e.types.join('/')} ≠ manifest ${want.join('/')}`);
      }
      if (e.archetype !== row.archetype) {
        err('manifest-mismatch', e.name, `archetype ${e.archetype} ≠ manifest ${row.archetype}`);
      }
      if (e.rarity !== row.rarity) {
        err('manifest-mismatch', e.name, `rarity ${e.rarity} ≠ manifest ${row.rarity}`);
      }
      if (row.name !== '' && row.name !== e.name) {
        warn('name-drift', e.name, `manifest names ${id} "${row.name}"`);
      }
    }

    // Type vocabulary: UPPERCASE canon only (never the legacy Mixed-case chart).
    for (const t of e.types) {
      if (t !== t.toUpperCase() || !Object.hasOwn(opts.typeChart, t)) {
        err('type-vocab', e.name, `type "${t}" is not an UPPERCASE canon type`);
      }
    }

    // Naming law + collisions.
    if (!/^[A-Z]{4,9}$/.test(e.name)) {
      err('naming-law', e.name, `"${e.name}" breaks the naming law (4–9 chars, ALL CAPS)`);
    }
    if (seenNames.has(e.name)) err('name-collision', e.name, 'duplicate name in the batch');
    seenNames.add(e.name);
    if (prior.has(e.name)) err('name-collision', e.name, 'name already taken outside this batch');
    const owner = manifestNameSlot.get(e.name);
    if (owner !== undefined && owner !== id) {
      err('name-collision', e.name, `name belongs to manifest slot ${owner}`);
    }

    // Dex entry.
    const n = sentenceCount(e.dexEntry ?? '');
    if (n !== 2) {
      err('dex-entry', e.name, n < 0 ? 'dexEntry missing or unterminated' : `dexEntry has ${n} sentences (want 2)`);
    }

    // Learnset: registered, no nuke outside the signature slot.
    for (const slot of e.learnset) {
      if (slot.move === SIGNATURE_RESERVED) continue;
      let tier: string;
      try {
        tier = lookupMove(slot.move).tier;
      } catch {
        err('move-unregistered', e.name, `${slot.move} is not a registered move`);
        continue;
      }
      if (tier === 'nuke') err('nuke', e.name, `${slot.move} is a nuke outside ${SIGNATURE_RESERVED}`);
    }
    for (const m of movePoolIssues(loadSpeciesAt(e, opts.level))) {
      err('move-pool', e.name, `@${opts.level}: ${m}`);
    }

    // Evolution chain.
    if (row) {
      const evo = e.evoLine ?? null;
      const to = evo?.evolvesTo ?? null;
      const at = evo?.at ?? null;
      if (row.stage < row.stages_total) {
        const nextId = slotId(row.line_id, row.stage + 1);
        const nextName = bySlot.get(nextId)?.name ?? (slots.get(nextId)?.name || null);
        if (nextName === null) {
          warn('evo-chain', e.name, `cannot verify evolvesTo: ${nextId} has no name yet`);
        } else if (to !== nextName) {
          err('evo-chain', e.name, `evolvesTo ${String(to)} ≠ ${nextId} ${nextName}`);
        }
        if (at !== row.evolve_at) {
          err('evo-chain', e.name, `evolves at ${String(at)} ≠ manifest ${String(row.evolve_at)}`);
        }
      } else if (to !== null || at !== null) {
        err('evo-chain', e.name, `final stage must not evolve (got ${String(to)} @${String(at)})`);
      }
    }

    if (e.stats.stamina === undefined) {
      warn('stamina-missing', e.name, 'no stamina stat — createSide defaults to 100');
    }
  }
  return issues;
}

// Split a report by an allowlist of known keys (see CH1_KNOWN_FLAGS).
export function partitionKnown(
  issues: readonly BatchIssue[],
  known: { readonly [key: string]: string },
): { readonly known: BatchIssue[]; readonly unexpected: BatchIssue[] } {
  const k: BatchIssue[] = [];
  const u: BatchIssue[] = [];
  for (const i of issues) (Object.hasOwn(known, issueKey(i)) ? k : u).push(i);
  return { known: k, unexpected: u };
}

// ── CH1 known flags ─────────────────────────────────────────────────────────
// What docs/ch1-batch.json trips TODAY, recorded rather than "fixed": each is a
// doc-level gap awaiting a ruling (gym2-plan §2), not a data bug to patch here.
// Keyed by issueKey; the value says why the flag stands. A key that stops firing
// must be deleted (the test asserts every entry still fires at its level).
export const CH1_KNOWN_FLAGS: { readonly [key: string]: string } = {
  // Slot coverage: 14 of the manifest's 29 CH1 rows have no batch entry yet —
  // commissioning them is ruling A4(c).
  'slot-unauthored:L106s1': 'NIPVOLE — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L106s2':
    'BURROWDROVE — not yet commissioned (A4); its manifest name is 11 chars, so it trips the naming law once authored',
  'slot-unauthored:L107s1': 'DRISKIT — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L107s2': 'DRISKADE — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L108s1': 'CHITTERLING — CH1 Drainer slot not yet commissioned (A4)',
  'slot-unauthored:L108s2': 'MITESWARM — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L108s3': 'HIVEMAW — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L109s1': 'THISTLEKIT — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L110s1': 'GLIMMERFLY — CH1 Pacer slot not yet commissioned (A4)',
  'slot-unauthored:L110s2': 'DUSKMOTH — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L111s1': 'GROTTLE — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L111s2': 'STALAGNAW — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L112s1': 'DRILLNOUT — CH1 slot not yet commissioned (A4)',
  'slot-unauthored:L112s2': 'BORESCARAB — CH1 slot not yet commissioned (A4)',
  // Attack overflow (>4 ATTACKS) above the shipped CH1 band of 13 — the two-pool
  // overflow rule is ruling D1. Clean at 13; the first overflowing level is noted.
  'move-pool:VINESNAP': 'from L16 — VINE SLAM@16 is a 5th attack (D1)',
  'move-pool:WYRMFERN': 'from L16 — VINE SLAM@16 is a 5th attack (D1)',
  'move-pool:BRACKSLAP': 'from L16 — TIDE CRASH@16 is a 5th attack (D1)',
  'move-pool:CRASHMAW': 'from L16 — TIDE CRASH@16 is a 5th attack (D1)',
  'move-pool:CAVELURE': 'from L16 — QUAKE STOMP@16 is a 5th attack (D1)',
  'move-pool:CHASMTRAP': 'from L16 — QUAKE STOMP@16 is a 5th attack (D1)',
  'move-pool:KILNDRAKE': 'from L19 — FLAME RUSH@19 is a 5th attack (D1)',
  'move-pool:FORTDRAKE': 'from L19 — FLAME RUSH@19 is a 5th attack (D1)',
  'move-pool:GALEHAWK': 'from L24 — SCRATCH@24 is a 5th attack (D1)',
};
