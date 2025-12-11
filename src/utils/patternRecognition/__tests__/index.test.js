/**
 * index.test.js - Tests for pattern recognition module exports
 */
import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import {
  // Position utilities
  POSITION_NAMES,
  getPositionName,
  isInPosition,

  // Preflop patterns
  PREFLOP_PATTERNS,
  PREFLOP_PATTERN_LABELS,
  detectPreflopPattern,
  getPreflopPatterns,

  // Postflop patterns
  POSTFLOP_PATTERNS,
  POSTFLOP_PATTERN_LABELS,
  detectPostflopPattern,
  getPostflopPatterns,

  // Combined exports
  PATTERNS,
  PATTERN_LABELS,
  getPatternLabel,
  detectPattern,
  getAllPatterns,
  getHandPatternSummary,
  isAggressivePattern,
  isPassivePattern,
} from '../index';

// Helper to create action entries
const createAction = (seat, action, street, order) => ({
  seat,
  action,
  street,
  order,
});

describe('patternRecognition module', () => {
  describe('exports', () => {
    it('exports position utilities', () => {
      expect(POSITION_NAMES).toBeDefined();
      expect(getPositionName).toBeDefined();
      expect(isInPosition).toBeDefined();
    });

    it('exports preflop patterns', () => {
      expect(PREFLOP_PATTERNS).toBeDefined();
      expect(PREFLOP_PATTERN_LABELS).toBeDefined();
      expect(detectPreflopPattern).toBeDefined();
      expect(getPreflopPatterns).toBeDefined();
    });

    it('exports postflop patterns', () => {
      expect(POSTFLOP_PATTERNS).toBeDefined();
      expect(POSTFLOP_PATTERN_LABELS).toBeDefined();
      expect(detectPostflopPattern).toBeDefined();
      expect(getPostflopPatterns).toBeDefined();
    });

    it('exports combined constants', () => {
      expect(PATTERNS).toBeDefined();
      expect(PATTERN_LABELS).toBeDefined();
    });
  });

  describe('PATTERNS', () => {
    it('includes all preflop patterns', () => {
      expect(PATTERNS.LIMP).toBe('limp');
      expect(PATTERNS.OPEN).toBe('open');
      expect(PATTERNS.THREE_BET).toBe('3bet');
      expect(PATTERNS.COLD_CALL).toBe('cold-call');
      expect(PATTERNS.SQUEEZE).toBe('squeeze');
    });

    it('includes all postflop patterns', () => {
      expect(PATTERNS.CBET_IP).toBe('cbet-ip');
      expect(PATTERNS.CBET_OOP).toBe('cbet-oop');
      expect(PATTERNS.DONK).toBe('donk');
      expect(PATTERNS.CHECK_RAISE).toBe('check-raise');
      expect(PATTERNS.PROBE).toBe('probe');
    });
  });

  describe('PATTERN_LABELS', () => {
    it('has labels for all patterns', () => {
      Object.values(PATTERNS).forEach(pattern => {
        expect(PATTERN_LABELS[pattern]).toBeDefined();
        expect(typeof PATTERN_LABELS[pattern]).toBe('string');
      });
    });
  });

  describe('getPatternLabel', () => {
    it('returns correct label for known patterns', () => {
      expect(getPatternLabel('limp')).toBe('Limp');
      expect(getPatternLabel('3bet')).toBe('3-Bet');
      expect(getPatternLabel('cbet-ip')).toBe('C-Bet (IP)');
      expect(getPatternLabel('check-raise')).toBe('Check-Raise');
    });

    it('returns pattern itself for unknown patterns', () => {
      expect(getPatternLabel('unknown-pattern')).toBe('unknown-pattern');
    });

    it('returns "Unknown" for null/undefined', () => {
      expect(getPatternLabel(null)).toBe('Unknown');
      expect(getPatternLabel(undefined)).toBe('Unknown');
    });
  });

  describe('detectPattern', () => {
    it('detects preflop patterns', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),
      ];
      expect(detectPattern(sequence[0], sequence, 1)).toBe(PATTERNS.OPEN);
    });

    it('detects postflop patterns', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),
        createAction(4, PRIMITIVE_ACTIONS.CALL, 'preflop', 2),
        createAction(4, PRIMITIVE_ACTIONS.CHECK, 'flop', 3),
        createAction(3, PRIMITIVE_ACTIONS.BET, 'flop', 4),
      ];
      expect(detectPattern(sequence[3], sequence, 1)).toBe(PATTERNS.CBET_OOP);
    });

    it('returns null for showdown', () => {
      const action = createAction(3, PRIMITIVE_ACTIONS.CHECK, 'showdown', 1);
      expect(detectPattern(action, [action], 1)).toBe(null);
    });
  });

  describe('getAllPatterns', () => {
    it('returns patterns for all non-showdown actions', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),
        createAction(4, PRIMITIVE_ACTIONS.CALL, 'preflop', 2),
        createAction(4, PRIMITIVE_ACTIONS.CHECK, 'flop', 3),
        createAction(3, PRIMITIVE_ACTIONS.BET, 'flop', 4),
      ];

      const patterns = getAllPatterns(sequence, 1);

      expect(patterns).toHaveLength(4);
      expect(patterns[0].pattern).toBe(PATTERNS.OPEN);
      expect(patterns[1].pattern).toBe(PATTERNS.COLD_CALL);
      expect(patterns[2].pattern).toBe(PATTERNS.CHECK);
      expect(patterns[3].pattern).toBe(PATTERNS.CBET_OOP);
    });

    it('excludes showdown actions', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),
        createAction(3, PRIMITIVE_ACTIONS.BET, 'showdown', 2),
      ];

      const patterns = getAllPatterns(sequence, 1);
      expect(patterns).toHaveLength(1);
    });

    it('returns empty array for empty sequence', () => {
      expect(getAllPatterns([], 1)).toEqual([]);
      expect(getAllPatterns(null, 1)).toEqual([]);
    });
  });

  describe('getHandPatternSummary', () => {
    it('groups patterns by seat and street', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),
        createAction(4, PRIMITIVE_ACTIONS.CALL, 'preflop', 2),
        createAction(4, PRIMITIVE_ACTIONS.CHECK, 'flop', 3),
        createAction(3, PRIMITIVE_ACTIONS.BET, 'flop', 4),
        createAction(4, PRIMITIVE_ACTIONS.CALL, 'flop', 5),
      ];

      const summary = getHandPatternSummary(sequence, 1);

      expect(summary[3].preflop).toContain(PATTERNS.OPEN);
      expect(summary[4].preflop).toContain(PATTERNS.COLD_CALL);
      expect(summary[3].flop).toContain(PATTERNS.CBET_OOP);
      expect(summary[4].flop).toContain(PATTERNS.CHECK);
    });

    it('initializes all streets for each seat', () => {
      const sequence = [
        createAction(3, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),
      ];

      const summary = getHandPatternSummary(sequence, 1);

      expect(summary[3].preflop).toBeDefined();
      expect(summary[3].flop).toBeDefined();
      expect(summary[3].turn).toBeDefined();
      expect(summary[3].river).toBeDefined();
    });
  });

  describe('isAggressivePattern', () => {
    it('returns true for aggressive patterns', () => {
      expect(isAggressivePattern(PATTERNS.OPEN)).toBe(true);
      expect(isAggressivePattern(PATTERNS.THREE_BET)).toBe(true);
      expect(isAggressivePattern(PATTERNS.CBET_IP)).toBe(true);
      expect(isAggressivePattern(PATTERNS.CHECK_RAISE)).toBe(true);
      expect(isAggressivePattern(PATTERNS.DONK)).toBe(true);
    });

    it('returns false for passive patterns', () => {
      expect(isAggressivePattern(PATTERNS.FOLD)).toBe(false);
      expect(isAggressivePattern(PATTERNS.LIMP)).toBe(false);
      expect(isAggressivePattern(PATTERNS.COLD_CALL)).toBe(false);
      expect(isAggressivePattern(PATTERNS.CHECK)).toBe(false);
    });
  });

  describe('isPassivePattern', () => {
    it('returns true for passive patterns', () => {
      expect(isPassivePattern(PATTERNS.FOLD)).toBe(true);
      expect(isPassivePattern(PATTERNS.LIMP)).toBe(true);
      expect(isPassivePattern(PATTERNS.COLD_CALL)).toBe(true);
      expect(isPassivePattern(PATTERNS.CHECK)).toBe(true);
      expect(isPassivePattern(PATTERNS.CALL)).toBe(true);
    });

    it('returns false for aggressive patterns', () => {
      expect(isPassivePattern(PATTERNS.OPEN)).toBe(false);
      expect(isPassivePattern(PATTERNS.THREE_BET)).toBe(false);
      expect(isPassivePattern(PATTERNS.CBET_IP)).toBe(false);
    });
  });

  describe('integration', () => {
    it('handles complete hand correctly', () => {
      // Simulate a full hand: UTG opens, BTN 3bets, UTG calls, BTN cbets, UTG c/r
      const sequence = [
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 'preflop', 1),   // UTG opens
        createAction(1, PRIMITIVE_ACTIONS.RAISE, 'preflop', 2),   // BTN 3bets
        createAction(4, PRIMITIVE_ACTIONS.CALL, 'preflop', 3),    // UTG calls
        createAction(4, PRIMITIVE_ACTIONS.CHECK, 'flop', 4),      // UTG checks
        createAction(1, PRIMITIVE_ACTIONS.BET, 'flop', 5),        // BTN cbets
        createAction(4, PRIMITIVE_ACTIONS.RAISE, 'flop', 6),      // UTG c/r
        createAction(1, PRIMITIVE_ACTIONS.CALL, 'flop', 7),       // BTN calls
      ];

      const patterns = getAllPatterns(sequence, 1);

      expect(patterns[0].pattern).toBe(PATTERNS.OPEN);
      expect(patterns[1].pattern).toBe(PATTERNS.THREE_BET);
      expect(patterns[2].action).toBe(PRIMITIVE_ACTIONS.CALL);
      expect(patterns[3].pattern).toBe(PATTERNS.CHECK);
      expect(patterns[4].pattern).toBe(PATTERNS.CBET_IP);
      expect(patterns[5].pattern).toBe(PATTERNS.CHECK_RAISE);
    });
  });
});
