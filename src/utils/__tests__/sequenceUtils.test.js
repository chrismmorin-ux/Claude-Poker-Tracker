/**
 * sequenceUtils.test.js - Tests for action sequence utilities
 */

import { describe, it, expect } from 'vitest';
import {
  legacyToSequence,
  sequenceToLegacy,
  summarizeByStreet,
  getPreflopAggressor,
  getActivePlayers,
  hasActedOnStreet,
  getPlayersInPot,
  wouldBeColdCall,
  wouldBeSqueeze,
} from '../sequenceUtils';

describe('sequenceUtils', () => {
  describe('legacyToSequence', () => {
    it('converts empty object to empty array', () => {
      expect(legacyToSequence({})).toEqual([]);
    });

    it('returns empty array for null/undefined', () => {
      expect(legacyToSequence(null)).toEqual([]);
      expect(legacyToSequence(undefined)).toEqual([]);
    });

    it('converts single street actions', () => {
      const legacy = {
        preflop: {
          1: ['fold'],
          2: ['call'],
          3: ['open'],
        },
      };
      const result = legacyToSequence(legacy);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ seat: 1, action: 'fold', street: 'preflop' });
      expect(result[1]).toMatchObject({ seat: 2, action: 'call', street: 'preflop' });
      expect(result[2]).toMatchObject({ seat: 3, action: 'raise', street: 'preflop' }); // open -> raise
    });

    it('converts multiple actions per seat', () => {
      const legacy = {
        preflop: {
          1: ['call', '3bet'],
        },
      };
      const result = legacyToSequence(legacy);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ seat: 1, action: 'call', street: 'preflop', order: 1 });
      expect(result[1]).toMatchObject({ seat: 1, action: 'raise', street: 'preflop', order: 2 });
    });

    it('converts multi-street actions in correct order', () => {
      const legacy = {
        preflop: { 1: ['call'] },
        flop: { 1: ['check'] },
        turn: { 1: ['stab'] }, // 'stab' maps to 'bet'
      };
      const result = legacyToSequence(legacy);

      expect(result).toHaveLength(3);
      expect(result[0].street).toBe('preflop');
      expect(result[1].street).toBe('flop');
      expect(result[2].street).toBe('turn');
    });

    it('filters out showdown actions (won, mucked)', () => {
      const legacy = {
        preflop: { 1: ['call'] },
        showdown: { 1: ['won'], 2: ['mucked'] },
      };
      const result = legacyToSequence(legacy);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('call');
    });

    it('assigns sequential order numbers', () => {
      const legacy = {
        preflop: {
          1: ['fold'],
          2: ['open'],
        },
        flop: {
          2: ['cbet_ip_small'],
        },
      };
      const result = legacyToSequence(legacy);

      expect(result[0].order).toBe(1);
      expect(result[1].order).toBe(2);
      expect(result[2].order).toBe(3);
    });
  });

  describe('sequenceToLegacy', () => {
    it('converts empty sequence to empty object', () => {
      expect(sequenceToLegacy([])).toEqual({});
    });

    it('returns empty object for null/undefined', () => {
      expect(sequenceToLegacy(null)).toEqual({});
      expect(sequenceToLegacy(undefined)).toEqual({});
    });

    it('converts sequence to legacy format', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
        { seat: 3, action: 'call', street: 'preflop', order: 3 },
      ];
      const result = sequenceToLegacy(sequence);

      expect(result).toEqual({
        preflop: {
          1: ['fold'],
          2: ['raise'],
          3: ['call'],
        },
      });
    });

    it('groups multiple actions per seat', () => {
      const sequence = [
        { seat: 1, action: 'call', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
        { seat: 1, action: 'raise', street: 'preflop', order: 3 },
      ];
      const result = sequenceToLegacy(sequence);

      expect(result.preflop[1]).toEqual(['call', 'raise']);
    });

    it('handles multi-street sequences', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 1, action: 'bet', street: 'flop', order: 2 },
      ];
      const result = sequenceToLegacy(sequence);

      expect(result.preflop[1]).toEqual(['raise']);
      expect(result.flop[1]).toEqual(['bet']);
    });
  });

  describe('summarizeByStreet', () => {
    it('returns empty object for empty sequence', () => {
      expect(summarizeByStreet([], 'preflop')).toEqual({});
    });

    it('summarizes actions by seat', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
        { seat: 3, action: 'call', street: 'preflop', order: 3 },
      ];
      const result = summarizeByStreet(sequence, 'preflop');

      expect(result).toEqual({
        1: ['fold'],
        2: ['raise'],
        3: ['call'],
      });
    });

    it('only includes actions from specified street', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 1, action: 'bet', street: 'flop', order: 2 },
      ];
      const result = summarizeByStreet(sequence, 'flop');

      expect(result).toEqual({
        1: ['bet'],
      });
    });
  });

  describe('getPreflopAggressor', () => {
    it('returns null for no raises', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
      ];
      expect(getPreflopAggressor(sequence)).toBe(null);
    });

    it('returns seat of single raiser', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
        { seat: 3, action: 'call', street: 'preflop', order: 3 },
      ];
      expect(getPreflopAggressor(sequence)).toBe(2);
    });

    it('returns seat of last raiser (3-bettor)', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 }, // Open
        { seat: 2, action: 'raise', street: 'preflop', order: 2 }, // 3-bet
        { seat: 1, action: 'call', street: 'preflop', order: 3 },
      ];
      expect(getPreflopAggressor(sequence)).toBe(2);
    });

    it('ignores postflop raises', () => {
      const sequence = [
        { seat: 1, action: 'call', street: 'preflop', order: 1 },
        { seat: 1, action: 'raise', street: 'flop', order: 2 },
      ];
      expect(getPreflopAggressor(sequence)).toBe(null);
    });
  });

  describe('getActivePlayers', () => {
    it('returns empty array for empty sequence', () => {
      expect(getActivePlayers([])).toEqual([]);
    });

    it('returns all seats that have acted', () => {
      const sequence = [
        { seat: 1, action: 'call', street: 'preflop', order: 1 },
        { seat: 3, action: 'raise', street: 'preflop', order: 2 },
        { seat: 5, action: 'call', street: 'preflop', order: 3 },
      ];
      expect(getActivePlayers(sequence)).toEqual([1, 3, 5]);
    });

    it('excludes folded players', () => {
      const sequence = [
        { seat: 1, action: 'fold', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
        { seat: 3, action: 'call', street: 'preflop', order: 3 },
      ];
      expect(getActivePlayers(sequence)).toEqual([2, 3]);
    });

    it('returns sorted seat numbers', () => {
      const sequence = [
        { seat: 5, action: 'call', street: 'preflop', order: 1 },
        { seat: 1, action: 'raise', street: 'preflop', order: 2 },
        { seat: 3, action: 'call', street: 'preflop', order: 3 },
      ];
      expect(getActivePlayers(sequence)).toEqual([1, 3, 5]);
    });
  });

  describe('hasActedOnStreet', () => {
    const sequence = [
      { seat: 1, action: 'raise', street: 'preflop', order: 1 },
      { seat: 2, action: 'call', street: 'preflop', order: 2 },
      { seat: 1, action: 'bet', street: 'flop', order: 3 },
    ];

    it('returns true if seat acted on street', () => {
      expect(hasActedOnStreet(sequence, 1, 'preflop')).toBe(true);
      expect(hasActedOnStreet(sequence, 1, 'flop')).toBe(true);
    });

    it('returns false if seat has not acted on street', () => {
      expect(hasActedOnStreet(sequence, 2, 'flop')).toBe(false);
      expect(hasActedOnStreet(sequence, 3, 'preflop')).toBe(false);
    });
  });

  describe('getPlayersInPot', () => {
    it('returns 0 for no money actions', () => {
      const sequence = [
        { seat: 1, action: 'check', street: 'flop', order: 1 },
        { seat: 2, action: 'check', street: 'flop', order: 2 },
      ];
      expect(getPlayersInPot(sequence, 'flop')).toBe(0);
    });

    it('counts unique players with money in', () => {
      const sequence = [
        { seat: 1, action: 'bet', street: 'flop', order: 1 },
        { seat: 2, action: 'call', street: 'flop', order: 2 },
        { seat: 3, action: 'raise', street: 'flop', order: 3 },
      ];
      expect(getPlayersInPot(sequence, 'flop')).toBe(3);
    });

    it('only counts for specified street', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 1, action: 'bet', street: 'flop', order: 3 },
      ];
      expect(getPlayersInPot(sequence, 'flop')).toBe(1);
    });
  });

  describe('wouldBeColdCall', () => {
    it('returns false if seat already acted', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
      ];
      expect(wouldBeColdCall(sequence, 2, 'preflop')).toBe(false);
    });

    it('returns false if no bet to call', () => {
      const sequence = [
        { seat: 1, action: 'check', street: 'flop', order: 1 },
      ];
      expect(wouldBeColdCall(sequence, 2, 'flop')).toBe(false);
    });

    it('returns true if calling raise without prior action', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
      ];
      expect(wouldBeColdCall(sequence, 3, 'preflop')).toBe(true);
    });

    it('returns true for cold-calling a 3-bet', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'raise', street: 'preflop', order: 2 },
      ];
      expect(wouldBeColdCall(sequence, 4, 'preflop')).toBe(true);
    });
  });

  describe('wouldBeSqueeze', () => {
    it('returns false with no raises', () => {
      const sequence = [
        { seat: 1, action: 'call', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
      ];
      expect(wouldBeSqueeze(sequence, 3)).toBe(false);
    });

    it('returns false with no callers after raise', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
      ];
      expect(wouldBeSqueeze(sequence, 3)).toBe(false);
    });

    it('returns true with one caller after raise', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
      ];
      expect(wouldBeSqueeze(sequence, 3)).toBe(true);
    });

    it('returns true with multiple callers after raise', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 3, action: 'call', street: 'preflop', order: 3 },
      ];
      expect(wouldBeSqueeze(sequence, 4)).toBe(true);
    });

    it('returns false if already a 3-bet (two raises)', () => {
      const sequence = [
        { seat: 1, action: 'raise', street: 'preflop', order: 1 },
        { seat: 2, action: 'call', street: 'preflop', order: 2 },
        { seat: 3, action: 'raise', street: 'preflop', order: 3 },
      ];
      expect(wouldBeSqueeze(sequence, 4)).toBe(false);
    });
  });
});
