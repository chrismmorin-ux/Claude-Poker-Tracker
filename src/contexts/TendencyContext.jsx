/**
 * TendencyContext.jsx - Shared player tendency computation
 *
 * Single instance of usePlayerTendencies for the entire app.
 * Prevents 4x redundant IndexedDB reads + pipeline computation.
 * Exposes patchTendency() for optimistic briefing updates.
 */

import { createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { usePlayer } from './PlayerContext';
import { usePlayerTendencies } from '../hooks/usePlayerTendencies';

const TendencyContext = createContext(null);

export const TendencyProvider = ({ children }) => {
  const { allPlayers } = usePlayer();
  const { tendencyMap, setTendencyMap, isLoading, refresh } = usePlayerTendencies(allPlayers);

  /**
   * Optimistic patch: shallow-merge into a single player's tendency entry.
   * Used by briefing handlers to update in-memory state without full recompute.
   */
  const patchTendency = useCallback((playerId, patch) => {
    setTendencyMap(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], ...patch },
    }));
  }, [setTendencyMap]);

  const value = useMemo(
    () => ({ tendencyMap, isLoading, refresh, patchTendency }),
    [tendencyMap, isLoading, refresh, patchTendency]
  );

  return (
    <TendencyContext.Provider value={value}>
      {children}
    </TendencyContext.Provider>
  );
};

export const useTendency = () => {
  const ctx = useContext(TendencyContext);
  if (!ctx) throw new Error('useTendency must be used within TendencyProvider');
  return ctx;
};

/**
 * Per-player selector: returns a stable reference for a single player's tendency data.
 * Only triggers re-render when the specific player's entry changes (shallow equality).
 * Use this in components that only care about one player (e.g., PlayerAnalysisPanel).
 *
 * @param {string|number} playerId - The player to select
 * @returns {object|undefined} The player's tendency entry, or undefined if not found
 */
export const useSeatTendency = (playerId) => {
  const { tendencyMap } = useTendency();
  const prevRef = useRef(undefined);
  const entry = playerId != null ? tendencyMap[playerId] : undefined;

  // Return previous reference if the entry hasn't changed (stable identity)
  if (entry === prevRef.current) return prevRef.current;
  prevRef.current = entry;
  return entry;
};
