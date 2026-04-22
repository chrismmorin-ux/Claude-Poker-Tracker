// @vitest-environment jsdom
/**
 * EquityWorkerContext.test.jsx - Tests for singleton equity Worker provider (RT-27, RT-32)
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EquityWorkerProvider, useEquityWorker } from '../EquityWorkerContext';

// Workers are unavailable in jsdom — computeEquity falls back to main-thread handVsRange
vi.mock('../../utils/pokerCore/monteCarloEquity', () => ({
  handVsRange: vi.fn(() => Promise.resolve({ equity: 0.5, trials: 1000 })),
}));

const wrapper = ({ children }) => <EquityWorkerProvider>{children}</EquityWorkerProvider>;

describe('EquityWorkerContext', () => {
  it('provides computeEquity function', () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    expect(typeof result.current.computeEquity).toBe('function');
  });

  it('provides isWorkerReady boolean', () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    // Workers unavailable in jsdom → false
    expect(result.current.isWorkerReady).toBe(false);
  });

  it('provides isWorkerHealthy boolean', () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    // No Worker support in jsdom → unhealthy
    expect(result.current.isWorkerHealthy).toBe(false);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useEquityWorker());
    }).toThrow('useEquityWorker must be used within EquityWorkerProvider');
  });

  it('computeEquity falls back to main-thread handVsRange in test env', async () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    const eq = await result.current.computeEquity([0, 1], new Float64Array(169), [], { trials: 500 });
    expect(eq).toHaveProperty('equity');
    expect(eq.equity).toBe(0.5);
  });

  it('exposes all three context values', () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    expect(result.current).toHaveProperty('computeEquity');
    expect(result.current).toHaveProperty('isWorkerReady');
    expect(result.current).toHaveProperty('isWorkerHealthy');
  });

  // ---------- RT-116 — batch protocol ---------- //

  it('provides computeEquityBatch function', () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    expect(typeof result.current.computeEquityBatch).toBe('function');
  });

  it('computeEquityBatch returns an array result shape (fallback path)', async () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    const requests = [
      { heroCards: [0, 1], villainRange: new Float64Array(169), board: [], options: { trials: 100 } },
      { heroCards: [2, 3], villainRange: new Float64Array(169), board: [], options: { trials: 100 } },
      { heroCards: [4, 5], villainRange: new Float64Array(169), board: [], options: { trials: 100 } },
    ];
    const results = await result.current.computeEquityBatch(requests);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(3);
    for (const entry of results) {
      expect(entry).toHaveProperty('result');
      expect(entry.result).toEqual({ equity: 0.5, trials: 1000 });
    }
  });

  it('computeEquityBatch returns empty array for empty request list', async () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    const out = await result.current.computeEquityBatch([]);
    expect(out).toEqual([]);
  });

  it('computeEquityBatch rejects on non-array input', async () => {
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    await expect(result.current.computeEquityBatch('not-an-array')).rejects.toThrow(/must be an array/);
  });

  it('computeEquityBatch preserves request order in results (fallback path)', async () => {
    const { handVsRange } = await import('../../utils/pokerCore/monteCarloEquity');
    // Sequence: first call returns 0.3, second 0.7 — verify ordering.
    handVsRange.mockImplementationOnce(() => Promise.resolve({ equity: 0.3, trials: 10 }));
    handVsRange.mockImplementationOnce(() => Promise.resolve({ equity: 0.7, trials: 10 }));
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    const results = await result.current.computeEquityBatch([
      { heroCards: [0, 1], villainRange: new Float64Array(169), board: [], options: { trials: 10 } },
      { heroCards: [2, 3], villainRange: new Float64Array(169), board: [], options: { trials: 10 } },
    ]);
    expect(results[0].result.equity).toBe(0.3);
    expect(results[1].result.equity).toBe(0.7);
  });

  it('computeEquityBatch surfaces per-item failures as {error} without failing batch', async () => {
    const { handVsRange } = await import('../../utils/pokerCore/monteCarloEquity');
    handVsRange.mockImplementationOnce(() => Promise.resolve({ equity: 0.4, trials: 10 }));
    handVsRange.mockImplementationOnce(() => Promise.reject(new Error('bad combo')));
    const { result } = renderHook(() => useEquityWorker(), { wrapper });
    const results = await result.current.computeEquityBatch([
      { heroCards: [0, 1], villainRange: new Float64Array(169), board: [], options: {} },
      { heroCards: [2, 3], villainRange: new Float64Array(169), board: [], options: {} },
    ]);
    expect(results.length).toBe(2);
    expect(results[0]).toEqual({ result: { equity: 0.4, trials: 10 } });
    expect(results[1]).toEqual({ error: 'bad combo' });
  });
});
