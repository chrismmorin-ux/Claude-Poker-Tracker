/**
 * GameContext.jsx - Game state context provider
 * Provides: currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats
 * Plus derived values: getSmallBlindSeat, getBigBlindSeat, hasSeatFolded, isSeatInactive
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { ACTIONS, FOLD_ACTIONS, LIMITS } from '../constants/gameConstants';
import { getSmallBlindSeat as calcSmallBlind, getBigBlindSeat as calcBigBlind } from '../utils/seatUtils';

// Create context
const GameContext = createContext(null);

/**
 * Game context provider component
 * Wraps children with game state and derived utilities
 */
export const GameProvider = ({ gameState, dispatchGame, children }) => {
  const { currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats } = gameState;

  // Derived: Get small blind seat
  const getSmallBlindSeat = useCallback(() => {
    return calcSmallBlind(dealerButtonSeat, absentSeats, LIMITS.NUM_SEATS);
  }, [dealerButtonSeat, absentSeats]);

  // Derived: Get big blind seat
  const getBigBlindSeat = useCallback(() => {
    return calcBigBlind(dealerButtonSeat, absentSeats, LIMITS.NUM_SEATS);
  }, [dealerButtonSeat, absentSeats]);

  // Derived: Check if seat has folded on current street
  const hasSeatFolded = useCallback((seat) => {
    const streetActions = seatActions[currentStreet];
    if (!streetActions || !streetActions[seat]) return false;

    const actions = streetActions[seat];
    return actions.some(action => FOLD_ACTIONS.includes(action));
  }, [seatActions, currentStreet]);

  // Derived: Check if seat is inactive (folded OR absent)
  const isSeatInactive = useCallback((seat) => {
    if (absentSeats.includes(seat)) return 'absent';
    if (hasSeatFolded(seat)) return 'folded';
    return null;
  }, [absentSeats, hasSeatFolded]);

  // Derived: Get all actions for a seat across all streets
  const getSeatAllActions = useCallback((seat) => {
    const allActions = {};
    Object.keys(seatActions).forEach(street => {
      if (seatActions[street]?.[seat]) {
        allActions[street] = seatActions[street][seat];
      }
    });
    return allActions;
  }, [seatActions]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    currentStreet,
    dealerButtonSeat,
    mySeat,
    seatActions,
    absentSeats,
    // Dispatch
    dispatchGame,
    // Derived utilities
    getSmallBlindSeat,
    getBigBlindSeat,
    hasSeatFolded,
    isSeatInactive,
    getSeatAllActions,
  }), [
    currentStreet,
    dealerButtonSeat,
    mySeat,
    seatActions,
    absentSeats,
    dispatchGame,
    getSmallBlindSeat,
    getBigBlindSeat,
    hasSeatFolded,
    isSeatInactive,
    getSeatAllActions,
  ]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

/**
 * Hook to access game context
 * Throws if used outside of GameProvider
 */
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export default GameContext;
