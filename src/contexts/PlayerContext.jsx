/**
 * PlayerContext.jsx - Player state context provider
 * Provides: allPlayers, seatPlayers, isLoading
 * Plus player operations: assignPlayerToSeat, clearSeatAssignment, getSeatPlayerName
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { PLAYER_ACTIONS } from '../constants/playerConstants';
import { usePlayerPersistence } from '../hooks/usePlayerPersistence';

// Create context
const PlayerContext = createContext(null);

/**
 * Player context provider component
 * Wraps children with player state and operations
 */
export const PlayerProvider = ({ playerState, dispatchPlayer, children }) => {
  const { allPlayers, seatPlayers, isLoading } = playerState;

  // Player persistence (CRUD, seat operations, ready flag)
  const {
    isReady: playerPersistenceReady,
    createNewPlayer,
    updatePlayerById,
    deletePlayerById,
    loadAllPlayers,
    assignPlayerToSeat: persistenceAssignPlayerToSeat,
    getRecentPlayers,
    isPlayerAssigned,
    getPlayerSeat,
  } = usePlayerPersistence(playerState, dispatchPlayer);

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

  // Handler: Clear player from seat
  const clearSeatAssignment = useCallback((seat) => {
    dispatchPlayer({
      type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
      payload: { seat }
    });
  }, [dispatchPlayer]);

  // Handler: Clear all seat assignments
  const clearAllSeatAssignments = useCallback(() => {
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
    // Handlers (context-defined)
    assignPlayerToSeat: persistenceAssignPlayerToSeat,
    clearSeatAssignment,
    clearAllSeatAssignments,
    hydrateSeatPlayers,
    // Persistence operations
    playerPersistenceReady,
    createNewPlayer,
    updatePlayerById,
    deletePlayerById,
    loadAllPlayers,
    getRecentPlayers,
    isPlayerAssigned,
    getPlayerSeat,
  }), [
    allPlayers,
    seatPlayers,
    isLoading,
    assignedSeatCount,
    dispatchPlayer,
    getPlayerById,
    getSeatPlayerName,
    getSeatPlayer,
    persistenceAssignPlayerToSeat,
    clearSeatAssignment,
    clearAllSeatAssignments,
    hydrateSeatPlayers,
    playerPersistenceReady,
    createNewPlayer,
    updatePlayerById,
    deletePlayerById,
    loadAllPlayers,
    getRecentPlayers,
    isPlayerAssigned,
    getPlayerSeat,
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
