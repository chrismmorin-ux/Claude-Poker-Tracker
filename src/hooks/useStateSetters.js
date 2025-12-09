import { useCallback } from 'react';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { UI_ACTIONS } from '../reducers/uiReducer';
import { CARD_ACTIONS } from '../reducers/cardReducer';

/**
 * Custom hook to provide state setter functions
 * Simple wrappers around reducer dispatch actions
 * Consolidates 10 dispatcher wrapper functions into a single hook
 */
export const useStateSetters = (dispatchGame, dispatchUi, dispatchCard) => {
  const setCurrentScreen = useCallback((screen) => {
    dispatchUi({ type: UI_ACTIONS.SET_SCREEN, payload: screen });
  }, [dispatchUi]);

  const setContextMenu = useCallback((menu) => {
    if (menu === null) {
      dispatchUi({ type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
    } else {
      dispatchUi({ type: UI_ACTIONS.SET_CONTEXT_MENU, payload: menu });
    }
  }, [dispatchUi]);

  const setSelectedPlayers = useCallback((players) => {
    dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: players });
  }, [dispatchUi]);

  const setHoleCardsVisible = useCallback((visible) => {
    dispatchCard({ type: CARD_ACTIONS.SET_HOLE_VISIBILITY, payload: visible });
  }, [dispatchCard]);

  const setCurrentStreet = useCallback((street) => {
    dispatchGame({ type: GAME_ACTIONS.SET_STREET, payload: street });
  }, [dispatchGame]);

  const setDealerSeat = useCallback((seat) => {
    dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: seat });
  }, [dispatchGame]);

  // View state setters (moved from cardReducer to uiReducer in v114)
  const setCardSelectorType = useCallback((type) => {
    dispatchUi({ type: UI_ACTIONS.SET_CARD_SELECTOR_TYPE, payload: type });
  }, [dispatchUi]);

  const setHighlightedCardIndex = useCallback((index) => {
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX, payload: index });
  }, [dispatchUi]);

  const setHighlightedSeat = useCallback((seat) => {
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: seat });
  }, [dispatchUi]);

  const setHighlightedCardSlot = useCallback((slot) => {
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: slot });
  }, [dispatchUi]);

  return {
    setCurrentScreen,
    setContextMenu,
    setSelectedPlayers,
    setHoleCardsVisible,
    setCurrentStreet,
    setDealerSeat,
    setCardSelectorType,
    setHighlightedCardIndex,
    setHighlightedSeat,
    setHighlightedCardSlot,
  };
};
