/**
 * SessionContext.test.jsx - Tests for session state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionContext';
import { SESSION_ACTIONS } from '../../constants/sessionConstants';

// Helper to create a wrapper with SessionProvider
const createWrapper = (sessionState, dispatchSession = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <SessionProvider sessionState={sessionState} dispatchSession={dispatchSession}>
      {children}
    </SessionProvider>
  );
  return Wrapper;
};

// Default session state for testing
const createDefaultSessionState = (overrides = {}) => ({
  currentSession: null,
  allSessions: [],
  isLoading: false,
  ...overrides,
});

// Create an active session for testing
const createActiveSession = (overrides = {}) => ({
  sessionId: 'test-session-123',
  isActive: true,
  startTime: Date.now(),
  venue: 'Horseshoe Casino',
  gameType: 'ONE_TWO',
  buyIn: 200,
  rebuyTransactions: [],
  handCount: 0,
  ...overrides,
});

describe('SessionContext', () => {
  describe('useSession hook', () => {
    it('throws error when used outside of SessionProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSession());
      }).toThrow('useSession must be used within a SessionProvider');

      consoleSpy.mockRestore();
    });

    it('provides session state values', () => {
      const sessionState = createDefaultSessionState();
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.currentSession).toBeNull();
      expect(result.current.allSessions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('provides dispatchSession function', () => {
      const mockDispatch = vi.fn();
      const sessionState = createDefaultSessionState();
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState, mockDispatch),
      });

      expect(typeof result.current.dispatchSession).toBe('function');

      result.current.dispatchSession({ type: 'TEST_ACTION' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'TEST_ACTION' });
    });
  });

  describe('hasActiveSession', () => {
    it('returns false when currentSession is null', () => {
      const sessionState = createDefaultSessionState();
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('returns false when session isActive is false', () => {
      const sessionState = createDefaultSessionState({
        currentSession: { ...createActiveSession(), isActive: false },
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('returns true when session isActive is true', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.hasActiveSession).toBe(true);
    });
  });

  describe('totalInvestment', () => {
    it('returns 0 when currentSession is null', () => {
      const sessionState = createDefaultSessionState();
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.totalInvestment).toBe(0);
    });

    it('returns buyIn when no rebuys', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession({ buyIn: 300 }),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.totalInvestment).toBe(300);
    });

    it('returns buyIn + rebuys total', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession({
          buyIn: 200,
          rebuyTransactions: [
            { timestamp: Date.now(), amount: 100 },
            { timestamp: Date.now(), amount: 150 },
          ],
        }),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.totalInvestment).toBe(450);
    });

    it('handles session with no buyIn', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession({
          buyIn: undefined,
          rebuyTransactions: [{ timestamp: Date.now(), amount: 100 }],
        }),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.totalInvestment).toBe(100);
    });

    it('handles session with no rebuyTransactions', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession({
          buyIn: 500,
          rebuyTransactions: undefined,
        }),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.totalInvestment).toBe(500);
    });

    it('handles rebuys with missing amount', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession({
          buyIn: 200,
          rebuyTransactions: [
            { timestamp: Date.now(), amount: 100 },
            { timestamp: Date.now() }, // no amount
          ],
        }),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.totalInvestment).toBe(300);
    });
  });

  describe('updateSessionField', () => {
    it('dispatches UPDATE_SESSION_FIELD action', () => {
      const mockDispatch = vi.fn();
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState, mockDispatch),
      });

      act(() => {
        result.current.updateSessionField('venue', 'Wind Creek Casino');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'venue', value: 'Wind Creek Casino' },
      });
    });

    it('can update numeric fields', () => {
      const mockDispatch = vi.fn();
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState, mockDispatch),
      });

      act(() => {
        result.current.updateSessionField('buyIn', 500);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'buyIn', value: 500 },
      });
    });
  });

  describe('addRebuy', () => {
    it('dispatches ADD_REBUY action with amount and timestamp', () => {
      const mockDispatch = vi.fn();
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState, mockDispatch),
      });

      const beforeCall = Date.now();
      act(() => {
        result.current.addRebuy(100);
      });
      const afterCall = Date.now();

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const call = mockDispatch.mock.calls[0][0];
      expect(call.type).toBe(SESSION_ACTIONS.ADD_REBUY);
      expect(call.payload.amount).toBe(100);
      expect(call.payload.timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(call.payload.timestamp).toBeLessThanOrEqual(afterCall);
    });
  });

  describe('incrementHandCount', () => {
    it('dispatches INCREMENT_HAND_COUNT action', () => {
      const mockDispatch = vi.fn();
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState, mockDispatch),
      });

      act(() => {
        result.current.incrementHandCount();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.INCREMENT_HAND_COUNT,
      });
    });
  });

  describe('setHandCount', () => {
    it('dispatches SET_HAND_COUNT action', () => {
      const mockDispatch = vi.fn();
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState, mockDispatch),
      });

      act(() => {
        result.current.setHandCount(47);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.SET_HAND_COUNT,
        payload: { count: 47 },
      });
    });
  });

  describe('context memoization', () => {
    it('provides all expected context values', () => {
      const sessionState = createDefaultSessionState({
        currentSession: createActiveSession(),
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      // State values
      expect(result.current).toHaveProperty('currentSession');
      expect(result.current).toHaveProperty('allSessions');
      expect(result.current).toHaveProperty('isLoading');

      // Derived values
      expect(result.current).toHaveProperty('hasActiveSession');
      expect(result.current).toHaveProperty('totalInvestment');

      // Dispatch
      expect(result.current).toHaveProperty('dispatchSession');

      // Handlers
      expect(result.current).toHaveProperty('updateSessionField');
      expect(result.current).toHaveProperty('addRebuy');
      expect(result.current).toHaveProperty('incrementHandCount');
      expect(result.current).toHaveProperty('setHandCount');
    });
  });

  describe('multiple sessions', () => {
    it('provides allSessions array', () => {
      const sessions = [
        { sessionId: '1', isActive: false },
        { sessionId: '2', isActive: false },
        { sessionId: '3', isActive: false },
      ];
      const sessionState = createDefaultSessionState({
        allSessions: sessions,
      });
      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(sessionState),
      });

      expect(result.current.allSessions).toHaveLength(3);
      expect(result.current.allSessions).toEqual(sessions);
    });
  });
});
