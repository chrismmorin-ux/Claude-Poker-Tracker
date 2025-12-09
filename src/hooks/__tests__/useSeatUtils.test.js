/**
 * useSeatUtils.test.js - Tests for seat utilities hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeatUtils } from '../useSeatUtils';
import { ACTIONS, STREETS } from '../../test/utils';

describe('useSeatUtils', () => {
  const defaultParams = {
    currentStreet: 'preflop',
    dealerButtonSeat: 1,
    absentSeats: [],
    seatActions: {},
    numSeats: 9,
  };

  const createHook = (overrides = {}) => {
    const params = { ...defaultParams, ...overrides };
    return renderHook(() =>
      useSeatUtils(
        params.currentStreet,
        params.dealerButtonSeat,
        params.absentSeats,
        params.seatActions,
        params.numSeats
      )
    );
  };

  describe('returns all expected functions', () => {
    it('returns getSmallBlindSeat function', () => {
      const { result } = createHook();
      expect(typeof result.current.getSmallBlindSeat).toBe('function');
    });

    it('returns getBigBlindSeat function', () => {
      const { result } = createHook();
      expect(typeof result.current.getBigBlindSeat).toBe('function');
    });

    it('returns hasSeatFolded function', () => {
      const { result } = createHook();
      expect(typeof result.current.hasSeatFolded).toBe('function');
    });

    it('returns getFirstActionSeat function', () => {
      const { result } = createHook();
      expect(typeof result.current.getFirstActionSeat).toBe('function');
    });

    it('returns getNextActionSeat function', () => {
      const { result } = createHook();
      expect(typeof result.current.getNextActionSeat).toBe('function');
    });
  });

  describe('getSmallBlindSeat', () => {
    it('returns seat after dealer', () => {
      const { result } = createHook({ dealerButtonSeat: 1 });
      expect(result.current.getSmallBlindSeat()).toBe(2);
    });

    it('wraps from seat 9 to seat 1', () => {
      const { result } = createHook({ dealerButtonSeat: 9 });
      expect(result.current.getSmallBlindSeat()).toBe(1);
    });

    it('skips absent seats', () => {
      const { result } = createHook({ dealerButtonSeat: 1, absentSeats: [2] });
      expect(result.current.getSmallBlindSeat()).toBe(3);
    });

    it('skips multiple absent seats', () => {
      const { result } = createHook({ dealerButtonSeat: 1, absentSeats: [2, 3, 4] });
      expect(result.current.getSmallBlindSeat()).toBe(5);
    });
  });

  describe('getBigBlindSeat', () => {
    it('returns seat two positions after dealer', () => {
      const { result } = createHook({ dealerButtonSeat: 1 });
      expect(result.current.getBigBlindSeat()).toBe(3);
    });

    it('wraps from seat 9 correctly', () => {
      const { result } = createHook({ dealerButtonSeat: 8 });
      expect(result.current.getBigBlindSeat()).toBe(1);
    });

    it('skips absent SB to find BB', () => {
      const { result } = createHook({ dealerButtonSeat: 1, absentSeats: [2] });
      expect(result.current.getBigBlindSeat()).toBe(4);
    });
  });

  describe('hasSeatFolded', () => {
    it('returns false when seat has no actions', () => {
      const { result } = createHook();
      expect(result.current.hasSeatFolded(5)).toBe(false);
    });

    it('returns true when seat has folded on preflop', () => {
      const { result } = createHook({
        currentStreet: 'preflop',
        seatActions: {
          preflop: { 5: [ACTIONS.FOLD] },
        },
      });
      expect(result.current.hasSeatFolded(5)).toBe(true);
    });

    it('returns true when seat folded on earlier street', () => {
      const { result } = createHook({
        currentStreet: 'flop',
        seatActions: {
          preflop: { 5: [ACTIONS.FOLD] },
          flop: {},
        },
      });
      expect(result.current.hasSeatFolded(5)).toBe(true);
    });

    it('returns false when seat called but did not fold', () => {
      const { result } = createHook({
        currentStreet: 'preflop',
        seatActions: {
          preflop: { 5: [ACTIONS.CALL] },
        },
      });
      expect(result.current.hasSeatFolded(5)).toBe(false);
    });

    it('returns false for MUCK action (muck is not a fold)', () => {
      const { result } = createHook({
        currentStreet: 'showdown',
        seatActions: {
          showdown: { 5: [ACTIONS.MUCKED] },
        },
      });
      // MUCK is not in FOLD_ACTIONS, so it doesn't count as folded
      expect(result.current.hasSeatFolded(5)).toBe(false);
    });
  });

  describe('getFirstActionSeat', () => {
    it('returns UTG on preflop (3 seats after dealer)', () => {
      const { result } = createHook({ dealerButtonSeat: 1 });
      expect(result.current.getFirstActionSeat()).toBe(4);
    });

    it('returns SB on flop (1 seat after dealer)', () => {
      const { result } = createHook({ dealerButtonSeat: 1, currentStreet: 'flop' });
      expect(result.current.getFirstActionSeat()).toBe(2);
    });

    it('skips absent seats', () => {
      const { result } = createHook({
        dealerButtonSeat: 1,
        currentStreet: 'flop',
        absentSeats: [2],
      });
      expect(result.current.getFirstActionSeat()).toBe(3);
    });

    it('skips folded seats', () => {
      const { result } = createHook({
        dealerButtonSeat: 1,
        currentStreet: 'flop',
        seatActions: {
          preflop: { 2: [ACTIONS.FOLD] },
          flop: {},
        },
      });
      expect(result.current.getFirstActionSeat()).toBe(3);
    });
  });

  describe('getNextActionSeat', () => {
    it('returns next active seat', () => {
      const { result } = createHook();
      expect(result.current.getNextActionSeat(1)).toBe(2);
    });

    it('wraps from seat 9 to seat 1', () => {
      const { result } = createHook();
      expect(result.current.getNextActionSeat(9)).toBe(1);
    });

    it('skips absent seats', () => {
      const { result } = createHook({ absentSeats: [2, 3] });
      expect(result.current.getNextActionSeat(1)).toBe(4);
    });

    it('skips folded seats', () => {
      const { result } = createHook({
        currentStreet: 'flop',
        seatActions: {
          preflop: { 2: [ACTIONS.FOLD] },
          flop: {},
        },
      });
      expect(result.current.getNextActionSeat(1)).toBe(3);
    });
  });

  describe('hook updates when dependencies change', () => {
    it('updates getSmallBlindSeat when dealer changes', () => {
      const { result, rerender } = renderHook(
        ({ dealer }) => useSeatUtils('preflop', dealer, [], {}, 9),
        { initialProps: { dealer: 1 } }
      );

      expect(result.current.getSmallBlindSeat()).toBe(2);

      rerender({ dealer: 5 });

      expect(result.current.getSmallBlindSeat()).toBe(6);
    });

    it('updates hasSeatFolded when seatActions change', () => {
      const { result, rerender } = renderHook(
        ({ seatActions }) => useSeatUtils('preflop', 1, [], seatActions, 9),
        { initialProps: { seatActions: {} } }
      );

      expect(result.current.hasSeatFolded(5)).toBe(false);

      rerender({ seatActions: { preflop: { 5: [ACTIONS.FOLD] } } });

      expect(result.current.hasSeatFolded(5)).toBe(true);
    });

    it('updates when absentSeats change', () => {
      const { result, rerender } = renderHook(
        ({ absent }) => useSeatUtils('preflop', 1, absent, {}, 9),
        { initialProps: { absent: [] } }
      );

      expect(result.current.getSmallBlindSeat()).toBe(2);

      rerender({ absent: [2] });

      expect(result.current.getSmallBlindSeat()).toBe(3);
    });
  });

  describe('function stability', () => {
    it('getSmallBlindSeat is stable when deps unchanged', () => {
      const { result, rerender } = createHook();
      const first = result.current.getSmallBlindSeat;
      rerender();
      expect(result.current.getSmallBlindSeat).toBe(first);
    });

    it('getBigBlindSeat is stable when deps unchanged', () => {
      const { result, rerender } = createHook();
      const first = result.current.getBigBlindSeat;
      rerender();
      expect(result.current.getBigBlindSeat).toBe(first);
    });
  });
});
