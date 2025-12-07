/**
 * sessionReducer.test.js - Tests for session state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sessionReducer,
  SESSION_ACTIONS,
  initialSessionState,
  SESSION_STATE_SCHEMA,
} from '../sessionReducer';

describe('sessionReducer', () => {
  let state;

  beforeEach(() => {
    // Deep clone initial state to avoid mutation between tests
    state = JSON.parse(JSON.stringify(initialSessionState));
  });

  describe('initialSessionState', () => {
    it('has correct default values', () => {
      expect(initialSessionState.currentSession.sessionId).toBe(null);
      expect(initialSessionState.currentSession.startTime).toBe(null);
      expect(initialSessionState.currentSession.endTime).toBe(null);
      expect(initialSessionState.currentSession.isActive).toBe(false);
      expect(initialSessionState.currentSession.venue).toBe(null);
      expect(initialSessionState.currentSession.gameType).toBe(null);
      expect(initialSessionState.currentSession.buyIn).toBe(null);
      expect(initialSessionState.currentSession.rebuyTransactions).toEqual([]);
      expect(initialSessionState.currentSession.cashOut).toBe(null);
      expect(initialSessionState.currentSession.reUp).toBe(0);
      expect(initialSessionState.currentSession.goal).toBe(null);
      expect(initialSessionState.currentSession.notes).toBe(null);
      expect(initialSessionState.currentSession.handCount).toBe(0);
      expect(initialSessionState.allSessions).toEqual([]);
      expect(initialSessionState.isLoading).toBe(false);
    });
  });

  describe('START_SESSION', () => {
    it('starts a new session with provided data', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.START_SESSION,
        payload: {
          sessionId: 1,
          startTime: 1700000000000,
          venue: 'Horseshoe Casino',
          gameType: '2/5',
          buyIn: 500,
        },
      });
      expect(newState.currentSession.sessionId).toBe(1);
      expect(newState.currentSession.startTime).toBe(1700000000000);
      expect(newState.currentSession.isActive).toBe(true);
      expect(newState.currentSession.venue).toBe('Horseshoe Casino');
      expect(newState.currentSession.gameType).toBe('2/5');
      expect(newState.currentSession.buyIn).toBe(500);
      expect(newState.currentSession.endTime).toBe(null);
      expect(newState.currentSession.cashOut).toBe(null);
    });

    it('uses defaults for missing optional fields', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.START_SESSION,
        payload: {
          sessionId: 2,
          startTime: 1700000000000,
        },
      });
      expect(newState.currentSession.venue).toBe('Online');
      expect(newState.currentSession.gameType).toBe('1/2');
      expect(newState.currentSession.buyIn).toBe(null);
      expect(newState.currentSession.rebuyTransactions).toEqual([]);
    });

    it('resets hand count to 0', () => {
      state.currentSession.handCount = 50;
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.START_SESSION,
        payload: { sessionId: 3, startTime: Date.now() },
      });
      expect(newState.currentSession.handCount).toBe(0);
    });
  });

  describe('END_SESSION', () => {
    it('ends session with cash out amount', () => {
      state.currentSession = {
        ...state.currentSession,
        sessionId: 1,
        startTime: 1700000000000,
        isActive: true,
      };
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.END_SESSION,
        payload: {
          endTime: 1700010000000,
          cashOut: 750,
        },
      });
      expect(newState.currentSession.endTime).toBe(1700010000000);
      expect(newState.currentSession.cashOut).toBe(750);
      expect(newState.currentSession.isActive).toBe(false);
    });

    it('preserves other session data', () => {
      state.currentSession = {
        ...state.currentSession,
        sessionId: 1,
        venue: 'Wind Creek Casino',
        gameType: '1/3',
        buyIn: 300,
        isActive: true,
      };
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.END_SESSION,
        payload: { endTime: Date.now() },
      });
      expect(newState.currentSession.venue).toBe('Wind Creek Casino');
      expect(newState.currentSession.gameType).toBe('1/3');
      expect(newState.currentSession.buyIn).toBe(300);
    });
  });

  describe('UPDATE_SESSION_FIELD', () => {
    it('updates venue field', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'venue', value: 'Home Game' },
      });
      expect(newState.currentSession.venue).toBe('Home Game');
    });

    it('updates gameType field', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'gameType', value: '5/10' },
      });
      expect(newState.currentSession.gameType).toBe('5/10');
    });

    it('updates notes field', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'notes', value: 'Good session, ran well' },
      });
      expect(newState.currentSession.notes).toBe('Good session, ran well');
    });

    it('preserves other fields', () => {
      state.currentSession.venue = 'Online';
      state.currentSession.buyIn = 200;
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'gameType', value: '2/5' },
      });
      expect(newState.currentSession.venue).toBe('Online');
      expect(newState.currentSession.buyIn).toBe(200);
    });
  });

  describe('ADD_REBUY', () => {
    it('adds rebuy transaction to empty list', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.ADD_REBUY,
        payload: { timestamp: 1700005000000, amount: 200 },
      });
      expect(newState.currentSession.rebuyTransactions).toHaveLength(1);
      expect(newState.currentSession.rebuyTransactions[0]).toEqual({
        timestamp: 1700005000000,
        amount: 200,
      });
    });

    it('appends to existing rebuy transactions', () => {
      state.currentSession.rebuyTransactions = [
        { timestamp: 1700001000000, amount: 100 },
      ];
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.ADD_REBUY,
        payload: { timestamp: 1700005000000, amount: 200 },
      });
      expect(newState.currentSession.rebuyTransactions).toHaveLength(2);
      expect(newState.currentSession.rebuyTransactions[1].amount).toBe(200);
    });

    it('preserves existing rebuy transactions', () => {
      state.currentSession.rebuyTransactions = [
        { timestamp: 1700001000000, amount: 100 },
        { timestamp: 1700002000000, amount: 150 },
      ];
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.ADD_REBUY,
        payload: { timestamp: 1700005000000, amount: 200 },
      });
      expect(newState.currentSession.rebuyTransactions[0].amount).toBe(100);
      expect(newState.currentSession.rebuyTransactions[1].amount).toBe(150);
    });
  });

  describe('LOAD_SESSIONS', () => {
    it('loads sessions into allSessions', () => {
      const sessions = [
        { sessionId: 1, venue: 'Online' },
        { sessionId: 2, venue: 'Casino' },
      ];
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.LOAD_SESSIONS,
        payload: { sessions },
      });
      expect(newState.allSessions).toEqual(sessions);
    });

    it('replaces existing sessions', () => {
      state.allSessions = [{ sessionId: 99, venue: 'Old' }];
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.LOAD_SESSIONS,
        payload: { sessions: [{ sessionId: 1 }] },
      });
      expect(newState.allSessions).toHaveLength(1);
      expect(newState.allSessions[0].sessionId).toBe(1);
    });
  });

  describe('SET_ACTIVE_SESSION', () => {
    it('sets current session from payload', () => {
      const session = {
        sessionId: 5,
        venue: 'Home',
        gameType: '1/2',
        buyIn: 200,
        isActive: true,
      };
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.SET_ACTIVE_SESSION,
        payload: { session },
      });
      expect(newState.currentSession).toEqual(session);
    });
  });

  describe('HYDRATE_SESSION', () => {
    it('hydrates session state from saved data', () => {
      const session = {
        sessionId: 10,
        startTime: 1700000000000,
        isActive: true,
        venue: 'Wind Creek Casino',
      };
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.HYDRATE_SESSION,
        payload: { session },
      });
      expect(newState.currentSession).toEqual(session);
    });

    it('uses initial state when session is null', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.HYDRATE_SESSION,
        payload: { session: null },
      });
      expect(newState.currentSession).toEqual(initialSessionState.currentSession);
    });
  });

  describe('INCREMENT_HAND_COUNT', () => {
    it('increments hand count by 1', () => {
      state.currentSession.handCount = 5;
      const newState = sessionReducer(state, { type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });
      expect(newState.currentSession.handCount).toBe(6);
    });

    it('increments from 0', () => {
      const newState = sessionReducer(state, { type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });
      expect(newState.currentSession.handCount).toBe(1);
    });
  });

  describe('SET_LOADING', () => {
    it('sets loading to true', () => {
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
      expect(newState.isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      state.isLoading = true;
      const newState = sessionReducer(state, {
        type: SESSION_ACTIONS.SET_LOADING,
        payload: { isLoading: false },
      });
      expect(newState.isLoading).toBe(false);
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action', () => {
      const newState = sessionReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(newState).toEqual(state);
    });
  });

  describe('state schema validation', () => {
    it('schema has correct field types', () => {
      expect(SESSION_STATE_SCHEMA.currentSession.type).toBe('object');
      expect(SESSION_STATE_SCHEMA.allSessions.type).toBe('array');
      expect(SESSION_STATE_SCHEMA.isLoading.type).toBe('boolean');
    });
  });
});
