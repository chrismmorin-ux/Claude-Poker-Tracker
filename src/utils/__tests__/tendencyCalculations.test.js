import { describe, it, expect } from 'vitest';
import {
  findPlayerSeat,
  extractPreflopStats,
  extractPostflopAggression,
  buildPlayerStats,
  updatePlayerStats,
  createEmptyStats,
  derivePercentages,
} from '../tendencyCalculations';

// =============================================================================
// TEST HELPERS
// =============================================================================

const makeHand = (seatPlayers, seatActions, handId = 1) => ({
  handId,
  gameState: {
    currentStreet: 'showdown',
    dealerButtonSeat: 1,
    mySeat: 5,
    seatActions,
    absentSeats: [],
  },
  seatPlayers,
});

/** Hand with actionSequence for precise ordering */
const makeSequenceHand = (seatPlayers, actionSequence, handId = 1) => ({
  handId,
  gameState: {
    currentStreet: 'showdown',
    dealerButtonSeat: 1,
    mySeat: 5,
    seatActions: {},
    actionSequence,
    absentSeats: [],
  },
  seatPlayers,
});

// =============================================================================
// findPlayerSeat
// =============================================================================

describe('findPlayerSeat', () => {
  it('finds seat by playerId', () => {
    const hand = makeHand({ '3': 10, '7': 20 }, {});
    expect(findPlayerSeat(10, hand)).toBe('3');
    expect(findPlayerSeat(20, hand)).toBe('7');
  });

  it('returns null when player not in hand', () => {
    const hand = makeHand({ '3': 10 }, {});
    expect(findPlayerSeat(99, hand)).toBeNull();
  });

  it('returns null when seatPlayers is missing', () => {
    expect(findPlayerSeat(10, { gameState: {} })).toBeNull();
  });

  it('handles string/number playerId comparison', () => {
    const hand = makeHand({ '3': 10 }, {});
    expect(findPlayerSeat('10', hand)).toBe('3');
  });
});

// =============================================================================
// extractPreflopStats
// =============================================================================

describe('extractPreflopStats', () => {
  it('detects VPIP when player calls', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['call'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: true, pfr: false });
  });

  it('detects VPIP when player raises', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['raise'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: true, pfr: true });
  });

  it('does not count check as VPIP (BB option)', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['check'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: false, pfr: false });
  });

  it('does not count fold as VPIP', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['fold'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: false, pfr: false });
  });

  it('detects PFR only for raise', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['call'] } }
    );
    expect(extractPreflopStats(10, hand).pfr).toBe(false);
  });

  it('returns null when player not in hand', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['call'] } }
    );
    expect(extractPreflopStats(99, hand)).toBeNull();
  });

  it('returns null when player has no preflop actions', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: {} }
    );
    expect(extractPreflopStats(10, hand)).toBeNull();
  });

  it('handles legacy actions via toPrimitive', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['open'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: true, pfr: true });
  });

  it('handles legacy limp as VPIP', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['limp'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: true, pfr: false });
  });

  it('handles legacy 3bet as PFR', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['3bet'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: true, pfr: true });
  });

  it('handles bet as VPIP (edge case)', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['bet'] } }
    );
    const result = extractPreflopStats(10, hand);
    expect(result).toEqual({ inHand: true, vpip: true, pfr: false });
  });
});

// =============================================================================
// extractPostflopAggression
// =============================================================================

describe('extractPostflopAggression', () => {
  it('counts bets, raises, calls across postflop streets', () => {
    const hand = makeHand(
      { '3': 10 },
      {
        preflop: { '3': ['raise'] },
        flop: { '3': ['bet'] },
        turn: { '3': ['raise'] },
        river: { '3': ['call'] },
      }
    );
    const result = extractPostflopAggression(10, hand);
    expect(result).toEqual({ bets: 1, raises: 1, calls: 1 });
  });

  it('excludes preflop actions', () => {
    const hand = makeHand(
      { '3': 10 },
      {
        preflop: { '3': ['raise', 'raise'] },
        flop: { '3': ['bet'] },
      }
    );
    const result = extractPostflopAggression(10, hand);
    expect(result).toEqual({ bets: 1, raises: 0, calls: 0 });
  });

  it('returns null when player has no postflop actions', () => {
    const hand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['fold'] } }
    );
    expect(extractPostflopAggression(10, hand)).toBeNull();
  });

  it('returns null when player not in hand', () => {
    const hand = makeHand(
      { '3': 10 },
      { flop: { '3': ['bet'] } }
    );
    expect(extractPostflopAggression(99, hand)).toBeNull();
  });

  it('handles legacy postflop actions', () => {
    const hand = makeHand(
      { '3': 10 },
      {
        preflop: { '3': ['raise'] },
        flop: { '3': ['cbet_ip_small'] },
        turn: { '3': ['check_raise'] },
        river: { '3': ['fold_to_cbet'] },
      }
    );
    const result = extractPostflopAggression(10, hand);
    expect(result).toEqual({ bets: 1, raises: 1, calls: 0 });
  });

  it('ignores checks and folds', () => {
    const hand = makeHand(
      { '3': 10 },
      {
        preflop: { '3': ['call'] },
        flop: { '3': ['check'] },
        turn: { '3': ['fold'] },
      }
    );
    expect(extractPostflopAggression(10, hand)).toBeNull();
  });
});

// =============================================================================
// buildPlayerStats — basic (VPIP, PFR, AF)
// =============================================================================

describe('buildPlayerStats', () => {
  it('aggregates stats across multiple hands', () => {
    const hands = [
      makeHand({ '3': 10 }, { preflop: { '3': ['raise'] }, flop: { '3': ['bet'] } }, 1),
      makeHand({ '3': 10 }, { preflop: { '3': ['call'] }, flop: { '3': ['call'] } }, 2),
      makeHand({ '3': 10 }, { preflop: { '3': ['fold'] } }, 3),
    ];

    const stats = buildPlayerStats(10, hands);
    expect(stats.handsSeenPreflop).toBe(3);
    expect(stats.vpipCount).toBe(2);
    expect(stats.pfrCount).toBe(1);
    expect(stats.totalBets).toBe(1);
    expect(stats.totalCalls).toBe(1);
    expect(stats.lastCalculatedHandId).toBe(3);
  });

  it('returns empty stats for no hands', () => {
    const stats = buildPlayerStats(10, []);
    expect(stats.handsSeenPreflop).toBe(0);
    expect(stats.vpipCount).toBe(0);
  });

  it('skips hands where player is absent', () => {
    const hands = [
      makeHand({ '3': 10 }, { preflop: { '3': ['raise'] } }, 1),
      makeHand({ '5': 20 }, { preflop: { '5': ['call'] } }, 2),
    ];

    const stats = buildPlayerStats(10, hands);
    expect(stats.handsSeenPreflop).toBe(1);
  });

  it('still updates lastCalculatedHandId for absent hands', () => {
    const hands = [
      makeHand({ '5': 20 }, { preflop: { '5': ['call'] } }, 5),
    ];

    const stats = buildPlayerStats(10, hands);
    expect(stats.handsSeenPreflop).toBe(0);
    expect(stats.lastCalculatedHandId).toBe(5);
  });
});

// =============================================================================
// buildPlayerStats — 3-bet tracking
// =============================================================================

describe('buildPlayerStats (3-bet)', () => {
  it('counts 3-bet when player raises facing a raise', () => {
    // Seat 3 opens, seat 7 3-bets
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'raise', street: 'preflop', order: 2 },
        { seat: '3', action: 'call', street: 'preflop', order: 3 },
      ]
    );

    const stats = buildPlayerStats(20, [hand]);
    expect(stats.facedRaisePreflop).toBe(1);
    expect(stats.threeBetCount).toBe(1);
  });

  it('does not count opener as 3-bet', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'call', street: 'preflop', order: 2 },
      ]
    );

    // Seat 3 opened — did NOT face a raise
    const stats = buildPlayerStats(10, [hand]);
    expect(stats.facedRaisePreflop).toBe(0);
    expect(stats.threeBetCount).toBe(0);
  });

  it('counts faced-raise even when player folds', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'fold', street: 'preflop', order: 2 },
      ]
    );

    // Seat 7 faced a raise but folded (no 3-bet)
    const stats = buildPlayerStats(20, [hand]);
    expect(stats.facedRaisePreflop).toBe(1);
    expect(stats.threeBetCount).toBe(0);
  });

  it('handles 4-bet scenario', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'raise', street: 'preflop', order: 2 },
        { seat: '3', action: 'raise', street: 'preflop', order: 3 },
        { seat: '7', action: 'call', street: 'preflop', order: 4 },
      ]
    );

    // Seat 7 faced a raise and 3-bet
    const statsP20 = buildPlayerStats(20, [hand]);
    expect(statsP20.facedRaisePreflop).toBe(1);
    expect(statsP20.threeBetCount).toBe(1);

    // Seat 3 did NOT face a raise before their first action (they opened)
    const statsP10 = buildPlayerStats(10, [hand]);
    expect(statsP10.facedRaisePreflop).toBe(0);
    expect(statsP10.threeBetCount).toBe(0);
  });

  it('does not count when no raises exist', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'call', street: 'preflop', order: 1 },
        { seat: '7', action: 'check', street: 'preflop', order: 2 },
      ]
    );

    const stats = buildPlayerStats(20, [hand]);
    expect(stats.facedRaisePreflop).toBe(0);
  });
});

// =============================================================================
// buildPlayerStats — C-bet tracking
// =============================================================================

describe('buildPlayerStats (C-bet)', () => {
  it('counts C-bet when PF aggressor bets flop', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'call', street: 'preflop', order: 2 },
        { seat: '3', action: 'bet', street: 'flop', order: 3 },
        { seat: '7', action: 'call', street: 'flop', order: 4 },
      ]
    );

    const stats = buildPlayerStats(10, [hand]);
    expect(stats.pfAggressorFlops).toBe(1);
    expect(stats.cbetCount).toBe(1);
  });

  it('counts missed C-bet when PF aggressor checks flop', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'call', street: 'preflop', order: 2 },
        { seat: '3', action: 'check', street: 'flop', order: 3 },
      ]
    );

    const stats = buildPlayerStats(10, [hand]);
    expect(stats.pfAggressorFlops).toBe(1);
    expect(stats.cbetCount).toBe(0);
  });

  it('does not count non-aggressor flop bet as C-bet', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'call', street: 'preflop', order: 2 },
        { seat: '7', action: 'bet', street: 'flop', order: 3 },
      ]
    );

    // Player 20 (seat 7) was NOT the PF aggressor
    const stats = buildPlayerStats(20, [hand]);
    expect(stats.pfAggressorFlops).toBe(0);
    expect(stats.cbetCount).toBe(0);
  });

  it('does not count when PF aggressor does not see flop', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'fold', street: 'preflop', order: 2 },
      ]
    );

    // Player 10 won preflop, no flop
    const stats = buildPlayerStats(10, [hand]);
    expect(stats.pfAggressorFlops).toBe(0);
    expect(stats.cbetCount).toBe(0);
  });

  it('uses last raiser as aggressor in 3-bet pot', () => {
    const hand = makeSequenceHand(
      { '3': 10, '7': 20 },
      [
        { seat: '3', action: 'raise', street: 'preflop', order: 1 },
        { seat: '7', action: 'raise', street: 'preflop', order: 2 },
        { seat: '3', action: 'call', street: 'preflop', order: 3 },
        { seat: '7', action: 'bet', street: 'flop', order: 4 },
        { seat: '3', action: 'call', street: 'flop', order: 5 },
      ]
    );

    // Seat 7 is PF aggressor (last raiser), and C-bet
    const statsP20 = buildPlayerStats(20, [hand]);
    expect(statsP20.pfAggressorFlops).toBe(1);
    expect(statsP20.cbetCount).toBe(1);

    // Seat 3 is NOT the PF aggressor
    const statsP10 = buildPlayerStats(10, [hand]);
    expect(statsP10.pfAggressorFlops).toBe(0);
  });
});

// =============================================================================
// updatePlayerStats (incremental)
// =============================================================================

describe('updatePlayerStats', () => {
  it('incrementally adds one hand to existing stats', () => {
    const existing = createEmptyStats();
    existing.handsSeenPreflop = 5;
    existing.vpipCount = 3;
    existing.pfrCount = 2;
    existing.totalBets = 1;
    existing.totalRaises = 1;
    existing.totalCalls = 2;
    existing.lastCalculatedHandId = 5;

    const newHand = makeHand(
      { '3': 10 },
      { preflop: { '3': ['call'] }, flop: { '3': ['call'] } },
      6
    );

    const updated = updatePlayerStats(existing, 10, newHand);
    expect(updated.handsSeenPreflop).toBe(6);
    expect(updated.vpipCount).toBe(4);
    expect(updated.pfrCount).toBe(2);
    expect(updated.totalCalls).toBe(3);
    expect(updated.lastCalculatedHandId).toBe(6);
  });

  it('does not mutate existing stats', () => {
    const existing = createEmptyStats();
    const hand = makeHand({ '3': 10 }, { preflop: { '3': ['raise'] } }, 1);

    const updated = updatePlayerStats(existing, 10, hand);
    expect(existing.handsSeenPreflop).toBe(0);
    expect(updated.handsSeenPreflop).toBe(1);
  });
});

// =============================================================================
// derivePercentages
// =============================================================================

describe('derivePercentages', () => {
  it('calculates VPIP and PFR percentages', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 100,
      vpipCount: 25,
      pfrCount: 18,
      totalBets: 10,
      totalRaises: 5,
      totalCalls: 6,
    });

    const result = derivePercentages(stats);
    expect(result.vpip).toBe(25);
    expect(result.pfr).toBe(18);
    expect(result.sampleSize).toBe(100);
  });

  it('calculates aggression factor', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 50,
      vpipCount: 20,
      pfrCount: 15,
      totalBets: 8,
      totalRaises: 4,
      totalCalls: 6,
    });

    const result = derivePercentages(stats);
    expect(result.af).toBe(2);  // (8+4)/6 = 2.0
  });

  it('calculates 3-bet percentage', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 50,
      facedRaisePreflop: 20,
      threeBetCount: 4,
    });

    const result = derivePercentages(stats);
    expect(result.threeBet).toBe(20);  // 4/20 = 20%
  });

  it('calculates C-bet percentage', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 50,
      pfAggressorFlops: 15,
      cbetCount: 10,
    });

    const result = derivePercentages(stats);
    expect(result.cbet).toBe(67);  // 10/15 = 66.7 -> 67%
  });

  it('returns null 3-bet when never faced a raise', () => {
    const stats = createEmptyStats();
    stats.handsSeenPreflop = 10;

    const result = derivePercentages(stats);
    expect(result.threeBet).toBeNull();
  });

  it('returns null C-bet when never PF aggressor on flop', () => {
    const stats = createEmptyStats();
    stats.handsSeenPreflop = 10;

    const result = derivePercentages(stats);
    expect(result.cbet).toBeNull();
  });

  it('returns Infinity AF when no calls but aggressive actions exist', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 10,
      totalBets: 3,
      totalRaises: 2,
      totalCalls: 0,
    });

    const result = derivePercentages(stats);
    expect(result.af).toBe(Infinity);
  });

  it('returns null AF when no postflop actions', () => {
    const stats = createEmptyStats();
    stats.handsSeenPreflop = 10;

    const result = derivePercentages(stats);
    expect(result.af).toBeNull();
  });

  it('returns nulls for zero hands', () => {
    const stats = createEmptyStats();
    const result = derivePercentages(stats);
    expect(result.vpip).toBeNull();
    expect(result.pfr).toBeNull();
    expect(result.af).toBeNull();
    expect(result.threeBet).toBeNull();
    expect(result.cbet).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it('returns nulls for null stats', () => {
    const result = derivePercentages(null);
    expect(result.vpip).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it('rounds AF to one decimal place', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 50,
      totalBets: 7,
      totalRaises: 3,
      totalCalls: 4,
    });

    const result = derivePercentages(stats);
    expect(result.af).toBe(2.5);
  });

  it('rounds VPIP/PFR to whole numbers', () => {
    const stats = createEmptyStats();
    Object.assign(stats, {
      handsSeenPreflop: 3,
      vpipCount: 1,
      pfrCount: 1,
    });

    const result = derivePercentages(stats);
    expect(result.vpip).toBe(33);
    expect(result.pfr).toBe(33);
  });
});
