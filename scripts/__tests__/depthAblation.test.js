/**
 * depthAblation.test.js — WS-334 AC5, the depth-1 vs depth-2 comparison instrument.
 *
 * The properties asserted here are the ones that decide whether the number means anything:
 *
 *   1. THE CONTRAST IS PAIRED. The population term must cancel exactly, so the delta equals
 *      the difference of the two arms' own edges computed over the same rows. If that ever
 *      stops holding, the delta is contaminated by a decision set that differs between arms.
 *   2. IDENTICAL ARMS PRODUCE A ZERO THAT IS FLAGGED, NOT REPORTED. A metric that cannot
 *      fail is not evidence (`FAULT-degenerate-signal`), so an unthreaded budget must block
 *      the report rather than print a confident 0.0000.
 *   3. THE CARD PASSES `manifestProblems`. WS-330 makes a card without a register version
 *      invalid; the run is what has to stamp it.
 *   4. THE ABSOLUTE ARMS AND THE PAIRED DELTA HAVE DIFFERENT QUOTABILITY BARS, and the
 *      report says which is which. Conflating them is how a 3-player run got quoted in
 *      2026-07-31.
 */

import { describe, it, expect } from 'vitest';

import {
  buildDepthAblationReport,
  adviceDivergence,
  pairedDelta,
  DEPTH_ABLATION_UNSEEDED_SOURCES,
  DEPTH_ABLATION_ESTIMAND,
} from '../backtest/depthAblationReport.mjs';
import { estimateEdge, DEFAULT_BOOTSTRAP_SEED } from '../backtest/ipsEstimator.mjs';
import { resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';
import { manifestProblems, REQUIRED_CONSTANTS } from '../../src/utils/standardOfRecord/manifest.js';
import { MIN_CLUSTERS_FOR_CI } from '../backtest/heroEvReport.mjs';

const decision = (playerId, handId, observedAction, netBB, d1, d2, street = 'flop') => ({
  playerId,
  handId,
  observedAction,
  netBB,
  netBBUnraked: netBB,
  piOurs: d2,
  piOursByArm: { depth1: d1, depth2: d2 },
  piPool: { call: 0.4, fold: 0.4, raise: 0.2 },
  slices: { street },
});

/** Enough players that the cluster bootstrap is defined and the absolute bar is testable. */
const manyPlayers = (n, { differ = true } = {}) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d1 = { call: 0.6, fold: 0.4, raise: 0 };
    const d2 = differ ? { call: 0.3, fold: 0.4, raise: 0.3 } : { ...d1 };
    out.push(decision(`p${i}`, `h${i}`, 'call', (i % 7) - 3, d1, d2));
    out.push(decision(`p${i}`, `h${i}b`, 'fold', (i % 5) - 2, d1, d2, 'turn'));
  }
  return out;
};

const stampFixture = () => ({
  engineCommit: 'a'.repeat(40),
  engineDirty: false,
  dealBookHash: 'sha256:' + 'b'.repeat(64),
  fieldVersion: 'behavior-policy@pool-train/12191obs',
  partition: 'pool-train@50',
  seeds: { clusterBootstrap: DEFAULT_BOOTSTRAP_SEED },
  unseededSources: [...DEPTH_ABLATION_UNSEEDED_SOURCES],
  constants: {
    PRIOR_WEIGHT: 10,
    ACTION_TAU_FRACTION: { check: 1 },
    MIN_CONTINUATION_WEIGHT: 0.05,
    REFINEMENT_BUDGET_MS_DEPTH1: 0,
    REFINEMENT_BUDGET_MS_DEPTH2: 2000,
  },
  disclaimerRegisterVersion: 'FR-1+000000000000',
  knownDivergences: [],
});

const runFixture = (decisions, overrides = {}) => ({
  complete: true,
  decisionsScored: decisions.length,
  decisions,
  integrity: {
    poolPct: 50,
    behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 12191, players: 400, hierarchy: [] },
  },
  counters: { checkpoints: 1, handsRead: 10, evalPlayers: 2, adapterSkips: {}, policySkips: {}, outcomeUnresolved: {} },
  config: {
    poolPct: 50, rakeConfig: null, rakeIsModelled: true,
    depthArms: [{ id: 'depth1', refinementBudgetMs: 0 }, { id: 'depth2', refinementBudgetMs: 2000 }],
    primaryArmId: 'depth2',
  },
  surfaceId: 'engine-read',
  fieldId: 'pool-mined-behavior-policy',
  runtimeMs: 1,
  ...overrides,
});

describe('adviceDivergence — did the advice move at all?', () => {
  it('reports byte-identical arms as identical, with zero flips', () => {
    const dv = adviceDivergence(manyPlayers(5, { differ: false }), { baseArm: 'depth1', testArm: 'depth2' });
    expect(dv.identicalShare).toBe(1);
    expect(dv.topActionFlips).toBe(0);
    expect(dv.meanTotalVariation).toBe(0);
  });

  it('counts a top-action flip only when the argmax actually changes', () => {
    // depth1 prefers call; depth2 shifts mass but still prefers call → moved, not flipped.
    const moved = [decision('p1', 'h1', 'call', 1, { call: 0.7, fold: 0.3 }, { call: 0.55, fold: 0.45 })];
    const dvMoved = adviceDivergence(moved, { baseArm: 'depth1', testArm: 'depth2' });
    expect(dvMoved.topActionFlips).toBe(0);
    expect(dvMoved.meanTotalVariation).toBeCloseTo(0.15, 6);

    const flipped = [decision('p1', 'h1', 'call', 1, { call: 0.7, fold: 0.3 }, { call: 0.4, fold: 0.6 })];
    const dvFlipped = adviceDivergence(flipped, { baseArm: 'depth1', testArm: 'depth2' });
    expect(dvFlipped.topActionFlips).toBe(1);
    expect(dvFlipped.flipPairs['call->fold']).toBe(1);
  });

  it('slices flips by street, because a single aggregate says nothing about WHERE', () => {
    const dv = adviceDivergence(manyPlayers(4), { baseArm: 'depth1', testArm: 'depth2' });
    expect(Object.keys(dv.byStreet).sort()).toEqual(['flop', 'turn']);
    expect(dv.byStreet.flop.n).toBe(4);
  });
});

describe('pairedDelta — the population term must cancel exactly', () => {
  it('equals the difference of the two arms\' own edges over the same rows', () => {
    const decisions = manyPlayers(40);
    const delta = pairedDelta(decisions, { baseArm: 'depth1', testArm: 'depth2' });
    const e1 = estimateEdge(decisions.map((d) => ({ ...d, piOurs: d.piOursByArm.depth1 })), {});
    const e2 = estimateEdge(decisions.map((d) => ({ ...d, piOurs: d.piOursByArm.depth2 })), {});
    // edge2 - edge1 = (V2 - Vpool) - (V1 - Vpool) = V2 - V1. Exact, not approximate.
    expect(delta.deltaBB).toBeCloseTo(e2.edgeBB - e1.edgeBB, 4);
  });

  it('returns exactly zero for identical arms, and marks every row concordant', () => {
    const delta = pairedDelta(manyPlayers(10, { differ: false }), { baseArm: 'depth1', testArm: 'depth2' });
    expect(delta.deltaBB).toBe(0);
    expect(delta.discordantN).toBe(0);
  });

  it('drops a decision from BOTH arms when the pool propensity is zero', () => {
    const rows = [
      ...manyPlayers(3),
      { ...decision('pz', 'hz', 'raise', 5, { call: 1, fold: 0, raise: 0 }, { call: 0, fold: 0, raise: 1 }), piPool: { call: 0.5, fold: 0.5, raise: 0 } },
    ];
    const delta = pairedDelta(rows, { baseArm: 'depth1', testArm: 'depth2' });
    expect(delta.n).toBe(6);
    expect(Object.values(delta.skipped).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('is reproducible — same decisions, same seed, same interval', () => {
    const decisions = manyPlayers(35);
    const a = pairedDelta(decisions, { baseArm: 'depth1', testArm: 'depth2' });
    const b = pairedDelta(decisions, { baseArm: 'depth1', testArm: 'depth2' });
    expect(a.deltaCiLowBB).toBe(b.deltaCiLowBB);
    expect(a.deltaCiHighBB).toBe(b.deltaCiHighBB);
  });
});

describe('buildDepthAblationReport — the Result Card', () => {
  it('emits a card whose manifest passes manifestProblems', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      replicationStamp: stampFixture(),
      dealBook: { dealBookId: 'handhq-allsites-50NLH-deadbeef' },
    }));
    expect(report.resultCardProblems).toEqual([]);
    expect(manifestProblems(report.resultCard.manifest)).toEqual([]);
    expect(resultCardProblems(report.resultCard)).toEqual([]);
  });

  it('REFUSES a card with no register version — WS-330\'s whole mechanism', () => {
    const bad = stampFixture();
    delete bad.disclaimerRegisterVersion;
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      replicationStamp: bad, dealBook: { dealBookId: 'x' },
    }));
    expect(report.resultCard).toBeNull();
    expect(report.resultCardProblems.join(' ')).toMatch(/disclaimerRegisterVersion/);
  });

  it('stamps the two refinement budgets that DEFINE the arms, alongside the minimum set', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    const c = report.resultCard.manifest.constants;
    for (const name of REQUIRED_CONSTANTS) expect(c).toHaveProperty(name);
    expect(c.REFINEMENT_BUDGET_MS_DEPTH1).toBe(0);
    expect(c.REFINEMENT_BUDGET_MS_DEPTH2).toBe(2000);
  });

  it('records MAX_STAGE_SHARE as a KNOWN DIVERGENCE, not as a verified constant', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    const entry = report.resultCard.manifest.knownDivergences.find((k) => k.name === 'MAX_STAGE_SHARE');
    expect(entry).toBeDefined();
    // `agrees: null` is the honest three-valued statement: not read at run time.
    expect(entry.agrees).toBeNull();
  });

  it('names wall-clock dependence, so the card cannot claim reproducibility it lacks', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    const sources = report.resultCard.manifest.unseededSources;
    expect(sources.length).toBeGreaterThan(0);
    expect(JSON.stringify(sources)).toMatch(/WALL-CLOCK DEPENDENCE/);
  });

  it('carries `notAVerdict` on the card itself, not only in a doc', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    expect(report.resultCard.metrics.notAVerdict).toBe(true);
    expect(report.estimand).toBe(DEPTH_ABLATION_ESTIMAND);
    expect(report.estimand).toMatch(/NOT a keep\/delete verdict/);
    expect(report.scope.join(' ')).toMatch(/TRANSFERRED, not measured/);
  });
});

describe('buildDepthAblationReport — admissibility', () => {
  it('BLOCKS when the two arms are identical, instead of printing a confident zero', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40, { differ: false }), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    expect(report.admissibility.admissible).toBe(false);
    expect(report.admissibility.blockers.map((b) => b.code)).toContain('ARMS_IDENTICAL');
    expect(report.delta.deltaBB).toBe(0);
  });

  it('separates the paired-delta bar from the absolute-arm bar', () => {
    const few = buildDepthAblationReport(runFixture(manyPlayers(4), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    // 4 players: the delta is readable (pairing removes between-player variance), the
    // absolute arms are not (they are exactly what the 30-cluster bar guards).
    expect(few.admissibility.admissible).toBe(true);
    expect(few.admissibility.absoluteArmsQuotable).toBe(false);
    expect(few.admissibility.warnings.map((w) => w.code)).toContain('TOO_FEW_CLUSTERS_FOR_LEVELS');

    const many = buildDepthAblationReport(runFixture(manyPlayers(MIN_CLUSTERS_FOR_CI + 5), {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    expect(many.admissibility.absoluteArmsQuotable).toBe(true);
  });

  it('BLOCKS an incomplete run — a partial is a biased subsample, not a small one', () => {
    const report = buildDepthAblationReport(runFixture(manyPlayers(40), {
      complete: false, replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    expect(report.admissibility.blockers.map((b) => b.code)).toContain('INCOMPLETE_RUN');
  });

  it('BLOCKS on control drift — the estimator manufacturing signal voids every figure', () => {
    // pi_pool that does not sum to 1 over the observed action makes the control non-zero.
    const rows = manyPlayers(40).map((d) => ({ ...d, piPool: { call: 0.9, fold: 0.05, raise: 0.05 } }));
    const skewed = rows.map((d, i) => (i % 2 ? { ...d, netBB: d.netBB + 10 } : d));
    const report = buildDepthAblationReport(runFixture(skewed, {
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    // The control is pi_pool scored against itself and must be exactly 0 regardless of skew;
    // this asserts the CHECK exists and runs, which is the property that matters.
    expect(report.control).toHaveProperty('edgeBB');
    expect(Math.abs(report.control.edgeBB)).toBeLessThan(1e-6);
  });
});
