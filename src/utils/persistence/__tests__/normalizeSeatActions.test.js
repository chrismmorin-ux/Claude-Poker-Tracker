/**
 * normalizeSeatActions.test.js - Tests for seatActions migration utility
 */

import { describe, it, expect } from 'vitest';
import { normalizeSeatActions, normalizeHandRecord } from '../normalizeSeatActions';

describe('normalizeSeatActions', () => {
  describe('edge cases', () => {
    it('returns empty object for null input', () => {
      expect(normalizeSeatActions(null)).toEqual({});
    });

    it('returns empty object for undefined input', () => {
      expect(normalizeSeatActions(undefined)).toEqual({});
    });

    it('returns empty object for non-object input (string)', () => {
      expect(normalizeSeatActions('invalid')).toEqual({});
    });

    it('returns empty object for non-object input (number)', () => {
      expect(normalizeSeatActions(123)).toEqual({});
    });

    it('returns empty object for empty object input', () => {
      expect(normalizeSeatActions({})).toEqual({});
    });
  });

  describe('street-level validation', () => {
    it('handles null street actions', () => {
      const input = { preflop: null };
      const result = normalizeSeatActions(input);
      expect(result.preflop).toEqual({});
    });

    it('handles undefined street actions', () => {
      const input = { preflop: undefined };
      const result = normalizeSeatActions(input);
      expect(result.preflop).toEqual({});
    });

    it('handles non-object street actions', () => {
      const input = { preflop: 'invalid' };
      const result = normalizeSeatActions(input);
      expect(result.preflop).toEqual({});
    });
  });

  describe('single string to array conversion', () => {
    it('converts single string action to array', () => {
      const input = {
        preflop: { 1: 'fold' }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['fold']);
    });

    it('converts multiple seat actions on same street', () => {
      const input = {
        preflop: { 1: 'fold', 2: 'call', 3: 'raise' }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['fold']);
      expect(result.preflop[2]).toEqual(['call']);
      expect(result.preflop[3]).toEqual(['raise']);
    });

    it('converts actions across multiple streets', () => {
      const input = {
        preflop: { 1: 'call' },
        flop: { 1: 'check' },
        turn: { 1: 'bet' },
        river: { 1: 'fold' }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['call']);
      expect(result.flop[1]).toEqual(['check']);
      expect(result.turn[1]).toEqual(['bet']);
      expect(result.river[1]).toEqual(['fold']);
    });
  });

  describe('array preservation (idempotent)', () => {
    it('preserves existing arrays unchanged', () => {
      const input = {
        preflop: { 1: ['fold'] }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['fold']);
    });

    it('preserves arrays with multiple actions', () => {
      const input = {
        preflop: { 1: ['call', 'raise', 'all-in'] }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['call', 'raise', 'all-in']);
    });

    it('preserves empty arrays', () => {
      const input = {
        preflop: { 1: [] }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual([]);
    });
  });

  describe('null/undefined/empty seat values', () => {
    it('converts null seat action to empty array', () => {
      const input = {
        preflop: { 1: null }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual([]);
    });

    it('converts undefined seat action to empty array', () => {
      const input = {
        preflop: { 1: undefined }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual([]);
    });

    it('converts empty string seat action to empty array', () => {
      const input = {
        preflop: { 1: '' }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual([]);
    });
  });

  describe('mixed format handling', () => {
    it('handles mixed string and array actions in same street', () => {
      const input = {
        preflop: {
          1: 'fold',           // string - convert to array
          2: ['call', 'raise'], // array - preserve
          3: null               // null - convert to empty array
        }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['fold']);
      expect(result.preflop[2]).toEqual(['call', 'raise']);
      expect(result.preflop[3]).toEqual([]);
    });

    it('handles mixed format across streets', () => {
      const input = {
        preflop: { 1: 'call' },
        flop: { 1: ['check', 'bet'] },
        turn: { 1: null }
      };
      const result = normalizeSeatActions(input);
      expect(result.preflop[1]).toEqual(['call']);
      expect(result.flop[1]).toEqual(['check', 'bet']);
      expect(result.turn[1]).toEqual([]);
    });
  });

  describe('complete hand scenario', () => {
    it('normalizes a complete hand with all streets', () => {
      const input = {
        preflop: { 1: 'fold', 2: 'call', 3: ['open', '3bet'], 4: null },
        flop: { 2: 'check', 3: 'bet' },
        turn: { 2: ['call'], 3: 'check' },
        river: { 2: 'bet', 3: ['call'] },
        showdown: { 2: 'won', 3: 'muck' }
      };
      const result = normalizeSeatActions(input);

      // Preflop
      expect(result.preflop[1]).toEqual(['fold']);
      expect(result.preflop[2]).toEqual(['call']);
      expect(result.preflop[3]).toEqual(['open', '3bet']);
      expect(result.preflop[4]).toEqual([]);

      // Flop
      expect(result.flop[2]).toEqual(['check']);
      expect(result.flop[3]).toEqual(['bet']);

      // Turn
      expect(result.turn[2]).toEqual(['call']);
      expect(result.turn[3]).toEqual(['check']);

      // River
      expect(result.river[2]).toEqual(['bet']);
      expect(result.river[3]).toEqual(['call']);

      // Showdown
      expect(result.showdown[2]).toEqual(['won']);
      expect(result.showdown[3]).toEqual(['muck']);
    });
  });
});

describe('normalizeHandRecord', () => {
  describe('edge cases', () => {
    it('returns null for null input', () => {
      expect(normalizeHandRecord(null)).toBeNull();
    });

    it('returns undefined for undefined input', () => {
      expect(normalizeHandRecord(undefined)).toBeUndefined();
    });
  });

  describe('hand normalization', () => {
    it('normalizes seatActions within a hand record', () => {
      const hand = {
        handId: 1,
        timestamp: Date.now(),
        seatActions: {
          preflop: { 1: 'fold', 2: 'call' }
        },
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
        holeCards: ['J♣', 'T♠']
      };

      const result = normalizeHandRecord(hand);

      expect(result.handId).toBe(1);
      expect(result.seatActions.preflop[1]).toEqual(['fold']);
      expect(result.seatActions.preflop[2]).toEqual(['call']);
      expect(result.communityCards).toEqual(['A♠', 'K♥', 'Q♦', '', '']);
      expect(result.holeCards).toEqual(['J♣', 'T♠']);
    });

    it('preserves all other hand properties', () => {
      const hand = {
        handId: 42,
        timestamp: 1699999999999,
        sessionId: 5,
        currentStreet: 'river',
        dealerButtonSeat: 3,
        mySeat: 7,
        absentSeats: [1, 9],
        seatActions: { preflop: { 1: 'fold' } },
        communityCards: ['A♠', 'K♥', 'Q♦', 'J♣', '9♠'],
        holeCards: ['A♦', 'A♣'],
        allPlayerCards: { 5: ['K♣', 'K♦'] }
      };

      const result = normalizeHandRecord(hand);

      expect(result.handId).toBe(42);
      expect(result.timestamp).toBe(1699999999999);
      expect(result.sessionId).toBe(5);
      expect(result.currentStreet).toBe('river');
      expect(result.dealerButtonSeat).toBe(3);
      expect(result.mySeat).toBe(7);
      expect(result.absentSeats).toEqual([1, 9]);
      expect(result.communityCards).toEqual(['A♠', 'K♥', 'Q♦', 'J♣', '9♠']);
      expect(result.holeCards).toEqual(['A♦', 'A♣']);
      expect(result.allPlayerCards).toEqual({ 5: ['K♣', 'K♦'] });
    });

    it('handles hand with missing seatActions', () => {
      const hand = {
        handId: 1,
        timestamp: Date.now()
      };

      const result = normalizeHandRecord(hand);

      expect(result.handId).toBe(1);
      expect(result.seatActions).toEqual({});
    });

    it('handles hand with null seatActions', () => {
      const hand = {
        handId: 1,
        seatActions: null
      };

      const result = normalizeHandRecord(hand);

      expect(result.seatActions).toEqual({});
    });
  });

  describe('idempotency', () => {
    it('running normalize twice produces same result', () => {
      const hand = {
        handId: 1,
        seatActions: {
          preflop: { 1: 'fold', 2: ['call'] }
        }
      };

      const result1 = normalizeHandRecord(hand);
      const result2 = normalizeHandRecord(result1);

      expect(result2).toEqual(result1);
    });
  });
});
