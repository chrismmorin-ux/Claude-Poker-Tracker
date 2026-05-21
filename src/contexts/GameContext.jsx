/**
 * GameContext.jsx - Game state context provider
 * Provides: currentStreet, dealerButtonSeat, mySeat, absentSeats, actionSequence
 * Plus derived values: smallBlindSeat, bigBlindSeat, potInfo
 * Plus action helpers: recordPrimitiveAction, recordStraddle
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { LIMITS } from '../constants/gameConstants';
import { getSmallBlindSeat as calcSmallBlind, getBigBlindSeat as calcBigBlind } from '../utils/seatUtils';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { calculatePot } from '../utils/potCalculator';

// Create context
const GameContext = createContext(null);

/**
 * Game context provider component
 * Wraps children with game state and derived utilities
 */
export const GameProvider = ({ gameState, dispatchGame, blinds, children }) => {
  const { currentStreet, dealerButtonSeat, mySeat, absentSeats, actionSequence, potOverride } = gameState;

  // Derived: blind seat positions
  const smallBlindSeat = useMemo(() => {
    return calcSmallBlind(dealerButtonSeat, absentSeats, LIMITS.NUM_SEATS);
  }, [dealerButtonSeat, absentSeats]);

  const bigBlindSeat = useMemo(() => {
    return calcBigBlind(dealerButtonSeat, absentSeats, LIMITS.NUM_SEATS);
  }, [dealerButtonSeat, absentSeats]);

  // Derived: pot info from action sequence
  const potInfo = useMemo(() => {
    const calculated = calculatePot(actionSequence, blinds);
    if (potOverride !== null) {
      return { ...calculated, total: potOverride, isEstimated: false };
    }
    return calculated;
  }, [actionSequence, blinds, potOverride]);

  // Action helper: Record a primitive action for a seat.
  //
  // WS-182: Legacy raw-passthrough helper retained for test fixtures and
  // any non-product callers that intentionally construct primitive payloads
  // (e.g., reducer unit tests pinning state-mutation behavior). Production
  // code MUST use recordSeatAction from useGameHandlers instead — that
  // funnel derives the label from intent + game state and prevents illegal
  // pairings like CHECK-while-owing.
  //
  // Bypass policy: callers of recordPrimitiveAction must document why the
  // intent funnel is unsuitable (typically: testing the reducer's invalid-
  // input handling, or constructing synthetic state at a layer below the
  // hook).
  const recordPrimitiveAction = useCallback((seat, primitiveAction, amount) => {
    dispatchGame({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action: primitiveAction, amount },
    });
  }, [dispatchGame]);

  // Action helper: Post a straddle for the current hand (WS-002 Sprint A2).
  // Reducer enforces no-preflop-action-yet + single-straddle-per-hand;
  // UTG > BTN precedence is the call site's responsibility.
  const recordStraddle = useCallback((seat, amount) => {
    dispatchGame({
      type: GAME_ACTIONS.RECORD_STRADDLE,
      payload: { seat, amount },
    });
  }, [dispatchGame]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    currentStreet,
    dealerButtonSeat,
    mySeat,
    absentSeats,
    actionSequence,
    // Dispatch
    dispatchGame,
    // Derived utilities
    smallBlindSeat,
    bigBlindSeat,
    // Pot tracking
    potInfo,
    blinds,
    // Action helpers
    recordPrimitiveAction,
    recordStraddle,
  }), [
    currentStreet,
    dealerButtonSeat,
    mySeat,
    absentSeats,
    actionSequence,
    dispatchGame,
    smallBlindSeat,
    bigBlindSeat,
    potInfo,
    blinds,
    recordPrimitiveAction,
    recordStraddle,
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
