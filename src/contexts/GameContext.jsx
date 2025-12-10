/**
 * GameContext.jsx - Game state context provider
 * Provides: currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats, actionSequence
 * Plus derived values: getSmallBlindSeat, getBigBlindSeat, hasSeatFolded, isSeatInactive
 * Plus action helpers: recordPrimitiveAction
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { ACTIONS, FOLD_ACTIONS, LIMITS } from '../constants/gameConstants';
import { getSmallBlindSeat as calcSmallBlind, getBigBlindSeat as calcBigBlind } from '../utils/seatUtils';
import { GAME_ACTIONS } from '../reducers/gameReducer';

// Create context
const GameContext = createContext(null);

/**
 * Game context provider component
 * Wraps children with game state and derived utilities
 */
export const GameProvider = ({ gameState, dispatchGame, children }) => {
  const { currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats, actionSequence } = gameState;

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

  // Action helper: Record a primitive action for a seat
  const recordPrimitiveAction = useCallback((seat, primitiveAction) => {
    dispatchGame({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action: primitiveAction },
    });
  }, [dispatchGame]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    currentStreet,
    dealerButtonSeat,
    mySeat,
    seatActions,
    absentSeats,
    actionSequence,  // New: ordered action sequence
    // Dispatch
    dispatchGame,
    // Derived utilities
    getSmallBlindSeat,
    getBigBlindSeat,
    hasSeatFolded,
    isSeatInactive,
    getSeatAllActions,
    // Action helpers
    recordPrimitiveAction,  // New: record primitive action
  }), [
    currentStreet,
    dealerButtonSeat,
    mySeat,
    seatActions,
    absentSeats,
    actionSequence,
    dispatchGame,
    getSmallBlindSeat,
    getBigBlindSeat,
    hasSeatFolded,
    isSeatInactive,
    getSeatAllActions,
    recordPrimitiveAction,
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
