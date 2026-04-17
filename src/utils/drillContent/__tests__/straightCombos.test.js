import { describe, test, expect } from 'vitest';
import {
  ALL_STRAIGHTS,
  straightPatternsForHand,
  singleCardPatternsForHand,
  livePatternsAgainst,
  analyzeStraightCoverage,
  classifyConnectedness,
  straightComboCount,
} from '../straightCombos';

// Rank helpers — match preflopEquity.js: A=12, K=11, Q=10, J=9, T=8, 9=7, …, 2=0.
const R = { A: 12, K: 11, Q: 10, J: 9, T: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 3: 1, 2: 0 };

describe('straightCombos — ALL_STRAIGHTS', () => {
  test('includes 9 regular straights + wheel = 10 total', () => {
    expect(ALL_STRAIGHTS).toHaveLength(10);
  });

  test('every straight has 5 distinct ranks', () => {
    for (const s of ALL_STRAIGHTS) {
      expect(s).toHaveLength(5);
      expect(new Set(s).size).toBe(5);
    }
  });

  test('includes broadway (TJQKA) and wheel (A2345)', () => {
    const patterns = ALL_STRAIGHTS.map((s) => s.slice().sort((a, b) => a - b).join(','));
    expect(patterns).toContain([R.T, R.J, R.Q, R.K, R.A].sort((a, b) => a - b).join(','));
    expect(patterns).toContain([R['2'], R['3'], R['4'], R['5'], R.A].sort((a, b) => a - b).join(','));
  });
});

describe('straightCombos — straightPatternsForHand', () => {
  // Hand-verified combo counts for every 2-card configuration. Rank indices:
  // A=12, K=11, Q=10, J=9, T=8, 9=7, 8=6, 7=5, 6=4, 5=3, 4=2, 3=1, 2=0.
  const expected = [
    // Connectors (adjacent ranks)
    [R.A, R.K, 1, 'AK (edge connector)'],      // only TJQKA
    [R.K, R.Q, 2, 'KQ'],
    [R.Q, R.J, 3, 'QJ'],
    [R.J, R.T, 4, 'JT (middle connector max)'],
    [R.T, R['9'], 4, 'T9'],
    [R['9'], R['8'], 4, '98'],
    [R['8'], R['7'], 4, '87'],
    [R['7'], R['6'], 4, '76'],
    [R['6'], R['5'], 4, '65'],
    [R['5'], R['4'], 4, '54'],
    [R['4'], R['3'], 3, '43'],
    [R['3'], R['2'], 2, '32'],
    [R.A, R['2'], 1, 'A2 (wheel only)'],

    // 1-gap
    [R.A, R.Q, 1, 'AQ (edge)'],
    [R.K, R.J, 2, 'KJ'],
    [R.Q, R.T, 3, 'QT'],
    [R.J, R['9'], 3, 'J9 (middle max)'],
    [R.T, R['8'], 3, 'T8'],
    [R['3'], R.A, 1, 'A3 via wheel'],

    // 2-gap
    [R.A, R.J, 1, 'AJ (only TJQKA)'],
    [R.K, R.T, 2, 'KT'],
    [R.Q, R['9'], 2, 'Q9'],
    [R.J, R['8'], 2, 'J8'],
    [R.A, R['4'], 1, 'A4 via wheel'],

    // 3-gap
    [R.A, R.T, 1, 'AT (only broadway)'],
    [R.K, R['9'], 1, 'K9'],
    [R['7'], R['3'], 1, '73'],
    [R.A, R['5'], 1, 'A5 via wheel'],

    // Disconnected (4+ gap, no straight with both cards)
    [R.A, R['9'], 0, 'A9'],
    [R.K, R['8'], 0, 'K8'],
    [R.Q, R['7'], 0, 'Q7'],
    [R.A, R['6'], 0, 'A6'],
    [R.A, R['7'], 0, 'A7'],

    // Pairs have 0 (can't use both same-rank cards)
    [R.A, R.A, 0, 'AA'],
    [R['7'], R['7'], 0, '77'],
    [R['2'], R['2'], 0, '22'],
  ];

  for (const [high, low, count, desc] of expected) {
    test(`${desc} → ${count} straight combos`, () => {
      expect(straightPatternsForHand(high, low)).toHaveLength(count);
      expect(straightPatternsForHand(low, high)).toHaveLength(count); // symmetric
      expect(straightComboCount(high, low)).toBe(count);
    });
  }

  test('all 13 connectors sum to 40 total combos', () => {
    // 23(2) + 34(3) + 45..TJ(4×7 = 28) + JQ(3) + QK(2) + KA(1) + A2(1) = 40
    let sum = 0;
    for (let r = 0; r < 12; r++) sum += straightComboCount(r + 1, r);
    sum += straightComboCount(R.A, R['2']);
    expect(sum).toBe(40);
  });
});

describe('straightCombos — livePatternsAgainst (blocker logic)', () => {
  test('AK vs JT — JT loses 2 of 4 patterns (TJQKA, 9TJQK blocked)', () => {
    const jt = straightPatternsForHand(R.J, R.T);
    const live = livePatternsAgainst(jt, [R.A, R.K]);
    expect(jt).toHaveLength(4);
    expect(live).toHaveLength(2); // 789TJ and 89TJQ survive
    // Verify the right ones survive
    for (const p of live) {
      expect(p.includes(R.A)).toBe(false);
      expect(p.includes(R.K)).toBe(false);
    }
  });

  test('AK vs 54 — 54 loses 1 of 4 patterns (wheel A2345 blocked)', () => {
    const fiveFour = straightPatternsForHand(R['5'], R['4']);
    const live = livePatternsAgainst(fiveFour, [R.A, R.K]);
    expect(fiveFour).toHaveLength(4);
    expect(live).toHaveLength(3); // 23456, 34567, 45678 survive; A2345 killed
  });

  test('AK vs AK — AK has 1 straight (TJQKA), blocked by itself (not meaningful vs itself)', () => {
    const ak = straightPatternsForHand(R.A, R.K);
    // Against a villain that shares no ranks, nothing is blocked:
    const live = livePatternsAgainst(ak, [R['7'], R['3']]);
    expect(live).toHaveLength(1);
  });

  test('no blockers → all patterns live', () => {
    const jt = straightPatternsForHand(R.J, R.T);
    expect(livePatternsAgainst(jt, [R['2'], R['3']])).toHaveLength(4);
  });
});

describe('straightCombos — analyzeStraightCoverage', () => {
  test('AK vs JTs — the signature asymmetric blocker case', () => {
    // AK:  1 straight (TJQKA) — both JTs cards are IN it, so blocked.
    // JTs: 4 straights, AK's cards kill top 2.
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.K, pair: false },
      { rankHigh: R.J, rankLow: R.T, pair: false },
    );
    expect(cov.aTotal).toBe(1);
    expect(cov.aLive).toBe(0); // TJQKA blocked by J and T
    expect(cov.bTotal).toBe(4);
    expect(cov.bLive).toBe(2); // 789TJ, 89TJQ survive; 9TJQK and TJQKA killed
  });

  test('AK vs 54s — 54s keeps 3 of 4 straights', () => {
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.K, pair: false },
      { rankHigh: R['5'], rankLow: R['4'], pair: false },
    );
    expect(cov.aTotal).toBe(1);
    expect(cov.aLive).toBe(1); // TJQKA — 54's ranks not in it
    expect(cov.bTotal).toBe(4);
    expect(cov.bLive).toBe(3); // A2345 killed by A; 23456, 34567, 45678 live
  });

  test('AA vs JTs — pair has 0 direct straight combos', () => {
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.A, pair: true },
      { rankHigh: R.J, rankLow: R.T, pair: false },
    );
    expect(cov.aTotal).toBe(0);
    expect(cov.bTotal).toBe(4);
    expect(cov.bLive).toBe(3); // TJQKA blocked by A only; 789TJ, 89TJQ, 9TJQK live
  });

  test('coverage is symmetric (swap sides, get mirror results)', () => {
    const fwd = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.K, pair: false },
      { rankHigh: R.J, rankLow: R.T, pair: false },
    );
    const bwd = analyzeStraightCoverage(
      { rankHigh: R.J, rankLow: R.T, pair: false },
      { rankHigh: R.A, rankLow: R.K, pair: false },
    );
    expect(bwd.aTotal).toBe(fwd.bTotal);
    expect(bwd.aLive).toBe(fwd.bLive);
    expect(bwd.bTotal).toBe(fwd.aTotal);
    expect(bwd.bLive).toBe(fwd.aLive);
  });
});

describe('straightCombos — singleCardPatternsForHand', () => {
  test('AK — 2 single-card runs (A2345 via A only; 9TJQK via K only)', () => {
    const runs = singleCardPatternsForHand(R.A, R.K);
    expect(runs).toHaveLength(2);
    const labels = runs.map((p) => p.slice().sort((a, b) => a - b).join(','));
    expect(labels).toContain([R['2'], R['3'], R['4'], R['5'], R.A].sort((a, b) => a - b).join(','));
    expect(labels).toContain([R['9'], R.T, R.J, R.Q, R.K].sort((a, b) => a - b).join(','));
    // Should NOT contain TJQKA (that's a direct run containing both A and K)
    expect(labels).not.toContain([R.T, R.J, R.Q, R.K, R.A].sort((a, b) => a - b).join(','));
  });

  test('AQ — 3 single-card runs (wheel + 89TJQ + 9TJQK), confirming AQ > AK coverage', () => {
    const runs = singleCardPatternsForHand(R.A, R.Q);
    expect(runs).toHaveLength(3);
    // AQ strictly more single-card runs than AK — this is the user-facing distinction.
    expect(runs.length).toBeGreaterThan(singleCardPatternsForHand(R.A, R.K).length);
  });

  test('AA (pair) — single-card runs = 2 (A2345, TJQKA)', () => {
    expect(singleCardPatternsForHand(R.A, R.A)).toHaveLength(2);
  });

  test('77 (pair) — single-card runs = 5 (every run containing a 7)', () => {
    // 7 is in 34567, 45678, 56789, 6789T, 789TJ
    expect(singleCardPatternsForHand(R['7'], R['7'])).toHaveLength(5);
  });

  test('JT — 1 single-card run (6789T via T only)', () => {
    // Every run containing J also contains T for middle connectors except 6789T (T only) and TJQKA (actually has T AND J too).
    // JT direct runs: 789TJ, 89TJQ, 9TJQK, TJQKA (all contain both)
    // Runs with J only: none (every run containing J in 789TJ..TJQKA also contains T).
    // Runs with T only: 6789T.
    expect(singleCardPatternsForHand(R.J, R.T)).toHaveLength(1);
  });

  test('symmetric — argument order does not matter', () => {
    expect(singleCardPatternsForHand(R.A, R.Q).length).toBe(
      singleCardPatternsForHand(R.Q, R.A).length,
    );
  });
});

describe('straightCombos — livePatternsAgainst with heroRanks', () => {
  test('hero-held ranks discount villain blockers (AK vs AK — Broadway stays live)', () => {
    const ak = straightPatternsForHand(R.A, R.K); // [TJQKA]
    // Without heroRanks: legacy behavior blocks TJQKA because villain also has A+K.
    const legacy = livePatternsAgainst(ak, [R.A, R.K]);
    expect(legacy).toHaveLength(0);
    // With heroRanks: A and K are hero's own, only board-needed ranks (T, J, Q) matter.
    const fixed = livePatternsAgainst(ak, [R.A, R.K], [R.A, R.K]);
    expect(fixed).toHaveLength(1);
  });

  test('heroRanks default empty preserves legacy two-arg behavior', () => {
    const jt = straightPatternsForHand(R.J, R.T);
    const live = livePatternsAgainst(jt, [R.A, R.K]);
    expect(live).toHaveLength(2); // legacy expectation unchanged
  });
});

describe('straightCombos — analyzeStraightCoverage new fields', () => {
  test('AK vs AQ — AQ carries higher coverage score (THE user-surfaced bug)', () => {
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.K, pair: false },
      { rankHigh: R.A, rankLow: R.Q, pair: false },
    );
    // Both have 1 direct run (TJQKA) — blockers consider hero's own ranks.
    expect(cov.aTotal).toBe(1);
    expect(cov.bTotal).toBe(1);
    // AQ should have more single-card coverage than AK.
    expect(cov.bSingleCardTotal).toBeGreaterThan(cov.aSingleCardTotal);
    // And therefore a higher coverage score (pre-blocker raw is fine for this assertion).
    expect(cov.bCoverageScoreRaw).toBeGreaterThan(cov.aCoverageScoreRaw);
  });

  test('AK vs QQ — QQ crushes AK straight coverage', () => {
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.K, pair: false },
      { rankHigh: R.Q, rankLow: R.Q, pair: true },
    );
    // AK's TJQKA has Q (from board) — blocked by QQ.
    expect(cov.aLive).toBe(0);
    // AK's single-card runs: A2345 (live — no Q), 9TJQK (blocked — has Q).
    expect(cov.aSingleCardTotal).toBe(2);
    expect(cov.aSingleCardLive).toBe(1);
    // Coverage score should be much lower after blocking.
    expect(cov.aCoverageScore).toBeLessThan(cov.aCoverageScoreRaw);
  });

  test('AQ vs QQ — AQ keeps full coverage because Q is hero\'s rank', () => {
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.Q, pair: false },
      { rankHigh: R.Q, rankLow: R.Q, pair: true },
    );
    // TJQKA board-needed is [T, J, K] (hero has A, Q). Q blocker is hero's own rank.
    expect(cov.aLive).toBe(1);
    // All of AQ's single-card runs stay live.
    expect(cov.aSingleCardLive).toBe(cov.aSingleCardTotal);
    expect(cov.aCoverageScore).toBeCloseTo(cov.aCoverageScoreRaw, 3);
  });

  test('coverage score = 2.0 × direct + 0.7 × single-card', () => {
    // Villain 76o: 6/7 don't touch AK's straight ranks (A,2,3,4,5 and 9,T,J,Q,K),
    // so AK keeps all direct + single-card patterns live.
    const cov = analyzeStraightCoverage(
      { rankHigh: R.A, rankLow: R.K, pair: false },
      { rankHigh: R['7'], rankLow: R['6'], pair: false },
    );
    expect(cov.aTotal).toBe(1);
    expect(cov.aLive).toBe(1);
    expect(cov.aSingleCardTotal).toBe(2);
    expect(cov.aSingleCardLive).toBe(2);
    expect(cov.aCoverageScore).toBeCloseTo(2.0 * 1 + 0.7 * 2, 3);
  });
});

describe('straightCombos — classifyConnectedness', () => {
  test('pairs are classified as pair', () => {
    expect(classifyConnectedness(R.A, R.A)).toBe('pair');
    expect(classifyConnectedness(R['7'], R['7'])).toBe('pair');
  });

  test('connectors (gap 0)', () => {
    expect(classifyConnectedness(R.J, R.T)).toBe('connector');
    expect(classifyConnectedness(R['9'], R['8'])).toBe('connector');
    expect(classifyConnectedness(R['3'], R['2'])).toBe('connector');
  });

  test('one-gappers', () => {
    expect(classifyConnectedness(R.K, R.J)).toBe('one_gap');
    expect(classifyConnectedness(R.Q, R.T)).toBe('one_gap');
    expect(classifyConnectedness(R['9'], R['7'])).toBe('one_gap');
  });

  test('two- and three-gappers', () => {
    expect(classifyConnectedness(R.J, R['8'])).toBe('two_gap');
    expect(classifyConnectedness(R.J, R['7'])).toBe('three_gap');
  });

  test('wheel-adjacent Ax hands get wheel-based classification', () => {
    expect(classifyConnectedness(R.A, R['2'])).toBe('connector');   // wheel-edge connector
    expect(classifyConnectedness(R.A, R['3'])).toBe('one_gap');
    expect(classifyConnectedness(R.A, R['4'])).toBe('two_gap');
    expect(classifyConnectedness(R.A, R['5'])).toBe('three_gap');
  });

  test('disconnected hands (4+ gap with no wheel bridge)', () => {
    expect(classifyConnectedness(R.K, R['7'])).toBe('disconnected');
    expect(classifyConnectedness(R.A, R['7'])).toBe('disconnected');
    expect(classifyConnectedness(R.A, R['9'])).toBe('disconnected');
  });
});
