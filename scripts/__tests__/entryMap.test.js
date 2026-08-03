/**
 * entryMap.test.js — WS-323.
 *
 * The estimator's job is to be honest about what it does and does not know, so these tests
 * are mostly about the DIFFERENCE between kinds of absence and kinds of uncertainty. Each one
 * pins a distinction that, collapsed, would make the map read as more confident than it is.
 */

import { describe, it, expect } from 'vitest';

import {
  BANDS,
  DEFAULT_TAU_BB,
  FACING_ACTIONS,
  FIELD_QUANTILES,
  POS_CATEGORIES,
  bandOf,
  buildFieldSweep,
  combineInterval,
  enumerateCells,
  entryMarginFrom,
  fieldPointStats,
  reachability,
  tableGeometry,
} from '../backtest/entryMap.mjs';
import { betaQuantile } from '../../src/utils/pokerCore/betaMath.js';

const HANDS = ['AA', 'AKs', '72o'];

describe('bands are decided by the INTERVAL, not the point estimate', () => {
  it('a cell is clear only when its whole interval is on one side of zero', () => {
    expect(bandOf({ lower: 0.2, upper: 0.8, halfWidth: 0.3 })).toBe(BANDS.CLEAR_PLUS);
    expect(bandOf({ lower: -0.8, upper: -0.2, halfWidth: 0.3 })).toBe(BANDS.CLEAR_MINUS);
  });

  it('a large margin with a huge interval is UNMEASURED, not a strong result', () => {
    // The whole point. A point estimate of +2bb looks decisive and means nothing at ±5bb.
    expect(bandOf({ margin: 2, lower: -3, upper: 7, halfWidth: 5 })).toBe(BANDS.UNMEASURED);
  });

  it('separates genuinely marginal from unmeasured by WIDTH, at tau', () => {
    const tight = { lower: -0.05, upper: 0.05, halfWidth: 0.05 };
    const wide = { lower: -3, upper: 3, halfWidth: 3 };
    // Both straddle zero and would be indistinguishable as point estimates.
    expect(bandOf(tight)).toBe(BANDS.FRINGE_TIGHT);
    expect(bandOf(wide)).toBe(BANDS.UNMEASURED);
  });

  it('tau is a reporting parameter — moving it moves the band, not the margin', () => {
    const cell = { lower: -0.4, upper: 0.4, halfWidth: 0.4 };
    expect(bandOf(cell, DEFAULT_TAU_BB)).toBe(BANDS.UNMEASURED);
    expect(bandOf(cell, 0.5)).toBe(BANDS.FRINGE_TIGHT);
  });
});

describe('the interval keeps its two error sources apart', () => {
  it('combines in quadrature, not by addition', () => {
    // Independent errors. Adding them would overstate the width, which here means
    // over-reporting cells as unmeasured and silently shrinking the fringe.
    const out = combineInterval([0, 0, 0, 0], [-1, 0, 1]);
    expect(out.mcError).toBe(0);
    expect(out.modelError).toBeCloseTo(1, 6);
    expect(out.halfWidth).toBeCloseTo(1.96, 6);
  });

  it('reports mcError as a standard ERROR — more replicates, more precision', () => {
    const few = combineInterval([1, 2, 3], [2]);
    const many = combineInterval([1, 2, 3, 1, 2, 3, 1, 2, 3], [2]);
    expect(many.mcError).toBeLessThan(few.mcError);
  });

  it('reports modelError as a SPREAD — a wider sweep is not more certain', () => {
    // Field quantiles are a deliberate sensitivity sweep, not samples being averaged. Dividing
    // by sqrt(n) here would make a wider disagreement look like a tighter answer.
    const narrow = combineInterval([0], [-0.1, 0, 0.1]);
    const wide = combineInterval([0], [-2, 0, 2]);
    expect(wide.modelError).toBeGreaterThan(narrow.modelError);
  });

  it('a single replicate claims no precision it does not have', () => {
    const out = combineInterval([0.5], [0.5]);
    expect(out.mcError).toBe(0);
    expect(out.modelError).toBe(0);
  });
});

describe('unreachable is not the same fact as unmeasured', () => {
  it('UTG cannot face a raise — nobody acts before it', () => {
    const r = reachability('EARLY', 'raise');
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/acts-first/);
  });

  it('folded-to-BB is not an entry decision — the pot is already theirs', () => {
    expect(reachability('BB', 'none').reachable).toBe(false);
  });

  it('every other combination is a real spot', () => {
    const reachable = POS_CATEGORIES.flatMap((p) => FACING_ACTIONS.map((f) => reachability(p, f)))
      .filter((r) => r.reachable);
    expect(reachable).toHaveLength(POS_CATEGORIES.length * FACING_ACTIONS.length - 2);
  });

  it('unreachable cells are ENUMERATED, carrying their reason', () => {
    // Dropping them would hide them; a coverage denominator that quietly excludes what it
    // could not answer is exactly what the Census exists to prevent.
    const cells = enumerateCells(HANDS);
    expect(cells).toHaveLength(HANDS.length * POS_CATEGORIES.length * FACING_ACTIONS.length);
    const dead = cells.filter((c) => !c.reachable);
    expect(dead).toHaveLength(HANDS.length * 2);
    expect(dead.every((c) => typeof c.unreachableReason === 'string')).toBe(true);
  });

  it('cell order is stable, because the migration report joins two runs on it', () => {
    expect(enumerateCells(HANDS).map((c) => c.cellId))
      .toEqual(enumerateCells(HANDS).map((c) => c.cellId));
  });
});

describe('table geometry resolves WHO is behind, never a count', () => {
  it('UTG has the whole table behind it and the BB has nobody', () => {
    expect(tableGeometry('EARLY', 'none').seatsBehind).toHaveLength(8);
    expect(tableGeometry('BB', 'raise').seatsBehind).toHaveLength(0);
  });

  it('facing a raise names an opener who actually acts before hero', () => {
    const { opener, actionIndex } = tableGeometry('LATE', 'raise');
    expect(opener).not.toBeNull();
    expect(actionIndex).toBeGreaterThan(0);
  });

  it('first-in has no opener', () => {
    expect(tableGeometry('MIDDLE', 'none').opener).toBeNull();
  });
});

describe('the Field sweep is over between-player spread', () => {
  const poolStats = { vpip: { k: 1170623, n: 4059673 } }; // real 50NL 6max counts

  it('sweeps wide despite a razor-tight pool posterior', () => {
    // n is 4 MILLION, so the sampling posterior is essentially a point. Sweeping THAT would
    // report modelError ~0 and call every straddling cell tight — false certainty. The spread
    // that matters is between PLAYERS, read off the measured overdispersion weight.
    const sweep = buildFieldSweep(poolStats, { vpip: 10 }, betaQuantile);
    expect(sweep.vpip).toHaveLength(FIELD_QUANTILES.length);
    expect(sweep.vpip[2] - sweep.vpip[0]).toBeGreaterThan(0.15);
  });

  it('a lower prior weight means more between-player spread', () => {
    const loose = buildFieldSweep(poolStats, { vpip: 5 }, betaQuantile);
    const tight = buildFieldSweep(poolStats, { vpip: 60 }, betaQuantile);
    expect(loose.vpip[2] - loose.vpip[0]).toBeGreaterThan(tight.vpip[2] - tight.vpip[0]);
  });

  it('emits percentages, the unit the engine reads', () => {
    const sweep = buildFieldSweep(poolStats, { vpip: 10 }, betaQuantile);
    expect(fieldPointStats(sweep, 1).vpip).toBeCloseTo(sweep.vpip[1] * 100, 6);
  });
});

describe('entryMarginFrom anchors on fold = 0', () => {
  it('takes the best entry action and measures it against folding', () => {
    const out = entryMarginFrom(
      [{ action: 'fold', ev: 0 }, { action: 'bet', ev: 2 }, { action: 'check', ev: 0.5 }], 2,
    );
    expect(out.action).toBe('bet');
    expect(out.marginBB).toBe(1); // 2 chips / 2 per bb
  });

  it('returns null when there is no entry action, rather than reporting a margin of zero', () => {
    // Zero would land the cell in the fringe — the one band where a wrong entry does the most
    // damage — so "no entry action offered" must stay distinguishable from "breakeven".
    expect(entryMarginFrom([{ action: 'fold', ev: 0 }], 1)).toBeNull();
  });
});
