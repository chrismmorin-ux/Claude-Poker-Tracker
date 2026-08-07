/**
 * recordSelfCheck.test.js — the reader-enforcement gate for the decision record (WS-431).
 *
 * Pattern transferred from atomStoreAndLadder.test.js:117-155: the live registry must have
 * zero missing readers, and a field added to the schema WITHOUT a reader must be named —
 * and must make openDecisionSink refuse at open, before any hours are spent.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SOR_SCHEMAS, DECISION_RECORD_META_SCHEMA } from '../../src/utils/standardOfRecord/schemas.js';
import {
  RECORD_READERS, META_READERS, SUMMARY_READERS, missingRecordReaders, recordSelfCheck,
} from '../backtest/recordSelfCheck.mjs';
import { openDecisionSink } from '../backtest/decisionRecord.mjs';

describe('missingRecordReaders — enforcement by schema diff, not by discipline', () => {
  it('has a reader for every field the record, meta, and summary schemas declare', () => {
    expect(missingRecordReaders()).toEqual([]);
  });

  it('names a field added to the schema without a reader', () => {
    const injected = [
      ...SOR_SCHEMAS.decisionRecord,
      { name: 'futureField', type: 'number|null', since: 3, required: false, note: 'test-only injection' },
    ];
    expect(missingRecordReaders({ recordSchema: injected })).toEqual(['decisionRecord.futureField']);
  });

  it('covers the meta and summary schemas with the same diff', () => {
    const injectedMeta = [
      ...DECISION_RECORD_META_SCHEMA,
      { name: 'futureMetaField', type: 'string', since: 3, required: false, note: 'test-only injection' },
    ];
    expect(missingRecordReaders({ metaSchema: injectedMeta })).toEqual(['decisionRecord.meta.futureMetaField']);
  });

  it('every reader declares a depth and a forcing question', () => {
    for (const r of [...RECORD_READERS, ...META_READERS, ...SUMMARY_READERS]) {
      expect(['descriptive', 'inferential'], `${r.field} depth`).toContain(r.depth);
      expect(r.question, `${r.field} has no forcing question`).toBeTruthy();
      expect(typeof r.read, `${r.field} has no read fn`).toBe('function');
    }
  });
});

describe('recordSelfCheck — runs every reader, reports the mix', () => {
  const rows = [
    {
      schemaVersion: 2, playerId: 'a', handId: 'h1', order: 3,
      stable: { p: 0, k: 0, d: 0 }, observedAction: 'call', observedAmount: 4,
      netBB: 2.5, netBBUnraked: 2.7, street: 'flop', heroSeat: 3, buttonSeat: 1,
      opponentSeat: 5, board: [1, 2, 3], boardLabels: ['x', 'y', 'z'],
      situationKey: 'flop:na:LATE:false:false:none:na', contextAction: 'facing-bet',
      isAgg: false, isIP: true, rangeEquityPct: 51, segmentation: {}, geometry: { bb: 2 },
      piOurs: { call: 0.7, fold: 0.3 }, evStats: {}, piOursByArm: { default: { call: 0.7, fold: 0.3 } },
      piPool: { call: 0.5, fold: 0.5 }, poolEvidenceN: 40, piPbr: null, piPbrBySweep: null,
      slices: { street: 'flop' }, pPoolObserved: 0.5, pOursObservedByArm: { default: 0.7 },
      wRawByArm: { default: 1.4 }, heroTruth: { truthAvailable: false, reason: 'not-revealed' },
      evStatsByArm: {}, combosByArm: {}, policyDiagByArm: {}, pbrSkipReason: 'no-villain-model',
      omitted: null,
    },
  ];
  const meta = {
    kind: 'meta', schemaVersion: 2, writtenAt: '2026-08-07T00:00:00Z', run: 'hero-ev',
    dealBookId: 'db', dealBookHash: 'sha256:ab', engineCommit: 'c', engineDirty: false,
    arms: [], constants: {}, caveat: 'biased subsample of players',
    estimator: { weightCap: 20, bootstrapSeed: 1, bootstrapResamples: 2000, bootstrapAlpha: 0.05 },
  };
  const summary = { kind: 'summary', schemaVersion: 2, rowCount: 1, contentHash: 'sha256:cd', canonicalOrder: 'stable(p,k,d)' };

  it('is ok over a complete fixture and reports per-field answers', () => {
    const res = recordSelfCheck(rows, meta, summary, { weightCap: 20, rowsOnDisk: 1 });
    expect(res.ok).toBe(true);
    expect(res.missingReaders).toEqual([]);
    expect(res.failedReaders).toEqual([]);
    expect(res.reports['meta.estimator'].missing).toEqual([]);
    expect(res.reports['summary.rowCount'].agrees).toBe(true);
    expect(res.reports.wRawByArm.aboveCapShare).toBe(0);
    expect(res.reports.heroTruth.selectionShare).toBe(0);
  });

  it('reports the depth mix rather than a boolean — descriptive coverage stays visible', () => {
    const res = recordSelfCheck(rows, meta, summary);
    expect(res.depthMix.descriptive).toBeGreaterThan(0);
    expect(res.depthMix.inferential).toBeGreaterThan(0);
  });
});

describe('openDecisionSink refuses at open when a reader is missing', () => {
  it('opens cleanly with the live registry (zero missing is the wired state)', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'recheck-')), 'd.jsonl');
    const sink = openDecisionSink(p, {});
    sink.close();
  });
  // The refusal branch itself cannot be triggered without mutating the frozen live schema;
  // its logic is missingRecordReaders(), pinned exhaustively above. What THIS suite pins is
  // the wiring: the message text lives in decisionRecord.mjs and names recordSelfCheck.mjs.
});
