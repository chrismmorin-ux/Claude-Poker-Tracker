// @vitest-environment jsdom
/**
 * SyncBridgeContext.test.jsx - Tests for single-instance sync bridge provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { SyncBridgeProvider, useSyncBridge } from '../SyncBridgeContext';

// Mock AuthContext (SyncBridgeProvider calls useAuth internally)
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

// Mock useSyncBridge hook
vi.mock('../../hooks/useSyncBridge', () => ({
  useSyncBridgeImpl: () => ({
    isExtensionConnected: false,
    versionMismatch: false,
    lastSyncTime: null,
    importedCount: 0,
    syncError: null,
    importFromJson: vi.fn(),
    liveHandState: null,
    pushExploits: vi.fn(),
    pushAdvice: vi.fn(),
  }),
}));

// Mock database
vi.mock('../../utils/persistence/database', () => ({
  GUEST_USER_ID: 'guest',
}));

const wrapper = ({ children }) => <SyncBridgeProvider>{children}</SyncBridgeProvider>;

describe('SyncBridgeContext', () => {
  it('provides bridge state and functions', () => {
    const { result } = renderHook(() => useSyncBridge(), { wrapper });
    expect(result.current.isExtensionConnected).toBe(false);
    expect(result.current.importedCount).toBe(0);
    expect(result.current.pushExploits).toBeDefined();
    expect(result.current.pushAdvice).toBeDefined();
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useSyncBridge());
    }).toThrow('useSyncBridge must be used within SyncBridgeProvider');
  });
});
