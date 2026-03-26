/**
 * validation.test.js - Tests for input validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSeat,
  isCardInUse,
} from '../validation';

describe('isValidSeat', () => {
  it('accepts valid seat numbers 1-9', () => {
    for (let seat = 1; seat <= 9; seat++) {
      expect(isValidSeat(seat)).toBe(true);
    }
  });

  it('rejects seat 0', () => {
    expect(isValidSeat(0)).toBe(false);
  });

  it('rejects seat 10', () => {
    expect(isValidSeat(10)).toBe(false);
  });

  it('rejects negative seats', () => {
    expect(isValidSeat(-1)).toBe(false);
  });

  it('rejects non-integer seats', () => {
    expect(isValidSeat(1.5)).toBe(false);
    expect(isValidSeat(2.9)).toBe(false);
  });

  it('rejects non-number inputs', () => {
    expect(isValidSeat('1')).toBe(false);
    expect(isValidSeat(null)).toBe(false);
    expect(isValidSeat(undefined)).toBe(false);
  });

  it('respects custom numSeats parameter', () => {
    expect(isValidSeat(6, 6)).toBe(true);
    expect(isValidSeat(7, 6)).toBe(false);
  });
});

describe('isCardInUse', () => {
  const communityCards = ['A♠', 'K♥', ''];
  const holeCards = ['Q♦', 'J♣'];
  const allPlayerCards = {
    1: ['T♠', '9♥'],
    2: ['', ''],
  };

  it('detects card in community cards', () => {
    expect(isCardInUse('A♠', communityCards, holeCards, allPlayerCards)).toBe(true);
    expect(isCardInUse('K♥', communityCards, holeCards, allPlayerCards)).toBe(true);
  });

  it('detects card in hole cards', () => {
    expect(isCardInUse('Q♦', communityCards, holeCards, allPlayerCards)).toBe(true);
    expect(isCardInUse('J♣', communityCards, holeCards, allPlayerCards)).toBe(true);
  });

  it('detects card in other player cards', () => {
    expect(isCardInUse('T♠', communityCards, holeCards, allPlayerCards)).toBe(true);
    expect(isCardInUse('9♥', communityCards, holeCards, allPlayerCards)).toBe(true);
  });

  it('returns false for unused cards', () => {
    expect(isCardInUse('2♣', communityCards, holeCards, allPlayerCards)).toBe(false);
    expect(isCardInUse('8♦', communityCards, holeCards, allPlayerCards)).toBe(false);
  });

  it('excludes current seat/slot from check', () => {
    // Card is in seat 1, slot 0 - should not flag as in use when checking that same slot
    expect(isCardInUse('T♠', communityCards, holeCards, allPlayerCards, 1, 0)).toBe(false);
  });
});

