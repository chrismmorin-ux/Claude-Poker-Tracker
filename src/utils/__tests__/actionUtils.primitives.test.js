/**
 * actionUtils.primitives.test.js - Tests for primitive action utility functions
 */

import { describe, it, expect } from 'vitest';
import { getValidActions, hasBetOnStreet } from '../actionUtils';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

const { CHECK, BET, CALL, RAISE, FOLD } = PRIMITIVE_ACTIONS;

describe('getValidActions', () => {
  describe('multi-seat mode', () => {
    it('returns all 5 actions regardless of street or bet state', () => {
      expect(getValidActions('preflop', false, true)).toEqual([CHECK, BET, CALL, RAISE, FOLD]);
      expect(getValidActions('flop', true, true)).toEqual([CHECK, BET, CALL, RAISE, FOLD]);
      expect(getValidActions('river', false, true)).toEqual([CHECK, BET, CALL, RAISE, FOLD]);
    });
  });

  describe('preflop (single seat)', () => {
    it('returns CHECK, CALL, RAISE, FOLD regardless of hasBet', () => {
      expect(getValidActions('preflop', false, false)).toEqual([CHECK, CALL, RAISE, FOLD]);
      expect(getValidActions('preflop', true, false)).toEqual([CHECK, CALL, RAISE, FOLD]);
    });
  });

  describe('postflop with no bet (single seat)', () => {
    it('returns CHECK, BET, FOLD on flop', () => {
      expect(getValidActions('flop', false, false)).toEqual([CHECK, BET, FOLD]);
    });

    it('returns CHECK, BET, FOLD on turn', () => {
      expect(getValidActions('turn', false, false)).toEqual([CHECK, BET, FOLD]);
    });

    it('returns CHECK, BET, FOLD on river', () => {
      expect(getValidActions('river', false, false)).toEqual([CHECK, BET, FOLD]);
    });
  });

  describe('postflop with bet (single seat)', () => {
    it('returns CALL, RAISE, FOLD on flop', () => {
      expect(getValidActions('flop', true, false)).toEqual([CALL, RAISE, FOLD]);
    });

    it('returns CALL, RAISE, FOLD on turn', () => {
      expect(getValidActions('turn', true, false)).toEqual([CALL, RAISE, FOLD]);
    });

    it('returns CALL, RAISE, FOLD on river', () => {
      expect(getValidActions('river', true, false)).toEqual([CALL, RAISE, FOLD]);
    });
  });
});

describe('hasBetOnStreet', () => {
  it('returns false for null/undefined seatActions', () => {
    expect(hasBetOnStreet(null, 'flop')).toBe(false);
    expect(hasBetOnStreet(undefined, 'flop')).toBe(false);
  });

  it('returns false when street has no actions', () => {
    expect(hasBetOnStreet({}, 'flop')).toBe(false);
    expect(hasBetOnStreet({ preflop: {} }, 'flop')).toBe(false);
  });

  it('returns false when only checks and calls on street', () => {
    const seatActions = {
      flop: {
        1: [CHECK],
        2: [CALL],
        3: [CHECK],
      },
    };
    expect(hasBetOnStreet(seatActions, 'flop')).toBe(false);
  });

  it('returns true when a bet exists on street', () => {
    const seatActions = {
      flop: {
        1: [CHECK],
        2: [BET],
      },
    };
    expect(hasBetOnStreet(seatActions, 'flop')).toBe(true);
  });

  it('returns true when a raise exists on street', () => {
    const seatActions = {
      flop: {
        1: [BET],
        2: [RAISE],
      },
    };
    expect(hasBetOnStreet(seatActions, 'flop')).toBe(true);
  });

  it('returns false for a different street', () => {
    const seatActions = {
      flop: {
        1: [BET],
      },
    };
    expect(hasBetOnStreet(seatActions, 'turn')).toBe(false);
  });

  it('handles single action values (non-array)', () => {
    const seatActions = {
      flop: {
        1: [FOLD],
        2: [CHECK],
      },
    };
    expect(hasBetOnStreet(seatActions, 'flop')).toBe(false);
  });

  it('detects bet in multi-action sequences', () => {
    const seatActions = {
      flop: {
        1: [CHECK, RAISE],
        2: [BET],
      },
    };
    expect(hasBetOnStreet(seatActions, 'flop')).toBe(true);
  });
});
