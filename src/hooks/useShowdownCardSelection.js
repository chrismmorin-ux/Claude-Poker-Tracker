import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { UI_ACTIONS } from '../reducers/uiReducer';
import { findNextEmptySlot } from '../utils/seatNavigation';

/**
 * Custom hook for showdown card selection logic
 * Handles card assignment with auto-advance to next empty slot
 * More complex than regular card selection due to multi-player logic
 * NOTE: View state actions moved from cardReducer to uiReducer in v114
 */
export const useShowdownCardSelection = (
  highlightedSeat,
  highlightedHoleSlot,
  mySeat,
  holeCards,
  allPlayerCards,
  communityCards,
  seatActions,
  isSeatInactive,
  dispatchCard,
  dispatchUi,
  numSeats
) => {
  const selectCardForShowdown = useCallback((card) => {
    const seat = highlightedSeat;
    const slot = highlightedHoleSlot;

    // For my seat, update holeCards instead of allPlayerCards
    if (seat === mySeat) {
      // Remove card from other slot if it's there
      const existingIndex = holeCards.indexOf(card);
      if (existingIndex !== -1 && existingIndex !== slot) {
        dispatchCard({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index: existingIndex, card: '' } });
      }

      // Assign to current slot
      dispatchCard({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index: slot, card } });
    } else {
      // Remove card from any other player's hand
      for (let s = 1; s <= numSeats; s++) {
        const cards = allPlayerCards[s];
        const cardIndex = cards.indexOf(card);
        if (cardIndex !== -1) {
          dispatchCard({ type: CARD_ACTIONS.SET_PLAYER_CARD, payload: { seat: s, slotIndex: cardIndex, card: '' } });
        }
      }

      // Assign to current slot
      dispatchCard({ type: CARD_ACTIONS.SET_PLAYER_CARD, payload: { seat, slotIndex: slot, card } });
    }

    // Also remove from community cards if it's there
    const communityIndex = communityCards.indexOf(card);
    if (communityIndex !== -1) {
      dispatchCard({ type: CARD_ACTIONS.SET_COMMUNITY_CARD, payload: { index: communityIndex, card: '' } });
    }

    // Auto-advance logic - use unified seatNavigation utility
    const nextEmpty = findNextEmptySlot(
      seat,
      slot,
      mySeat,
      holeCards,
      allPlayerCards,
      numSeats,
      isSeatInactive,
      seatActions
    );
    if (nextEmpty) {
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: nextEmpty.seat });
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: nextEmpty.slot });
    } else {
      // No more empty slots
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: null });
      dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: null });
    }
  }, [highlightedSeat, highlightedHoleSlot, mySeat, holeCards, allPlayerCards, communityCards, seatActions, dispatchCard, dispatchUi, isSeatInactive, numSeats]);

  return selectCardForShowdown;
};
