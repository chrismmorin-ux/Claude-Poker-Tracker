import { useCallback } from 'react';
import { CARD_ACTIONS } from '../reducers/cardReducer';

/**
 * Custom hook for card selection logic (community and hole cards)
 * Handles regular card selection with auto-advance and auto-close behavior
 * NOTE: View state actions moved from cardReducer to uiReducer in v114
 */
export const useCardSelection = (
  highlightedBoardIndex,
  cardSelectorType,
  communityCards,
  holeCards,
  currentStreet,
  dispatchCard,
  { closeCardSelector, setHighlightedCardIndex }
) => {
  const selectCard = useCallback((card) => {
    if (highlightedBoardIndex === null) return;

    if (cardSelectorType === 'community') {
      // Remove the card from any other community card slot
      const existingIndex = communityCards.indexOf(card);
      if (existingIndex !== -1 && existingIndex !== highlightedBoardIndex) {
        dispatchCard({ type: CARD_ACTIONS.SET_COMMUNITY_CARD, payload: { index: existingIndex, card: '' } });
      }

      // Assign the card to the highlighted slot
      dispatchCard({ type: CARD_ACTIONS.SET_COMMUNITY_CARD, payload: { index: highlightedBoardIndex, card } });

      // Check if this was the last card needed for this street
      const shouldAutoClose =
        (currentStreet === 'flop' && highlightedBoardIndex === 2) ||
        (currentStreet === 'turn' && highlightedBoardIndex === 3) ||
        (currentStreet === 'river' && highlightedBoardIndex === 4);

      if (shouldAutoClose) {
        closeCardSelector();
      } else {
        // Auto-advance to next community card slot
        if (highlightedBoardIndex < 4) {
          setHighlightedCardIndex(highlightedBoardIndex + 1);
        } else {
          setHighlightedCardIndex(null);
        }
      }
    } else if (cardSelectorType === 'hole') {
      // Remove the card from the other hole card slot
      const existingIndex = holeCards.indexOf(card);
      if (existingIndex !== -1 && existingIndex !== highlightedBoardIndex) {
        dispatchCard({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index: existingIndex, card: '' } });
      }

      // Assign the card to the highlighted slot
      dispatchCard({ type: CARD_ACTIONS.SET_HOLE_CARD, payload: { index: highlightedBoardIndex, card } });

      // Check if this was the second hole card
      if (highlightedBoardIndex === 1) {
        closeCardSelector();
      } else {
        // Auto-advance to next hole card slot
        setHighlightedCardIndex(1);
      }
    }
  }, [highlightedBoardIndex, cardSelectorType, communityCards, holeCards, currentStreet, dispatchCard, closeCardSelector, setHighlightedCardIndex]);

  return selectCard;
};
