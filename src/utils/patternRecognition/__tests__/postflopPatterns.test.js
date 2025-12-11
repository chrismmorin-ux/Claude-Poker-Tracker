/**
 * postflopPatterns.test.js - Tests for postflop pattern recognition
 */
import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import {
  POSTFLOP_PATTERNS,
  POSTFLOP_PATTERN_LABELS,
  detectPostflopPattern,
  getPostflopPatterns,
  summarizePostflopPatterns,
  getCbetStats,
} from '../postflopPatterns';

// Helper to create action entries
const createPreflopAction = (seat, action, order) => ({
  seat,
  action,
  street: 'preflop',
  order,
});

const createFlopAction = (seat, action, order) => ({
  seat,
  action,
  street: 'flop',
  order,
});

const createTurnAction = (seat, action, order) => ({
  seat,
  action,
  street: 'turn',
  order,
});

describe('postflopPatterns', () => {
  describe('POSTFLOP_PATTERNS', () => {
    it('has all expected patterns', () => {
      expect(POSTFLOP_PATTERNS.CBET_IP).toBe('cbet-ip');
      expect(POSTFLOP_PATTERNS.CBET_OOP).toBe('cbet-oop');
      expect(POSTFLOP_PATTERNS.DONK).toBe('donk');
      expect(POSTFLOP_PATTERNS.CHECK_RAISE).toBe('check-raise');
      expect(POSTFLOP_PATTERNS.PROBE).toBe('probe');
    });
  });

  describe('POSTFLOP_PATTERN_LABELS', () => {
    it('has labels for all patterns', () => {
      Object.values(POSTFLOP_PATTERNS).forEach(pattern => {
        expect(POSTFLOP_PATTERN_LABELS[pattern]).toBeDefined();
      });
    });
  });

  describe('detectPostflopPattern', () => {
    describe('basic actions', () => {
      it('detects CHECK', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // PFR
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
        ];
        const result = detectPostflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.CHECK);
      });

      it('detects basic FOLD (not to cbet or check-raise)', () => {
        // Folding to a donk bet (not a cbet since seat 4 is not PFR)
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // PFR = seat 3
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createPreflopAction(5, PRIMITIVE_ACTIONS.CALL, 3),
          createFlopAction(4, PRIMITIVE_ACTIONS.BET, 4),       // Donk from non-PFR
          createFlopAction(5, PRIMITIVE_ACTIONS.FOLD, 5),      // Fold to donk
        ];
        const result = detectPostflopPattern(sequence[4], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.FOLD);
      });
    });

    describe('C-BET patterns', () => {
      it('detects C-bet IP', () => {
        // BTN (seat 1) opens, BB (seat 3) calls, BTN cbets on flop (in position)
        const sequence = [
          createPreflopAction(1, PRIMITIVE_ACTIONS.RAISE, 1),  // BTN opens
          createPreflopAction(3, PRIMITIVE_ACTIONS.CALL, 2),   // BB calls
          createFlopAction(3, PRIMITIVE_ACTIONS.CHECK, 3),     // BB checks
          createFlopAction(1, PRIMITIVE_ACTIONS.BET, 4),       // BTN cbets IP
        ];
        const result = detectPostflopPattern(sequence[3], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.CBET_IP);
      });

      it('detects C-bet OOP', () => {
        // BB (seat 3) opens, BTN (seat 1) calls, BB cbets (out of position)
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // BB opens (weird but legal)
          createPreflopAction(1, PRIMITIVE_ACTIONS.CALL, 2),   // BTN calls
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 3),       // BB cbets OOP
        ];
        const result = detectPostflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.CBET_OOP);
      });
    });

    describe('DONK pattern', () => {
      it('detects donk bet (non-PFR betting into aggressor)', () => {
        // Seat 3 opens, seat 4 calls, seat 4 donk bets flop
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // PFR
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),   // Caller
          createFlopAction(4, PRIMITIVE_ACTIONS.BET, 3),       // Donk bet
        ];
        const result = detectPostflopPattern(sequence[2], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.DONK);
      });
    });

    describe('PROBE pattern', () => {
      it('detects probe bet (betting into aggressor who checked)', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // PFR
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),   // Caller
          createFlopAction(3, PRIMITIVE_ACTIONS.CHECK, 3),     // PFR checks
          createFlopAction(4, PRIMITIVE_ACTIONS.BET, 4),       // Probe bet
        ];
        const result = detectPostflopPattern(sequence[3], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.PROBE);
      });
    });

    describe('STAB pattern', () => {
      it('detects stab (bet in limped/no-aggressor pot)', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.CALL, 1),  // Limp
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),  // Limp
          createFlopAction(3, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(4, PRIMITIVE_ACTIONS.BET, 4),      // Stab
        ];
        const result = detectPostflopPattern(sequence[3], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.STAB);
      });
    });

    describe('CHECK_RAISE pattern', () => {
      it('detects check-raise', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),     // Check
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),       // Bet
          createFlopAction(4, PRIMITIVE_ACTIONS.RAISE, 5),     // Check-raise
        ];
        const result = detectPostflopPattern(sequence[4], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.CHECK_RAISE);
      });
    });

    describe('RAISE_VS_CBET pattern', () => {
      it('detects raise vs c-bet', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 3),       // C-bet
          createFlopAction(4, PRIMITIVE_ACTIONS.RAISE, 4),     // Raise vs cbet
        ];
        const result = detectPostflopPattern(sequence[3], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.RAISE_VS_CBET);
      });
    });

    describe('FOLD_TO_CBET pattern', () => {
      it('detects fold to c-bet', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),       // C-bet
          createFlopAction(4, PRIMITIVE_ACTIONS.FOLD, 5),      // Fold to cbet
        ];
        const result = detectPostflopPattern(sequence[4], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.FOLD_TO_CBET);
      });
    });

    describe('FOLD_TO_CR pattern', () => {
      it('detects fold to check-raise', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),
          createFlopAction(4, PRIMITIVE_ACTIONS.RAISE, 5),     // Check-raise
          createFlopAction(3, PRIMITIVE_ACTIONS.FOLD, 6),      // Fold to CR
        ];
        const result = detectPostflopPattern(sequence[5], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.FOLD_TO_CR);
      });
    });

    describe('CALL_CBET pattern', () => {
      it('detects call c-bet', () => {
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),       // C-bet
          createFlopAction(4, PRIMITIVE_ACTIONS.CALL, 5),      // Call cbet
        ];
        const result = detectPostflopPattern(sequence[4], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.CALL_CBET);
      });
    });

    describe('FLOAT patterns', () => {
      it('detects call cbet (which could be a float)', () => {
        // Note: Float detection is complex - calling a cbet could be a float
        // but we mark it as CALL_CBET since that's the more specific pattern
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 3),       // C-bet
          createFlopAction(4, PRIMITIVE_ACTIONS.CALL, 4),      // Call cbet
        ];
        const result = detectPostflopPattern(sequence[3], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.CALL_CBET);
      });

      it('detects probe bet on turn after calling flop', () => {
        // Betting into the aggressor who checked = probe
        const sequence = [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 3),
          createFlopAction(4, PRIMITIVE_ACTIONS.CALL, 4),      // Called flop
          createTurnAction(3, PRIMITIVE_ACTIONS.CHECK, 5),     // Aggressor checks
          createTurnAction(4, PRIMITIVE_ACTIONS.BET, 6),       // Probe bet
        ];
        const result = detectPostflopPattern(sequence[5], sequence, 1);
        expect(result).toBe(POSTFLOP_PATTERNS.PROBE);
      });
    });

    describe('non-postflop actions', () => {
      it('returns null for preflop actions', () => {
        const sequence = [createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1)];
        const result = detectPostflopPattern(sequence[0], sequence, 1);
        expect(result).toBe(null);
      });

      it('returns null for showdown actions', () => {
        const showdownAction = {
          seat: 3,
          action: PRIMITIVE_ACTIONS.BET,
          street: 'showdown',
          order: 5,
        };
        const result = detectPostflopPattern(showdownAction, [showdownAction], 1);
        expect(result).toBe(null);
      });
    });
  });

  describe('getPostflopPatterns', () => {
    it('returns patterns for all postflop actions', () => {
      const sequence = [
        createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
        createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
        createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
        createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),
        createFlopAction(4, PRIMITIVE_ACTIONS.CALL, 5),
      ];

      const patterns = getPostflopPatterns(sequence, 1);

      expect(patterns).toHaveLength(3);  // Only flop actions
      expect(patterns[0].pattern).toBe(POSTFLOP_PATTERNS.CHECK);
      expect(patterns[1].pattern).toBe(POSTFLOP_PATTERNS.CBET_OOP);
      expect(patterns[2].pattern).toBe(POSTFLOP_PATTERNS.CALL_CBET);
    });

    it('returns empty array for empty sequence', () => {
      expect(getPostflopPatterns([], 1)).toEqual([]);
      expect(getPostflopPatterns(null, 1)).toEqual([]);
    });
  });

  describe('summarizePostflopPatterns', () => {
    it('groups patterns by street and seat', () => {
      const sequence = [
        createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
        createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
        createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
        createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),
        createTurnAction(4, PRIMITIVE_ACTIONS.CHECK, 5),
        createTurnAction(3, PRIMITIVE_ACTIONS.CHECK, 6),
      ];

      const summary = summarizePostflopPatterns(sequence, 1);

      expect(summary.flop[4]).toContain(POSTFLOP_PATTERNS.CHECK);
      expect(summary.flop[3]).toContain(POSTFLOP_PATTERNS.CBET_OOP);
      expect(summary.turn[4]).toContain(POSTFLOP_PATTERNS.CHECK);
      expect(summary.turn[3]).toContain(POSTFLOP_PATTERNS.CHECK);
    });
  });

  describe('getCbetStats', () => {
    it('calculates c-bet frequency correctly', () => {
      const sequences = [
        // Hand 1: PFR cbets
        [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),  // Cbet
        ],
        // Hand 2: PFR checks
        [
          createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(3, PRIMITIVE_ACTIONS.CHECK, 4),  // No cbet
        ],
        // Hand 3: Different seat is PFR
        [
          createPreflopAction(4, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(3, PRIMITIVE_ACTIONS.CALL, 2),
          createFlopAction(3, PRIMITIVE_ACTIONS.CHECK, 3),
          createFlopAction(4, PRIMITIVE_ACTIONS.BET, 4),
        ],
      ];

      const buttonSeats = [1, 1, 1];
      const stats = getCbetStats(sequences, 3, buttonSeats);

      expect(stats.opportunities).toBe(2);  // Seat 3 was PFR twice
      expect(stats.made).toBe(1);           // Cbet once
      expect(stats.percentage).toBe(50);
    });

    it('returns 0% when no opportunities', () => {
      const sequences = [
        [
          createPreflopAction(4, PRIMITIVE_ACTIONS.RAISE, 1),
          createPreflopAction(3, PRIMITIVE_ACTIONS.CALL, 2),
        ],
      ];

      const stats = getCbetStats(sequences, 3, [1]);
      expect(stats.opportunities).toBe(0);
      expect(stats.percentage).toBe(0);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiway pot correctly', () => {
      // Button = 1, so seat 3 is OOP relative to seats 4 and 5 (who fold/call)
      // Cbet from seat 3 with opponents behind = OOP
      const sequence = [
        createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),  // PFR
        createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
        createPreflopAction(5, PRIMITIVE_ACTIONS.CALL, 3),
        createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 4),
        createFlopAction(5, PRIMITIVE_ACTIONS.CHECK, 5),
        createFlopAction(3, PRIMITIVE_ACTIONS.BET, 6),       // Cbet multiway (OOP to callers)
        createFlopAction(4, PRIMITIVE_ACTIONS.CALL, 7),
        createFlopAction(5, PRIMITIVE_ACTIONS.FOLD, 8),
      ];

      const patterns = getPostflopPatterns(sequence, 1);

      // Seat 3 is OOP to seats 4 and 5 when button is at seat 1
      expect(patterns.find(p => p.order === 6).pattern).toBe(POSTFLOP_PATTERNS.CBET_OOP);
      expect(patterns.find(p => p.order === 7).pattern).toBe(POSTFLOP_PATTERNS.CALL_CBET);
      expect(patterns.find(p => p.order === 8).pattern).toBe(POSTFLOP_PATTERNS.FOLD_TO_CBET);
    });

    it('handles multiple streets correctly', () => {
      const sequence = [
        createPreflopAction(3, PRIMITIVE_ACTIONS.RAISE, 1),
        createPreflopAction(4, PRIMITIVE_ACTIONS.CALL, 2),
        // Flop
        createFlopAction(4, PRIMITIVE_ACTIONS.CHECK, 3),
        createFlopAction(3, PRIMITIVE_ACTIONS.BET, 4),
        createFlopAction(4, PRIMITIVE_ACTIONS.CALL, 5),
        // Turn
        createTurnAction(4, PRIMITIVE_ACTIONS.CHECK, 6),
        createTurnAction(3, PRIMITIVE_ACTIONS.BET, 7),  // Barrel
        createTurnAction(4, PRIMITIVE_ACTIONS.RAISE, 8), // Check-raise turn
      ];

      const patterns = getPostflopPatterns(sequence, 1);

      // Turn bet from PFR is just a BET (not cbet - that's only flop)
      // Actually it's still a cbet in common parlance (double barrel)
      // But our implementation specifically checks for CBET patterns
      expect(patterns.find(p => p.order === 8).pattern).toBe(POSTFLOP_PATTERNS.CHECK_RAISE);
    });
  });
});
