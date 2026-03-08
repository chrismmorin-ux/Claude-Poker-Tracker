import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { UI_ACTIONS } from '../reducers/uiReducer';
import { findNextEmptySlot } from '../utils/seatUtils';

/**
 * Custom hook for showdown card selection logic
 * Handles card assignment with auto-advance to next empty slot
 */
export const useShowdownCardSelection = ({
  highlightedSeat,
  highlightedHoleSlot,
  mySeat,
  holeCards,
  allPlayerCards,
  communityCards,
  actionSequence,
  isSeatInactive,
  dispatchCard,
  dispatchUi,
  numSeats,
}) => {
  const selectCardForShowdown = useCallback((card) => {
    const seat = highlightedSeat;
    const slot = highlightedHoleSlot;

    // For my seat, update holeCards instead of allPlayerCards
    if (seat === mySeat) {
      const existingIndex = holeCards.indexOf(card);
      if (existingIndex !== -1 && existingIndex !== slot) {
        dispatchCard({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index: existingIndex, card: '' } });
      }
      dispatchCard({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index: slot, card } });
    } else {
      for (let s = 1; s <= numSeats; s++) {
        const cards = allPlayerCards[s];
        const cardIndex = cards.indexOf(card);
        if (cardIndex !== -1) {
          dispatchCard({ type: CARD_ACTIONS.SET_PLAYER_CARD, payload: { seat: s, slotIndex: cardIndex, card: '' } });
        }
      }
      dispatchCard({ type: CARD_ACTIONS.SET_PLAYER_CARD, payload: { seat, slotIndex: slot, card } });
    }

    // Also remove from community cards if it's there
    const communityIndex = communityCards.indexOf(card);
    if (communityIndex !== -1) {
      dispatchCard({ type: CARD_ACTIONS.SET_COMMUNITY_CARD, payload: { index: communityIndex, card: '' } });
    }

    // Auto-advance logic
    const nextEmpty = findNextEmptySlot(
      seat,
      slot,
      mySeat,
      holeCards,
      allPlayerCards,
      numSeats,
      isSeatInactive,
      actionSequence
    );
    if (nextEmpty) {
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: nextEmpty.seat });
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: nextEmpty.slot });
    } else {
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: null });
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: null });
    }
  }, [highlightedSeat, highlightedHoleSlot, mySeat, holeCards, allPlayerCards, communityCards, actionSequence, dispatchCard, dispatchUi, isSeatInactive, numSeats]);

  return selectCardForShowdown;
};
