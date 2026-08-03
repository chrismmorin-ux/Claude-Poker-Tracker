/**
 * strategyProfile.test.js — WS-323 follow-on. The accounting, and the one omission that would
 * have flipped the sign.
 *
 * The Entry Map's anchor — folding is EV = 0 — is a MARGINAL statement and exactly right for
 * the entry decision. Summing marginal gains therefore yields the edge over ALWAYS FOLDING, not
 * a win rate. At a 9-handed table the difference is 16.7 bb/100, which is larger than any
 * plausible win rate: a profile that omitted it would not be optimistic, it would report a
 * losing strategy as a winning one.
 *
 * The first describe block is that test. The rest guard the frequency weighting it rests on.
 */

import { describe, it, expect } from 'vitest';

import { BANDS } from '../backtest/entryMap.mjs';
import {
  POSTED_BB,
  TOTAL_COMBOS,
  handClassCombos,
  handClassWeight,
  playersBefore,
  positionWeight,
  profileStrategy,
  spearman,
  spotProbabilities,
  structureOf,
} from '../backtest/strategyProfile.mjs';

const POOL = { vpip: 0.288, pfr: 0.137 };
const CLASSES = ['AA', 'AKs', 'AKo'];
const EQUITY = Object.fromEntries(
  ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB'].map((p) => [p, [8500, 6700, 6500]]),
);

/** A map where every reachable cell carries `margin`, banded by whether it clears zero. */
const mapWhereEveryCellIs = (margin) => {
  const cells = [];
  for (const posCategory of ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB']) {
    for (const facingAction of ['none', 'raise']) {
      const unreachable =
        (posCategory === 'EARLY' && facingAction === 'raise') ||
        (posCategory === 'BB' && facingAction === 'none');
      for (const handClass of CLASSES) {
        const cellId = `${handClass}|${posCategory}|${facingAction}`;
        if (unreachable) {
          cells.push({ cellId, handClass, posCategory, facingAction, reachable: false, margin: null, band: null });
          continue;
        }
        cells.push({
          cellId, handClass, posCategory, facingAction,
          reachable: true, degenerate: false, bestAction: 'bet',
          margin, halfWidth: 0.05, mcError: 0.02, modelError: 0.03,
          lower: margin - 0.05, upper: margin + 0.05,
          band: margin - 0.05 > 0 ? BANDS.CLEAR_PLUS : BANDS.CLEAR_MINUS,
        });
      }
    }
  }
  return {
    continuationPolicy: { id: 'cp-test-v1' },
    engineCommit: 'aaaaaaaaaaaa',
    engineDirty: false,
    reporting: { tauBB: 0.25 },
    cells,
  };
};

describe('a strategy that folds everything is not free', () => {
  const profile = profileStrategy(mapWhereEveryCellIs(-1), POOL, EQUITY, CLASSES);

  it('enters nothing and earns no edge', () => {
    expect(profile.headline.entryRate).toBe(0);
    expect(profile.headline.forecastEdgeBB100).toBe(0);
  });

  it('still pays 1.5bb an orbit — the cost no fold avoids', () => {
    // 1.5bb over 9 seats = 16.67 bb/100. Larger than any plausible win rate, which is why
    // omitting it gets the SIGN wrong rather than the magnitude.
    expect(profile.headline.blindCostBB100).toBeCloseTo(-16.667, 2);
  });

  it('collects the walk when the table folds around to the big blind', () => {
    // Economics with no decision attached: `BB x none` is structurally unreachable, so no cell
    // carries this and the accounting has to add it back.
    const walk = (1 / 9) * (1 - POOL.vpip) ** 8 * 1.5 * 100;
    expect(profile.headline.walkBB100).toBeCloseTo(walk, 6);
  });

  it('reports a LOSING win rate, not zero', () => {
    expect(profile.headline.absoluteForecastBB100).toBeLessThan(-15);
    expect(profile.headline.absoluteForecastBB100)
      .toBeCloseTo(profile.headline.forecastEdgeBB100 + profile.headline.blindCostBB100 + profile.headline.walkBB100, 6);
  });
});

describe('the edge over always-folding is positive by construction', () => {
  it('cannot be negative, because the card only enters cells that already cleared zero', () => {
    // Which is exactly why it must not be read as a win rate, and why the module says so.
    for (const margin of [-5, -1, 0, 1, 5]) {
      const p = profileStrategy(mapWhereEveryCellIs(margin), POOL, EQUITY, CLASSES);
      expect(p.headline.forecastEdgeBB100).toBeGreaterThanOrEqual(0);
    }
  });

  it('turns positive only once the margin clears its own interval', () => {
    expect(profileStrategy(mapWhereEveryCellIs(0.04), POOL, EQUITY, CLASSES).headline.forecastEdgeBB100).toBe(0);
    expect(profileStrategy(mapWhereEveryCellIs(0.06), POOL, EQUITY, CLASSES).headline.forecastEdgeBB100).toBeGreaterThan(0);
  });

  it('marks itself as not a Result Card', () => {
    const p = profileStrategy(mapWhereEveryCellIs(1), POOL, EQUITY, CLASSES);
    expect(p.isResultCard).toBe(false);
    expect(p.caveat).toMatch(/SELF-REPORT/);
  });
});

describe('hand-class frequency is combinatorial, not uniform', () => {
  it('counts 6 combos for a pair, 4 suited, 12 offsuit', () => {
    // An offsuit class is worth three times a suited one in any frequency-weighted sum, which
    // is why "AKo is a fold" costs three times what "AKs is a fold" costs.
    expect(handClassCombos('AA')).toBe(6);
    expect(handClassCombos('AKs')).toBe(4);
    expect(handClassCombos('AKo')).toBe(12);
  });

  it('sums to exactly 1 over all 169 classes', () => {
    const ranks = 'AKQJT98765432';
    let total = 0;
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        if (i === j) total += handClassWeight(ranks[i] + ranks[i]);
        else if (i < j) total += handClassWeight(ranks[i] + ranks[j] + 's') + handClassWeight(ranks[i] + ranks[j] + 'o');
      }
    }
    expect(total).toBeCloseTo(1, 12);
    expect(6 * 13 + (4 + 12) * 78).toBe(TOTAL_COMBOS);
  });
});

describe('spot probabilities fall out of who acts before hero', () => {
  it('gives UTG a folded-to-hero spot with certainty — nobody has acted', () => {
    expect(playersBefore('EARLY')).toBe(0);
    const s = spotProbabilities(0, POOL);
    expect(s.foldedToHero).toBe(1);
    expect(s.facingRaise).toBe(0);
    expect(s.limpedNoRaise).toBe(0);
  });

  it('always partitions the decision — the three spots sum to 1', () => {
    for (const k of [0, 1, 3, 5, 8]) {
      const s = spotProbabilities(k, POOL);
      expect(s.foldedToHero + s.limpedNoRaise + s.facingRaise).toBeCloseTo(1, 12);
    }
  });

  it('surfaces the limped spot the map does not model, and it is not small', () => {
    // VPIP 28.8% against PFR 13.7% means players enter without raising often enough that by
    // the late seats a quarter of hero's decisions are in a spot the declared domain omits.
    const s = spotProbabilities(playersBefore('LATE'), POOL);
    expect(s.limpedNoRaise).toBeGreaterThan(0.25);
  });

  it('makes folded-to-hero rare in late position rather than typical', () => {
    // `none` is "nobody ahead played at all", not "hero acts first".
    expect(spotProbabilities(playersBefore('LATE'), POOL).foldedToHero).toBeLessThan(0.2);
  });

  it('weights positions by how many seats they cover, summing to one table', () => {
    const total = ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB'].reduce((a, p) => a + positionWeight(p), 0);
    expect(total).toBeCloseTo(1, 12);
    expect(POSTED_BB.SB).toBe(0.5);
    expect(POSTED_BB.BB).toBe(1);
  });
});

describe('structure is a grouping, and rank agreement is ordinal', () => {
  it('classifies hands into families without feeding anything back into a number', () => {
    expect(structureOf('AA').family).toBe('pair');
    expect(structureOf('AKs').family).toBe('broadway-suited');
    expect(structureOf('76s').family).toBe('connector-suited');
    expect(structureOf('72o').family).toBe('unconnected-offsuit');
  });

  it('measures agreement by RANK, because entry EV is not linear in equity', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 6);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 6);
    // Monotone but wildly non-linear still counts as full agreement.
    expect(spearman([1, 2, 3, 4], [1, 2, 3, 4000])).toBeCloseTo(1, 6);
  });

  it('averages ties rather than breaking them arbitrarily — the map has flat regions', () => {
    expect(spearman([1, 1, 2, 2], [1, 1, 2, 2])).toBeCloseTo(1, 6);
  });

  it('compares pairs to unpaired WITHIN a spot, never pooled across spots', () => {
    // Pooling would let the position mix drive the answer, and position mix is exactly what
    // differs between the groups being compared.
    const p = profileStrategy(mapWhereEveryCellIs(1), POOL, EQUITY, CLASSES);
    for (const g of p.pairGap) expect(g.spot).toMatch(/^[A-Z]+\|(none|raise)$/);
  });
});
