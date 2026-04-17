/**
 * playerReducer.test.js - Tests for player state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  playerReducer,
  initialPlayerState,
  PLAYER_STATE_SCHEMA,
} from '../playerReducer';
import { PLAYER_ACTIONS } from '../../constants/playerConstants';

describe('playerReducer', () => {
  let state;

  beforeEach(() => {
    // Deep clone initial state to avoid mutation between tests
    state = JSON.parse(JSON.stringify(initialPlayerState));
  });

  describe('initialPlayerState', () => {
    it('has correct default values', () => {
      expect(initialPlayerState.allPlayers).toEqual([]);
      expect(initialPlayerState.seatPlayers).toEqual({});
      expect(initialPlayerState.isLoading).toBe(false);
    });
  });

  describe('LOAD_PLAYERS', () => {
    it('loads players into allPlayers', () => {
      const players = [
        { playerId: 1, name: 'Player One' },
        { playerId: 2, name: 'Player Two' },
      ];
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.LOAD_PLAYERS,
        payload: { players },
      });
      expect(newState.allPlayers).toEqual(players);
    });

    it('replaces existing players', () => {
      state.allPlayers = [{ playerId: 99, name: 'Old Player' }];
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.LOAD_PLAYERS,
        payload: { players: [{ playerId: 1, name: 'New Player' }] },
      });
      expect(newState.allPlayers).toHaveLength(1);
      expect(newState.allPlayers[0].name).toBe('New Player');
    });

    it('can load empty array', () => {
      state.allPlayers = [{ playerId: 1, name: 'Test' }];
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.LOAD_PLAYERS,
        payload: { players: [] },
      });
      expect(newState.allPlayers).toEqual([]);
    });
  });

  describe('SET_SEAT_PLAYER', () => {
    it('assigns player to seat', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 5, playerId: 10 },
      });
      expect(newState.seatPlayers[5]).toBe(10);
    });

    it('replaces existing seat assignment', () => {
      state.seatPlayers = { 5: 10 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 5, playerId: 20 },
      });
      expect(newState.seatPlayers[5]).toBe(20);
    });

    it('can assign multiple seats', () => {
      let newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 1, playerId: 100 },
      });
      newState = playerReducer(newState, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 5, playerId: 200 },
      });
      newState = playerReducer(newState, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 9, playerId: 300 },
      });
      expect(newState.seatPlayers[1]).toBe(100);
      expect(newState.seatPlayers[5]).toBe(200);
      expect(newState.seatPlayers[9]).toBe(300);
    });

    it('preserves other seat assignments', () => {
      state.seatPlayers = { 1: 10, 3: 30 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 5, playerId: 50 },
      });
      expect(newState.seatPlayers[1]).toBe(10);
      expect(newState.seatPlayers[3]).toBe(30);
      expect(newState.seatPlayers[5]).toBe(50);
    });
  });

  describe('CLEAR_SEAT_PLAYER', () => {
    it('removes player from seat', () => {
      state.seatPlayers = { 5: 10 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
        payload: { seat: 5 },
      });
      expect(newState.seatPlayers[5]).toBeUndefined();
    });

    it('preserves other seat assignments', () => {
      state.seatPlayers = { 1: 10, 5: 50, 9: 90 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
        payload: { seat: 5 },
      });
      expect(newState.seatPlayers[1]).toBe(10);
      expect(newState.seatPlayers[9]).toBe(90);
      expect(newState.seatPlayers[5]).toBeUndefined();
    });

    it('does nothing when seat not assigned', () => {
      state.seatPlayers = { 1: 10 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
        payload: { seat: 5 },
      });
      expect(newState.seatPlayers).toEqual({ 1: 10 });
    });
  });

  describe('CLEAR_ALL_SEAT_PLAYERS', () => {
    it('clears all seat assignments', () => {
      state.seatPlayers = { 1: 10, 3: 30, 5: 50, 7: 70, 9: 90 };
      const newState = playerReducer(state, { type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS });
      expect(newState.seatPlayers).toEqual({});
    });

    it('does nothing when already empty', () => {
      const newState = playerReducer(state, { type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS });
      expect(newState.seatPlayers).toEqual({});
    });

    it('preserves allPlayers', () => {
      state.allPlayers = [{ playerId: 1, name: 'Test' }];
      state.seatPlayers = { 5: 1 };
      const newState = playerReducer(state, { type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS });
      expect(newState.allPlayers).toHaveLength(1);
    });
  });

  describe('HYDRATE_SEAT_PLAYERS', () => {
    it('hydrates seat assignments from saved data', () => {
      const seatPlayers = { 2: 20, 4: 40, 6: 60 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
        payload: { seatPlayers },
      });
      expect(newState.seatPlayers).toEqual(seatPlayers);
    });

    it('uses empty object when payload is null', () => {
      state.seatPlayers = { 1: 10 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
        payload: { seatPlayers: null },
      });
      expect(newState.seatPlayers).toEqual({});
    });

    it('uses empty object when payload is undefined', () => {
      state.seatPlayers = { 1: 10 };
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
        payload: { seatPlayers: undefined },
      });
      expect(newState.seatPlayers).toEqual({});
    });
  });

  describe('SET_LOADING', () => {
    it('sets loading to true', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
      expect(newState.isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      state.isLoading = true;
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_LOADING,
        payload: { isLoading: false },
      });
      expect(newState.isLoading).toBe(false);
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action', () => {
      const newState = playerReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(newState).toEqual(state);
    });
  });

  describe('state schema validation', () => {
    it('schema has correct field types', () => {
      expect(PLAYER_STATE_SCHEMA.allPlayers.type).toBe('array');
      expect(PLAYER_STATE_SCHEMA.seatPlayers.type).toBe('object');
      expect(PLAYER_STATE_SCHEMA.isLoading.type).toBe('boolean');
    });
  });

  describe('seat assignment edge cases', () => {
    it('handles all 9 seats being assigned', () => {
      for (let seat = 1; seat <= 9; seat++) {
        state = playerReducer(state, {
          type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
          payload: { seat, playerId: seat * 10 },
        });
      }
      expect(Object.keys(state.seatPlayers)).toHaveLength(9);
      for (let seat = 1; seat <= 9; seat++) {
        expect(state.seatPlayers[seat]).toBe(seat * 10);
      }
    });

    it('same player can be assigned to different seats (no constraint)', () => {
      // Note: Business logic may prevent this, but reducer doesn't enforce it
      let newState = playerReducer(state, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 1, playerId: 100 },
      });
      newState = playerReducer(newState, {
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 5, playerId: 100 },
      });
      expect(newState.seatPlayers[1]).toBe(100);
      expect(newState.seatPlayers[5]).toBe(100);
    });
  });

  // =======================================================================
  // PEO-1: retroactive-link + undo
  // =======================================================================

  describe('RETROACTIVELY_LINK_PLAYER', () => {
    beforeEach(() => {
      state.allPlayers = [
        { playerId: 1, name: 'Mike', handCount: 3, lastSeenAt: 1000 },
        { playerId: 2, name: 'Alice', handCount: 8, lastSeenAt: 2000 },
      ];
    });

    it('updates handCount on the target player only', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId: 1, newHandCount: 10 },
      });
      expect(newState.allPlayers.find(p => p.playerId === 1).handCount).toBe(10);
      expect(newState.allPlayers.find(p => p.playerId === 2).handCount).toBe(8);
    });

    it('refreshes lastSeenAt on link', () => {
      const before = state.allPlayers.find(p => p.playerId === 1).lastSeenAt;
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId: 1, newHandCount: 10 },
      });
      const after = newState.allPlayers.find(p => p.playerId === 1).lastSeenAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('is a no-op when playerId does not exist', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId: 999, newHandCount: 50 },
      });
      expect(newState.allPlayers).toEqual(state.allPlayers);
    });

    it('preserves other player fields (immutable update)', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId: 1, newHandCount: 10 },
      });
      const updated = newState.allPlayers.find(p => p.playerId === 1);
      expect(updated.name).toBe('Mike');
    });

    it('does not mutate original state', () => {
      const snapshot = JSON.parse(JSON.stringify(state));
      playerReducer(state, {
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId: 1, newHandCount: 10 },
      });
      expect(state).toEqual(snapshot);
    });
  });

  describe('UNDO_RETROACTIVE_LINK', () => {
    beforeEach(() => {
      state.allPlayers = [
        { playerId: 1, name: 'Mike', handCount: 10, lastSeenAt: 1000 },
      ];
    });

    it('reverts handCount to the supplied value', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.UNDO_RETROACTIVE_LINK,
        payload: { playerId: 1, newHandCount: 3 },
      });
      expect(newState.allPlayers[0].handCount).toBe(3);
    });

    it('is a no-op when playerId does not exist', () => {
      const newState = playerReducer(state, {
        type: PLAYER_ACTIONS.UNDO_RETROACTIVE_LINK,
        payload: { playerId: 999, newHandCount: 0 },
      });
      expect(newState.allPlayers).toEqual(state.allPlayers);
    });

    it('link → undo round trip returns to original count', () => {
      const linked = playerReducer(state, {
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId: 1, newHandCount: 15 },
      });
      expect(linked.allPlayers[0].handCount).toBe(15);
      const undone = playerReducer(linked, {
        type: PLAYER_ACTIONS.UNDO_RETROACTIVE_LINK,
        payload: { playerId: 1, newHandCount: 10 },
      });
      expect(undone.allPlayers[0].handCount).toBe(10);
    });
  });
});
