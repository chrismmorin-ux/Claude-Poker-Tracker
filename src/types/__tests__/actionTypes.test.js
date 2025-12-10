/**
 * actionTypes.test.js - Tests for action sequence type definitions
 */

import { describe, it, expect } from 'vitest';
import {
  STREETS,
  createActionEntry,
  createEmptySequence,
  isValidActionEntry,
  getNextOrder,
  getActionsByStreet,
  getActionsBySeat,
  getLastAction,
  getLastActionOnStreet,
  getBetLevel,
  hasAggressionOnStreet,
} from '../actionTypes';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

describe('actionTypes', () => {
  describe('STREETS', () => {
    it('has all 5 poker streets in order', () => {
      expect(STREETS).toEqual(['preflop', 'flop', 'turn', 'river', 'showdown']);
    });
  });

  describe('createActionEntry', () => {
    it('creates an action entry with all required fields', () => {
      const entry = createActionEntry({
        seat: 3,
        action: PRIMITIVE_ACTIONS.RAISE,
        street: 'preflop',
        order: 1,
      });

      expect(entry.seat).toBe(3);
      expect(entry.action).toBe('raise');
      expect(entry.street).toBe('preflop');
      expect(entry.order).toBe(1);
      expect(typeof entry.timestamp).toBe('number');
    });

    it('adds timestamp automatically', () => {
      const before = Date.now();
      const entry = createActionEntry({
        seat: 1,
        action: PRIMITIVE_ACTIONS.FOLD,
        street: 'flop',
        order: 5,
      });
      const after = Date.now();

      expect(entry.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('createEmptySequence', () => {
    it('returns an empty array', () => {
      expect(createEmptySequence()).toEqual([]);
    });
  });

  describe('isValidActionEntry', () => {
    it('returns true for valid entry', () => {
      const entry = {
        seat: 5,
        action: PRIMITIVE_ACTIONS.CALL,
        street: 'preflop',
        order: 3,
      };
      expect(isValidActionEntry(entry)).toBe(true);
    });

    it('returns false for null or undefined', () => {
      expect(isValidActionEntry(null)).toBe(false);
      expect(isValidActionEntry(undefined)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isValidActionEntry('string')).toBe(false);
      expect(isValidActionEntry(123)).toBe(false);
    });

    it('returns false for invalid seat', () => {
      expect(isValidActionEntry({ seat: 0, action: 'fold', street: 'preflop', order: 1 })).toBe(false);
      expect(isValidActionEntry({ seat: 10, action: 'fold', street: 'preflop', order: 1 })).toBe(false);
      expect(isValidActionEntry({ seat: 'a', action: 'fold', street: 'preflop', order: 1 })).toBe(false);
    });

    it('returns false for invalid action', () => {
      expect(isValidActionEntry({ seat: 1, action: 'invalid', street: 'preflop', order: 1 })).toBe(false);
      expect(isValidActionEntry({ seat: 1, action: '3bet', street: 'preflop', order: 1 })).toBe(false);
    });

    it('returns false for invalid street', () => {
      expect(isValidActionEntry({ seat: 1, action: 'fold', street: 'invalid', order: 1 })).toBe(false);
    });

    it('returns false for invalid order', () => {
      expect(isValidActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: 0 })).toBe(false);
      expect(isValidActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: -1 })).toBe(false);
      expect(isValidActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: 1.5 })).toBe(false);
    });
  });

  describe('getNextOrder', () => {
    it('returns 1 for empty sequence', () => {
      expect(getNextOrder([])).toBe(1);
    });

    it('returns 1 for null/undefined sequence', () => {
      expect(getNextOrder(null)).toBe(1);
      expect(getNextOrder(undefined)).toBe(1);
    });

    it('returns max order + 1', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 3, action: 'raise', street: 'preflop', order: 3 },
      ];
      expect(getNextOrder(sequence)).toBe(4);
    });
  });

  describe('getActionsByStreet', () => {
    const sequence = [
      { seat: 1, action: 'fold', street: 'preflop', order: 1 },
      { seat: 2, action: 'raise', street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', street: 'flop', order: 3 },
      { seat: 4, action: 'call', street: 'flop', order: 4 },
    ];

    it('returns actions for specified street', () => {
      const preflopActions = getActionsByStreet(sequence, 'preflop');
      expect(preflopActions).toHaveLength(2);
      expect(preflopActions[0].seat).toBe(1);
      expect(preflopActions[1].seat).toBe(2);
    });

    it('returns empty array for street with no actions', () => {
      expect(getActionsByStreet(sequence, 'turn')).toEqual([]);
    });

    it('returns empty array for null sequence', () => {
      expect(getActionsByStreet(null, 'preflop')).toEqual([]);
    });
  });

  describe('getActionsBySeat', () => {
    const sequence = [
      { seat: 1, action: 'fold', street: 'preflop', order: 1 },
      { seat: 2, action: 'raise', street: 'preflop', order: 2 },
      { seat: 2, action: 'bet', street: 'flop', order: 3 },
    ];

    it('returns actions for specified seat', () => {
      const seat2Actions = getActionsBySeat(sequence, 2);
      expect(seat2Actions).toHaveLength(2);
      expect(seat2Actions[0].action).toBe('raise');
      expect(seat2Actions[1].action).toBe('bet');
    });

    it('returns empty array for seat with no actions', () => {
      expect(getActionsBySeat(sequence, 5)).toEqual([]);
    });

    it('returns empty array for null sequence', () => {
      expect(getActionsBySeat(null, 1)).toEqual([]);
    });
  });

  describe('getLastAction', () => {
    it('returns the last action in sequence', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
      ];
      expect(getLastAction(sequence)).toEqual(sequence[1]);
    });

    it('returns null for empty sequence', () => {
      expect(getLastAction([])).toBe(null);
    });

    it('returns null for null sequence', () => {
      expect(getLastAction(null)).toBe(null);
    });
  });

  describe('getLastActionOnStreet', () => {
    const sequence = [
      { seat: 1, action: 'raise', street: 'preflop', order: 1 },
      { seat: 2, action: 'call', street: 'preflop', order: 2 },
      { seat: 1, action: 'bet', street: 'flop', order: 3 },
    ];

    it('returns last action on specified street', () => {
      expect(getLastActionOnStreet(sequence, 'preflop')).toEqual(sequence[1]);
      expect(getLastActionOnStreet(sequence, 'flop')).toEqual(sequence[2]);
    });

    it('returns null for street with no actions', () => {
      expect(getLastActionOnStreet(sequence, 'turn')).toBe(null);
    });
  });

  describe('getBetLevel', () => {
    it('returns 0 for no aggressive actions', () => {
      const sequence = [
        { seat: 1, action: 'check', street: 'flop', order: 1 },
        { seat: 2, action: 'check', street: 'flop', order: 2 },
      ];
      expect(getBetLevel(sequence, 'flop')).toBe(0);
    });

    it('returns 1 for single bet', () => {
      const sequence = [
        { seat: 1, action: 'bet', street: 'flop', order: 1 },
        { seat: 2, action: 'call', street: 'flop', order: 2 },
      ];
      expect(getBetLevel(sequence, 'flop')).toBe(1);
    });

    it('returns 2 for bet + raise', () => {
      const sequence = [
        { seat: 1, action: 'bet', street: 'flop', order: 1 },
        { seat: 2, action: 'raise', street: 'flop', order: 2 },
      ];
      expect(getBetLevel(sequence, 'flop')).toBe(2);
    });

    it('counts preflop raises correctly', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 }, // Open
        { seat: 2, action: 'raise', street: 'preflop', order: 2 }, // 3bet
        { seat: 1, action: 'raise', street: 'preflop', order: 3 }, // 4bet
      ];
      expect(getBetLevel(sequence, 'preflop')).toBe(3);
    });

    it('only counts actions on specified street', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 1, action: 'bet', street: 'flop', order: 3 },
      ];
      expect(getBetLevel(sequence, 'preflop')).toBe(1);
      expect(getBetLevel(sequence, 'flop')).toBe(1);
    });
  });

  describe('hasAggressionOnStreet', () => {
    it('returns false for no aggressive actions', () => {
      const sequence = [
        { seat: 1, action: 'check', street: 'flop', order: 1 },
        { seat: 2, action: 'check', street: 'flop', order: 2 },
      ];
      expect(hasAggressionOnStreet(sequence, 'flop')).toBe(false);
    });

    it('returns true for bet', () => {
      const sequence = [
        { seat: 1, action: 'bet', street: 'flop', order: 1 },
      ];
      expect(hasAggressionOnStreet(sequence, 'flop')).toBe(true);
    });

    it('returns true for raise', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
      ];
      expect(hasAggressionOnStreet(sequence, 'preflop')).toBe(true);
    });

    it('returns false for empty sequence', () => {
      expect(hasAggressionOnStreet([], 'flop')).toBe(false);
    });
  });
});
