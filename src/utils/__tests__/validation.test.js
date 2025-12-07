/**
 * validation.test.js - Tests for input validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSeat,
  isValidCard,
  isValidStreet,
  isValidAction,
  isValidCommunityCards,
  isValidHoleCards,
  isCardInUse,
  isValidPlayerCards,
} from '../validation';
import { ACTIONS } from '../../constants/gameConstants';

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

describe('isValidStreet', () => {
  it('accepts valid streets', () => {
    expect(isValidStreet('preflop')).toBe(true);
    expect(isValidStreet('flop')).toBe(true);
    expect(isValidStreet('turn')).toBe(true);
    expect(isValidStreet('river')).toBe(true);
    expect(isValidStreet('showdown')).toBe(true);
  });

  it('rejects invalid streets', () => {
    expect(isValidStreet('pre-flop')).toBe(false);
    expect(isValidStreet('PREFLOP')).toBe(false);
    expect(isValidStreet('fifth')).toBe(false);
    expect(isValidStreet('')).toBe(false);
  });

  it('respects custom validStreets parameter', () => {
    const customStreets = ['betting', 'closed'];
    expect(isValidStreet('betting', customStreets)).toBe(true);
    expect(isValidStreet('preflop', customStreets)).toBe(false);
  });
});

describe('isValidAction', () => {
  it('accepts valid actions', () => {
    expect(isValidAction('fold', ACTIONS)).toBe(true);
    expect(isValidAction('call', ACTIONS)).toBe(true);
    expect(isValidAction('open', ACTIONS)).toBe(true);
    expect(isValidAction('check', ACTIONS)).toBe(true);
    expect(isValidAction('won', ACTIONS)).toBe(true);
  });

  it('rejects invalid actions', () => {
    expect(isValidAction('FOLD', ACTIONS)).toBe(false);
    expect(isValidAction('raise', ACTIONS)).toBe(false);
    expect(isValidAction('', ACTIONS)).toBe(false);
    expect(isValidAction('bet', ACTIONS)).toBe(false);
  });
});

describe('isValidCommunityCards', () => {
  it('accepts empty array', () => {
    expect(isValidCommunityCards([])).toBe(true);
  });

  it('accepts array with valid cards', () => {
    expect(isValidCommunityCards(['A♠', 'K♥', 'Q♦'])).toBe(true);
    expect(isValidCommunityCards(['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'])).toBe(true);
  });

  it('accepts array with empty strings (placeholders)', () => {
    expect(isValidCommunityCards(['', '', ''])).toBe(true);
    expect(isValidCommunityCards(['A♠', '', 'Q♦'])).toBe(true);
  });

  it('rejects arrays with more than 5 cards', () => {
    expect(isValidCommunityCards(['A♠', 'K♥', 'Q♦', 'J♣', 'T♠', '9♥'])).toBe(false);
  });

  it('rejects arrays with invalid cards', () => {
    expect(isValidCommunityCards(['A♠', 'invalid', 'Q♦'])).toBe(false);
  });

  it('rejects non-array inputs', () => {
    expect(isValidCommunityCards(null)).toBe(false);
    expect(isValidCommunityCards('A♠')).toBe(false);
    expect(isValidCommunityCards({})).toBe(false);
  });
});

describe('isValidHoleCards', () => {
  it('accepts valid 2-card array', () => {
    expect(isValidHoleCards(['A♠', 'K♥'])).toBe(true);
  });

  it('accepts array with empty strings', () => {
    expect(isValidHoleCards(['', ''])).toBe(true);
    expect(isValidHoleCards(['A♠', ''])).toBe(true);
  });

  it('rejects arrays with wrong length', () => {
    expect(isValidHoleCards(['A♠'])).toBe(false);
    expect(isValidHoleCards(['A♠', 'K♥', 'Q♦'])).toBe(false);
    expect(isValidHoleCards([])).toBe(false);
  });

  it('rejects arrays with invalid cards', () => {
    expect(isValidHoleCards(['A♠', 'invalid'])).toBe(false);
  });

  it('rejects non-array inputs', () => {
    expect(isValidHoleCards(null)).toBe(false);
    expect(isValidHoleCards('AK')).toBe(false);
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
