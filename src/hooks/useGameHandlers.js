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
import { validateActionSequence } from '../utils/actionValidation';
import {
  ACTIONS,
  SEAT_STATUS,
  STREETS,
  BETTING_STREETS,
  isFoldAction,
  LIMITS,
} from '../constants/gameConstants';
import { useGame, useUI, useCard, useSession } from '../contexts';
import { useToast } from '../contexts/ToastContext';
import { useSeatUtils } from './useSeatUtils';

const MODULE_NAME = 'GameHandlers';
const log = (...args) => logger.debug(MODULE_NAME, ...args);

export const useGameHandlers = () => {
  const {
    currentStreet,
    mySeat,
    seatActions,
    absentSeats,
    dealerButtonSeat,
    dispatchGame,
  } = useGame();

  const {
    selectedPlayers,
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

  const { showError } = useToast();

  const {
    getFirstActionSeat,
    getNextActionSeat,
  } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, seatActions, LIMITS.NUM_SEATS);

  const recordAction = useCallback((action) => {
    if (selectedPlayers.length === 0) return;

    const invalidSeats = [];
    selectedPlayers.forEach(seat => {
      const currentActions = seatActions[currentStreet]?.[seat] || [];
      const validation = validateActionSequence(currentActions, action, currentStreet, ACTIONS);
      if (!validation.valid) {
        invalidSeats.push({ seat, error: validation.error });
      }
    });

    if (invalidSeats.length > 0) {
      const errorMsg = invalidSeats.map(s => `Seat ${s.seat}: ${s.error}`).join('\n');
      showError(`Invalid action:\n${errorMsg}`);
      return;
    }

    selectedPlayers.forEach(seat => {
      log(`Seat ${seat}: ${action} on ${currentStreet}`);
    });

    dispatchGame({
      type: GAME_ACTIONS.RECORD_ACTION,
      payload: { seats: selectedPlayers, action }
    });

    const lastSelectedSeat = Math.max(...selectedPlayers);
    const nextSeat = getNextActionSeat(lastSelectedSeat);
    if (nextSeat) {
      dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [nextSeat] });
    } else {
      dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
    }
  }, [selectedPlayers, currentStreet, seatActions, dispatchGame, dispatchUi, getNextActionSeat, showError]);

  const recordSeatAction = useCallback((seat, action) => {
    log(`Seat ${seat}: ${action} on ${currentStreet}`);
    dispatchGame({
      type: GAME_ACTIONS.RECORD_ACTION,
      payload: { seats: [seat], action }
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

  const openCardSelector = useCallback((type, index) => {
    log('openCardSelector::', type, index);
    dispatchUi({
      type: UI_ACTIONS.OPEN_CARD_SELECTOR,
      payload: { type, index }
    });
  }, [dispatchUi]);

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
    if (absentSeats.includes(seat)) return SEAT_STATUS.ABSENT;

    for (const street of BETTING_STREETS) {
      const action = seatActions[street]?.[seat];
      if (isFoldAction(action)) {
        return SEAT_STATUS.FOLDED;
      }
    }

    return null;
  }, [absentSeats, seatActions]);

  const allCardsAssigned = useCallback(() => {
    for (let seat = 1; seat <= LIMITS.NUM_SEATS; seat++) {
      const inactiveStatus = isSeatInactive(seat);
      const showdownActions = seatActions['showdown']?.[seat];
      const showdownActionsArray = Array.isArray(showdownActions) ? showdownActions : (showdownActions ? [showdownActions] : []);
      const isMucked = showdownActionsArray.includes(ACTIONS.MUCKED);
      const hasWon = showdownActionsArray.includes(ACTIONS.WON);

      if (inactiveStatus === SEAT_STATUS.FOLDED || inactiveStatus === SEAT_STATUS.ABSENT || isMucked || hasWon) {
        continue;
      }

      const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
      if (!cards[0] || !cards[1]) {
        return false;
      }
    }
    return true;
  }, [isSeatInactive, seatActions, mySeat, holeCards, allPlayerCards]);

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

  return {
    recordAction,
    recordSeatAction,
    clearSeatActions,
    undoLastAction,
    toggleAbsent,
    clearStreetActions,
    openCardSelector,
    openShowdownScreen,
    nextStreet,
    isSeatInactive,
    allCardsAssigned,
    clearCards,
    getCardStreet,
    nextHand,
    resetHand,
    handleSetMySeat,
  };
};
