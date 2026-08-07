/**
 * decisionRecordInversion.test.js — THE INVERSION (WS-431 stage 6, the done-criterion).
 *
 * estimateEdge's headline must be REDERIVABLE from the persisted record alone. Pattern
 * from refinementDeterminism.test.js: a signatureOf projection with named exclusions,
 * anti-vacuity assertions, and the withheld-field form that turns "the record is
 * sufficient" from a claim into a measurement.
 *
 * Tolerance: exact equality. The record round-trips doubles through JSON (exact for every
 * IEEE double), rows are canonicalized to one order, and the bootstrap is seeded from the
 * meta line — the same arithmetic over the same bytes. A tolerance would only paper over
 * a real divergence, so none is granted.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { estimateEdge } from '../backtest/ipsEstimator.mjs';
import { openDecisionSink } from '../backtest/decisionRecord.mjs';
import { readDecisionRecord, rederiveHeadline } from '../backtest/rederiveFromRecord.mjs';

// DELIBERATELY NON-DEFAULT estimator parameters. If the rederivation silently fell back
// to ipsEstimator defaults instead of reading the meta line, every assertion below would
// still pass under default-valued meta — so the meta must disagree with the defaults for
// the withheld-field cases to have teeth.
const ESTIMATOR = { weightCap: 5, bootstrapSeed: 12345, bootstrapResamples: 400, bootstrapAlpha: 0.1 };

/**
 * What must be identical, by name. Excluded, by name: `label` (a display string the
 * rederivation sets to its own provenance), `skipped`/`clippedCount` bookkeeping objects
 * are INCLUDED (they are measurement facts), nothing wall-clock exists on this object.
 */
const signatureOf = (h) => ({
  edgeBB: h.edgeBB,
  edgeCiLowBB: h.edgeCiLowBB,
  edgeCiHighBB: h.edgeCiHighBB,
  n: h.n,
  ess: h.ess,
  players: h.players,
  valueOursBB: h.valueOursBB,
  valuePoolBB: h.valuePoolBB,
});

// A small but non-trivial run: 8 players, 3 decisions each, mixed actions and outcomes,
// weights that straddle the (non-default) cap of 5 so clipping genuinely occurs.
const mkRows = () => {
  const rows = [];
  const acts = ['fold', 'call', 'raise'];
  for (let p = 0; p < 8; p += 1) {
    for (let d = 0; d < 3; d += 1) {
      const a = acts[(p + d) % 3];
      const pOurs = { fold: 0.1 + 0.05 * ((p + d) % 3), call: 0.5, raise: 0.4 - 0.05 * ((p + d) % 3) };
      // When 'raise' is the observed action, the pool rarely raises here — raw weight
      // pOurs.raise/0.05 ≈ 6-8 exceeds the test cap of 5, so clipping genuinely occurs.
      const pPool = { fold: a === 'raise' ? 0.55 : 0.3, call: 0.4, raise: a === 'raise' ? 0.05 : 0.3 };
      rows.push({
        playerId: `p${p}`,
        handId: `h${p}-${d}`,
        order: d + 2,
        stable: { p, k: 0, d },
        observedAction: a,
        observedAmount: d * 2,
        netBB: ((p * 7 + d * 3) % 11) - 5 + 0.25 * d,
        street: 'flop',
        piOurs: pOurs,
        piPool: pPool,
        slices: { street: 'flop' },
      });
    }
  }
  return rows;
};

const writeRecord = (rows, { estimator = ESTIMATOR, close = true, mutateMeta = null } = {}) => {
  const p = join(mkdtempSync(join(tmpdir(), 'inversion-')), 'decisions.jsonl');
  const meta = {
    run: 'hero-ev', dealBookId: 'db-inv', dealBookHash: `sha256:${'ef'.repeat(32)}`,
    arms: [{ id: 'default' }], constants: {}, estimator,
  };
  const sink = openDecisionSink(p, mutateMeta ? mutateMeta(meta) : meta);
  for (const r of rows) sink.write(r);
  if (close) sink.close();
  return p;
};

describe('THE INVERSION — the headline is rederivable from the record alone', { timeout: 60_000 }, () => {
  it('rederives the exact headline signature from the file, with parameters from the meta line', () => {
    const rows = mkRows();
    // The run's headline, computed the way the runner computes it.
    const direct = estimateEdge(rows, {
      weightCap: ESTIMATOR.weightCap, seed: ESTIMATOR.bootstrapSeed,
      resamples: ESTIMATOR.bootstrapResamples, alpha: ESTIMATOR.bootstrapAlpha,
    });

    // Rows written in a SHUFFLED order — completion order under a pool. The record, not
    // the in-memory array, is the input to the rederivation.
    const shuffled = [...rows].reverse();
    [shuffled[3], shuffled[11]] = [shuffled[11], shuffled[3]];
    const path = writeRecord(shuffled);

    const { headline, rowsRead } = rederiveHeadline(readFileSync(path, 'utf8'));

    // Anti-vacuity: rows genuinely came from the file, and the estimate is a real one.
    expect(rowsRead).toBe(rows.length);
    expect(headline.n).toBeGreaterThan(0);
    expect(headline.edgeBB).not.toBeNull();
    expect(headline.ciResamples).toBe(ESTIMATOR.bootstrapResamples);
    // Clipping occurred — the non-default cap genuinely bound somewhere.
    expect(direct.clippedShare).toBeGreaterThan(0);

    expect(signatureOf(headline)).toEqual(signatureOf(direct));
  });

  it('FAILS when the file was never closed — a truncated record is a biased subsample, refused not tolerated', () => {
    const path = writeRecord(mkRows(), { close: false });
    expect(() => rederiveHeadline(readFileSync(path, 'utf8'))).toThrow(/never closed|biased subsample/);
  });

  it('FAILS when the content hash does not recompute — tampered rows never rederive quietly', () => {
    const path = writeRecord(mkRows());
    const text = readFileSync(path, 'utf8').replace('"netBB":-5', '"netBB":50');
    expect(() => rederiveHeadline(text)).toThrow(/contentHash does not recompute/);
  });

  describe('the withheld-field form — sufficiency as a measurement, not a claim', () => {
    const strippedText = (field) => {
      const rows = mkRows().map((r) => {
        const { [field]: _, ...rest } = r;
        return rest;
      });
      return readFileSync(writeRecord(rows), 'utf8');
    };

    for (const field of ['piOurs', 'piPool', 'observedAction', 'netBB', 'playerId']) {
      it(`diverges or fails when rows lack ${field}`, () => {
        const baseline = signatureOf(rederiveHeadline(
          readFileSync(writeRecord(mkRows()), 'utf8'),
        ).headline);
        let outcome;
        try {
          outcome = signatureOf(rederiveHeadline(strippedText(field)).headline);
        } catch (err) {
          outcome = { threw: err.message };
        }
        expect(outcome).not.toEqual(baseline);
      });
    }

    for (const constant of ['weightCap', 'bootstrapSeed', 'bootstrapResamples', 'bootstrapAlpha']) {
      it(`REFUSES when the meta line lacks estimator.${constant} — no default stands in`, () => {
        const { [constant]: _, ...partial } = ESTIMATOR;
        const text = readFileSync(writeRecord(mkRows(), { estimator: partial }), 'utf8');
        expect(() => rederiveHeadline(text)).toThrow(new RegExp(constant));
      });
    }
  });

  it('readDecisionRecord returns rows in canonical order regardless of write order', () => {
    const rows = mkRows();
    const path = writeRecord([...rows].reverse());
    const { rows: readBack } = readDecisionRecord(readFileSync(path, 'utf8'));
    expect(readBack.map((r) => `${r.stable.p}|${r.stable.d}`))
      .toEqual(rows.map((r) => `${r.stable.p}|${r.stable.d}`));
  });
});
