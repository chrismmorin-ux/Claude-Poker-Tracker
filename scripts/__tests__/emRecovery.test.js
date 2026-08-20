/**
 * emRecovery.test.js — WS-526 / F1.
 *
 * These are not smoke tests. Each one is a way the harness could have produced its PASS
 * dishonestly, written as an assertion so it cannot come back silently:
 *
 *   - the hidden arm could have been reading folded holdings (leak)
 *   - the EM could be broken and the oracle would have caught it
 *   - the metric could be incapable of failing (mismatch)
 *   - the fit could be non-deterministic and the reported number a draw
 *   - the optimiser could stall and report a confident wrong answer as converged
 *   - the "identified" verdict could be an artifact of the one policy the author picked
 *
 * The identity-transition case is asserted to be NOT identified. That is a boundary the run
 * discovered, and pinning it here means a future change that appears to "fix" it has to
 * confront the fact that it should not be fixable.
 */

import { describe, it, expect } from 'vitest';
import {
  TRUE_POLICY, DECOY_POLICY, TRANSITION, PRIOR, ACTIONS, CLASSES,
  exactHistogram, sampleHistogram, enumerateObservations,
  fitEM, scoreRecovery, detectRidge, curvature, resolvability, logLikOf,
  jacobiEigenvalues, mulberry32, obsKey,
} from '../backtest/emRecovery.mjs';

const IDENTITY_T = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

describe('generator', () => {
  it('enumerates a complete probability distribution over observation types', () => {
    const e = enumerateObservations(TRUE_POLICY);
    let mass = 0;
    for (const [, v] of e) mass += v.p;
    expect(mass).toBeCloseTo(1, 12);
    expect(e.size).toBe(223);
  });

  it('the exact histogram matches the sampled histogram in distribution', () => {
    const exact = exactHistogram(TRUE_POLICY);
    const sampled = sampleHistogram(400000, TRUE_POLICY, 777);
    for (const [k, p] of exact.hist) {
      if (p < 0.01) continue;              // only check types with enough mass to be stable
      const observed = (sampled.hist.get(k) || 0) / sampled.N;
      expect(Math.abs(observed - p)).toBeLessThan(0.01);
    }
  });

  it('is deterministic under a seed', () => {
    const a = sampleHistogram(50000, TRUE_POLICY, 4242);
    const b = sampleHistogram(50000, TRUE_POLICY, 4242);
    expect(a.hist.size).toBe(b.hist.size);
    for (const [k, v] of a.hist) expect(b.hist.get(k)).toBe(v);
  });

  it('different seeds produce different samples', () => {
    const a = sampleHistogram(20000, TRUE_POLICY, 1);
    const b = sampleHistogram(20000, TRUE_POLICY, 2);
    let differs = false;
    for (const [k, v] of a.hist) if (b.hist.get(k) !== v) differs = true;
    expect(differs).toBe(true);
  });
});

describe('leak guard — the hidden arm must not see a folded holding', () => {
  it('no folded observation type carries a trajectory in the hidden arm', () => {
    for (const source of [exactHistogram(TRUE_POLICY), sampleHistogram(50000, TRUE_POLICY, 9)]) {
      for (const [key] of source.hist) {
        const [acts, traj] = key.split('|');
        if (acts.split(',').includes('fold')) expect(traj).toBe('-');
      }
    }
  });

  it('the oracle arm DOES carry them — so the two arms genuinely differ', () => {
    const o = exactHistogram(TRUE_POLICY, { oracle: true });
    let withTraj = 0;
    for (const [key] of o.hist) {
      const [acts, traj] = key.split('|');
      if (acts.split(',').includes('fold') && traj !== '-') withTraj++;
    }
    expect(withTraj).toBeGreaterThan(0);
  });

  it('most hands never reveal, so the test is not trivially easy', () => {
    const h = exactHistogram(TRUE_POLICY);
    let hidden = 0; let total = 0;
    for (const [k, v] of h.hist) { total += v; if (k.split('|')[1] === '-') hidden += v; }
    expect(hidden / total).toBeGreaterThan(0.7);
  });
});

describe('controls', () => {
  it('ORACLE: with every holding revealed, EM recovers to machine precision', () => {
    const h = exactHistogram(TRUE_POLICY, { oracle: true });
    const fit = fitEM(h.hist, { seed: 0 });
    const sc = scoreRecovery(fit.policy);
    expect(sc.maxFoldBranchAbsError).toBeLessThan(1e-12);
    expect(sc.maxContinueBranchAbsError).toBeLessThan(1e-12);
  });

  it('MISMATCH: the metric can detect a wrong answer', () => {
    const h = exactHistogram(TRUE_POLICY);
    const fit = fitEM(h.hist, { seed: 0 });
    const wrong = scoreRecovery(fit.policy, DECOY_POLICY);
    expect(wrong.maxFoldBranchAbsError).toBeGreaterThan(0.02);
  }, 60000);

  it('WRONG-T: the known-transition assumption is load-bearing, not decorative', () => {
    const FLAT = [[0.34, 0.33, 0.33], [0.33, 0.34, 0.33], [0.33, 0.33, 0.34]];
    const h = exactHistogram(TRUE_POLICY);
    const fit = fitEM(h.hist, { T: FLAT, seed: 0 });
    const sc = scoreRecovery(fit.policy);
    expect(sc.maxFoldBranchAbsError).toBeGreaterThan(0.02);
  }, 60000);
});

describe('F1 — the fold branch is recoverable when hand class migrates', () => {
  it('recovers the fold branch from action data alone, at zero sampling noise', () => {
    const h = exactHistogram(TRUE_POLICY);
    const fit = fitEM(h.hist, { seed: 0 });
    expect(fit.converged).toBe(true);
    const sc = scoreRecovery(fit.policy);
    expect(sc.maxFoldBranchAbsError).toBeLessThan(1e-6);
  }, 60000);

  it('recovers the hardest cell — the river weak-raise bluff at 6%', () => {
    const h = exactHistogram(TRUE_POLICY);
    const fit = fitEM(h.hist, { seed: 0 });
    expect(fit.policy[2][2].raise).toBeCloseTo(0.06, 5);
  }, 60000);

  it('error decays with sample size', () => {
    const errs = [20000, 200000].map((N) => {
      const h = sampleHistogram(N, TRUE_POLICY, 12345);
      return scoreRecovery(fitEM(h.hist, { seed: 0 }).policy).maxFoldBranchAbsError;
    });
    expect(errs[1]).toBeLessThan(errs[0]);
  }, 120000);

  it('no likelihood ridge: independent starts agree on parameters, not just likelihood', () => {
    const h = exactHistogram(TRUE_POLICY);
    const r = detectRidge(h.hist, { starts: 8 });
    expect(r.ridgeDetected).toBe(false);
    expect(r.startsAtBestLL).toBe(8);
  }, 120000);

  it('is not an artifact of the policy the author chose — 40 random truths', () => {
    const rng = mulberry32(99);
    let worst = 0;
    for (let i = 0; i < 40; i++) {
      const pol = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => {
        const v = [rng(), rng(), rng()];
        const s = v[0] + v[1] + v[2];
        return { fold: v[0] / s, call: v[1] / s, raise: v[2] / s };
      }));
      const h = exactHistogram(pol);
      const sc = scoreRecovery(fitEM(h.hist, { seed: 0 }).policy, pol);
      worst = Math.max(worst, sc.maxFoldBranchAbsError);
    }
    expect(worst).toBeLessThan(0.02);
  }, 120000);

  it('recovers a class that folds 100% and therefore never reveals', () => {
    const pol = TRUE_POLICY.map((st, t) => st.map((c, h) => (
      (t === 0 && h === 2) ? { fold: 1, call: 0, raise: 0 } : { ...c })));
    const h = exactHistogram(pol);
    const fit = fitEM(h.hist, { seed: 0 });
    expect(fit.policy[0][2].fold).toBeCloseTo(1, 6);
  }, 60000);
});

describe('the boundary — identification requires class migration', () => {
  it('with an identity transition the fold branch is NOT identified', () => {
    const h = exactHistogram(TRUE_POLICY, { T: IDENTITY_T });
    const c = curvature(h.hist, TRUE_POLICY, { T: IDENTITY_T });
    expect(c.smallestEigenvalue).toBeLessThan(1e-3);
    expect(Number.isFinite(c.handsToResolveFlattestDirection)).toBe(false);
  });

  it('with the realistic transition it IS identified, and finitely so', () => {
    const h = exactHistogram(TRUE_POLICY, { T: TRANSITION });
    const c = curvature(h.hist, TRUE_POLICY, { T: TRANSITION });
    expect(c.smallestEigenvalue).toBeGreaterThan(1e-3);
    expect(c.handsToResolveFlattestDirection).toBeGreaterThan(1000);
    expect(c.handsToResolveFlattestDirection).toBeLessThan(1e7);
  });

  it('hands-to-resolve falls monotonically as migration increases', () => {
    const mixes = [0.1, 0.25, 0.5, 1];
    const hands = mixes.map((w) => {
      const T = TRANSITION.map((row, i) => row.map((v, j) => (1 - w) * IDENTITY_T[i][j] + w * v));
      const h = exactHistogram(TRUE_POLICY, { T });
      return curvature(h.hist, TRUE_POLICY, { T }).handsToResolveFlattestDirection;
    });
    for (let i = 1; i < hands.length; i++) expect(hands[i]).toBeLessThan(hands[i - 1]);
  }, 60000);

  it('AXIS-ALIGNED PROBING IS INSUFFICIENT — this is why `curvature` exists', () => {
    // resolvability perturbs one cell at a time and calls the non-identified case cheap.
    // Pinned as a test because it was nearly shipped as the headline instrument.
    const h = exactHistogram(TRUE_POLICY, { T: IDENTITY_T });
    const axis = resolvability(h.hist, TRUE_POLICY, { T: IDENTITY_T });
    const joint = curvature(h.hist, TRUE_POLICY, { T: IDENTITY_T });
    expect(Number.isFinite(axis.worstHandsToResolve)).toBe(true);
    expect(axis.worstHandsToResolve).toBeLessThan(100000);
    expect(Number.isFinite(joint.handsToResolveFlattestDirection)).toBe(false);
  });
});

describe('optimiser honesty', () => {
  it('reports converged:false rather than returning a stalled fit silently', () => {
    const h = exactHistogram(TRUE_POLICY);
    const stalled = fitEM(h.hist, { seed: 0, maxIter: 3 });
    expect(stalled.converged).toBe(false);
    expect(stalled.iterations).toBe(3);
    expect(stalled.maxParamDelta).toBeGreaterThan(0);
  });

  it('converges from a uniform start and from random starts to the same place', () => {
    const h = exactHistogram(TRUE_POLICY);
    const a = fitEM(h.hist, { seed: 0 });
    const b = fitEM(h.hist, { seed: 17 });
    for (let s = 0; s < 3; s++) {
      for (let k = 0; k < 3; k++) {
        for (const act of ACTIONS) expect(a.policy[s][k][act]).toBeCloseTo(b.policy[s][k][act], 6);
      }
    }
  }, 60000);

  it('the truth is the likelihood maximum, not merely a good fit', () => {
    const h = exactHistogram(TRUE_POLICY);
    const truthLL = logLikOf(h.hist, TRUE_POLICY);
    const decoyLL = logLikOf(h.hist, DECOY_POLICY);
    const fitLL = logLikOf(h.hist, fitEM(h.hist, { seed: 0 }).policy);
    expect(truthLL).toBeGreaterThan(decoyLL);
    expect(Math.abs(fitLL - truthLL)).toBeLessThan(1e-9);
  }, 60000);
});

describe('jacobiEigenvalues', () => {
  it('recovers known eigenvalues of a diagonal matrix', () => {
    const e = jacobiEigenvalues([[3, 0, 0], [0, 1, 0], [0, 0, 2]]);
    expect(e[0]).toBeCloseTo(1, 10);
    expect(e[1]).toBeCloseTo(2, 10);
    expect(e[2]).toBeCloseTo(3, 10);
  });

  it('recovers known eigenvalues of a symmetric 2x2', () => {
    // [[2,1],[1,2]] has eigenvalues 1 and 3
    const e = jacobiEigenvalues([[2, 1], [1, 2]]);
    expect(e[0]).toBeCloseTo(1, 10);
    expect(e[1]).toBeCloseTo(3, 10);
  });
});

describe('shape invariants', () => {
  it('every fitted row is a probability distribution', () => {
    const h = exactHistogram(TRUE_POLICY);
    const fit = fitEM(h.hist, { seed: 0 });
    for (const street of fit.policy) {
      for (const row of street) {
        const sum = ACTIONS.reduce((s, a) => s + row[a], 0);
        expect(sum).toBeCloseTo(1, 10);
        for (const a of ACTIONS) expect(row[a]).toBeGreaterThanOrEqual(0);
      }
    }
  }, 60000);

  it('scoreRecovery never collapses fold and continue into one figure', () => {
    const sc = scoreRecovery(DECOY_POLICY, TRUE_POLICY);
    expect(sc).toHaveProperty('maxFoldBranchAbsError');
    expect(sc).toHaveProperty('maxContinueBranchAbsError');
    expect(sc.cells).toHaveLength(3 * CLASSES.length * ACTIONS.length);
  });

  it('obsKey distinguishes a hidden trajectory from a revealed one', () => {
    expect(obsKey(['fold'], null)).not.toBe(obsKey(['fold'], [0]));
  });

  it('PRIOR and TRANSITION are proper distributions', () => {
    expect(PRIOR.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
    for (const row of TRANSITION) expect(row.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
  });
});
