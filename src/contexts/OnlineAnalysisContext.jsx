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
import { useEquityWorker } from './EquityWorkerContext';
import { GUEST_USER_ID } from '../utils/persistence/database';

const OnlineAnalysisContext = createContext(null);

export const OnlineAnalysisProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid || GUEST_USER_ID;
  const { selectedSessionId } = useOnlineSession();
  const { liveHandState, pushExploits, pushAdvice, isExtensionConnected } = useSyncBridge();

  const { tendencyMap, handCount, isLoading } = useOnlineAnalysis(selectedSessionId, userId);
  const { computeEquity } = useEquityWorker();
  const { advice, isComputing } = useLiveActionAdvisor(liveHandState, tendencyMap, { equityFn: computeEquity });

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

// AUDIT-2026-04-21-TV F11: renamed from useOnlineAnalysisContext → useAnalysisContext.
// The prior name implied online-only scope but the hook serves both live (TableView)
// and online (OnlineView/ExtensionPanel) consumers — the name was actively misleading
// per H-N01 (developer clarity subset).
export const useAnalysisContext = () => {
  const ctx = useContext(OnlineAnalysisContext);
  if (!ctx) throw new Error('useAnalysisContext must be used within OnlineAnalysisProvider');
  return ctx;
};

/**
 * @deprecated Renamed to `useAnalysisContext` (AUDIT-2026-04-21-TV F11).
 * Kept as a thin alias for any external / out-of-repo callers. Internal call sites
 * have all been migrated. Remove in a future cleanup pass once no non-historical
 * references remain.
 */
export const useOnlineAnalysisContext = useAnalysisContext;
