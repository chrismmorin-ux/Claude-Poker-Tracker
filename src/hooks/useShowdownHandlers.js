import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { SEAT_STATUS, ACTIONS } from '../constants/gameConstants';

/**
 * Custom hook for showdown view handlers
 * Encapsulates all showdown-specific handler logic
 */
export const useShowdownHandlers = (
  dispatchCard,
  dispatchGame,
  isSeatInactive,
  seatActions,
  recordSeatAction,
  nextHand,
  numSeats,
  log
) => {
  // Handler: Clear all player cards in showdown view
  const handleClearShowdownCards = useCallback(() => {
    // Reset all player cards
    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });

    // Clear showdown actions
    dispatchGame({ type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });

    // Find first active seat
    let firstActiveSeat = 1;
    for (let seat = 1; seat <= numSeats; seat++) {
      const status = isSeatInactive(seat);
      if (status !== SEAT_STATUS.FOLDED && status !== SEAT_STATUS.ABSENT) {
        firstActiveSeat = seat;
        break;
      }
    }
    dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: firstActiveSeat });
    dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: 0 });
    log('handleClearShowdownCards: cards cleared, first active seat selected');
  }, [dispatchCard, dispatchGame, isSeatInactive, numSeats, log]);

  // Helper: Advance to next active seat in showdown (skips folded/absent/mucked/won)
  const advanceToNextActiveSeat = useCallback((fromSeat) => {
    let nextSeat = fromSeat + 1;
    while (nextSeat <= numSeats) {
      const nextStatus = isSeatInactive(nextSeat);
      const nextMucked = seatActions['showdown']?.[nextSeat] === ACTIONS.MUCKED;
      const nextWon = seatActions['showdown']?.[nextSeat] === ACTIONS.WON;
      if (nextStatus !== SEAT_STATUS.FOLDED && nextStatus !== SEAT_STATUS.ABSENT && !nextMucked && !nextWon) {
        dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: nextSeat });
        dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: 0 });
        return;
      }
      nextSeat++;
    }
    // No more active seats, deselect
    dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: null });
    dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: null });
  }, [isSeatInactive, seatActions, dispatchCard, numSeats]);

  // Handler: Mark seat as mucked and advance
  const handleMuckSeat = useCallback((seat) => {
    recordSeatAction(seat, ACTIONS.MUCKED);
    advanceToNextActiveSeat(seat);
  }, [recordSeatAction, advanceToNextActiveSeat]);

  // Handler: Mark seat as winner and advance
  const handleWonSeat = useCallback((seat) => {
    recordSeatAction(seat, ACTIONS.WON);
    advanceToNextActiveSeat(seat);
  }, [recordSeatAction, advanceToNextActiveSeat]);

  // Handler: Close showdown view and advance to next hand
  const handleNextHandFromShowdown = useCallback(() => {
    nextHand();
    dispatchCard({ type: CARD_ACTIONS.CLOSE_SHOWDOWN_VIEW });
  }, [nextHand, dispatchCard]);

  // Handler: Close showdown view
  const handleCloseShowdown = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.CLOSE_SHOWDOWN_VIEW });
  }, [dispatchCard]);

  // Handler: Close card selector
  const handleCloseCardSelector = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.CLOSE_CARD_SELECTOR });
  }, [dispatchCard]);

  return {
    handleClearShowdownCards,
    handleMuckSeat,
    handleWonSeat,
    handleNextHandFromShowdown,
    handleCloseShowdown,
    handleCloseCardSelector,
  };
};
