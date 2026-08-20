/**
 * ipsSupportMatched.test.js — WS-546.
 *
 * `edge = wisValue - poolValue` differences a WEIGHTED mean over the rows our policy's support
 * reaches against a PLAIN mean over every scored row. `weightFor` returns `{ok: true, w: 0}`
 * for a decision our policy would never have taken, so those rows are absent from the first
 * mean and present in the second. WS-543 caught the consequence: arms whose sign is fixed in
 * advance by domination came back positive at low ESS.
 *
 * These tests pin the two things that make the fix a fix rather than a swap:
 *
 *   1. THE CLONE-THE-POOL IDENTITY, under BOTH estimands. When pi_ours = pi_pool every weight
 *      is exactly 1, so the support set is every row and both edges must be exactly zero. Any
 *      candidate that breaks this has traded one bias for another and is rejected regardless
 *      of what else it repaired — that is WS-546's second accept criterion.
 *
 *   2. THE CONTAMINATION IDENTITY, in both directions. The gap between the two estimands is
 *      not approximately anything; it is exactly the excluded share times the difference in
 *      means. The second direction is here because an earlier draft of the implementation
 *      comment asserted that excluded rows are "cheap" and therefore inflate the edge, which
 *      is backwards: cheap excluded rows pull the all-rows baseline UP and make `edgeBB` too
 *      LOW. The sign is a property of the arm and the corpus, never a general fact, and a test
 *      that only covered one direction would have let the wrong story stand.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateEdge, poolValueOverSupport, supportCount, poolValue, wisValue,
} from '../backtest/ipsEstimator.mjs';

/** Rows our policy CAN produce use call/raise; rows it cannot are folds, where pi_ours = 0. */
const mkDecisions = (rows) => rows.map((r, i) => ({
  piOurs: { fold: 0, call: 0.5, raise: 0.5 },
  piPool: { fold: 0.4, call: 0.35, raise: 0.25 },
  observedAction: r.support ? (i % 2 ? 'call' : 'raise') : 'fold',
  netBB: r.net,
  playerId: `p${i % 9}`,
  handId: `h${i}`,
}));

/** The contamination the identity predicts, computed from the fixture rather than the code. */
const predictedDelta = (rows) => {
  const sup = rows.filter((r) => r.support);
  const exc = rows.filter((r) => !r.support);
  const meanS = sup.reduce((a, b) => a + b.net, 0) / sup.length;
  const meanE = exc.reduce((a, b) => a + b.net, 0) / exc.length;
  return (exc.length / rows.length) * (meanE - meanS);
};

describe('clone-the-pool is exactly zero under both estimands', () => {
  // pi_ours === pi_pool at every decision, so every importance weight is exactly 1. This is
  // algebra, not an empirical prediction, and it is the sharpest check in the calibration set.
  const clone = Array.from({ length: 60 }, (_, i) => {
    const p = { fold: 0.5, call: 0.3, raise: 0.2 };
    return {
      piOurs: p,
      piPool: p,
      observedAction: ['fold', 'call', 'raise'][i % 3],
      netBB: [-1, 2.5, -4][i % 3],
      playerId: `p${i % 7}`,
      handId: `h${i}`,
    };
  });
  const r = estimateEdge(clone, { label: 'clone-the-pool', resamples: 200 });

  it('leaves the all-rows edge exactly zero', () => {
    expect(r.edgeBB).toBe(0);
  });

  it('leaves the support-matched edge exactly zero', () => {
    expect(r.edgeBBSupportMatched).toBe(0);
  });

  it('reports a delta of exactly zero, because the support set IS every row', () => {
    expect(r.edgeBBSupportDelta).toBe(0);
    expect(r.supportShare).toBe(1);
    expect(r.supportN).toBe(r.n);
  });
});

describe('the contamination identity, in both directions', () => {
  // Excluded rows CHEAPER than supported ones: the all-rows baseline is pulled UP, so the
  // all-rows edge reads too LOW and the delta is positive.
  const cheaper = Array.from({ length: 90 }, (_, i) => (i % 3 === 0
    ? { support: false, net: -0.5 }
    : { support: true, net: -6 + (i % 5) }));

  // Excluded rows COSTLIER: the baseline is pulled DOWN, the all-rows edge is inflated upward,
  // and the delta is negative. This is the WS-543 shape — a dominated arm reading positive.
  const costlier = Array.from({ length: 90 }, (_, i) => (i % 3 === 0
    ? { support: false, net: -12 }
    : { support: true, net: -1 + (i % 5) }));

  it('matches the closed form when the excluded rows are cheaper', () => {
    const r = estimateEdge(mkDecisions(cheaper), { label: 'cheaper', resamples: 200 });
    expect(r.edgeBBSupportDelta).toBeCloseTo(predictedDelta(cheaper), 3);
    expect(r.edgeBBSupportDelta).toBeGreaterThan(0);
  });

  it('matches the same closed form when the excluded rows are costlier', () => {
    const r = estimateEdge(mkDecisions(costlier), { label: 'costlier', resamples: 200 });
    expect(r.edgeBBSupportDelta).toBeCloseTo(predictedDelta(costlier), 3);
    expect(r.edgeBBSupportDelta).toBeLessThan(0);
  });

  it('reproduces the WS-543 signature: a dominated shape reading POSITIVE on all rows', () => {
    const r = estimateEdge(mkDecisions(costlier), { label: 'ws543-shape', resamples: 200 });
    // The defect, as observed: the all-rows estimand is above the support-matched one.
    expect(r.edgeBB).toBeGreaterThan(r.edgeBBSupportMatched);
    expect(r.edgeBB).toBeGreaterThan(0);
  });

  it('carries the conditioning set as data, not only as prose', () => {
    const r = estimateEdge(mkDecisions(costlier), { label: 'costlier', resamples: 200 });
    expect(r.supportShare).toBeCloseTo(2 / 3, 3);
    expect(r.supportN).toBeLessThan(r.n);
    expect(r.supportMatchedConditioningSet).toMatch(/could have produced the observed action/);
  });
});

describe('poolValueOverSupport and supportCount', () => {
  const scored = [
    { w: 0, net: -100 },   // outside the support: must not reach either figure
    { w: 0, net: -100 },
    { w: 1.5, net: 2 },
    { w: 0.5, net: 4 },
  ];

  it('restricts the mean to rows the support reaches', () => {
    // Unweighted mean of the two support rows: (2 + 4) / 2 = 3. Weights select rows here; they
    // do not weight the baseline, which is what keeps it a BEHAVIOUR-policy value.
    expect(poolValueOverSupport(scored)).toBe(3);
  });

  it('differs from poolValue exactly when some row is outside the support', () => {
    expect(poolValue(scored)).not.toBe(poolValueOverSupport(scored));
    expect(supportCount(scored)).toBe(2);
  });

  it('agrees with poolValue when every row is inside the support', () => {
    const all = scored.filter((s) => s.w > 0);
    expect(poolValueOverSupport(all)).toBe(poolValue(all));
    expect(supportCount(all)).toBe(all.length);
  });

  it('returns null rather than zero when the support is empty', () => {
    // An empty support is "we cannot say", not "the value is zero". A zero here would be
    // indistinguishable downstream from a measured zero.
    expect(poolValueOverSupport([{ w: 0, net: 5 }])).toBeNull();
    expect(wisValue([{ w: 0, net: 5 }])).toBeNull();
  });
});
