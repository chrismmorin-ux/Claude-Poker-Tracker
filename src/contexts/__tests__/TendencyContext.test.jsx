// @vitest-environment jsdom
/**
 * TendencyContext.test.jsx - Tests for shared player tendency context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TendencyProvider, useTendency } from '../TendencyContext';

// Mock PlayerContext (TendencyProvider calls usePlayer internally)
vi.mock('../PlayerContext', () => ({
  usePlayer: () => ({ allPlayers: [] }),
}));

// Mock usePlayerTendencies hook
vi.mock('../../hooks/usePlayerTendencies', () => ({
  usePlayerTendencies: () => ({
    tendencyMap: { p1: { vpip: 25 } },
    setTendencyMap: vi.fn(),
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

const wrapper = ({ children }) => <TendencyProvider>{children}</TendencyProvider>;

describe('TendencyContext', () => {
  it('provides tendencyMap and helpers', () => {
    const { result } = renderHook(() => useTendency(), { wrapper });
    expect(result.current.tendencyMap).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.refresh).toBe('function');
    expect(typeof result.current.patchTendency).toBe('function');
  });

  it('exposes tendencyMap data from usePlayerTendencies', () => {
    const { result } = renderHook(() => useTendency(), { wrapper });
    expect(result.current.tendencyMap.p1.vpip).toBe(25);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useTendency());
    }).toThrow('useTendency must be used within TendencyProvider');
  });
});
