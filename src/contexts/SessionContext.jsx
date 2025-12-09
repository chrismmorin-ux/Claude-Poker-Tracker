/**
 * SessionContext.jsx - Session state context provider
 * Provides: currentSession, allSessions, isLoading
 * Plus session operations: startSession, endSession, updateSessionField
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { SESSION_ACTIONS } from '../constants/sessionConstants';

// Create context
const SessionContext = createContext(null);

/**
 * Session context provider component
 * Wraps children with session state and operations
 */
export const SessionProvider = ({ sessionState, dispatchSession, children }) => {
  const { currentSession, allSessions, isLoading } = sessionState;

  // Derived: Is there an active session?
  const hasActiveSession = useMemo(() => {
    return currentSession?.isActive === true;
  }, [currentSession?.isActive]);

  // Derived: Calculate total investment (buyIn + rebuys)
  const totalInvestment = useMemo(() => {
    if (!currentSession) return 0;
    const buyIn = currentSession.buyIn || 0;
    const rebuys = currentSession.rebuyTransactions?.reduce(
      (sum, t) => sum + (t.amount || 0), 0
    ) || 0;
    return buyIn + rebuys;
  }, [currentSession]);

  // Handler: Update a session field
  const updateSessionField = useCallback((field, value) => {
    dispatchSession({
      type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
      payload: { field, value }
    });
  }, [dispatchSession]);

  // Handler: Add rebuy transaction
  const addRebuy = useCallback((amount) => {
    dispatchSession({
      type: SESSION_ACTIONS.ADD_REBUY,
      payload: { timestamp: Date.now(), amount }
    });
  }, [dispatchSession]);

  // Handler: Increment hand count
  const incrementHandCount = useCallback(() => {
    dispatchSession({ type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });
  }, [dispatchSession]);

  // Handler: Set hand count
  const setHandCount = useCallback((count) => {
    dispatchSession({
      type: SESSION_ACTIONS.SET_HAND_COUNT,
      payload: { count }
    });
  }, [dispatchSession]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    currentSession,
    allSessions,
    isLoading,
    // Derived
    hasActiveSession,
    totalInvestment,
    // Dispatch
    dispatchSession,
    // Handlers
    updateSessionField,
    addRebuy,
    incrementHandCount,
    setHandCount,
  }), [
    currentSession,
    allSessions,
    isLoading,
    hasActiveSession,
    totalInvestment,
    dispatchSession,
    updateSessionField,
    addRebuy,
    incrementHandCount,
    setHandCount,
  ]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

/**
 * Hook to access session context
 * Throws if used outside of SessionProvider
 */
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export default SessionContext;
