/**
 * uiReducer.test.js - Tests for UI state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  uiReducer,
  UI_ACTIONS,
  initialUiState,
  SCREEN,
  UI_STATE_SCHEMA,
} from '../uiReducer';

describe('uiReducer', () => {
  let state;

  beforeEach(() => {
    state = { ...initialUiState };
  });

  describe('initialUiState', () => {
    it('has correct default values', () => {
      expect(initialUiState.currentView).toBe(SCREEN.TABLE);
      expect(initialUiState.selectedPlayers).toEqual([]);
      expect(initialUiState.contextMenu).toBe(null);
      expect(initialUiState.isDraggingDealer).toBe(false);
    });
  });

  describe('SCREEN constants', () => {
    it('has correct screen values', () => {
      expect(SCREEN.TABLE).toBe('table');
      expect(SCREEN.STATS).toBe('stats');
    });
  });

  describe('SET_SCREEN', () => {
    it('updates current view to stats', () => {
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_SCREEN,
        payload: SCREEN.STATS,
      });
      expect(newState.currentView).toBe(SCREEN.STATS);
    });

    it('updates current view to table', () => {
      state.currentView = SCREEN.STATS;
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_SCREEN,
        payload: SCREEN.TABLE,
      });
      expect(newState.currentView).toBe(SCREEN.TABLE);
    });

    it('preserves other state', () => {
      state.selectedPlayers = [1, 3, 5];
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_SCREEN,
        payload: SCREEN.STATS,
      });
      expect(newState.selectedPlayers).toEqual([1, 3, 5]);
    });
  });

  describe('TOGGLE_PLAYER_SELECTION', () => {
    it('adds seat to selection when not selected', () => {
      const newState = uiReducer(state, {
        type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
        payload: 5,
      });
      expect(newState.selectedPlayers).toContain(5);
    });

    it('removes seat from selection when already selected', () => {
      state.selectedPlayers = [3, 5, 7];
      const newState = uiReducer(state, {
        type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
        payload: 5,
      });
      expect(newState.selectedPlayers).not.toContain(5);
      expect(newState.selectedPlayers).toEqual([3, 7]);
    });

    it('can select multiple seats', () => {
      let newState = uiReducer(state, {
        type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
        payload: 1,
      });
      newState = uiReducer(newState, {
        type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
        payload: 3,
      });
      newState = uiReducer(newState, {
        type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
        payload: 9,
      });
      expect(newState.selectedPlayers).toEqual([1, 3, 9]);
    });

    it('toggles selection for all seats 1-9', () => {
      for (let seat = 1; seat <= 9; seat++) {
        const newState = uiReducer(state, {
          type: UI_ACTIONS.TOGGLE_PLAYER_SELECTION,
          payload: seat,
        });
        expect(newState.selectedPlayers).toContain(seat);
      }
    });
  });

  describe('CLEAR_SELECTION', () => {
    it('clears all selected players', () => {
      state.selectedPlayers = [1, 2, 3, 4, 5];
      const newState = uiReducer(state, { type: UI_ACTIONS.CLEAR_SELECTION });
      expect(newState.selectedPlayers).toEqual([]);
    });

    it('does nothing when already empty', () => {
      const newState = uiReducer(state, { type: UI_ACTIONS.CLEAR_SELECTION });
      expect(newState.selectedPlayers).toEqual([]);
    });
  });

  describe('SET_SELECTION', () => {
    it('sets selection to specific seats', () => {
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_SELECTION,
        payload: [2, 4, 6],
      });
      expect(newState.selectedPlayers).toEqual([2, 4, 6]);
    });

    it('replaces existing selection', () => {
      state.selectedPlayers = [1, 3, 5];
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_SELECTION,
        payload: [7, 8, 9],
      });
      expect(newState.selectedPlayers).toEqual([7, 8, 9]);
    });

    it('can set empty selection', () => {
      state.selectedPlayers = [1, 2, 3];
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_SELECTION,
        payload: [],
      });
      expect(newState.selectedPlayers).toEqual([]);
    });
  });

  describe('SET_CONTEXT_MENU', () => {
    it('sets context menu with position and seat', () => {
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_CONTEXT_MENU,
        payload: { x: 100, y: 200, seat: 5 },
      });
      expect(newState.contextMenu).toEqual({ x: 100, y: 200, seat: 5 });
    });

    it('replaces existing context menu', () => {
      state.contextMenu = { x: 50, y: 50, seat: 1 };
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_CONTEXT_MENU,
        payload: { x: 300, y: 400, seat: 9 },
      });
      expect(newState.contextMenu).toEqual({ x: 300, y: 400, seat: 9 });
    });

    it('can set to null', () => {
      state.contextMenu = { x: 100, y: 200, seat: 5 };
      const newState = uiReducer(state, {
        type: UI_ACTIONS.SET_CONTEXT_MENU,
        payload: null,
      });
      expect(newState.contextMenu).toBe(null);
    });
  });

  describe('CLOSE_CONTEXT_MENU', () => {
    it('closes context menu', () => {
      state.contextMenu = { x: 100, y: 200, seat: 5 };
      const newState = uiReducer(state, { type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
      expect(newState.contextMenu).toBe(null);
    });

    it('does nothing when already null', () => {
      const newState = uiReducer(state, { type: UI_ACTIONS.CLOSE_CONTEXT_MENU });
      expect(newState.contextMenu).toBe(null);
    });
  });

  describe('START_DRAGGING_DEALER', () => {
    it('sets dragging state to true', () => {
      const newState = uiReducer(state, { type: UI_ACTIONS.START_DRAGGING_DEALER });
      expect(newState.isDraggingDealer).toBe(true);
    });

    it('preserves other state', () => {
      state.selectedPlayers = [1, 2];
      state.contextMenu = { x: 10, y: 20, seat: 3 };
      const newState = uiReducer(state, { type: UI_ACTIONS.START_DRAGGING_DEALER });
      expect(newState.selectedPlayers).toEqual([1, 2]);
      expect(newState.contextMenu).toEqual({ x: 10, y: 20, seat: 3 });
    });
  });

  describe('STOP_DRAGGING_DEALER', () => {
    it('sets dragging state to false', () => {
      state.isDraggingDealer = true;
      const newState = uiReducer(state, { type: UI_ACTIONS.STOP_DRAGGING_DEALER });
      expect(newState.isDraggingDealer).toBe(false);
    });

    it('does nothing when already false', () => {
      const newState = uiReducer(state, { type: UI_ACTIONS.STOP_DRAGGING_DEALER });
      expect(newState.isDraggingDealer).toBe(false);
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action', () => {
      const newState = uiReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(newState).toEqual(state);
    });
  });

  describe('state schema validation', () => {
    it('schema has correct field types', () => {
      expect(UI_STATE_SCHEMA.currentView.type).toBe('string');
      expect(UI_STATE_SCHEMA.selectedPlayers.type).toBe('array');
      expect(UI_STATE_SCHEMA.contextMenu.type).toBe('object');
      expect(UI_STATE_SCHEMA.contextMenu.required).toBe(false);
      expect(UI_STATE_SCHEMA.isDraggingDealer.type).toBe('boolean');
    });
  });
});
