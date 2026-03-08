// @vitest-environment jsdom
/**
 * useSeatUtils.test.js - Tests for seat utilities hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeatUtils } from '../useSeatUtils';
import { ACTIONS } from '../../test/utils';

// Helper to create actionSequence entries
const entry = (seat, action, street = 'preflop', order = 1) => ({
  seat, action, street, order,
});

describe('useSeatUtils', () => {
  const defaultParams = {
    currentStreet: 'preflop',
    dealerButtonSeat: 1,
    absentSeats: [],
    actionSequence: [],
    numSeats: 9,
  };

  const createHook = (overrides = {}) => {
    const params = { ...defaultParams, ...overrides };
    return renderHook(() =>
      useSeatUtils(
        params.currentStreet,
        params.dealerButtonSeat,
        params.absentSeats,
        params.actionSequence,
        params.numSeats
      )
    );
  };

  describe('returns all expected values and functions', () => {
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

  describe('hasSeatFolded', () => {
    it('returns false when seat has no actions', () => {
      const { result } = createHook();
      expect(result.current.hasSeatFolded(5)).toBe(false);
    });

    it('returns true when seat has folded on preflop', () => {
      const { result } = createHook({
        currentStreet: 'preflop',
        actionSequence: [entry(5, ACTIONS.FOLD, 'preflop')],
      });
      expect(result.current.hasSeatFolded(5)).toBe(true);
    });

    it('returns true when seat folded on earlier street', () => {
      const { result } = createHook({
        currentStreet: 'flop',
        actionSequence: [entry(5, ACTIONS.FOLD, 'preflop')],
      });
      expect(result.current.hasSeatFolded(5)).toBe(true);
    });

    it('returns false when seat called but did not fold', () => {
      const { result } = createHook({
        currentStreet: 'preflop',
        actionSequence: [entry(5, 'call', 'preflop')],
      });
      expect(result.current.hasSeatFolded(5)).toBe(false);
    });

    it('returns false for MUCK action (muck is not a fold)', () => {
      const { result } = createHook({
        currentStreet: 'showdown',
        actionSequence: [entry(5, ACTIONS.MUCKED, 'showdown')],
      });
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
        actionSequence: [entry(2, ACTIONS.FOLD, 'preflop')],
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
        actionSequence: [entry(2, ACTIONS.FOLD, 'preflop')],
      });
      expect(result.current.getNextActionSeat(1)).toBe(3);
    });
  });

  describe('hook updates when dependencies change', () => {
    it('updates hasSeatFolded when actionSequence changes', () => {
      const { result, rerender } = renderHook(
        ({ actionSequence }) => useSeatUtils('preflop', 1, [], actionSequence, 9),
        { initialProps: { actionSequence: [] } }
      );

      expect(result.current.hasSeatFolded(5)).toBe(false);

      rerender({ actionSequence: [entry(5, ACTIONS.FOLD, 'preflop')] });

      expect(result.current.hasSeatFolded(5)).toBe(true);
    });
  });
});
