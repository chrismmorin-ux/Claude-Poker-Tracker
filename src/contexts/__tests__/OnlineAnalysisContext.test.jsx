// @vitest-environment jsdom
/**
 * OnlineAnalysisContext.test.jsx - Tests for analysis pipeline provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { OnlineAnalysisProvider, useOnlineAnalysisContext } from '../OnlineAnalysisContext';

// Mutable mock for SyncBridge so per-test we can flip versionMismatch
// without re-defining the module mock every time.
const mockSyncBridge = {
  liveHandState: null,
  pushExploits: vi.fn(),
  pushAdvice: vi.fn(),
  isExtensionConnected: false,
  versionMismatch: false,
};

const liveActionAdvisorSpy = vi.fn(() => ({ advice: null, isComputing: false }));

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../SyncBridgeContext', () => ({
  useSyncBridge: () => mockSyncBridge,
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
  useLiveActionAdvisor: (...args) => liveActionAdvisorSpy(...args),
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

beforeEach(() => {
  // Reset per-test
  mockSyncBridge.liveHandState = null;
  mockSyncBridge.versionMismatch = false;
  mockSyncBridge.isExtensionConnected = false;
  liveActionAdvisorSpy.mockClear();
});

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

  // WS-077: live-flow advice gating
  it('passes liveHandState through to advisor when versions match', () => {
    const fakeLiveHandState = { tableId: 't1', currentStreet: 'flop', actionSequence: [] };
    mockSyncBridge.liveHandState = fakeLiveHandState;
    mockSyncBridge.versionMismatch = false;

    renderHook(() => useOnlineAnalysisContext(), { wrapper });

    expect(liveActionAdvisorSpy).toHaveBeenCalled();
    expect(liveActionAdvisorSpy.mock.calls[0][0]).toBe(fakeLiveHandState);
  });

  it('passes null to advisor when versionMismatch is true (suppresses live advice)', () => {
    const fakeLiveHandState = { tableId: 't1', currentStreet: 'flop', actionSequence: [] };
    mockSyncBridge.liveHandState = fakeLiveHandState;
    mockSyncBridge.versionMismatch = true;

    renderHook(() => useOnlineAnalysisContext(), { wrapper });

    expect(liveActionAdvisorSpy).toHaveBeenCalled();
    expect(liveActionAdvisorSpy.mock.calls[0][0]).toBe(null);
  });
});
