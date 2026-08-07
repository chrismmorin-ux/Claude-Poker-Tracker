/**
 * rakeSensitivity.test.js — WS-429: edgeBB is NOT rake-invariant, and this file is the
 * record of how far it moves.
 *
 * The premise (verified at source, 2026-08-07): edgeBB = wisValue − poolValue over the
 * SAME net_d (ipsEstimator.mjs:224-227); the two means weight the same outcomes
 * differently; rake is paid only by pot WINNERS (handOutcome.mjs:223-230) and is capped,
 * so its burden is not uniform across the weight distribution and does not cancel in the
 * subtraction. Before this file, zero tests asserted anything about edgeBB under a rake
 * schedule change.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * FAULT REGISTER — EVIDENCE PROPOSAL (FAULT-modelled-rake, rank 3, P=0.90, `untested`)
 * ─────────────────────────────────────────────────────────────────────────────────────
 * The entry's falsifier reads: "Sweep the rake schedule across the live and online
 * configurations and report the conclusion under each." This file IS that sweep at
 * fixture scale, and the result is the non-robust branch: edgeBB moved −0.1842 bb per
 * rake doubling (~18× the 0.01 bb tolerance), so edgeBB figures "must state which pool
 * [they were] measured on" — which the manifest stamp now forces.
 *
 * Register entries may not be moved by hand — `faultEntryProblems` requires recorded
 * evidence and a status change edits a hashed register (`registerVersion()` moves).
 * PROPOSED evidence block for a founder-approved move of FAULT-modelled-rake from
 * `untested` to `partially-supported` (paste into the entry's `evidence` array):
 *
 *   'WS-429 (2026-08-07) — scripts/backtest/rakeSensitivity.mjs fixture sweep: edgeBB '
 *   + 'moved -0.1843 bb (zero→online-2009 schedule) and -0.1842 bb per further rake '
 *   + 'doubling (online→live-1/2-like {pct:0.10,cap:6}) on a fixed 12-decision set — '
 *   + 'NOT rake-invariant at the declared 0.01 bb tolerance. Fixture-scale instance of '
 *   + 'this entry\'s falsifier; corpus-scale sweep is the named follow-up.',
 *
 * "Partially-supported", not "confirmed": the falsifier asks for the sweep on the LIVE
 * and online configurations of real runs; this is the mechanism demonstrated and sized
 * on a canonical fixture. NOT applied in this change — the founder owns register edits.
 */

import { describe, it, expect } from 'vitest';

import {
  ZERO_RAKE, ONLINE_2009_RAKE, LIVE_DOUBLE_RAKE, RAKE_SCHEDULES,
  RAKE_INVARIANCE_TOLERANCE_BB, RAKE_SENSITIVITY_STAMP,
  buildRakeSweepFixture, edgeUnderRakeSchedule, measureRakeSensitivity,
} from '../backtest/rakeSensitivity.mjs';
import { DEFAULT_RAKE_CONFIG } from '../backtest/heroEvRunner.mjs';
import { estimateRake } from '../../src/utils/potCalculator.js';
import { collectConstants } from '../backtest/replicationStamp.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════
// THE DOCUMENTED MEASUREMENT (WS-429 AC2)
//
// Measured 2026-08-07 on the canonical fixture (12 decisions, 6 players, deterministic).
// These literals are the RECORD; the tests below recompute the sweep and assert it still
// produces exactly these numbers, so any drift in the estimator, the outcome derivation,
// the rake model, or the fixture is caught here and must be consciously re-measured —
// NEVER absorbed by widening RAKE_INVARIANCE_TOLERANCE_BB.
// ═══════════════════════════════════════════════════════════════════════════════════════

const DOCUMENTED = {
  edgeBBBySchedule: {
    zeroRake: 5.8704,   // no rake
    online2009: 5.6861, // {pct:0.05, cap:3} — the corpus assumption (DEFAULT_RAKE_CONFIG)
    liveDouble: 5.5019, // {pct:0.10, cap:6} — live-1/2-like, exactly 2× online everywhere
  },
  deltaZeroToOnlineBB: -0.1843,
  // THE HEADLINE: how far edgeBB moves per rake doubling, on this fixture. ~18× the
  // declared tolerance. At the censused ~0.7-1 opportunities/hand this is roughly
  // -13 to -18 bb/100 of overallEvBB100 per doubling — a live-rake calibration would
  // move the founder's headline by this order while changing nothing about the engine.
  bbPerRakeDoubling: -0.1842,
};

describe('rake schedules — pinned to their definition sites', () => {
  it('online2009 equals heroEvRunner.DEFAULT_RAKE_CONFIG byte for byte', () => {
    // ONLINE_2009_RAKE is a transcription (heroEvRunner is loader-only, so the stamp
    // module cannot import it). A transcription is legal ONLY with this executable
    // equality check — the hand-transcribed-literal defect (cf. run-hero-ev.mjs:71,
    // which carries an unchecked copy of the same config) is exactly what WS-429's
    // acceptance criteria name as a known repo defect pattern.
    expect(ONLINE_2009_RAKE).toEqual(DEFAULT_RAKE_CONFIG);
  });

  it('liveDouble doubles BOTH parameters, so modelled rake doubles at EVERY pot size', () => {
    expect(LIVE_DOUBLE_RAKE.pct).toBeCloseTo(ONLINE_2009_RAKE.pct * 2, 12);
    expect(LIVE_DOUBLE_RAKE.cap).toBeCloseTo(ONLINE_2009_RAKE.cap * 2, 12);
    // min(2p·x, 2c) = 2·min(p·x, c): the identity that makes "per rake doubling" an
    // exact scalar treatment rather than a loose analogy. Checked through the real
    // estimateRake on every fixture pot, both rake regimes (pct-binding and cap-binding).
    const { hands } = buildRakeSweepFixture();
    for (const hand of hands) {
      const pot = Object.values(hand._backtest.committedBySeat).reduce((s, v) => s + v, 0);
      expect(estimateRake(pot, LIVE_DOUBLE_RAKE, 'flop'))
        .toBeCloseTo(2 * estimateRake(pot, ONLINE_2009_RAKE, 'flop'), 10);
    }
  });

  it('the fixture straddles the cap knee — both rake regimes are actually exercised', () => {
    const { hands } = buildRakeSweepFixture();
    const pots = hands.map((h) => Object.values(h._backtest.committedBySeat).reduce((s, v) => s + v, 0));
    expect(pots.some((p) => p * ONLINE_2009_RAKE.pct < ONLINE_2009_RAKE.cap)).toBe(true); // pct binds
    expect(pots.some((p) => p * ONLINE_2009_RAKE.pct > ONLINE_2009_RAKE.cap)).toBe(true); // cap binds
  });
});

describe('the sweep is the SAME decisions under different schedules (WS-429 AC1)', () => {
  it('only the nets move — n, players, weights, ESS identical across all three arms', () => {
    const m = measureRakeSensitivity();
    const arms = Object.values(m.reports);
    expect(arms).toHaveLength(3);
    for (const r of arms) {
      expect(r.n).toBe(12);
      expect(r.players).toBe(6);
      expect(r.meanWeight).toBe(arms[0].meanWeight);
      expect(r.ess).toBe(arms[0].ess);
      expect(r.clippedShare).toBe(0); // the sweep never leans on the weight cap
      expect(r.skipped).toEqual({});  // and never silently shrinks the decision set
    }
  });

  it('{pct:0, cap:0} is equivalent to rakeConfig: null — zero rake means zero rake', () => {
    const fixture = buildRakeSweepFixture();
    const explicit = edgeUnderRakeSchedule({ ...fixture, rakeConfig: ZERO_RAKE });
    const nullCfg = edgeUnderRakeSchedule({ ...fixture, rakeConfig: null });
    expect(explicit.edgeBB).toBe(nullCfg.edgeBB);
    expect(explicit.valuePoolBB).toBe(nullCfg.valuePoolBB);
  });

  it('is deterministic — two sweeps agree exactly, which is what licenses the stamp', () => {
    const a = measureRakeSensitivity();
    const b = measureRakeSensitivity();
    expect(a.edgeBBBySchedule).toEqual(b.edgeBBBySchedule);
    expect(a.bbPerRakeDoubling).toBe(b.bbPerRakeDoubling);
  });
});

describe('THE MEASUREMENT — edgeBB is NOT rake-invariant (WS-429 AC2)', () => {
  const m = measureRakeSensitivity();

  it('reproduces the documented edgeBB at every schedule', () => {
    expect(m.edgeBBBySchedule.zeroRake).toBe(DOCUMENTED.edgeBBBySchedule.zeroRake);
    expect(m.edgeBBBySchedule.online2009).toBe(DOCUMENTED.edgeBBBySchedule.online2009);
    expect(m.edgeBBBySchedule.liveDouble).toBe(DOCUMENTED.edgeBBBySchedule.liveDouble);
  });

  it('reproduces the documented deltas', () => {
    expect(m.deltaZeroToOnlineBB).toBe(DOCUMENTED.deltaZeroToOnlineBB);
    expect(m.bbPerRakeDoubling).toBe(DOCUMENTED.bbPerRakeDoubling);
  });

  it('FAILS the invariance tolerance by an order of magnitude — that is the finding', () => {
    // If this assertion ever starts failing in the OTHER direction (movement shrank),
    // that is also news: re-measure, re-document, and say what changed. Do not delete.
    expect(Math.abs(m.bbPerRakeDoubling)).toBeGreaterThan(RAKE_INVARIANCE_TOLERANCE_BB * 10);
    // And the direction: rake REDUCES the measured edge on this fixture (the engine's
    // high-weight decisions sit in bigger won pots, where the capped rake bites).
    expect(m.bbPerRakeDoubling).toBeLessThan(0);
  });

  it('movement is linear in the schedule scaling: zero→live = 2 × zero→online', () => {
    const zeroToLive = m.edgeBBBySchedule.liveDouble - m.edgeBBBySchedule.zeroRake;
    // 3dp: each edgeBB is independently rounded to 4dp before differencing.
    expect(zeroToLive).toBeCloseTo(2 * m.deltaZeroToOnlineBB, 3);
  });

  it('the tolerance itself is the declared constant, not a number local to this file', () => {
    expect(RAKE_INVARIANCE_TOLERANCE_BB).toBe(0.01);
  });
});

describe('the manifest stamp — derived from the measurement, never transcribed (AC3)', () => {
  it('RAKE_SENSITIVITY_STAMP carries exactly what measureRakeSensitivity() returns', () => {
    const m = measureRakeSensitivity();
    expect(RAKE_SENSITIVITY_STAMP.edgeBBBySchedule).toEqual(m.edgeBBBySchedule);
    expect(RAKE_SENSITIVITY_STAMP.bbPerRakeDoubling).toBe(m.bbPerRakeDoubling);
    expect(RAKE_SENSITIVITY_STAMP.deltaZeroToOnlineBB).toBe(m.deltaZeroToOnlineBB);
    expect(RAKE_SENSITIVITY_STAMP.n).toBe(m.n);
  });

  it('names its fault, its basis, its tolerance, and its verdict', () => {
    expect(RAKE_SENSITIVITY_STAMP.faultId).toBe('FAULT-modelled-rake');
    expect(RAKE_SENSITIVITY_STAMP.basis).toBe('fixture-sweep');
    expect(RAKE_SENSITIVITY_STAMP.basisNote).toMatch(/NOT on\s+the corpus/);
    expect(RAKE_SENSITIVITY_STAMP.toleranceBB).toBe(RAKE_INVARIANCE_TOLERANCE_BB);
    expect(RAKE_SENSITIVITY_STAMP.verdict).toBe('not-rake-invariant');
    expect(RAKE_SENSITIVITY_STAMP.schedules).toEqual(RAKE_SCHEDULES);
  });

  it('collectConstants puts the sensitivity on every replication manifest', async () => {
    // The stub serves the four src constant modules; the rakeSensitivity path must be
    // served with the REAL module, which is the point: the stamp on the manifest and the
    // value this test measured are the same object from the same code.
    const real = await import('../backtest/rakeSensitivity.mjs');
    const loader = {
      load: async (p) => {
        if (p === '/scripts/backtest/rakeSensitivity.mjs') return real;
        if (p.endsWith('populationPriors.js')) return { PRIOR_WEIGHT: 10, SUBCLASS_PRIOR_WEIGHT: 5 };
        if (p.endsWith('softWeights.js')) return { TAU_FRACTION: 0.5, MIN_CONTINUATION_WEIGHT: 0.05 };
        if (p.endsWith('postflopNarrower.js')) return { ACTION_TAU_FRACTION: { bet: 0.5 } };
        if (p.endsWith('foldEquityCalculator.js')) return {};
        // WS-432 (merged from ws-292): collectConstants also reads the refinement clock
        // and KL_FLOOR from their definition sites.
        if (p.endsWith('refinementWork.js')) {
          return { MAX_STAGE_SHARE: 0.4, REFINEMENT_UNITS_PER_MS: 300, REFINEMENT_CLOCK_VERSION: 1 };
        }
        if (p.endsWith('divergence.js')) return { KL_FLOOR: 1e-6 };
        throw new Error(`unexpected loader path: ${p}`);
      },
    };
    const { constants } = await collectConstants(loader);
    expect(constants.RAKE_SENSITIVITY_BB_PER_RAKE_DOUBLING).toBe(RAKE_SENSITIVITY_STAMP.bbPerRakeDoubling);
    expect(constants.RAKE_SENSITIVITY_PROVENANCE).toEqual(RAKE_SENSITIVITY_STAMP);
    // The pre-existing minimum set is untouched by the addition.
    expect(constants.PRIOR_WEIGHT).toBe(10);
    expect(constants.MIN_CONTINUATION_WEIGHT).toBe(0.05);
  });
});
