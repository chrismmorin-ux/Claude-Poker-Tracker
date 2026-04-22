import { useCallback, useRef } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { ACTIONS, SEAT_ARRAY } from '../constants/gameConstants';
import { findFirstActiveSeat, findNextActiveSeat, isSeatShowdownActive } from '../utils/seatUtils';

/**
 * AUDIT-2026-04-21-SDV F1: unified destructive-action undo duration (matches TV/SV).
 */
const UNDO_TOAST_DURATION_MS = 12000;

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
  // AUDIT-2026-04-21-SDV F1: inputs for Next Hand toast+undo snapshot
  dealerButtonSeat,
  currentStreet,
  absentSeats,
  communityCards,
  holeCards,
  allPlayerCards,
  holeCardsVisible,
  handCount,
  setHandCount,
  openShowdownView,
  addToast,
  showInfo,
}) => {
  // AUDIT-2026-04-21-SDV F1: snapshot for Next Hand undo toast
  const nextHandUndoRef = useRef(null);
  // AUDIT-2026-04-21-SDV F3: snapshot for Clear Cards undo toast
  const clearCardsUndoRef = useRef(null);
  // AUDIT-2026-04-21-SDV F4: snapshot for Quick-Mode Won auto-muck undo toast
  const wonSeatUndoRef = useRef(null);

  // Handler: Clear all player cards in showdown view.
  // AUDIT-2026-04-21-SDV F3: wraps the existing clear with a snapshot + toast+undo.
  // Previously committed destructively with no recovery path — between-hands-chris
  // in Full Mode could lose 18 hole-card assignments to one mis-tap.
  const handleClearShowdownCards = useCallback(() => {
    const hadCards =
      (Array.isArray(communityCards) && communityCards.some(c => c && c !== '')) ||
      (Array.isArray(holeCards) && holeCards.some(c => c && c !== '')) ||
      (allPlayerCards && Object.values(allPlayerCards).some(
        arr => Array.isArray(arr) && arr.some(c => c && c !== '')
      )) ||
      (Array.isArray(actionSequence) && actionSequence.length > 0);

    if (hadCards && addToast) {
      clearCardsUndoRef.current = {
        communityCards: Array.isArray(communityCards) ? [...communityCards] : [],
        holeCards: Array.isArray(holeCards) ? [...holeCards] : [],
        allPlayerCards: allPlayerCards ? { ...allPlayerCards } : {},
        holeCardsVisible: !!holeCardsVisible,
        actionSequence: Array.isArray(actionSequence) ? [...actionSequence] : [],
      };
    }

    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });
    dispatchGame({ type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });

    const firstActive = findFirstActiveSeat(numSeats, isSeatInactive, actionSequence) || 1;
    setHighlightedSeat(firstActive);
    setHighlightedHoleSlot(0);
    log('handleClearShowdownCards: cards cleared, first active seat selected');

    if (hadCards && addToast) {
      addToast('Cards cleared', {
        variant: 'warning',
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            const snapshot = clearCardsUndoRef.current;
            if (!snapshot) return;
            dispatchCard({
              type: CARD_ACTIONS.HYDRATE_STATE,
              payload: {
                communityCards: snapshot.communityCards,
                holeCards: snapshot.holeCards,
                allPlayerCards: snapshot.allPlayerCards,
                holeCardsVisible: snapshot.holeCardsVisible,
              },
            });
            // Note: CLEAR_STREET_ACTIONS only removes the current-street entries from
            // actionSequence; HYDRATE_STATE restores the full snapshot. This is the
            // correct inverse.
            dispatchGame({
              type: GAME_ACTIONS.HYDRATE_STATE,
              payload: { actionSequence: snapshot.actionSequence },
            });
            clearCardsUndoRef.current = null;
            if (showInfo) showInfo('Cards restored');
          },
        },
      });
    }
  }, [
    dispatchCard,
    setHighlightedSeat,
    setHighlightedHoleSlot,
    dispatchGame,
    isSeatInactive,
    actionSequence,
    numSeats,
    log,
    communityCards,
    holeCards,
    allPlayerCards,
    holeCardsVisible,
    addToast,
    showInfo,
  ]);

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

  // Handler: Mark seat as winner and auto-muck remaining opponents (14.2c).
  // AUDIT-2026-04-21-SDV F4: adds snapshot + toast+undo around the bulk WON+MUCKED
  // write. Tapping Won on the wrong seat in a 5-way pot previously committed 4
  // irreversible MUCKED records + 1 WON record with no recovery path.
  const handleWonSeat = useCallback((seat) => {
    const prevActionSequence = Array.isArray(actionSequence) ? [...actionSequence] : [];

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

      if (addToast) {
        wonSeatUndoRef.current = { actionSequence: prevActionSequence };
        const others = remaining.length;
        addToast(
          `Seat ${seat} won (${others} other${others === 1 ? '' : 's'} mucked)`,
          {
            variant: 'success',
            duration: UNDO_TOAST_DURATION_MS,
            action: {
              label: 'Undo',
              onClick: () => {
                const snapshot = wonSeatUndoRef.current;
                if (!snapshot) return;
                dispatchGame({
                  type: GAME_ACTIONS.HYDRATE_STATE,
                  payload: { actionSequence: snapshot.actionSequence },
                });
                wonSeatUndoRef.current = null;
                if (showInfo) showInfo('Won/muck undone');
              },
            },
          }
        );
      }
    } else {
      advanceToNextActiveSeat(seat);
    }
  }, [
    recordSeatAction,
    advanceToNextActiveSeat,
    isSeatInactive,
    actionSequence,
    log,
    addToast,
    showInfo,
    dispatchGame,
  ]);

  // Handler: Close showdown view and advance to next hand.
  // AUDIT-2026-04-21-SDV F1: replaces unguarded nextHand() + closeShowdownView() with a
  // snapshot + toast+undo pattern. Mirrors CommandStrip.handleNextHand (Next Hand in TableView)
  // but additionally re-opens the Showdown surface on undo so the user lands back where they
  // tapped — critical for ringmaster-in-hand whose "undo" mental model is "show me where I
  // was before I broke the hand."
  const handleNextHandFromShowdown = useCallback(() => {
    const hadActions = Array.isArray(actionSequence) && actionSequence.length > 0;

    if (hadActions && addToast) {
      nextHandUndoRef.current = {
        actionSequence: [...actionSequence],
        dealerButtonSeat,
        currentStreet,
        absentSeats: Array.isArray(absentSeats) ? [...absentSeats] : [],
        communityCards: Array.isArray(communityCards) ? [...communityCards] : [],
        holeCards: Array.isArray(holeCards) ? [...holeCards] : [],
        allPlayerCards: allPlayerCards ? { ...allPlayerCards } : {},
        holeCardsVisible: !!holeCardsVisible,
        handCount: handCount ?? 0,
      };
    }

    nextHand();
    closeShowdownView();

    if (hadActions && addToast) {
      addToast('Hand recorded', {
        variant: 'success',
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            const snapshot = nextHandUndoRef.current;
            if (!snapshot) return;
            dispatchGame({
              type: GAME_ACTIONS.HYDRATE_STATE,
              payload: {
                actionSequence: snapshot.actionSequence,
                dealerButtonSeat: snapshot.dealerButtonSeat,
                currentStreet: snapshot.currentStreet,
                absentSeats: snapshot.absentSeats,
              },
            });
            dispatchCard({
              type: CARD_ACTIONS.HYDRATE_STATE,
              payload: {
                communityCards: snapshot.communityCards,
                holeCards: snapshot.holeCards,
                allPlayerCards: snapshot.allPlayerCards,
                holeCardsVisible: snapshot.holeCardsVisible,
              },
            });
            if (setHandCount) setHandCount(snapshot.handCount);
            if (openShowdownView) openShowdownView();
            nextHandUndoRef.current = null;
            if (showInfo) showInfo('Hand restored');
          },
        },
      });
    }
  }, [
    nextHand,
    closeShowdownView,
    actionSequence,
    dealerButtonSeat,
    currentStreet,
    absentSeats,
    communityCards,
    holeCards,
    allPlayerCards,
    holeCardsVisible,
    handCount,
    setHandCount,
    openShowdownView,
    addToast,
    showInfo,
    dispatchGame,
    dispatchCard,
  ]);

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
