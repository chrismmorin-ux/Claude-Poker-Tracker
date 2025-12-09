import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { UI_ACTIONS } from '../reducers/uiReducer';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { ACTIONS } from '../constants/gameConstants';
import { findFirstActiveSeat, findNextActiveSeat } from '../utils/seatNavigation';

/**
 * Custom hook for showdown view handlers
 * Encapsulates all showdown-specific handler logic
 * NOTE: View state actions moved from cardReducer to uiReducer in v114
 */
export const useShowdownHandlers = (
  dispatchCard,
  dispatchUi,
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

    // Find first active seat using unified utility
    const firstActive = findFirstActiveSeat(numSeats, isSeatInactive, seatActions) || 1;
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: firstActive });
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: 0 });
    log('handleClearShowdownCards: cards cleared, first active seat selected');
  }, [dispatchCard, dispatchUi, dispatchGame, isSeatInactive, seatActions, numSeats, log]);

  // Helper: Advance to next active seat in showdown (skips folded/absent/mucked/won)
  const advanceToNextActiveSeat = useCallback((fromSeat) => {
    const nextSeat = findNextActiveSeat(fromSeat, numSeats, isSeatInactive, seatActions);
    if (nextSeat !== null) {
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: nextSeat });
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: 0 });
    } else {
      // No more active seats, deselect
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: null });
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: null });
    }
  }, [isSeatInactive, seatActions, dispatchUi, numSeats]);

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
    dispatchUi({ type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW });
  }, [nextHand, dispatchUi]);

  // Handler: Close showdown view
  const handleCloseShowdown = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW });
  }, [dispatchUi]);

  // Handler: Close card selector
  const handleCloseCardSelector = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.CLOSE_CARD_SELECTOR });
  }, [dispatchUi]);

  return {
    handleClearShowdownCards,
    handleMuckSeat,
    handleWonSeat,
    handleNextHandFromShowdown,
    handleCloseShowdown,
    handleCloseCardSelector,
  };
};
