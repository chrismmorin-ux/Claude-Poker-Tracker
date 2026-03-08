// @vitest-environment jsdom
/**
 * useActionAdvisor.test.js - Tests for action advisor React hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useActionAdvisor } from '../useActionAdvisor';

vi.mock('../../utils/exploitEngine/actionAdvisor', () => ({
  getActionAdvice: vi.fn(),
}));

vi.mock('../../utils/exploitEngine/cardParser', () => ({
  parseAndEncode: vi.fn((str) => {
    const map = { As: 48, Kh: 45, '7c': 19, '2d': 2, Td: 34 };
    return map[str] ?? -1;
  }),
}));

import { getActionAdvice } from '../../utils/exploitEngine/actionAdvisor';

const validInput = {
  villainRange: new Float64Array(169),
  boardCards: ['7c', '2d', 'Td'],
  heroCardStrings: ['As', 'Kh'],
  potSize: 100,
  villainAction: 'bet',
};

const mockResult = {
  heroEquity: 0.62,
  recommendations: [{ action: 'bet', ev: 45 }],
};

describe('useActionAdvisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initial state: advice null, not computing, no error', () => {
    const { result } = renderHook(() => useActionAdvisor());
    expect(result.current.advice).toBeNull();
    expect(result.current.isComputing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.compute).toBe('function');
    expect(typeof result.current.clear).toBe('function');
  });

  it('compute() resolves with advice', async () => {
    getActionAdvice.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute(validInput);
    });

    expect(result.current.advice).toEqual(mockResult);
    expect(result.current.isComputing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('compute() with invalid hero cards sets error', async () => {
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute({
        ...validInput,
        heroCardStrings: ['Zz', 'Yy'], // parseAndEncode returns -1
      });
    });

    expect(result.current.error).toBe('Exactly 2 valid hero cards required');
    expect(result.current.advice).toBeNull();
    expect(result.current.isComputing).toBe(false);
  });

  it('compute() with too few board cards sets error', async () => {
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute({
        ...validInput,
        boardCards: ['7c', 'Zz'], // only 1 valid card
      });
    });

    expect(result.current.error).toBe('At least 3 board cards required');
    expect(result.current.advice).toBeNull();
  });

  it('clear() resets state', async () => {
    getActionAdvice.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute(validInput);
    });

    expect(result.current.advice).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(result.current.advice).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isComputing).toBe(false);
  });

  it('rapid double-call only keeps latest result (abort)', async () => {
    let callCount = 0;
    getActionAdvice.mockImplementation(() => {
      callCount++;
      const thisCall = callCount;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ heroEquity: thisCall === 1 ? 0.3 : 0.7, call: thisCall });
        }, thisCall === 1 ? 50 : 10);
      });
    });

    const { result } = renderHook(() => useActionAdvisor());

    // Fire two calls — first is slow, second is fast
    await act(async () => {
      result.current.compute(validInput); // call 1, slow
      result.current.compute(validInput); // call 2, fast — aborts call 1
      // Wait for both to complete
      await new Promise((r) => setTimeout(r, 100));
    });

    // Only the second (latest) result should be kept
    expect(result.current.advice.call).toBe(2);
    expect(result.current.advice.heroEquity).toBe(0.7);
  });
});
