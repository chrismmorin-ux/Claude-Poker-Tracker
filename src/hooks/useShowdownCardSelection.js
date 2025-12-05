import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { SEAT_STATUS, ACTIONS } from '../constants/gameConstants';

/**
 * Custom hook for showdown card selection logic
 * Handles card assignment with auto-advance to next empty slot
 * More complex than regular card selection due to multi-player logic
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

    // Auto-advance logic - find next empty slot
    const findNextEmptySlot = (currentSeat, currentSlot) => {
      // First check if the second slot of current seat is empty
      if (currentSlot === 0) {
        const cards = currentSeat === mySeat ? holeCards : allPlayerCards[currentSeat];
        if (!cards[1]) {
          return { seat: currentSeat, slot: 1 };
        }
      }

      // Otherwise, look for next seat with empty slots
      let nextSeat = currentSeat + 1;
      while (nextSeat <= numSeats) {
        const nextStatus = isSeatInactive(nextSeat);
        const nextMucked = seatActions['showdown']?.[nextSeat] === ACTIONS.MUCKED;
        const nextWon = seatActions['showdown']?.[nextSeat] === ACTIONS.WON;

        // Skip folded, absent, mucked, and won seats
        if (nextStatus !== SEAT_STATUS.FOLDED && nextStatus !== SEAT_STATUS.ABSENT && !nextMucked && !nextWon) {
          const cards = nextSeat === mySeat ? holeCards : allPlayerCards[nextSeat];
          // Check first slot
          if (!cards[0]) {
            return { seat: nextSeat, slot: 0 };
          }
          // Check second slot
          if (!cards[1]) {
            return { seat: nextSeat, slot: 1 };
          }
        }
        nextSeat++;
      }

      // No empty slots found
      return null;
    };

    const nextEmpty = findNextEmptySlot(seat, slot);
    if (nextEmpty) {
      dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: nextEmpty.seat });
      dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: nextEmpty.slot });
    } else {
      // No more empty slots
      dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: null });
      dispatchCard({ type: CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: null });
    }
  }, [highlightedSeat, highlightedHoleSlot, mySeat, holeCards, allPlayerCards, communityCards, seatActions, dispatchCard, isSeatInactive, numSeats]);

  return selectCardForShowdown;
};
