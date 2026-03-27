/**
 * OnlineSessionContext.jsx — Online session CRUD
 *
 * Manages session loading, selection, and auto-detection for online play.
 * Analysis, action advising, and tournament logic live in separate contexts.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSyncBridge } from './SyncBridgeContext';
import { getAllSessions } from '../utils/persistence/sessionsStorage';
import { GUEST_USER_ID } from '../utils/persistence/database';
import { logger } from '../utils/errorHandler';

const OnlineSessionContext = createContext(null);

export const OnlineSessionProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid || GUEST_USER_ID;
  const { importedCount, lastImportedTableSession } = useSyncBridge();

  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [onlineSessions, setOnlineSessions] = useState([]);
  const selectedRef = useRef(null);
  const userOverrideRef = useRef(false);
  const lastAutoTableIdRef = useRef(null);

  // Wrap setSelectedSessionId to track user overrides
  const selectSession = useCallback((id) => {
    userOverrideRef.current = true;
    selectedRef.current = id;
    setSelectedSessionId(id);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await getAllSessions(userId);
      const online = allSessions.filter(s => s.source === 'ignition');
      setOnlineSessions(online);
      if (online.length > 0 && !selectedRef.current) {
        const id = online[online.length - 1].sessionId;
        selectedRef.current = id;
        setSelectedSessionId(id);
      }
    } catch (err) {
      logger.warn('OnlineSession', 'Failed to load online sessions', err);
    }
  }, [userId]);

  useEffect(() => {
    selectedRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions, importedCount]);

  // Auto-switch session when hands arrive from a different table
  useEffect(() => {
    if (!lastImportedTableSession) return;
    const { tableId, sessionId } = lastImportedTableSession;

    // New table detected — clear user override
    if (tableId !== lastAutoTableIdRef.current) {
      lastAutoTableIdRef.current = tableId;
      userOverrideRef.current = false;
    }

    // Auto-switch if not user-overridden and session differs
    if (!userOverrideRef.current && sessionId !== selectedRef.current) {
      selectedRef.current = sessionId;
      setSelectedSessionId(sessionId);
    }
  }, [lastImportedTableSession]);

  const value = useMemo(() => ({
    selectedSessionId,
    setSelectedSessionId: selectSession,
    onlineSessions,
    loadSessions,
  }), [selectedSessionId, selectSession, onlineSessions, loadSessions]);

  return (
    <OnlineSessionContext.Provider value={value}>
      {children}
    </OnlineSessionContext.Provider>
  );
};

export const useOnlineSession = () => {
  const ctx = useContext(OnlineSessionContext);
  if (!ctx) throw new Error('useOnlineSession must be used within OnlineSessionProvider');
  return ctx;
};
