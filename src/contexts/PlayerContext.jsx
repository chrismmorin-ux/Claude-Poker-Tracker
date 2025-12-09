/**
 * PlayerContext.jsx - Player state context provider
 * Provides: allPlayers, seatPlayers, isLoading
 * Plus player operations: assignPlayerToSeat, clearSeatPlayer, getSeatPlayerName
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { PLAYER_ACTIONS } from '../constants/playerConstants';

// Create context
const PlayerContext = createContext(null);

/**
 * Player context provider component
 * Wraps children with player state and operations
 */
export const PlayerProvider = ({ playerState, dispatchPlayer, children }) => {
  const { allPlayers, seatPlayers, isLoading } = playerState;

  // Derived: Get player by ID
  const getPlayerById = useCallback((playerId) => {
    return allPlayers.find(p => p.playerId === playerId) || null;
  }, [allPlayers]);

  // Derived: Get player name for a seat
  const getSeatPlayerName = useCallback((seat) => {
    const playerId = seatPlayers[seat];
    if (!playerId) return null;
    const player = getPlayerById(playerId);
    return player?.name || null;
  }, [seatPlayers, getPlayerById]);

  // Derived: Get player for a seat
  const getSeatPlayer = useCallback((seat) => {
    const playerId = seatPlayers[seat];
    if (!playerId) return null;
    return getPlayerById(playerId);
  }, [seatPlayers, getPlayerById]);

  // Handler: Assign player to seat
  const assignPlayerToSeat = useCallback((seat, playerId) => {
    dispatchPlayer({
      type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
      payload: { seat, playerId }
    });
  }, [dispatchPlayer]);

  // Handler: Clear player from seat
  const clearSeatPlayer = useCallback((seat) => {
    dispatchPlayer({
      type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
      payload: { seat }
    });
  }, [dispatchPlayer]);

  // Handler: Clear all seat assignments
  const clearAllSeatPlayers = useCallback(() => {
    dispatchPlayer({ type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS });
  }, [dispatchPlayer]);

  // Handler: Hydrate seat players from saved data
  const hydrateSeatPlayers = useCallback((seatPlayersData) => {
    dispatchPlayer({
      type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
      payload: { seatPlayers: seatPlayersData }
    });
  }, [dispatchPlayer]);

  // Derived: Count of assigned seats
  const assignedSeatCount = useMemo(() => {
    return Object.keys(seatPlayers).length;
  }, [seatPlayers]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    allPlayers,
    seatPlayers,
    isLoading,
    // Derived
    assignedSeatCount,
    // Dispatch
    dispatchPlayer,
    // Utilities
    getPlayerById,
    getSeatPlayerName,
    getSeatPlayer,
    // Handlers
    assignPlayerToSeat,
    clearSeatPlayer,
    clearAllSeatPlayers,
    hydrateSeatPlayers,
  }), [
    allPlayers,
    seatPlayers,
    isLoading,
    assignedSeatCount,
    dispatchPlayer,
    getPlayerById,
    getSeatPlayerName,
    getSeatPlayer,
    assignPlayerToSeat,
    clearSeatPlayer,
    clearAllSeatPlayers,
    hydrateSeatPlayers,
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

/**
 * Hook to access player context
 * Throws if used outside of PlayerProvider
 */
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export default PlayerContext;
