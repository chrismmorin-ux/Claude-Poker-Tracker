/**
 * useSeatColor.test.js - Tests for seat color styling hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeatColor } from '../useSeatColor';

describe('useSeatColor', () => {
  // Default mocks
  const createMocks = (overrides = {}) => ({
    hasSeatFolded: vi.fn(() => false),
    selectedPlayers: [],
    mySeat: 5,
    absentSeats: [],
    seatActions: {},
    currentStreet: 'preflop',
    getSeatActionStyle: vi.fn(() => ({ bg: 'bg-green-400', ring: 'ring-green-300' })),
    ...overrides,
  });

  const createHook = (overrides = {}) => {
    const mocks = createMocks(overrides);
    return renderHook(() =>
      useSeatColor(
        mocks.hasSeatFolded,
        mocks.selectedPlayers,
        mocks.mySeat,
        mocks.absentSeats,
        mocks.seatActions,
        mocks.currentStreet,
        mocks.getSeatActionStyle
      )
    );
  };

  describe('returns a function', () => {
    it('returns getSeatColor function', () => {
      const { result } = createHook();
      expect(typeof result.current).toBe('function');
    });
  });

  describe('absent seats', () => {
    it('returns gray/dim styling for absent seat', () => {
      const { result } = createHook({ absentSeats: [3] });
      const color = result.current(3);
      expect(color).toContain('bg-gray-900');
      expect(color).toContain('opacity-50');
    });

    it('adds purple ring for absent seat that is my seat', () => {
      const { result } = createHook({ absentSeats: [5], mySeat: 5 });
      const color = result.current(5);
      expect(color).toContain('ring-purple-500');
    });

    it('adds yellow ring for absent seat that is selected', () => {
      const { result } = createHook({ absentSeats: [3], selectedPlayers: [3] });
      const color = result.current(3);
      expect(color).toContain('ring-yellow-400');
      expect(color).toContain('animate-pulse');
    });
  });

  describe('folded seats', () => {
    it('returns red styling for folded seat', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 2);
      const { result } = createHook({ hasSeatFolded });
      const color = result.current(2);
      expect(color).toContain('bg-red-400');
      expect(color).toContain('ring-red-300');
    });

    it('uses yellow ring for selected folded seat', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 2);
      const { result } = createHook({ hasSeatFolded, selectedPlayers: [2] });
      const color = result.current(2);
      expect(color).toContain('bg-red-400');
      expect(color).toContain('ring-yellow-400');
    });

    it('uses purple ring for my folded seat', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 5);
      const { result } = createHook({ hasSeatFolded, mySeat: 5 });
      const color = result.current(5);
      expect(color).toContain('ring-purple-500');
    });
  });

  describe('my seat', () => {
    it('adds purple ring for my seat', () => {
      const { result } = createHook({ mySeat: 5 });
      const color = result.current(5);
      expect(color).toContain('ring-purple-500');
    });

    it('uses yellow ring with animation when my seat is selected', () => {
      const { result } = createHook({ mySeat: 5, selectedPlayers: [5] });
      const color = result.current(5);
      expect(color).toContain('ring-yellow-400');
      expect(color).toContain('animate-pulse');
    });
  });

  describe('selected seats', () => {
    it('adds yellow ring with animation for selected seat', () => {
      const { result } = createHook({ selectedPlayers: [3] });
      const color = result.current(3);
      expect(color).toContain('ring-yellow-400');
      expect(color).toContain('animate-pulse');
    });

    it('adds glow effect for selected seat', () => {
      const { result } = createHook({ selectedPlayers: [3] });
      const color = result.current(3);
      expect(color).toContain('shadow-lg');
      expect(color).toContain('shadow-yellow-400/50');
    });
  });

  describe('action-based colors', () => {
    it('uses getSeatActionStyle for seats with actions', () => {
      const getSeatActionStyle = vi.fn(() => ({ bg: 'bg-blue-300', ring: 'ring-blue-200' }));
      const { result } = createHook({
        seatActions: { preflop: { 3: ['call'] } },
        getSeatActionStyle,
      });
      const color = result.current(3);
      expect(getSeatActionStyle).toHaveBeenCalledWith('call');
      expect(color).toContain('bg-blue-300');
    });

    it('uses last action from array for color', () => {
      const getSeatActionStyle = vi.fn((action) => {
        if (action === '3bet') return { bg: 'bg-yellow-400', ring: 'ring-yellow-300' };
        return { bg: 'bg-green-400', ring: 'ring-green-300' };
      });
      const { result } = createHook({
        seatActions: { preflop: { 3: ['open', '3bet'] } },
        getSeatActionStyle,
      });
      result.current(3);
      expect(getSeatActionStyle).toHaveBeenCalledWith('3bet');
    });

    it('does not override selection ring with action ring', () => {
      const getSeatActionStyle = vi.fn(() => ({ bg: 'bg-blue-300', ring: 'ring-blue-200' }));
      const { result } = createHook({
        seatActions: { preflop: { 3: ['call'] } },
        selectedPlayers: [3],
        getSeatActionStyle,
      });
      const color = result.current(3);
      expect(color).toContain('ring-yellow-400');
      expect(color).not.toContain('ring-blue-200');
    });
  });

  describe('default/inactive seats', () => {
    it('returns default gray styling for seats with no actions', () => {
      const { result } = createHook();
      const color = result.current(3);
      expect(color).toContain('bg-gray-700');
    });

    it('adds hover effect for non-selected, non-my-seat, no-action seats', () => {
      const { result } = createHook({ mySeat: 5 });
      const color = result.current(3);
      expect(color).toContain('hover:bg-gray-600');
    });

    it('does not add hover effect for my seat', () => {
      const { result } = createHook({ mySeat: 5 });
      const color = result.current(5);
      expect(color).not.toContain('hover:bg-gray-600');
    });

    it('does not add hover effect for selected seat', () => {
      const { result } = createHook({ selectedPlayers: [3] });
      const color = result.current(3);
      expect(color).not.toContain('hover:bg-gray-600');
    });

    it('does not add hover effect for seats with actions', () => {
      const getSeatActionStyle = vi.fn(() => ({ bg: 'bg-blue-300', ring: 'ring-blue-200' }));
      const { result } = createHook({
        seatActions: { preflop: { 3: ['call'] } },
        getSeatActionStyle,
      });
      const color = result.current(3);
      expect(color).not.toContain('hover:bg-gray-600');
    });
  });

  describe('priority order', () => {
    it('absent takes priority over folded', () => {
      const hasSeatFolded = vi.fn(() => true);
      const { result } = createHook({ hasSeatFolded, absentSeats: [3] });
      const color = result.current(3);
      expect(color).toContain('bg-gray-900');
      expect(color).not.toContain('bg-red-400');
    });

    it('folded takes priority over action color', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 3);
      const getSeatActionStyle = vi.fn(() => ({ bg: 'bg-blue-300', ring: 'ring-blue-200' }));
      const { result } = createHook({
        hasSeatFolded,
        seatActions: { preflop: { 3: ['call'] } },
        getSeatActionStyle,
      });
      const color = result.current(3);
      expect(color).toContain('bg-red-400');
      expect(color).not.toContain('bg-blue-300');
    });
  });

  describe('function stability', () => {
    it('returns stable function when dependencies unchanged', () => {
      const { result, rerender } = createHook();
      const first = result.current;
      rerender();
      expect(result.current).toBe(first);
    });
  });

  describe('all seats', () => {
    it('works for all 9 seats', () => {
      const { result } = createHook();
      for (let seat = 1; seat <= 9; seat++) {
        expect(() => result.current(seat)).not.toThrow();
        expect(typeof result.current(seat)).toBe('string');
      }
    });
  });
});
