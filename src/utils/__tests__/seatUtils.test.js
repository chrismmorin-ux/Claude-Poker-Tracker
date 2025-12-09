/**
 * seatUtils.test.js - Tests for seat navigation and position utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getNextActiveSeat,
  getSmallBlindSeat,
  getBigBlindSeat,
  hasSeatFolded,
  getFirstActionSeat,
  getNextActionSeat,
  findClosestSeat,
  calculateContextMenuPosition,
} from '../seatUtils';
import { STREETS, isFoldAction } from '../../test/utils';

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
    // Should stop after numSeats attempts
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
    expect(getBigBlindSeat(1, [2], 9)).toBe(4); // D→3(SB)→4(BB)
    expect(getBigBlindSeat(1, [2, 3], 9)).toBe(5); // D→4(SB)→5(BB)
  });

  it('handles absent SB seat', () => {
    expect(getBigBlindSeat(5, [6], 9)).toBe(8); // D→7(SB)→8(BB)
  });

  it('handles absent BB seat', () => {
    expect(getBigBlindSeat(5, [7], 9)).toBe(8); // D→6(SB)→8(BB)
  });

  it('wraps while skipping absent seats', () => {
    expect(getBigBlindSeat(8, [9], 9)).toBe(2); // D→1(SB)→2(BB)
    expect(getBigBlindSeat(9, [1], 9)).toBe(3); // D→2(SB)→3(BB)
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
  it('returns false when seat has no actions', () => {
    const seatActions = {};
    expect(hasSeatFolded(1, 'preflop', STREETS, seatActions, isFoldAction)).toBe(false);
  });

  it('returns false when seat has non-fold actions', () => {
    const seatActions = {
      preflop: { 1: ['open', 'call'] },
    };
    expect(hasSeatFolded(1, 'preflop', STREETS, seatActions, isFoldAction)).toBe(false);
  });

  it('detects fold action on current street', () => {
    const seatActions = {
      preflop: { 1: ['fold'] },
    };
    expect(hasSeatFolded(1, 'preflop', STREETS, seatActions, isFoldAction)).toBe(true);
  });

  it('detects fold_to_cbet action', () => {
    const seatActions = {
      flop: { 2: ['fold_to_cbet'] },
    };
    expect(hasSeatFolded(2, 'flop', STREETS, seatActions, isFoldAction)).toBe(true);
  });

  it('detects fold_to_cr action', () => {
    const seatActions = {
      turn: { 3: ['fold_to_cr'] },
    };
    expect(hasSeatFolded(3, 'turn', STREETS, seatActions, isFoldAction)).toBe(true);
  });

  it('detects fold in earlier street', () => {
    const seatActions = {
      preflop: { 1: ['fold'] },
      flop: { 2: ['check'] },
    };
    expect(hasSeatFolded(1, 'flop', STREETS, seatActions, isFoldAction)).toBe(true);
  });

  it('checks all streets up to and including current street', () => {
    const seatActions = {
      preflop: { 1: ['call'] },
      flop: { 1: ['fold_to_cbet'] },
      turn: { 2: ['check'] },
    };
    expect(hasSeatFolded(1, 'turn', STREETS, seatActions, isFoldAction)).toBe(true);
    expect(hasSeatFolded(2, 'turn', STREETS, seatActions, isFoldAction)).toBe(false);
  });

  it('ignores future streets', () => {
    const seatActions = {
      preflop: { 1: ['call'] },
      flop: { 1: ['check'] },
      turn: { 1: ['fold'] }, // Fold on turn
    };
    // Checking flop street should not see turn fold
    expect(hasSeatFolded(1, 'flop', STREETS, seatActions, isFoldAction)).toBe(false);
  });

  it('handles multiple actions per street (finds fold in array)', () => {
    const seatActions = {
      flop: { 1: ['check', 'fold_to_cr'] }, // Checked, then folded to raise
    };
    expect(hasSeatFolded(1, 'flop', STREETS, seatActions, isFoldAction)).toBe(true);
  });

  it('handles showdown street', () => {
    const seatActions = {
      preflop: { 1: ['call'] },
      flop: { 1: ['check'] },
      turn: { 1: ['call'] },
      river: { 1: ['fold'] },
    };
    expect(hasSeatFolded(1, 'showdown', STREETS, seatActions, isFoldAction)).toBe(true);
  });

  it('returns false for different seat', () => {
    const seatActions = {
      preflop: { 1: ['fold'] },
    };
    expect(hasSeatFolded(2, 'preflop', STREETS, seatActions, isFoldAction)).toBe(false);
  });

  it('handles empty action array', () => {
    const seatActions = {
      preflop: { 1: [] },
    };
    expect(hasSeatFolded(1, 'preflop', STREETS, seatActions, isFoldAction)).toBe(false);
  });
});

describe('getFirstActionSeat', () => {
  describe('preflop', () => {
    it('returns seat after big blind (UTG)', () => {
      // Dealer=1, SB=2, BB=3, UTG=4
      const result = getFirstActionSeat('preflop', 1, [], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(4);
    });

    it('returns correct UTG for different dealer positions', () => {
      expect(getFirstActionSeat('preflop', 5, [], {}, STREETS, isFoldAction, 9)).toBe(8);
      expect(getFirstActionSeat('preflop', 7, [], {}, STREETS, isFoldAction, 9)).toBe(1);
      expect(getFirstActionSeat('preflop', 9, [], {}, STREETS, isFoldAction, 9)).toBe(3);
    });

    it('skips absent seats after BB', () => {
      // Dealer=1, SB=2, BB=3, skip 4, UTG=5
      const result = getFirstActionSeat('preflop', 1, [4], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(5);
    });

    it('wraps around while skipping absent seats', () => {
      // Dealer=8, SB=9, BB=1, skip 2, UTG=3
      const result = getFirstActionSeat('preflop', 8, [2], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(3);
    });

    it('skips multiple absent seats', () => {
      // Dealer=1, SB=2, BB=3, skip 4,5,6, UTG=7
      const result = getFirstActionSeat('preflop', 1, [4, 5, 6], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(7);
    });

    it('does not check fold status preflop (no prior streets)', () => {
      const seatActions = {
        preflop: { 4: ['fold'] },
      };
      // Should still return seat 4 as first to act, even if they folded (illogical but follows function logic)
      const result = getFirstActionSeat('preflop', 1, [], seatActions, STREETS, isFoldAction, 9);
      expect(result).toBe(4);
    });
  });

  describe('postflop (flop, turn, river)', () => {
    it('returns first seat after dealer (flop)', () => {
      // Dealer=1, first to act=2
      const result = getFirstActionSeat('flop', 1, [], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(2);
    });

    it('returns correct first action seat for different dealers', () => {
      expect(getFirstActionSeat('flop', 5, [], {}, STREETS, isFoldAction, 9)).toBe(6);
      expect(getFirstActionSeat('turn', 9, [], {}, STREETS, isFoldAction, 9)).toBe(1);
      expect(getFirstActionSeat('river', 3, [], {}, STREETS, isFoldAction, 9)).toBe(4);
    });

    it('skips absent seats after dealer', () => {
      // Dealer=5, skip 6, first=7
      const result = getFirstActionSeat('flop', 5, [6], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(7);
    });

    it('skips folded seats after dealer', () => {
      const seatActions = {
        preflop: { 2: ['fold'] },
      };
      // Dealer=1, seat 2 folded preflop, first=3
      const result = getFirstActionSeat('flop', 1, [], seatActions, STREETS, isFoldAction, 9);
      expect(result).toBe(3);
    });

    it('skips both absent and folded seats', () => {
      const seatActions = {
        preflop: { 3: ['fold'] },
        flop: { 4: ['fold_to_cbet'] },
      };
      // Dealer=1, skip 2 (absent), skip 3 (folded preflop), skip 4 (folded flop), first=5
      const result = getFirstActionSeat('turn', 1, [2], seatActions, STREETS, isFoldAction, 9);
      expect(result).toBe(5);
    });

    it('wraps around table', () => {
      // Dealer=9, first=1
      const result = getFirstActionSeat('flop', 9, [], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(1);
    });

    it('wraps while skipping inactive seats', () => {
      const seatActions = {
        preflop: { 1: ['fold'], 2: ['fold'] },
      };
      // Dealer=9, skip 1,2 (folded), first=3
      const result = getFirstActionSeat('flop', 9, [], seatActions, STREETS, isFoldAction, 9);
      expect(result).toBe(3);
    });

    it('returns fallback (1) if all seats are inactive', () => {
      const allFolded = {};
      for (let seat = 1; seat <= 9; seat++) {
        allFolded[seat] = ['fold'];
      }
      const seatActions = { preflop: allFolded };
      const result = getFirstActionSeat('flop', 5, [], seatActions, STREETS, isFoldAction, 9);
      expect(result).toBe(1);
    });

    it('works on showdown street', () => {
      const result = getFirstActionSeat('showdown', 5, [], {}, STREETS, isFoldAction, 9);
      expect(result).toBe(6);
    });
  });
});

describe('getNextActionSeat', () => {
  it('returns next active seat after current', () => {
    expect(getNextActionSeat(1, [], 'flop', {}, STREETS, isFoldAction, 9)).toBe(2);
    expect(getNextActionSeat(5, [], 'turn', {}, STREETS, isFoldAction, 9)).toBe(6);
  });

  it('wraps from seat 9 to seat 1', () => {
    expect(getNextActionSeat(9, [], 'river', {}, STREETS, isFoldAction, 9)).toBe(1);
  });

  it('skips absent seats', () => {
    expect(getNextActionSeat(1, [2], 'flop', {}, STREETS, isFoldAction, 9)).toBe(3);
    expect(getNextActionSeat(8, [9, 1], 'turn', {}, STREETS, isFoldAction, 9)).toBe(2);
  });

  it('skips folded seats', () => {
    const seatActions = {
      preflop: { 2: ['fold'] },
    };
    expect(getNextActionSeat(1, [], 'flop', seatActions, STREETS, isFoldAction, 9)).toBe(3);
  });

  it('skips both absent and folded seats', () => {
    const seatActions = {
      preflop: { 3: ['fold'], 5: ['fold'] },
    };
    // From seat 2, skip 3 (folded), skip 4 (absent), skip 5 (folded), next=6
    expect(getNextActionSeat(2, [4], 'flop', seatActions, STREETS, isFoldAction, 9)).toBe(6);
  });

  it('checks fold status on current and previous streets', () => {
    const seatActions = {
      preflop: { 3: ['fold'] },
      flop: { 4: ['fold_to_cbet'] },
    };
    // From seat 2, skip 3 (folded preflop), skip 4 (folded flop), next=5
    expect(getNextActionSeat(2, [], 'turn', seatActions, STREETS, isFoldAction, 9)).toBe(5);
  });

  it('wraps while skipping inactive seats', () => {
    const seatActions = {
      preflop: { 1: ['fold'], 2: ['fold'] },
    };
    // From seat 9, skip 1, skip 2, next=3
    expect(getNextActionSeat(9, [], 'flop', seatActions, STREETS, isFoldAction, 9)).toBe(3);
  });

  it('returns null if all seats are inactive', () => {
    const allFolded = {};
    for (let seat = 1; seat <= 9; seat++) {
      allFolded[seat] = ['fold'];
    }
    const seatActions = { preflop: allFolded };
    expect(getNextActionSeat(5, [], 'flop', seatActions, STREETS, isFoldAction, 9)).toBe(null);
  });

  it('returns null if all seats are absent', () => {
    const allSeats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(getNextActionSeat(5, allSeats, 'flop', {}, STREETS, isFoldAction, 9)).toBe(null);
  });

  it('works on preflop street', () => {
    expect(getNextActionSeat(4, [], 'preflop', {}, STREETS, isFoldAction, 9)).toBe(5);
  });

  it('works on showdown street', () => {
    const seatActions = {
      preflop: { 3: ['fold'] },
    };
    // From seat 2, skip 3 (folded), next=4
    expect(getNextActionSeat(2, [], 'showdown', seatActions, STREETS, isFoldAction, 9)).toBe(4);
  });
});

describe('findClosestSeat', () => {
  const mockSeatPositions = [
    { seat: 1, x: 50, y: 10 },
    { seat: 2, x: 25, y: 30 },
    { seat: 3, x: 10, y: 50 },
    { seat: 4, x: 10, y: 70 },
    { seat: 5, x: 25, y: 90 },
    { seat: 6, x: 50, y: 110 },
    { seat: 7, x: 75, y: 90 },
    { seat: 8, x: 90, y: 70 },
    { seat: 9, x: 90, y: 50 },
  ];

  const rect = { width: 1000, height: 1000 };

  it('finds closest seat to given coordinates', () => {
    // Click near seat 1 (50%, 10%) → (500, 100)
    expect(findClosestSeat(500, 100, mockSeatPositions, rect, [])).toBe(1);

    // Click near seat 5 (25%, 90%) → (250, 900)
    expect(findClosestSeat(250, 900, mockSeatPositions, rect, [])).toBe(5);
  });

  it('calculates distance using Euclidean formula', () => {
    // Click exactly at seat 3 (10%, 50%) → (100, 500)
    expect(findClosestSeat(100, 500, mockSeatPositions, rect, [])).toBe(3);
  });

  it('skips absent seats when finding closest', () => {
    // Click near seat 1 (500, 100), but seat 1 is absent → should pick seat 2 or 9
    const result = findClosestSeat(500, 100, mockSeatPositions, rect, [1]);
    expect(result).not.toBe(1);
    expect([2, 9]).toContain(result); // Either seat 2 or 9 is closer
  });

  it('skips multiple absent seats', () => {
    // Click near center, seats 3,4,5,6 absent
    const absentSeats = [3, 4, 5, 6];
    const result = findClosestSeat(500, 500, mockSeatPositions, rect, absentSeats);
    expect(absentSeats).not.toContain(result);
  });

  it('handles all seats absent except one', () => {
    const allButSeat7 = [1, 2, 3, 4, 5, 6, 8, 9];
    expect(findClosestSeat(750, 900, mockSeatPositions, rect, allButSeat7)).toBe(7);
  });

  it('scales positions based on rect dimensions', () => {
    // Seat 6 at (50%, 110%) with rect 2000x2000 → (1000, 2200)
    const largeRect = { width: 2000, height: 2000 };
    expect(findClosestSeat(1000, 2200, mockSeatPositions, largeRect, [])).toBe(6);
  });

  it('returns seat 1 as default if no closer seat found', () => {
    // This tests the initialization of closestSeat = 1
    const farAwayPositions = mockSeatPositions.map(p => ({ ...p, x: 0, y: 0 }));
    const result = findClosestSeat(9999, 9999, farAwayPositions, rect, []);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(9);
  });

  it('handles edge case with single seat position', () => {
    const singleSeat = [{ seat: 5, x: 50, y: 50 }];
    expect(findClosestSeat(600, 600, singleSeat, rect, [])).toBe(5);
  });
});

describe('calculateContextMenuPosition', () => {
  const tableOffsetX = 200;
  const tableOffsetY = 50;
  const tableWidth = 900;
  const tableHeight = 450;

  it('calculates menu position with default offsets', () => {
    const seatPosition = { x: 50, y: 10 }; // 50% x, 10% y
    const result = calculateContextMenuPosition(
      seatPosition,
      tableOffsetX,
      tableOffsetY,
      tableWidth,
      tableHeight
    );

    // Seat at (50% * 900 + 200, 10% * 450 + 50) = (650, 95)
    // Menu at (650 - 160, 95 - 20) = (490, 75)
    expect(result).toEqual({ x: 490, y: 75 });
  });

  it('calculates menu position with custom offsets', () => {
    const seatPosition = { x: 25, y: 30 };
    const result = calculateContextMenuPosition(
      seatPosition,
      tableOffsetX,
      tableOffsetY,
      tableWidth,
      tableHeight,
      -100,
      -50
    );

    // Seat at (25% * 900 + 200, 30% * 450 + 50) = (425, 185)
    // Menu at (425 - 100, 185 - 50) = (325, 135)
    expect(result).toEqual({ x: 325, y: 135 });
  });

  it('handles seat at top-left corner', () => {
    const seatPosition = { x: 0, y: 0 };
    const result = calculateContextMenuPosition(
      seatPosition,
      tableOffsetX,
      tableOffsetY,
      tableWidth,
      tableHeight
    );

    // Seat at (0% * 900 + 200, 0% * 450 + 50) = (200, 50)
    // Menu at (200 - 160, 50 - 20) = (40, 30)
    expect(result).toEqual({ x: 40, y: 30 });
  });

  it('handles seat at bottom-right corner', () => {
    const seatPosition = { x: 100, y: 100 };
    const result = calculateContextMenuPosition(
      seatPosition,
      tableOffsetX,
      tableOffsetY,
      tableWidth,
      tableHeight
    );

    // Seat at (100% * 900 + 200, 100% * 450 + 50) = (1100, 500)
    // Menu at (1100 - 160, 500 - 20) = (940, 480)
    expect(result).toEqual({ x: 940, y: 480 });
  });

  it('handles different table dimensions', () => {
    const seatPosition = { x: 50, y: 50 };
    const result = calculateContextMenuPosition(
      seatPosition,
      0,
      0,
      1600,
      720,
      -200,
      -30
    );

    // Seat at (50% * 1600 + 0, 50% * 720 + 0) = (800, 360)
    // Menu at (800 - 200, 360 - 30) = (600, 330)
    expect(result).toEqual({ x: 600, y: 330 });
  });

  it('can position menu to the right with positive offset', () => {
    const seatPosition = { x: 50, y: 50 };
    const result = calculateContextMenuPosition(
      seatPosition,
      tableOffsetX,
      tableOffsetY,
      tableWidth,
      tableHeight,
      50, // Positive offset moves right
      -20
    );

    // Seat at (50% * 900 + 200, 50% * 450 + 50) = (650, 275)
    // Menu at (650 + 50, 275 - 20) = (700, 255)
    expect(result).toEqual({ x: 700, y: 255 });
  });

  it('handles zero offsets', () => {
    const seatPosition = { x: 50, y: 50 };
    const result = calculateContextMenuPosition(
      seatPosition,
      tableOffsetX,
      tableOffsetY,
      tableWidth,
      tableHeight,
      0,
      0
    );

    // Seat at (50% * 900 + 200, 50% * 450 + 50) = (650, 275)
    // Menu at (650, 275)
    expect(result).toEqual({ x: 650, y: 275 });
  });
});
