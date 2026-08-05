/**
 * statPriorScore.test.js — WS-284.
 *
 * THE ONE TEST THAT MATTERS IS THE DIVERGENCE TEST. Everything else here is
 * arithmetic.
 *
 * WS-273 shipped `--reference` as a mandatory, leakage-guarded, 19-adversarial-
 * test decision over a channel that could not influence any reported number. It
 * survived because nothing forced the two configurations to differ: the suite was
 * green, the guard was correct, and the only way to notice was for a human to
 * diff two whole scorecards by eye and spot 16 matching significant figures.
 *
 * So the fix is not "make it live" — it is "make going inert a FAILURE". The
 * tests below drive the exact function the runner calls, once with a reference
 * table and once without, and fail if the outputs stop diverging.
 */

import { describe, it, expect } from 'vitest';
import {
  SCORED_STATS,
  scoreStatPriorWindow,
  buildStatPriorScorecard,
  assertReferenceTierLive,
  assertPriorEvidenceVisible,
  renderStatPriorScorecard,
} from '../backtest/statPriorScore.mjs';
import { STAT_PRIORS } from '../../src/utils/exploitEngine/bayesianConfidence';

/**
 * A POOL-mined reference row shaped exactly like `out/pool-reference.json` —
 * these are the real WS-284 50NLH 'full' aggregates, so the divergence this
 * suite asserts is the divergence the harness actually sees.
 */
const REFERENCE_TABLE = [{
  bb: 0.5,
  canonical: '0.25-0.5',
  minedLabel: '50NLH',
  buckets: {
    full: {
      hands: 417174,
      stats: {
        vpip: { k: 332121, n: 1676227 },
        pfr: { k: 149856, n: 1676227 },
        threeBet: { k: 15842, n: 507910 },
        foldTo3Bet: { k: 439657, n: 507910 },
        cbet: { k: 34753, n: 57596 },
        foldToCbet: { k: 23471, n: 42092 },
      },
    },
  },
}];

const SEGMENT = 'online/0.25-0.5';

const trainStats = () => ({
  handsSeenPreflop: 40, vpipCount: 13, pfrCount: 6,
  facedRaisePreflop: 9, threeBetCount: 1, foldTo3BetCount: 6,
  pfAggressorFlops: 5, cbetCount: 3, facedCbet: 7, foldedToCbet: 4,
});

const testStats = () => ({
  handsSeenPreflop: 10, vpipCount: 5, pfrCount: 1,
  facedRaisePreflop: 3, threeBetCount: 0, foldTo3BetCount: 3,
  pfAggressorFlops: 2, cbetCount: 1, facedCbet: 2, foldedToCbet: 2,
});

const window = (referenceTable) => scoreStatPriorWindow({
  playerId: 'villain-1',
  trainStats: trainStats(),
  testStats: testStats(),
  segmentKey: SEGMENT,
  seatBucket: 'full',
  referenceTable,
});

const cardFor = (referenceTable, referenceMode) => {
  const w = window(referenceTable);
  return buildStatPriorScorecard(w.records, {
    referenceMode,
    windows: 1,
    divergedWindows: w.priorsDiverged ? 1 : 0,
  });
};

// =============================================================================
// THE DIVERGENCE ASSERTION — the WS-284 regression gate
// =============================================================================

describe('WS-284 — the Reference tier must change the number it is guarded for', () => {
  const withRef = cardFor(REFERENCE_TABLE, 'pool-train');
  const noRef = cardFor(null, 'disabled');

  it('resolves priors that DIFFER from the founder estimate', () => {
    expect(window(REFERENCE_TABLE).priorsDiverged).toBe(true);
    expect(window(null).priorsDiverged).toBe(false);
  });

  it('produces a scorecard that is NOT bit-identical between the two arms', () => {
    // The exact failure WS-284 was filed for: with and without the tier, every
    // reported figure agreed to 16 significant figures. If this ever passes
    // again, the channel has been severed a second time.
    expect(withRef.overall.logLoss).not.toBe(noRef.overall.logLoss);
    expect(Math.abs(withRef.overall.logLoss - noRef.overall.logLoss)).toBeGreaterThan(1e-6);
    expect(JSON.stringify(withRef.perStat)).not.toBe(JSON.stringify(noRef.perStat));
  });

  it('moves EVERY stat the tier feeds, not just the aggregate', () => {
    // An aggregate can move while five of six stats sit inert. Check each.
    for (const stat of SCORED_STATS) {
      const a = withRef.perStat.find(r => r.stat === stat);
      const b = noRef.perStat.find(r => r.stat === stat);
      expect(a, `${stat} scored`).toBeDefined();
      expect(a.logLoss, `${stat} log-loss must respond to the tier`).not.toBe(b.logLoss);
    }
  });

  it('reports lift EXACTLY 0 when the tier is off — the inertness signature', () => {
    // With no reference and no founder pool, the resolved prior IS the founder
    // estimate, so model and baseline are the same computation. A 0.0% lift in
    // the output therefore means "this run's tier did nothing", visibly, in one
    // number, without diffing two runs.
    expect(noRef.overall.lift).toBe(0);
    expect(withRef.overall.lift).not.toBe(0);
  });
});

describe('assertReferenceTierLive — inertness is a run failure, not a footnote', () => {
  it('passes a run whose tier moved the score', () => {
    expect(assertReferenceTierLive(cardFor(REFERENCE_TABLE, 'pool-train'))).toBe(true);
  });

  it('is a no-op when the tier was explicitly disabled', () => {
    expect(assertReferenceTierLive(cardFor(null, 'disabled'))).toBe(true);
  });

  it('REFUSES a run that claims a table but resolved the founder estimate anyway', () => {
    // e.g. a live segment, or an online segment with no numeric stake —
    // resolveReferenceCounts serves neither, and the run would silently score a
    // configuration the flag does not describe.
    const inert = buildStatPriorScorecard(window(null).records, {
      referenceMode: 'pool-train', windows: 4, divergedWindows: 0,
    });
    expect(() => assertReferenceTierLive(inert)).toThrow(/INERT in this run/);
  });

  it('REFUSES a run whose priors moved but whose score did not', () => {
    const card = cardFor(REFERENCE_TABLE, 'pool-train');
    card.overall.logLoss = card.overall.baselineLogLoss;
    expect(() => assertReferenceTierLive(card)).toThrow(/bit-identical/);
  });

  it('REFUSES a run that claims a table and scored no window at all', () => {
    const empty = buildStatPriorScorecard([], {
      referenceMode: 'pool-train', windows: 0, divergedWindows: 3,
    });
    expect(() => assertReferenceTierLive(empty)).toThrow(/no stat window was scored/);
  });
});

// =============================================================================
// SCORING ARITHMETIC
// =============================================================================

describe('scoreStatPriorWindow', () => {
  it('scores the six stats the Reference tier feeds, and only those', () => {
    expect(SCORED_STATS.sort()).toEqual(
      ['cbet', 'foldTo3Bet', 'foldToCbet', 'pfr', 'threeBet', 'vpip'],
    );
  });

  it('skips a stat with no trials in the scored window', () => {
    const w = scoreStatPriorWindow({
      playerId: 'v', trainStats: trainStats(),
      testStats: { handsSeenPreflop: 10, vpipCount: 4, pfrCount: 2 }, // no postflop denominators
      segmentKey: SEGMENT, seatBucket: 'full', referenceTable: REFERENCE_TABLE,
    });
    expect(w.records.map(r => r.stat).sort()).toEqual(['pfr', 'vpip']);
  });

  it('forms the belief from the training prefix and the prior, never the test window', () => {
    const w = window(null);
    const vpip = w.records.find(r => r.stat === 'vpip');
    const p = STAT_PRIORS.vpip;
    // (13 + alpha) / (40 + alpha + beta) — the test window's 5/10 is nowhere in it.
    expect(vpip.pModel).toBeCloseTo((13 + p.alpha) / (40 + p.alpha + p.beta), 12);
    expect(vpip.pModel).not.toBeCloseTo(5 / 10, 3);
  });

  it('scores a confident-and-wrong belief worse than a confident-and-right one', () => {
    const base = { playerId: 'v', segmentKey: SEGMENT, seatBucket: 'full', referenceTable: null };
    const nit = { handsSeenPreflop: 200, vpipCount: 20 };
    const right = scoreStatPriorWindow({
      ...base, trainStats: nit, testStats: { handsSeenPreflop: 20, vpipCount: 2 },
    }).records.find(r => r.stat === 'vpip');
    const wrong = scoreStatPriorWindow({
      ...base, trainStats: nit, testStats: { handsSeenPreflop: 20, vpipCount: 18 },
    }).records.find(r => r.stat === 'vpip');
    expect(wrong.logLossModel).toBeGreaterThan(right.logLossModel);
  });
});

describe('buildStatPriorScorecard', () => {
  it('weights by trials, so a 2-trial window cannot outvote a 40-trial one', () => {
    const records = [
      { stat: 'vpip', nTest: 2, logLossModel: 4, logLossBaseline: 4, pModel: 0.5, actualRate: 0.5 },
      { stat: 'vpip', nTest: 38, logLossModel: 0.5, logLossBaseline: 0.5, pModel: 0.5, actualRate: 0.5 },
    ];
    const card = buildStatPriorScorecard(records, { referenceMode: 'disabled' });
    expect(card.overall.logLoss).toBeCloseTo((4 * 2 + 0.5 * 38) / 40, 12);
  });

  it('reports nothing for a stat with no scored windows rather than a null row', () => {
    const card = buildStatPriorScorecard(window(null).records, { referenceMode: 'disabled' });
    expect(card.perStat.every(r => r.trials > 0)).toBe(true);
  });

  it('renders, and puts the lift where a reader will see it', () => {
    // The render path is otherwise exercised only by a multi-minute corpus run.
    const out = renderStatPriorScorecard(cardFor(REFERENCE_TABLE, 'pool-train'), 'caveat here');
    expect(out).toContain('REFERENCE-TIER SCORECARD');
    expect(out).toContain('caveat here');
    expect(out).toContain('pool-train');
    for (const stat of SCORED_STATS) expect(out).toContain(stat);
  });
});

// =============================================================================
// WS-374 — THE SERVED PRIOR MUST CARRY ITS n
// =============================================================================

/**
 * The WS-374 divergence assertion, and it is the only test here that matters.
 *
 * WS-325's layer reconciliation ends: `L8 service  n=13.5M -> pseudocount <= 10-35
 * (n discarded)`. `resolveStatPriors` computed `reference.meta` on every call and
 * dropped it on the next line, so a prior backed by 13,476,245 mined hands and one
 * backed by 300 arrived at every consumer as the same JavaScript number.
 *
 * These two tables are IDENTICAL IN RATE and differ only in how much evidence stands
 * behind that rate. The served prior's STRENGTH is capped by design (measured
 * between-player overdispersion, WS-262), so it cannot and must not encode the
 * difference — which is exactly why the difference has to travel beside it.
 */
const rowWithN = (n) => [{
  bb: 0.5,
  canonical: '0.25-0.5',
  minedLabel: '50NLH',
  buckets: {
    full: {
      hands: n,
      stats: Object.fromEntries(SCORED_STATS.map(s => [s, { k: 0.2 * n, n }])),
    },
  },
}];

const CORPUS_N = 13476245;   // the WS-325 L8 figure
const THIN_N = 300;

/** A founder estimate whose mean is exactly the pool rate, so dilution cannot confound. */
const MATCHED_PRIORS = Object.fromEntries(
  Object.entries(STAT_PRIORS).map(([s, p]) => {
    const w = p.alpha + p.beta;
    return [s, { alpha: 0.2 * w, beta: 0.8 * w }];
  }),
);

const windowWith = (referenceTable, staticPriors = STAT_PRIORS) => scoreStatPriorWindow({
  playerId: 'villain-1',
  trainStats: trainStats(),
  testStats: testStats(),
  segmentKey: SEGMENT,
  seatBucket: 'full',
  referenceTable,
  staticPriors,
});

const cardWith = (referenceTable, staticPriors) => {
  const w = windowWith(referenceTable, staticPriors);
  return buildStatPriorScorecard(w.records, {
    referenceMode: 'pool-train',
    windows: 1,
    divergedWindows: w.priorsDiverged ? 1 : 0,
  });
};

describe('WS-374 — a consumer must be able to tell a 13.5M-hand prior from a 300-hand one', () => {
  it('the served alpha/beta ALONE cannot distinguish them — this is the defect, measured', () => {
    // Same rate, evidence differing by 44,920.8x. The prior's pseudocount is bit-identical
    // because the cap binds in both cases; only the founder estimate's dilution moves the
    // mean at all, and with a matched founder estimate even that vanishes.
    const big = windowWith(rowWithN(CORPUS_N)).priors.vpip;
    const thin = windowWith(rowWithN(THIN_N)).priors.vpip;

    expect(big.alpha + big.beta).toBeCloseTo(thin.alpha + thin.beta, 12);
    const meanOf = (p) => p.alpha / (p.alpha + p.beta);
    expect(Math.abs(meanOf(big) - meanOf(thin))).toBeLessThan(2e-3);

    const bigM = windowWith(rowWithN(CORPUS_N), MATCHED_PRIORS).priors.vpip;
    const thinM = windowWith(rowWithN(THIN_N), MATCHED_PRIORS).priors.vpip;
    expect(bigM.alpha).toBe(thinM.alpha);   // bit-identical
    expect(bigM.beta).toBe(thinM.beta);
  });

  it('the CONSUMER distinguishes them — the scorecard reports the n behind each prior', () => {
    // FAILS AGAINST HEAD: with `meta` discarded there is no evidence on the records at
    // all, so both scorecards report the same nothing and the two are indistinguishable.
    const big = cardWith(rowWithN(CORPUS_N));
    const thin = cardWith(rowWithN(THIN_N));

    for (const stat of SCORED_STATS) {
      const b = big.perStat.find(r => r.stat === stat).evidence;
      const t = thin.perStat.find(r => r.stat === stat).evidence;
      expect(b.referenceNMax).toBe(CORPUS_N);
      expect(t.referenceNMax).toBe(THIN_N);
      expect(b.referenceNMax).not.toBe(t.referenceNMax);
      // Both are bound by the cap, not by the data — the fact that makes the two
      // priors equally strong, now stated rather than inferred.
      expect(b.referenceLimitedBy).toEqual(['cap']);
      expect(t.referenceLimitedBy).toEqual(['cap']);
    }
    expect(JSON.stringify(big.perStat)).not.toBe(JSON.stringify(thin.perStat));
  });

  it('names WHICH row answered and how far the nearest-stake substitution reached', () => {
    const card = cardWith(rowWithN(CORPUS_N));
    const e = card.perStat.find(r => r.stat === 'vpip').evidence;
    expect(e.referenceRows).toEqual(['50NLH']);
    expect(e.referenceBuckets).toEqual(['full']);
    expect(e.maxStakeReachLogDist).toBeCloseTo(0, 12); // exact stake match
  });

  it('flags a prior bound by its EVIDENCE rather than by the cap', () => {
    // vpip's cap is 10 pseudo-observations; a 4-hand row cannot even reach it. That
    // prior gets stronger if more is mined; a capped one never will, however large n.
    const e = cardWith(rowWithN(4)).perStat.find(r => r.stat === 'vpip').evidence;
    expect(e.referenceLimitedBy).toEqual(['evidence']);
    expect(e.priorPseudocount).toBeCloseTo(14, 6); // founder 10 + min(n=4, cap=10)
  });

  it('REFUSES a run whose priors came from a mined table but carry no evidence', () => {
    // The regression gate. Strip the evidence and the run must fail, not warn.
    const card = cardWith(rowWithN(CORPUS_N));
    expect(() => assertPriorEvidenceVisible(card)).not.toThrow();

    const stripped = {
      ...card,
      perStat: card.perStat.map(r => ({ ...r, evidence: undefined })),
    };
    expect(() => assertPriorEvidenceVisible(stripped)).toThrow(/no reference evidence/);
    // And it rides on the existing gate, so every current caller enforces it.
    expect(() => assertReferenceTierLive(stripped)).toThrow(/WS-374/);
  });

  it('surfaces the evidence to a reader, not just to a JSON file', () => {
    const out = renderStatPriorScorecard(cardWith(rowWithN(CORPUS_N)), '');
    expect(out).toContain('EVIDENCE BEHIND THE SERVED PRIOR');
    expect(out).toContain(String(CORPUS_N));
    expect(out).toContain('50NLH');
  });
});
