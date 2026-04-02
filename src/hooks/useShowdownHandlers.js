import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { ACTIONS, SEAT_ARRAY } from '../constants/gameConstants';
import { findFirstActiveSeat, findNextActiveSeat, isSeatShowdownActive } from '../utils/seatUtils';

/**
 * Custom hook for showdown view handlers
 * Encapsulates all showdown-specific handler logic
 */
export const useShowdownHandlers = ({
  dispatchCard,
  setHighlightedSeat,
  setHighlightedHoleSlot,
  closeShowdownView,
  closeCardSelector,
  dispatchGame,
  isSeatInactive,
  actionSequence,
  recordSeatAction,
  nextHand,
  numSeats,
  log,
}) => {
  // Handler: Clear all player cards in showdown view
  const handleClearShowdownCards = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });
    dispatchGame({ type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });

    const firstActive = findFirstActiveSeat(numSeats, isSeatInactive, actionSequence) || 1;
    setHighlightedSeat(firstActive);
    setHighlightedHoleSlot(0);
    log('handleClearShowdownCards: cards cleared, first active seat selected');
  }, [dispatchCard, setHighlightedSeat, setHighlightedHoleSlot, dispatchGame, isSeatInactive, actionSequence, numSeats, log]);

  // Helper: Advance to next active seat in showdown (skips folded/absent/mucked/won)
  const advanceToNextActiveSeat = useCallback((fromSeat) => {
    const nextSeat = findNextActiveSeat(fromSeat, numSeats, isSeatInactive, actionSequence);
    if (nextSeat !== null) {
      setHighlightedSeat(nextSeat);
      setHighlightedHoleSlot(0);
    } else {
      setHighlightedSeat(null);
      setHighlightedHoleSlot(null);
    }
  }, [isSeatInactive, actionSequence, setHighlightedSeat, setHighlightedHoleSlot, numSeats]);

  // Handler: Mark seat as mucked and advance (auto-win on heads-up)
  const handleMuckSeat = useCallback((seat) => {
    recordSeatAction(seat, ACTIONS.MUCKED);

    // HE-2c: After mucking, count remaining active seats (exclude just-mucked seat)
    const remaining = SEAT_ARRAY.filter(
      s => s !== seat && isSeatShowdownActive(s, isSeatInactive, actionSequence)
    );
    if (remaining.length === 1) {
      // Auto-mark last player as winner
      recordSeatAction(remaining[0], ACTIONS.WON);
      log('Auto-win: Seat', remaining[0], '(last active after muck)');
    } else {
      advanceToNextActiveSeat(seat);
    }
  }, [recordSeatAction, advanceToNextActiveSeat, isSeatInactive, actionSequence, log]);

  // Handler: Mark seat as winner and auto-muck remaining opponents (14.2c)
  const handleWonSeat = useCallback((seat) => {
    recordSeatAction(seat, ACTIONS.WON);

    // Auto-muck all other active seats (heads-up shortcut + multi-way cleanup)
    const remaining = SEAT_ARRAY.filter(
      s => s !== seat && isSeatShowdownActive(s, isSeatInactive, actionSequence)
    );
    if (remaining.length > 0) {
      remaining.forEach(s => {
        recordSeatAction(s, ACTIONS.MUCKED);
      });
      log('Auto-muck:', remaining.length, 'seat(s) after Won on S' + seat);
    } else {
      advanceToNextActiveSeat(seat);
    }
  }, [recordSeatAction, advanceToNextActiveSeat, isSeatInactive, actionSequence, log]);

  // Handler: Close showdown view and advance to next hand
  const handleNextHandFromShowdown = useCallback(() => {
    nextHand();
    closeShowdownView();
  }, [nextHand, closeShowdownView]);

  // Handler: Close showdown view
  const handleCloseShowdown = useCallback(() => {
    closeShowdownView();
  }, [closeShowdownView]);

  // Handler: Close card selector
  const handleCloseCardSelector = useCallback(() => {
    closeCardSelector();
  }, [closeCardSelector]);

  return {
    handleClearShowdownCards,
    handleMuckSeat,
    handleWonSeat,
    handleNextHandFromShowdown,
    handleCloseShowdown,
    handleCloseCardSelector,
  };
};
