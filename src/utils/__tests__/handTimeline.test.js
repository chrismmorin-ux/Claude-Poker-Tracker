import { describe, it, expect } from 'vitest';
import {
  buildTimeline,
  getPlayerTimeline,
  getStreetTimeline,
  didPlayerFaceRaise,
  findLastRaiser,
  getCbetInfo,
} from '../handTimeline';

// =============================================================================
// TEST HELPERS
// =============================================================================

/** Hand with actionSequence (new format) */
const makeSequenceHand = (actionSequence, opts = {}) => ({
  handId: opts.handId ?? 1,
  gameState: {
    currentStreet: 'showdown',
    dealerButtonSeat: opts.dealer ?? 1,
    mySeat: 5,
    seatActions: opts.seatActions ?? {},
    actionSequence,
    absentSeats: [],
  },
  seatPlayers: opts.seatPlayers ?? {},
});

/** Hand with only seatActions (old format, no actionSequence) */
const makeOldHand = (seatActions, dealer = 1) => ({
  handId: 1,
  gameState: {
    currentStreet: 'showdown',
    dealerButtonSeat: dealer,
    mySeat: 5,
    seatActions,
    absentSeats: [],
  },
  seatPlayers: {},
});

// =============================================================================
// buildTimeline - from actionSequence
// =============================================================================

describe('buildTimeline (actionSequence)', () => {
  it('builds ordered timeline from actionSequence', () => {
    const hand = makeSequenceHand([
      { seat: 3, action: 'raise', street: 'preflop', order: 1 },
      { seat: 7, action: 'call', street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', street: 'flop', order: 3 },
    ]);

    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]).toEqual({ order: 1, seat: '3', action: 'raise', street: 'preflop' });
    expect(timeline[1]).toEqual({ order: 2, seat: '7', action: 'call', street: 'preflop' });
    expect(timeline[2]).toEqual({ order: 3, seat: '3', action: 'bet', street: 'flop' });
  });

  it('normalizes legacy actions in actionSequence', () => {
    const hand = makeSequenceHand([
      { seat: 3, action: 'open', street: 'preflop', order: 1 },
      { seat: 7, action: 'limp', street: 'preflop', order: 2 },
    ]);

    const timeline = buildTimeline(hand);
    expect(timeline[0].action).toBe('raise');
    expect(timeline[1].action).toBe('call');
  });

  it('sorts by order even if entries are unordered', () => {
    const hand = makeSequenceHand([
      { seat: 7, action: 'call', street: 'preflop', order: 3 },
      { seat: 3, action: 'raise', street: 'preflop', order: 1 },
      { seat: 5, action: 'fold', street: 'preflop', order: 2 },
    ]);

    const timeline = buildTimeline(hand);
    expect(timeline[0].order).toBe(1);
    expect(timeline[1].order).toBe(2);
    expect(timeline[2].order).toBe(3);
  });

  it('skips showdown actions (won, mucked)', () => {
    const hand = makeSequenceHand([
      { seat: 3, action: 'raise', street: 'preflop', order: 1 },
      { seat: 3, action: 'won', street: 'showdown', order: 2 },
    ]);

    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(1);
  });

  it('prefers actionSequence over seatActions when both present', () => {
    const hand = makeSequenceHand(
      [{ seat: 3, action: 'raise', street: 'preflop', order: 1 }],
      {
        seatActions: {
          preflop: { '3': ['fold'], '7': ['call'] },
        },
      }
    );

    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].action).toBe('raise');
  });
});

// =============================================================================
// buildTimeline - from seatActions (fallback)
// =============================================================================

describe('buildTimeline (seatActions fallback)', () => {
  it('builds timeline from seatActions in positional order', () => {
    // Dealer on seat 1. Preflop order: UTG(4), 5, 6, 7, 8, 9, SB(2), BB(3)
    const hand = makeOldHand({
      preflop: {
        '4': ['raise'],
        '7': ['call'],
        '3': ['fold'],
      },
    }, 1);

    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(3);
    // UTG (seat 4) should be first, then seat 7, then BB (seat 3)
    expect(timeline[0].seat).toBe('4');
    expect(timeline[1].seat).toBe('7');
    expect(timeline[2].seat).toBe('3');
  });

  it('handles multi-street hands', () => {
    const hand = makeOldHand({
      preflop: { '4': ['raise'], '7': ['call'] },
      flop: { '7': ['check'], '4': ['bet'] },
    }, 1);

    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(4);
    // Preflop: 4 before 7 (UTG before later position)
    expect(timeline[0]).toMatchObject({ seat: '4', street: 'preflop' });
    expect(timeline[1]).toMatchObject({ seat: '7', street: 'preflop' });
    // Flop: postflop order (SB first), so seat 7 is after seat 4
    // With dealer=1: postflop order is 2,3,4,5,6,7,8,9,1
    expect(timeline[2]).toMatchObject({ seat: '4', street: 'flop' });
    expect(timeline[3]).toMatchObject({ seat: '7', street: 'flop' });
  });

  it('handles multiple actions per seat on a street', () => {
    const hand = makeOldHand({
      preflop: { '4': ['raise'], '7': ['call', 'raise'] },
    }, 1);

    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]).toMatchObject({ seat: '4', action: 'raise' });
    expect(timeline[1]).toMatchObject({ seat: '7', action: 'call' });
    expect(timeline[2]).toMatchObject({ seat: '7', action: 'raise' });
  });

  it('normalizes legacy actions', () => {
    const hand = makeOldHand({
      preflop: { '4': ['open'] },
      flop: { '4': ['cbet_ip_small'] },
    }, 1);

    const timeline = buildTimeline(hand);
    expect(timeline[0].action).toBe('raise');
    expect(timeline[1].action).toBe('bet');
  });

  it('returns empty timeline for empty seatActions', () => {
    const hand = makeOldHand({}, 1);
    expect(buildTimeline(hand)).toEqual([]);
  });

  it('assigns sequential order numbers', () => {
    const hand = makeOldHand({
      preflop: { '4': ['raise'], '7': ['call'] },
    }, 1);

    const timeline = buildTimeline(hand);
    expect(timeline[0].order).toBe(1);
    expect(timeline[1].order).toBe(2);
  });
});

// =============================================================================
// getPlayerTimeline
// =============================================================================

describe('getPlayerTimeline', () => {
  it('filters to a single player', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
      { order: 3, seat: '3', action: 'bet', street: 'flop' },
    ];

    const player3 = getPlayerTimeline(timeline, '3');
    expect(player3).toHaveLength(2);
    expect(player3[0].action).toBe('raise');
    expect(player3[1].action).toBe('bet');
  });

  it('handles numeric seat input', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
    ];
    expect(getPlayerTimeline(timeline, 3)).toHaveLength(1);
  });
});

// =============================================================================
// getStreetTimeline
// =============================================================================

describe('getStreetTimeline', () => {
  it('filters to a single street', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
      { order: 3, seat: '3', action: 'bet', street: 'flop' },
    ];

    expect(getStreetTimeline(timeline, 'preflop')).toHaveLength(2);
    expect(getStreetTimeline(timeline, 'flop')).toHaveLength(1);
    expect(getStreetTimeline(timeline, 'turn')).toHaveLength(0);
  });
});

// =============================================================================
// didPlayerFaceRaise
// =============================================================================

describe('didPlayerFaceRaise', () => {
  it('returns true when another seat raised before player acted', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
    ];
    expect(didPlayerFaceRaise(timeline, '7', 'preflop')).toBe(true);
  });

  it('returns false for the first raiser (opener)', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
    ];
    expect(didPlayerFaceRaise(timeline, '3', 'preflop')).toBe(false);
  });

  it('returns false when no raises before player', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'call', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
    ];
    expect(didPlayerFaceRaise(timeline, '7', 'preflop')).toBe(false);
  });

  it('returns false when player not on that street', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
    ];
    expect(didPlayerFaceRaise(timeline, '7', 'preflop')).toBe(false);
  });

  it('detects raise on postflop streets too', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'bet', street: 'flop' },
      { order: 2, seat: '7', action: 'raise', street: 'flop' },
      { order: 3, seat: '3', action: 'call', street: 'flop' },
    ];
    // Seat 3 faced a raise on the flop (seat 7 raised before seat 3's second action)
    // But didPlayerFaceRaise checks before FIRST action, so seat 3's first action (bet) came before the raise
    expect(didPlayerFaceRaise(timeline, '3', 'flop')).toBe(false);
    expect(didPlayerFaceRaise(timeline, '7', 'flop')).toBe(false); // 7's first action IS the raise, no prior raise
  });

  it('handles 3-bet scenario correctly', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },  // open
      { order: 2, seat: '7', action: 'raise', street: 'preflop' },  // 3-bet
      { order: 3, seat: '3', action: 'call', street: 'preflop' },   // call 3-bet
    ];
    // Seat 7 faced a raise (seat 3 raised before seat 7 acted)
    expect(didPlayerFaceRaise(timeline, '7', 'preflop')).toBe(true);
    // Seat 3 did NOT face a raise before their first action (they opened)
    expect(didPlayerFaceRaise(timeline, '3', 'preflop')).toBe(false);
  });

  it('handles 4-bet scenario', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },  // open
      { order: 2, seat: '7', action: 'raise', street: 'preflop' },  // 3-bet
      { order: 3, seat: '3', action: 'raise', street: 'preflop' },  // 4-bet
    ];
    expect(didPlayerFaceRaise(timeline, '7', 'preflop')).toBe(true);
    expect(didPlayerFaceRaise(timeline, '3', 'preflop')).toBe(false);
  });
});

// =============================================================================
// findLastRaiser
// =============================================================================

describe('findLastRaiser', () => {
  it('finds the last raiser on a street', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'raise', street: 'preflop' },
      { order: 3, seat: '3', action: 'call', street: 'preflop' },
    ];
    expect(findLastRaiser(timeline, 'preflop')).toBe('7');
  });

  it('returns single raiser', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
    ];
    expect(findLastRaiser(timeline, 'preflop')).toBe('3');
  });

  it('returns null when no raises', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'call', street: 'preflop' },
    ];
    expect(findLastRaiser(timeline, 'preflop')).toBeNull();
  });

  it('scopes to the requested street', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'raise', street: 'flop' },
    ];
    expect(findLastRaiser(timeline, 'preflop')).toBe('3');
    expect(findLastRaiser(timeline, 'flop')).toBe('7');
  });
});

// =============================================================================
// getCbetInfo
// =============================================================================

describe('getCbetInfo', () => {
  it('detects C-bet: PF aggressor bets flop', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
      { order: 3, seat: '3', action: 'bet', street: 'flop' },
      { order: 4, seat: '7', action: 'call', street: 'flop' },
    ];

    expect(getCbetInfo(timeline, '3')).toEqual({
      isPfAggressor: true, sawFlop: true, cbet: true,
    });
  });

  it('detects missed C-bet: PF aggressor checks flop', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
      { order: 3, seat: '3', action: 'check', street: 'flop' },
    ];

    expect(getCbetInfo(timeline, '3')).toEqual({
      isPfAggressor: true, sawFlop: true, cbet: false,
    });
  });

  it('returns not aggressor for non-raiser', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'call', street: 'preflop' },
      { order: 3, seat: '7', action: 'bet', street: 'flop' },
    ];

    expect(getCbetInfo(timeline, '7')).toEqual({
      isPfAggressor: false, sawFlop: false, cbet: false,
    });
  });

  it('handles PF aggressor who does not see flop (everyone folds)', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'fold', street: 'preflop' },
    ];

    expect(getCbetInfo(timeline, '3')).toEqual({
      isPfAggressor: true, sawFlop: false, cbet: false,
    });
  });

  it('uses last raiser as PF aggressor (3-bet pot)', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'raise', street: 'preflop' },
      { order: 2, seat: '7', action: 'raise', street: 'preflop' },  // 3-bet
      { order: 3, seat: '3', action: 'call', street: 'preflop' },
      { order: 4, seat: '7', action: 'bet', street: 'flop' },       // C-bet by 3-bettor
    ];

    // Seat 7 is the PF aggressor (last raiser)
    expect(getCbetInfo(timeline, '7')).toEqual({
      isPfAggressor: true, sawFlop: true, cbet: true,
    });
    // Seat 3 is NOT the PF aggressor
    expect(getCbetInfo(timeline, '3')).toEqual({
      isPfAggressor: false, sawFlop: false, cbet: false,
    });
  });

  it('returns no C-bet when no preflop raises', () => {
    const timeline = [
      { order: 1, seat: '3', action: 'call', street: 'preflop' },
      { order: 2, seat: '7', action: 'check', street: 'preflop' },
      { order: 3, seat: '3', action: 'bet', street: 'flop' },
    ];

    // No PF aggressor, so nobody C-bets
    expect(getCbetInfo(timeline, '3')).toEqual({
      isPfAggressor: false, sawFlop: false, cbet: false,
    });
  });
});
