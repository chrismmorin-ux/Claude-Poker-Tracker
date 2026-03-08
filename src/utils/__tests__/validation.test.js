/**
 * validation.test.js - Tests for input validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSeat,
  isValidCard,
  isCardInUse,
  isValidPlayerCards,
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

describe('isValidCard', () => {
  it('accepts valid cards', () => {
    expect(isValidCard('A♠')).toBe(true);
    expect(isValidCard('K♥')).toBe(true);
    expect(isValidCard('Q♦')).toBe(true);
    expect(isValidCard('J♣')).toBe(true);
    expect(isValidCard('T♠')).toBe(true);
    expect(isValidCard('9♥')).toBe(true);
    expect(isValidCard('2♣')).toBe(true);
  });

  it('accepts all rank and suit combinations', () => {
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const suits = ['♠', '♥', '♦', '♣'];

    ranks.forEach(rank => {
      suits.forEach(suit => {
        expect(isValidCard(`${rank}${suit}`)).toBe(true);
      });
    });
  });

  it('rejects invalid ranks', () => {
    expect(isValidCard('1♠')).toBe(false);
    expect(isValidCard('X♠')).toBe(false);
    expect(isValidCard('0♠')).toBe(false);
  });

  it('rejects invalid suits', () => {
    expect(isValidCard('As')).toBe(false);
    expect(isValidCard('Ah')).toBe(false);
    expect(isValidCard('A@')).toBe(false);
  });

  it('rejects wrong length strings', () => {
    expect(isValidCard('A')).toBe(false);
    expect(isValidCard('A♠♠')).toBe(false);
    expect(isValidCard('')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isValidCard(null)).toBe(false);
    expect(isValidCard(undefined)).toBe(false);
    expect(isValidCard(123)).toBe(false);
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

describe('isValidPlayerCards', () => {
  it('accepts valid player cards object', () => {
    const validCards = {};
    for (let seat = 1; seat <= 9; seat++) {
      validCards[seat] = ['', ''];
    }
    expect(isValidPlayerCards(validCards)).toBe(true);
  });

  it('accepts player cards with valid cards', () => {
    const validCards = {};
    for (let seat = 1; seat <= 9; seat++) {
      validCards[seat] = ['A♠', 'K♥'];
    }
    expect(isValidPlayerCards(validCards)).toBe(true);
  });

  it('rejects missing seats', () => {
    const invalidCards = {};
    for (let seat = 1; seat <= 8; seat++) {
      invalidCards[seat] = ['', ''];
    }
    // Missing seat 9
    expect(isValidPlayerCards(invalidCards)).toBe(false);
  });

  it('rejects non-array seat values', () => {
    const invalidCards = {};
    for (let seat = 1; seat <= 9; seat++) {
      invalidCards[seat] = seat === 5 ? 'invalid' : ['', ''];
    }
    expect(isValidPlayerCards(invalidCards)).toBe(false);
  });

  it('rejects wrong number of cards per seat', () => {
    const invalidCards = {};
    for (let seat = 1; seat <= 9; seat++) {
      invalidCards[seat] = seat === 3 ? ['A♠'] : ['', ''];
    }
    expect(isValidPlayerCards(invalidCards)).toBe(false);
  });

  it('rejects non-object inputs', () => {
    expect(isValidPlayerCards(null)).toBe(false);
    expect(isValidPlayerCards([])).toBe(false);
    expect(isValidPlayerCards('invalid')).toBe(false);
  });
});
