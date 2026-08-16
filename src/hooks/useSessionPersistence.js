// Instantiated in: SessionContext.jsx
/**
 * useSessionPersistence.js - React hook for session persistence
 *
 * Integrates IndexedDB session persistence with React state management.
 * Handles:
 * - Database initialization on mount
 * - Auto-restore active session on startup
 * - Debounced auto-save on session changes
 * - Session creation, ending, and field updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createSessionAtomic,
  createCompletedSession,
  endSessionAtomic,
  getActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession as dbDeleteSession,
  GUEST_USER_ID,
  createPersistenceLogger,
} from '../utils/persistence/index';
import { reportPersistenceFailure, reportPersistenceHealthy } from '../utils/persistenceHealth';
import { SESSION_ACTIONS } from '../constants/sessionConstants';
import { AppError, ERROR_CODES } from '../utils/errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds

const { log, logError } = createPersistenceLogger('useSessionPersistence');

// =============================================================================
// SESSION PERSISTENCE HOOK
// =============================================================================

/**
 * useSessionPersistence - React hook for session persistence
 *
 * @param {Object} sessionState - Session state from sessionReducer
 * @param {Function} dispatchSession - Session state dispatcher
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, startNewSession, endCurrentSession, updateSessionField, loadAllSessions, deleteSessionById }
 */
export const useSessionPersistence = (sessionState, dispatchSession, userId = GUEST_USER_ID) => {
  // State
  const [isReady, setIsReady] = useState(false);

  // Refs
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const isInitializedRef = useRef(false);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log(`Initializing session persistence for user ${userId}...`);

      try {
        // Load active session marker for this user (single source of truth)
        const activeSession = await getActiveSession(userId);
        const activeSessionId = activeSession?.sessionId || null;

        // Safety net: reconcile isActive mismatches (indicates prior crash or legacy write)
        const allSessions = await getAllSessions(userId);
        for (const session of allSessions) {
          const shouldBeActive = session.sessionId === activeSessionId;
          if (session.isActive !== shouldBeActive) {
            log(`WARNING: isActive mismatch for session ${session.sessionId} (prior crash or legacy write) — fixing: ${session.isActive} -> ${shouldBeActive}`);
            await updateSession(session.sessionId, { isActive: shouldBeActive });
          }
        }

        if (activeSessionId) {
          log(`Restoring active session ${activeSessionId}`);

          // Get full session data
          const sessionData = await getSessionById(activeSessionId);

          if (sessionData) {
            // Hydrate session state
            dispatchSession({
              type: SESSION_ACTIONS.HYDRATE_SESSION,
              payload: { session: sessionData }
            });
            log('Session state hydrated');
          } else {
            // Session was deleted but activeSession marker still exists - clean up
            log(`Active session ${activeSessionId} not found - clearing marker`);
            await clearActiveSession(userId);
          }
        } else {
          log(`No active session found for user ${userId} - starting without session`);
        }

        isInitializedRef.current = true;
        setIsReady(true);
        reportPersistenceHealthy('sessions');
        log('Session persistence ready');
      } catch (error) {
        // Continue without session persistence, but not silently — see
        // persistenceHealth.js. HealthIndicator surfaces this.
        reportPersistenceFailure('sessions', error);
        logError('Initialization failed:', error);
        isInitializedRef.current = true;
        setIsReady(true);
      }
    };

    initialize();
  }, [dispatchSession, userId]); // Re-initialize if userId changes

  // ==========================================================================
  // AUTO-SAVE (on session state change)
  // ==========================================================================

  useEffect(() => {
    // Don't save during initialization or if not ready
    if (!isReady || !isInitializedRef.current) {
      return;
    }

    // Don't save if no active session
    if (!sessionState.currentSession.sessionId) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Capture current state for the save closure
    const currentSession = sessionState.currentSession;
    pendingSaveRef.current = async () => {
      try {
        log(`Auto-saving session ${currentSession.sessionId}...`);
        await updateSession(currentSession.sessionId, {
          // startTime is in the auto-save set because ActiveSessionCard lets the
          // founder correct it when the app was opened after sitting down. Absent
          // this, the correction would update the UI and be silently lost on the
          // next reload. For an uncorrected session this writes back the value it
          // was hydrated with — a no-op.
          startTime: currentSession.startTime,
          venue: currentSession.venue,
          gameType: currentSession.gameType,
          buyIn: currentSession.buyIn,
          rebuyTransactions: currentSession.rebuyTransactions,
          cashOut: currentSession.cashOut,
          reUp: currentSession.reUp,
          goal: currentSession.goal,
          notes: currentSession.notes,
          handCount: currentSession.handCount,
          straddle: currentSession.straddle ?? null,
        });
        log('Session auto-saved successfully');
      } catch (error) {
        logError('Auto-save failed:', error);
      }
      pendingSaveRef.current = null;
    };

    // Set new timer for debounced save
    saveTimerRef.current = setTimeout(() => {
      pendingSaveRef.current?.();
    }, DEBOUNCE_DELAY);

    // Cleanup: flush pending save on unmount or dependency change
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Flush any pending save so data isn't lost
      if (pendingSaveRef.current) {
        pendingSaveRef.current();
      }
    };
  }, [sessionState.currentSession, isReady]);

  // ==========================================================================
  // SESSION OPERATIONS
  // ==========================================================================

  /**
   * Start a new session (atomic with rollback)
   * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
   * @returns {Promise<number>} The new session ID
   *
   * This function implements atomic session creation with rollback:
   * 1. Create session in DB
   * 2. Set as active session in DB
   * 3. Update React state
   * If step 3 fails, steps 1-2 are rolled back to prevent orphan sessions.
   */
  const startNewSession = useCallback(async (sessionData = {}) => {
    try {
      log(`Starting new session for user ${userId}...`);

      // Atomic: create session + set active in single transaction
      const sessionId = await createSessionAtomic(sessionData, userId);
      log(`Session ${sessionId} created atomically`);

      // Update reducer state
      dispatchSession({
        type: SESSION_ACTIONS.START_SESSION,
        payload: {
          sessionId,
          startTime: Date.now(),
          venue: sessionData.venue || 'Online',
          gameType: sessionData.gameType || '1/2',
          buyIn: sessionData.buyIn || null,
          rebuyTransactions: sessionData.rebuyTransactions || [],
          reUp: sessionData.reUp || 0,
          goal: sessionData.goal || null,
          notes: sessionData.notes || null,
          straddle: sessionData.straddle || null
        }
      });

      log('New session started successfully');
      return sessionId;
    } catch (error) {
      logError(new AppError(
        ERROR_CODES.OPERATION_FAILED,
        'Failed to start new session',
        { error: error.message }
      ));
      throw error;
    }
  }, [dispatchSession, userId]);

  /**
   * End the current session
   * @param {number|null} cashOut - Optional cash out amount
   * @param {number|null} tipAmount - Optional tip amount (AUDIT-2026-04-21-SV F2).
   *   When omitted, the session's tipAmount field is not written; legacy sessions
   *   without the field remain legacy-shaped on round-trip. Readers treat any
   *   missing/null value as 0 for P&L purposes.
   * @param {number|null} endTime - Optional explicit end timestamp. Defaults to
   *   now. Set when the founder finished earlier than they tapped End Session —
   *   hours drive every rate in the Variance band, so an over-long session
   *   silently deflates $/hr.
   * @returns {Promise<void>}
   */
  const endCurrentSession = useCallback(async (cashOut = null, tipAmount = null, endTime = null) => {
    try {
      const sessionId = sessionState.currentSession.sessionId;

      if (!sessionId) {
        log('No active session to end');
        return;
      }

      log(`Ending session ${sessionId} with cashOut: ${cashOut}, tipAmount: ${tipAmount}...`);

      // Atomic: end session + clear active marker in single transaction
      const resolvedEnd = endTime ?? Date.now();
      await endSessionAtomic(sessionId, cashOut, userId, tipAmount, resolvedEnd);
      log(`Session ${sessionId} ended atomically`);

      // Update reducer state
      dispatchSession({
        type: SESSION_ACTIONS.END_SESSION,
        payload: {
          endTime: resolvedEnd,
          cashOut: cashOut,
          tipAmount: tipAmount,
        }
      });

      log('Session ended successfully');
    } catch (error) {
      logError('Failed to end session:', error);
      throw error;
    }
  }, [sessionState.currentSession.sessionId, dispatchSession, userId]);

  /**
   * Update a field in the current session
   * @param {string} field - Field name (buyIn, rebuy, goal, notes, etc.)
   * @param {*} value - New value
   * @returns {Promise<void>}
   */
  const updateSessionField = useCallback(async (field, value) => {
    try {
      const sessionId = sessionState.currentSession.sessionId;

      if (!sessionId) {
        log('No active session to update');
        return;
      }

      log(`Updating session ${sessionId} field ${field}...`);

      // Update reducer state immediately (optimistic update)
      dispatchSession({
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field, value }
      });

      // Update in database (will be debounced via auto-save)
      log(`Field ${field} updated to:`, value);
    } catch (error) {
      logError(`Failed to update field ${field}:`, error);
      throw error;
    }
  }, [sessionState.currentSession.sessionId, dispatchSession]);

  /**
   * Load all sessions from database for this user
   * @returns {Promise<Array>} Array of session records
   */
  const loadAllSessions = useCallback(async () => {
    try {
      log(`Loading all sessions for user ${userId}...`);

      const sessions = await getAllSessions(userId);
      log(`Loaded ${sessions.length} sessions`);

      // Update reducer state
      dispatchSession({
        type: SESSION_ACTIONS.LOAD_SESSIONS,
        payload: { sessions }
      });

      return sessions;
    } catch (error) {
      logError('Failed to load sessions:', error);
      return [];
    }
  }, [dispatchSession, userId]);

  /**
   * Log a session that was already played (the backfill path).
   *
   * Writes a finished record — never an active one — so logging last night's
   * session can't collide with a session in progress. Reloads the list so the
   * Insights and Variance bands recompute immediately.
   *
   * @param {Object} sessionData - from SessionLogForm (explicit start/end times)
   * @returns {Promise<number>} the new sessionId
   */
  const logCompletedSession = useCallback(async (sessionData) => {
    try {
      log(`Logging completed session for user ${userId}...`);
      const sessionId = await createCompletedSession(sessionData, userId);
      await loadAllSessions();
      return sessionId;
    } catch (error) {
      logError('Failed to log completed session:', error);
      throw error;
    }
  }, [loadAllSessions, userId]);

  /**
   * Edit an already-stored session.
   *
   * Deliberately refuses to touch `isActive`: the live session's lifecycle is
   * owned by start/end, and letting an edit flip that flag is how a view ends up
   * with two active sessions or none.
   *
   * @param {number} sessionId
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  const editSession = useCallback(async (sessionId, updates) => {
    try {
      const { isActive, sessionId: _ignored, userId: _ignoredUser, ...safe } = updates || {};
      log(`Editing session ${sessionId}...`);
      await updateSession(sessionId, safe);
      await loadAllSessions();
    } catch (error) {
      logError(`Failed to edit session ${sessionId}:`, error);
      throw error;
    }
  }, [loadAllSessions]);

  /**
   * Delete a session by ID
   * @param {number} sessionId - Session ID to delete
   * @returns {Promise<void>}
   */
  const deleteSessionById = useCallback(async (sessionId) => {
    try {
      log(`Deleting session ${sessionId}...`);

      await dbDeleteSession(sessionId);
      log(`Session ${sessionId} deleted`);

      // Reload all sessions to update list
      await loadAllSessions();
    } catch (error) {
      logError(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }, [loadAllSessions]);

  // ==========================================================================
  // RETURN VALUES
  // ==========================================================================

  return {
    isReady,
    startNewSession,
    endCurrentSession,
    updateSessionField,
    loadAllSessions,
    logCompletedSession,
    editSession,
    deleteSessionById
  };
};
