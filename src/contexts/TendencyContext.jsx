/**
 * TendencyContext.jsx - Shared player tendency computation
 *
 * Single instance of usePlayerTendencies for the entire app.
 * Prevents 4x redundant IndexedDB reads + pipeline computation.
 * Exposes patchTendency() for optimistic briefing updates.
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
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
