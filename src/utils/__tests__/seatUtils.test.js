/**
 * seatUtils.test.js - Tests for seat navigation and position utilities
 *
 * Functions now take actionSequence (array of {seat, action, street, order})
 * instead of legacy seatActions objects.
 */

import { describe, it, expect } from 'vitest';
import {
  getNextActiveSeat,
  getSmallBlindSeat,
  getBigBlindSeat,
  getFirstActionSeat,
  getNextActionSeat,
  isStreetActionComplete,
  getActiveSeatCount,
} from '../seatUtils';
import { hasSeatFolded } from '../sequenceUtils';

// Helper to create action entries
const entry = (seat, action, street = 'flop', order = 0) => ({
  seat, action, street, order,
});

describe('getNextActiveSeat', () => {
  it('returns next seat in clockwise order', () => {
    expect(getNextActiveSeat(1, [], 9)).toBe(2);
    expect(getNextActiveSeat(5, [], 9)).toBe(6);
    expect(getNextActiveSeat(8, [], 9)).toBe(9);
  });

  it('wraps from seat 9 to seat 1', () => {
    expect(getNextActiveSeat(9, [], 9)).toBe(1);
  });

  it('skips single absent seat', () => {
    expect(getNextActiveSeat(1, [2], 9)).toBe(3);
    expect(getNextActiveSeat(5, [6], 9)).toBe(7);
  });

  it('skips multiple consecutive absent seats', () => {
    expect(getNextActiveSeat(1, [2, 3, 4], 9)).toBe(5);
    expect(getNextActiveSeat(7, [8, 9], 9)).toBe(1);
  });

  it('wraps around while skipping absent seats', () => {
    expect(getNextActiveSeat(9, [1, 2], 9)).toBe(3);
    expect(getNextActiveSeat(8, [9, 1, 2, 3], 9)).toBe(4);
  });

  it('handles all seats absent except one', () => {
    const allButSeat5 = [1, 2, 3, 4, 6, 7, 8, 9];
    expect(getNextActiveSeat(4, allButSeat5, 9)).toBe(5);
    expect(getNextActiveSeat(5, allButSeat5, 9)).toBe(5);
  });

  it('returns next seat even if all seats are absent (fallback)', () => {
    const allSeats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = getNextActiveSeat(5, allSeats, 9);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(9);
  });
});

describe('getSmallBlindSeat', () => {
  it('returns seat after dealer when no absent seats', () => {
    expect(getSmallBlindSeat(1, [], 9)).toBe(2);
    expect(getSmallBlindSeat(5, [], 9)).toBe(6);
    expect(getSmallBlindSeat(8, [], 9)).toBe(9);
  });

  it('wraps from seat 9 to seat 1', () => {
    expect(getSmallBlindSeat(9, [], 9)).toBe(1);
  });

  it('skips absent seat after dealer', () => {
    expect(getSmallBlindSeat(1, [2], 9)).toBe(3);
    expect(getSmallBlindSeat(5, [6, 7], 9)).toBe(8);
  });

  it('wraps while skipping absent seats', () => {
    expect(getSmallBlindSeat(9, [1], 9)).toBe(2);
    expect(getSmallBlindSeat(8, [9, 1, 2], 9)).toBe(3);
  });

  it('handles dealer at each position (1-9)', () => {
    const results = [];
    for (let dealer = 1; dealer <= 9; dealer++) {
      const sb = getSmallBlindSeat(dealer, [], 9);
      results.push(sb);
      expect(sb).toBe(dealer === 9 ? 1 : dealer + 1);
    }
    expect(results).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 1]);
  });
});

describe('getBigBlindSeat', () => {
  it('returns second seat after dealer when no absent seats', () => {
    expect(getBigBlindSeat(1, [], 9)).toBe(3);
    expect(getBigBlindSeat(5, [], 9)).toBe(7);
    expect(getBigBlindSeat(7, [], 9)).toBe(9);
  });

  it('wraps correctly from late seats', () => {
    expect(getBigBlindSeat(8, [], 9)).toBe(1);
    expect(getBigBlindSeat(9, [], 9)).toBe(2);
  });

  it('skips absent seats between dealer and BB', () => {
    expect(getBigBlindSeat(1, [2], 9)).toBe(4);
    expect(getBigBlindSeat(1, [2, 3], 9)).toBe(5);
  });

  it('handles absent SB seat', () => {
    expect(getBigBlindSeat(5, [6], 9)).toBe(8);
  });

  it('handles absent BB seat', () => {
    expect(getBigBlindSeat(5, [7], 9)).toBe(8);
  });

  it('wraps while skipping absent seats', () => {
    expect(getBigBlindSeat(8, [9], 9)).toBe(2);
    expect(getBigBlindSeat(9, [1], 9)).toBe(3);
  });

  it('handles dealer at each position (1-9)', () => {
    const results = [];
    for (let dealer = 1; dealer <= 9; dealer++) {
      const bb = getBigBlindSeat(dealer, [], 9);
      results.push(bb);
      const expectedBB = dealer + 2 > 9 ? dealer + 2 - 9 : dealer + 2;
      expect(bb).toBe(expectedBB);
    }
    expect(results).toEqual([3, 4, 5, 6, 7, 8, 9, 1, 2]);
  });
});

describe('hasSeatFolded', () => {
  it('returns false for empty sequence', () => {
    expect(hasSeatFolded([], 1)).toBe(false);
  });

  it('returns false when seat has non-fold actions', () => {
    const seq = [
      entry(1, 'raise', 'preflop'),
      entry(1, 'call', 'preflop'),
    ];
    expect(hasSeatFolded(seq, 1)).toBe(false);
  });

  it('detects fold action', () => {
    const seq = [entry(1, 'fold', 'preflop')];
    expect(hasSeatFolded(seq, 1)).toBe(true);
  });

  it('detects fold on any street', () => {
    const seq = [
      entry(1, 'call', 'preflop'),
      entry(1, 'fold', 'flop'),
    ];
    expect(hasSeatFolded(seq, 1)).toBe(true);
  });

  it('returns false for different seat', () => {
    const seq = [entry(1, 'fold', 'preflop')];
    expect(hasSeatFolded(seq, 2)).toBe(false);
  });
});

describe('getFirstActionSeat', () => {
  describe('preflop', () => {
    it('returns seat after big blind (UTG)', () => {
      const result = getFirstActionSeat('preflop', 1, [], [], 9);
      expect(result).toBe(4);
    });

    it('returns correct UTG for different dealer positions', () => {
      expect(getFirstActionSeat('preflop', 5, [], [], 9)).toBe(8);
      expect(getFirstActionSeat('preflop', 7, [], [], 9)).toBe(1);
      expect(getFirstActionSeat('preflop', 9, [], [], 9)).toBe(3);
    });

    it('skips absent seats after BB', () => {
      const result = getFirstActionSeat('preflop', 1, [4], [], 9);
      expect(result).toBe(5);
    });

    it('wraps around while skipping absent seats', () => {
      const result = getFirstActionSeat('preflop', 8, [2], [], 9);
      expect(result).toBe(3);
    });

    it('skips multiple absent seats', () => {
      const result = getFirstActionSeat('preflop', 1, [4, 5, 6], [], 9);
      expect(result).toBe(7);
    });

    it('does not check fold status preflop (no prior streets)', () => {
      const seq = [entry(4, 'fold', 'preflop')];
      const result = getFirstActionSeat('preflop', 1, [], seq, 9);
      expect(result).toBe(4);
    });
  });

  describe('postflop (flop, turn, river)', () => {
    it('returns first seat after dealer (flop)', () => {
      const result = getFirstActionSeat('flop', 1, [], [], 9);
      expect(result).toBe(2);
    });

    it('returns correct first action seat for different dealers', () => {
      expect(getFirstActionSeat('flop', 5, [], [], 9)).toBe(6);
      expect(getFirstActionSeat('turn', 9, [], [], 9)).toBe(1);
      expect(getFirstActionSeat('river', 3, [], [], 9)).toBe(4);
    });

    it('skips absent seats after dealer', () => {
      const result = getFirstActionSeat('flop', 5, [6], [], 9);
      expect(result).toBe(7);
    });

    it('skips folded seats after dealer', () => {
      const seq = [entry(2, 'fold', 'preflop')];
      const result = getFirstActionSeat('flop', 1, [], seq, 9);
      expect(result).toBe(3);
    });

    it('skips both absent and folded seats', () => {
      const seq = [
        entry(3, 'fold', 'preflop'),
        entry(4, 'fold', 'flop'),
      ];
      const result = getFirstActionSeat('turn', 1, [2], seq, 9);
      expect(result).toBe(5);
    });

    it('wraps around table', () => {
      const result = getFirstActionSeat('flop', 9, [], [], 9);
      expect(result).toBe(1);
    });

    it('wraps while skipping inactive seats', () => {
      const seq = [
        entry(1, 'fold', 'preflop'),
        entry(2, 'fold', 'preflop'),
      ];
      const result = getFirstActionSeat('flop', 9, [], seq, 9);
      expect(result).toBe(3);
    });

    it('returns fallback (1) if all seats are inactive', () => {
      const seq = [];
      for (let seat = 1; seat <= 9; seat++) {
        seq.push(entry(seat, 'fold', 'preflop'));
      }
      const result = getFirstActionSeat('flop', 5, [], seq, 9);
      expect(result).toBe(1);
    });

    it('works on showdown street', () => {
      const result = getFirstActionSeat('showdown', 5, [], [], 9);
      expect(result).toBe(6);
    });
  });
});

describe('getNextActionSeat', () => {
  it('returns next active seat after current', () => {
    expect(getNextActionSeat(1, [], [], 9)).toBe(2);
    expect(getNextActionSeat(5, [], [], 9)).toBe(6);
  });

  it('wraps from seat 9 to seat 1', () => {
    expect(getNextActionSeat(9, [], [], 9)).toBe(1);
  });

  it('skips absent seats', () => {
    expect(getNextActionSeat(1, [2], [], 9)).toBe(3);
    expect(getNextActionSeat(8, [9, 1], [], 9)).toBe(2);
  });

  it('skips folded seats', () => {
    const seq = [entry(2, 'fold', 'preflop')];
    expect(getNextActionSeat(1, [], seq, 9)).toBe(3);
  });

  it('skips both absent and folded seats', () => {
    const seq = [
      entry(3, 'fold', 'preflop'),
      entry(5, 'fold', 'preflop'),
    ];
    expect(getNextActionSeat(2, [4], seq, 9)).toBe(6);
  });

  it('checks fold status on any street', () => {
    const seq = [
      entry(3, 'fold', 'preflop'),
      entry(4, 'fold', 'flop'),
    ];
    expect(getNextActionSeat(2, [], seq, 9)).toBe(5);
  });

  it('wraps while skipping inactive seats', () => {
    const seq = [
      entry(1, 'fold', 'preflop'),
      entry(2, 'fold', 'preflop'),
    ];
    expect(getNextActionSeat(9, [], seq, 9)).toBe(3);
  });

  it('returns null if all seats are inactive', () => {
    const seq = [];
    for (let seat = 1; seat <= 9; seat++) {
      seq.push(entry(seat, 'fold', 'preflop'));
    }
    expect(getNextActionSeat(5, [], seq, 9)).toBe(null);
  });

  it('returns null if all seats are absent', () => {
    const allSeats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(getNextActionSeat(5, allSeats, [], 9)).toBe(null);
  });

  it('works on preflop street', () => {
    expect(getNextActionSeat(4, [], [], 9)).toBe(5);
  });

  it('works on showdown street', () => {
    const seq = [entry(3, 'fold', 'preflop')];
    expect(getNextActionSeat(2, [], seq, 9)).toBe(4);
  });
});

describe('isStreetActionComplete', () => {
  it('returns false when no actions recorded', () => {
    expect(isStreetActionComplete('flop', [], [], 9)).toBe(false);
  });

  it('returns false for showdown street', () => {
    expect(isStreetActionComplete('showdown', [], [], 9)).toBe(false);
  });

  it('completes when all seats check (3 active players)', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'check'), entry(2, 'check'), entry(3, 'check'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(true);
  });

  it('not complete when only some seats have checked', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [entry(1, 'check'), entry(2, 'check')];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(false);
  });

  it('completes when bet is called by all', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'bet', 'flop'),
      entry(2, 'call'),
      entry(3, 'call'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(true);
  });

  it('not complete after bet with one caller remaining', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'bet', 'flop'),
      entry(2, 'call'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(false);
  });

  it('completes when raise is called by all remaining', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'bet', 'flop'),
      entry(2, 'raise', 'flop'),
      entry(3, 'call'),
      entry(1, 'call'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(true);
  });

  it('not complete after raise — original bettor has not responded', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'bet', 'flop'),
      entry(2, 'raise', 'flop'),
      entry(3, 'call'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(false);
  });

  it('completes when everyone folds to a bet', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'bet', 'flop'),
      entry(2, 'fold'),
      entry(3, 'fold'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(true);
  });

  it('completes when all fold to one player (hand over)', () => {
    const absent = [3, 4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'bet', 'flop'),
      entry(2, 'fold'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(true);
  });

  it('skips previously folded seats', () => {
    // Seat 2 folded on preflop — only seats 1 and 3 active on flop
    const seq = [
      entry(2, 'fold', 'preflop'),
      entry(1, 'check', 'flop'),
      entry(3, 'check', 'flop'),
    ];
    expect(isStreetActionComplete('flop', seq, [], 3)).toBe(true);
  });

  it('skips absent seats', () => {
    const absent = [2];
    const seq = [
      entry(1, 'check'),
      entry(3, 'check'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 3)).toBe(true);
  });

  it('works for preflop — everyone calls, BB checks', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'call', 'preflop'),
      entry(2, 'call', 'preflop'),
      entry(3, 'check', 'preflop'),
    ];
    expect(isStreetActionComplete('preflop', seq, absent, 9)).toBe(true);
  });

  it('works for preflop — raise requires responses', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'raise', 'preflop'),
      entry(2, 'call', 'preflop'),
    ];
    expect(isStreetActionComplete('preflop', seq, absent, 9)).toBe(false);
  });

  it('works for preflop — raise called by all', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'raise', 'preflop'),
      entry(2, 'call', 'preflop'),
      entry(3, 'call', 'preflop'),
    ];
    expect(isStreetActionComplete('preflop', seq, absent, 9)).toBe(true);
  });

  it('returns true when only 1 active seat', () => {
    const absent = [2, 3, 4, 5, 6, 7, 8, 9];
    expect(isStreetActionComplete('flop', [], absent, 9)).toBe(true);
  });

  it('ignores actions from other streets', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'call', 'preflop'),
      entry(2, 'check', 'preflop'),
      entry(3, 'check', 'preflop'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(false);
  });

  it('handles check-bet-fold-call pattern', () => {
    const absent = [5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'check'),
      entry(2, 'check'),
      entry(3, 'bet', 'flop'),
      entry(4, 'fold'),
      entry(1, 'call'),
      entry(2, 'call'),
    ];
    expect(isStreetActionComplete('flop', seq, absent, 9)).toBe(true);
  });

  it('handles 3bet preflop', () => {
    const absent = [4, 5, 6, 7, 8, 9];
    const seq = [
      entry(1, 'raise', 'preflop'),
      entry(2, 'raise', 'preflop'),
      entry(3, 'fold', 'preflop'),
      entry(1, 'call', 'preflop'),
    ];
    expect(isStreetActionComplete('preflop', seq, absent, 9)).toBe(true);
  });
});

describe('getActiveSeatCount', () => {
  it('counts all seats when none absent or folded', () => {
    expect(getActiveSeatCount([], [], 9)).toBe(9);
  });

  it('excludes absent seats', () => {
    expect(getActiveSeatCount([], [1, 2, 3], 9)).toBe(6);
  });

  it('excludes folded seats', () => {
    const seq = [
      entry(4, 'fold', 'preflop'),
      entry(5, 'fold', 'preflop'),
    ];
    expect(getActiveSeatCount(seq, [], 9)).toBe(7);
  });

  it('returns 1 when all but one folded', () => {
    const seq = [];
    for (let s = 2; s <= 9; s++) {
      seq.push(entry(s, 'fold', 'preflop'));
    }
    expect(getActiveSeatCount(seq, [], 9)).toBe(1);
  });

  it('combines absent and folded', () => {
    const seq = [entry(3, 'fold', 'preflop')];
    expect(getActiveSeatCount(seq, [1, 2], 9)).toBe(6);
  });
});
