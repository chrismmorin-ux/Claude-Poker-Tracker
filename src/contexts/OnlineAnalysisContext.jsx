/**
 * OnlineAnalysisContext.jsx — Analysis pipeline + extension push for online sessions
 *
 * Runs useOnlineAnalysis and useLiveActionAdvisor continuously at app-root level
 * so exploit data and action advice flow to the extension regardless of active view.
 */

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useSyncBridge } from './SyncBridgeContext';
import { useOnlineSession } from './OnlineSessionContext';
import { useOnlineAnalysis } from '../hooks/useOnlineAnalysis';
import { useLiveActionAdvisor } from '../hooks/useLiveActionAdvisor';
import { GUEST_USER_ID } from '../utils/persistence/database';

const OnlineAnalysisContext = createContext(null);

export const OnlineAnalysisProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid || GUEST_USER_ID;
  const { selectedSessionId } = useOnlineSession();
  const { liveHandState, pushExploits, pushAdvice, isExtensionConnected } = useSyncBridge();

  const { tendencyMap, handCount, isLoading } = useOnlineAnalysis(selectedSessionId, userId);
  const { advice, isComputing } = useLiveActionAdvisor(liveHandState, tendencyMap);

  // Push exploit data to extension when analysis updates
  useEffect(() => {
    pushExploits(tendencyMap, handCount);
  }, [tendencyMap, handCount, pushExploits, isExtensionConnected]);

  // Push action advice to extension when advice updates
  useEffect(() => {
    pushAdvice(advice);
  }, [advice, pushAdvice, isExtensionConnected]);

  const value = useMemo(() => ({
    tendencyMap,
    handCount,
    isLoading,
    advice,
    isComputing,
  }), [tendencyMap, handCount, isLoading, advice, isComputing]);

  return (
    <OnlineAnalysisContext.Provider value={value}>
      {children}
    </OnlineAnalysisContext.Provider>
  );
};

export const useOnlineAnalysisContext = () => {
  const ctx = useContext(OnlineAnalysisContext);
  if (!ctx) throw new Error('useOnlineAnalysisContext must be used within OnlineAnalysisProvider');
  return ctx;
};
