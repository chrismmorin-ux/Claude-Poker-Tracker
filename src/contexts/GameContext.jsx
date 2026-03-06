/**
 * GameContext.jsx - Game state context provider
 * Provides: currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats, actionSequence
 * Plus derived values: smallBlindSeat, bigBlindSeat
 * Plus action helpers: recordPrimitiveAction
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { LIMITS } from '../constants/gameConstants';
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

  // Derived: blind seat positions
  const smallBlindSeat = useMemo(() => {
    return calcSmallBlind(dealerButtonSeat, absentSeats, LIMITS.NUM_SEATS);
  }, [dealerButtonSeat, absentSeats]);

  const bigBlindSeat = useMemo(() => {
    return calcBigBlind(dealerButtonSeat, absentSeats, LIMITS.NUM_SEATS);
  }, [dealerButtonSeat, absentSeats]);

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
    smallBlindSeat,
    bigBlindSeat,
    // Action helpers
    recordPrimitiveAction,
  }), [
    currentStreet,
    dealerButtonSeat,
    mySeat,
    seatActions,
    absentSeats,
    actionSequence,
    dispatchGame,
    smallBlindSeat,
    bigBlindSeat,
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
