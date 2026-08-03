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
import { resolveRakeConfig } from '../utils/rakeResolver';

const OnlineAnalysisContext = createContext(null);

export const OnlineAnalysisProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid || GUEST_USER_ID;
  const { selectedSessionId, onlineSessions } = useOnlineSession();
  const { liveHandState, pushExploits, pushAdvice, isExtensionConnected, versionMismatch } = useSyncBridge();

  const { tendencyMap, handCount, isLoading } = useOnlineAnalysis(selectedSessionId, userId);
  const { computeEquity } = useEquityWorker();
  // WS-077: suppress live-flow advice whenever versions diverge — even
  // after the user clicks "Continue Anyway" — because liveHandState is the
  // most version-sensitive surface. Hand imports (validated by
  // wire-schemas + record-shape checks) and tendencyMap (computed from
  // already-stored hand records) are unaffected and continue to flow.
  const safeLiveHandState = versionMismatch ? null : liveHandState;

  /**
   * The rake the advisor's EV figures are computed under.
   *
   * This wiring is the entire fix: `useLiveActionAdvisor` has always READ a rake config and
   * nothing in the app ever WROTE one, so `estimateRake` returned 0 on every live decision
   * and every EV number the advisor has shown omitted the drop. WS-333 measured the size of
   * the omission — rake costs a blind defender ~4.8pp of required equity live, ~2.3pp online.
   *
   * `source: 'ignition'` is stated rather than inferred: this provider IS the online path, so
   * the venue class is known by construction and must not be guessed from a stake label a
   * live game could also produce.
   */
  const session = useMemo(
    () => (onlineSessions || []).find((s) => s.sessionId === selectedSessionId) || null,
    [onlineSessions, selectedSessionId],
  );
  const rake = useMemo(() => resolveRakeConfig({
    gameType: session?.gameType,
    blinds: session?.blinds,
    source: 'ignition',
  }), [session?.gameType, session?.blinds]);

  const { advice, isComputing } = useLiveActionAdvisor(safeLiveHandState, tendencyMap, {
    equityFn: computeEquity,
    rakeConfig: rake.rakeConfig,
  });

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
    // Exposed so a surface can say WHICH rake the numbers were computed under, and say so
    // when the answer is "none, because we could not identify the game". An unknown rake is
    // not a zero rake, and the difference has to be visible somewhere.
    rake,
  }), [tendencyMap, handCount, isLoading, advice, isComputing, rake]);

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
