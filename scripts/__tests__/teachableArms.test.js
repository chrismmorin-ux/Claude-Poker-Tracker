/**
 * teachableArms.test.js — WS-437.
 *
 * POKER_THEORY §11.9's "~56%" headline was a MANUAL transform on gitignored output: nothing
 * computed, asserted or guarded it (SCORED-READOUT-SPEC §8.2 gap #2), and the artifacts it
 * derived from were not version-controlled (gap #3). These tests close both gaps from the
 * checking side:
 *
 *   1. The COMMITTED artifacts (`docs/standard-of-record/data/teachable-arms-{ftp,ps}.json`)
 *      must reproduce the published percentages through `shareOfEngineEdge` — so the doc
 *      figure now has a citable source and an executable guard. If either file or the
 *      transform drifts, this fails.
 *   2. `teachableArmsResultCard` must mint a VALID ADR-009 Result Card (gap #4) whose
 *      manifest carries a joinable `disclaimerRegisterVersion`, whose estimand says what the
 *      number is (Delta-log vs revealed hole cards — a diagnostic, not an EV claim), and
 *      whose treatment carries the HC-011 transferred-not-measured statement inline.
 *
 * The probe's corpus-facing paths (mining, scoring) need the HandHQ corpus and are exercised
 * by `run-teachable-arms.mjs`; the pure functions they are built from are tested here.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  collapse3,
  buildLikelihoodTable,
  summarize,
  shareOfEngineEdge,
  teachableArmsResultCard,
  ACTIONS4,
} from '../backtest/teachableArmsProbe.mjs';
import {
  registerVersion,
  isRegisterVersionShape,
} from '../../src/utils/standardOfRecord/faultRegister.js';
import { resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';

const artifact = (site) => JSON.parse(readFileSync(
  new URL(`../../docs/standard-of-record/data/teachable-arms-${site}.json`, import.meta.url),
  'utf8',
));

/** The percentages published in POKER_THEORY §11.9, by site. */
const PUBLISHED = {
  ftp: { A2: 46.4, A3: 54.9, A4: 57.3 },
  ps: { A2: 40.2, A3: 53.3, A4: 55.7 },
};

const asPublishedPercent = (x) => Math.round(x * 1000) / 10;

const mkStamp = async () => ({
  engineCommit: 'test-commit-000000',
  engineDirty: false,
  dealBookHash: `sha256:${'ab'.repeat(32)}`,
  fieldVersion: 'handhq-2009-online',
  partition: 'pool/eval @ poolPct=50, FNV-1a over player id, independent per site',
  seeds: {},
  unseededSources: [],
  constants: { PRIOR_WEIGHT: 10, ACTION_TAU_FRACTION: { bet: 0.5 }, MIN_CONTINUATION_WEIGHT: 0.05 },
  disclaimerRegisterVersion: await registerVersion(),
  knownDivergences: [],
});

describe('collapse3 — the 5-bucket to 3-class collapse A3/A4 estimate over', () => {
  it('maps nuts and strong to strong, marginal and draw to medium, the rest to weak', () => {
    expect(collapse3('nuts')).toBe('strong');
    expect(collapse3('strong')).toBe('strong');
    expect(collapse3('marginal')).toBe('medium');
    expect(collapse3('draw')).toBe('medium');
    expect(collapse3('air')).toBe('weak');
    expect(collapse3('weak')).toBe('weak');
  });
});

describe('buildLikelihoodTable', () => {
  const counts = {
    raise: { strong: 1, medium: 1, weak: 1 },
    call: { strong: 1, medium: 1, weak: 1 },
    check: { strong: 1, medium: 1, weak: 1 },
    bet: { strong: 3, medium: 1, weak: 0 },
  };

  it('computes P(action|class), the unconditional base rate, and the ratio', () => {
    const t = buildLikelihoodTable(counts, ACTIONS4);
    expect(t.classTotals).toEqual({ strong: 6, medium: 4, weak: 3 });
    expect(t.grandTotal).toBe(13);
    const bet = t.table.bet;
    expect(bet.strong.p).toBeCloseTo(3 / 6, 12);
    expect(bet.strong.baseRate).toBeCloseTo(4 / 13, 12);
    expect(bet.strong.ratioToBase).toBeCloseTo((3 / 6) / (4 / 13), 12);
    expect(bet.weak.p).toBe(0);
  });

  it('returns null p for an empty class rather than dividing by zero', () => {
    const empty = {
      raise: { strong: 0, medium: 0, weak: 0 },
      call: { strong: 0, medium: 0, weak: 0 },
      check: { strong: 0, medium: 0, weak: 0 },
      bet: { strong: 0, medium: 0, weak: 0 },
    };
    const t = buildLikelihoodTable(empty, ACTIONS4);
    expect(t.table.bet.strong.p).toBeNull();
    expect(t.table.bet.strong.baseRate).toBeNull();
  });
});

describe('summarize', () => {
  it('is null on an empty accumulator — no decisions is not a score of zero', () => {
    expect(summarize({ n: 0, covered: 0, retainedSum: 0, sumLogP: 0, sumLogU: 0 })).toBeNull();
    expect(summarize(null)).toBeNull();
  });
});

describe('shareOfEngineEdge — the §11.9 headline transform, now in code', () => {
  for (const site of ['ftp', 'ps']) {
    it(`reproduces the published percentages from the committed ${site.toUpperCase()} artifact`, () => {
      const shares = shareOfEngineEdge(artifact(site).arms);
      expect(shares).not.toBeNull();
      expect(shares.engineEdgeDeltaLog).toBeGreaterThan(0);
      for (const arm of ['A2', 'A3', 'A4']) {
        expect(asPublishedPercent(shares[arm])).toBe(PUBLISHED[site][arm]);
      }
    });
  }

  it('orders the arms as published: A2 < A3 < A4 < 1, on both sites', () => {
    for (const site of ['ftp', 'ps']) {
      const s = shareOfEngineEdge(artifact(site).arms);
      expect(s.A2).toBeLessThan(s.A3);
      expect(s.A3).toBeLessThan(s.A4);
      expect(s.A4).toBeLessThan(1);
    }
  });

  it('returns null when the engine edge is not positive — no share of a non-existent edge', () => {
    const flat = { A0: { deltaLogVsUniform: 0.5 }, A1: { deltaLogVsUniform: 0.5 }, A4: { deltaLogVsUniform: 0.5 } };
    expect(shareOfEngineEdge(flat)).toBeNull();
    expect(shareOfEngineEdge({})).toBeNull();
    expect(shareOfEngineEdge(null)).toBeNull();
  });
});

describe('teachableArmsResultCard — the ADR-009 card for the §11.9 diagnostic', () => {
  it('mints a valid Result Card from the committed FTP artifact', async () => {
    const card = teachableArmsResultCard({
      result: artifact('ftp'),
      stamp: await mkStamp(),
      dealBookId: 'DB-test',
      fieldId: 'FIELD-handhq-2009-online',
      site: 'ftp',
    });
    expect(resultCardProblems(card)).toEqual([]);
    expect(card.resultCardId).toMatch(/^RC-teachable-arms-ftp-/);
    expect(card.clusterUnit).toBe('players');
    expect(isRegisterVersionShape(card.manifest.disclaimerRegisterVersion)).toBe(true);
  });

  it('states its currency in the estimand and its population transfer in the treatment', async () => {
    const card = teachableArmsResultCard({
      result: artifact('ps'),
      stamp: await mkStamp(),
      dealBookId: 'DB-test',
      fieldId: 'FIELD-handhq-2009-online',
      site: 'ps',
    });
    expect(card.estimand).toMatch(/DIAGNOSTIC, NOT A RESULT/);
    expect(card.estimand).toMatch(/NOT an EV claim/);
    expect(card.estimand).toMatch(/Delta-log/);
    expect(card.treatment).toMatch(/TRANSFERRED, NOT MEASURED/);
    expect(card.treatment).toMatch(/HC-011/);
    expect(card.admissibility.caveats.some((c) => /diagnostic, not a result/i.test(c))).toBe(true);
  });

  it('carries the fifteen numbers and the computed shares as metrics', async () => {
    const card = teachableArmsResultCard({
      result: artifact('ftp'),
      stamp: await mkStamp(),
      dealBookId: 'DB-test',
      fieldId: 'FIELD-handhq-2009-online',
      site: 'ftp',
    });
    expect(asPublishedPercent(card.metrics.shareOfEngineEdge.A4)).toBe(57.3);
    expect(card.metrics.a4Table['check-back']).toBeDefined();
    expect(card.metrics.a4Table['check-OOP']).toBeDefined();
    expect(card.metrics.nScoredDecisions).toBe(5403);
    expect(card.metrics.nMinedDecisions).toBe(5732);
  });

  it('refuses to mint a card when the engine edge is degenerate', async () => {
    const stamp = await mkStamp();
    const degenerate = {
      ...artifact('ftp'),
      arms: { A0: { deltaLogVsUniform: 0.5 }, A1: { deltaLogVsUniform: 0.5 } },
    };
    expect(() => teachableArmsResultCard({
      result: degenerate, stamp, dealBookId: 'DB-test', fieldId: 'F', site: 'ftp',
    })).toThrow(/not positive/);
  });
});
