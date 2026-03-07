/**
 * actionUtils.primitives.test.js - Tests for primitive action utility functions
 */

import { describe, it, expect } from 'vitest';
import { getValidActions } from '../actionUtils';
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
    it('returns CALL, RAISE, FOLD regardless of hasBet (blinds are forced bets)', () => {
      expect(getValidActions('preflop', false, false)).toEqual([CALL, RAISE, FOLD]);
      expect(getValidActions('preflop', true, false)).toEqual([CALL, RAISE, FOLD]);
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
