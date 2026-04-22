// @vitest-environment jsdom
/**
 * OnlineAnalysisContext.test.jsx - Tests for analysis pipeline provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { OnlineAnalysisProvider, useOnlineAnalysisContext } from '../OnlineAnalysisContext';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../SyncBridgeContext', () => ({
  useSyncBridge: () => ({
    liveHandState: null,
    pushExploits: vi.fn(),
    pushAdvice: vi.fn(),
    isExtensionConnected: false,
  }),
}));

vi.mock('../OnlineSessionContext', () => ({
  useOnlineSession: () => ({
    selectedSessionId: null,
  }),
}));

vi.mock('../../hooks/useOnlineAnalysis', () => ({
  useOnlineAnalysis: () => ({
    tendencyMap: {},
    handCount: 0,
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useLiveActionAdvisor', () => ({
  useLiveActionAdvisor: () => ({
    advice: null,
    isComputing: false,
  }),
}));

vi.mock('../../utils/persistence/database', () => ({
  GUEST_USER_ID: 'guest',
}));

vi.mock('../EquityWorkerContext', () => ({
  useEquityWorker: () => ({
    computeEquity: vi.fn(),
    isWorkerReady: false,
  }),
}));

const wrapper = ({ children }) => <OnlineAnalysisProvider>{children}</OnlineAnalysisProvider>;

describe('OnlineAnalysisContext', () => {
  it('provides analysis state', () => {
    const { result } = renderHook(() => useOnlineAnalysisContext(), { wrapper });
    expect(result.current.tendencyMap).toEqual({});
    expect(result.current.handCount).toBe(0);
    expect(result.current.advice).toBe(null);
  });

  it('throws when used outside provider', () => {
    // AUDIT-2026-04-21-TV F11: error message reflects the canonical name
    // `useAnalysisContext`. The `useOnlineAnalysisContext` symbol is retained as a
    // deprecated alias that delegates to the same implementation, so its error
    // message surfaces the canonical name — that's the intended behavior.
    expect(() => {
      renderHook(() => useOnlineAnalysisContext());
    }).toThrow('useAnalysisContext must be used within OnlineAnalysisProvider');
  });
});
