// @vitest-environment jsdom
/**
 * useSeatColor.test.js - Tests for seat color styling hook
 * Returns { className, style } tuples with hex color values.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeatColor } from '../useSeatColor';

// Helper to create action entries for the actionSequence format
const entry = (seat, action, street = 'preflop', order = 1) => ({
  seat, action, street, order,
});

// Mock getSeatActionStyle from actionUtils (now returns hex values)
vi.mock('../../utils/actionUtils', () => ({
  getSeatActionStyle: vi.fn((action) => {
    if (action === 'call') return { bg: '#2563eb', ring: '#93c5fd' };
    if (action === 'raise') return { bg: '#ea580c', ring: '#fdba74' };
    return { bg: '#16a34a', ring: '#86efac' };
  }),
}));

import { getSeatActionStyle } from '../../utils/actionUtils';

describe('useSeatColor', () => {
  // Default mocks
  const createMocks = (overrides = {}) => ({
    hasSeatFolded: vi.fn(() => false),
    selectedPlayers: [],
    mySeat: 5,
    absentSeats: [],
    actionSequence: [],
    currentStreet: 'preflop',
    smallBlindSeat: 2,
    bigBlindSeat: 3,
    ...overrides,
  });

  const createHook = (overrides = {}) => {
    const mocks = createMocks(overrides);
    return renderHook(() =>
      useSeatColor({
        hasSeatFolded: mocks.hasSeatFolded,
        selectedPlayers: mocks.selectedPlayers,
        mySeat: mocks.mySeat,
        absentSeats: mocks.absentSeats,
        actionSequence: mocks.actionSequence,
        currentStreet: mocks.currentStreet,
        smallBlindSeat: mocks.smallBlindSeat,
        bigBlindSeat: mocks.bigBlindSeat,
      })
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
      const { className, style } = result.current(3);
      expect(style.backgroundColor).toBe('#111827');
      expect(className).toContain('opacity-50');
    });

    it('adds purple ring for absent seat that is my seat', () => {
      const { result } = createHook({ absentSeats: [5], mySeat: 5 });
      const { className, style } = result.current(5);
      expect(className).toContain('ring-4');
      expect(style['--tw-ring-color']).toBe('#a855f7');
    });

    it('adds yellow ring for absent seat that is selected', () => {
      const { result } = createHook({ absentSeats: [3], selectedPlayers: [3] });
      const { className, style } = result.current(3);
      expect(style['--tw-ring-color']).toBe('#facc15');
      expect(className).toContain('animate-pulse');
    });
  });

  describe('folded seats', () => {
    it('returns red styling for folded seat', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 2);
      const { result } = createHook({ hasSeatFolded });
      const { className, style } = result.current(2);
      expect(style.backgroundColor).toBe('#dc2626');
      expect(style['--tw-ring-color']).toBe('#fca5a5');
      expect(className).toContain('ring-4');
    });

    it('uses yellow ring for selected folded seat', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 2);
      const { result } = createHook({ hasSeatFolded, selectedPlayers: [2] });
      const { style } = result.current(2);
      expect(style.backgroundColor).toBe('#dc2626');
      expect(style['--tw-ring-color']).toBe('#facc15');
    });

    it('uses purple ring for my folded seat', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 5);
      const { result } = createHook({ hasSeatFolded, mySeat: 5 });
      const { style } = result.current(5);
      expect(style['--tw-ring-color']).toBe('#a855f7');
    });
  });

  describe('my seat', () => {
    it('adds purple ring for my seat', () => {
      const { result } = createHook({ mySeat: 5 });
      const { className, style } = result.current(5);
      expect(className).toContain('ring-4');
      expect(style['--tw-ring-color']).toBe('#a855f7');
    });

    it('uses yellow ring with animation when my seat is selected', () => {
      const { result } = createHook({ mySeat: 5, selectedPlayers: [5] });
      const { className, style } = result.current(5);
      expect(style['--tw-ring-color']).toBe('#facc15');
      expect(className).toContain('animate-pulse');
    });
  });

  describe('selected seats', () => {
    it('adds yellow ring with animation for selected seat', () => {
      const { result } = createHook({ selectedPlayers: [3] });
      const { className, style } = result.current(3);
      expect(style['--tw-ring-color']).toBe('#facc15');
      expect(className).toContain('animate-pulse');
    });

    it('adds glow effect for selected seat', () => {
      const { result } = createHook({ selectedPlayers: [3] });
      const { className } = result.current(3);
      expect(className).toContain('shadow-lg');
      expect(className).toContain('shadow-yellow-400/50');
    });
  });

  describe('action-based colors', () => {
    it('uses getSeatActionStyle for seats with actions', () => {
      vi.mocked(getSeatActionStyle).mockReturnValue({ bg: '#2563eb', ring: '#93c5fd' });
      const { result } = createHook({
        actionSequence: [entry(3, 'call', 'preflop')],
      });
      const { style } = result.current(3);
      expect(getSeatActionStyle).toHaveBeenCalledWith('call');
      expect(style.backgroundColor).toBe('#2563eb');
    });

    it('uses last action from sequence for color', () => {
      vi.mocked(getSeatActionStyle).mockImplementation((action) => {
        if (action === 'raise') return { bg: '#ea580c', ring: '#fdba74' };
        return { bg: '#16a34a', ring: '#86efac' };
      });
      const { result } = createHook({
        actionSequence: [
          entry(3, 'call', 'preflop', 1),
          entry(3, 'raise', 'preflop', 2),
        ],
      });
      result.current(3);
      expect(getSeatActionStyle).toHaveBeenCalledWith('raise');
    });

    it('does not override selection ring with action ring', () => {
      vi.mocked(getSeatActionStyle).mockReturnValue({ bg: '#2563eb', ring: '#93c5fd' });
      const { result } = createHook({
        actionSequence: [entry(3, 'call', 'preflop')],
        selectedPlayers: [3],
      });
      const { style } = result.current(3);
      expect(style['--tw-ring-color']).toBe('#facc15'); // yellow selection, not blue action
    });
  });

  describe('blind seats', () => {
    it('colors SB seat with blind style on preflop with no actions', () => {
      vi.mocked(getSeatActionStyle).mockImplementation((action) => {
        if (action === 'blind') return { bg: '#0891b2', ring: '#67e8f9' };
        return { bg: '#16a34a', ring: '#86efac' };
      });
      const { result } = createHook({ smallBlindSeat: 2, bigBlindSeat: 3 });
      const { style } = result.current(2);
      expect(getSeatActionStyle).toHaveBeenCalledWith('blind');
      expect(style.backgroundColor).toBe('#0891b2');
    });

    it('colors BB seat with blind style on preflop with no actions', () => {
      vi.mocked(getSeatActionStyle).mockImplementation((action) => {
        if (action === 'blind') return { bg: '#0891b2', ring: '#67e8f9' };
        return { bg: '#16a34a', ring: '#86efac' };
      });
      const { result } = createHook({ smallBlindSeat: 2, bigBlindSeat: 3 });
      const { style } = result.current(3);
      expect(style.backgroundColor).toBe('#0891b2');
    });

    it('does not color blind seats on postflop streets', () => {
      const { result } = createHook({ currentStreet: 'flop', smallBlindSeat: 2, bigBlindSeat: 3 });
      const { style } = result.current(2);
      expect(style.backgroundColor).toBe('#374151'); // default gray
    });

    it('action color overrides blind color when seat has actions', () => {
      vi.mocked(getSeatActionStyle).mockReturnValue({ bg: '#2563eb', ring: '#93c5fd' });
      const { result } = createHook({
        smallBlindSeat: 2,
        bigBlindSeat: 3,
        actionSequence: [entry(2, 'call', 'preflop')],
      });
      const { style } = result.current(2);
      expect(getSeatActionStyle).toHaveBeenCalledWith('call');
      expect(style.backgroundColor).toBe('#2563eb');
    });
  });

  describe('default/inactive seats', () => {
    it('returns default gray styling for seats with no actions', () => {
      const { result } = createHook();
      const { style } = result.current(7); // seat 7 — not SB/BB
      expect(style.backgroundColor).toBe('#374151');
    });

    it('adds hover effect for non-selected, non-my-seat, no-action seats', () => {
      const { result } = createHook({ mySeat: 5 });
      const { className } = result.current(7); // seat 7 — not SB/BB
      expect(className).toContain('hover:bg-gray-600');
    });

    it('does not add hover effect for my seat', () => {
      const { result } = createHook({ mySeat: 5 });
      const { className } = result.current(5);
      expect(className).not.toContain('hover:bg-gray-600');
    });

    it('does not add hover effect for selected seat', () => {
      const { result } = createHook({ selectedPlayers: [3] });
      const { className } = result.current(3);
      expect(className).not.toContain('hover:bg-gray-600');
    });

    it('does not add hover effect for seats with actions', () => {
      vi.mocked(getSeatActionStyle).mockReturnValue({ bg: '#2563eb', ring: '#93c5fd' });
      const { result } = createHook({
        actionSequence: [entry(3, 'call', 'preflop')],
      });
      const { className } = result.current(3);
      expect(className).not.toContain('hover:bg-gray-600');
    });
  });

  describe('priority order', () => {
    it('absent takes priority over folded', () => {
      const hasSeatFolded = vi.fn(() => true);
      const { result } = createHook({ hasSeatFolded, absentSeats: [3] });
      const { style } = result.current(3);
      expect(style.backgroundColor).toBe('#111827');
    });

    it('folded takes priority over action color', () => {
      const hasSeatFolded = vi.fn((seat) => seat === 3);
      vi.mocked(getSeatActionStyle).mockReturnValue({ bg: '#2563eb', ring: '#93c5fd' });
      const { result } = createHook({
        hasSeatFolded,
        actionSequence: [entry(3, 'call', 'preflop')],
      });
      const { style } = result.current(3);
      expect(style.backgroundColor).toBe('#dc2626');
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
    it('works for all 9 seats returning { className, style }', () => {
      const { result } = createHook();
      for (let seat = 1; seat <= 9; seat++) {
        const val = result.current(seat);
        expect(val).toHaveProperty('className');
        expect(val).toHaveProperty('style');
        expect(typeof val.className).toBe('string');
        expect(typeof val.style).toBe('object');
      }
    });
  });
});
