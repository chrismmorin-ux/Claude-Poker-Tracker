/**
 * useSessionPersistence.test.js - Tests for session persistence hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionPersistence } from '../useSessionPersistence';
import { SESSION_ACTIONS } from '../../constants/sessionConstants';
import { createMockSession, createMockDispatchers } from '../../test/utils';

// Mock the persistence module
vi.mock('../../utils/persistence', () => ({
  createSession: vi.fn(() => Promise.resolve(1)),
  endSession: vi.fn(() => Promise.resolve()),
  getActiveSession: vi.fn(() => Promise.resolve(null)),
  setActiveSession: vi.fn(() => Promise.resolve()),
  clearActiveSession: vi.fn(() => Promise.resolve()),
  getAllSessions: vi.fn(() => Promise.resolve([])),
  getSessionById: vi.fn(() => Promise.resolve(null)),
  updateSession: vi.fn(() => Promise.resolve()),
  deleteSession: vi.fn(() => Promise.resolve()),
}));

// Mock the errorHandler module
vi.mock('../../utils/errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  AppError: class AppError extends Error {},
  ERROR_CODES: {},
}));

import {
  createSession,
  endSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
} from '../../utils/persistence';

describe('useSessionPersistence', () => {
  let dispatchSession;
  let sessionState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    dispatchSession = vi.fn();
    sessionState = {
      currentSession: {
        sessionId: null,
        startTime: null,
        venue: 'Online',
        gameType: '1/2',
        buyIn: null,
        rebuyTransactions: [],
        cashOut: null,
        reUp: 0,
        goal: null,
        notes: null,
        handCount: 0,
      },
      allSessions: [],
      isLoading: false,
    };
    vi.mocked(getActiveSession).mockResolvedValue(null);
    vi.mocked(getAllSessions).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createHook = (overrides = {}) => {
    const params = {
      sessionState,
      dispatchSession,
      ...overrides,
    };
    return renderHook(() =>
      useSessionPersistence(params.sessionState, params.dispatchSession)
    );
  };

  describe('initialization', () => {
    it('sets isReady to true after initialization', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isReady).toBe(true);
    });

    it('checks for active session on mount', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(getActiveSession).toHaveBeenCalled();
    });

    it('hydrates session state when active session exists', async () => {
      const mockSession = createMockSession({ sessionId: 5, venue: 'Horseshoe Casino' });
      vi.mocked(getActiveSession).mockResolvedValue({ sessionId: 5 });
      vi.mocked(getSessionById).mockResolvedValue(mockSession);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(getSessionById).toHaveBeenCalledWith(5);
      expect(dispatchSession).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.HYDRATE_SESSION,
        payload: { session: mockSession },
      });
    });

    it('does not hydrate when no active session', async () => {
      vi.mocked(getActiveSession).mockResolvedValue(null);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatchSession).not.toHaveBeenCalled();
    });

    it('sets isReady to true even when initialization fails', async () => {
      vi.mocked(getActiveSession).mockRejectedValue(new Error('DB error'));

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isReady).toBe(true);
    });
  });

  describe('startNewSession', () => {
    it('creates session in database', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(createSession).mockResolvedValue(42);

      await act(async () => {
        await result.current.startNewSession({ buyIn: 200, venue: 'Horseshoe Casino' });
      });

      expect(createSession).toHaveBeenCalledWith({ buyIn: 200, venue: 'Horseshoe Casino' });
    });

    it('sets session as active', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(createSession).mockResolvedValue(42);

      await act(async () => {
        await result.current.startNewSession({});
      });

      expect(setActiveSession).toHaveBeenCalledWith(42);
    });

    it('dispatches START_SESSION action', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(createSession).mockResolvedValue(42);

      await act(async () => {
        await result.current.startNewSession({
          buyIn: 300,
          venue: 'Wind Creek Casino',
          gameType: '2/5',
        });
      });

      expect(dispatchSession).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SESSION_ACTIONS.START_SESSION,
          payload: expect.objectContaining({
            sessionId: 42,
            venue: 'Wind Creek Casino',
            gameType: '2/5',
            buyIn: 300,
          }),
        })
      );
    });

    it('returns the session ID', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(createSession).mockResolvedValue(99);

      let sessionId;
      await act(async () => {
        sessionId = await result.current.startNewSession({});
      });

      expect(sessionId).toBe(99);
    });

    it('throws error when creation fails', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(createSession).mockRejectedValue(new Error('Creation failed'));

      await expect(
        act(async () => {
          await result.current.startNewSession({});
        })
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('endCurrentSession', () => {
    it('ends session in database with cashOut', async () => {
      sessionState = {
        ...sessionState,
        currentSession: { ...sessionState.currentSession, sessionId: 10 },
      };

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.endCurrentSession(500);
      });

      expect(endSession).toHaveBeenCalledWith(10, 500);
    });

    it('clears active session', async () => {
      sessionState = {
        ...sessionState,
        currentSession: { ...sessionState.currentSession, sessionId: 10 },
      };

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.endCurrentSession(null);
      });

      expect(clearActiveSession).toHaveBeenCalled();
    });

    it('dispatches END_SESSION action', async () => {
      sessionState = {
        ...sessionState,
        currentSession: { ...sessionState.currentSession, sessionId: 10 },
      };

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.endCurrentSession(750);
      });

      expect(dispatchSession).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.END_SESSION,
        payload: expect.objectContaining({
          cashOut: 750,
        }),
      });
    });

    it('does nothing when no active session', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.endCurrentSession(100);
      });

      expect(endSession).not.toHaveBeenCalled();
    });
  });

  describe('updateSessionField', () => {
    it('dispatches UPDATE_SESSION_FIELD action', async () => {
      sessionState = {
        ...sessionState,
        currentSession: { ...sessionState.currentSession, sessionId: 10 },
      };

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.updateSessionField('buyIn', 400);
      });

      expect(dispatchSession).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field: 'buyIn', value: 400 },
      });
    });

    it('does nothing when no active session', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      dispatchSession.mockClear();

      await act(async () => {
        await result.current.updateSessionField('buyIn', 400);
      });

      expect(dispatchSession).not.toHaveBeenCalled();
    });
  });

  describe('loadAllSessions', () => {
    it('loads sessions from database', async () => {
      const mockSessions = [
        createMockSession({ sessionId: 1 }),
        createMockSession({ sessionId: 2 }),
      ];
      vi.mocked(getAllSessions).mockResolvedValue(mockSessions);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.loadAllSessions();
      });

      expect(getAllSessions).toHaveBeenCalled();
    });

    it('dispatches LOAD_SESSIONS action', async () => {
      const mockSessions = [createMockSession({ sessionId: 1 })];
      vi.mocked(getAllSessions).mockResolvedValue(mockSessions);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      dispatchSession.mockClear();

      await act(async () => {
        await result.current.loadAllSessions();
      });

      expect(dispatchSession).toHaveBeenCalledWith({
        type: SESSION_ACTIONS.LOAD_SESSIONS,
        payload: { sessions: mockSessions },
      });
    });

    it('returns the sessions array', async () => {
      const mockSessions = [
        createMockSession({ sessionId: 1 }),
        createMockSession({ sessionId: 2 }),
      ];
      vi.mocked(getAllSessions).mockResolvedValue(mockSessions);

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      let sessions;
      await act(async () => {
        sessions = await result.current.loadAllSessions();
      });

      expect(sessions).toHaveLength(2);
    });

    it('returns empty array on error', async () => {
      vi.mocked(getAllSessions).mockRejectedValue(new Error('Load failed'));

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      let sessions;
      await act(async () => {
        sessions = await result.current.loadAllSessions();
      });

      expect(sessions).toEqual([]);
    });
  });

  describe('deleteSessionById', () => {
    it('deletes session from database', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        await result.current.deleteSessionById(5);
      });

      expect(deleteSession).toHaveBeenCalledWith(5);
    });

    it('reloads sessions after deletion', async () => {
      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(getAllSessions).mockClear();

      await act(async () => {
        await result.current.deleteSessionById(5);
      });

      expect(getAllSessions).toHaveBeenCalled();
    });

    it('throws error when deletion fails', async () => {
      vi.mocked(deleteSession).mockRejectedValue(new Error('Delete failed'));

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await expect(
        act(async () => {
          await result.current.deleteSessionById(5);
        })
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('auto-save', () => {
    it('auto-saves session changes after debounce', async () => {
      // Start with session that has buyIn: 300
      sessionState = {
        ...sessionState,
        currentSession: {
          ...sessionState.currentSession,
          sessionId: 10,
          buyIn: 300,
        },
      };

      const { result } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(updateSession).mockClear();

      // Trigger auto-save by advancing timers
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(updateSession).toHaveBeenCalledWith(10, expect.objectContaining({
        buyIn: 300,
      }));
    });

    it('does not auto-save when no active session', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      vi.mocked(updateSession).mockClear();
      rerender();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(updateSession).not.toHaveBeenCalled();
    });
  });

  describe('return values', () => {
    it('returns isReady boolean', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.isReady).toBe('boolean');
      unmount();
    });

    it('returns startNewSession function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.startNewSession).toBe('function');
      unmount();
    });

    it('returns endCurrentSession function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.endCurrentSession).toBe('function');
      unmount();
    });

    it('returns updateSessionField function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.updateSessionField).toBe('function');
      unmount();
    });

    it('returns loadAllSessions function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.loadAllSessions).toBe('function');
      unmount();
    });

    it('returns deleteSessionById function', async () => {
      const { result, unmount } = createHook();

      expect(typeof result.current.deleteSessionById).toBe('function');
      unmount();
    });
  });

  describe('function stability', () => {
    it('returns stable function references when dependencies unchanged', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const first = {
        loadAllSessions: result.current.loadAllSessions,
      };

      rerender();

      expect(result.current.loadAllSessions).toBe(first.loadAllSessions);
    });
  });
});
