/**
 * actionMigration.test.js - Tests for action sequence migration utilities
 *
 * Note: legacyToSequence uses toPrimitive() which maps legacy actions to primitives.
 * - 'fold' → 'fold'
 * - 'open' → 'raise' (first raise preflop)
 * - 'call' → 'call'
 * - 'check' → 'check'
 * - 'limp' → 'call'
 * Actions not in LEGACY_TO_PRIMITIVE are filtered out.
 */

import { describe, it, expect } from 'vitest';
import {
  migrateHandToSequence,
  batchMigrateHands,
  needsSequenceMigration
} from '../actionMigration';

describe('actionMigration', () => {
  describe('migrateHandToSequence', () => {
    it('converts seatActions to actionSequence', () => {
      const hand = {
        handId: 1,
        seatActions: {
          preflop: {
            1: ['fold'],
            2: ['open']  // 'open' maps to 'raise' via toPrimitive
          }
        }
      };

      const result = migrateHandToSequence(hand);

      expect(result.actionSequence).toBeDefined();
      expect(result.actionSequence).toHaveLength(2);
      expect(result.actionSequence[0]).toMatchObject({
        seat: 1,
        action: 'fold',
        street: 'preflop'
      });
      expect(result.actionSequence[1]).toMatchObject({
        seat: 2,
        action: 'raise',  // 'open' becomes 'raise'
        street: 'preflop'
      });
    });

    it('skips already-migrated hands', () => {
      const hand = {
        handId: 1,
        actionSequence: [
          { seat: 1, action: 'fold', street: 'preflop', order: 1 }
        ]
      };

      const result = migrateHandToSequence(hand);

      // Should return exact same object (not a copy)
      expect(result).toBe(hand);
    });

    it('handles empty seatActions', () => {
      const hand = { handId: 1 };

      const result = migrateHandToSequence(hand);

      expect(result.actionSequence).toEqual([]);
    });

    it('handles null/undefined input', () => {
      expect(migrateHandToSequence(null)).toBe(null);
      expect(migrateHandToSequence(undefined)).toBe(undefined);
    });

    it('handles nested gameState.seatActions', () => {
      const hand = {
        handId: 1,
        gameState: {
          seatActions: {
            preflop: {
              3: ['call'],
              5: ['open']  // 'open' maps to 'raise'
            }
          }
        }
      };

      const result = migrateHandToSequence(hand);

      expect(result.actionSequence).toHaveLength(2);
      expect(result.actionSequence[0].seat).toBe(3);
      expect(result.actionSequence[1].seat).toBe(5);
    });

    it('prefers top-level seatActions over gameState.seatActions', () => {
      const hand = {
        handId: 1,
        seatActions: {
          preflop: { 1: ['fold'] }
        },
        gameState: {
          seatActions: {
            preflop: { 2: ['raise'] }
          }
        }
      };

      const result = migrateHandToSequence(hand);

      // Should use top-level, so seat 1 fold, not seat 2 raise
      expect(result.actionSequence).toHaveLength(1);
      expect(result.actionSequence[0].seat).toBe(1);
    });

    it('preserves other hand fields', () => {
      const hand = {
        handId: 123,
        timestamp: 1702000000000,
        userId: 'guest',
        sessionId: 5,
        seatActions: {
          preflop: { 1: ['fold'] }
        }
      };

      const result = migrateHandToSequence(hand);

      expect(result.handId).toBe(123);
      expect(result.timestamp).toBe(1702000000000);
      expect(result.userId).toBe('guest');
      expect(result.sessionId).toBe(5);
    });

    it('handles multiple streets', () => {
      const hand = {
        seatActions: {
          preflop: { 1: ['call'], 2: ['open'] },  // 'open' → 'raise'
          flop: { 1: ['check'], 2: ['donk'] },     // 'donk' → 'bet'
          turn: { 1: ['fold'] }
        }
      };

      const result = migrateHandToSequence(hand);

      expect(result.actionSequence).toHaveLength(5);

      // Actions should be ordered by street, then by seat
      const preflopActions = result.actionSequence.filter(a => a.street === 'preflop');
      const flopActions = result.actionSequence.filter(a => a.street === 'flop');
      const turnActions = result.actionSequence.filter(a => a.street === 'turn');

      expect(preflopActions).toHaveLength(2);
      expect(flopActions).toHaveLength(2);
      expect(turnActions).toHaveLength(1);
    });

    it('handles multiple actions per seat', () => {
      const hand = {
        seatActions: {
          preflop: {
            1: ['call', '3bet']  // Player acted twice: call then 3bet → 'call', 'raise'
          }
        }
      };

      const result = migrateHandToSequence(hand);

      expect(result.actionSequence).toHaveLength(2);
      expect(result.actionSequence[0].action).toBe('call');
      expect(result.actionSequence[1].action).toBe('raise');  // '3bet' → 'raise'
    });

    it('assigns sequential order numbers', () => {
      const hand = {
        seatActions: {
          preflop: { 1: ['fold'], 2: ['fold'], 3: ['fold'] }
        }
      };

      const result = migrateHandToSequence(hand);

      expect(result.actionSequence[0].order).toBe(1);
      expect(result.actionSequence[1].order).toBe(2);
      expect(result.actionSequence[2].order).toBe(3);
    });
  });

  describe('batchMigrateHands', () => {
    it('processes array of hands', () => {
      const hands = [
        { handId: 1, seatActions: { preflop: { 1: ['fold'] } } },
        { handId: 2, seatActions: { preflop: { 2: ['raise'] } } }
      ];

      const result = batchMigrateHands(hands);

      expect(result).toHaveLength(2);
      expect(result[0].actionSequence).toBeDefined();
      expect(result[1].actionSequence).toBeDefined();
    });

    it('returns empty array for invalid input', () => {
      expect(batchMigrateHands(null)).toEqual([]);
      expect(batchMigrateHands(undefined)).toEqual([]);
      expect(batchMigrateHands('not an array')).toEqual([]);
    });

    it('handles empty array', () => {
      expect(batchMigrateHands([])).toEqual([]);
    });
  });

  describe('needsSequenceMigration', () => {
    it('returns true for hand with seatActions but no actionSequence', () => {
      const hand = {
        seatActions: { preflop: { 1: ['fold'] } }
      };

      expect(needsSequenceMigration(hand)).toBe(true);
    });

    it('returns false for hand with existing actionSequence', () => {
      const hand = {
        actionSequence: [{ seat: 1, action: 'fold', street: 'preflop', order: 1 }]
      };

      expect(needsSequenceMigration(hand)).toBe(false);
    });

    it('returns false for hand with no seatActions', () => {
      const hand = { handId: 1 };

      expect(needsSequenceMigration(hand)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(needsSequenceMigration(null)).toBe(false);
      expect(needsSequenceMigration(undefined)).toBe(false);
    });

    it('returns true for gameState.seatActions', () => {
      const hand = {
        gameState: {
          seatActions: { preflop: { 1: ['fold'] } }
        }
      };

      expect(needsSequenceMigration(hand)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles malformed seatActions gracefully', () => {
      const hand = {
        seatActions: {
          preflop: 'not an object'
        }
      };

      // Should not throw
      const result = migrateHandToSequence(hand);
      expect(result.actionSequence).toBeDefined();
    });

    it('handles non-array action values', () => {
      const hand = {
        seatActions: {
          preflop: {
            1: 'fold'  // String instead of array
          }
        }
      };

      // legacyToSequence handles this - it filters out non-arrays
      const result = migrateHandToSequence(hand);
      expect(result.actionSequence).toBeDefined();
    });

    it('handles empty street objects', () => {
      const hand = {
        seatActions: {
          preflop: {},
          flop: {}
        }
      };

      const result = migrateHandToSequence(hand);
      expect(result.actionSequence).toEqual([]);
    });

    it('skips hand with empty actionSequence array', () => {
      // Empty array means no actions recorded, but still needs migration
      const hand = {
        actionSequence: [],
        seatActions: { preflop: { 1: ['fold'] } }
      };

      const result = migrateHandToSequence(hand);

      // Should migrate since actionSequence is empty
      expect(result.actionSequence.length).toBeGreaterThan(0);
    });
  });
});
