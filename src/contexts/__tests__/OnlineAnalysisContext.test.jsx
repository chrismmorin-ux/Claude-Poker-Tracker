// @vitest-environment jsdom
/**
 * OnlineAnalysisContext.test.jsx - Tests for analysis pipeline provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { OnlineAnalysisProvider, useOnlineAnalysis2 } from '../OnlineAnalysisContext';

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

const wrapper = ({ children }) => <OnlineAnalysisProvider>{children}</OnlineAnalysisProvider>;

describe('OnlineAnalysisContext', () => {
  it('provides analysis state', () => {
    const { result } = renderHook(() => useOnlineAnalysis2(), { wrapper });
    expect(result.current.tendencyMap).toEqual({});
    expect(result.current.handCount).toBe(0);
    expect(result.current.advice).toBe(null);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useOnlineAnalysis2());
    }).toThrow('useOnlineAnalysis2 must be used within OnlineAnalysisProvider');
  });
});
