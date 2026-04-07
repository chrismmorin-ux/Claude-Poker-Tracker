// @vitest-environment jsdom
/**
 * EquityWorkerContext.test.jsx - Tests for singleton equity Worker provider (RT-27, RT-32)
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EquityWorkerProvider, useEquityWorker } from '../EquityWorkerContext';

// Workers are unavailable in jsdom — computeEquity falls back to main-thread handVsRange
vi.mock('../../utils/exploitEngine/monteCarloEquity', () => ({
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
});
