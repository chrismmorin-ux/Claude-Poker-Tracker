/**
 * SyncBridgeContext.jsx — Single-instance bridge to Ignition extension
 *
 * Prevents duplicate window.postMessage listeners by centralizing
 * useSyncBridge into one provider instead of per-view instantiation.
 */

import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useSyncBridgeImpl as useSyncBridgeHook } from '../hooks/useSyncBridge';
import { GUEST_USER_ID } from '../utils/persistence/database';

const SyncBridgeContext = createContext(null);

export const SyncBridgeProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid || GUEST_USER_ID;
  const bridge = useSyncBridgeHook(userId);

  const value = useMemo(() => bridge, [
    bridge.isExtensionConnected,
    bridge.versionMismatch,
    bridge.lastSyncTime,
    bridge.importedCount,
    bridge.syncError,
    bridge.importFromJson,
    bridge.liveHandState,
    bridge.pushExploits,
    bridge.pushAdvice,
  ]);

  return (
    <SyncBridgeContext.Provider value={value}>
      {children}
    </SyncBridgeContext.Provider>
  );
};

export const useSyncBridge = () => {
  const ctx = useContext(SyncBridgeContext);
  if (!ctx) throw new Error('useSyncBridge must be used within SyncBridgeProvider');
  return ctx;
};
