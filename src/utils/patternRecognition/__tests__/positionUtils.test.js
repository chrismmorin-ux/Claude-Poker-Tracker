/**
 * positionUtils.test.js - Tests for position utilities
 */
import { describe, it, expect } from 'vitest';
import {
  POSITION_NAMES,
  POSITION_CATEGORIES,
  getPositionName,
  getSeatForPosition,
  isInPosition,
  isOutOfPosition,
  getPositionCategory,
  isBlindPosition,
  getPreflopOrder,
  getPostflopOrder,
  isEarlyPosition,
  isLatePosition,
} from '../positionUtils';

describe('positionUtils', () => {
  describe('getPositionName', () => {
    it('returns BTN for button seat', () => {
      expect(getPositionName(5, 5)).toBe('BTN');
    });

    it('returns SB for seat after button', () => {
      expect(getPositionName(6, 5)).toBe('SB');
    });

    it('returns BB for seat two after button', () => {
      expect(getPositionName(7, 5)).toBe('BB');
    });

    it('handles wrap-around correctly', () => {
      // Button at seat 8
      expect(getPositionName(9, 8)).toBe('SB');
      expect(getPositionName(1, 8)).toBe('BB');
      expect(getPositionName(2, 8)).toBe('UTG');
    });

    it('returns all 9 positions correctly', () => {
      const buttonSeat = 1;
      const expected = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO'];

      for (let i = 0; i < 9; i++) {
        const seat = ((buttonSeat - 1 + i) % 9) + 1;
        expect(getPositionName(seat, buttonSeat)).toBe(expected[i]);
      }
    });

    it('returns Unknown for invalid seat', () => {
      expect(getPositionName(0, 1)).toBe('Unknown');
      expect(getPositionName(10, 1)).toBe('Unknown');
      expect(getPositionName(null, 1)).toBe('Unknown');
    });

    it('returns Unknown for invalid button', () => {
      expect(getPositionName(1, 0)).toBe('Unknown');
      expect(getPositionName(1, 10)).toBe('Unknown');
      expect(getPositionName(1, null)).toBe('Unknown');
    });
  });

  describe('getSeatForPosition', () => {
    it('returns correct seat for BTN', () => {
      expect(getSeatForPosition('BTN', 5)).toBe(5);
    });

    it('returns correct seat for SB', () => {
      expect(getSeatForPosition('SB', 5)).toBe(6);
    });

    it('returns correct seat for BB with wrap-around', () => {
      expect(getSeatForPosition('BB', 8)).toBe(1);
    });

    it('returns null for invalid position', () => {
      expect(getSeatForPosition('INVALID', 5)).toBe(null);
      expect(getSeatForPosition(null, 5)).toBe(null);
    });

    it('returns null for invalid button', () => {
      expect(getSeatForPosition('BTN', null)).toBe(null);
    });

    it('is inverse of getPositionName', () => {
      const buttonSeat = 3;
      POSITION_NAMES.forEach(posName => {
        const seat = getSeatForPosition(posName, buttonSeat);
        expect(getPositionName(seat, buttonSeat)).toBe(posName);
      });
    });
  });

  describe('isInPosition', () => {
    // Button at seat 5
    // Postflop order: 6(SB), 7(BB), 8, 9, 1, 2, 3, 4, 5(BTN)

    it('BTN is in position vs SB', () => {
      expect(isInPosition(5, 6, 5)).toBe(true);
    });

    it('BTN is in position vs BB', () => {
      expect(isInPosition(5, 7, 5)).toBe(true);
    });

    it('SB is out of position vs BTN', () => {
      expect(isInPosition(6, 5, 5)).toBe(false);
    });

    it('BB is out of position vs BTN', () => {
      expect(isInPosition(7, 5, 5)).toBe(false);
    });

    it('CO is in position vs HJ', () => {
      // With button at 5: HJ=3, CO=4
      expect(isInPosition(4, 3, 5)).toBe(true);
    });

    it('returns false when comparing same seat', () => {
      expect(isInPosition(5, 5, 5)).toBe(false);
    });

    it('returns false for invalid inputs', () => {
      expect(isInPosition(null, 5, 5)).toBe(false);
      expect(isInPosition(5, null, 5)).toBe(false);
      expect(isInPosition(5, 5, null)).toBe(false);
    });
  });

  describe('isOutOfPosition', () => {
    it('SB is OOP vs BTN', () => {
      expect(isOutOfPosition(6, 5, 5)).toBe(true);
    });

    it('BTN is not OOP vs SB', () => {
      expect(isOutOfPosition(5, 6, 5)).toBe(false);
    });

    it('returns false for same seat', () => {
      expect(isOutOfPosition(5, 5, 5)).toBe(false);
    });
  });

  describe('getPositionCategory', () => {
    it('categorizes blinds correctly', () => {
      expect(getPositionCategory(6, 5)).toBe('BLINDS'); // SB
      expect(getPositionCategory(7, 5)).toBe('BLINDS'); // BB
    });

    it('categorizes early positions correctly', () => {
      expect(getPositionCategory(8, 5)).toBe('EARLY'); // UTG
      expect(getPositionCategory(9, 5)).toBe('EARLY'); // UTG+1
    });

    it('categorizes middle positions correctly', () => {
      expect(getPositionCategory(1, 5)).toBe('MIDDLE'); // MP1
      expect(getPositionCategory(2, 5)).toBe('MIDDLE'); // MP2
    });

    it('categorizes late positions correctly', () => {
      expect(getPositionCategory(3, 5)).toBe('LATE'); // HJ
      expect(getPositionCategory(4, 5)).toBe('LATE'); // CO
      expect(getPositionCategory(5, 5)).toBe('LATE'); // BTN
    });
  });

  describe('isBlindPosition', () => {
    it('returns true for SB', () => {
      expect(isBlindPosition(6, 5)).toBe(true);
    });

    it('returns true for BB', () => {
      expect(isBlindPosition(7, 5)).toBe(true);
    });

    it('returns false for BTN', () => {
      expect(isBlindPosition(5, 5)).toBe(false);
    });

    it('returns false for UTG', () => {
      expect(isBlindPosition(8, 5)).toBe(false);
    });
  });

  describe('getPreflopOrder', () => {
    it('starts with UTG', () => {
      const order = getPreflopOrder(5);
      expect(getPositionName(order[0], 5)).toBe('UTG');
    });

    it('ends with BB', () => {
      const order = getPreflopOrder(5);
      expect(getPositionName(order[8], 5)).toBe('BB');
    });

    it('has 9 seats', () => {
      expect(getPreflopOrder(5)).toHaveLength(9);
    });

    it('follows correct preflop order', () => {
      const order = getPreflopOrder(1);
      const positions = order.map(seat => getPositionName(seat, 1));
      expect(positions).toEqual(['UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    });
  });

  describe('getPostflopOrder', () => {
    it('starts with SB', () => {
      const order = getPostflopOrder(5);
      expect(getPositionName(order[0], 5)).toBe('SB');
    });

    it('ends with BTN', () => {
      const order = getPostflopOrder(5);
      expect(getPositionName(order[8], 5)).toBe('BTN');
    });

    it('has 9 seats', () => {
      expect(getPostflopOrder(5)).toHaveLength(9);
    });
  });

  describe('isEarlyPosition', () => {
    it('returns true for UTG', () => {
      expect(isEarlyPosition(8, 5)).toBe(true);
    });

    it('returns true for UTG+1', () => {
      expect(isEarlyPosition(9, 5)).toBe(true);
    });

    it('returns true for MP1 (3rd to act)', () => {
      expect(isEarlyPosition(1, 5)).toBe(true);
    });

    it('returns false for MP2', () => {
      expect(isEarlyPosition(2, 5)).toBe(false);
    });

    it('returns false for BTN', () => {
      expect(isEarlyPosition(5, 5)).toBe(false);
    });
  });

  describe('isLatePosition', () => {
    it('returns true for HJ', () => {
      expect(isLatePosition(3, 5)).toBe(true);
    });

    it('returns true for CO', () => {
      expect(isLatePosition(4, 5)).toBe(true);
    });

    it('returns true for BTN', () => {
      expect(isLatePosition(5, 5)).toBe(true);
    });

    it('returns false for UTG', () => {
      expect(isLatePosition(8, 5)).toBe(false);
    });

    it('returns false for blinds', () => {
      expect(isLatePosition(6, 5)).toBe(false); // SB
      expect(isLatePosition(7, 5)).toBe(false); // BB
    });
  });

  describe('POSITION_CATEGORIES', () => {
    it('has all expected categories', () => {
      expect(POSITION_CATEGORIES).toHaveProperty('BLINDS');
      expect(POSITION_CATEGORIES).toHaveProperty('EARLY');
      expect(POSITION_CATEGORIES).toHaveProperty('MIDDLE');
      expect(POSITION_CATEGORIES).toHaveProperty('LATE');
    });

    it('BLINDS contains SB and BB', () => {
      expect(POSITION_CATEGORIES.BLINDS).toContain('SB');
      expect(POSITION_CATEGORIES.BLINDS).toContain('BB');
    });

    it('LATE contains HJ, CO, and BTN', () => {
      expect(POSITION_CATEGORIES.LATE).toContain('HJ');
      expect(POSITION_CATEGORIES.LATE).toContain('CO');
      expect(POSITION_CATEGORIES.LATE).toContain('BTN');
    });
  });
});
