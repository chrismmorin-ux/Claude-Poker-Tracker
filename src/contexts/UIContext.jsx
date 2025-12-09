/**
 * UIContext.jsx - UI state context provider
 * Provides: currentView, selectedPlayers, contextMenu, isDraggingDealer,
 *           showCardSelector, isShowdownViewOpen, and related highlighting state
 * Plus handlers for common UI operations
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { UI_ACTIONS, SCREEN } from '../reducers/uiReducer';

// Create context
const UIContext = createContext(null);

/**
 * UI context provider component
 * Wraps children with UI state and handlers
 */
export const UIProvider = ({ uiState, dispatchUi, children }) => {
  const {
    currentView,
    selectedPlayers,
    contextMenu,
    isDraggingDealer,
    isSidebarCollapsed,
    showCardSelector,
    cardSelectorType,
    highlightedBoardIndex,
    isShowdownViewOpen,
    highlightedSeat,
    highlightedHoleSlot,
  } = uiState;

  // Handler: Set current screen/view
  const setCurrentScreen = useCallback((screen) => {
    dispatchUi({ type: UI_ACTIONS.SET_SCREEN, payload: screen });
  }, [dispatchUi]);

  // Handler: Toggle player selection
  const togglePlayerSelection = useCallback((seat) => {
    dispatchUi({ type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION, payload: seat });
  }, [dispatchUi]);

  // Handler: Clear all player selections
  const clearSelection = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.CLEAR_SELECTION });
  }, [dispatchUi]);

  // Handler: Set player selection
  const setSelectedPlayers = useCallback((players) => {
    dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: players });
  }, [dispatchUi]);

  // Handler: Set context menu
  const setContextMenu = useCallback((menu) => {
    if (menu === null) {
      dispatchUi({ type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
    } else {
      dispatchUi({ type: UI_ACTIONS.SET_CONTEXT_MENU, payload: menu });
    }
  }, [dispatchUi]);

  // Handler: Toggle sidebar
  const toggleSidebar = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.TOGGLE_SIDEBAR });
  }, [dispatchUi]);

  // Handler: Open card selector
  const openCardSelector = useCallback((type, index) => {
    dispatchUi({ type: UI_ACTIONS.OPEN_CARD_SELECTOR, payload: { type, index } });
  }, [dispatchUi]);

  // Handler: Close card selector
  const closeCardSelector = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.CLOSE_CARD_SELECTOR });
  }, [dispatchUi]);

  // Handler: Open showdown view
  const openShowdownView = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.OPEN_SHOWDOWN_VIEW });
  }, [dispatchUi]);

  // Handler: Close showdown view
  const closeShowdownView = useCallback(() => {
    dispatchUi({ type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW });
  }, [dispatchUi]);

  // Handler: Set highlighted seat
  const setHighlightedSeat = useCallback((seat) => {
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT, payload: seat });
  }, [dispatchUi]);

  // Handler: Set highlighted hole slot
  const setHighlightedHoleSlot = useCallback((slot) => {
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT, payload: slot });
  }, [dispatchUi]);

  // Handler: Set card selector type (community/hole)
  const setCardSelectorType = useCallback((type) => {
    dispatchUi({ type: UI_ACTIONS.SET_CARD_SELECTOR_TYPE, payload: type });
  }, [dispatchUi]);

  // Handler: Set highlighted card index (for card selector)
  const setHighlightedCardIndex = useCallback((index) => {
    dispatchUi({ type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX, payload: index });
  }, [dispatchUi]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    currentView,
    selectedPlayers,
    contextMenu,
    isDraggingDealer,
    isSidebarCollapsed,
    showCardSelector,
    cardSelectorType,
    highlightedBoardIndex,
    isShowdownViewOpen,
    highlightedSeat,
    highlightedHoleSlot,
    // Dispatch
    dispatchUi,
    // Screen constants
    SCREEN,
    // Handlers
    setCurrentScreen,
    togglePlayerSelection,
    clearSelection,
    setSelectedPlayers,
    setContextMenu,
    toggleSidebar,
    openCardSelector,
    closeCardSelector,
    openShowdownView,
    closeShowdownView,
    setHighlightedSeat,
    setHighlightedHoleSlot,
    setCardSelectorType,
    setHighlightedCardIndex,
  }), [
    currentView,
    selectedPlayers,
    contextMenu,
    isDraggingDealer,
    isSidebarCollapsed,
    showCardSelector,
    cardSelectorType,
    highlightedBoardIndex,
    isShowdownViewOpen,
    highlightedSeat,
    highlightedHoleSlot,
    dispatchUi,
    setCurrentScreen,
    togglePlayerSelection,
    clearSelection,
    setSelectedPlayers,
    setContextMenu,
    toggleSidebar,
    openCardSelector,
    closeCardSelector,
    openShowdownView,
    closeShowdownView,
    setHighlightedSeat,
    setHighlightedHoleSlot,
    setCardSelectorType,
    setHighlightedCardIndex,
  ]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

/**
 * Hook to access UI context
 * Throws if used outside of UIProvider
 */
export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export default UIContext;
