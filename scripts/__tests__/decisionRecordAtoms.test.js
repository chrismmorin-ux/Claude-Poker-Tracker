/**
 * decisionRecordAtoms.test.js — the one-producer/two-consumers projection (WS-431 stage 5).
 *
 * Pins: projection totality (every registered atom field populated or named in omissions),
 * atomId parts kept (never hash-and-discarded), atomSetId derived from the record hash,
 * and atomsSelfCheck green over an emitted set.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SOR_SCHEMAS } from '../../src/utils/standardOfRecord/schemas.js';
import { projectRecordRowToAtoms, emitAtomsFromRecord, heroEvSurfaceId } from '../backtest/decisionRecordAtoms.mjs';
import { openDecisionSink } from '../backtest/decisionRecord.mjs';
import { resolveAtomSet } from '../backtest/atomStore.mjs';
import { atomsSelfCheck } from '../backtest/atomsSelfCheck.mjs';
import { hashObjectSync } from '../backtest/contentHashNode.mjs';

const ARMS = [{ id: 'default' }];
const ESTIMATOR = { weightCap: 20, bootstrapSeed: 0x9e3779b9, bootstrapResamples: 2000, bootstrapAlpha: 0.05 };

const row = (over = {}) => ({
  schemaVersion: 2,
  playerId: 'PS:alice', handId: 'h-77', order: 4,
  stable: { p: 0, k: 0, d: 0 },
  observedAction: 'call', observedAmount: 6,
  netBB: 3.5, netBBUnraked: 3.8, street: 'turn',
  heroSeat: 2, buttonSeat: 5, opponentSeat: 7,
  board: [4, 18, 33, 47], boardLabels: ['x', 'y', 'z', 'w'],
  situationKey: 'turn:na:LATE:false:true:none:na', contextAction: 'facing-bet',
  isAgg: false, isIP: true, rangeEquityPct: 48, segmentation: {}, geometry: { bb: 2 },
  piOurs: { call: 0.6, fold: 0.4 }, evStats: {},
  piOursByArm: { default: { call: 0.6, fold: 0.4 } },
  piPool: { call: 0.5, fold: 0.5 }, poolEvidenceN: 30,
  piPbr: null, piPbrBySweep: null,
  slices: { street: 'turn', facingAction: 'bet' },
  pPoolObserved: 0.5, pOursObservedByArm: { default: 0.6 }, wRawByArm: { default: 1.2 },
  heroTruth: { truthAvailable: false, reason: 'not-revealed' },
  evStatsByArm: {}, combosByArm: {}, policyDiagByArm: {}, pbrSkipReason: 'no-model',
  ...over,
});

describe('projectRecordRowToAtoms', () => {
  it('is TOTAL over the registered atom schema — every field populated or named in omissions', () => {
    const [atom] = projectRecordRowToAtoms(row(), { arms: ARMS, estimator: ESTIMATOR, equitySeed: 7 });
    for (const f of SOR_SCHEMAS.decisionAtom) {
      const populated = atom[f.name] !== undefined
        && (atom[f.name] !== null || f.type.includes('null'));
      const named = atom.omissions && Object.keys(atom.omissions).includes(f.name);
      expect(populated || named, `atom.${f.name} neither populated nor in omissions`).toBe(true);
    }
  });

  it('keeps atomId\'s PARTS — the WS-410 Stage 5 join key survives on the atom', () => {
    const [atom] = projectRecordRowToAtoms(row(), { arms: ARMS, estimator: ESTIMATOR });
    expect(atom.playerId).toBe('PS:alice');
    expect(atom.handId).toBe('h-77');
    expect(atom.order).toBe(4);
    expect(atom.stable).toEqual({ p: 0, k: 0, d: 0 });
    expect(atom.atomId).toBe(hashObjectSync({ playerId: 'PS:alice', handId: 'h-77', order: 4, armId: 'default' }));
  });

  it('carries truth WITH its basis when revealed, null when not — never a bare holding', () => {
    const revealed = projectRecordRowToAtoms(
      row({ heroTruth: { truthAvailable: true, reason: null, revealed: [12, 25], revealedAt: { street: 'river' } } }),
      { arms: ARMS },
    )[0];
    expect(revealed.truth).toMatchObject({ basis: 'observed', revealed: [12, 25] });
    const hidden = projectRecordRowToAtoms(row(), { arms: ARMS })[0];
    expect(hidden.truth).toBeNull();
  });

  it('skips an arm that did not score the node rather than emitting an empty distribution', () => {
    const atoms = projectRecordRowToAtoms(
      row({ piOursByArm: { default: {} } }),
      { arms: ARMS },
    );
    expect(atoms).toEqual([]);
  });

  it('names beliefState and alternativeScores in omissions with their reasons', () => {
    const [atom] = projectRecordRowToAtoms(row(), { arms: ARMS });
    expect(atom.omissions.beliefState).toMatch(/no producer/);
    expect(atom.omissions.alternativeScores).toMatch(/WS-410/);
  });
});

describe('emitAtomsFromRecord — the second consumer, fed by the first', () => {
  const writeRecord = (rows) => {
    const dir = mkdtempSync(join(tmpdir(), 'recatoms-'));
    const p = join(dir, 'decisions.jsonl');
    const sink = openDecisionSink(p, {
      run: 'hero-ev', dealBookId: 'db-test', dealBookHash: `sha256:${'ab'.repeat(32)}`,
      arms: ARMS, estimator: ESTIMATOR,
    });
    for (const r of rows) sink.write(r);
    const ref = sink.close();
    return { path: p, ref, storeRoot: join(dir, 'atom-store') };
  };

  it('derives atomSetId from the record contentHash, emits, finalizes, and resolves', async () => {
    const rows = [row(), row({ handId: 'h-78', order: 2, stable: { p: 0, k: 0, d: 1 } })];
    const { path, ref, storeRoot } = writeRecord(rows);

    const out = await emitAtomsFromRecord({
      recordText: readFileSync(path, 'utf8'),
      contentHash: ref.contentHash,
      equitySeed: 7,
      root: storeRoot,
    });
    expect(out.atomSetId).toBe(`hero-ev-${ref.contentHash.replace('sha256:', '').slice(0, 12)}`);
    expect(out.atomCount).toBe(2);
    expect(out.atomSetHash).toMatch(/^sha256:/);

    const resolved = await resolveAtomSet(out.atomSetHash, { root: storeRoot });
    expect(resolved.resolved).toBe(true);
    expect(resolved.atoms).toHaveLength(2);
    expect(resolved.atoms[0].surfaceId).toBe(heroEvSurfaceId('default'));

    // The wired self-check is green over an emitted set — every schema field has a reader
    // and every reader runs.
    const check = atomsSelfCheck(resolved.atoms);
    expect(check.missingReaders).toEqual([]);
    expect(check.failedReaders ?? []).toEqual([]);
  });

  it('refuses to emit without a contentHash — the id derivation IS the one-measurement guarantee', async () => {
    await expect(emitAtomsFromRecord({ recordText: '', contentHash: null }))
      .rejects.toThrow(/contentHash is required/);
  });
});
