/**
 * UIContext.test.jsx - Tests for UI state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { UIProvider, useUI } from '../UIContext';
import { UI_ACTIONS, SCREEN } from '../../reducers/uiReducer';

// Helper to create a wrapper with UIProvider
const createWrapper = (uiState, dispatchUi = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <UIProvider uiState={uiState} dispatchUi={dispatchUi}>
      {children}
    </UIProvider>
  );
  return Wrapper;
};

// Default UI state for testing
const createDefaultUIState = (overrides = {}) => ({
  currentView: SCREEN.TABLE,
  selectedPlayers: [],
  contextMenu: null,
  isDraggingDealer: false,
  isSidebarCollapsed: false,
  showCardSelector: false,
  cardSelectorType: 'community',
  highlightedBoardIndex: 0,
  isShowdownViewOpen: false,
  highlightedSeat: null,
  highlightedHoleSlot: 0,
  ...overrides,
});

describe('UIContext', () => {
  describe('useUI hook', () => {
    it('throws error when used outside of UIProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useUI());
      }).toThrow('useUI must be used within a UIProvider');

      consoleSpy.mockRestore();
    });

    it('provides UI state values', () => {
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState),
      });

      expect(result.current.currentView).toBe(SCREEN.TABLE);
      expect(result.current.selectedPlayers).toEqual([]);
      expect(result.current.contextMenu).toBeNull();
      expect(result.current.isDraggingDealer).toBe(false);
      expect(result.current.isSidebarCollapsed).toBe(false);
      expect(result.current.showCardSelector).toBe(false);
      expect(result.current.cardSelectorType).toBe('community');
      expect(result.current.highlightedBoardIndex).toBe(0);
      expect(result.current.isShowdownViewOpen).toBe(false);
      expect(result.current.highlightedSeat).toBeNull();
      expect(result.current.highlightedHoleSlot).toBe(0);
    });

    it('provides SCREEN constants', () => {
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState),
      });

      expect(result.current.SCREEN).toBe(SCREEN);
      expect(result.current.SCREEN.TABLE).toBe('table');
      expect(result.current.SCREEN.STATS).toBe('stats');
    });
  });

  describe('setCurrentScreen', () => {
    it('dispatches SET_SCREEN action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setCurrentScreen(SCREEN.STATS);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_SCREEN,
        payload: SCREEN.STATS,
      });
    });
  });

  describe('togglePlayerSelection', () => {
    it('dispatches TOGGLE_PLAYER_SELECTION action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.togglePlayerSelection(3);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
        payload: 3,
      });
    });
  });

  describe('clearSelection', () => {
    it('dispatches CLEAR_SELECTION action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState({ selectedPlayers: [1, 2, 3] });
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLEAR_SELECTION,
      });
    });
  });

  describe('setSelectedPlayers', () => {
    it('dispatches SET_SELECTION action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setSelectedPlayers([1, 2, 5]);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_SELECTION,
        payload: [1, 2, 5],
      });
    });
  });

  describe('setContextMenu', () => {
    it('dispatches SET_CONTEXT_MENU action when menu is provided', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      const menuData = { x: 100, y: 200, seat: 3 };
      act(() => {
        result.current.setContextMenu(menuData);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_CONTEXT_MENU,
        payload: menuData,
      });
    });

    it('dispatches CLOSE_CONTEXT_MENU action when null is passed', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState({ contextMenu: { x: 100, y: 200 } });
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setContextMenu(null);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CONTEXT_MENU,
      });
    });
  });

  describe('toggleSidebar', () => {
    it('dispatches TOGGLE_SIDEBAR action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.toggleSidebar();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.TOGGLE_SIDEBAR,
      });
    });
  });

  describe('openCardSelector', () => {
    it('dispatches OPEN_CARD_SELECTOR action with type and index', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.openCardSelector('community', 2);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.OPEN_CARD_SELECTOR,
        payload: { type: 'community', index: 2 },
      });
    });

    it('works with hole type', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.openCardSelector('hole', 0);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.OPEN_CARD_SELECTOR,
        payload: { type: 'hole', index: 0 },
      });
    });
  });

  describe('closeCardSelector', () => {
    it('dispatches CLOSE_CARD_SELECTOR action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState({ showCardSelector: true });
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.closeCardSelector();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_CARD_SELECTOR,
      });
    });
  });

  describe('openShowdownView', () => {
    it('dispatches OPEN_SHOWDOWN_VIEW action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.openShowdownView();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.OPEN_SHOWDOWN_VIEW,
      });
    });
  });

  describe('closeShowdownView', () => {
    it('dispatches CLOSE_SHOWDOWN_VIEW action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState({ isShowdownViewOpen: true });
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.closeShowdownView();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.CLOSE_SHOWDOWN_VIEW,
      });
    });
  });

  describe('setHighlightedSeat', () => {
    it('dispatches SET_HIGHLIGHTED_SEAT action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setHighlightedSeat(5);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 5,
      });
    });

    it('can set to null', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState({ highlightedSeat: 5 });
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setHighlightedSeat(null);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: null,
      });
    });
  });

  describe('setHighlightedHoleSlot', () => {
    it('dispatches SET_HIGHLIGHTED_HOLE_SLOT action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setHighlightedHoleSlot(1);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: 1,
      });
    });
  });

  describe('setCardSelectorType', () => {
    it('dispatches SET_CARD_SELECTOR_TYPE action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setCardSelectorType('hole');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_CARD_SELECTOR_TYPE,
        payload: 'hole',
      });
    });
  });

  describe('setHighlightedCardIndex', () => {
    it('dispatches SET_HIGHLIGHTED_CARD_INDEX action', () => {
      const mockDispatch = vi.fn();
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState, mockDispatch),
      });

      act(() => {
        result.current.setHighlightedCardIndex(3);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: UI_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: 3,
      });
    });
  });

  describe('context memoization', () => {
    it('provides all expected context values', () => {
      const uiState = createDefaultUIState();
      const { result } = renderHook(() => useUI(), {
        wrapper: createWrapper(uiState),
      });

      // State values
      expect(result.current).toHaveProperty('currentView');
      expect(result.current).toHaveProperty('selectedPlayers');
      expect(result.current).toHaveProperty('contextMenu');
      expect(result.current).toHaveProperty('isDraggingDealer');
      expect(result.current).toHaveProperty('isSidebarCollapsed');
      expect(result.current).toHaveProperty('showCardSelector');
      expect(result.current).toHaveProperty('cardSelectorType');
      expect(result.current).toHaveProperty('highlightedBoardIndex');
      expect(result.current).toHaveProperty('isShowdownViewOpen');
      expect(result.current).toHaveProperty('highlightedSeat');
      expect(result.current).toHaveProperty('highlightedHoleSlot');

      // Dispatch
      expect(result.current).toHaveProperty('dispatchUi');

      // Constants
      expect(result.current).toHaveProperty('SCREEN');

      // Handlers
      expect(result.current).toHaveProperty('setCurrentScreen');
      expect(result.current).toHaveProperty('togglePlayerSelection');
      expect(result.current).toHaveProperty('clearSelection');
      expect(result.current).toHaveProperty('setSelectedPlayers');
      expect(result.current).toHaveProperty('setContextMenu');
      expect(result.current).toHaveProperty('toggleSidebar');
      expect(result.current).toHaveProperty('openCardSelector');
      expect(result.current).toHaveProperty('closeCardSelector');
      expect(result.current).toHaveProperty('openShowdownView');
      expect(result.current).toHaveProperty('closeShowdownView');
      expect(result.current).toHaveProperty('setHighlightedSeat');
      expect(result.current).toHaveProperty('setHighlightedHoleSlot');
      expect(result.current).toHaveProperty('setCardSelectorType');
      expect(result.current).toHaveProperty('setHighlightedCardIndex');
    });
  });
});
