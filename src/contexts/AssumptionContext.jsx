/**
 * AssumptionContext.jsx - VillainAssumption state context
 *
 * Wraps assumptionReducer with a Provider and useAssumptions hook.
 * Integrates useAssumptionPersistence for IDB sync (load on mount + autosave on dispatch).
 *
 * Context tree position per architecture §10.2:
 *   <TendencyProvider>
 *    <AssumptionProvider>  ← this
 *     <UIProvider>
 *
 * Consumers:
 *   - `useAssumptions()` in views + hooks — returns { state, dispatch, actions, persistence }
 */

import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { assumptionReducer, initialAssumptionState } from '../reducers/assumptionReducer';
import { useAssumptionPersistence } from '../hooks/useAssumptionPersistence';

const AssumptionContext = createContext(null);

export const AssumptionProvider = ({ children, enablePersistence = true }) => {
  const [state, dispatch] = useReducer(assumptionReducer, initialAssumptionState);

  // Wire IDB sync: initial hydrate + debounced autosave.
  // Persistence can be disabled for tests via enablePersistence=false.
  const persistence = useAssumptionPersistence(state, dispatch, { enabled: enablePersistence });

  const value = useMemo(() => ({
    state,
    dispatch,
    persistence,
  }), [state, persistence]);

  return (
    <AssumptionContext.Provider value={value}>
      {children}
    </AssumptionContext.Provider>
  );
};

/**
 * Primary hook for accessing assumption state + dispatch.
 * Throws if used outside AssumptionProvider.
 */
export const useAssumptions = () => {
  const context = useContext(AssumptionContext);
  if (!context) {
    throw new Error('useAssumptions must be used within an AssumptionProvider');
  }
  return context;
};

/**
 * Convenience selector hook for the actionable assumption list for a given villain.
 * Returns empty array when villain has no active assumptions.
 */
export const useAssumptionsForVillain = (villainId) => {
  const { state } = useAssumptions();
  return useMemo(() => {
    if (!villainId) return [];
    const ids = state.activeByVillain[villainId] || [];
    return ids.map((id) => state.assumptions[id]).filter(Boolean);
  }, [state.activeByVillain, state.assumptions, villainId]);
};

/**
 * Convenience selector for the current drill session.
 */
export const useDrillSession = () => {
  const { state } = useAssumptions();
  return state.drillSession;
};
