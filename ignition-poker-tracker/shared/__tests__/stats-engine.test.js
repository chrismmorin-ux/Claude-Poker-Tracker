import { describe, it, expect } from 'vitest';
import {
  analyzePreflopContext,
  analyzeFlopCbetContext,
  computeSeatStats,
  derivePercentages,
  classifyStyle,
  computeAllSeatStats,
  MIN_STYLE_SAMPLE,
  STYLE_COLORS,
} from '../stats-engine.js';

// Helper: create a minimal hand record
const makeHand = (actions) => ({
  gameState: { actionSequence: actions },
});

// Helper: preflop action
const pf = (seat, action, order, amount) => ({
  seat, action, street: 'preflop', order, ...(amount !== undefined ? { amount } : {}),
});

// Helper: flop action
const fl = (seat, action, order, amount) => ({
  seat, action, street: 'flop', order, ...(amount !== undefined ? { amount } : {}),
});

describe('analyzePreflopContext', () => {
  it('detects VPIP from call', () => {
    const actions = [pf(1, 'call', 1), pf(2, 'fold', 2)];
    const { seatContext } = analyzePreflopContext(actions);
    expect(seatContext.get(1).vpip).toBe(true);
    expect(seatContext.get(2).vpip).toBe(false);
  });

  it('detects PFR from raise', () => {
    const actions = [pf(1, 'raise', 1, 300)];
    const { seatContext } = analyzePreflopContext(actions);
    expect(seatContext.get(1).pfr).toBe(true);
  });

  it('detects 3-bet', () => {
    const actions = [pf(1, 'raise', 1, 300), pf(2, 'raise', 2, 900)];
    const { seatContext } = analyzePreflopContext(actions);
    expect(seatContext.get(2).threeBet).toBe(true);
    expect(seatContext.get(1).threeBet).toBe(false);
  });

  it('detects fold-to-3bet', () => {
    const actions = [
      pf(1, 'raise', 1, 300),
      pf(2, 'raise', 2, 900),
      pf(1, 'fold', 3),
    ];
    const { seatContext } = analyzePreflopContext(actions);
    expect(seatContext.get(1).foldTo3Bet).toBe(true);
  });

  it('detects limp', () => {
    const actions = [pf(1, 'call', 1, 100)];
    const { seatContext } = analyzePreflopContext(actions);
    expect(seatContext.get(1).limpedPre).toBe(true);
  });

  it('tracks pfAggressor as last raiser', () => {
    const actions = [pf(1, 'raise', 1), pf(2, 'raise', 2)];
    const { pfAggressor } = analyzePreflopContext(actions);
    expect(pfAggressor).toBe(2);
  });

  it('returns null pfAggressor when no raise', () => {
    const actions = [pf(1, 'call', 1), pf(2, 'fold', 2)];
    const { pfAggressor } = analyzePreflopContext(actions);
    expect(pfAggressor).toBeNull();
  });
});

describe('analyzeFlopCbetContext', () => {
  it('detects c-bet from PF aggressor', () => {
    const actions = [fl(3, 'check', 10), fl(5, 'bet', 11, 500)];
    const { cbetFired } = analyzeFlopCbetContext(actions, 5);
    expect(cbetFired).toBe(true);
  });

  it('no c-bet if non-aggressor bets first', () => {
    const actions = [fl(3, 'bet', 10, 500)];
    const { cbetFired } = analyzeFlopCbetContext(actions, 5);
    expect(cbetFired).toBe(false);
  });

  it('tracks fold to c-bet', () => {
    const actions = [
      fl(5, 'bet', 10, 500),
      fl(3, 'fold', 11),
    ];
    const { cbetFired, seatCbetContext } = analyzeFlopCbetContext(actions, 5);
    expect(cbetFired).toBe(true);
    expect(seatCbetContext.get(3).facedCbet).toBe(true);
    expect(seatCbetContext.get(3).foldedToCbet).toBe(true);
  });

  it('returns no c-bet when pfAggressor is null', () => {
    const { cbetFired } = analyzeFlopCbetContext([], null);
    expect(cbetFired).toBe(false);
  });
});

describe('computeSeatStats', () => {
  it('counts VPIP and PFR correctly', () => {
    const hands = [
      makeHand([pf(1, 'raise', 1, 300), pf(2, 'call', 2)]),
      makeHand([pf(1, 'fold', 1), pf(2, 'raise', 2, 300)]),
      makeHand([pf(1, 'raise', 1, 300), pf(2, 'fold', 2)]),
    ];
    const stats = computeSeatStats(hands, 1);
    expect(stats.handsSeenPreflop).toBe(3);
    expect(stats.vpipCount).toBe(2); // raised twice, folded once
    expect(stats.pfrCount).toBe(2);
  });

  it('ignores hands where seat has no actions', () => {
    const hands = [
      makeHand([pf(3, 'raise', 1, 300)]),
    ];
    const stats = computeSeatStats(hands, 1);
    expect(stats.handsSeenPreflop).toBe(0);
  });

  it('tracks postflop aggression', () => {
    const hands = [
      makeHand([
        pf(1, 'raise', 1, 300),
        pf(2, 'call', 2),
        fl(1, 'bet', 3, 500),
        fl(2, 'call', 4),
      ]),
    ];
    const stats = computeSeatStats(hands, 1);
    expect(stats.totalBets).toBe(1);
    expect(stats.totalCalls).toBe(0); // seat 1 didn't call on flop
  });
});

describe('derivePercentages', () => {
  it('computes VPIP and PFR percentages', () => {
    const stats = { handsSeenPreflop: 10, vpipCount: 3, pfrCount: 2, totalBets: 1, totalRaises: 1, totalCalls: 2, facedRaisePreflop: 0, threeBetCount: 0, foldTo3BetCount: 0, pfAggressorFlops: 0, cbetCount: 0, facedCbet: 0, foldedToCbet: 0, limpCount: 0, limpOpportunities: 0 };
    const pct = derivePercentages(stats);
    expect(pct.vpip).toBe(30);
    expect(pct.pfr).toBe(20);
    expect(pct.sampleSize).toBe(10);
  });

  it('returns null for zero samples', () => {
    const stats = { handsSeenPreflop: 0, vpipCount: 0, pfrCount: 0, totalBets: 0, totalRaises: 0, totalCalls: 0, facedRaisePreflop: 0, threeBetCount: 0, foldTo3BetCount: 0, pfAggressorFlops: 0, cbetCount: 0, facedCbet: 0, foldedToCbet: 0, limpCount: 0, limpOpportunities: 0 };
    const pct = derivePercentages(stats);
    expect(pct.vpip).toBeNull();
    expect(pct.pfr).toBeNull();
  });

  it('computes AF correctly', () => {
    const stats = { handsSeenPreflop: 10, vpipCount: 5, pfrCount: 3, totalBets: 3, totalRaises: 2, totalCalls: 5, facedRaisePreflop: 0, threeBetCount: 0, foldTo3BetCount: 0, pfAggressorFlops: 0, cbetCount: 0, facedCbet: 0, foldedToCbet: 0, limpCount: 0, limpOpportunities: 0 };
    const pct = derivePercentages(stats);
    expect(pct.af).toBe(1); // (3+2)/5 = 1.0
  });

  it('returns Infinity AF when aggressive but no calls', () => {
    const stats = { handsSeenPreflop: 10, vpipCount: 5, pfrCount: 3, totalBets: 3, totalRaises: 2, totalCalls: 0, facedRaisePreflop: 0, threeBetCount: 0, foldTo3BetCount: 0, pfAggressorFlops: 0, cbetCount: 0, facedCbet: 0, foldedToCbet: 0, limpCount: 0, limpOpportunities: 0 };
    const pct = derivePercentages(stats);
    expect(pct.af).toBe(Infinity);
  });

  it('handles null input', () => {
    const pct = derivePercentages(null);
    expect(pct.sampleSize).toBe(0);
  });
});

describe('classifyStyle', () => {
  it('returns null with insufficient data', () => {
    expect(classifyStyle({ vpip: 30, pfr: 15, af: 2, sampleSize: 5 })).toBeNull();
  });

  it('classifies Fish (vpip > 40)', () => {
    expect(classifyStyle({ vpip: 45, pfr: 10, af: 1, sampleSize: 25 })).toBe('Fish');
  });

  it('classifies LAG (vpip > 30, pfr > 20)', () => {
    expect(classifyStyle({ vpip: 35, pfr: 25, af: 2, sampleSize: 25 })).toBe('LAG');
  });

  it('classifies TAG (vpip 15-30, pfr 10-25)', () => {
    expect(classifyStyle({ vpip: 22, pfr: 18, af: 1.5, sampleSize: 25 })).toBe('TAG');
  });

  it('classifies Nit (vpip < 15, pfr < 10)', () => {
    expect(classifyStyle({ vpip: 10, pfr: 8, af: 2, sampleSize: 25 })).toBe('Nit');
  });

  it('classifies LP (vpip > 30, pfr < 10)', () => {
    expect(classifyStyle({ vpip: 35, pfr: 5, af: 0.5, sampleSize: 25 })).toBe('LP');
  });

  it('classifies Reg (vpip 20-30, pfr 15-25, af > 1.5)', () => {
    expect(classifyStyle({ vpip: 25, pfr: 20, af: 2.0, sampleSize: 25 })).toBe('Reg');
  });
});

describe('computeAllSeatStats', () => {
  it('returns stats for all seats found in data', () => {
    const hands = [
      makeHand([pf(1, 'raise', 1), pf(2, 'call', 2), pf(3, 'fold', 3)]),
    ];
    const result = computeAllSeatStats(hands);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeDefined();
    expect(result[3]).toBeDefined();
  });

  it('includes style classification', () => {
    // Generate enough hands for classification
    const hands = [];
    for (let i = 0; i < 25; i++) {
      hands.push(makeHand([
        pf(1, 'raise', 1, 300),
        pf(2, 'fold', 2),
      ]));
    }
    const result = computeAllSeatStats(hands);
    // Seat 1: 100% VPIP, 100% PFR — Fish (>40 vpip)
    expect(result[1].vpip).toBe(100);
    expect(result[1].style).toBe('Fish');
  });
});

describe('STYLE_COLORS', () => {
  it('has entries for all style types', () => {
    expect(STYLE_COLORS.Fish).toBeDefined();
    expect(STYLE_COLORS.TAG).toBeDefined();
    expect(STYLE_COLORS.LAG).toBeDefined();
    expect(STYLE_COLORS.Nit).toBeDefined();
    expect(STYLE_COLORS.LP).toBeDefined();
    expect(STYLE_COLORS.Reg).toBeDefined();
    expect(STYLE_COLORS.Unknown).toBeDefined();
  });
});
