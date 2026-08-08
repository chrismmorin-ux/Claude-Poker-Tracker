/**
 * decisionRecordAtoms.mjs — the Decision Atom projection of the decision record (WS-431).
 *
 * ONE PRODUCER, TWO CONSUMERS. The hero-EV pass produces exactly one durable artifact —
 * the decision-record JSONL sidecar — and the atom store is populated FROM IT, never from
 * a second write path inside the scoring loop. `atomSetId` derives from the record's
 * contentHash, so the two consumers are provably the same measurement: a Result Card's
 * `decisionRecord.contentHash` and its `atomSetHash` cannot silently disagree about which
 * run they describe.
 *
 * IDENTITY SEMANTICS (measured 2026-08-07): the record hash is EXECUTION identity — it
 * includes wall-clock forensics, so re-running the same config yields a new record hash
 * and therefore a new atomSetId. The ATOMS exclude forensics and are bit-identical across
 * executions, so the new set carries the SAME atomSetHash; resolve-by-hash treats the two
 * sets as one measurement. The finalization-guard refusal fires on re-emission from the
 * same record file (same atomSetId), not across separate executions.
 *
 * The projection is a PROJECTION — it selects and relabels, it does not derive. Anything
 * the atom cannot carry verbatim from the row is either referenced (the record keeps the
 * full shape) or named in `omissions` with its reason. Deriving at write time is the
 * question-foreclosing move the record exists to prevent.
 *
 * Identity: `atomId` hashes {playerId, handId, order, armId} AND the parts are kept as
 * fields — `layerAblation.mjs`'s hash-and-discard is the named anti-pattern (WS-410
 * Stage 5 joins on the parts).
 */

import { buildDecisionAtom, buildAtomTruth } from '../../src/utils/standardOfRecord/decisionAtom.js';
import { openAtomWriter } from './atomStore.mjs';
import { hashObjectSync } from './contentHashNode.mjs';
import { canonicalRowCompare } from './decisionRecord.mjs';

/**
 * Corpus rows carry seats as numeric STRINGS ("6") — measured, not assumed — while the
 * SHIPPED atom field `actorSeat` is `number|null` and cannot be retyped (additive
 * contract). Coerce at the projection boundary; a non-numeric label refuses to null
 * rather than shipping NaN.
 */
const toSeatNumber = (seat) => {
  const n = Number(seat);
  return Number.isFinite(n) ? n : null;
};

/** Surface id for one arm of the hero-EV pass. */
export const heroEvSurfaceId = (armId) => `sfc-hero-ev:${armId}`;

/**
 * Project ONE canonical record row into one atom per arm.
 *
 * @param {Object} row - a `kind: 'decision'` line, parsed
 * @param {Object} opts
 * @param {Array<{id: string}>} opts.arms - the arm roster (meta.arms)
 * @param {Object|null} opts.estimator - meta.estimator (seeds for the atom)
 * @param {number|null} opts.equitySeed - the run's equity seed when known
 */
export const projectRecordRowToAtoms = (row, { arms, estimator = null, equitySeed = null } = {}) => {
  const atoms = [];
  for (const arm of arms) {
    const action = row.piOursByArm?.[arm.id] ?? null;
    if (!action || Object.keys(action).length === 0) continue; // arm did not score this node — counted by the caller
    const omissions = {
      // No beliefState producer exists (WS-430 measured; sampling deliberately not
      // implemented) — recorded as a reason, not left as an ambiguous null.
      beliefState: 'not-captured: no producer exists (WS-430); sampling deliberately not implemented',
      // Per-action EVs live per-combo in the record (combosByArm) — aggregating them here
      // would be derivation at write time. WS-410 Stage 1 owns filling this on the atom.
      alternativeScores: 'in-record: per-combo candidate EVs in decisionRecord.combosByArm — WS-410 Stage 1 decides the atom-level shape',
      ...(row.situationKey == null ? { situationKey: 'not-recorded-on-row: heroEvTask ctx carried no situationKey for this node' } : {}),
    };
    atoms.push(buildDecisionAtom({
      atomId: hashObjectSync({ playerId: row.playerId, handId: row.handId, order: row.order, armId: arm.id }),
      situationKey: row.situationKey ?? '(unrecorded)',
      carried: { ...(row.slices ?? {}), source: 'hero-ev-decision-record' },
      surfaceId: heroEvSurfaceId(arm.id),
      action,
      ruleId: null, // no declared card fired — engine read, same convention as engine-path producers
      warrant: null,
      outcome: {
        netBB: row.netBB ?? null,
        netBBUnraked: row.netBBUnraked ?? null,
        observedAction: row.observedAction ?? null,
        observedAmount: row.observedAmount ?? null,
      },
      truth: row.heroTruth?.truthAvailable
        ? buildAtomTruth({
          revealed: row.heroTruth.revealed ?? null,
          basis: 'observed',
          revealedAt: row.heroTruth.revealedAt ?? null,
        })
        : null,
      seeds: {
        ...(Number.isFinite(equitySeed) ? { equity: equitySeed } : {}),
        ...(Number.isFinite(estimator?.bootstrapSeed) ? { clusterBootstrap: estimator.bootstrapSeed } : {}),
      },
      actorSeat: toSeatNumber(row.heroSeat),
      actorRole: 'hero',
      // v3 — the parts, kept.
      playerId: row.playerId ?? null,
      handId: row.handId ?? null,
      order: row.order ?? null,
      stable: row.stable ?? null,
      omissions,
    }));
  }
  return atoms;
};

/**
 * Read a closed decision-record file, canonicalize, project, and write the atom set.
 *
 * @param {Object} opts
 * @param {string} opts.recordText - full text of the JSONL file (caller reads it; keeps this pure-ish)
 * @param {string} opts.contentHash - the record's summary contentHash — atomSetId derives from it
 * @param {number|null} opts.equitySeed
 * @param {number} [opts.anchorGeneration]
 * @param {string} [opts.root] - atom store root override (tests)
 * @returns {Promise<{atomSetId, atomSetHash, atomCount, skippedArmRows}>}
 */
export const emitAtomsFromRecord = async ({
  recordText, contentHash, equitySeed = null, anchorGeneration = 1, root = undefined,
}) => {
  if (!contentHash || !contentHash.startsWith('sha256:')) {
    throw new Error('emitAtomsFromRecord: a record contentHash is required — the atom set id derives from it, which is what makes the two consumers one measurement.');
  }
  let meta = null;
  const rows = [];
  for (const ln of recordText.split('\n')) {
    if (!ln) continue;
    let obj;
    try { obj = JSON.parse(ln); } catch { continue; }
    if (obj.kind === 'meta') meta = obj;
    else if (obj.kind === 'decision') rows.push(obj);
  }
  if (!meta || !Array.isArray(meta.arms) || meta.arms.length === 0) {
    throw new Error('emitAtomsFromRecord: the record meta line carries no arm roster — cannot label surfaces.');
  }
  rows.sort(canonicalRowCompare);

  const atomSetId = `hero-ev-${contentHash.replace('sha256:', '').slice(0, 12)}`;
  const writer = await openAtomWriter({
    atomSetId,
    surfaceId: heroEvSurfaceId(meta.arms[0].id),
    fullSampleRate: 0,
    anchorGeneration,
    // WS-438 preflight: pass the real expectation, never inherit the 500k default.
    expectedAtoms: Math.max(1, rows.length * meta.arms.length),
    ...(root ? { root } : {}),
  });

  let skippedArmRows = 0;
  for (const row of rows) {
    const atoms = projectRecordRowToAtoms(row, {
      arms: meta.arms, estimator: meta.estimator ?? null, equitySeed,
    });
    skippedArmRows += meta.arms.length - atoms.length;
    for (const atom of atoms) await writer.append(atom); // eslint-disable-line no-await-in-loop
  }
  const manifest = await writer.finalize({
    notes: `WS-431 projection of decision record ${contentHash} (${rows.length} rows), gen ${anchorGeneration}`,
  });
  return {
    atomSetId,
    atomSetHash: manifest.atomSetHash ?? null,
    atomCount: manifest.atomCount ?? null,
    skippedArmRows,
  };
};
