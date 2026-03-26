/**
 * useGameHandlers.js - Game action handlers hook
 *
 * Encapsulates all game handler functions that were previously defined
 * in PokerTracker.jsx. Uses context hooks internally.
 */

import { useCallback } from 'react';
import { logger } from '../utils/errorHandler';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { UI_ACTIONS } from '../reducers/uiReducer';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { SESSION_ACTIONS } from '../reducers/sessionReducer';
import { allCardsAssigned as allCardsAssignedUtil } from '../utils/actionUtils';
import { isSeatInactive as seatUtilsIsSeatInactive } from '../utils/seatUtils';
import { getSeatContributions } from '../utils/potCalculator';
import {
  SEAT_ARRAY,
  STREETS,
  LIMITS,
} from '../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import { useGame, useUI, useCard, useSession } from '../contexts';
import { useSeatUtils } from './useSeatUtils';

const MODULE_NAME = 'GameHandlers';
const log = (...args) => logger.debug(MODULE_NAME, ...args);

export const useGameHandlers = () => {
  const {
    currentStreet,
    mySeat,
    absentSeats,
    dealerButtonSeat,
    actionSequence,
    dispatchGame,
    blinds,
    smallBlindSeat,
    bigBlindSeat,
  } = useGame();

  const {
    selectedPlayers,
    openCardSelector,
    dispatchUi,
  } = useUI();

  const {
    communityCards,
    holeCards,
    holeCardsVisible,
    allPlayerCards,
    dispatchCard,
  } = useCard();

  const { dispatchSession } = useSession();

  const {
    getFirstActionSeat,
  } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, actionSequence, LIMITS.NUM_SEATS);

  const recordSeatAction = useCallback((seat, action) => {
    log(`Seat ${seat}: ${action} on ${currentStreet}`);
    dispatchGame({
      type: GAME_ACTIONS.RECORD_SHOWDOWN_ACTION,
      payload: { seat, action }
    });
  }, [currentStreet, dispatchGame]);

  const clearSeatActions = useCallback((seats) => {
    dispatchGame({
      type: GAME_ACTIONS.CLEAR_SEAT_ACTIONS,
      payload: seats
    });
  }, [dispatchGame]);

  const undoLastAction = useCallback((seat) => {
    dispatchGame({
      type: GAME_ACTIONS.UNDO_LAST_ACTION,
      payload: seat
    });
  }, [dispatchGame]);

  const toggleAbsent = useCallback(() => {
    if (selectedPlayers.length === 0) return;

    selectedPlayers.forEach(seat => {
      log(`Seat ${seat}: marked as absent`);
    });

    dispatchGame({ type: GAME_ACTIONS.TOGGLE_ABSENT, payload: selectedPlayers });
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
  }, [selectedPlayers, dispatchGame, dispatchUi]);

  const clearStreetActions = useCallback(() => {
    dispatchGame({ type: GAME_ACTIONS.CLEAR_STREET_ACTIONS });
    const firstSeat = getFirstActionSeat();
    dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
  }, [dispatchGame, dispatchUi, getFirstActionSeat]);

  const openShowdownScreen = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.OPEN_SHOWDOWN_VIEW });
  }, [dispatchUi]);

  const nextStreet = useCallback(() => {
    const currentIndex = STREETS.indexOf(currentStreet);
    if (currentIndex < STREETS.length - 1) {
      const nextStreetName = STREETS[currentIndex + 1];
      dispatchGame({ type: GAME_ACTIONS.SET_STREET, payload: nextStreetName });
      dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });

      if (nextStreetName === 'flop') {
        openCardSelector('community', 0);
      } else if (nextStreetName === 'turn') {
        openCardSelector('community', 3);
      } else if (nextStreetName === 'river') {
        openCardSelector('community', 4);
      } else if (nextStreetName === 'showdown') {
        openShowdownScreen();
      }
    }
  }, [currentStreet, dispatchGame, dispatchUi, openCardSelector, openShowdownScreen]);

  const isSeatInactive = useCallback((seat) => {
    return seatUtilsIsSeatInactive(seat, absentSeats, actionSequence);
  }, [absentSeats, actionSequence]);

  const allCardsAssigned = useCallback(() => {
    return allCardsAssignedUtil(
      LIMITS.NUM_SEATS, isSeatInactive, actionSequence, mySeat, holeCards, allPlayerCards
    );
  }, [isSeatInactive, actionSequence, mySeat, holeCards, allPlayerCards]);

  const clearCards = useCallback((type) => {
    if (type === 'community') {
      dispatchCard({ type: CARD_ACTIONS.CLEAR_COMMUNITY_CARDS });
    } else if (type === 'hole') {
      dispatchCard({ type: CARD_ACTIONS.CLEAR_HOLE_CARDS });
    }
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX, payload: null });
  }, [dispatchCard, dispatchUi]);

  const getCardStreet = useCallback((card) => {
    const communityIndex = communityCards.indexOf(card);
    if (communityIndex !== -1) {
      if (communityIndex <= 2) return 'F';
      if (communityIndex === 3) return 'T';
      if (communityIndex === 4) return 'R';
    }
    if (holeCardsVisible && holeCards.includes(card)) return 'Hole';
    return null;
  }, [communityCards, holeCardsVisible, holeCards]);

  const nextHand = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });
    dispatchGame({ type: GAME_ACTIONS.NEXT_HAND });
    dispatchSession({ type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
    log('nextHand: dealer advanced, all cards/actions cleared, hand count incremented');
  }, [dispatchCard, dispatchGame, dispatchSession, dispatchUi]);

  const resetHand = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });
    dispatchGame({ type: GAME_ACTIONS.RESET_HAND });
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
    log('resetHand: all state cleared including absent seats');
  }, [dispatchCard, dispatchGame, dispatchUi]);

  const handleSetMySeat = useCallback((seat) => {
    dispatchGame({ type: GAME_ACTIONS.SET_MY_SEAT, payload: seat });
    dispatchUi({ type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
  }, [dispatchGame, dispatchUi]);

  const getRemainingSeats = useCallback(() => {
    // Find the last bet/raise on this street to determine who needs to respond
    const streetEntries = actionSequence.filter(e => e.street === currentStreet);
    let lastAggressorIndex = -1;
    for (let i = streetEntries.length - 1; i >= 0; i--) {
      if (streetEntries[i].action === PRIMITIVE_ACTIONS.BET || streetEntries[i].action === PRIMITIVE_ACTIONS.RAISE) {
        lastAggressorIndex = i;
        break;
      }
    }

    return SEAT_ARRAY.filter(seat => {
      if (isSeatInactive(seat)) return false;
      // Check if this seat folded on current street
      const foldedThisStreet = streetEntries.some(
        e => e.seat === seat && e.action === PRIMITIVE_ACTIONS.FOLD
      );
      if (foldedThisStreet) return false;

      if (lastAggressorIndex === -1) {
        // No bet/raise — only seats that haven't acted at all remain
        const hasActed = streetEntries.some(e => e.seat === seat);
        return !hasActed;
      }

      // There was a bet/raise — seat needs to respond if it hasn't acted AFTER the last aggression
      const lastAggressorOrder = streetEntries[lastAggressorIndex].order;
      const actedAfterAggression = streetEntries.some(
        e => e.seat === seat && e.order > lastAggressorOrder
      );
      // Aggressor themselves don't need to act again
      if (streetEntries[lastAggressorIndex].seat === seat) return false;
      return !actedAfterAggression;
    });
  }, [isSeatInactive, actionSequence, currentStreet]);

  const restFold = useCallback(() => {
    const remaining = getRemainingSeats();
    remaining.forEach(seat => {
      dispatchGame({
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat, action: 'fold' },
      });
    });
    // Don't clear selection — useAutoStreetAdvance will advance the street,
    // then useAutoSeatSelection will select the first action seat on the new street.
    return remaining.length;
  }, [getRemainingSeats, dispatchGame]);

  const checkAround = useCallback(() => {
    const remaining = getRemainingSeats();
    remaining.forEach(seat => {
      dispatchGame({
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat, action: 'check' },
      });
    });
    // Don't clear selection — auto-advance pipeline handles the transition.
    return remaining.length;
  }, [getRemainingSeats, dispatchGame]);

  const foldToInvested = useCallback(() => {
    const remaining = getRemainingSeats();
    if (remaining.length === 0) return 0;

    const contributions = getSeatContributions(actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat);

    // Find the last aggressor so we walk from the seat AFTER them
    const streetEntries = actionSequence.filter(e => e.street === currentStreet);
    let aggressorSeat = null;
    for (let i = streetEntries.length - 1; i >= 0; i--) {
      if (streetEntries[i].action === PRIMITIVE_ACTIONS.BET || streetEntries[i].action === PRIMITIVE_ACTIONS.RAISE) {
        aggressorSeat = streetEntries[i].seat;
        break;
      }
    }

    // Sort remaining seats starting from the seat after the aggressor
    const startSeat = aggressorSeat !== null ? (aggressorSeat % LIMITS.NUM_SEATS) + 1 : getFirstActionSeat();
    const n = LIMITS.NUM_SEATS;
    const sorted = [...remaining].sort((a, b) =>
      ((a - startSeat + n) % n) - ((b - startSeat + n) % n)
    );

    let count = 0;
    for (const seat of sorted) {
      // Stop BEFORE the first invested seat
      if ((contributions[seat] || 0) > 0) {
        dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [seat] });
        break;
      }
      dispatchGame({
        type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
        payload: { seat, action: 'fold' },
      });
      count++;
    }
    // If no invested seat found, let auto-advance pipeline handle selection
    // (previously cleared selection, leaving user stranded)
    return count;
  }, [getRemainingSeats, getFirstActionSeat, actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat, dispatchGame, dispatchUi]);

  return {
    recordSeatAction,
    clearSeatActions,
    undoLastAction,
    toggleAbsent,
    clearStreetActions,
    openShowdownScreen,
    nextStreet,
    isSeatInactive,
    allCardsAssigned,
    clearCards,
    getCardStreet,
    nextHand,
    resetHand,
    handleSetMySeat,
    getRemainingSeats,
    restFold,
    checkAround,
    foldToInvested,
  };
};
