/**
 * DrillTabGuard — shared tab-switch protection for the drill views.
 *
 * Both PreflopDrillsView and PostflopDrillsView render one mode per tab via
 * conditional rendering, so switching tabs UNMOUNTS the active mode and discards
 * its in-progress drill state (a half-answered estimate, a checked framework set,
 * a line walked 5 nodes deep). A fat-finger on the dense tab bar silently destroys
 * that work — Nielsen H-N03 (user control / undo) + H-PLT08 (no-interruption input).
 * See docs/design/audits/2026-06-15-blindspot-drills.md E-1 (WS-229 F-DRILL-02).
 *
 * Mechanism: the orchestrator owns a ref reflecting whether the active mode holds
 * unsaved progress; active-drill modes report into it via useDrillProgress(); the
 * orchestrator confirms before a switch that would discard it.
 */

import React, { createContext, useContext, useCallback } from 'react';

const DrillTabGuardContext = createContext(null);

export const GUARD_MESSAGE =
  'You have a drill in progress. Switch tabs and discard it?';

/**
 * Pure guard: returns true if the tab switch should proceed. When a drill is in
 * progress it asks for confirmation. `confirmFn` is injectable for tests.
 */
export const confirmTabSwitch = (
  inProgress,
  confirmFn = (msg) => window.confirm(msg),
) => !inProgress || confirmFn(GUARD_MESSAGE);

/**
 * Orchestrator wraps its tab bar + mode content in this, passing a ref it owns.
 * `progressRef.current` is the live "has unsaved progress" flag.
 */
export const DrillTabGuardProvider = ({ progressRef, children }) => (
  <DrillTabGuardContext.Provider value={progressRef}>
    {children}
  </DrillTabGuardContext.Provider>
);

/**
 * Modes call the returned setter to report whether they hold unsaved drill
 * progress that switching tabs would discard. No-op outside a provider, so a mode
 * rendered in isolation (unit tests) stays fully functional.
 *
 * Usage:
 *   const reportProgress = useDrillProgress();
 *   useEffect(() => {
 *     reportProgress(picked.size > 0 && !submitted);
 *     return () => reportProgress(false);
 *   }, [picked, submitted, reportProgress]);
 */
export const useDrillProgress = () => {
  const ref = useContext(DrillTabGuardContext);
  return useCallback(
    (inProgress) => {
      if (ref) ref.current = !!inProgress;
    },
    [ref],
  );
};
