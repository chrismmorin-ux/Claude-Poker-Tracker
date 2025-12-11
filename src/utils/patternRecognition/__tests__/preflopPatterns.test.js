/**
 * preflopPatterns.test.js - Tests for preflop pattern recognition
 */
import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import {
  PREFLOP_PATTERNS,
  PREFLOP_PATTERN_LABELS,
  detectPreflopPattern,
  getPreflopPatterns,
  getFirstVoluntaryPattern,
  summarizePreflopPatterns,
  getPreflopAggressorFromPatterns,
} from '../preflopPatterns';

// Helper to create action entries
const createAction = (seat, action, order) => ({
  seat,
  action,
  street: 'preflop',
  order,
});

describe('preflopPatterns', () => {
  describe('PREFLOP_PATTERNS', () => {
    it('has all expected patterns', () => {
      expect(PREFLOP_PATTERNS.FOLD).toBe('fold');
      expect(PREFLOP_PATTERNS.LIMP).toBe('limp');
      expect(PREFLOP_PATTERNS.OPEN).toBe('open');
      expect(PREFLOP_PATTERNS.THREE_BET).toBe('3bet');
      expect(PREFLOP_PATTERNS.FOUR_BET).toBe('4bet');
      expect(PREFLOP_PATTERNS.COLD_CALL).toBe('cold-call');
      expect(PREFLOP_PATTERNS.SQUEEZE).toBe('squeeze');
    });
  });

  describe('PREFLOP_PATTERN_LABELS', () => {
    it('has labels for all patterns', () => {
      Object.values(PREFLOP_PATTERNS).forEach(pattern => {
        expect(PREFLOP_PATTERN_LABELS[pattern]).toBeDefined();
      });
    });
  });

  describe('detectPreflopPattern', () => {
    describe('FOLD', () => {
      it('detects fold correctly', () => {
        const sequence = [createAction(1, PRIMITIVE_ACTIONS.FOLD, 1)];
        const result = detectPreflopPattern(sequence[0], sequence, 9);
        expect(result).toBe(PREFLOP_PATTERNS.FOLD);
      });
    });

    describe('LIMP', () => {
      it('detects first limper', () => {
        // UTG limps (first voluntary action)
        const sequence = [createAction(3, PRIMITIVE_ACTIONS.CALL, 1)];
        const result = detectPreflopPattern(sequence[0], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.LIMP);
      });
    });

    describe('OVER_LIMP', () => {
      it('detects over-limp (second limper)', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.CALL, 1),  // First limp
          createAction(4, PRIMITIVE_ACTIONS.CALL, 2),  // Over-limp
        ];
        const result = detectPreflopPattern(sequence[1], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.OVER_LIMP);
      });
    });

    describe('OPEN', () => {
      it('detects open raise (first raise)', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.FOLD, 1),
          createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),  // Open
        ];
        const result = detectPreflopPattern(sequence[1], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.OPEN);
      });

      it('detects open as first action', () => {
        const sequence = [createAction(3, PRIMITIVE_ACTIONS.RAISE, 1)];
        const result = detectPreflopPattern(sequence[0], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.OPEN);
      });
    });

    describe('ISO_RAISE', () => {
      it('detects iso-raise over limpers', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.CALL, 1),  // Limp
          createAction(4, PRIMITIVE_ACTIONS.RAISE, 2), // Iso-raise
        ];
        const result = detectPreflopPattern(sequence[1], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.ISO_RAISE);
      });
    });

    describe('THREE_BET', () => {
      it('detects 3bet (raise after one raise)', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
          createAction(4, PRIMITIVE_ACTIONS.FOLD, 2),
          createAction(5, PRIMITIVE_ACTIONS.RAISE, 3),  // 3bet
        ];
        const result = detectPreflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.THREE_BET);
      });
    });

    describe('FOUR_BET', () => {
      it('detects 4bet (raise after two raises)', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
          createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),  // 3bet
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 3),  // 4bet
        ];
        const result = detectPreflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.FOUR_BET);
      });
    });

    describe('FIVE_BET', () => {
      it('detects 5bet', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
          createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),  // 3bet
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 3),  // 4bet
          createAction(4, PRIMITIVE_ACTIONS.RAISE, 4),  // 5bet
        ];
        const result = detectPreflopPattern(sequence[3], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.FIVE_BET);
      });
    });

    describe('COLD_CALL', () => {
      it('detects cold call (calling raise without having acted)', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
          createAction(4, PRIMITIVE_ACTIONS.CALL, 2),   // Cold call
        ];
        const result = detectPreflopPattern(sequence[1], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.COLD_CALL);
      });
    });

    describe('SQUEEZE', () => {
      it('detects squeeze (3bet with caller in pot)', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
          createAction(4, PRIMITIVE_ACTIONS.CALL, 2),   // Cold call
          createAction(5, PRIMITIVE_ACTIONS.RAISE, 3),  // Squeeze
        ];
        const result = detectPreflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.SQUEEZE);
      });

      it('does not detect squeeze without caller', () => {
        const sequence = [
          createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
          createAction(4, PRIMITIVE_ACTIONS.FOLD, 2),
          createAction(5, PRIMITIVE_ACTIONS.RAISE, 3),  // Regular 3bet
        ];
        const result = detectPreflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(PREFLOP_PATTERNS.THREE_BET);
      });
    });

    describe('non-preflop actions', () => {
      it('returns null for postflop actions', () => {
        const flopAction = {
          seat: 3,
          action: PRIMITIVE_ACTIONS.BET,
          street: 'flop',
          order: 5,
        };
        const result = detectPreflopPattern(flopAction, [flopAction], 1);
        expect(result).toBe(null);
      });
    });
  });

  describe('getPreflopPatterns', () => {
    it('returns patterns for all preflop actions', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
        createAction(4, PRIMITIVE_ACTIONS.CALL, 2),   // Cold call
        createAction(5, PRIMITIVE_ACTIONS.FOLD, 3),   // Fold
      ];

      const patterns = getPreflopPatterns(sequence, 1);

      expect(patterns).toHaveLength(3);
      expect(patterns[0].pattern).toBe(PREFLOP_PATTERNS.OPEN);
      expect(patterns[1].pattern).toBe(PREFLOP_PATTERNS.COLD_CALL);
      expect(patterns[2].pattern).toBe(PREFLOP_PATTERNS.FOLD);
    });

    it('returns empty array for empty sequence', () => {
      expect(getPreflopPatterns([], 1)).toEqual([]);
      expect(getPreflopPatterns(null, 1)).toEqual([]);
    });

    it('includes original entry properties', () => {
      const sequence = [createAction(3, PRIMITIVE_ACTIONS.RAISE, 1)];
      const patterns = getPreflopPatterns(sequence, 1);

      expect(patterns[0]).toMatchObject({
        seat: 3,
        action: PRIMITIVE_ACTIONS.RAISE,
        street: 'preflop',
        order: 1,
        pattern: PREFLOP_PATTERNS.OPEN,
      });
    });
  });

  describe('getFirstVoluntaryPattern', () => {
    it('returns first voluntary pattern for a seat', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.FOLD, 1),
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),  // First voluntary for seat 4
        createAction(5, PRIMITIVE_ACTIONS.CALL, 3),
      ];

      expect(getFirstVoluntaryPattern(sequence, 4, 1)).toBe(PREFLOP_PATTERNS.OPEN);
    });

    it('returns null if player only folded', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.FOLD, 1),
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),
      ];

      expect(getFirstVoluntaryPattern(sequence, 3, 1)).toBe(null);
    });

    it('returns null if player not in sequence', () => {
      const sequence = [createAction(3, PRIMITIVE_ACTIONS.RAISE, 1)];
      expect(getFirstVoluntaryPattern(sequence, 9, 1)).toBe(null);
    });
  });

  describe('summarizePreflopPatterns', () => {
    it('groups patterns by seat', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),
        createAction(3, PRIMITIVE_ACTIONS.CALL, 3),  // Seat 3 calls the 3bet
      ];

      const summary = summarizePreflopPatterns(sequence, 1);

      expect(summary[3]).toEqual([PREFLOP_PATTERNS.OPEN, PRIMITIVE_ACTIONS.CALL]);
      expect(summary[4]).toEqual([PREFLOP_PATTERNS.THREE_BET]);
    });
  });

  describe('getPreflopAggressorFromPatterns', () => {
    it('returns seat of last raiser (opener)', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.FOLD, 1),
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 2),  // Open - this is PFR
        createAction(5, PRIMITIVE_ACTIONS.CALL, 3),
      ];

      expect(getPreflopAggressorFromPatterns(sequence, 1)).toBe(4);
    });

    it('returns seat of 3bettor if there was a 3bet', () => {
      const sequence = [
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 1),  // Open
        createAction(5, PRIMITIVE_ACTIONS.RAISE, 2),  // 3bet - this is PFR
        createAction(4, PRIMITIVE_ACTIONS.CALL, 3),
      ];

      expect(getPreflopAggressorFromPatterns(sequence, 1)).toBe(5);
    });

    it('returns null if no raises', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.CALL, 1),  // Limp
        createAction(4, PRIMITIVE_ACTIONS.CALL, 2),  // Over-limp
      ];

      expect(getPreflopAggressorFromPatterns(sequence, 1)).toBe(null);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiway 3bet pot correctly', () => {
      // UTG opens, MP cold calls, CO 3bets (squeeze), UTG 4bets
      const sequence = [
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 1),  // UTG opens
        createAction(5, PRIMITIVE_ACTIONS.CALL, 2),   // MP cold calls
        createAction(6, PRIMITIVE_ACTIONS.RAISE, 3),  // CO squeezes
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 4),  // UTG 4bets
      ];

      const patterns = getPreflopPatterns(sequence, 1);

      expect(patterns[0].pattern).toBe(PREFLOP_PATTERNS.OPEN);
      expect(patterns[1].pattern).toBe(PREFLOP_PATTERNS.COLD_CALL);
      expect(patterns[2].pattern).toBe(PREFLOP_PATTERNS.SQUEEZE);
      expect(patterns[3].pattern).toBe(PREFLOP_PATTERNS.FOUR_BET);
    });

    it('handles limped pot with iso-raise correctly', () => {
      const sequence = [
        createAction(4, PRIMITIVE_ACTIONS.CALL, 1),  // UTG limps
        createAction(5, PRIMITIVE_ACTIONS.CALL, 2),  // MP over-limps
        createAction(6, PRIMITIVE_ACTIONS.RAISE, 3), // CO iso-raises
        createAction(7, PRIMITIVE_ACTIONS.CALL, 4),  // BTN cold calls
      ];

      const patterns = getPreflopPatterns(sequence, 1);

      expect(patterns[0].pattern).toBe(PREFLOP_PATTERNS.LIMP);
      expect(patterns[1].pattern).toBe(PREFLOP_PATTERNS.OVER_LIMP);
      expect(patterns[2].pattern).toBe(PREFLOP_PATTERNS.ISO_RAISE);
      expect(patterns[3].pattern).toBe(PREFLOP_PATTERNS.COLD_CALL);
    });
  });
});
