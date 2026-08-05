/**
 * optimismBias.test.js — WS-295, the optimizer's curse.
 *
 * Two families here, and the second is the one that matters.
 *
 * 1. The DECOMPOSITION is arithmetically sound: E[max] never falls below max E[·], the three
 *    differences are non-negative, and `jensenGap + selectionLoss` closes on `curse` exactly.
 *    A decomposition that does not close would let a real effect and a sign error look alike.
 *
 * 2. The SHAPE REPORT IS INVARIANT TO THE STATED-EV UNIT. This is the ticket's central hazard:
 *    stated EV is per-decision engine chips, the realized outcome is the whole hand's net in bb,
 *    and any construction that differences them produces a confident wrong number. The test
 *    scales every stated-EV field by 1000 and asserts the verdicts do not move. If someone later
 *    "simplifies" the report by subtracting realized from stated, this test fails — which is the
 *    only way that regression gets caught, since the number it produces looks perfectly plausible.
 */

import { describe, it, expect } from 'vitest';
import {
  nodeOptimism, optimismProblems, meanSd, spearman, shapeVerdict, shapeReport,
} from '../backtest/optimismBias.mjs';
import { buildCurseReport } from '../backtest/heroEvReport.mjs';

/** Deterministic normal draws — a test that flakes on RNG is worse than no test. */
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gaussians = (seed, n) => {
  const r = mulberry32(seed);
  const out = [];
  while (out.length < n) {
    const u = Math.max(r(), 1e-12);
    const v = r();
    out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
};

/** R replicates of `means` perturbed by iid noise of the given sd. */
const replicatesFor = (means, sd, R, seed) => {
  const actions = Object.keys(means);
  const z = gaussians(seed, R * actions.length);
  let k = 0;
  return Array.from({ length: R }, () =>
    Object.fromEntries(actions.map((a) => [a, means[a] + sd * z[k++]])));
};

describe('nodeOptimism — the decomposition', () => {
  it('never reports E[max] below max E[·] — Jensen, which holds for any noisy estimator', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const reps = replicatesFor({ bet: 10, check: 9.5, fold: 0 }, 3, 40, seed);
      const node = nodeOptimism(reps);
      expect(node.jensenGap).toBeGreaterThanOrEqual(-1e-9);
      expect(node.selectionLoss).toBeGreaterThanOrEqual(-1e-9);
      expect(node.curse).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('closes exactly: curse = jensenGap + selectionLoss', () => {
    const node = nodeOptimism(replicatesFor({ bet: 10, check: 9.5, raise: 8 }, 4, 60, 7));
    expect(node.jensenGap + node.selectionLoss).toBeCloseTo(node.curse, 10);
    expect(optimismProblems(node)).toEqual([]);
  });

  it('reports ZERO curse when the estimator carries no noise', () => {
    const reps = replicatesFor({ bet: 10, check: 4 }, 0, 20, 3);
    const node = nodeOptimism(reps);
    expect(node.curse).toBeCloseTo(0, 12);
    expect(node.meanNoiseSd).toBeCloseTo(0, 12);
    expect(node.argmaxStability).toBe(1);
  });

  it('reports ZERO selection loss when the margin dwarfs the noise — noise cannot dislodge a clear winner', () => {
    const node = nodeOptimism(replicatesFor({ bet: 100, check: 0 }, 1, 40, 11));
    expect(node.argmaxStability).toBe(1);
    expect(node.selectionLoss).toBeCloseTo(0, 10);
  });

  it('produces a POSITIVE curse from noise alone when the actions are genuinely tied', () => {
    // Equal means, so there is nothing to learn and nothing to lose by choosing either. Every
    // unit of apparent edge here is manufactured by the max — the pure Jensen term.
    //
    // `selectionLoss` does not come out at exactly zero, and that is a property of the
    // estimator rather than a defect: `oracle` is itself an argmax over R-replicate SAMPLE
    // means, so it carries its own small optimism of order sd/sqrt(R). At R=400, sd=6 that is
    // about 0.1, which is what shows up here. The assertion is therefore that the Jensen term
    // DOMINATES, not that the selection term vanishes. See `nodeOptimism`'s docblock.
    const node = nodeOptimism(replicatesFor({ bet: 5, check: 5 }, 6, 400, 23));
    expect(node.curse).toBeGreaterThan(1);
    expect(node.selectionLoss).toBeLessThan(0.2);
    expect(node.jensenGap).toBeGreaterThan(10 * node.selectionLoss);
  });

  it('grows with the number of actions compared, holding noise and means fixed', () => {
    const two = nodeOptimism(replicatesFor({ a: 5, b: 5 }, 5, 400, 31));
    const six = nodeOptimism(replicatesFor(
      { a: 5, b: 5, c: 5, d: 5, e: 5, f: 5 }, 5, 400, 31));
    expect(six.curse).toBeGreaterThan(two.curse);
  });

  it('takes the INTERSECTION of actions, so an action missing from one replicate cannot win there', () => {
    const node = nodeOptimism([
      { bet: 10, check: 1 },
      { bet: 9, check: 2, raise: 99 },  // `raise` appears once — it must not enter the max
      { bet: 11, check: 0 },
    ]);
    expect(node.nActions).toBe(2);
    expect(Object.keys(node.perAction).sort()).toEqual(['bet', 'check']);
  });

  it('refuses a single replicate or a single action rather than returning a zero', () => {
    expect(nodeOptimism([{ bet: 1, check: 2 }])).toBeNull();
    expect(nodeOptimism([{ bet: 1 }, { bet: 2 }])).toBeNull();
    expect(optimismProblems(null)).toHaveLength(1);
  });
});

describe('meanSd / spearman', () => {
  it('computes a sample sd, not a population one', () => {
    expect(meanSd([2, 4, 4, 4, 5, 5, 7, 9]).mean).toBeCloseTo(5, 10);
    expect(meanSd([2, 4, 4, 4, 5, 5, 7, 9]).sd).toBeCloseTo(2.13809, 4);
  });

  it('handles ties by average rank', () => {
    expect(spearman([1, 2, 3, 4], [1, 2, 3, 4]).rho).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1]).rho).toBeCloseTo(-1, 10);
    expect(spearman([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
  });
});

describe('shapeVerdict — a flat result is a REFUTATION, never a shrug', () => {
  it('calls a CI straddling zero REFUTED-FLAT', () => {
    const v = shapeVerdict(0.12, { lo: -0.4, hi: 0.5 }, 'positive');
    expect(v.verdict).toBe('REFUTED-FLAT');
    expect(v.detail).toMatch(/straddles zero/);
  });

  it('calls a significant result in the wrong direction REFUTED-WRONG-SIGN, not confirmed', () => {
    expect(shapeVerdict(-0.6, { lo: -0.8, hi: -0.3 }, 'positive').verdict).toBe('REFUTED-WRONG-SIGN');
  });

  it('confirms only when the CI excludes zero in the predicted direction', () => {
    expect(shapeVerdict(0.6, { lo: 0.3, hi: 0.8 }, 'positive').verdict).toBe('CONFIRMED');
  });

  it('reports undetermined rather than guessing when no interval exists', () => {
    expect(shapeVerdict(0.6, null, 'positive').verdict).toBe('undetermined');
  });

  it('says UNDERPOWERED, not REFUTED, when too few clusters carry a non-degenerate value', () => {
    // The distinction this guards is the whole difference between "we looked and it is not
    // there" and "we could not have seen it". The probe's first run hit exactly this: 8 nodes,
    // 7 of them with a curse of exactly zero.
    const v = shapeVerdict(0.42, { lo: -0.6, hi: 0.7 }, 'positive', { informativeClusters: 1 });
    expect(v.verdict).toBe('UNDERPOWERED');
    expect(v.detail).toMatch(/NOT a refutation/);
  });

  it('still refutes when the sample IS powered', () => {
    const v = shapeVerdict(0.05, { lo: -0.3, hi: 0.3 }, 'positive', { informativeClusters: 40 });
    expect(v.verdict).toBe('REFUTED-FLAT');
  });

  it('flags a significant result carried by too few clusters rather than reporting a clean CONFIRMED', () => {
    const v = shapeVerdict(0.8, { lo: 0.4, hi: 0.95 }, 'positive', { informativeClusters: 2 });
    expect(v.verdict).toBe('CONFIRMED-UNDERPOWERED');
  });
});

describe('shapeReport', () => {
  it('recovers a planted positive noise->curse relationship', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({
      cluster: `s${i % 6}`, curse: i * 0.5, meanNoiseSd: i, topTwoMargin: 30 - i, nActions: 3,
    }));
    const rep = shapeReport(nodes);
    expect(rep.vsNoise.rho).toBeGreaterThan(0.9);
    expect(rep.vsMargin.rho).toBeLessThan(-0.9);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE UNIT TRAP
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * A set carrying a PLANTED curse, spread across enough players for a cluster bootstrap.
 *
 * The plant has to be made through the IMPORTANCE WEIGHTS, not through the outcomes, and the
 * first version of this fixture got that wrong in a way worth recording: it gave every decision
 * the same `piOurs`/`piPool`, so every weight was the identical constant — and a weighted mean
 * with constant weights IS the plain mean, so `wisValue - poolValue` was identically zero in
 * every stratum and the fixture could not express an edge at all.
 *
 * Here the pool is held at 50/50 and OUR policy's agreement with the winning action decays as
 * the covariate rises: at level 0 our policy puts 0.9 on the action that wins, at level 5 it is
 * indifferent. The realized edge therefore falls monotonically from +8 bb to 0 across levels,
 * which is exactly the curse's signature — the advice delivers less of its stated value at the
 * wide-posterior, thin-margin nodes.
 */
const cursedSet = () => {
  const out = [];
  // 34 players, deliberately above `MIN_CLUSTERS_FOR_CI` (30): below that bar the report
  // correctly refuses to issue CONFIRMED or REFUTED at all, so a fixture with fewer clusters
  // could not exercise the verdict logic these tests are about.
  for (let p = 0; p < 34; p++) {
    for (let level = 0; level < 6; level++) {
      // How strongly our policy backs the action that actually pays. Decays with the covariate.
      const favour = 0.5 + 0.4 * (1 - level / 5);
      for (const good of [true, false]) {
        out.push({
          playerId: `p${p}`,
          handId: `h${out.length}`,
          observedAction: 'call',
          netBB: good ? 10 : -10,
          piOurs: { call: good ? favour : 1 - favour, fold: good ? 1 - favour : favour },
          piPool: { call: 0.5, fold: 0.5 },
          evStats: {
            combosScored: 10,
            statedEvMean: 12 + level,
            statedEvSd: level,
            // Runs OPPOSITE to width, as the curse predicts it should: a wide posterior is
            // where the top two actions are closest together.
            topTwoMarginMean: 5 - level,
            combosWithMargin: 10,
            nActionsMean: level,
            depthReachedMax: 2,
          },
        });
      }
    }
  }
  return out;
};

describe('buildCurseReport', () => {
  it('reports its own unavailability WITH A REASON on a run that predates the stated-EV capture', () => {
    const legacy = cursedSet().map(({ evStats, ...rest }) => rest);
    const rep = buildCurseReport(legacy);
    expect(rep.available).toBe(false);
    expect(rep.reason).toMatch(/predates the WS-295 stated-EV capture/);
    // The unit note must be present even when nothing was measured — it is what stops the
    // absence from being read as "the two quantities are comparable, we just did not compare".
    expect(rep.unitNote).toMatch(/NEVER differenced/);
    expect(rep.liveTransfer).toMatch(/TRANSFERRED, not measured/);
  });

  it('produces a verdict word on every axis, and terciles that carry ESS and clipped share', () => {
    const rep = buildCurseReport(cursedSet());
    expect(rep.available).toBe(true);
    for (const axis of [rep.vsPosteriorWidth, rep.vsTopTwoMargin, rep.vsActionCount]) {
      expect(['CONFIRMED', 'REFUTED-FLAT', 'REFUTED-WRONG-SIGN', 'UNDETERMINED']).toContain(axis.verdict);
    }
    for (const k of ['low', 'mid', 'high']) {
      const s = rep.vsPosteriorWidth.strata[k];
      expect(s.ess).toBeGreaterThan(0);
      expect(s.essShare).toBeGreaterThan(0);
      expect(s.clippedShare).toBeGreaterThanOrEqual(0);
      expect(s.n).toBeGreaterThan(0);
    }
  });

  it('names hero RANGE posterior as the width, not the villain model — which is held constant', () => {
    // The pass holds the villain at population baseline, so villain-posterior width does not
    // vary across decisions and cannot be this covariate. A reader who assumed otherwise would
    // credit the run with a channel it never varied.
    const rep = buildCurseReport(cursedSet());
    expect(rep.posteriorWidthMeans).toMatch(/hero range posterior/);
    expect(rep.posteriorWidthMeans).toMatch(/population baseline/);
  });

  it('is INVARIANT to the scale of stated EV — the headline cannot depend on the two units matching', () => {
    // THE REGRESSION THIS GUARDS. Stated EV is per-decision engine chips; `netBB` is the whole
    // hand's net in bb. Multiplying every stated-EV field by 1000 changes nothing about the
    // world, so it must change nothing about the verdicts. A construction that subtracts the
    // realized outcome from the stated one would move every number here — and would look
    // entirely plausible while doing it.
    const base = cursedSet();
    const scaled = base.map((d) => ({
      ...d,
      evStats: {
        ...d.evStats,
        statedEvMean: d.evStats.statedEvMean * 1000,
        statedEvSd: d.evStats.statedEvSd * 1000,
        topTwoMarginMean: d.evStats.topTwoMarginMean * 1000,
      },
    }));

    const a = buildCurseReport(base);
    const b = buildCurseReport(scaled);

    expect(b.vsPosteriorWidth.verdict).toBe(a.vsPosteriorWidth.verdict);
    expect(b.vsTopTwoMargin.verdict).toBe(a.vsTopTwoMargin.verdict);
    expect(b.vsPosteriorWidth.highMinusLowBB).toBeCloseTo(a.vsPosteriorWidth.highMinusLowBB, 10);
    expect(b.vsTopTwoMargin.highMinusLowBB).toBeCloseTo(a.vsTopTwoMargin.highMinusLowBB, 10);
    // The strata edges themselves must be identical too — a monotone rescale of the covariate
    // cannot move which decision lands in which tercile.
    for (const k of ['low', 'mid', 'high']) {
      expect(b.vsPosteriorWidth.strata[k].edgeBB).toBeCloseTo(a.vsPosteriorWidth.strata[k].edgeBB, 10);
    }
  });

  it('recovers a planted curse: the wide-posterior stratum realizes below the narrow one', () => {
    const rep = buildCurseReport(cursedSet());
    expect(rep.vsPosteriorWidth.strata.high.edgeBB).toBeLessThan(rep.vsPosteriorWidth.strata.low.edgeBB);
    expect(rep.vsPosteriorWidth.highMinusLowBB).toBeLessThan(0);
    expect(rep.vsPosteriorWidth.verdict).toBe('CONFIRMED');
  });

  it('recovers the margin axis in the OPPOSITE direction on the same planted set', () => {
    // The two axes are not restatements of each other: width and margin run opposite by
    // construction, so a report that confirmed both in the SAME direction would be reporting
    // one covariate twice. This is the check that they are genuinely two tests.
    const rep = buildCurseReport(cursedSet());
    expect(rep.vsTopTwoMargin.highMinusLowBB).toBeGreaterThan(0);
    expect(rep.vsTopTwoMargin.verdict).toBe('CONFIRMED');
  });

  it('refuses a verdict below the cluster bar, and says the sample could not refute', () => {
    // Same planted effect, too few players. The block must NOT return REFUTED here — a wide
    // interval at 8 clusters is the cluster count talking, not the absence of the effect.
    const thin = cursedSet().filter((d) => Number(d.playerId.slice(1)) < 8);
    const rep = buildCurseReport(thin);
    expect(rep.vsPosteriorWidth.verdict).toMatch(/UNDERPOWERED/);
    expect(rep.vsPosteriorWidth.detail).toMatch(/NOT a refutation/);
    expect(rep.vsPosteriorWidth.contributingPlayers).toBe(8);
    // The direction is still reported, because a consistent sign is a hint worth carrying.
    expect(rep.vsPosteriorWidth.directionMatchesPrediction).toBe(true);
  });

  it('reports REFUTED-FLAT when the covariate carries no relationship to the edge', () => {
    // The null must be reachable, or "CONFIRMED" carries no information. Same decisions, but
    // the covariate is shuffled free of the outcome.
    const rows = cursedSet().map((d, i) => ({
      ...d, evStats: { ...d.evStats, statedEvSd: (i * 7919) % 100 },
    }));
    expect(buildCurseReport(rows).vsPosteriorWidth.verdict).toMatch(/REFUTED/);
  });
});
