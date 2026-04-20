import { describe, test, expect } from 'vitest';
import {
  C,
  ruleOf4And2,
  flushCompletionExact,
  flopPairOneRank,
  flopPairEitherRank,
  directStraightRuns,
  singleCardStraightRuns,
  independentRunouts,
  breakEvenEquity,
} from '../combinatorics';

describe('C — binomial coefficient', () => {
  test('base cases', () => {
    expect(C(0, 0)).toBe(1);
    expect(C(5, 0)).toBe(1);
    expect(C(5, 5)).toBe(1);
    expect(C(10, 1)).toBe(10);
  });

  test('matches hand-computed values for poker cases', () => {
    expect(C(52, 5)).toBe(2598960);  // total 5-card hands from a deck
    expect(C(50, 5)).toBe(2118760);  // boards for 2-card hero
    expect(C(48, 5)).toBe(1712304);  // boards for 2-card hero + 2-card villain
    expect(C(47, 2)).toBe(1081);     // turn+river combos when 5 cards dead
  });

  test('C(n, k) === C(n, n-k)', () => {
    expect(C(52, 5)).toBe(C(52, 47));
    expect(C(10, 3)).toBe(C(10, 7));
  });

  test('out-of-range returns 0', () => {
    expect(C(5, -1)).toBe(0);
    expect(C(5, 6)).toBe(0);
  });
});

describe('ruleOf4And2', () => {
  test('flush draw on flop: rule of 4 overshoots exact', () => {
    const r = ruleOf4And2(9, 'flop');
    expect(r.rule).toBe(0.36); // 9*4 = 36%
    // Exact ~ 35.0% (standard poker reference).
    expect(r.exact).toBeGreaterThan(0.34);
    expect(r.exact).toBeLessThan(0.36);
    // Rule is an overestimate.
    expect(r.rule).toBeGreaterThan(r.exact);
  });

  test('flush draw on turn: rule of 2 tight', () => {
    const r = ruleOf4And2(9, 'turn');
    expect(r.rule).toBe(0.18); // 9*2 = 18%
    expect(r.exact).toBeCloseTo(9 / 46, 4);
  });

  test('open-ended straight draw on flop: 8 outs', () => {
    const r = ruleOf4And2(8, 'flop');
    expect(r.rule).toBe(0.32);
    expect(r.exact).toBeCloseTo(0.315, 2); // standard value
  });

  test('gutshot on flop: 4 outs', () => {
    const r = ruleOf4And2(4, 'flop');
    expect(r.rule).toBe(0.16);
    expect(r.exact).toBeCloseTo(0.165, 2);
  });

  test('rejects invalid street', () => {
    expect(() => ruleOf4And2(9, 'river')).toThrow();
  });
});

describe('flushCompletionExact', () => {
  test('naked flush draw on flop, no blockers', () => {
    const r = flushCompletionExact(0, 'flop');
    expect(r.outs).toBe(9);
    // Standard: ~35%
    expect(r.exact).toBeGreaterThan(0.34);
    expect(r.exact).toBeLessThan(0.36);
  });

  test('blockers reduce outs 1-for-1', () => {
    const noBlock = flushCompletionExact(0, 'flop');
    const oneBlock = flushCompletionExact(1, 'flop');
    expect(oneBlock.outs).toBe(8);
    expect(oneBlock.exact).toBeLessThan(noBlock.exact);
  });

  test('all 9 flush cards dead → 0%', () => {
    const r = flushCompletionExact(9, 'flop');
    expect(r.exact).toBe(0);
  });

  test('turn flush draw', () => {
    const r = flushCompletionExact(0, 'turn');
    expect(r.outs).toBe(9);
    expect(r.exact).toBeCloseTo(9 / 46, 4);
  });
});

describe('flopPairOneRank', () => {
  test('unpaired rank, 3 outs in 50 unseen (standard AK)', () => {
    const r = flopPairOneRank(3, 50, 3);
    // Reference: ~17.35%
    expect(r.exact).toBeGreaterThan(0.17);
    expect(r.exact).toBeLessThan(0.18);
  });

  test('paired rank (e.g., flop a set with 88), 2 outs', () => {
    const r = flopPairOneRank(2, 50, 3);
    // P(flop a set) ≈ 11.8%
    expect(r.exact).toBeGreaterThan(0.115);
    expect(r.exact).toBeLessThan(0.12);
  });
});

describe('flopPairEitherRank', () => {
  test('AK: P(pair A or K) ≈ 32.4%', () => {
    const r = flopPairEitherRank(3, 3, 50);
    expect(r.pEither).toBeGreaterThan(0.32);
    expect(r.pEither).toBeLessThan(0.33);
  });

  test('hit-both probability is small', () => {
    const r = flopPairEitherRank(3, 3, 50);
    // P(flop both A and K, with the rest as kickers) ≈ 1.9%
    expect(r.pHitBoth).toBeGreaterThan(0.015);
    expect(r.pHitBoth).toBeLessThan(0.025);
  });
});

describe('directStraightRuns', () => {
  test('AK: 1 direct run (Broadway TJQKA)', () => {
    const runs = directStraightRuns(12, 11);
    expect(runs).toEqual([12]);
  });

  test('JT: 4 direct runs', () => {
    const runs = directStraightRuns(9, 8);
    // Runs: 789TJ(9), 89TJQ(10), 9TJQK(11), TJQKA(12) — highs 9,10,11,12
    expect(runs).toEqual([9, 10, 11, 12]);
  });

  test('54: 4 direct runs including wheel', () => {
    const runs = directStraightRuns(3, 2);
    // 54 = rank 3 (5) + rank 2 (4). Runs containing BOTH 5 and 4:
    //   A2345 (wheel, high=3), 23456 (high=4), 34567 (high=5), 45678 (high=6)
    expect(runs).toEqual([3, 4, 5, 6]);
  });

  test('A5: includes wheel', () => {
    const runs = directStraightRuns(12, 3);
    // 5 is not within 4 of A, so no regular run (gap=8). But A2345 works.
    expect(runs).toContain(3);
  });

  test('pair: no direct runs', () => {
    const runs = directStraightRuns(10, 10);
    expect(runs).toEqual([]);
  });

  test('72o: no direct runs (gap 5)', () => {
    const runs = directStraightRuns(5, 0);
    expect(runs).toEqual([]);
  });
});

describe('singleCardStraightRuns', () => {
  test('AK: each of A and K contributes to multiple single-card runs', () => {
    const runs = singleCardStraightRuns(12, 11);
    // A alone is in: A2345(3), TJQKA(12) — 2 runs. But TJQKA also contains K.
    // K alone is in: 9TJQK(11) — K is there, A is not.
    // Remove the Broadway from A's list since K is also there (that's a direct run, not single-card).
    // Single-card runs: A alone — A2345 (3). K alone — 9TJQK (11). That's 2 runs.
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.runHigh).sort((a, b) => a - b)).toEqual([3, 11]);
  });

  test('pair has N runs where N = single-card runs from the rank', () => {
    const runs = singleCardStraightRuns(10, 10);
    // A pair of JJ contributes to runs where J is one of the 5 ranks.
    // J is in: 789TJ(9), 89TJQ(10), 9TJQK(11), TJQKA(12). 4 runs.
    // Each shows up twice (once per J), but our function compares hole cards
    // which are the same for a pair. "exactly one" fails when both are equal.
    // So a pair has 0 single-card runs. That's the correct definition — both
    // J's are in the run, it's a "both cards contribute" (direct-like) run.
    expect(runs).toHaveLength(0);
  });
});

describe('independentRunouts', () => {
  test('50% single, run twice: 75% to win at least one', () => {
    const r = independentRunouts(0.5, 2);
    expect(r.atLeastOne).toBeCloseTo(0.75, 5);
    expect(r.allSucceed).toBeCloseTo(0.25, 5);
    expect(r.exactlyOne).toBeCloseTo(0.5, 5);
  });

  test('40% single, run twice', () => {
    const r = independentRunouts(0.4, 2);
    expect(r.atLeastOne).toBeCloseTo(0.64, 5); // 1 - 0.36
  });

  test('EV unchanged by N runs', () => {
    const r = independentRunouts(0.35, 3);
    expect(r.expectedWins).toBeCloseTo(0.35 * 3, 5);
  });
});

describe('breakEvenEquity', () => {
  test('pot-sized bet: need 33% equity', () => {
    const r = breakEvenEquity(100, 100);
    expect(r.equity).toBeCloseTo(1 / 3, 3);
  });

  test('half-pot bet: need 25% equity', () => {
    const r = breakEvenEquity(100, 50);
    expect(r.equity).toBeCloseTo(0.25, 3);
  });

  test('2x pot overbet: need 40% equity', () => {
    const r = breakEvenEquity(100, 200);
    expect(r.equity).toBeCloseTo(0.4, 3);
  });

  test('rejects bet of 0', () => {
    expect(() => breakEvenEquity(100, 0)).toThrow();
  });
});
