// @vitest-environment jsdom
/**
 * OnlineSessionContext.test.jsx - Tests for online session CRUD provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { OnlineSessionProvider, useOnlineSession } from '../OnlineSessionContext';

// Mock dependencies
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../SyncBridgeContext', () => ({
  useSyncBridge: () => ({
    importedCount: 0,
  }),
}));

vi.mock('../../utils/persistence/sessionsStorage', () => ({
  getAllSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/persistence/database', () => ({
  GUEST_USER_ID: 'guest',
}));

vi.mock('../../utils/errorHandler', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const wrapper = ({ children }) => <OnlineSessionProvider>{children}</OnlineSessionProvider>;

describe('OnlineSessionContext', () => {
  it('provides session CRUD state', () => {
    const { result } = renderHook(() => useOnlineSession(), { wrapper });
    expect(result.current.selectedSessionId).toBe(null);
    expect(result.current.onlineSessions).toEqual([]);
    expect(typeof result.current.setSelectedSessionId).toBe('function');
    expect(typeof result.current.loadSessions).toBe('function');
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useOnlineSession());
    }).toThrow('useOnlineSession must be used within OnlineSessionProvider');
  });
});
