/**
 * potCalculator.test.js - Tests for pot calculation and sizing utilities
 */

import { describe, it, expect } from 'vitest';
import { parseBlinds, calculatePot, getCurrentBet, getSizingOptions } from '../potCalculator';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

describe('parseBlinds', () => {
  it('parses "1/2" correctly', () => {
    expect(parseBlinds('1/2')).toEqual({ sb: 1, bb: 2 });
  });

  it('parses "2/5" correctly', () => {
    expect(parseBlinds('2/5')).toEqual({ sb: 2, bb: 5 });
  });

  it('parses "5/10" correctly', () => {
    expect(parseBlinds('5/10')).toEqual({ sb: 5, bb: 10 });
  });

  it('returns default for null', () => {
    expect(parseBlinds(null)).toEqual({ sb: 1, bb: 2 });
  });

  it('returns default for empty string', () => {
    expect(parseBlinds('')).toEqual({ sb: 1, bb: 2 });
  });

  it('returns default for invalid format', () => {
    expect(parseBlinds('abc')).toEqual({ sb: 1, bb: 2 });
  });
});

describe('calculatePot', () => {
  const blinds = { sb: 1, bb: 2 };

  it('returns SB + BB for empty sequence', () => {
    const result = calculatePot([], blinds);
    expect(result).toEqual({ total: 3, currentBet: 2, isEstimated: false });
  });

  it('returns SB + BB for null sequence', () => {
    const result = calculatePot(null, blinds);
    expect(result).toEqual({ total: 3, currentBet: 2, isEstimated: false });
  });

  it('adds call amount to pot', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 1, amount: 2 },
    ];
    expect(calculatePot(seq, blinds).total).toBe(5); // 3 + 2
  });

  it('uses currentBet for call without amount', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 1 },
    ];
    expect(calculatePot(seq, blinds).total).toBe(5); // 3 + 2 (bb)
  });

  it('adds raise amount and updates currentBet', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
    ];
    const result = calculatePot(seq, blinds);
    expect(result.total).toBe(11); // 3 + 8
    expect(result.currentBet).toBe(8);
    expect(result.isEstimated).toBe(false);
  });

  it('marks as estimated when bet/raise lacks amount', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1 },
    ];
    expect(calculatePot(seq, blinds).isEstimated).toBe(true);
  });

  it('fold and check add nothing', () => {
    const seq = [
      { seat: 3, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop', order: 1 },
      { seat: 4, action: PRIMITIVE_ACTIONS.CHECK, street: 'preflop', order: 2 },
    ];
    expect(calculatePot(seq, blinds).total).toBe(3);
  });

  it('handles multi-street hand', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', order: 2, amount: 8 },
      // Flop: currentBet resets to 0
      { seat: 4, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 3, amount: 10 },
      { seat: 5, action: PRIMITIVE_ACTIONS.CALL, street: 'flop', order: 4, amount: 10 },
    ];
    // 3 (blinds) + 8 + 8 + 10 + 10 = 39
    expect(calculatePot(seq, blinds).total).toBe(39);
  });

  it('resets currentBet on street change', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.CHECK, street: 'flop', order: 2 },
    ];
    const result = calculatePot(seq, blinds);
    expect(result.currentBet).toBe(0); // Reset on flop
  });
});

describe('getCurrentBet', () => {
  it('returns 0 for no actions', () => {
    expect(getCurrentBet([], 'preflop')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(getCurrentBet(null, 'preflop')).toBe(0);
  });

  it('returns last bet/raise amount on street', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 5, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 2, amount: 24 },
    ];
    expect(getCurrentBet(seq, 'preflop')).toBe(24);
  });

  it('ignores actions on other streets', () => {
    const seq = [
      { seat: 4, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', order: 1, amount: 8 },
      { seat: 4, action: PRIMITIVE_ACTIONS.BET, street: 'flop', order: 2, amount: 10 },
    ];
    expect(getCurrentBet(seq, 'preflop')).toBe(8);
  });
});

describe('getSizingOptions', () => {
  const blinds = { sb: 1, bb: 2 };

  it('returns preflop open sizes (facing blinds only)', () => {
    const options = getSizingOptions('preflop', PRIMITIVE_ACTIONS.RAISE, blinds, 3, 2);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '2.5x', amount: 5 });
    expect(options[1]).toEqual({ label: '4x', amount: 8 });
  });

  it('returns preflop 3bet sizes (facing a raise)', () => {
    const options = getSizingOptions('preflop', PRIMITIVE_ACTIONS.RAISE, blinds, 11, 8);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '2x', amount: 16 });
    expect(options[1]).toEqual({ label: '3x', amount: 24 });
  });

  it('returns postflop bet sizes (pot-relative)', () => {
    const options = getSizingOptions('flop', PRIMITIVE_ACTIONS.BET, blinds, 20, 0);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '1/4', amount: 5 });
    expect(options[1]).toEqual({ label: '1/2', amount: 10 });
  });

  it('returns postflop raise sizes (bet-relative)', () => {
    const options = getSizingOptions('flop', PRIMITIVE_ACTIONS.RAISE, blinds, 30, 10);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({ label: '2x', amount: 20 });
    expect(options[1]).toEqual({ label: '3x', amount: 30 });
  });
});
